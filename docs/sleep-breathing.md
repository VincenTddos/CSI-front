# 睡眠品質 Lite + 呼吸率管線 — 設計、資料契約、假設與限制

本文件涵蓋兩個新分析功能：
- **A. 睡眠品質 Lite**（`python/sleep_quality.py` + `src/services/sleepService.ts`）
- **B. 呼吸率處理管線**（`python/breathing.py`）

並澄清專案中**兩條不同的資料契約**，以及如何接真實硬體、已知不確定性。

> ⚠️ 全域原則：所有 live（正式）路徑**不含**任何隨機 / 模擬 / 寫死的假輸出。
> 資料不足或信心不夠時，一律回傳 `null` / `"unreliable"` + 原因，**絕不捏造數字**。
> 合成訊號產生器只存在於 `tests/`，不被任何 live 模組匯入。

---

## 0. 兩條資料契約（務必分清）

| | **score 流** | **原始 CSI 流** |
|---|---|---|
| 內容 | ESPectre 韌體算好的 movement **分數**純量（0–100） | per-subcarrier 的 CSI **振幅**（複數→振幅） |
| 取樣率 | 約 10 Hz | 視來源，常見 20–100 Hz |
| 來源 | `core_bridge.py --record` 的 `{ts, score}` jsonl | 第二顆 ESP32 燒 esp-csi / ESP32-CSI-Tool 的 CSV |
| 讀取 | `python/recording_io.load_score_recording()`；`csi_pipeline.load_recording()` | `python/breathing.parse_esp_csi_tool_csv()` 等 adapter |
| 用途 | 跌倒偵測、**睡眠品質 Lite**、`csi_pipeline.py` 去噪/特徵/STFT | **呼吸率管線** |

> 歷史備註：`csi_pipeline.py` 早期 docstring 誤寫處理「原始 CSI 振幅序列」，但其
> `load_recording()` 實際讀的是 `score`。實作未變，已在 docstring 釐清：該檔自始
> 至終處理 **movement 分數**純量序列，非原始 CSI。

現有 `core_bridge.py` **只輸出 score，拿不到原始 CSI**，因此呼吸率管線（B）刻意對
「原始 CSI 輸入」獨立設計，不綁現有 score 流。

---

## A. 睡眠品質 Lite

### 輸入
一晚的 `{ts, score}` 時序（沿用 `core_bridge --record` 格式）。前端由使用者上傳該
jsonl，於**瀏覽器端離線**分析（不上傳雲端）。

### 演算法（`analyze_sleep`）
所有門檻集中於 `python/sleep_config.json`（Python 與前端 TS 共用同一份）：

1. **分箱**：每 `bin_sec`（預設 60s）一箱，算該箱 `motion_frac`＝score 超過
   `motion_score_threshold`（預設 8）的樣本比例。
2. **入睡 / 起床**：把連續「安靜箱」（`motion_frac < onset_quiet_motion_frac`）長度
   ≥ `onset_persist_min`（預設 20 分）視為「持續安靜區塊」。
   - `sleep_onset` = **第一個**持續安靜區塊的起點。
   - `wake_time` = **最後一個**持續安靜區塊的終點。
   - `time_in_bed_min` = wake − onset。
3. **夜醒 / 起身次數**：睡眠時段內，score 持續超過 `awakening_score_threshold`
   （預設 25）達 `awakening_min_sec`（預設 30s）的「動作爆發」；間隔 <
   `awakening_merge_gap_sec` 者合併。每次爆發記 `{start, end, peak_score}`。
4. **躁動指數** `restlessness_index`（0–1）：
   `w_time · 動作時間佔比 + w_energy · min(1, 平均超量/energy_norm)`。
5. **綜合睡眠分數**（0–100）：四個子分數加權（權重於 config）：
   - `duration`：總睡眠時長 vs 理想區間 `[ideal_sleep_min_lo, hi]`（預設 420–540 分）。
   - `efficiency`：總睡眠 / 在床時間 ÷ `efficiency_target`。
   - `restlessness`：`(1 − 躁動) × 100`。
   - `awakenings`：`100 − 夜醒次數 × awakening_penalty`。
   - `quality_label`：依 `quality_labels` 門檻（優/良/普通/差）。

### 誠實降級（規則 1）
- 錄製時長 < `min_record_min`（預設 60 分）→ 全欄位 `null` + `reason`，`confidence:"low"`。
- 找不到任何持續安靜區塊（整夜未入睡 / 離床 / 訊號異常）→ 同上。

### 一致性保證（Python ↔ 前端 TS）
`python/sleep_quality.py` 為**權威實作**；`src/services/sleepService.ts` 為等價移植。
兩者：
- 共用 `python/sleep_config.json`（前端以 Vite `@` alias `import` 同一檔）。
- 以 `tests/fixtures/synthetic_night.jsonl` →
  `tests/fixtures/expected_sleep_report.json` **對拍**：
  - Python：`tests/test_sleep_quality.py::test_fixture_matches_expected`
  - 前端：`src/services/sleepService.test.ts`（vitest，數字容差 1e-6）
- 重生 fixture：`python tests/gen_fixtures.py`。

---

## B. 呼吸率處理管線

### 輸入契約（`CsiFrame`）
```
CsiFrame.ts  : shape (n,)    每個封包時間（epoch 秒）
CsiFrame.amp : shape (n, k)  第 i 列=第 i 封包、第 j 行=第 j 子載波的振幅
```

