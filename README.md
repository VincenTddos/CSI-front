<div align="center">

# 🏥 Wi-Care — 智慧長照監控系統
### AI-Powered Smart Elderly Care Monitoring System

  <p>
    <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" />
    <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript" />
    <img src="https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite" />
    <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python" />
    <img src="https://img.shields.io/badge/ESP32--S3-ESPectre_v2.7-E7352C?style=flat-square&logo=espressif" />
    <img src="https://img.shields.io/badge/WebSocket-8765-00ADB5?style=flat-square" />
  </p>

  <p><strong>以 Wi-Fi CSI 訊號為核心，無需穿戴裝置、無需攝影機，保護隱私的居家跌倒偵測與活動監控平台</strong></p>

</div>

---

## 📖 專案簡介

Wi-Care 利用 ESP32-S3 發射的 Wi-Fi **CSI（Channel State Information，通道狀態資訊）** 訊號，分析無線電波在空間中因人體移動產生的微小變化，即時判斷居家環境中的人員活動與跌倒風險。

> **核心優勢：** 不需要攝影機、不需要麥克風、不需要穿戴裝置，完全保護被照護者的個人隱私。

---

## ✨ 系統功能

### 🔴 即時監控儀表板
- CSI 移動分數即時折線圖（10 Hz 更新）
- **6 級人體活動辨識（HAR）**：睡眠 / 靜坐 / 輕微活動 / 行走 / 激烈活動 / 跌倒風險
- 儀表板分數環形顯示（0–100）
- 跌倒警報即時觸發，支援警報歷史記錄

### 🧠 跌倒偵測演算法
| 模式 | 說明 |
|------|------|
| **MVS 模式** | Moving Variance Segmentation，傳統自適應門限，P95×1.1 自動校正，F1 > 96% |
| **ML 模式** | Neural Network MLP 12→16→8→1，免校正，3 秒啟動，F1 97–100%（實驗性）|
| **ESPectre 原生** | 直接使用韌體 `movement ≥ threshold` 判定，搭配尖峰偵測保守過濾 |

### 📡 硬體連接模式
| 模式 | 說明 | 啟動指令 |
|------|------|---------|
| **BLE 無線** | 透過藍牙接收 ESPectre 資料，支援自動重連 | `python core_bridge.py --ble` |
| **Serial USB** | 透過 USB 序列埠接收 | `python core_bridge.py --port COM7` |
| **模擬模式** | 無硬體時使用假資料開發測試 | `python core_bridge.py --simulate` |

### 📍 Wi-Fi 室內三角定位
- 多 AP 訊號強度（RSSI）多邊定位演算法
- 最小平方法（Least Squares）估算房間座標
- 即時地圖顯示被照護者位置

### 🔔 LINE Notify 跌倒推播
- 偵測到跌倒瞬間（上升邊緣）立即推播
- 訊息包含：移動分數、位置座標、時間戳記
- 60 秒冷卻，避免重複通知

### ⚙️ 系統設定
- 演算法切換（MVS / ML）
- 閾值三模式：Auto（P95×1.1）/ Min（P100）/ Manual（手動）
- 靈敏度滑桿（0–100%）
- Hampel 離群值過濾、低通濾波器、自適應噪聲過濾
- LINE Notify Token 設定

### 👥 長照管理功能
- 住民資料管理（個人資料、病史、用藥）
- 日常健康記錄（血壓、血氧）
- 例行健檢記錄（體重、血糖）
- 健康紀錄匯出（CSV / JSON）
- 病房佔用率監控

---

## 🏗️ 系統架構

