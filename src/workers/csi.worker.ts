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
let isConnected = false;

// 接收主線程指令
// message: { type: 'CONNECT' | 'DISCONNECT', url?: string }
self.onmessage = (e: MessageEvent) => {
  const { type, url } = e.data;

  if (type === 'CONNECT' && url) {
    if (socket) {
      socket.close();
    }
    connectWebSocket(url);
  } else if (type === 'DISCONNECT') {
    if (socket) {
      socket.close();
      socket = null;
      isConnected = false;
      postMessage({ type: 'STATUS', payload: { isConnected: false } });
    }
  }
};

function connectWebSocket(url: string) {
  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      isConnected = true;
      postMessage({ type: 'STATUS', payload: { isConnected: true } });
    };

    socket.onmessage = (event) => {
      try {
        const rawData = JSON.parse(event.data);
        
        // 假設這是一個原始 CSI 封包
        if (rawData.type === 'csi' && rawData.payload) {
          const packet = rawData.payload as CSIDataPacket;
          
          // --- CPU 密集型運算開始 ---
          // 1. 計算總能量 (模擬特徵提取)
          const rawEnergy = calculateEnergy(packet.data);
          
          // 2. 應用濾波算法 (消除高頻噪聲)
          const filteredEnergy = energyFilter.process(rawEnergy);
          
          // 3. 判斷是否為「有效移動」 (簡單閾值，實際可用 ML 模型)
          const isMotion = filteredEnergy > 2500; // 假設閾值
          
          const processedData: MovementData = {
            score: filteredEnergy,
            isMotion: isMotion
          };
          
          // --- CPU 密集型運算結束 ---

          // 只回傳處理後的結果給主線程，減輕 UI 負擔
          postMessage({ 
            type: 'DATA', 
            payload: { 
              raw: packet, // 原封包 (若 UI 需要畫圖)
              metrics: processedData 
            } 
          });

        } else if (rawData.type === 'movement') {
            // 如果後端已經傳來 movement data，直接轉發
            postMessage({ type: 'DATA', payload: { metrics: rawData } });

        } else if (rawData.status && rawData.ai_analysis && rawData.location) {
            // core_bridge.py 的完整狀態封包 (含三角定位座標)
            // 包含: status, ai_analysis, location, timestamp
            postMessage({
              type: 'BRIDGE_STATUS',
              payload: rawData
            });
        }

      } catch (err) {
        console.error('Worker: Parsing Error', err);
      }
    };

    socket.onclose = () => {
      isConnected = false;
      postMessage({ type: 'STATUS', payload: { isConnected: false } });
      // 可以在這裡實作自動重連邏輯
      setTimeout(() => connectWebSocket(url), 3000);
    };

    socket.onerror = (err) => {
      console.error('Worker: WebSocket Error', err);
    };

  } catch (err) {
    console.error('Worker: Connection Error', err);
    postMessage({ type: 'ERROR', payload: String(err) });
  }
}

// 用於 TypeScript 識別 Worker 全局作用域
// @ts-ignore
function postMessage(message: any) {
  self.postMessage(message);
}
