<div align="center">

# 🏥 Wi-Care — 智慧長照監控系統
### Wi-Fi CSI-Based Non-Contact Elderly Care Monitoring System

<p>
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite" />
  <img src="https://img.shields.io/badge/Tailwind-4-38BDF8?style=flat-square&logo=tailwindcss" />
  <img src="https://img.shields.io/badge/Three.js-r184-000000?style=flat-square&logo=threedotjs" />
  <img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python" />
  <img src="https://img.shields.io/badge/ESP32--S3-ESPectre_v2.7-E7352C?style=flat-square&logo=espressif" />
  <img src="https://img.shields.io/badge/WebSocket-8765-00ADB5?style=flat-square" />
</p>

<p><strong>以 Wi-Fi CSI 訊號為核心，無需穿戴裝置、無需攝影機的居家跌倒偵測與活動監控平台</strong></p>

</div>

---

## ⚠️ 先看這裡：本專案哪些是「真實數據」、哪些是「示範資料」

這份 README 力求**如實**。本系統可在「**有硬體**」與「**無硬體（demo）**」兩種狀態下運作，資料持久化也分「**有 Supabase 雲端**」與「**無雲端（瀏覽器本機）**」兩種。請務必分清楚：

| 資料 / 功能 | 真實來源（需硬體 / 雲端 / 金鑰） | 沒有時的替代（demo / 模擬 / 種子） |
|---|---|---|
| **移動分數（Movement Score, 0–100）** | ESP32-S3 + ESPectre 韌體算出的 CSI `mvmt`，經 Serial/BLE → `core_bridge.py` → WebSocket（10 Hz） | 前端「模擬模式」用正弦波＋雜訊合成；`core_bridge --simulate` 也會合成 |
| **CSI 連結品質（封包率 / 頻道 / RSSI）** | 由 ESPectre 序列輸出那行即時解析 | 無硬體時不顯示 |
| **室內定位座標 (x, y)** | Wi-Fi 多 AP 的 RSSI → 路徑損耗模型 → 最小平方多邊定位（`WiFi_Location2.py`，需 ≥3 個已知 AP） | 前端模擬模式用「避障路徑行走」合成；`--simulate` 用 Lissajous 軌跡 |
| **跌倒判定** | 後端感測器融合：移動分數突發尖峰 **＋** 尖峰後位置靜止雙條件 | 模擬模式由前端／後端依分數尖峰即時觸發（純展示） |
| **AI 即時研判 / 照護週報** | 真實呼叫 **Google Gemini API**（需 `GEMINI_API_KEY`） | 開發者模式下回傳寫死的示範研判文字 |
| **住民、每日血壓/血氧、例行健檢、警報紀錄** | 若設定 Supabase，警報可走雲端 | **預設全部是瀏覽器 localStorage 的種子示範資料**（7 位虛構住民），非真實病患 |
| **分析 / 照護洞察 / 總覽 / 裝置健康** | 設定 Supabase 時讀 `activity_summaries`、`fall_events`、`devices` 等表 | **未設定 Supabase 時，以 residentId 為種子產生穩定的合成趨勢資料**，讓畫面不空白 |
| **登入帳號** | 設定 Supabase 時走 Supabase Auth（bcrypt） | 否則 localStorage fallback（SHA-256 雜湊，僅供本機開發） |
| **LINE 推播** | 真實打 **LINE Messaging API push**（需 Channel Access Token + 接收者 userId） | 未設定則略過 |
| **睡眠品質 / 呼吸率分析** | 真實演算法（`python/*` 與 `sleepService.ts`），輸入為 `--record` 錄製或第二顆 ESP32 的原始 CSI | 資料不足時回傳 `null`＋原因，**絕不捏造數字** |

> **核心誠實原則（沿用 `docs/sleep-breathing.md`）**：所有 **live（正式）路徑不含任何隨機 / 模擬 / 寫死的假輸出**；資料不足或信心不夠時回傳 `null` / `"unreliable"` 與原因。合成訊號只存在於前端「模擬模式」、`core_bridge --simulate` 與 `tests/`，皆有明確標示，不會混入正式判讀。

---

## 📖 專案簡介

