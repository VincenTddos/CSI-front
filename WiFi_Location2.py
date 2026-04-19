#!/usr/bin/env python3
import re
import time
import subprocess
import numpy as np
import socket
import struct
import os
import platform
import sys
from typing import Tuple, Optional

# ========= 掃描模式選擇 =========
# "ap": 掃描基地台 (Access Points) - 使用 SSID
# "devices": 掃描同網段內的其他設備
SCAN_MODE = "ap"  # 改為 "ap" 或 "devices"

# ========= 你要改這裡：已知 AP 的 SSID 與座標(公尺) =========
# 注意：SSID 比對是大小寫敏感的
KNOWN_APS = {
    # "SSID": (x, y)
    "MyWiFi-2.4G": (0.0, 0.0),
    "MyWiFi-5G": (6.0, 0.0),
    "Office-AP": (3.0, 5.0),
    "Guest-Network": (3.0, 5.0),
    # 可加更多 AP，越多通常越穩
}

KNOWN_DEVICES = KNOWN_APS.copy()

# 自動偵測作業系統和網卡
IS_MACOS = platform.system() == "Darwin"
IS_LINUX = platform.system() == "Linux"
IS_WINDOWS = platform.system() == "Windows"

# 自動偵測網卡名稱
def detect_wifi_interface() -> Optional[str]:
    """自動偵測 Wi-Fi 網卡名稱"""
    if IS_MACOS:
        # macOS: 通常使用 en0 或 en1
        try:
            result = subprocess.run(
                ["networksetup", "-listallhardwareports"],
                capture_output=True, text=True, timeout=5
            )
            for line in result.stdout.splitlines():
                if "Wi-Fi" in line or "AirPort" in line:
                    # 下一行應該是 "Device: enX"
                    idx = result.stdout.splitlines().index(line)
                    if idx + 1 < len(result.stdout.splitlines()):
                        next_line = result.stdout.splitlines()[idx + 1]
                        match = re.search(r"Device:\s*(\w+)", next_line)
                        if match:
                            return match.group(1)
        except:
            pass
        # 預設嘗試 en0
        return "en0"
    elif IS_LINUX:
        # Linux: 通常使用 wlan0, wlp2s0 等
        try:
            result = subprocess.run(
                ["iw", "dev"],
                capture_output=True, text=True, timeout=5, stderr=subprocess.DEVNULL
            )
            # 尋找 "Interface wlan0" 或類似格式
            match = re.search(r"Interface\s+(\w+)", result.stdout)
            if match:
                return match.group(1)
        except:
            pass
        return "wlan0"
    elif IS_WINDOWS:
        # Windows: 使用 netsh 偵測 Wi-Fi 介面名稱
        try:
            result = subprocess.run(
                ["netsh", "wlan", "show", "interfaces"],
                capture_output=True, text=True, timeout=5,
                encoding="cp950", errors="ignore"
            )
            # 尋找 "名稱" 或 "Name" 欄位
            for line in result.stdout.splitlines():
                # 中文 Windows: "    名稱                   : Wi-Fi"
                # 英文 Windows: "    Name                   : Wi-Fi"
                match = re.search(r"(?:Name|\u540d\u7a31)\s*:\s*(.+)", line, re.IGNORECASE)
                if match:
                    return match.group(1).strip()
        except:
            pass
        return "Wi-Fi"
    return None

IFACE = detect_wifi_interface() or ("en0" if IS_MACOS else ("Wi-Fi" if IS_WINDOWS else "wlan0"))

# ========= RSSI -> 距離 的模型參數（需要校正會更準） =========
# A: 1 公尺處的 RSSI(dBm)，n: 環境衰減係數(室內常見 2.0~4.0)
A_AT_1M = -45.0
PATH_LOSS_N = 2.7

# 每次定位要做幾次掃描取平均（越多越慢但越穩）
SCAN_ROUNDS = 6
SCAN_INTERVAL_SEC = 0.7

# 只使用 RSSI 最強的前 N 個 AP 做定位（避免遠端 AP 拉歪解）
# 設為 None 表示使用所有可用的 AP
MAX_ANCHORS = None  # 例如設為 5 表示只用前 5 個最強的 AP

