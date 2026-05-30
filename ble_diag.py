import asyncio
from bleak import BleakClient

BLE_ADDR = "E8:F6:0A:85:9D:02"
BLE_SYSINFO_UUID  = "c8c89ffa-c401-461f-9ffc-942fa04adfe3"
BLE_TELEMETRY_UUID = "119d5cac-48da-4bd9-bfc3-169805868258"

sysinfo_msgs = []
telemetry_count = 0

def on_sysinfo(sender, data):
    sysinfo_msgs.append(data.decode("utf-8", errors="ignore").strip())

def on_telemetry(sender, data):
    global telemetry_count
    import struct
    if len(data) >= 8:
        mvmt = struct.unpack_from('<f', data, 0)[0]
        thr  = struct.unpack_from('<f', data, 4)[0]
        print(f"  [TELEMETRY] mvmt={mvmt:.4f}  thr={thr:.4f}  score={mvmt/thr*100:.1f}%")
        telemetry_count += 1

async def main():
    print(f"Connecting to {BLE_ADDR} ...")
    async with BleakClient(BLE_ADDR, timeout=15) as client:
        print("Connected. Subscribing...")
        await client.start_notify(BLE_SYSINFO_UUID, on_sysinfo)
        await client.start_notify(BLE_TELEMETRY_UUID, on_telemetry)
        print("Waiting 15s for data...\n")
        await asyncio.sleep(15)

    print("\n=== SysInfo ===")
    for m in sysinfo_msgs:
        print(" ", m)
    print(f"\n=== Telemetry: {telemetry_count} packets ===")
    if telemetry_count == 0:
        print("  No telemetry received — CSI not running on ESP32")

asyncio.run(main())
