import { useState, useEffect, useRef } from 'react';

// 定義 CSI 數據結構 (根據 espectre/wigay 的輸出調整)
export interface CSIDataPacket {
  check: string;      // 例如 "CSI"
  mac: string;       // 設備 MAC
  len: number;       // 數據長度
  first: number;     // 第一個 byte
  data: number[];    // CSI 振幅數據 (通常 64 或 128 個數值)
  path: string;      // 路由路徑
}

export interface MovementData {
  score: number;     // 移動分數 (Movement Score)
  isMotion: boolean; // 是否偵測到活動
}

export function useCSIWebSocket(url: string = 'ws://localhost:8765') {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<CSIDataPacket | null>(null);
  const [movementMetrics, setMovementMetrics] = useState<MovementData>({ score: 0, isMotion: false });
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // 建立連接
    const connect = () => {
      try {
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
          console.log('🔗 CSI WebSocket Connected');
          setIsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // 判斷數據類型：是原始 CSI 還是 移動分數？
            // 假設 wigay 傳送的格式
            if (data.type === 'csi' && data.payload) {
              setLastMessage(data.payload);
            } else if (data.type === 'movement') {
              setMovementMetrics({
                score: data.score || 0,
                isMotion: data.hasMotion || false
              });
            }
          } catch (e) {
            console.error('WebSocket 解析錯誤:', e);
          }
        };

        ws.onclose = () => {
          console.log('Reconnecting WebSocket...');
          setIsConnected(false);
          setTimeout(connect, 3000); // 斷線重連
        };

        socketRef.current = ws;
      } catch (error) {
        console.error('Connection failed:', error);
      }
    };

    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [url]);

  return { isConnected, lastMessage, movementMetrics };
}