```
┌─────────────────────────────────────────────────────┐
│                   前端 (React + Vite)                 │
│  Dashboard │ Monitoring │ Alerts │ Health │ Settings  │
│         ↕ WebSocket (ws://localhost:8765)             │
└─────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────┐
│             core_bridge.py  (Python 後端)            │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ BLE Reader  │  │ Serial Reader│  │  WiFi Loc  │  │
│  │  (bleak)    │  │  (pyserial)  │  │  Thread    │  │
│  └─────────────┘  └──────────────┘  └────────────┘  │
│           ↕ SharedState (thread-safe)                 │
│  ┌─────────────────────────────────────────────────┐ │
│  │    WebSocket Server (websockets, port 8765)     │ │
│  │    FallDetector │ LINE Notify │ Settings Sync   │ │
│  └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────┐
│           ESP32-S3 + ESPectre v2.7.0                 │
│   CSI 採集 → NBVI 移動分數 → BLE / Serial 傳輸        │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 快速開始

### 環境需求
- Node.js 18+
- Python 3.10+
- ESP32-S3 開發板（選用，可用模擬模式代替）
- ESPectre v2.7.0 韌體（選用）

### 安裝步驟

**1. Clone 專案**
```bash
git clone https://github.com/VincenTddos/CSI-front.git
cd CSI-front
```

**2. 安裝前端依賴**
```bash
npm install
```

**3. 安裝後端依賴**
```bash
pip install websockets pyserial numpy
pip install bleak        # 若使用 BLE 模式
```

**4. 啟動後端橋接程式**
```bash
# 模擬模式（無硬體，開發用）
python core_bridge.py --simulate

# BLE 模式（無線）
python core_bridge.py --ble

# Serial 模式（USB）
python core_bridge.py --port COM7
```

**5. 啟動前端**
```bash
npm run dev
```

開啟瀏覽器訪問 `http://localhost:5173`

---

## 📁 專案結構

```
CSI-front/
├── core_bridge.py              # Python 後端核心（WebSocket + CSI 處理）
├── src/
│   ├── pages/
│   │   ├── RealtimeMonitoring.tsx   # 即時監控儀表板
│   │   ├── SystemSettings.tsx       # 系統設定（演算法、閾值、LINE）
│   │   ├── AlertsPage.tsx           # 警報記錄
│   │   ├── PatientList.tsx          # 住民管理
│   │   ├── DailyHealthRecord.tsx    # 日常健康記錄
│   │   └── OccupancyPage.tsx        # 病房佔用率
│   ├── hooks/
│   │   └── useCSIWebSocket.ts       # WebSocket 連線 Hook
│   ├── workers/
│   │   └── csi.worker.ts            # WebSocket Web Worker
│   ├── components/                  # 共用 UI 元件
│   └── types.ts                     # TypeScript 型別定義
└── WiFi_Location2.py               # Wi-Fi 三角定位模組
```

---

## 🔌 ESPectre BLE GATT 規格（v2.7.0+）

| 項目 | UUID |
|------|------|
| Service | `d33ff46b-2203-4775-bc6f-b3a2c36af8f0` |
| Telemetry (Notify) | `119d5cac-48da-4bd9-bfc3-169805868258` |
| SysInfo (Notify) | `c8c89ffa-c401-461f-9ffc-942fa04adfe3` |
| Control (Write) | `33ed9214-a8d7-40e8-82d1-c82747dcdc71` |

Telemetry 格式：`[float32 movement][float32 threshold]`（小端序，8 bytes）

---

## 🛡️ 隱私聲明

- ✅ CSI 僅收集 Wi-Fi 頻道的**物理特徵**（振幅與相位）
- ❌ 不含任何個人身分資訊
- ❌ 無攝影機、無麥克風、無穿戴裝置
- 本系統應在取得受監護者明確同意後使用，並遵守當地隱私法規（如 GDPR）

---

## 🛠️ 技術棧

| 類別 | 技術 |
|------|------|
| 前端框架 | React 18 + TypeScript |
| 建構工具 | Vite 5 |
| UI 樣式 | Tailwind CSS |
| 圖表 | Recharts |
| WebSocket | websockets（Python）/ Web Worker（瀏覽器）|
| BLE | bleak 2.1.1（Python）|
| 序列埠 | pyserial |
| 科學計算 | NumPy |
| 硬體 | ESP32-S3 + ESPectre v2.7.0 |
| 推播通知 | LINE Notify API |

---

<div align="center">
  <p>Made with ❤️ by <a href="https://github.com/VincenTddos">VincenTddos</a></p>
  <p><sub>Wi-Care Team — 智慧長照，讓科技守護每一位長者</sub></p>
</div>
