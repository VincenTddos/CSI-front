import { useState, useEffect, useRef } from 'react';
import { CSIDataPacket, MovementData } from '../types';

export function useCSIWebSocket(url: string = 'ws://localhost:8765') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<CSIDataPacket | null>(null);
  const [movementMetrics, setMovementMetrics] = useState<MovementData>({ score: 0, isMotion: false });
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // 建立 Worker 而非直接建立 WebSocket
    // 注意: Vite 原生支援 Worker 導入，無需額外配置
    const worker = new Worker(new URL('../workers/csi.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;

    // 監聽 Worker 回傳的訊息
    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'STATUS') {
        setIsConnected(payload.isConnected);
      } else if (type === 'DATA') {
        // payload 可能包含 { raw: CSIDataPacket, metrics: MovementData }
        if (payload.raw) {
          setLastMessage(payload.raw);
        }
        if (payload.metrics) {
          setMovementMetrics(payload.metrics);
        }
      } else if (type === 'ERROR') {
        console.error('CSI Worker Error:', payload);
      }
    };

    // 發送連線指令給 Worker
    worker.postMessage({ type: 'CONNECT', url });

    return () => {
      // 元件卸載時終止 Worker
      worker.terminate();
    };
  }, [url]);

  return { isConnected, lastMessage, movementMetrics };
}