### Adapter（原始 CSI 來源 → CsiFrame）
- `parse_esp_csi_tool_csv`：**ESP32-CSI-Tool** CSV（含 header，`CSI_DATA` 欄為括號內
  int8 **交錯 (imag, real)** 陣列）。振幅 = `hypot(real, imag)`。時間取
  `real_timestamp`／`local_timestamp`。
- `parse_esp_csi_csv`：Espressif **esp-csi** 主控台輸出變體。
- 兩者共用核心 `_parse_csi_lines`：抓每行括號陣列、只保留「子載波數=眾數」的列
  組成矩形矩陣（不同 PHY 模式長度不同的列會被濾除）；無時間欄則依索引用 fallback fs。
- Adapter 可插拔，其餘管線與來源格式無關。

### 管線（`estimate_bpm`）
門檻集中於 `python/breathing_config.json`：
1. 每子載波 **Hampel** 去離群（重用 `csi_pipeline.hampel_filter`）。
2. **detrend**（去線性趨勢/DC）。
3. **子載波挑選**：算每子載波在呼吸帶 `[band_lo, band_hi]`（預設 0.1–0.5 Hz）的
   帶內功率佔比，取前 `top_subcarriers` 名。
4. **Butterworth 帶通** 0.1–0.5 Hz，z-score 後平均，增強共同呼吸成分。
5. **BPM 估算**：
   - FFT periodogram 找帶內峰 + **拋物線內插**（sub-bin 精度）。
   - **自相關**在週期範圍找峰，交叉驗證。
   - `method_agreement` = 兩法 BPM 的一致性（0–1）。
   - `confidence` 由帶內 SNR（dB）線性映射到 0–1。
6. **滑動視窗** `estimate_bpm_stream`：每 `hop_sec` 推進、視窗 `window_sec`。

### 誠實降級（規則 1）
- 視窗 < `min_window_sec`（解析度不足）、找不到帶內有效週期性、`confidence <
  min_confidence`、或 FFT 與自相關不一致 → `status:"unreliable"`、`bpm:None` + `reason`。

### 為何 BPM 解析度需要夠長的視窗
FFT 頻率解析度 ≈ 1/T。要 BPM 誤差 < 1（≈ 0.017 Hz），單純 bin 需 T ≳ 60 s；本管線
加上拋物線內插可在較短視窗取得 sub-bin 精度，但仍建議視窗 ≥ `min_window_sec`。

---

## 假設與限制（誠實標明）

### 共同
- **單天線 ESP32**、**單一占用者**。多人 / 寵物會污染判定。
- 門檻為工程啟發式，非臨床診斷依據。

### 睡眠
- 夜間相對靜止；長時間清醒躺著（低動作）可能被誤判為睡眠。
- `wake_time` 取「最後一個長安靜區塊終點」，故最後若只剩短安靜段會被保守排除
  （略為低估睡眠尾段）。
- movement 分數尺度假設 0–100；不同韌體/靈敏度設定需重新校正門檻。

### 呼吸
- 受測者需**相對靜止**：任何大動作（翻身、走動）都會蓋過 0.1–0.5 Hz 的微弱呼吸調變
  → 該視窗應回 `"unreliable"`。
- 需**近距離 / 視線可及（LOS）**、**封包率穩定**的發射端。
- 單人；多人呼吸會混疊。
- 「離床」與「呼吸停止（apnea）」在純 CSI 上可能難以區分 → 不做臨床判讀。

---

## 如何接真實硬體取得原始 CSI（本次未改韌體）

現有跑 ESPectre 的 ESP32-S3 **只輸出 movement 分數**，不吐原始 CSI。要餵 B 管線：

1. 準備**第二顆 ESP32-S3**，燒 [esp-csi](https://github.com/espressif/esp-csi) 或
   [ESP32-CSI-Tool](https://github.com/StevenMHernandez/ESP32-CSI-Tool) 的 CSI 接收韌體。
2. 需要**穩定的發射端**（持續送封包的 AP 或另一顆 ESP32 當 sender），封包率越穩越好。
3. 把接收端輸出的 CSI CSV（含 `CSI_DATA` 括號陣列）餵給：
   ```
   python -m python.breathing capture.csv --format esp-csi-tool --stream
   ```
4. 受測者於感測路徑上保持相對靜止數十秒，即可得到 BPM 與信心值。

> 本次任務**不改韌體**；上述為未來接真實 CSI 的路徑說明。

---

## 已知不確定性（摘要）
- 睡眠 onset/wake 取決於 `onset_persist_min` 等門檻，對不同居住型態需微調。
- 躁動指數為**相對**指標，非臨床睡眠分期（無 REM/深淺眠區分）。
- 呼吸 BPM 在低 SNR / 有動作時會（正確地）回 `"unreliable"`，而非勉強給數字。
- score 流與原始 CSI 流的取樣率/尺度不同，跨流比較無意義。

---

## 測試與驗收
```bash
# Python（睡眠 + 呼吸 + adapter + csi_pipeline 回歸）
python -m pytest -q

# 前端（TS↔Python 睡眠對拍）
npm test

# 型別檢查
npm run lint

# 手動：npm run dev → 「智慧照護分析」頁 → 睡眠品質報告 → 上傳
#   tests/fixtures/synthetic_night.jsonl，應顯示時間軸 + 分數 + 夜醒點。
```
