# -*- coding: utf-8 -*-
"""呼吸率管線單元測試（已知答案的合成 CSI）。"""

from python.breathing import (
    CsiFrame, BreathingConfig, estimate_bpm, estimate_bpm_stream,
)
from tests.synth import make_synthetic_csi

CFG = BreathingConfig.load()


def test_clean_signal_recovers_bpm():
    """乾淨訊號（15 BPM = 0.25 Hz）→ 還原誤差 < 1 BPM、status ok。"""
    ts, amp = make_synthetic_csi(
        bpm=15.0, duration_sec=120.0, fs=20.0, n_subcarriers=30,
        noise_std=0.02, mod_depth=1.0, active_subcarriers=list(range(0, 15)), seed=7)
    est = estimate_bpm(CsiFrame(ts=ts, amp=amp), CFG)

    assert est.status == "ok", est.reason
    assert est.bpm is not None
    assert abs(est.bpm - 15.0) < 1.0
    assert est.confidence >= CFG.min_confidence


def test_clean_signal_other_rate():
    """另一個呼吸率（12 BPM = 0.20 Hz）也應準確還原。"""
    ts, amp = make_synthetic_csi(
        bpm=12.0, duration_sec=120.0, fs=20.0, noise_std=0.02, mod_depth=1.0,
        active_subcarriers=list(range(0, 15)), seed=3)
    est = estimate_bpm(CsiFrame(ts=ts, amp=amp), CFG)
    assert est.status == "ok", est.reason
    assert abs(est.bpm - 12.0) < 1.0


def test_high_noise_reports_unreliable():
    """高雜訊把呼吸埋掉 → status unreliable、bpm=None（規則 1：不捏造）。"""
    ts, amp = make_synthetic_csi(
        bpm=15.0, duration_sec=120.0, fs=20.0, n_subcarriers=30,
        noise_std=2.0, mod_depth=0.05, active_subcarriers=list(range(0, 15)), seed=11)
    est = estimate_bpm(CsiFrame(ts=ts, amp=amp), CFG)

    assert est.status == "unreliable"
    assert est.bpm is None
    assert est.reason is not None


def test_too_short_window_unreliable():
    """視窗過短（解析度不足）→ unreliable + reason。"""
    ts, amp = make_synthetic_csi(bpm=15.0, duration_sec=10.0, fs=20.0, seed=1)
    est = estimate_bpm(CsiFrame(ts=ts, amp=amp), CFG)
    assert est.status == "unreliable"
    assert est.bpm is None


def test_determinism():
    """同輸入兩次 → 完全相同。"""
    ts, amp = make_synthetic_csi(bpm=15.0, duration_sec=120.0, fs=20.0,
                                 active_subcarriers=list(range(0, 15)), seed=7)
    a = estimate_bpm(CsiFrame(ts=ts, amp=amp), CFG).to_dict()
    b = estimate_bpm(CsiFrame(ts=ts, amp=amp), CFG).to_dict()
    assert a == b


def test_stream_returns_windows():
    """滑動視窗輸出：回傳多個估計，乾淨訊號下至少一個 ok 且接近 15 BPM。"""
    ts, amp = make_synthetic_csi(
        bpm=15.0, duration_sec=180.0, fs=20.0, noise_std=0.02, mod_depth=1.0,
        active_subcarriers=list(range(0, 15)), seed=5)
    estimates = estimate_bpm_stream(CsiFrame(ts=ts, amp=amp), CFG)
    assert len(estimates) >= 2
    oks = [e for e in estimates if e.status == "ok"]
    assert oks, "乾淨訊號應至少一個視窗可靠"
    assert all(abs(e.bpm - 15.0) < 1.5 for e in oks)
