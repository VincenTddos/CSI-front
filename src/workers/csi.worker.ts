// 定義 CSI 數據封包與處理後的結構
import { MovementData, CSIDataPacket } from '../types';

// 模擬 FFT 或 頻譜能量計算
function calculateEnergy(amplitudes: number[]): number {
  if (!amplitudes || amplitudes.length === 0) return 0;
  // 簡單計算能量 (平方和)
  return amplitudes.reduce((acc, val) => acc + (val * val), 0) / amplitudes.length;
}

// 簡單的移動平均濾波器 (Moving Average Filter)
class MovingAverageFilter {
  private windowSize: number;
  private buffer: number[];

  constructor(windowSize: number = 5) {
    this.windowSize = windowSize;
    this.buffer = [];
  }

  process(value: number): number {
    this.buffer.push(value);
    if (this.buffer.length > this.windowSize) {
      this.buffer.shift();
    }
    const sum = this.buffer.reduce((a, b) => a + b, 0);
    return sum / this.buffer.length;
  }
}

// 初始化濾波器
const energyFilter = new MovingAverageFilter(10);
// 我們也可以針對每個子載波 (Subcarrier) 進行濾波，這裡僅示範能量濾波

// Worker 上下文與 WebSocket
let socket: WebSocket | null = null;
let currentUrl = '';
let authToken = '';

// ---- 重連控制 ----
let intentionalClose = false;   // 主動關閉（DISCONNECT 或換 URL）時不自動重連
let retryCount = 0;             // 指數退避計數
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const MAX_BACKOFF_MS = 30000;

// ---- 心跳 / 資料新鮮度 ----
let lastPacketAt = 0;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
const STALE_MS = 3000;         // 後端 10Hz 推播，>3 秒沒資料即視為斷線

// ---- 輸出節流（避免 10Hz 推播導致 UI 每秒重繪 10-20 次）----
let pendingBridge: any = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const THROTTLE_MS = 250;

// 接收主線程指令
// message: { type: 'CONNECT' | 'DISCONNECT' | 'SEND_JSON', url?, token?, payload? }
self.onmessage = (e: MessageEvent) => {
  const { type, url, token, payload } = e.data;

  if (type === 'CONNECT' && url) {
    authToken = token || '';
    currentUrl = url;
    // 換新連線前先標記為主動關閉，避免舊 socket 的 onclose 觸發重連造成連線風暴
    closeSocket(true);
    retryCount = 0;
    connectWebSocket(url);
  } else if (type === 'DISCONNECT') {
    clearReconnect();
    closeSocket(true);
    stopHeartbeat();
    postMessage({ type: 'STATUS', payload: { isConnected: false } });
  } else if (type === 'SEND_JSON') {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    } else {
      postMessage({ type: 'ERROR', payload: 'WebSocket is not connected' });
    }
  }
};

function closeSocket(intentional: boolean) {
  if (!socket) return;
  intentionalClose = intentional;
  try {
    socket.onclose = null; // 主動關閉時不走 onclose 重連邏輯
    socket.close();
  } catch {
    /* ignore */
  }
  socket = null;
}

function clearReconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (intentionalClose) return;
  clearReconnect();
  const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** retryCount);
  retryCount += 1;
  reconnectTimer = setTimeout(() => connectWebSocket(currentUrl), delay);
}

function startHeartbeat() {
  stopHeartbeat();
  lastPacketAt = Date.now();
  heartbeatTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (Date.now() - lastPacketAt > STALE_MS) {
      // 連線還在但資料停了（例如 ESP32 死了），主動視為斷線並重連
      postMessage({ type: 'STATUS', payload: { isConnected: false, stale: true } });
      closeSocket(false);
      scheduleReconnect();
    }
  }, 1000);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// 將最新的 BRIDGE_STATUS 以最多 THROTTLE_MS 一次的頻率送回主線程；
// 但跌倒事件 (is_falling) 立即送出，不延遲。
function queueBridgeStatus(packet: any) {
  pendingBridge = packet;
  const urgent = packet?.ai_analysis?.is_falling === true;
  if (urgent) {
    flushBridgeStatus();
    return;
  }
  if (!flushTimer) {
    flushTimer = setTimeout(flushBridgeStatus, THROTTLE_MS);
  }
}

function flushBridgeStatus() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pendingBridge) {
    postMessage({ type: 'BRIDGE_STATUS', payload: pendingBridge });
    pendingBridge = null;
  }
}

function connectWebSocket(url: string) {
  try {
    intentionalClose = false;
    socket = new WebSocket(url);

    socket.onopen = () => {
      retryCount = 0;
      // 若設定了共享密鑰，第一則訊息送驗證
      if (authToken && socket) {
        socket.send(JSON.stringify({ type: 'auth', token: authToken }));
      }
      startHeartbeat();
      postMessage({ type: 'STATUS', payload: { isConnected: true } });
    };

    socket.onmessage = (event) => {
      try {
        lastPacketAt = Date.now();
        const rawData = JSON.parse(event.data);

        // 假設這是一個原始 CSI 封包
        if (rawData.type === 'csi' && rawData.payload) {
          const packet = rawData.payload as CSIDataPacket;

          // --- CPU 密集型運算開始 ---
          const rawEnergy = calculateEnergy(packet.data);
          const filteredEnergy = energyFilter.process(rawEnergy);
          const isMotion = filteredEnergy > 2500; // 假設閾值

          const processedData: MovementData = {
            score: filteredEnergy,
            isMotion: isMotion,
          };
          // --- CPU 密集型運算結束 ---

          postMessage({
            type: 'DATA',
            payload: {
              raw: packet,
              metrics: processedData,
            },
          });

        } else if (rawData.type === 'settings_ack') {
          postMessage({
            type: 'SETTINGS_ACK',
            payload: rawData,
          });

        } else if (rawData.status && rawData.ai_analysis && rawData.location) {
          // core_bridge.py 的完整狀態封包 (含三角定位座標)
          // 包含: status, ai_analysis, location, timestamp。節流後轉發。
          queueBridgeStatus(rawData);
        }

      } catch (err) {
        console.error('Worker: Parsing Error', err);
      }
    };

    socket.onclose = () => {
      stopHeartbeat();
      postMessage({ type: 'STATUS', payload: { isConnected: false } });
      // 非主動關閉才自動重連（指數退避）
      scheduleReconnect();
    };

    socket.onerror = (err) => {
      console.error('Worker: WebSocket Error', err);
    };

  } catch (err) {
    console.error('Worker: Connection Error', err);
    postMessage({ type: 'ERROR', payload: String(err) });
    scheduleReconnect();
  }
}

// 用於 TypeScript 識別 Worker 全局作用域
// @ts-ignore
function postMessage(message: any) {
  self.postMessage(message);
}
