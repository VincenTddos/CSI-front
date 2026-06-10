import { useState, useEffect, useRef, useCallback } from 'react';
import { CSIDataPacket, MovementData, CoreBridgePacket, LocationData, SystemSettingsState, SettingsAckPacket } from '../types';

function getDefaultWebSocketUrl() {
  const host = window.location.hostname || 'localhost';
  return `ws://${host}:8765`;
}

// 與後端 WICARE_WS_TOKEN 對應的共享密鑰（區網部署時設定，未設定則不送驗證）
const WS_TOKEN: string = (import.meta as any).env?.VITE_WS_TOKEN ?? '';

export function useCSIWebSocket(url: string = getDefaultWebSocketUrl()) {
  const [isConnected, setIsConnected] = useState(false);
  const [dataStale, setDataStale] = useState(false);
  const [lastMessage, setLastMessage] = useState<CSIDataPacket | null>(null);
  const [movementMetrics, setMovementMetrics] = useState<MovementData>({ score: 0, isMotion: false });
  const [bridgeStatus, setBridgeStatus] = useState<CoreBridgePacket | null>(null);
  const [locationData, setLocationData] = useState<LocationData>({ x: null, y: null, timestamp: '' });
  const [lastSettingsAck, setLastSettingsAck] = useState<SettingsAckPacket | null>(null);
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
        // 後端 10Hz 推播，worker 偵測到 >3 秒無封包會回報 stale
        setDataStale(Boolean(payload.stale));

      } else if (type === 'DATA') {
        // payload 可能包含 { raw: CSIDataPacket, metrics: MovementData }
        if (payload.raw) {
          setLastMessage(payload.raw);
        }
        if (payload.metrics) {
          setMovementMetrics(payload.metrics);
        }

      } else if (type === 'BRIDGE_STATUS') {
        // core_bridge.py 的完整狀態封包 (含三角定位與 AI 分析)
        const packet = payload as CoreBridgePacket;
        setBridgeStatus(packet);
        setDataStale(false); // 收到新封包即視為資料新鮮

        // 更新 movement metrics
        if (packet.ai_analysis) {
          setMovementMetrics({
            score: packet.ai_analysis.movement_score,
            isMotion: packet.ai_analysis.movement_score > 2,
          });
        }

        // 更新定位座標
        if (packet.location) {
          setLocationData({
            x: packet.location.raw_x,
            y: packet.location.raw_y,
            timestamp: packet.timestamp,
          });
        }

      } else if (type === 'ERROR') {
        console.error('CSI Worker Error:', payload);
      } else if (type === 'SETTINGS_ACK') {
        setLastSettingsAck(payload);
      }
    };

    // 發送連線指令給 Worker（附帶共享密鑰，若有設定）
    worker.postMessage({ type: 'CONNECT', url, token: WS_TOKEN });

    return () => {
      // 元件卸載時終止 Worker
      worker.terminate();
    };
  }, [url]);

  const sendSettings = useCallback((settings: Partial<SystemSettingsState>) => {
    workerRef.current?.postMessage({
      type: 'SEND_JSON',
      payload: {
        type: 'settings_update',
        payload: settings,
      },
    });
  }, []);

  return { isConnected, dataStale, lastMessage, movementMetrics, bridgeStatus, locationData, sendSettings, lastSettingsAck };
}
