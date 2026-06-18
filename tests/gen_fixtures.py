# -*- coding: utf-8 -*-
"""tests/gen_fixtures.py — 產生（重生）對拍 fixture。

輸出：
    tests/fixtures/synthetic_night.jsonl     （合成整夜，{ts, score}，10 進位 2 位，仿 core_bridge --record）
    tests/fixtures/expected_sleep_report.json （以權威 Python sleep_quality 算出的期望報告）

Python 測試與前端 vitest 都讀這兩個檔對拍，確保 TS 與 Python 數字一致。
重生指令（專案根目錄）：  python tests/gen_fixtures.py
"""

from __future__ import annotations

import json
import os
import sys

# 讓本檔可直接執行：把專案根與 python/ 放進 path
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _ROOT)
sys.path.insert(0, os.path.join(_ROOT, "python"))

from tests.synth import make_standard_night  # noqa: E402
from python.sleep_quality import analyze_sleep, SleepConfig  # noqa: E402

FIX_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")


def main() -> None:
    os.makedirs(FIX_DIR, exist_ok=True)
    ts, score = make_standard_night(seed=42)

    # 仿 core_bridge --record：每行 {ts: ISO8601 UTC, score: round(.,2)}
    from datetime import datetime, timezone
    jsonl_path = os.path.join(FIX_DIR, "synthetic_night.jsonl")
    with open(jsonl_path, "w", encoding="utf-8") as fh:
        for t, s in zip(ts, score):
            iso = datetime.fromtimestamp(t, tz=timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
            fh.write(json.dumps({"ts": iso, "score": round(float(s), 2)}) + "\n")

    # 從寫好的 jsonl 重新讀回再分析（與 live 路徑一致）
    from python.recording_io import load_score_recording
    ts2, score2 = load_score_recording(jsonl_path)
    report = analyze_sleep(ts2, score2, SleepConfig.load())

    report_path = os.path.join(FIX_DIR, "expected_sleep_report.json")
    with open(report_path, "w", encoding="utf-8") as fh:
        fh.write(json.dumps(report.to_dict(), ensure_ascii=False, indent=2) + "\n")

    print(f"已寫入 {jsonl_path}（{len(ts)} 筆）")
    print(f"已寫入 {report_path}")
    print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
