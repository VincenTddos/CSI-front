"""
Quick WebSocket peek (5 seconds)
"""
import asyncio, json, sys
import websockets

async def main():
    url = "ws://localhost:8765"
    print(f"Connecting {url}...\n")
    try:
        async with websockets.connect(url, ping_interval=None) as ws:
            print("Connected. Waiting 5s for data...\n")
            count = 0
            for _ in range(20):
                try:
                    msg = await asyncio.wait_for(ws.recv(), timeout=0.5)
                    data = json.loads(msg)
                    if count < 3:   # 只印前3個完整封包
                        print(json.dumps(data, indent=2, ensure_ascii=False))
                        print("---")
                    count += 1
                except asyncio.TimeoutError:
                    pass
    except Exception as e:
        print(f"ERROR: {e}")

asyncio.run(main())