# 調試模式：顯示原始掃描輸出
# 設為 True 可查看掃描過程的詳細資訊
DEBUG = False

def scan_rssi_ap_linux(iw_iface: str) -> Tuple[dict, list]:
    """
    Linux: 使用 iw 掃描基地台 (AP) 的 RSSI（使用 SSID）
    回傳 (rssi_dict, all_ssids):
        - rssi_dict: {ssid: rssi_dbm(float)}，只包含已知的 SSID
        - all_ssids: 所有找到的 SSID 列表（用於顯示）
    """
    cmd = ["sudo", "iw", "dev", iw_iface, "scan"]
    out = subprocess.check_output(cmd, text=True, errors="ignore")

    # 解析區塊：每個 AP 一段
    # BSS xx:xx:xx:xx:xx:xx(...)
    #     SSID: MyWiFiNetwork
    #     signal: -54.00 dBm
    bssid_pat = re.compile(r"^BSS\s+([0-9a-f:]{17})", re.IGNORECASE)
    ssid_pat = re.compile(r"^\s*SSID:\s*(.+)", re.IGNORECASE)
    sig_pat = re.compile(r"^\s*signal:\s*(-?\d+(?:\.\d+)?)\s*dBm", re.IGNORECASE)

    rssi = {}
    all_ssids = []
    cur_bssid = None
    cur_ssid = None
    cur_rssi = None
    
    for line in out.splitlines():
        # 檢查是否為新的 BSS 區塊
        m = bssid_pat.search(line)
        if m:
            # 如果前一個 AP 有完整的資訊，記錄它
            if cur_ssid is not None and cur_rssi is not None:
                if cur_ssid not in all_ssids:
                    all_ssids.append(cur_ssid)
                # 只記錄已知的 SSID
                if cur_ssid in KNOWN_DEVICES:
                    # 如果同一個 SSID 出現多次（不同 BSSID），取最強的 RSSI
                    if cur_ssid not in rssi or cur_rssi > rssi[cur_ssid]:
                        rssi[cur_ssid] = cur_rssi
            cur_bssid = m.group(1).lower()
            cur_ssid = None
            cur_rssi = None
            continue
        
        # 檢查 SSID
        if cur_bssid:
            m2 = ssid_pat.search(line)
            if m2:
                cur_ssid = m2.group(1).strip()
                continue
        
        # 檢查 signal
        if cur_bssid:
            m3 = sig_pat.search(line)
            if m3:
                cur_rssi = float(m3.group(1))
                continue
    
    # 處理最後一個 AP
    if cur_ssid is not None and cur_rssi is not None:
        if cur_ssid not in all_ssids:
            all_ssids.append(cur_ssid)
        if cur_ssid in KNOWN_DEVICES:
            if cur_ssid not in rssi or cur_rssi > rssi[cur_ssid]:
                rssi[cur_ssid] = cur_rssi
    
    return rssi, all_ssids

