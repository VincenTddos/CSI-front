# -*- coding: utf-8 -*-
"""tests/synth.py — 合成訊號產生器（**僅供測試 / 產生 fixture 使用**）。

⚠️ 全域規則 1：合成 / 隨機 / 寫死資料**絕不可**出現在 live（正式）路徑。
本檔位於 tests/ 之下，且不被任何 live 模組（core_bridge.py / python/*.py /
src/services/*.ts）匯入。僅用於：
    - 單元測試（已知答案驗證）
    - 產生 tests/fixtures/ 下的對拍 fixture

兩類產生器：
    A. make_night_scores  -> 整夜 movement score 時序（驗 sleep_quality）
    B. make_synthetic_csi -> per-subcarrier 原始 CSI 振幅（驗 breathing）
"""

from __future__ import annotations

from datetime import datetime, timezone

import numpy as np


def iso_to_epoch(iso: str) -> float:
    s = iso[:-1] + "+00:00" if iso.endswith("Z") else iso
    return datetime.fromisoformat(s).timestamp()


# --------------------------------------------------------------------------- #
#  A. 整夜 movement score
# --------------------------------------------------------------------------- #
# phase = (duration_min, level, jitter)
#   quiet（睡眠）：level 低於 motion 門檻；active/burst：高於門檻
def make_night_scores(start_iso: str, phases: list[tuple[float, float, float]],
                      fs: float = 1.0, seed: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """以「相位清單」合成整夜 score。回傳 (ts_epoch_sec, score)。確定性（給定 seed）。"""
    rng = np.random.default_rng(seed)
    t0 = iso_to_epoch(start_iso)
    ts_list: list[float] = []
    sc_list: list[float] = []
    t = t0
    dt = 1.0 / fs
    for dur_min, level, jitter in phases:
        n = int(round(dur_min * 60.0 * fs))
        noise = rng.normal(0.0, jitter, n)
        for k in range(n):
            val = level + noise[k]
            sc_list.append(val if val > 0.0 else 0.0)
            ts_list.append(t)
            t += dt
    return np.asarray(ts_list, dtype=float), np.asarray(sc_list, dtype=float)


# 標準「一夜」相位：前段清醒 → 長安靜 → 夜醒 → 長安靜 → 夜醒 → 長安靜 → 起床
# 安靜段皆 >= onset_persist_min(20)，使 onset=首個長安靜起點、wake=末個長安靜終點，
# 中間兩次爆發 = 2 次夜醒。
STANDARD_NIGHT_PHASES: list[tuple[float, float, float]] = [
    (4, 30.0, 8.0),    # 0–4   睡前清醒
    (22, 2.0, 1.5),    # 4–26  安靜 A
    (3, 45.0, 6.0),    # 26–29 夜醒 1
    (22, 2.0, 1.5),    # 29–51 安靜 B
    (2, 45.0, 6.0),    # 51–53 夜醒 2
    (22, 2.0, 1.5),    # 53–75 安靜 C
    (5, 30.0, 8.0),    # 75–80 起床
]


def make_standard_night(seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    return make_night_scores("2026-01-01T22:00:00Z", STANDARD_NIGHT_PHASES, fs=1.0, seed=seed)


# --------------------------------------------------------------------------- #
#  B. 原始 CSI（per-subcarrier 振幅）
# --------------------------------------------------------------------------- #
def make_synthetic_csi(bpm: float, duration_sec: float, fs: float,
                       n_subcarriers: int = 30, noise_std: float = 0.02,
                       amp_base: float = 20.0, mod_depth: float = 1.0,
                       active_subcarriers: list[int] | None = None,
                       start_epoch: float = 0.0,
                       seed: int = 0) -> tuple[np.ndarray, np.ndarray]:
    """合成 per-subcarrier CSI 振幅：呼吸正弦 (bpm) + 每子載波 DC + 高斯雜訊。

    回傳 (ts_epoch_sec[n], amp[n, k])。noise_std 為相對於 amp_base 的比例。
    active_subcarriers 指定哪些子載波帶有較強呼吸調變（None=全部）。確定性（seed）。
    """
    rng = np.random.default_rng(seed)
    n = int(round(duration_sec * fs))
    t = np.arange(n) / fs
    freq = bpm / 60.0
    breathing = mod_depth * np.sin(2.0 * np.pi * freq * t)

    amp = np.empty((n, n_subcarriers), dtype=float)
    for k in range(n_subcarriers):
        carries = active_subcarriers is None or k in active_subcarriers
        gain = 1.0 if carries else 0.1
        dc = amp_base + rng.normal(0.0, 0.5)
        amp[:, k] = dc + gain * breathing + rng.normal(0.0, noise_std * amp_base, n)

    ts = start_epoch + t
    return ts, amp
