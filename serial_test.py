"""
直接測試 core_bridge 的 Serial regex 是否能抓到 mvmt:
"""
import serial, re, sys

PORT = sys.argv[1] if len(sys.argv) > 1 else "COM5"
BAUD = 115200

score_pattern = re.compile(r"\bmvmt:([\d.]+)", re.IGNORECASE)

print(f"Opening {PORT} @ {BAUD}...")
try:
    ser = serial.Serial(PORT, BAUD, timeout=2.0, dsrdtr=False, rtscts=False)
    print(f"Connected. Reading 30 lines...\n{'='*60}")
    matched = 0
    for i in range(30):
        raw = ser.readline()
        if not raw:
            print(f"[{i:02d}] (timeout - no data)")
            continue
        line = raw.decode("utf-8", errors="ignore").strip()
        if not line:
            continue
        m = score_pattern.search(line)
        if m:
            score = float(m.group(1)) * 100.0
            print(f"[{i:02d}] MATCH! mvmt={m.group(1)} -> score={score:.1f}")
            matched += 1
        else:
            # 只印有內容的行，截斷顯示
            clean = line.encode('ascii', errors='replace').decode('ascii')
            print(f"[{i:02d}] no match: {clean[:80]}")
    ser.close()
    print(f"\n{'='*60}")
    print(f"Result: {matched}/30 lines matched the mvmt: pattern")
except serial.SerialException as e:
    print(f"ERROR: {e}")