Wi-Care 利用 ESP32-S3 + **ESPectre** 韌體採集 Wi-Fi **CSI（Channel State Information，通道狀態資訊）**，分析無線電波因人體移動產生的微小變化，即時判斷居家環境中的活動狀態與跌倒風險；並以多個 Wi-Fi AP 的 RSSI 做室內定位。

> **隱私優先：** 不需要攝影機、不需要麥克風、不需要穿戴裝置。

---

## ✨ 系統功能

### 🔴 即時監控（RealtimeMonitoring）
- CSI 移動分數即時折線圖（10 Hz，自適應 EMA 平滑）
- **6 級人體活動辨識（HAR）**：睡眠/靜止 · 靜坐 · 輕微活動 · 行走 · 激烈活動 · 跌倒風險（前端依分數均值/變異/峰值分類）
- 移動分數環形儀表（0–100）與狀態橫幅
- **區域平面圖（2D）**：依房間幾何渲染病床/浴室/感測器，並標出人員定位綠點
- **區域立體圖（3D，等角 isometric）**：`react-three-fiber` 繪製，全螢幕含醫療深藍科技風（反射地板、網格、bloom 發光、三角定位距離圈、雷達脈衝）
- **跌倒警報視覺化**：人員標記轉紅＋衝擊波＋紅色光柱＋全螢幕警報橫幅（2D / 3D / 全螢幕一致）
- **模擬模式**：無硬體時一鍵產生移動波形、跌倒事件，並讓人員在房間內**避開床/牆**地走動（純前端展示）
- **AI 即時研判**：把當下分數/活動/位置餵給 Gemini，回傳白話研判與建議
- CSI 連結品質判讀（封包率 / 訊號強度 / 頻道，給照護人員看的「良好/普通/偏弱」）
- 即時數據匯出（CSV / JSON）
- **空間編輯器**：上傳底圖、手動描繪房間幾何（單一事實來源，2D 與 3D 共用）

### 🧠 跌倒偵測（後端 `core_bridge.py`）
| 模式 | 實際做法（如實） |
|------|------|
| **MVS（預設）** | 統計式自適應閾值：對最近 N 筆分數做 Hampel 離群過濾後，`auto` 取 P95×1.1×敏感度因子（`min` 取 P75×0.85），自動校正不同房間環境 |
| **感測器融合** | 在尖峰偵測之上加「尖峰後位置靜止」第二條件，過濾「劇烈但正常」的動作（快速坐下、彎腰撿物） |
| **ML 模式** | ⚠️ 目前為**輕量啟發式 gate**（`ui_score ≥ 90 且 motion`），**並非已訓練的神經網路模型**，僅供無嵌入式模型檔的展示硬體使用 |
| **ESPectre 原生** | 韌體輸出的 `MOTION/IDLE` 僅代表一般活動，不直接當跌倒 |

> 註：本 README 不附 F1/準確率數字——尚無公開、可重現的標註資料集與評測報告，故不作此宣稱。

### 🟡 久未活動 / 異常靜止偵測
- 連續 N 分鐘（預設 45 分）移動分數低於門檻 → 告警；夜間睡眠時段（22:00–07:00）不打擾。

### 🔔 LINE 推播（Messaging API）
- 跌倒上升邊緣立即推播（含分數、座標、時間），60 秒冷卻
- 異常靜止推播
- **升級通知**：跌倒事件逾 2 分鐘未在系統內確認 → 再次推播
- ⚠️ LINE Notify 已於 2025-03-31 終止，故改用 **Messaging API push**（需 Channel Access Token 與接收者 userId）

### 📍 Wi-Fi 室內定位
- 多 AP RSSI（多輪掃描取平均）→ 路徑損耗模型轉距離 → 最小平方多邊定位 → 房間座標
- 需在 `WiFi_Location2.py` 設定 `KNOWN_APS`（SSID → 座標），數學上至少 3 個 AP

### ☁️ 雲端資料（Supabase，選用）
- 設定後：`core_bridge.py` 以 service_role 金鑰推送 `fall_events`、每分鐘 `activity_summaries`、`devices` 心跳；前端的分析/洞察/總覽/警報/裝置/房間幾何改讀雲端
- 未設定：全部 fallback 到瀏覽器 localStorage 與合成示範資料

