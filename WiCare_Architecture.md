# Wi-Care 智慧長照監控系統 - 專案架構與邏輯解析

本文件旨在說明 Wi-Care 智慧長照監控系統的系統架構、前後端技術棧、以及核心資料流向。

## 1. 系統總覽
Wi-Care 是一個結合硬體感測與軟體介面的**非接觸式長照監控系統**。
它利用 Wi-Fi CSI (Channel State Information, 通道狀態資訊) 技術，透過 ESP32 收集環境中的無線電波極細微變化，並藉由後端分析進行跌倒偵測與活動量統計。同時配合 Wi-Fi RSSI 進行室內三角定位，達成對受照護者即時且具備隱私性（無攝影機開銷）的安全監控。

---

## 2. 後端核心：`core_bridge.py` (Neural Hub)

後端作為硬體與前端介面之間的「橋接器」，使用 **Python 3** 撰寫，具備三個多執行緒 (Multi-threading) 併發的子系統：

### A. 序列埠讀取執行緒 (Serial Reader Thread)
- **功能**：透過 USB 串列埠持續從 ESP32 接收解析好的 CSI 特徵數據（例如：`Movement Score: 15.2`）。
- **容錯與模擬**：包含自動重連機制。若開發階段缺乏硬體，可啟用 `--simulate` 參數，此執行緒會利用正弦波與隨機雜訊，自動生成逼真的人體活動分數，並偶爾觸發「高分」(模擬跌倒)。

### B. Wi-Fi 定位執行緒 (WiFi Location Thread)
- **功能**：由獨立執行緒週期性（預設 5 秒）呼叫 `WiFi_Location2.py` 的邏輯。
- **邏輯**：掃描附近已知 AP 的 RSSI (訊號強度)，套用訊號衰減模型 (Path Loss Math) 將 RSSI 轉換為與各 AP 的距離。最後透過「最小平方法 (Least Squares)」執行多點三角定位，計算出目標的 `(X, Y)` 座標。
- **模擬**：模擬模式下，會透過 Lissajous 曲線產生一個模擬兩公尺半徑內來回走動的座標軌跡。

### C. 狀態管理與 WebSocket 伺服器
- **共用狀態 (`SharedState`)**：利用 `threading.Lock()` 確保序列埠資料與定位座標被正確儲存且不受競爭危害 (Race Condition) 影響。
- **WebSocket 伺服器 (asyncio)**：預設啟動於 `ws://0.0.0.0:8765`。它擁有一個不中斷的廣播迴圈 (`broadcast_loop`)，預設以 1Hz (每秒1次) 的頻率，將當前最新狀態（包含狀態在線與否、移動分數、跌倒判定、最新 XY 座標）打包為 JSON 推播給所有連線中的前端。

---

## 3. 前端介面：React 應用程式

前端為一個現代化的單頁應用程式 (SPA)，專為無縫處理即時資料及呈現豐富圖表所設計。

### A. 技術選型
- **框架**：React 19 + TypeScript + Vite
- **樣式**：Tailwind CSS v4 (透過 `@tailwindcss/vite` 整合) + Framer Motion (提供流暢轉場動畫)
- **圖表**：Recharts (用於繪製 Subcarrier 分析與活動分數折線圖)
- **圖標**：Lucide React

### B. 即時資料整合架構 (`csi.worker.ts` & `useCSIWebSocket.ts`)
處理高頻率的 WebSocket 資料若直接綁定在 UI 主執行緒，容易導致畫面掉幀卡頓。專案採用了優秀的架構：
1. **Web Worker (`csi.worker.ts`)**：前端的 WebSocket 連線實際上是在背景 Worker 中建立的。Worker 負責接收 JSON 解析，並具備擴充特徵提取與平滑濾波 (Moving Average Filter) 的能力，減輕 UI 負擔。
2. **自訂 Hook (`useCSIWebSocket.ts`)**：負責與 Worker 透過 `postMessage` 溝通，將 Worker 整理好的精簡狀態 (`movementMetrics`, `bridgeStatus`, `locationData`) 轉換為 React State 供介面元件使用。

### C. 核心業務頁面
- **即時監控 (`RealtimeMonitoring.tsx`)**：系統的「戰情室」。結合即時移動分數更新折線圖，並根據座標在室內平面圖上渲染代表病患移動的小圓點。
- **人員與設備管理 (`PersonnelManagement.tsx` / `DeviceManagement.tsx`)**：控管後台數據與感知設備狀態。
- **告警通知 (`AlertNotifications.tsx`)**：當判斷 `is_falling: true` (例如分數超過 80 分閾值) 時，系統會呈現明顯告警要求護理人員注意。
- **健康記錄 (`DailyHealth.tsx` / `FamilyHealthLog.tsx`)**：允許家屬與醫療人員建立長期的日常血壓、血氧等常規體檢紀錄。

---

## 4. 整體資料流向 (Data Flow)

1. **[感知層]** ESP32 進行 CSI 封包採集並分析出 Movement Score。
2. **[傳輸層]** ESP32 透過 UART (Serial) 將字串傳遞給 `core_bridge.py`。
3. **[處理層]** `core_bridge.py` 結合自身的 Wi-Fi 網卡掃描完成 `(X, Y)` 定位，融合資料為 `{ status, ai_analysis, location }`。
4. **[推播層]** 透過 WebSocket 非同步推播給瀏覽器。
5. **[接收層]** 前端 `csi.worker.ts` 接收並執行必要濾波。
6. **[呈現層]** React元件讀取 state，更新 Recharts 動態折線圖，並控制 CSS 動畫讓平面圖指示點平滑移動。
