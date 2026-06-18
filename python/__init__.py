"""Wi-Care 分析模組套件。

- sleep_quality：睡眠品質 Lite（輸入 = movement score 時序）
- breathing：呼吸率管線（輸入 = 原始 per-subcarrier CSI 振幅）
- recording_io：score 錄製檔讀取（{ts, score} jsonl）

注意：score 流與原始 CSI 流是兩條不同的資料契約，詳見 docs/sleep-breathing.md。
"""
