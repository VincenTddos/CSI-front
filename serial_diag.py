"""
Serial 診斷工具 - 直接印出 COM7 原始輸出
"""
import serial
import sys

PORT = sys.argv[1] if len(sys.argv) > 1 else "COM5"
BAUD = 115200

print(f"Opening {PORT} @ {BAUD} baud...")
print("按 Ctrl+C 停止\n")

try:
    ser = serial.Serial(PORT, BAUD, timeout=2.0, dsrdtr=False, rtscts=False)
    print(f"✅ 已連接 {PORT}\n{'='*60}")
    while True:
        line = ser.readline()
        if line:
            text = line.decode("utf-8", errors="replace").strip()
            if text:
                # 標記重要關鍵字
                tag = ""
                if "mvmt" in text.lower():   tag = "  ← ✅ CSI 資料"
                elif "wifi" in text.lower():  tag = "  ← 📶 WiFi"
                elif "error" in text.lower(): tag = "  ← ❌ 錯誤"
                elif "idle" in text.lower() or "motion" in text.lower(): tag = "  ← 🏃 偵測"
                print(f"{text}{tag}")
except serial.SerialException as e:
    print(f"❌ 無法開啟 {PORT}: {e}")
    print("可能原因：")
    print("  1. 板子未插上")
    print("  2. 被 Arduino IDE 或其他程式佔用")
    print("  3. COM 編號不對（用裝置管理員確認）")
    sys.exit(1)
except KeyboardInterrupt:
    print("\n停止")
