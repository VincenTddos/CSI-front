# -*- coding: utf-8 -*-
"""睡眠品質 Lite 單元測試（已知答案的合成訊號）。"""

import os

from python.sleep_quality import analyze_sleep, analyze_recording, SleepConfig
from tests.synth import make_standard_night, make_night_scores

CFG = SleepConfig.load()
FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def test_standard_night_known_answer():
    """合成標準夜：已知 onset/wake/夜醒次數，驗證落在預期。"""
    ts, score = make_standard_night()
    rep = analyze_sleep(ts, score, CFG)

    assert rep.confidence == "ok"
    assert rep.reason is None
    # 起始 22:00；安靜段 A 由第 4 分鐘開始 → onset 22:04；末段安靜 C 結束於第 75 分鐘 → wake 23:15
    assert rep.sleep_onset == "2026-01-01T22:04:00.000Z"
    assert rep.wake_time == "2026-01-01T23:15:00.000Z"
    assert rep.time_in_bed_min == 71.0
    assert rep.awakenings == 2
    assert len(rep.awakening_events) == 2
    assert 0.0 <= rep.restlessness_index <= 1.0
    assert rep.total_sleep_min <= rep.time_in_bed_min
    assert 0 <= rep.sleep_score <= 100
    assert rep.quality_label is not None


def test_determinism():
    """同輸入兩次 → 完全相同（純函式、無隨機）。"""
    ts, score = make_standard_night()
    a = analyze_sleep(ts, score, CFG).to_dict()
    b = analyze_sleep(ts, score, CFG).to_dict()
    assert a == b


def test_onset_wake_tolerance():
    """onset/wake 容差檢查：估計值與真實相位邊界誤差 < 1 個 bin。"""
    ts, score = make_standard_night()
    rep = analyze_sleep(ts, score, CFG)
    t0 = ts[0]
    onset_min = (_epoch(rep.sleep_onset) - t0) / 60.0
    wake_min = (_epoch(rep.wake_time) - t0) / 60.0
    assert abs(onset_min - 4) < 1.0
    assert abs(wake_min - 75) < 1.0


def test_insufficient_duration_returns_null():
    """資料時長不足（< min_record_min）→ 誠實降級：null 欄位 + reason（規則 1）。"""
    ts, score = make_night_scores("2026-01-01T22:00:00Z", [(10, 2.0, 1.0)], fs=1.0, seed=1)
    rep = analyze_sleep(ts, score, CFG)
    assert rep.confidence == "low"
    assert rep.sleep_onset is None
    assert rep.wake_time is None
    assert rep.sleep_score is None
    assert rep.quality_label is None
    assert rep.reason is not None


def test_no_quiet_period_returns_null():
    """整夜皆活動（無持續安靜）→ 不捏造睡眠，回 null + 原因。"""
    ts, score = make_night_scores("2026-01-01T22:00:00Z", [(90, 35.0, 8.0)], fs=1.0, seed=2)
    rep = analyze_sleep(ts, score, CFG)
    assert rep.confidence == "low"
    assert rep.sleep_onset is None
    assert rep.reason is not None


def test_fixture_matches_expected():
    """直接從 committed fixture 讀回分析 → 應等於 expected_sleep_report.json（與 TS 對拍同一份）。"""
    import json
    rep = analyze_recording(os.path.join(FIX, "synthetic_night.jsonl"), CFG)
    with open(os.path.join(FIX, "expected_sleep_report.json"), encoding="utf-8") as fh:
        expected = json.load(fh)
    assert rep.to_dict() == expected


def _epoch(iso: str) -> float:
    from datetime import datetime
    s = iso[:-1] + "+00:00" if iso.endswith("Z") else iso
    return datetime.fromisoformat(s).timestamp()
