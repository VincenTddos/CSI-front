#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
core_bridge.py  --  Wi-Care 智慧長照監控系統 核心整合程式 (Neural Hub)

功能概述：
    1. [Serial Thread]   透過 USB 序列埠持續讀取 ESP32 的 CSI 移動分數
    2. [WiFi Thread]     週期性執行 Wi-Fi 三角定位 (匯入 WiFi_Location2 模組)
    3. [Async Main]      WebSocket Server (port 8765) 每秒推播 JSON 給前端

啟動方式：
    python core_bridge.py              # 正常模式 (需要硬體)
    python core_bridge.py --simulate   # 模擬模式 (無硬體時開發用)
    python core_bridge.py --ble        # BLE 模式 (無 USB 線，透過藍芽接收)

依賴套件：
    pip install websockets pyserial numpy
    pip install bleak                  # BLE 模式需要

支援平台：Windows / macOS / Linux
作者：Wi-Care Team
"""

import argparse
import asyncio
from collections import deque
import json
import logging
import math
import os
import platform
import queue
import random
import re
import sys
import threading
import time
from datetime import datetime, timezone
from typing import Optional

import numpy as np

# --------------------------------------------------------------------------- #
#  第三方套件匯入 (含安裝提示)
# --------------------------------------------------------------------------- #
try:
    import serial
    import serial.tools.list_ports
except ImportError:
    print("[ERROR] pyserial: pip install pyserial")
    sys.exit(1)

try:
    from bleak import BleakScanner, BleakClient
    BLEAK_AVAILABLE = True
except ImportError:
    BLEAK_AVAILABLE = False

try:
    import websockets
    from websockets.asyncio.server import serve
except ImportError:
    print("[ERROR] websockets: pip install websockets")
    sys.exit(1)

# --------------------------------------------------------------------------- #
#  匯入既有的 WiFi_Location2 模組 (僅使用其中的定位函式)
# --------------------------------------------------------------------------- #
try:
    import WiFi_Location2 as wifi_loc
except ImportError:
    wifi_loc = None
    print("[WARN] WiFi_Location2 not available, Wi-Fi location disabled.")

# --------------------------------------------------------------------------- #
#  日誌設定
# --------------------------------------------------------------------------- #
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("core_bridge")

# --------------------------------------------------------------------------- #
#  命令列參數解析
# --------------------------------------------------------------------------- #
def parse_args():
    """解析命令列參數"""
    parser = argparse.ArgumentParser(
        description="Wi-Care Core Bridge - IoT WebSocket Hub"
    )
    parser.add_argument(
        "--simulate", "-s",
        action="store_true",
        default=False,
        help="Enable simulation mode (no hardware required, generates fake data)",
    )
    parser.add_argument(
        "--port",
        type=str,
        default=None,
        help="Serial port override (e.g. COM3, /dev/ttyUSB0)",
    )
    parser.add_argument(
        "--ws-port",
        type=int,
        default=8765,
        help="WebSocket server port (default: 8765)",
    )
    parser.add_argument(
        "--ble",
        action="store_true",
        default=False,
        help="Use BLE instead of serial (requires bleak, ESPectre v2.7.0+)",
    )
    parser.add_argument(
        "--ble-address",
        type=str,
        default=None,
        help="BLE device address to connect first (e.g. E8:F6:0A:85:9D:02)",
    )
    parser.add_argument(
        "--record",
        type=str,
        default=None,
        help="Record movement score to a jsonl file for offline analysis (csi_pipeline.py)",
    )
    return parser.parse_args()


# =========================================================================== #
#  全域設定常數
# =========================================================================== #

# -- 作業系統偵測 --
IS_WINDOWS = platform.system() == "Windows"
IS_MACOS = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"

# -- Serial 設定 --
# Windows: "COM3", "COM4"; macOS: "/dev/tty.usbserial-*"; Linux: "/dev/ttyUSB0"
SERIAL_PORT: str = "COM3" if IS_WINDOWS else "/dev/ttyUSB0"
SERIAL_BAUD: int = 115200
SERIAL_RECONNECT_DELAY: float = 5.0      # 斷線後重連間隔 (秒)

# -- Wi-Fi 定位設定 --
WIFI_SCAN_INTERVAL: float = 5.0          # 每次掃描間隔 (秒)
WIFI_SCAN_ROUNDS: int = 3                # 每次定位做幾輪掃描取平均

# -- WebSocket 設定 --
WS_HOST: str = "0.0.0.0"
WS_PORT: int = 8765
WS_BROADCAST_INTERVAL: float = 0.1       # 推播頻率 (秒) — 10Hz
# 共享密鑰：若設定（環境變數 WICARE_WS_TOKEN），client 連線後第一則訊息必須是
# {"type":"auth","token":"<密鑰>"} 才會被加入推播名單；未設定則停用驗證（純區網開發）。
WS_AUTH_TOKEN: str = os.environ.get("WICARE_WS_TOKEN", "")

# -- 跌倒偵測 --
# 使用 ESPectre 原生判斷：mvmt >= thr → MOTION（韌體自動校正環境）
# Serial 模式解析 MOTION/IDLE；BLE 模式比較 movement vs threshold 浮點數

# -- 模擬模式旗標 (由命令列參數控制) --
SIMULATE_MODE: bool = False

# -- BLE 模式旗標 (由命令列參數控制) --
BLE_MODE: bool = False
BLE_ADDRESS: Optional[str] = None

# -- 錄製檔 (--record)：movement score 寫入 jsonl，供 csi_pipeline.py 離線分析 --
RECORD_FILE = None  # 開啟後為 file object

# -- ESPectre BLE GATT UUIDs (v2.7.0+) --
BLE_SERVICE_UUID      = "d33ff46b-2203-4775-bc6f-b3a2c36af8f0"
BLE_TELEMETRY_UUID    = "119d5cac-48da-4bd9-bfc3-169805868258"  # Notify: float32 movement + float32 threshold
BLE_SYSINFO_UUID      = "c8c89ffa-c401-461f-9ffc-942fa04adfe3"  # Notify: key=value text
BLE_CONTROL_UUID      = "33ed9214-a8d7-40e8-82d1-c82747dcdc71"  # Write: "SET_THRESHOLD:X.XX"

# Keep BLE thresholds away from near-zero values. Tiny thresholds make
# movement/threshold ratios explode and confuse the UI activity classifier.
MIN_BLE_THRESHOLD = 0.05
MAX_UI_MOVEMENT_SCORE = 100.0


# =========================================================================== #
#  執行緒安全的共享資料容器
# =========================================================================== #

class SharedState:
    """
    以 threading.Lock 保護的全域狀態容器。
    所有讀寫操作都必須透過 getter / setter 進行，避免 race condition。
    """

    def __init__(self):
        self._lock = threading.Lock()

        # -- 來自 Serial 的最新移動分數 --
        self._movement_score: float = 0.0
        self._raw_movement_score: float = 0.0
        self._movement_value: Optional[float] = None
        self._movement_threshold: Optional[float] = None

        # -- 來自 Wi-Fi 定位的最新座標 --
        self._location_x: Optional[float] = None
        self._location_y: Optional[float] = None

        # -- 子系統狀態旗標 --
        self._serial_online: bool = False
        self._wifi_online: bool = False

        # -- ESPectre 原生跌倒/動作偵測結果 --
        self._fall_detected: bool = False
        self._prev_fall_state: bool = False   # 上一個廣播週期的跌倒狀態 (邊緣偵測用)

        # -- LINE Messaging API 相關 --
        # channel token 與接收者 userId 預設由環境變數帶入，前端 settings 可覆寫。
        self._line_token: str = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN", "")
        self._line_user_id: str = os.environ.get("LINE_TARGET_USER_ID", "")
        self._last_line_notify_at: float = 0.0  # monotonic time

        self._settings = {
            "algorithm": "mvs",
            "thresholdMode": "auto",
            "manualThreshold": None,
            "sensitivity": 75,
            "lineNotifyEnabled": True,
            "adaptiveFilterEnabled": True,
            "hampelFilterEnabled": True,
            "smoothingEnabled": True,
            "lastApplied": None,
            "bleWriteStatus": "pending",
        }
        self._data_source: str = "no_data"

    # ---- Movement Score ---- #
    def set_movement_score(self, score: float) -> None:
        with self._lock:
            self._movement_score = score
            self._raw_movement_score = score

    def get_movement_score(self) -> float:
        with self._lock:
            return self._movement_score

    def set_ble_movement_metrics(
        self,
        movement: float,
        threshold: float,
        ratio_score: float,
        display_score: float,
    ) -> None:
        with self._lock:
            self._movement_value = movement
            self._movement_threshold = threshold
            self._raw_movement_score = ratio_score
            self._movement_score = min(MAX_UI_MOVEMENT_SCORE, max(0.0, display_score))

    def get_ble_movement_metrics(self) -> dict:
        with self._lock:
            return {
                "raw_movement_score": self._raw_movement_score,
                "movement_value": self._movement_value,
                "movement_threshold": self._movement_threshold,
            }

    # ---- Location ---- #
    def set_location(self, x: Optional[float], y: Optional[float]) -> None:
        with self._lock:
            self._location_x = x
            self._location_y = y

    def get_location(self) -> tuple:
        with self._lock:
            return (self._location_x, self._location_y)

    # ---- 子系統狀態 ---- #
    def set_sensor_online(self, status: bool) -> None:
        # 感測資料源（Serial 或 BLE）是否在線
        with self._lock:
            self._serial_online = status

    def set_wifi_online(self, status: bool) -> None:
        with self._lock:
            self._wifi_online = status

    def set_fall_detected(self, detected: bool) -> None:
        with self._lock:
            self._fall_detected = detected

    def is_falling(self) -> bool:
        with self._lock:
            return self._fall_detected

    def is_any_online(self) -> bool:
        with self._lock:
            return self._serial_online or self._wifi_online

    def update_settings(self, updates: dict) -> dict:
        allowed = {
            "algorithm",
            "thresholdMode",
            "manualThreshold",
            "sensitivity",
            "lineNotifyEnabled",
            "adaptiveFilterEnabled",
            "hampelFilterEnabled",
            "smoothingEnabled",
        }
        with self._lock:
            for key, value in updates.items():
                if key in allowed:
                    try:
                        if key == "sensitivity":
                            self._settings[key] = max(0.0, min(100.0, float(value)))
                        elif key == "thresholdMode":
                            if value in {"auto", "min", "manual"}:
                                self._settings[key] = value
                        elif key == "manualThreshold":
                            self._settings[key] = None if value is None else max(MIN_BLE_THRESHOLD, float(value))
                        else:
                            self._settings[key] = value
                    except (TypeError, ValueError):
                        logger.warning("[Settings] Ignoring invalid %s=%r", key, value)
                elif key == "lineToken" and isinstance(value, str):
                    # 儲存 channel access token，但不放入廣播用的 _settings（避免外洩到前端）
                    self._line_token = value.strip()
                elif key == "lineUserId" and isinstance(value, str):
                    # 接收者 userId，同樣不廣播給前端
                    self._line_user_id = value.strip()
            self._settings["lastApplied"] = datetime.now(timezone.utc).isoformat()
            if self._settings.get("thresholdMode") == "manual":
                self._settings["bleWriteStatus"] = "queued"
            elif not self._settings.get("adaptiveFilterEnabled", True):
                self._settings["bleWriteStatus"] = "synced_local_only"
            else:
                self._settings["bleWriteStatus"] = "waiting_ble_data"
            return dict(self._settings)

    def get_settings(self) -> dict:
        with self._lock:
            return dict(self._settings)

    def set_ble_write_status(self, status: str) -> None:
        with self._lock:
            self._settings["bleWriteStatus"] = status

    def set_data_source(self, source: str) -> None:
        with self._lock:
            self._data_source = source

    def get_data_source(self) -> str:
        with self._lock:
            return self._data_source

    # ---- LINE Notify 邊緣偵測 ---- #
    LINE_NOTIFY_COOLDOWN_SEC: float = 60.0  # 同一事件最短 60 秒才再通知一次

    def get_line_token(self) -> str:
        with self._lock:
            return self._line_token

    def get_line_user_id(self) -> str:
        with self._lock:
            return self._line_user_id

    def check_and_arm_line_notify(self) -> Optional[str]:
        """
        每個廣播週期呼叫一次。
        若跌倒狀態從 False → True（上升邊緣）、已啟用 LINE 通知、
        Token 非空、且距上次通知超過 COOLDOWN，則回傳 Token 字串；
        否則回傳 None。
        此方法同時更新 _prev_fall_state 與 _last_line_notify_at。
        """
        with self._lock:
            curr = self._fall_detected
            rising_edge = curr and not self._prev_fall_state
            self._prev_fall_state = curr

            if not rising_edge:
                return None
            if not self._settings.get("lineNotifyEnabled", False):
                return None
            token = self._line_token
            if not (token and self._line_user_id):
                return None
            now = time.monotonic()
            if now - self._last_line_notify_at < self.LINE_NOTIFY_COOLDOWN_SEC:
                return None

            self._last_line_notify_at = now
            return token


# 全域共享狀態實例
state = SharedState()

# 全域停止旗標 (用於優雅關閉所有執行緒)
shutdown_event = threading.Event()

# Commands from the WebSocket UI that must be applied inside the BLE loop.
ble_command_queue: "queue.Queue[str]" = queue.Queue()


class FallDetector:
    """Conservative fall-risk detector based on movement-score spikes."""

    def __init__(
        self,
        spike_threshold: float = 140.0,
        delta_threshold: float = 75.0,
        baseline_limit: float = 65.0,
        history_size: int = 8,
        cooldown_sec: float = 8.0,
        hold_sec: float = 2.5,
    ):
        self.spike_threshold = spike_threshold
        self.delta_threshold = delta_threshold
        self.baseline_limit = baseline_limit
        self.history_size = history_size
        self.cooldown_sec = cooldown_sec
        self.hold_sec = hold_sec
        self._history: list[float] = []
        self._last_trigger_at = 0.0
        self._active_until = 0.0

    def update(self, score: float, is_motion: Optional[bool] = None) -> bool:
        now = time.monotonic()
        if now < self._active_until:
            # hold 期間不 push：避免跌倒尖峰分數持續墊高 baseline，
            # 否則連續跌倒的第二次偵測靈敏度會下降。
            return True

        recent = self._history[-self.history_size :]
        baseline = float(np.median(recent)) if recent else score
        sudden_spike = (
            score >= self.spike_threshold
            and (score - baseline) >= self.delta_threshold
            and baseline <= self.baseline_limit
        )
        motion_spike = is_motion is not False and sudden_spike
        can_trigger = (now - self._last_trigger_at) >= self.cooldown_sec

        detected = motion_spike and can_trigger
        if detected:
            self._last_trigger_at = now
            self._active_until = now + self.hold_sec
            # 觸發尖峰本身也不 push，保持 baseline 乾淨。
            return True

        self._push(score)
        return False

    def _push(self, score: float) -> None:
        # 只把不高於 baseline_limit 的「安靜值」納入 baseline，
        # 避免一般活動的高分污染基準線。
        if score > self.baseline_limit:
            return
        self._history.append(score)
        if len(self._history) > self.history_size:
            self._history = self._history[-self.history_size :]


fall_detector = FallDetector()


# =========================================================================== #
#  感測器融合跌倒偵測 (Sensor Fusion)
#  條件一：movement score 突發尖峰 (沿用 FallDetector)
#  條件二：尖峰後位置停止移動 (跌倒者通常無法立即起身移動)
#  相較單純尖峰偵測，可過濾「劇烈但正常」的動作（快速坐下、彎腰撿物後續走動）。
# =========================================================================== #

class FusionFallDetector:
    """融合「動作尖峰」與「位置靜止」雙條件的跌倒偵測器。"""

    # 注意：WIFI_SCAN_INTERVAL=5s，觀察窗內可能僅 1-2 個定位點。
    # demo 真硬體時可視掃描頻率把觀察窗拉長到 10-12s。
    STILLNESS_WINDOW_SEC = 6.0    # 尖峰後觀察位置的時間窗
    STILLNESS_DIST_M     = 0.8    # 時間窗內總位移 < 0.8m 視為靜止
    LOCATION_MAX_AGE_SEC = 15.0   # 定位資料超過此秒數視為過期，退回單條件

    def __init__(self, base_detector: "FallDetector"):
        self.base = base_detector
        self._pending_spike_at: Optional[float] = None
        self._spike_location: Optional[tuple] = None
        self._location_history: deque = deque(maxlen=30)  # (t, x, y)

    def feed_location(self, x: Optional[float], y: Optional[float]) -> None:
        """由 wifi_location_thread 在每次定位成功時呼叫。"""
        if x is not None and y is not None:
            self._location_history.append((time.monotonic(), x, y))

    def update(self, score: float, is_motion: Optional[bool] = None) -> bool:
        now = time.monotonic()
        spike = self.base.update(score, is_motion)

        # --- 階段一：偵測到動作尖峰，記下當下位置，進入觀察期 --- #
        if spike and self._pending_spike_at is None:
            self._pending_spike_at = now
            self._spike_location = self._latest_location()
            logger.info("[Fusion] 動作尖峰，進入位置觀察期 (%.1fs)",
                        self.STILLNESS_WINDOW_SEC)
            return False  # 暫不觸發，等位置確認

        # --- 階段二：觀察期內，檢查位置是否靜止 --- #
        if self._pending_spike_at is not None:
            elapsed = now - self._pending_spike_at
            if elapsed < self.STILLNESS_WINDOW_SEC:
                return False  # 還在觀察

            # 觀察期結束 → 結算位移
            displacement = self._displacement_since(self._pending_spike_at)
            self._pending_spike_at = None

            if displacement is None:
                # 定位資料不足/過期 → 退回單條件（保守：仍然觸發）
                logger.info("[Fusion] 無有效定位，退回單條件觸發")
                return True

            if displacement < self.STILLNESS_DIST_M:
                logger.info("[Fusion] 尖峰後位移 %.2fm < %.1fm → 確認跌倒風險",
                            displacement, self.STILLNESS_DIST_M)
                return True
            logger.info("[Fusion] 尖峰後位移 %.2fm，判定為正常活動，抑制警報",
                        displacement)
            return False

        return False

    # ---- 內部輔助 ---- #
    def _latest_location(self) -> Optional[tuple]:
        if not self._location_history:
            return None
        t, x, y = self._location_history[-1]
        if time.monotonic() - t > self.LOCATION_MAX_AGE_SEC:
            return None
        return (x, y)

    def _displacement_since(self, t0: float) -> Optional[float]:
        """計算 t0 之後的累計位移（公尺）；資料不足回傳 None。"""
        pts = [(t, x, y) for (t, x, y) in self._location_history if t >= t0]
        if len(pts) < 2:
            return None
        total = 0.0
        for (_, x1, y1), (_, x2, y2) in zip(pts, pts[1:]):
            total += math.hypot(x2 - x1, y2 - y1)
        return total


fusion_detector = FusionFallDetector(fall_detector)


# =========================================================================== #
#  久未活動偵測 (Inactivity Detector)
#  連續 N 分鐘 movement score 低於閾值 → 異常靜止警報（與跌倒互補的反向風險）
# =========================================================================== #

class InactivityDetector:
    INACTIVE_SCORE_MAX  = 3.0          # 低於此分數視為「無活動」
    INACTIVE_MINUTES    = 45.0         # 連續無活動達此分鐘數 → 告警
    QUIET_HOURS         = (22, 7)      # 夜間睡眠時段 (22:00–07:00) 不告警
    REALERT_COOLDOWN    = 30 * 60.0    # 告警後 30 分鐘內不重複

    def __init__(self):
        self._inactive_since: Optional[float] = None
        self._last_alert_at: float = 0.0
        self._alert_active: bool = False

    def _in_quiet_hours(self) -> bool:
        h = datetime.now().hour
        start, end = self.QUIET_HOURS
        return (h >= start or h < end) if start > end else (start <= h < end)

    def update(self, score: float) -> Optional[str]:
        """每個廣播週期呼叫。回傳告警訊息字串（需發送）或 None。"""
        now = time.monotonic()

        # ---- 有活動 → 重置計時、解除狀態 ---- #
        if score > self.INACTIVE_SCORE_MAX:
            if self._alert_active:
                logger.info("[Inactivity] 偵測到活動，異常靜止狀態解除")
            self._inactive_since = None
            self._alert_active = False
            return None

        # ---- 無活動 → 開始/持續計時 ---- #
        if self._inactive_since is None:
            self._inactive_since = now
            return None

        inactive_min = (now - self._inactive_since) / 60.0
        if inactive_min < self.INACTIVE_MINUTES:
            return None
        if self._in_quiet_hours():
            return None  # 夜間睡眠，不打擾
        if self._alert_active or (now - self._last_alert_at) < self.REALERT_COOLDOWN:
            return None

        self._alert_active = True
        self._last_alert_at = now
        return (
            f"\n🟡 Wi-Care 異常靜止提醒\n"
            f"被照護者已連續 {inactive_min:.0f} 分鐘無明顯活動，\n"
            f"且目前非睡眠時段，建議前往查看。\n"
            f"時間：{datetime.now().strftime('%Y-%m-%d %H:%M')}"
        )


inactivity_detector = InactivityDetector()


# =========================================================================== #
#  LINE 推播 (使用內建 urllib，無需額外安裝)
#
#  ⚠️ LINE Notify 已於 2025-03-31 永久終止服務，故改用 Messaging API 的
#     push message 端點。需要 Channel Access Token 與接收者 userId。
#     userId 可從 webhook 事件或 LINE Official Account Manager 取得。
# =========================================================================== #

def send_line_push(channel_token: str, user_id: str, message: str) -> None:
    """
    透過 LINE Messaging API 的 push message 發送推播訊息。
    在背景執行緒中呼叫，不阻塞主事件迴圈。
    API 文件: https://developers.line.biz/en/reference/messaging-api/#send-push-message
    """
    if not (channel_token and user_id):
        logger.warning("[LINE] 缺少 channel token 或 userId，略過推播")
        return
    import urllib.request
    try:
        data = json.dumps({
            "to": user_id,
            "messages": [{"type": "text", "text": message}],
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://api.line.me/v2/bot/message/push",
            data=data,
            headers={
                "Authorization": f"Bearer {channel_token}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info("[LINE] 推播成功，status=%s", resp.status)
    except Exception as exc:
        logger.error("[LINE] 推播失敗: %s", exc)


# =========================================================================== #
#  Supabase 雲端推送 (使用內建 urllib + service_role 金鑰；env 未設定則停用)
#  支援多裝置：每台 core_bridge 以各自的 WICARE_DEVICE_ID 上傳資料。
# =========================================================================== #

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
WICARE_DEVICE_ID = os.environ.get("WICARE_DEVICE_ID", "")
SUPABASE_ENABLED = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def _supabase_request(method: str, path: str, body: Optional[dict] = None,
                      prefer: Optional[str] = None):
    """對 Supabase REST (PostgREST) 發出請求；回傳解析後的 JSON（或 None）。失敗僅記錄。"""
    if not SUPABASE_ENABLED:
        return None
    import urllib.request
    try:
        url = f"{SUPABASE_URL}/rest/v1/{path}"
        data = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "apikey": SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.debug("[Supabase] %s %s → %s", method, path, resp.status)
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else None
    except Exception as exc:
        logger.warning("[Supabase] %s %s 失敗: %s", method, path, exc)
        return None


# ---- 通知升級（跌倒未確認 → X 分鐘後再次推播）----
ESCALATE_AFTER_SEC = 120.0
_pending_falls: list = []   # [{id, at(monotonic), done}]
# _pending_falls 由事件迴圈的 run_in_executor 背景執行緒共用讀寫，需鎖保護。
_pending_falls_lock = threading.Lock()


def supabase_insert_fall_event(score: float, loc_x, loc_y) -> None:
    """跌倒事件寫入 fall_events 表，並登記等待確認（供升級通知）。"""
    rows = _supabase_request("POST", "fall_events", {
        "device_id": WICARE_DEVICE_ID or None,
        "movement_score": round(score, 2),
        "location_x": round(loc_x, 2) if loc_x is not None else None,
        "location_y": round(loc_y, 2) if loc_y is not None else None,
        "event_type": "跌倒風險",
        "confidence": min(99.0, round(score, 2)),
        "status": "pending",
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }, prefer="return=representation")
    try:
        if rows and isinstance(rows, list) and rows[0].get("id"):
            with _pending_falls_lock:
                _pending_falls.append({"id": rows[0]["id"], "at": time.monotonic(), "done": False})
    except Exception:
        pass


def supabase_insert_inactivity_event(score: float) -> None:
    """異常靜止事件沿用 fall_events 表（以 event_type 區分）。"""
    _supabase_request("POST", "fall_events", {
        "device_id": WICARE_DEVICE_ID or None,
        "movement_score": round(score, 2),
        "event_type": "異常靜止",
        "confidence": 80.0,
        "status": "pending",
        "detected_at": datetime.now(timezone.utc).isoformat(),
    }, prefer="return=minimal")


def process_escalations(line_token: str, line_user_id: str) -> None:
    """檢查逾時未確認的跌倒事件，仍為 pending 則發送升級通知（在背景執行緒呼叫）。"""
    now = time.monotonic()
    with _pending_falls_lock:
        pending_snapshot = list(_pending_falls)
    for p in pending_snapshot:
        if p["done"] or (now - p["at"]) < ESCALATE_AFTER_SEC:
            continue
        p["done"] = True
        rows = _supabase_request("GET", f"fall_events?id=eq.{p['id']}&select=status")
        status = rows[0]["status"] if rows and isinstance(rows, list) else None
        if status == "pending" and line_token:
            send_line_push(
                line_token,
                line_user_id,
                "\n🚨【升級通知】\n跌倒警報已超過 2 分鐘無人確認，\n請立即派員前往查看！",
            )
            logger.info("[LINE] 已發送跌倒升級通知 (event=%s)", p["id"])
    # 清掉已處理的，避免清單無限長
    with _pending_falls_lock:
        _pending_falls[:] = [p for p in _pending_falls if not p["done"]]


def supabase_upsert_activity(bucket_iso: str, level: str, avg_score: float,
                             max_score: float, count: int) -> None:
    """每分鐘活動彙整 upsert 到 activity_summaries（依 device_id+bucket_time 唯一）。"""
    _supabase_request(
        "POST",
        "activity_summaries?on_conflict=device_id,bucket_time",
        {
            "device_id": WICARE_DEVICE_ID or None,
            "bucket_time": bucket_iso,
            "activity_level": level,
            "avg_score": round(avg_score, 2),
            "max_score": round(max_score, 2),
            "sample_count": count,
        },
        prefer="resolution=merge-duplicates,return=minimal",
    )


def classify_activity_level(avg_score: float) -> str:
    """將平均移動分數對應到 5 級活動狀態（睡眠/靜坐/輕微活動/行走/激烈活動）。"""
    if avg_score < 5:
        return "睡眠"
    if avg_score < 15:
        return "靜坐"
    if avg_score < 35:
        return "輕微活動"
    if avg_score < 65:
        return "行走"
    return "激烈活動"


def supabase_device_heartbeat(status: str = "online") -> None:
    """更新 devices.last_seen_at 心跳。"""
    if not (SUPABASE_ENABLED and WICARE_DEVICE_ID):
        return
    _supabase_request(
        "PATCH",
        f"devices?id=eq.{WICARE_DEVICE_ID}",
        {"status": status, "last_seen_at": datetime.now(timezone.utc).isoformat()},
        prefer="return=minimal",
    )


def build_threshold_command(settings: dict, movement_window: deque) -> Optional[str]:
    r"""
    統計式自適應閾值演算法 — 依最近 N 筆移動分數估計動作偵測閾值 T。

    設最近 N 筆樣本 S = {s_1, ..., s_N}（movement_window，N ≤ 200；需 N ≥ 20 才啟動）。

    步驟一｜Hampel 離群值過濾（hampelFilterEnabled，且 N ≥ 7 時）
        m   = median(S)
        MAD = median(|s_i - m|)
        S'  = { s_i ∈ S : |s_i - m| ≤ 3 · 1.4826 · MAD }
        （1.4826 為常態分布下 MAD→標準差的尺度因子；即 3-sigma 穩健門檻。）
        若 |S'| < 10 則退回原始 S，避免過度過濾。

    步驟二｜敏感度因子（sensitivity α ∈ [0,100]，預設 75）
        f(α) = 1.3 − 0.6 · (α / 100)
        α 越大 → f 越小 → 閾值越低 → 越容易觸發。f∈[0.7, 1.3]。

    步驟三｜閾值估計（依 thresholdMode）
        auto  : T = P95(S') · 1.1  · f(α)   # 以第 95 百分位估環境噪聲上界，乘安全裕度
        min   : T = P75(S') · 0.85 · f(α)   # 高敏感度模式，以第 75 百分位估計
        manual: T = T_manual                # 使用者手動指定

    步驟四｜下限保護
        T_final = max(T, MIN_BLE_THRESHOLD)，MIN_BLE_THRESHOLD = 0.05
        防止閾值趨近 0 導致 movement/threshold 比值爆炸。

    最終回傳 "SET_THRESHOLD:{T:.6f}"，由呼叫端經 BLE GATT Control characteristic
    下發至 ESP32-S3 韌體；資料不足時回傳 None。

    此機制讓系統在不同房間/擺設下自動校正，無需人工調參，是 Wi-Fi 感測
    cross-domain（跨環境）問題的工程化緩解手段。
    """
    mode = settings.get("thresholdMode", "auto")
    if mode == "manual":
        threshold = settings.get("manualThreshold")
        if threshold is None:
            return None
        threshold = max(MIN_BLE_THRESHOLD, float(threshold))
    else:
        if len(movement_window) < 20:
            state.set_ble_write_status("waiting_ble_data")
            return None

        samples = np.array(movement_window, dtype=float)
        if settings.get("hampelFilterEnabled", True) and len(samples) >= 7:
            median = float(np.median(samples))
            mad = float(np.median(np.abs(samples - median)))
            if mad > 0:
                samples = samples[np.abs(samples - median) <= 3.0 * 1.4826 * mad]
            if len(samples) < 10:
                samples = np.array(movement_window, dtype=float)

        sensitivity = max(0.0, min(100.0, float(settings.get("sensitivity", 75))))
        # Higher sensitivity lowers the threshold; lower sensitivity raises it.
        sensitivity_factor = 1.3 - (sensitivity / 100.0) * 0.6

        if mode == "min":
            # High-sensitivity mode: lower than auto, but still protected by
            # MIN_BLE_THRESHOLD so the score does not jump to thousands.
            threshold = float(np.percentile(samples, 75)) * 0.85 * sensitivity_factor
        else:
            threshold = float(np.percentile(samples, 95)) * 1.1 * sensitivity_factor

    threshold = max(MIN_BLE_THRESHOLD, threshold)
    if threshold <= 0:
        return None
    return f"SET_THRESHOLD:{threshold:.6f}"


def normalize_ble_display_score(movement_window: deque) -> float:
    """Map recent BLE movement changes to a stable 0-100 UI score."""
    if len(movement_window) < 5:
        return 0.0

    samples = np.array(movement_window, dtype=float)
    samples = samples[np.isfinite(samples)]
    if len(samples) < 5:
        return 0.0

    current = float(samples[-1])
    baseline = float(np.median(samples))
    p90 = float(np.percentile(samples, 90))
    p98 = float(np.percentile(samples, 98))
    mad = float(np.median(np.abs(samples - baseline)))

    # Use robust spread rather than firmware threshold so a bad threshold cannot
    # pin the dashboard at 100 forever.
    noise_floor = max(0.005, mad * 1.4826, (p90 - baseline) * 0.5)
    scale = max(0.05, noise_floor * 4.0, p98 - baseline)
    activity = max(0.0, current - baseline)

    return min(MAX_UI_MOVEMENT_SCORE, (activity / scale) * 100.0)


# =========================================================================== #
#  任務一：ESP32 序列埠讀取 (在獨立 Thread 中執行)
# =========================================================================== #

def serial_reader_thread() -> None:
    """
    持續從 ESP32 序列埠讀取 CSI 移動分數。
    預期資料格式： "Movement Score: 15.2"
    包含自動重連機制：序列埠斷線時會每隔 N 秒嘗試重新連線。
    """
    logger.info("[Serial] Thread started, target: %s @ %d baud", SERIAL_PORT, SERIAL_BAUD)

    # ESPectre firmware 格式: "... | mvmt:0.6572 thr:1.0000 | IDLE | ..."
    score_pattern = re.compile(r"\bmvmt:([\d.]+)", re.IGNORECASE)
    motion_pattern = re.compile(r"\b(MOTION|IDLE)\b")

    while not shutdown_event.is_set():
        ser: Optional[serial.Serial] = None
        try:
            # ---- 嘗試開啟序列埠 ---- #
            # dsrdtr/rtscts=False 防止 CH343/CH340 晶片在連線時觸發 ESP32 重置
            ser = serial.Serial(
                port=SERIAL_PORT,
                baudrate=SERIAL_BAUD,
                timeout=1.0,
                dsrdtr=False,
                rtscts=False,
            )
            state.set_sensor_online(True)
            logger.info("[Serial] Connected to %s", SERIAL_PORT)

            # ---- 持續讀取迴圈 ---- #
            while not shutdown_event.is_set():
                raw_line = ser.readline()
                if not raw_line:
                    # readline 超時（timeout 內沒收到完整行），繼續等待
                    continue

                # 嘗試 UTF-8 解碼，忽略無法解碼的位元組
                line = raw_line.decode("utf-8", errors="ignore").strip()
                if not line:
                    continue

                match = score_pattern.search(line)
                if match:
                    try:
                        # mvmt 是 movement/threshold 比值，已是相對分數。
                        # raw_score 乘 100 但「不」clamp，供跌倒尖峰偵測使用
                        # （與 BLE 模式一致；spike_threshold=140 需要 >100 的尖峰才會觸發）。
                        # ui_score 才 clamp 到 0-100，僅供前端顯示。
                        raw_mvmt = float(match.group(1))
                        raw_score = raw_mvmt * 100.0
                        ui_score = min(100.0, raw_score)
                        state.set_movement_score(ui_score)
                        state.set_data_source("hardware_serial")
                        state.set_sensor_online(True)
                        # ESPectre 的 MOTION 只代表一般活動，不等同跌倒。
                        # 跌倒風險改由 movement score 的突發尖峰判定，避免走動就觸發警報。
                        m = motion_pattern.search(line)
                        is_motion = m.group(1).upper() == "MOTION" if m else None
                        # 感測器融合：動作尖峰 + 位置靜止雙條件確認
                        state.set_fall_detected(fusion_detector.update(raw_score, is_motion))
                        logger.info("[Serial] mvmt=%.4f raw=%.1f ui=%.1f motion=%s",
                                     raw_mvmt, raw_score, ui_score,
                                     m.group(1) if m else "?")
                    except ValueError:
                        logger.warning("[Serial] Cannot parse mvmt: %s", match.group(1))
                else:
                    logger.debug("[Serial] Unexpected data: %s", line[:120])

        except serial.SerialException as exc:
            state.set_sensor_online(False)
            state.set_movement_score(0.0)
            state.set_fall_detected(False)
            logger.warning("[Serial] Port error: %s", exc)

        except Exception as exc:
            state.set_sensor_online(False)
            state.set_movement_score(0.0)
            state.set_fall_detected(False)
            logger.error("[Serial] Unexpected error: %s", exc)

        finally:
            # 確保序列埠被正確關閉
            if ser and ser.is_open:
                try:
                    ser.close()
                except Exception:
                    pass
            state.set_sensor_online(False)

        # ---- 斷線後等待再重試 ---- #
        if not shutdown_event.is_set():
            logger.info(
                "[Serial] Reconnecting in %.0f seconds...", SERIAL_RECONNECT_DELAY
            )
            shutdown_event.wait(timeout=SERIAL_RECONNECT_DELAY)

    logger.info("[Serial] Thread stopped.")


# =========================================================================== #
#  任務一 (BLE 版)：透過藍芽接收 ESPectre 資料 (ESPectre v2.7.0+)
# =========================================================================== #

async def _ble_reader_async() -> None:
    """BLE 模式的非同步主迴圈，掃描並連接 ESPectre 裝置後持續接收 telemetry"""
    import struct
    movement_window = deque(maxlen=200)
    last_threshold_command: Optional[str] = None
    last_auto_write = 0.0
    last_telemetry_at = 0.0
    smoothed_movement: Optional[float] = None

    def on_telemetry(sender, data: bytearray) -> None:
        nonlocal last_telemetry_at, smoothed_movement
        if len(data) >= 8:
            last_telemetry_at = time.time()
            raw_movement = struct.unpack_from('<f', data, 0)[0]
            threshold = struct.unpack_from('<f', data, 4)[0]
            settings = state.get_settings()

            if settings.get("smoothingEnabled", True):
                if smoothed_movement is None:
                    smoothed_movement = raw_movement
                else:
                    smoothed_movement = 0.7 * smoothed_movement + 0.3 * raw_movement
                movement = smoothed_movement
            else:
                movement = raw_movement

            movement_window.append(movement)
            effective_threshold = max(MIN_BLE_THRESHOLD, threshold)
            raw_score = (movement / effective_threshold * 100.0) if effective_threshold > 0 else 0.0
            ui_score = normalize_ble_display_score(movement_window)
            is_motion = movement >= effective_threshold
            state.set_ble_movement_metrics(movement, effective_threshold, raw_score, ui_score)
            state.set_data_source("hardware_ble")
            state.set_sensor_online(True)
            if settings.get("algorithm") == "ml":
                # Lightweight ML-style gate for demo hardware without an embedded model file.
                # Use display dynamics, not raw ratio, because a stale BLE threshold can be too small.
                state.set_fall_detected(ui_score >= 90.0 and is_motion)
            else:
                # 感測器融合：動作尖峰 + 位置靜止雙條件確認
                state.set_fall_detected(fusion_detector.update(raw_score, is_motion))
            logger.info("[BLE] mvmt=%.4f thr=%.4f raw_score=%.1f%% ui_score=%.1f motion=%s",
                        movement, effective_threshold, raw_score, ui_score, is_motion)

    while not shutdown_event.is_set():
        device = None
        try:
            if BLE_ADDRESS:
                logger.info("[BLE] Looking for configured device: %s", BLE_ADDRESS)
                device = await BleakScanner.find_device_by_address(BLE_ADDRESS, timeout=10.0)

            logger.info("[BLE] Scanning for ESPectre (10s)...")
            # 先用 service UUID 掃描，找不到再用裝置名稱 fallback
            if device is None:
                device = await BleakScanner.find_device_by_filter(
                    lambda d, adv: BLE_SERVICE_UUID.lower() in [s.lower() for s in (adv.service_uuids or [])],
                    timeout=10.0,
                )
            if device is None:
                device = await BleakScanner.find_device_by_name("ESPectre", timeout=5.0)

            if device is None:
                logger.warning("[BLE] ESPectre not found, retrying in 5s...")
                state.set_sensor_online(False)
                state.set_movement_score(0.0)
                state.set_fall_detected(False)
                state.set_data_source("device_not_found")
                await asyncio.sleep(5.0)
                continue

            logger.info("[BLE] Found: %s  addr=%s", device.name, device.address)

            async with BleakClient(device.address, timeout=30.0) as client:
                last_telemetry_at = time.time()
                state.set_sensor_online(False)
                state.set_movement_score(0.0)
                state.set_fall_detected(False)
                state.set_data_source("connected_waiting_telemetry")
                logger.info("[BLE] Connected to %s", device.address)

                await client.start_notify(BLE_TELEMETRY_UUID, on_telemetry)
                logger.info("[BLE] Subscribed to telemetry characteristic")

                while not shutdown_event.is_set() and client.is_connected:
                    if time.time() - last_telemetry_at > 20.0:
                        logger.warning("[BLE] Telemetry timeout, reconnecting...")
                        state.set_sensor_online(False)
                        state.set_movement_score(0.0)
                        state.set_fall_detected(False)
                        state.set_data_source("telemetry_timeout")
                        break

                    settings = state.get_settings()
                    if settings.get("thresholdMode") != "manual" and settings.get("adaptiveFilterEnabled", True):
                        now = time.time()
                        if now - last_auto_write >= 5.0:
                            command = build_threshold_command(settings, movement_window)
                            if command and command != last_threshold_command:
                                ble_command_queue.put(command)
                                state.set_ble_write_status("queued")
                                last_threshold_command = command
                            last_auto_write = now

                    while True:
                        try:
                            command = ble_command_queue.get_nowait()
                        except queue.Empty:
                            break
                        try:
                            await client.write_gatt_char(BLE_CONTROL_UUID, command.encode("utf-8"), response=True)
                            state.set_ble_write_status("applied")
                            logger.info("[BLE] Control command applied: %s", command)
                        except Exception as exc:
                            state.set_ble_write_status(f"write_failed: {exc}")
                            logger.warning("[BLE] Control command failed (%s): %s", command, exc)
                    await asyncio.sleep(0.5)

                try:
                    await client.stop_notify(BLE_TELEMETRY_UUID)
                except Exception:
                    pass

        except Exception as exc:
            logger.warning("[BLE] Error: %s", exc)

        state.set_sensor_online(False)
        state.set_movement_score(0.0)
        state.set_fall_detected(False)

        if not shutdown_event.is_set():
            logger.info("[BLE] Reconnecting in 5s...")
            state.set_data_source("reconnecting")
            await asyncio.sleep(5.0)


def ble_reader_thread() -> None:
    """在獨立執行緒中運行 BLE 非同步讀取迴圈"""
    logger.info("[BLE] Thread started")
    asyncio.run(_ble_reader_async())
    logger.info("[BLE] Thread stopped")


# =========================================================================== #
#  任務一 (模擬版)：產生假的移動分數
# =========================================================================== #

def simulated_serial_thread() -> None:
    """
    模擬模式：不需要 ESP32 硬體，產生模擬的 CSI 移動分數。
    使用正弦波 + 隨機雜訊模擬人體活動偵測。
    適用於前端開發測試。
    """
    logger.info("[Serial-SIM] Simulated serial thread started.")
    state.set_sensor_online(True)

    # 模擬參數
    base_score = 10.0        # 基底分數 (靜止狀態)
    amplitude = 15.0         # 正弦波振幅
    noise_range = 3.0        # 隨機雜訊範圍
    period_sec = 20.0        # 正弦波週期 (秒)
    tick = 0

    # 偶爾模擬跌倒事件的計數器
    fall_counter = 0
    fall_interval = 60       # 每 60 個 tick (~60秒) 模擬一次跌倒

    while not shutdown_event.is_set():
        # 正弦波模擬周期性活動
        wave = math.sin(2 * math.pi * tick / period_sec) * amplitude
        noise = random.uniform(-noise_range, noise_range)
        score = max(0.0, base_score + wave + noise)

        # 每隔一段時間模擬一次明顯尖峰 (疑似跌倒)
        fall_counter += 1
        if fall_counter >= fall_interval:
            score = random.uniform(150.0, 190.0)
            fall_counter = 0
            logger.info("[Serial-SIM] Simulated fall event! Score=%.1f", score)

        state.set_movement_score(round(score, 2))
        # 模擬模式刻意走純尖峰偵測（不經 fusion）：simulated_wifi_thread 的座標持續移動，
        # 會被融合判定為「正常活動」而抑制警報，故 sim demo 直接用 FallDetector 即時觸發。
        state.set_fall_detected(fall_detector.update(score, score >= 100.0))
        logger.debug("[Serial-SIM] Score=%.2f", score)

        tick += 1
        shutdown_event.wait(timeout=1.0)

    state.set_sensor_online(False)
    logger.info("[Serial-SIM] Thread stopped.")


# =========================================================================== #
#  任務二：Wi-Fi 室內三角定位 (在獨立 Thread 中執行)
# =========================================================================== #

def wifi_location_thread() -> None:
    """
    週期性呼叫 WiFi_Location2 模組中的掃描與定位邏輯。
    因為 Wi-Fi 掃描會執行系統命令 (subprocess) 造成阻塞，
    所以必須在獨立執行緒中運行，避免影響 Serial 與 WebSocket。

    定位失敗時保留上次的座標值 (或回傳 null)。
    """
    if wifi_loc is None:
        logger.warning("[WiFi] WiFi_Location2 module not available, location disabled.")
        return

    logger.info(
        "[WiFi] Thread started, scan every %.1fs, %d rounds per cycle",
        WIFI_SCAN_INTERVAL,
        WIFI_SCAN_ROUNDS,
    )

    while not shutdown_event.is_set():
        try:
            # ---- Step 1: 多輪掃描收集 RSSI 樣本 ---- #
            samples = {ssid: [] for ssid in wifi_loc.KNOWN_APS.keys()}

            for round_idx in range(WIFI_SCAN_ROUNDS):
                if shutdown_event.is_set():
                    return

                try:
                    rssi_map, _ = wifi_loc.scan_rssi(wifi_loc.IFACE)
                    for ssid in samples:
                        if ssid in rssi_map:
                            samples[ssid].append(rssi_map[ssid])
                except Exception as scan_exc:
                    logger.warning(
                        "[WiFi] Round %d scan failed: %s", round_idx + 1, scan_exc
                    )

                # 掃描間隙 (可被 shutdown 打斷)
                if round_idx < WIFI_SCAN_ROUNDS - 1:
                    shutdown_event.wait(timeout=wifi_loc.SCAN_INTERVAL_SEC)

            # ---- Step 2: 篩選可用的 AP (至少被偵測 2 次) ---- #
            usable = []
            for ssid, rssi_list in samples.items():
                if len(rssi_list) >= 2:
                    usable.append((ssid, float(np.mean(rssi_list))))

            # 依 RSSI 強度排序 (越大 = 越近)
            usable.sort(key=lambda item: item[1], reverse=True)

            # 可選：僅使用前 N 個最強的 AP
            if wifi_loc.MAX_ANCHORS is not None and len(usable) > wifi_loc.MAX_ANCHORS:
                usable = usable[: wifi_loc.MAX_ANCHORS]

            # ---- Step 3: 執行三角定位 ---- #
            if len(usable) < 3:
                logger.info(
                    "[WiFi] Not enough APs (need >= 3, got %d), keeping old location.",
                    len(usable),
                )
                # 注意：不更新座標，保留上次的值 (可能是 None)
                state.set_wifi_online(False)
                shutdown_event.wait(timeout=WIFI_SCAN_INTERVAL)
                continue

            anchors = []
            dists = []
            for ssid, mean_rssi in usable:
                x, y = wifi_loc.KNOWN_APS[ssid]
                d = wifi_loc.rssi_to_distance_m(
                    mean_rssi, wifi_loc.A_AT_1M, wifi_loc.PATH_LOSS_N
                )
                anchors.append((x, y))
                dists.append(d)

            anchors_arr = np.array(anchors, dtype=float)
            dists_arr = np.array(dists, dtype=float)

            estimated = wifi_loc.multilateration_ls(anchors_arr, dists_arr)
            est_x, est_y = float(estimated[0]), float(estimated[1])

            state.set_location(est_x, est_y)
            fusion_detector.feed_location(est_x, est_y)  # 餵給融合偵測器做位置靜止判定
            state.set_wifi_online(True)
            logger.info("[WiFi] Location: x=%.2f, y=%.2f", est_x, est_y)

        except Exception as exc:
            state.set_wifi_online(False)
            logger.error("[WiFi] Location error: %s", exc)

        # ---- 等待下次掃描 ---- #
        shutdown_event.wait(timeout=WIFI_SCAN_INTERVAL)

    logger.info("[WiFi] Thread stopped.")


# =========================================================================== #
#  任務二 (模擬版)：產生假的定位座標
# =========================================================================== #

def simulated_wifi_thread() -> None:
    """
    模擬模式：產生模擬的室內定位座標。
    模擬一個人在房間內緩慢走動的軌跡 (使用 Lissajous 曲線)。
    """
    logger.info("[WiFi-SIM] Simulated WiFi location thread started.")
    state.set_wifi_online(True)

    # 模擬房間尺寸 (公尺)
    room_w, room_h = 6.0, 5.0
    center_x, center_y = room_w / 2.0, room_h / 2.0
    radius_x, radius_y = 2.0, 1.5
    tick = 0

    while not shutdown_event.is_set():
        # 使用 Lissajous 曲線模擬走動軌跡
        t = tick * 0.05
        x = center_x + radius_x * math.sin(t * 1.0) + random.uniform(-0.2, 0.2)
        y = center_y + radius_y * math.sin(t * 0.7) + random.uniform(-0.2, 0.2)

        # 確保座標在房間範圍內
        x = max(0.0, min(room_w, x))
        y = max(0.0, min(room_h, y))

        state.set_location(round(x, 4), round(y, 4))
        logger.debug("[WiFi-SIM] Location: x=%.2f, y=%.2f", x, y)

        tick += 1
        shutdown_event.wait(timeout=WIFI_SCAN_INTERVAL)

    state.set_wifi_online(False)
    logger.info("[WiFi-SIM] Thread stopped.")


# =========================================================================== #
#  任務三：WebSocket 伺服器推播 (Async)
# =========================================================================== #

# 維護所有已連線的前端 Client
connected_clients: set = set()


async def _authenticate(websocket) -> bool:
    """
    若有設定 WS_AUTH_TOKEN，要求 client 的第一則訊息為
    {"type":"auth","token":"<密鑰>"}，token 相符才放行。
    """
    try:
        raw = await asyncio.wait_for(websocket.recv(), timeout=5.0)
        packet = json.loads(raw)
    except Exception:
        return False
    return packet.get("type") == "auth" and packet.get("token") == WS_AUTH_TOKEN


async def ws_handler(websocket) -> None:
    """
    處理單一 WebSocket 連線的生命週期。
    通過驗證後加入 connected_clients 集合；斷線時自動移除。
    """
    client_addr = websocket.remote_address
    logger.info("[WS] New connection: %s", client_addr)

    if WS_AUTH_TOKEN and not await _authenticate(websocket):
        logger.warning("[WS] 驗證失敗，拒絕連線: %s", client_addr)
        await websocket.close(code=4001, reason="auth required")
        return

    connected_clients.add(websocket)

    try:
        async for message in websocket:
            logger.debug("[WS] Message from %s: %s", client_addr, message[:200])
            try:
                packet = json.loads(message)
            except json.JSONDecodeError:
                logger.warning("[WS] Ignoring non-JSON message from %s", client_addr)
                continue

            if packet.get("type") == "settings_update":
                settings = state.update_settings(packet.get("payload", {}))
                logger.info("[WS] Settings updated: %s", settings)

                if settings.get("thresholdMode") == "manual" and settings.get("manualThreshold") is not None:
                    try:
                        threshold = float(settings["manualThreshold"])
                        if threshold < MIN_BLE_THRESHOLD:
                            raise ValueError(f"threshold must be >= {MIN_BLE_THRESHOLD}")
                        threshold = max(MIN_BLE_THRESHOLD, threshold)
                        ble_command_queue.put(f"SET_THRESHOLD:{threshold:.6f}")
                    except (TypeError, ValueError) as exc:
                        state.set_ble_write_status(f"invalid_threshold: {exc}")

                await websocket.send(json.dumps({
                    "type": "settings_ack",
                    "settings": state.get_settings(),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }, ensure_ascii=False))
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        connected_clients.discard(websocket)
        logger.info("[WS] Connection closed: %s", client_addr)


def build_broadcast_payload() -> str:
    """
    組裝要推播給前端的完整狀態 JSON 封包。
    包含 ai_analysis / location / timestamp。
    """
    score = state.get_movement_score()
    ble_metrics = state.get_ble_movement_metrics()
    loc_x, loc_y = state.get_location()
    is_falling = state.is_falling()  # 由各 reader 根據 ESPectre 原生判斷設定

    # 在模擬模式下，即使沒有硬體也顯示 online
    status = "online"
    if not SIMULATE_MODE:
        status = "online" if state.is_any_online() else "offline"

    payload = {
        "status": status,
        "ai_analysis": {
            "is_falling": is_falling,
            "movement_score": round(score, 2),
            "raw_movement_score": round(ble_metrics["raw_movement_score"], 2),
            "movement_value": round(ble_metrics["movement_value"], 6) if ble_metrics["movement_value"] is not None else None,
            "movement_threshold": round(ble_metrics["movement_threshold"], 6) if ble_metrics["movement_threshold"] is not None else None,
        },
        "data_source": state.get_data_source(),
        "location": {
            "raw_x": round(loc_x, 4) if loc_x is not None else None,
            "raw_y": round(loc_y, 4) if loc_y is not None else None,
        },
        "settings": state.get_settings(),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return json.dumps(payload, ensure_ascii=False)


async def broadcast_loop() -> None:
    """
    以 WS_BROADCAST_INTERVAL 的頻率（預設 10Hz）將最新資料推播給所有已連線的前端。
    每輪只送一則完整狀態封包（BRIDGE_STATUS）；前端 movement metrics 由其 ai_analysis
    欄位推導，不再額外送 movement 子集封包，流量減半。
    即使某個 client 發送失敗也不會影響其他 client。
    同時負責偵測跌倒上升邊緣並觸發 LINE 推播。
    """
    logger.info("[WS] Broadcast loop started (%.1f Hz)", 1.0 / WS_BROADCAST_INTERVAL)
    if SUPABASE_ENABLED:
        logger.info("[Supabase] 雲端推送已啟用 (device_id=%s)", WICARE_DEVICE_ID or "未設定")
    loop = asyncio.get_event_loop()

    # 活動彙整累加器 (每分鐘 upsert 一次) 與心跳計時
    act_scores: list[float] = []
    act_bucket = int(time.time() // 60)
    last_heartbeat = 0.0

    while True:
        score_now = state.get_movement_score()

        # ---- 錄製 movement score 供離線分析 (--record) ---- #
        if RECORD_FILE is not None:
            try:
                RECORD_FILE.write(json.dumps({
                    "ts": datetime.now(timezone.utc).isoformat(),
                    "score": round(score_now, 2),
                }) + "\n")
                RECORD_FILE.flush()
            except Exception as exc:
                logger.warning("[Record] 寫入失敗: %s", exc)

        # ---- 跌倒上升邊緣：LINE 推播 + 雲端事件 ---- #
        line_token = state.check_and_arm_line_notify()
        loc_x, loc_y = state.get_location()
        if line_token:
            loc_str = f"{loc_x:.1f}, {loc_y:.1f} m" if loc_x is not None else "未知"
            msg = (
                f"\n⚠️ Wi-Care 跌倒警報\n"
                f"移動分數：{score_now:.1f}\n"
                f"位置：{loc_str}\n"
                f"時間：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
                f"請立即確認被照護者狀況！"
            )
            # 在背景執行緒發送，不阻塞事件迴圈
            loop.run_in_executor(None, send_line_push, line_token, state.get_line_user_id(), msg)
            logger.info("[LINE] 跌倒警報已排入推播佇列 (score=%.1f)", score_now)
            if SUPABASE_ENABLED:
                loop.run_in_executor(None, supabase_insert_fall_event, score_now, loc_x, loc_y)

        # ---- 久未活動偵測：異常靜止 → LINE 推播 + 雲端事件 ---- #
        inactivity_msg = inactivity_detector.update(score_now)
        if inactivity_msg:
            token = state.get_line_token()
            user_id = state.get_line_user_id()
            if token and user_id and state.get_settings().get("lineNotifyEnabled", False):
                loop.run_in_executor(None, send_line_push, token, user_id, inactivity_msg)
            if SUPABASE_ENABLED:
                loop.run_in_executor(None, supabase_insert_inactivity_event, score_now)
            logger.warning("[Inactivity] 異常靜止警報已觸發")

        # ---- 雲端：每分鐘活動彙整 + 裝置心跳 ---- #
        if SUPABASE_ENABLED:
            act_scores.append(score_now)
            now_min = int(time.time() // 60)
            if now_min != act_bucket and act_scores:
                avg_s = sum(act_scores) / len(act_scores)
                max_s = max(act_scores)
                bucket_iso = datetime.fromtimestamp(act_bucket * 60, timezone.utc).isoformat()
                loop.run_in_executor(None, supabase_upsert_activity,
                                     bucket_iso, classify_activity_level(avg_s),
                                     avg_s, max_s, len(act_scores))
                act_scores = []
                act_bucket = now_min
            if time.time() - last_heartbeat >= 30.0:
                loop.run_in_executor(None, supabase_device_heartbeat, "online")
                last_heartbeat = time.time()
                # 順帶檢查跌倒升級通知（未確認逾時 → 再推播）
                if _pending_falls:
                    loop.run_in_executor(None, process_escalations,
                                         state.get_line_token(), state.get_line_user_id())

        if connected_clients:
            full_payload = build_broadcast_payload()

            # 推送完整狀態封包給所有 clients
            stale_clients = set()
            for client in connected_clients.copy():
                try:
                    await client.send(full_payload)
                except websockets.exceptions.ConnectionClosed:
                    stale_clients.add(client)
                except Exception as exc:
                    logger.warning("[WS] Broadcast failed: %s", exc)
                    stale_clients.add(client)

            # 清除已斷線的 client
            connected_clients.difference_update(stale_clients)

        await asyncio.sleep(WS_BROADCAST_INTERVAL)


async def start_websocket_server() -> None:
    """
    啟動 WebSocket Server 並同時運行廣播迴圈。
    """
    logger.info("[WS] Starting WebSocket Server at ws://%s:%d", WS_HOST, WS_PORT)
    if WS_AUTH_TOKEN:
        logger.info("[WS] 連線驗證已啟用（需 WICARE_WS_TOKEN）")
    else:
        logger.warning("[WS] ⚠️ 未設定 WICARE_WS_TOKEN：任何同網段裝置皆可連線，僅建議純區網開發使用")

    async with serve(ws_handler, WS_HOST, WS_PORT) as server:
        logger.info("[WS] WebSocket Server ready, waiting for connections...")
        # 同時執行廣播迴圈 (會一直跑直到程式結束)
        await broadcast_loop()


# =========================================================================== #
#  自動偵測可用的序列埠 (輔助函式)
# =========================================================================== #

def auto_detect_serial_port() -> Optional[str]:
    """
    自動掃描系統上的序列埠，嘗試找到 ESP32 裝置。
    常見的 USB-Serial 晶片：CP210x, CH340, FTDI
    """
    ports = serial.tools.list_ports.comports()
    if not ports:
        return None

    logger.info("[Serial] Available ports:")
    esp_keywords = ["CP210", "CH340", "FTDI", "USB", "ESP", "Silicon Labs"]
    candidate = None

    for port_info in ports:
        desc = port_info.description or ""
        logger.info("  - %s : %s", port_info.device, desc)
        # 檢查描述中是否包含常見 ESP32 晶片關鍵字
        for keyword in esp_keywords:
            if keyword.lower() in desc.lower():
                candidate = port_info.device
                break

    return candidate


# =========================================================================== #
#  主程式進入點
# =========================================================================== #

def main() -> None:
    """
    啟動所有子系統：
      1. Serial Reader Thread (daemon)  -- 或模擬版
      2. WiFi Location Thread (daemon)  -- 或模擬版
      3. WebSocket Server (async main loop)
    """
    global SERIAL_PORT, WS_PORT, SIMULATE_MODE, BLE_MODE, BLE_ADDRESS, RECORD_FILE

    # ---- 解析命令列參數 ---- #
    args = parse_args()
    SIMULATE_MODE = args.simulate
    BLE_MODE = args.ble
    BLE_ADDRESS = args.ble_address
    if args.ws_port:
        WS_PORT = args.ws_port
    if args.record:
        RECORD_FILE = open(args.record, "a", encoding="utf-8")
        logger.info("[Record] movement score 將寫入 %s", args.record)

    print("=" * 60)
    print("  Wi-Care Smart Long-term Care Monitoring System")
    print("  Core Bridge - Neural Hub")
    print("  Platform: %s" % platform.system())
    if SIMULATE_MODE:
        print("  ** SIMULATION MODE (no hardware required) **")
    elif BLE_MODE:
        print("  ** BLE MODE (ESPectre v2.7.0+, wireless) **")
    print("=" * 60)
    print()

    # ---- 決定 Serial/BLE 來源 ---- #
    if SIMULATE_MODE:
        serial_target = simulated_serial_thread
        logger.info("[Main] Using simulated serial data.")
    elif BLE_MODE:
        if not BLEAK_AVAILABLE:
            logger.error("[Main] BLE mode requires bleak: pip install bleak")
            sys.exit(1)
        serial_target = ble_reader_thread
        logger.info("[Main] Using BLE (ESPectre service UUID: %s)", BLE_SERVICE_UUID)
        if BLE_ADDRESS:
            logger.info("[Main] Preferred BLE address: %s", BLE_ADDRESS)
    else:
        serial_target = serial_reader_thread
        # 自動偵測序列埠
        if args.port:
            SERIAL_PORT = args.port
            logger.info("[Main] Using specified serial port: %s", SERIAL_PORT)
        else:
            detected_port = auto_detect_serial_port()
            if detected_port:
                SERIAL_PORT = detected_port
                logger.info("[Main] Auto-detected ESP32 port: %s", SERIAL_PORT)
            else:
                logger.warning(
                    "[Main] No ESP32 detected, using default port %s "
                    "(will retry on failure)",
                    SERIAL_PORT,
                )

    # ---- 決定 WiFi 來源 ---- #
    if SIMULATE_MODE:
        wifi_target = simulated_wifi_thread
        logger.info("[Main] Using simulated WiFi location data.")
    else:
        wifi_target = wifi_location_thread

    # ---- 啟動 Serial 讀取執行緒 ---- #
    serial_thread = threading.Thread(
        target=serial_target,
        name="SerialReader",
        daemon=True,  # daemon: 主程式結束時自動終止
    )
    serial_thread.start()
    logger.info("[Main] Serial thread started.")

    # ---- 啟動 Wi-Fi 定位執行緒 ---- #
    wifi_thread = threading.Thread(
        target=wifi_target,
        name="WiFiLocation",
        daemon=True,
    )
    wifi_thread.start()
    logger.info("[Main] WiFi location thread started.")

    # ---- 啟動 WebSocket Server (佔用主執行緒的 event loop) ---- #
    try:
        asyncio.run(start_websocket_server())
    except KeyboardInterrupt:
        logger.info("[Main] Ctrl+C received, shutting down...")
        shutdown_event.set()
    except Exception as exc:
        logger.error("[Main] WebSocket Server failed: %s", exc)
        shutdown_event.set()
    finally:
        shutdown_event.set()
        # 等待子執行緒結束 (daemon thread 會在主程式結束時自動終止)
        serial_thread.join(timeout=2.0)
        wifi_thread.join(timeout=2.0)
        if RECORD_FILE is not None:
            try:
                RECORD_FILE.close()
            except Exception:
                pass
        logger.info("[Main] System fully shut down.")


if __name__ == "__main__":
    main()