def scan_rssi_ap_macos() -> Tuple[dict, list]:
    """
    macOS: 使用 CoreWLAN framework 掃描基地台 (AP) 的 RSSI（使用 SSID）
    回傳 (rssi_dict, all_ssids):
        - rssi_dict: {ssid: rssi_dbm(float)}，只包含已知的 SSID
        - all_ssids: 所有找到的 SSID 列表（用於顯示）
    """
    # 嘗試使用 pyobjc 訪問 CoreWLAN
    try:
        import objc
        from CoreWLAN import CWInterface, CWWiFiClient
        
        wifi_client = CWWiFiClient.sharedWiFiClient()
        interface = wifi_client.interface()
        
        if interface is None:
            raise RuntimeError("無法取得 Wi-Fi 介面，請確認 Wi-Fi 已開啟。")
        
        # 執行掃描
        error = None
        scan_results = interface.scanForNetworksWithName_error_(None, objc.nil)
        
        if scan_results is None:
            raise RuntimeError("Wi-Fi 掃描失敗，請確認 Wi-Fi 已開啟且有權限。")
        
        rssi = {}
        all_ssids = []
        
        for network in scan_results:
            ssid = network.ssid()
            rssi_val = network.rssiValue()
            
            if DEBUG:
                print(f"DEBUG: 找到網路 - SSID: '{ssid}', RSSI: {rssi_val}")
            
            if ssid:  # 跳過空 SSID（隱藏網路）
                if ssid not in all_ssids:
                    all_ssids.append(ssid)
                # 只記錄已知的 SSID
                if ssid in KNOWN_DEVICES:
                    # 如果同一個 SSID 出現多次，取最強的 RSSI
                    if ssid not in rssi or rssi_val > rssi[ssid]:
                        rssi[ssid] = float(rssi_val)
        
        return rssi, all_ssids
        
    except ImportError:
        # 如果 pyobjc 不可用，嘗試使用 airport（可能已棄用但可能仍可用）
        if DEBUG:
            print("⚠️  pyobjc 不可用，嘗試使用 airport 工具（可能已棄用）")
        
        airport_path = "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport"
        
        if not os.path.exists(airport_path):
            raise RuntimeError(
                "無法掃描 Wi-Fi：\n"
                "1. 請安裝 pyobjc: pip install pyobjc-framework-CoreWLAN\n"
                "2. 或確認 airport 工具存在"
            )
        
        # 執行掃描（macOS 不需要 sudo）
        cmd = [airport_path, "-s"]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, errors="ignore", timeout=10)
            out = result.stdout
            if result.returncode != 0:
                if DEBUG:
                    print(f"⚠️  airport 返回非零退出碼: {result.returncode}")
                    print(f"stderr: {result.stderr}")
                # airport 可能已棄用，但可能仍會輸出結果
        except subprocess.CalledProcessError as e:
            raise RuntimeError(
                f"執行 airport 掃描失敗：{e}\n"
                "建議安裝 pyobjc: pip install pyobjc-framework-CoreWLAN"
            )
        except FileNotFoundError:
            raise RuntimeError(
                f"無法執行 airport 工具：{airport_path}\n"
                "建議安裝 pyobjc: pip install pyobjc-framework-CoreWLAN"
            )
        
        if DEBUG:
            print("\n=== DEBUG: airport 原始輸出 ===")
            print(out if out else "(空)")
            print("=== DEBUG: 結束 ===\n")
        
        # airport 輸出格式：
        # SSID BSSID             RSSI CHANNEL HT CC SECURITY (auth/unicast/group)
        # MyWiFi aa:bb:cc:dd:ee:ff -45  6       Y  -- WPA2(PSK/AES/AES)
        
        if not out or not out.strip():
            if DEBUG:
                print("⚠️  airport 輸出為空（可能已棄用）")
            raise RuntimeError(
                "airport 工具無法取得掃描結果（可能已棄用）。\n"
                "請安裝 pyobjc: pip install pyobjc-framework-CoreWLAN"
            )
        
        rssi = {}
        all_ssids = []
        header_found = False
        
        for line in out.splitlines():
            line = line.rstrip()
            
            if "SSID" in line and "BSSID" in line:
                header_found = True
                if DEBUG:
                    print(f"DEBUG: 找到標題行: {line}")
                continue
            
            if not line.strip():
                continue
            
            if DEBUG:
                print(f"DEBUG: 處理行: {line}")
            
            bssid_match = re.search(r"([0-9a-f]{2}(:[0-9a-f]{2}){5})", line, re.IGNORECASE)
            if not bssid_match:
                if DEBUG:
                    print(f"  DEBUG: 未找到 BSSID")
                continue
            
            bssid_pos = bssid_match.start()
            ssid = line[:bssid_pos].strip()
            
            after_bssid = line[bssid_match.end():]
            rssi_match = re.search(r"(-?\d+(?:\.\d+)?)", after_bssid)
            if not rssi_match:
                if DEBUG:
                    print(f"  DEBUG: 未找到 RSSI (after_bssid: {after_bssid[:50]})")
                continue
            
            try:
                rssi_val = float(rssi_match.group(1))
            except ValueError:
                if DEBUG:
                    print(f"  DEBUG: RSSI 轉換失敗: {rssi_match.group(1)}")
                continue
            
            if DEBUG:
                print(f"  DEBUG: 解析成功 - SSID: '{ssid}', RSSI: {rssi_val}")
            
            if ssid:
                if ssid not in all_ssids:
                    all_ssids.append(ssid)
                if ssid in KNOWN_DEVICES:
                    if ssid not in rssi or rssi_val > rssi[ssid]:
                        rssi[ssid] = rssi_val
        
        return rssi, all_ssids

