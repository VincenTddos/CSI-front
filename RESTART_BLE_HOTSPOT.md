# Wi-Care BLE Hotspot Restart Notes

Use this note when the user asks to restart the project with the iPhone hotspot setup.

## Current Working Setup

- iPhone hotspot SSID: `DDOS`
- iPhone hotspot password: `12345678`
- PC Wi-Fi IP on hotspot: `172.20.10.2`
- Frontend URL: `http://localhost:3000`
- WebSocket bridge: `ws://localhost:8765`
- ESPectre BLE address: `E8:F6:0A:85:9D:02`
- BLE firmware seen working: `francescopace.espectre` v`2.7.0`

The ESP32 board should be configured with:

```cpp
WIFI_SSID = "DDOS";
WIFI_PASSWORD = "12345678";
SERVER_IP = "172.20.10.2";
SERVER_PORT = 8765;
```

## Restart Commands

Run from the project root:

```powershell
cd C:\Users\student\Desktop\CSI-front-main
```

Stop old frontend and bridge processes:

```powershell
Get-CimInstance Win32_Process |
  Where-Object {
    ($_.Name -like 'python*' -and $_.CommandLine -like '*core_bridge.py*') -or
    ($_.Name -like 'node*' -and $_.CommandLine -like '*vite*') -or
    ($_.Name -like 'node*' -and $_.CommandLine -like '*npm*run dev*') -or
    ($_.Name -eq 'cmd.exe' -and $_.CommandLine -like '*npm.cmd*run dev*')
  } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
```

Start BLE bridge for the known ESPectre board:

```powershell
Start-Process -FilePath "python" `
  -ArgumentList "core_bridge.py --ble --ble-address E8:F6:0A:85:9D:02" `
  -WorkingDirectory "C:\Users\student\Desktop\CSI-front-main" `
  -WindowStyle Hidden
```

Start the frontend:

```powershell
Start-Process -FilePath "npm.cmd" `
  -ArgumentList "run dev" `
  -WorkingDirectory "C:\Users\student\Desktop\CSI-front-main" `
  -WindowStyle Hidden
```

## Verify

Check that the PC is still on the iPhone hotspot and has the expected IP:

```powershell
Get-NetIPConfiguration |
  Where-Object { $_.IPv4Address -and ($_.NetAdapter.Status -eq 'Up') } |
  Select-Object InterfaceAlias,@{Name='IPv4';Expression={$_.IPv4Address.IPAddress}},@{Name='Gateway';Expression={$_.IPv4DefaultGateway.NextHop}}
```

Expected:

```txt
Wi-Fi  172.20.10.2  172.20.10.1
```

Check listening ports:

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -eq 8765 -or $_.LocalPort -eq 3000 } |
  Select-Object LocalAddress,LocalPort,OwningProcess
```

Expected:

```txt
0.0.0.0:8765
0.0.0.0:3000
```

Check live bridge data:

```powershell
@'
import asyncio, json
import websockets

async def main():
    async with websockets.connect('ws://localhost:8765', open_timeout=8) as ws:
        for i in range(10):
            data = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            ai = data.get('ai_analysis') or {}
            print(i, data.get('data_source'), data.get('status'), ai.get('movement_value'), ai.get('movement_threshold'), ai.get('movement_score'))
            await asyncio.sleep(1)

asyncio.run(main())
'@ | python -
```

Working output should include:

```txt
hardware_ble online <movement_value> 0.05 <movement_score>
```

Example from the successful run:

```txt
hardware_ble online 0.013661 0.05 6.81
```

## Troubleshooting

If there is no data:

- Make sure the PC is connected to the iPhone hotspot `DDOS`.
- Make sure the PC IP is still `172.20.10.2`. If it changed, update the ESP32 `SERVER_IP`.
- Restart the ESP32 board and wait 10 to 20 seconds.
- Keep some 2.4 GHz Wi-Fi traffic active, such as a phone using the hotspot.
- The good BLE device is `E8:F6:0A:85:9D:02`.
- If `best_pxx=0.0000`, the board is not seeing usable CSI/Wi-Fi activity yet.