### 🛏️ 睡眠品質 Lite + 呼吸率管線
- **睡眠品質 Lite**：輸入整夜 `{ts, score}`（`core_bridge --record` 產生），於**瀏覽器端離線**算出入睡/醒來時間、睡眠效率、清醒次數、躁動指數與品質分數（`python/sleep_quality.py` 與 `src/services/sleepService.ts` 同演算法、以 fixtures 對拍）
- **呼吸率管線**：針對第二顆 ESP32 的**原始 CSI**設計（`python/breathing.py`），與 score 流分離

### 👥 長照管理（資料預設為 localStorage 種子示範）
- 住民資料（個資、病史、用藥）— 內建 7 位虛構住民
- 每日健康（血壓、血氧）、例行健檢（體重、血糖）
- 警報紀錄、病房佔用、人員管理
- 角色權限：developer / admin / medical / family（開發者可「以其他角色檢視」）
- 帳號管理（角色指派）、Google 登入

### ⚙️ 系統設定
- 演算法切換（MVS / ML）、閾值三模式（auto / min / manual）、靈敏度滑桿
- Hampel 離群過濾、自適應閾值、平滑開關（透過 WebSocket 同步給後端，後端再經 BLE 寫回 ESP32）
- LINE Token / userId、波形平滑強度
- **開發者模式**：停用網路請求、全站改用模擬資料

---

## 🏗️ 系統架構

```
┌──────────────────────────────────────────────────────────────┐
│  前端 (React 19 + Vite 6 + Tailwind 4 + Three.js)             │
│  即時監控 │ 立體圖3D │ 分析 │ 洞察 │ 警報 │ 健康 │ 設定 │ 睡眠   │
│   ↕ WebSocket ws://<host>:8765        ↕ Gemini (/api/ai-analysis)│
│                                       ↕ Supabase（選用）        │
└──────────────────────────────────────────────────────────────┘
                          │
┌──────────────────────────────────────────────────────────────┐
│             core_bridge.py（Python 後端 / Neural Hub）         │
│  Serial Reader  │  BLE Reader   │  WiFi Location Thread        │
│  (pyserial)     │  (bleak)      │  (WiFi_Location2 多邊定位)    │
│           ↕ SharedState（threading.Lock 保護）                 │
│  WebSocket Server (10Hz) │ 感測器融合跌倒 │ 久未活動            │
│  LINE Messaging API push │ Supabase 雲端推送（選用）           │
└──────────────────────────────────────────────────────────────┘
                          │  Serial / BLE
┌──────────────────────────────────────────────────────────────┐
│            ESP32-S3 + ESPectre v2.7.0 韌體                    │
│   CSI 採集 → movement 分數（mvmt/threshold）→ Serial / BLE     │
└──────────────────────────────────────────────────────────────┘
```

前端用 **Web Worker（`csi.worker.ts`）** 建立 WebSocket 連線並做解析/濾波，再透過 `useCSIWebSocket.ts` 把精簡狀態交給 React，避免 10 Hz 高頻資料卡住 UI 主執行緒。

---

## 🚀 快速開始

### 環境需求
- Node.js 18+
- Python 3.10+
- ESP32-S3 + ESPectre v2.7.0 韌體（**選用**；無硬體可用模擬模式）

### 1. 取得專案
```bash
git clone https://github.com/VincenTddos/CSI-front.git
cd CSI-front
```

### 2. 前端
```bash
npm install
npm run dev          # 開發伺服器 http://localhost:3000
```

### 3. 後端（選用，需要即時硬體/模擬數據時才啟動）
```bash
pip install -r requirements.txt      # websockets / pyserial / numpy / bleak ...

python core_bridge.py --simulate     # 模擬模式（無硬體）
python core_bridge.py --ble          # BLE 無線（ESPectre v2.7.0+）
python core_bridge.py --port COM5    # Serial USB
python core_bridge.py --record run.jsonl   # 同時錄製 movement 分數供離線分析
```