def scan_rssi_ap_windows() -> Tuple[dict, list]:
    """
    Windows: 使用 netsh wlan show networks 掃描基地台 (AP) 的 RSSI
    回傳 (rssi_dict, all_ssids):
        - rssi_dict: {ssid: rssi_dbm(float)}，只包含已知的 SSID
        - all_ssids: 所有找到的 SSID 列表（用於顯示）

    netsh 輸出範例 (中文 Windows):
        SSID 1 : MyWiFi-2.4G
            網路類型            : 基礎結構
            驗證                : WPA2-Personal
            加密                : CCMP
            BSSID 1             : aa:bb:cc:dd:ee:ff
                 訊號         : 85%
                 ...

    netsh 輸出範例 (英文 Windows):
        SSID 1 : MyWiFi-2.4G
            Network type        : Infrastructure
            Authentication      : WPA2-Personal
            Encryption          : CCMP
            BSSID 1             : aa:bb:cc:dd:ee:ff
                 Signal         : 85%
                 ...
    """
    # 嘗試多種編碼: cp950 (繁體中文), cp936 (簡體中文), utf-8, 預設
    out = ""
    for encoding in ["cp950", "cp936", "utf-8", None]:
        try:
            kwargs = {"capture_output": True, "timeout": 10, "errors": "ignore"}
            if encoding:
                kwargs["encoding"] = encoding
            else:
                kwargs["text"] = True
            result = subprocess.run(
                ["netsh", "wlan", "show", "networks", "mode=bssid"],
                **kwargs
            )
            out = result.stdout if isinstance(result.stdout, str) else result.stdout.decode("utf-8", errors="ignore")
            if out.strip():
                break
        except Exception:
            continue

    if not out or not out.strip():
        raise RuntimeError("netsh wlan show networks 沒有輸出，請確認 Wi-Fi 已開啟。")

    if DEBUG:
        print("\n=== DEBUG: netsh 原始輸出 ===")
        print(out[:2000] if out else "(空)")
        print("=== DEBUG: 結束 ===\n")

    rssi = {}
    all_ssids = []
    cur_ssid = None

    for line in out.splitlines():
        line_stripped = line.strip()

        # 匹配 SSID 行: "SSID 1 : MyWiFi-2.4G" 或 "SSID 1 : "
        ssid_match = re.match(r"^SSID\s+\d+\s*:\s*(.*)", line_stripped, re.IGNORECASE)
        if ssid_match:
            ssid_name = ssid_match.group(1).strip()
            if ssid_name:  # 跳過隱藏網路 (SSID 為空)
                cur_ssid = ssid_name
                if cur_ssid not in all_ssids:
                    all_ssids.append(cur_ssid)
            else:
                cur_ssid = None
            continue

        # 匹配訊號強度行:
        # 中文: "訊號         : 85%" 或 "信号         : 85%"
        # 英文: "Signal         : 85%"
        signal_match = re.match(
            r"^(?:Signal|\u8a0a\u865f|\u4fe1\u53f7)\s*:\s*(\d+)%",
            line_stripped, re.IGNORECASE
        )
        if signal_match and cur_ssid:
            signal_pct = int(signal_match.group(1))
            # 將 Windows 的訊號百分比轉換為近似 dBm
            # 公式: dBm = (signal_pct / 2) - 100
            # 例如: 100% -> -50 dBm, 50% -> -75 dBm, 0% -> -100 dBm
            rssi_dbm = (signal_pct / 2.0) - 100.0

            if DEBUG:
                print(f"DEBUG: SSID='{cur_ssid}', Signal={signal_pct}%, RSSI~{rssi_dbm:.1f} dBm")

            # 只記錄已知的 SSID
            if cur_ssid in KNOWN_DEVICES:
                # 同一個 SSID 可能有多個 BSSID，取最強的 RSSI
                if cur_ssid not in rssi or rssi_dbm > rssi[cur_ssid]:
                    rssi[cur_ssid] = rssi_dbm
            # 不重置 cur_ssid, 因為一個 SSID 可能有多個 BSSID
            continue

    return rssi, all_ssids


