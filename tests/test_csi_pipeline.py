# -*- coding: utf-8 -*-
"""csi_pipeline 回歸測試（規則 2：鎖定既有 hampel / butterworth 行為不被破壞）。

這些工具被 breathing.py 重用，且為既有 movement-score 管線的一部分，
故以已知答案釘住其行為。
"""

import numpy as np

from csi_pipeline import hampel_filter, butterworth_lowpass, load_recording


def test_hampel_replaces_single_outlier():
    """雜訊基線中的單一尖峰應被視窗中位數取代（接近基線、遠離原尖峰值）。"""
    rng = np.random.default_rng(1)
    x = 5.0 + rng.normal(0, 0.5, 41)
    x[20] = 500.0
    out = hampel_filter(x, window=7, n_sigma=3.0)
    assert out[20] < 10.0          # 已被取代，遠離 500
    assert abs(out[20] - 5.0) < 2.0


def test_hampel_zero_mad_leaves_outlier_untouched():
    """既有行為鎖定：鄰域為常數時 MAD=0，尖峰不會被取代（目前實作的已知限制）。

    這是 csi_pipeline.hampel_filter 現況（[csi_pipeline.py] 中 `if mad > 0` 守衛），
    回歸測試刻意釘住此行為，避免被無意更動。
    """
    x = np.ones(21) * 5.0
    x[10] = 500.0
    out = hampel_filter(x, window=7, n_sigma=3.0)
    assert out[10] == 500.0
    assert np.allclose(np.delete(out, 10), 5.0)


def test_hampel_keeps_clean_signal():
    """乾淨（無離群）訊號應幾乎不被更動。"""
    rng = np.random.default_rng(0)
    x = 10.0 + rng.normal(0, 0.01, 200)
    out = hampel_filter(x, window=7, n_sigma=3.0)
    assert np.allclose(out, x, atol=0.2)


def test_butterworth_attenuates_high_freq():
    """高頻成分應被低通明顯衰減，低頻成分大致保留。"""
    fs = 10.0
    t = np.arange(0, 20, 1 / fs)
    low = np.sin(2 * np.pi * 0.3 * t)      # 0.3 Hz，通帶內
    high = np.sin(2 * np.pi * 4.5 * t)     # 4.5 Hz，遠高於 3 Hz 截止
    out = butterworth_lowpass(low + high, cutoff_hz=3.0, fs=fs, order=4)
    # 殘餘高頻能量應遠小於原始高頻能量
    assert np.std(out - low) < 0.2
    # 低頻成分大致保留
    assert np.corrcoef(out, low)[0, 1] > 0.99


def test_load_recording_reads_score(tmp_path):
    """load_recording 取的是 score 欄位（契約釐清後仍須維持此行為）。"""
    p = tmp_path / "rec.jsonl"
    p.write_text(
        '{"ts": "2026-01-01T00:00:00Z", "score": 12.5}\n'
        '{"ts": "2026-01-01T00:00:01Z", "score": 7.0}\n'
        'broken line should be skipped\n'
        '{"ts": "2026-01-01T00:00:02Z", "score": 3.25}\n',
        encoding="utf-8",
    )
    scores = load_recording(str(p))
    assert np.allclose(scores, [12.5, 7.0, 3.25])