### 4. 設定金鑰（選用）
複製 `.env.example` 為 `.env`，依需要填入：
- `GEMINI_API_KEY` — 啟用 AI 研判 / 照護週報
- `VITE_GOOGLE_CLIENT_ID` — 啟用 Google 登入
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — 啟用雲端資料（前端）
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `WICARE_DEVICE_ID` — 後端雲端推送
- `WICARE_WS_TOKEN` — WebSocket 連線驗證（區網部署建議設定）

> **未設定金鑰也能跑**：前端會 fallback 到 localStorage 與合成示範資料，方便離線開發/展示。詳見 `docs/SUPABASE_SETUP.md`。

---

## 📁 專案結構

```
CSI-front/
├── core_bridge.py            # Python 後端核心（Serial/BLE/WiFi/WebSocket/融合跌倒/LINE/Supabase）
├── WiFi_Location2.py         # Wi-Fi RSSI 多邊定位
├── csi_pipeline.py           # movement 分數離線分析
├── python/                   # 睡眠品質 / 呼吸率 演算法（含設定 JSON）
├── tests/                    # pytest（含合成訊號產生器，僅供測試）
├── requirements.txt
├── src/
│   ├── pages/                # 即時監控、分析、洞察、警報、健康、設定、住民、帳號…
│   ├── components/           # IsometricRoom（3D）、RoomViewer/Editor Modal、Sidebar…
│   │   └── landing/          # 介紹頁動畫元件
│   ├── contexts/             # UserContext（登入/角色）、DataContext（住民/健康 SSOT）、DeveloperContext
│   ├── services/             # supabase 對接 + 無雲端時的合成 fallback（analytics/insights/overview/alerts/devices/sleep…）
│   ├── hooks/                # useCSIWebSocket / usePatients / useRoomGeometry
│   ├── workers/csi.worker.ts # WebSocket Web Worker
│   ├── lib/                  # roomGeometry、seedData（種子示範資料）、supabase、roles
│   └── types.ts
├── supabase/                 # 資料庫 schema / 設定
└── docs/                     # SUPABASE_SETUP.md、sleep-breathing.md
```

---

## 🔌 ESPectre BLE GATT 規格（v2.7.0+）

| 項目 | UUID |
|------|------|
| Service | `d33ff46b-2203-4775-bc6f-b3a2c36af8f0` |
| Telemetry (Notify) | `119d5cac-48da-4bd9-bfc3-169805868258` |
| SysInfo (Notify) | `c8c89ffa-c401-461f-9ffc-942fa04adfe3` |
| Control (Write) | `33ed9214-a8d7-40e8-82d1-c82747dcdc71` |

Telemetry 格式：`[float32 movement][float32 threshold]`（小端序，8 bytes）。
Serial 模式解析 ESPectre 那行：`... | mvmt:0.65 thr:1.00 | IDLE | 109 pkt/s | ch:6 rssi:-47`。

---

## 🛡️ 隱私聲明

- ✅ CSI 僅收集 Wi-Fi 頻道的**物理特徵**（振幅/相位變化）
- ❌ 無攝影機、無麥克風、無穿戴裝置
- ⚠️ README 中的住民、血壓、健檢等資料**皆為虛構示範種子資料**，非真實個資
- 實際部署請取得受監護者明確同意，並遵守當地隱私法規

---

## 🛠️ 技術棧（依 `package.json` / `requirements.txt`）

| 類別 | 技術 |
|------|------|
| 前端 | React 19 · TypeScript 5.8 · Vite 6 |
| 樣式 / 動畫 | Tailwind CSS 4 · motion (Framer Motion) |
| 3D | three r184 · @react-three/fiber · drei · postprocessing |
| 圖表 | Recharts 3 |
| 路由 / 圖標 | react-router-dom 7 · lucide-react |
| 雲端 / AI | @supabase/supabase-js · @google/genai (Gemini) |
| 後端 | Python 3.10+ · websockets · pyserial · numpy · bleak |
| 通訊 | WebSocket（10 Hz）· LINE Messaging API |
| 硬體 | ESP32-S3 + ESPectre v2.7.0 |

---

<div align="center">
  <p>Made by <a href="https://github.com/VincenTddos">VincenTddos</a> · Wi-Care Team</p>
  <p><sub>智慧長照，讓科技守護每一位長者</sub></p>
</div>