def scan_rssi_ap(iface: str) -> Tuple[dict, list]:
    """
    掃描基地台 (AP) 的 RSSI（使用 SSID），自動選擇平台適用的方法
    """
    if IS_MACOS:
        return scan_rssi_ap_macos()
    elif IS_LINUX:
        return scan_rssi_ap_linux(iface)
    elif IS_WINDOWS:
        return scan_rssi_ap_windows()
    else:
        raise RuntimeError(f"不支援的作業系統: {platform.system()}")

def scan_rssi_devices(iw_iface: str, duration_sec: float = 2.0) -> dict:
    """
    掃描同網段內其他設備的 RSSI（使用監聽模式）
    回傳 dict: {mac(lowercase): rssi_dbm(float)}
    
    注意：需要將網卡切換到監聽模式，這會中斷現有的 WiFi 連接
    """
    # 方法 1: 使用 iw dev station dump（只能看到已連接的站點）
    # 方法 2: 使用監聽模式 + tcpdump（可以捕獲所有封包）
    
    # 先嘗試方法 1（較簡單，不需要切換模式）
    try:
        cmd = ["sudo", "iw", "dev", iw_iface, "station", "dump"]
        out = subprocess.check_output(cmd, text=True, errors="ignore", timeout=5)
        
        # 解析格式：Station xx:xx:xx:xx:xx:xx ... signal: -54 dBm
        station_pat = re.compile(r"^Station\s+([0-9a-f:]{17})", re.IGNORECASE)
        sig_pat = re.compile(r"signal:\s*(-?\d+(?:\.\d+)?)\s*dBm?", re.IGNORECASE)
        
        rssi = {}
        cur = None
        for line in out.splitlines():
            m = station_pat.search(line)
            if m:
                cur = m.group(1).lower()
                continue
            if cur:
                m2 = sig_pat.search(line)
                if m2:
                    rssi[cur] = float(m2.group(1))
                    cur = None
        
        if rssi:
            return rssi
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        pass
    
    # 方法 2: 使用 tcpdump 在監聽模式下捕獲封包
    # 注意：這需要先切換到監聽模式，會中斷連接
    print("⚠️  警告：使用監聽模式會中斷 WiFi 連接")
    print("   正在切換到監聽模式...")
    
    # 保存原始模式
    try:
        # 獲取當前模式
        cmd = ["iw", "dev", iw_iface, "info"]
        info = subprocess.check_output(cmd, text=True, errors="ignore")
        original_type = "managed"  # 預設
        if "type managed" in info:
            original_type = "managed"
        elif "type monitor" in info:
            original_type = "monitor"
    except:
        original_type = "managed"
    
    try:
        # 切換到監聽模式
        subprocess.run(["sudo", "iw", "dev", iw_iface, "set", "type", "monitor"], 
                      check=True, timeout=5)
        subprocess.run(["sudo", "ip", "link", "set", iw_iface, "up"], 
                      check=True, timeout=5)
        
        # 使用 tcpdump 捕獲封包
        cmd = ["sudo", "timeout", str(int(duration_sec)), "tcpdump", 
               "-i", iw_iface, "-n", "-e", "-q", "-c", "100"]
        out = subprocess.check_output(cmd, text=True, errors="ignore", stderr=subprocess.DEVNULL)
        
        # 解析 tcpdump 輸出：格式類似 "xx:xx:xx:xx:xx:xx > xx:xx:xx:xx:xx:xx, ... -XX dBm signal"
        rssi = {}
        mac_pat = re.compile(r"([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})", re.IGNORECASE)
        sig_pat = re.compile(r"(-?\d+)\s*dBm?\s+signal", re.IGNORECASE)
        
        for line in out.splitlines():
            # 提取 MAC 地址
            macs = mac_pat.findall(line)
            sig_match = sig_pat.search(line)
            
            if macs and sig_match:
                for mac in macs:
                    mac_lower = mac.lower()
                    # 只記錄已知的設備
                    if mac_lower in KNOWN_DEVICES:
                        rssi_val = float(sig_match.group(1))
                        # 如果已經有值，取較強的（較大的，因為是負數）
                        if mac_lower not in rssi or rssi_val > rssi[mac_lower]:
                            rssi[mac_lower] = rssi_val
        
    finally:
        # 恢復原始模式
        try:
            subprocess.run(["sudo", "iw", "dev", iw_iface, "set", "type", original_type], 
                          timeout=5, stderr=subprocess.DEVNULL)
            if original_type == "managed":
                subprocess.run(["sudo", "systemctl", "restart", "NetworkManager"], 
                              timeout=5, stderr=subprocess.DEVNULL)
        except:
            pass
    
    return rssi

