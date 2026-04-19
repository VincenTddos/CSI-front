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

依賴套件：
    pip install websockets pyserial numpy

支援平台：Windows / macOS / Linux
作者：Wi-Care Team
"""

import argparse
import asyncio
import json
import logging
import math
import os
import platform
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
WS_BROADCAST_INTERVAL: float = 1.0       # 推播頻率 (秒)

# -- 跌倒偵測閾值 --
FALL_SCORE_THRESHOLD: float = 80.0        # 移動分數超過此值視為疑似跌倒

# -- 模擬模式旗標 (由命令列參數控制) --
SIMULATE_MODE: bool = False


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

        # -- 來自 Wi-Fi 定位的最新座標 --
        self._location_x: Optional[float] = None
        self._location_y: Optional[float] = None

        # -- 子系統狀態旗標 --
        self._serial_online: bool = False
        self._wifi_online: bool = False

    # ---- Movement Score ---- #
    def set_movement_score(self, score: float) -> None:
        with self._lock:
            self._movement_score = score

    def get_movement_score(self) -> float:
        with self._lock:
            return self._movement_score

    # ---- Location ---- #
    def set_location(self, x: Optional[float], y: Optional[float]) -> None:
        with self._lock:
            self._location_x = x
            self._location_y = y

    def get_location(self) -> tuple:
        with self._lock:
            return (self._location_x, self._location_y)

    # ---- 子系統狀態 ---- #
    def set_serial_online(self, status: bool) -> None:
        with self._lock:
            self._serial_online = status

    def set_wifi_online(self, status: bool) -> None:
        with self._lock:
            self._wifi_online = status

    def is_any_online(self) -> bool:
        with self._lock:
            return self._serial_online or self._wifi_online


# 全域共享狀態實例
state = SharedState()

# 全域停止旗標 (用於優雅關閉所有執行緒)
shutdown_event = threading.Event()


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

    # 用正規表示式擷取分數數值
    score_pattern = re.compile(r"Movement\s+Score:\s*([\d.]+)", re.IGNORECASE)

    while not shutdown_event.is_set():
        ser: Optional[serial.Serial] = None
        try:
            # ---- 嘗試開啟序列埠 ---- #
            ser = serial.Serial(
                port=SERIAL_PORT,
                baudrate=SERIAL_BAUD,
                timeout=1.0,  # read timeout，避免永久阻塞
            )
            state.set_serial_online(True)
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

                # 比對 "Movement Score: XX.X" 格式
                match = score_pattern.search(line)
                if match:
                    try:
                        score = float(match.group(1))
                        state.set_movement_score(score)
                        logger.debug("[Serial] Movement Score = %.2f", score)
                    except ValueError:
                        logger.warning("[Serial] Cannot parse score: %s", match.group(1))
                else:
                    # 非預期格式的行，僅在 DEBUG 等級記錄
                    logger.debug("[Serial] Unexpected data: %s", line[:120])

        except serial.SerialException as exc:
            state.set_serial_online(False)
            logger.warning("[Serial] Port error: %s", exc)

        except Exception as exc:
            state.set_serial_online(False)
            logger.error("[Serial] Unexpected error: %s", exc)

        finally:
            # 確保序列埠被正確關閉
            if ser and ser.is_open:
                try:
                    ser.close()
                except Exception:
                    pass
            state.set_serial_online(False)

        # ---- 斷線後等待再重試 ---- #
        if not shutdown_event.is_set():
            logger.info(
                "[Serial] Reconnecting in %.0f seconds...", SERIAL_RECONNECT_DELAY
            )
            shutdown_event.wait(timeout=SERIAL_RECONNECT_DELAY)

    logger.info("[Serial] Thread stopped.")


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
    state.set_serial_online(True)

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

        # 每隔一段時間模擬一次高分 (疑似跌倒)
        fall_counter += 1
        if fall_counter >= fall_interval:
            score = random.uniform(85.0, 120.0)
            fall_counter = 0
            logger.info("[Serial-SIM] Simulated fall event! Score=%.1f", score)

        state.set_movement_score(round(score, 2))
        logger.debug("[Serial-SIM] Score=%.2f", score)

        tick += 1
        shutdown_event.wait(timeout=1.0)

    state.set_serial_online(False)
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


async def ws_handler(websocket) -> None:
    """
    處理單一 WebSocket 連線的生命週期。
    用戶連線時加入 connected_clients 集合；斷線時自動移除。
    """
    client_addr = websocket.remote_address
    logger.info("[WS] New connection: %s", client_addr)
    connected_clients.add(websocket)

    try:
        # 保持連線存活，等待 client 主動斷線或送訊息
        async for message in websocket:
            # 目前不處理前端送來的訊息，但保留擴充空間
            logger.debug("[WS] Message from %s: %s", client_addr, message[:200])
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
    loc_x, loc_y = state.get_location()
    is_falling = score > FALL_SCORE_THRESHOLD

    # 在模擬模式下，即使沒有硬體也顯示 online
    status = "online"
    if not SIMULATE_MODE:
        status = "online" if state.is_any_online() else "offline"

    payload = {
        "status": status,
        "ai_analysis": {
            "is_falling": is_falling,
            "movement_score": round(score, 2),
        },
        "location": {
            "raw_x": round(loc_x, 4) if loc_x is not None else None,
            "raw_y": round(loc_y, 4) if loc_y is not None else None,
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return json.dumps(payload, ensure_ascii=False)


def build_movement_payload() -> str:
    """
    組裝與前端 csi.worker.ts 'movement' 分支相容的封包格式。
    worker 會在收到 type='movement' 時直接透過 postMessage 轉發給 UI。
    """
    score = state.get_movement_score()
    payload = {
        "type": "movement",
        "score": round(score, 2),
        "isMotion": score > 0.5,  # 簡易判斷：分數 > 0.5 視為有活動
    }
    return json.dumps(payload, ensure_ascii=False)


async def broadcast_loop() -> None:
    """
    每秒 (1Hz) 將最新資料推播給所有已連線的前端。
    即使某個 client 發送失敗也不會影響其他 client。
    """
    logger.info("[WS] Broadcast loop started (%.1f Hz)", 1.0 / WS_BROADCAST_INTERVAL)

    while True:
        if connected_clients:
            # 組裝兩種封包
            full_payload = build_broadcast_payload()
            movement_payload = build_movement_payload()

            # 同時推送給所有 clients
            stale_clients = set()
            for client in connected_clients.copy():
                try:
                    # 先送完整狀態封包
                    await client.send(full_payload)
                    # 再送 movement 封包 (供 worker 的 movement 分支使用)
                    await client.send(movement_payload)
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
    global SERIAL_PORT, WS_PORT, SIMULATE_MODE

    # ---- 解析命令列參數 ---- #
    args = parse_args()
    SIMULATE_MODE = args.simulate
    if args.ws_port:
        WS_PORT = args.ws_port

    print("=" * 60)
    print("  Wi-Care Smart Long-term Care Monitoring System")
    print("  Core Bridge - Neural Hub")
    print("  Platform: %s" % platform.system())
    if SIMULATE_MODE:
        print("  ** SIMULATION MODE (no hardware required) **")
    print("=" * 60)
    print()

    # ---- 決定 Serial 來源 ---- #
    if SIMULATE_MODE:
        # 模擬模式：使用假資料產生器
        serial_target = simulated_serial_thread
        logger.info("[Main] Using simulated serial data.")
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
        logger.info("[Main] System fully shut down.")


if __name__ == "__main__":
    main()