def scan_rssi(iface: str) -> Tuple[dict, list]:
    """
    根據 SCAN_MODE 選擇掃描方式
    回傳 (rssi_dict, all_ssids):
        - rssi_dict: {identifier: rssi_dbm(float)}
        - all_ssids: 所有找到的 SSID 列表（僅在 SCAN_MODE="ap" 時有效）
    """
    if SCAN_MODE == "devices":
        if IS_MACOS:
            raise RuntimeError("macOS 不支援 devices 掃描模式，請使用 SCAN_MODE='ap'")
        if IS_WINDOWS:
            raise RuntimeError("Windows 不支援 devices 掃描模式，請使用 SCAN_MODE='ap'")
        rssi = scan_rssi_devices(iface, duration_sec=SCAN_INTERVAL_SEC * 2)
        return rssi, []
    else:
        return scan_rssi_ap(iface)

def rssi_to_distance_m(rssi_dbm: float, A_at_1m: float, n: float) -> float:
    """
    對數路徑損耗模型：d = 10^((A - RSSI)/(10n))
    """
    return 10 ** ((A_at_1m - rssi_dbm) / (10.0 * n))

def multilateration_ls(anchors_xy: np.ndarray, dists: np.ndarray) -> np.ndarray:
    """
    2D 多邊定位（最小平方線性化解）
    anchors_xy: shape (m,2), dists: shape (m,)
    回傳 estimated (x,y)
    """
    if anchors_xy.shape[0] < 3:
        raise ValueError("Need at least 3 anchors for 2D position.")

    # 以第 1 個 anchor 當基準做線性化
    x1, y1 = anchors_xy[0]
    d1 = dists[0]

    A = []
    b = []
    for i in range(1, anchors_xy.shape[0]):
        xi, yi = anchors_xy[i]
        di = dists[i]
        A.append([2*(xi - x1), 2*(yi - y1)])
        b.append((xi**2 + yi**2 - x1**2 - y1**2) - (di**2 - d1**2))

    A = np.array(A, dtype=float)
    b = np.array(b, dtype=float)

    # 最小平方
    sol, *_ = np.linalg.lstsq(A, b, rcond=None)
    return sol  # (x,y)

def main():
    print(f"=== Tri-location System ===")
    print(f"Platform: {platform.system()}")
    print(f"Wi-Fi interface: {IFACE}")
    print(f"Scan mode: {SCAN_MODE}")
    if DEBUG:
        print("⚠️  DEBUG mode enabled")
    if SCAN_MODE == "devices":
        print("Scanning for devices on the same network...")
        print("Note: This will scan for devices connected to the same AP")
    else:
        print("Scanning for Access Points (APs) by SSID...")
        print("Note: This scans for all nearby Wi-Fi access points' SSIDs")
    print(f"Known APs: {len(KNOWN_DEVICES)}")
    if MAX_ANCHORS is not None:
        print(f"Max anchors to use: {MAX_ANCHORS}")
    print()
    
    # 收集多次掃描的 RSSI，對每個設備取平均
    samples = {ssid: [] for ssid in KNOWN_DEVICES.keys()}
    all_found_ssids = set()  # 收集所有找到的 SSID

    for round_num in range(SCAN_ROUNDS):
        try:
            rssi_map, found_ssids = scan_rssi(IFACE)
            all_found_ssids.update(found_ssids)
            
            # 第一次掃描時顯示所有找到的 SSID
            if round_num == 0 and SCAN_MODE == "ap":
                print(f"=== All SSIDs found (round {round_num + 1}) ===")
                if found_ssids:
                    for ssid in sorted(found_ssids):
                        marker = "✓" if ssid in KNOWN_DEVICES else " "
                        print(f"  {marker} {ssid}")
                else:
                    print("  (no SSIDs found)")
                print()
        except subprocess.CalledProcessError as e:
            if IS_MACOS:
                print(f"Scan failed. Error: {e}")
                print("提示：macOS 通常不需要 sudo，請確認 airport 工具可用")
            else:
                print("Scan failed. Make sure you run as sudo and the Wi-Fi interface is up.")
            raise e
        except RuntimeError as e:
            print(f"Error: {e}")
            sys.exit(1)

        for ssid in samples:
            if ssid in rssi_map:
                samples[ssid].append(rssi_map[ssid])

        time.sleep(SCAN_INTERVAL_SEC)

    # 顯示掃描統計資訊
    print("\n=== Scan Statistics ===")
    for ssid, arr in samples.items():
        status = "✓" if len(arr) >= 2 else "✗"
        print(f"{status} {ssid}: detected {len(arr)}/{SCAN_ROUNDS} times", end="")
        if len(arr) > 0:
            print(f"  (mean RSSI={np.mean(arr):.1f} dBm)")
        else:
            print("  (not detected)")
    
    # 顯示所有找到的 SSID（如果還沒顯示過）
    if SCAN_MODE == "ap" and all_found_ssids:
        print(f"\n=== All SSIDs found (all rounds, total: {len(all_found_ssids)}) ===")
        for ssid in sorted(all_found_ssids):
            marker = "✓" if ssid in KNOWN_DEVICES else " "
            print(f"  {marker} {ssid}")
    
    # 只使用有足夠樣本的 AP（至少 2 次掃描到）
    usable = []
    for ssid, arr in samples.items():
        if len(arr) >= 2:
            usable.append((ssid, float(np.mean(arr))))
    usable.sort(key=lambda x: x[1], reverse=True)  # RSSI 越大(越接近 0)通常越近
    
    # 只取 RSSI 最強的前 N 個 AP（避免遠端 AP 拉歪解）
    if MAX_ANCHORS is not None and len(usable) > MAX_ANCHORS:
        usable = usable[:MAX_ANCHORS]
        print(f"\n⚠️  只使用 RSSI 最強的前 {MAX_ANCHORS} 個 AP")

    device_type = "devices" if SCAN_MODE == "devices" else "APs"
    if len(usable) < 3:
        print(f"\n❌ Not enough {device_type} observed (need >= 3, got {len(usable)}).")
        if len(usable) > 0:
            print(f"Observed {device_type}:")
            for ssid, mean_rssi in usable:
                print(f"  {ssid}  mean RSSI={mean_rssi:.1f} dBm")
        else:
            print(f"No known {device_type} were detected in at least 2 scans.")
        print("\n💡 Troubleshooting tips:")
        if SCAN_MODE == "devices":
            print("  1. Make sure other devices are connected to the same WiFi network")
            print("  2. Try running: sudo iw dev wlan0 station dump")
            print("  3. Verify MAC addresses match (case-insensitive)")
            print("  4. Note: Monitor mode will disconnect WiFi temporarily")
        else:
            print("  1. Check if you're within range of the known APs")
            print("  2. Verify SSID matches exactly (case-sensitive)")
            print("  3. Check the SSID list above to see what was found")
            print("  4. Try running: sudo iw dev wlan0 scan | grep -E 'SSID|signal'")
        print("  5. Increase SCAN_ROUNDS or reduce the threshold (currently requires 2 detections)")
        return

    anchors = []
    dists = []
    print("\n=== Used anchors ===")
    for ssid, mean_rssi in usable:
        x, y = KNOWN_DEVICES[ssid]
        d = rssi_to_distance_m(mean_rssi, A_AT_1M, PATH_LOSS_N)
        anchors.append((x, y))
        dists.append(d)
        print(f"{ssid}  pos=({x:.2f},{y:.2f})  RSSI={mean_rssi:.1f} dBm  dist~{d:.2f} m")

    anchors = np.array(anchors, dtype=float)
    dists = np.array(dists, dtype=float)

    est = multilateration_ls(anchors, dists)
    print("\n=== Estimated position ===")
    print(f"x={est[0]:.2f} m, y={est[1]:.2f} m")

if __name__ == "__main__":
    main()
