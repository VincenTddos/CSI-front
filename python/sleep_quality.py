#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sleep_quality.py — 睡眠品質 Lite（純軟體，輸入 = movement **score** 時序）。

資料契約：輸入是 core_bridge --record 的 {ts, score} 時序（約 10 Hz movement 分數，
0-100），**不是**原始 CSI。整夜一段，估算：
    - 入睡 / 起床時間、在床時間總長、總睡眠時長
    - 躁動指數 restlessness（睡眠時段內 MOTION 片段的頻率 + 能量）
    - 夜醒 / 起身次數（睡眠時段內的動作爆發）
    - 綜合睡眠品質分數 0-100（權重於 sleep_config.json，計分邏輯見 docs/sleep-breathing.md）

設計假設（誠實標註，見 docs）：
    - 單一占用者、夜間相對靜止；多人或寵物會污染判定。
    - movement 分數尺度為 0-100；門檻全部集中在 sleep_config.json。
    - 資料時長不足或找不到持續安靜時段 → 回傳 None 欄位 + reason（confidence="low"），
      **絕不**捏造數字（對應全域規則 1）。

此模組與前端 src/services/sleepService.ts 為同一演算法的兩個實作，
共用 sleep_config.json，並以 tests/fixtures 對拍保證一致。

CLI：
    python -m python.sleep_quality recording.jsonl [--json out.json]
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

import numpy as np

try:  # 同時支援「套件匯入」與「直接執行此檔」
    from .recording_io import load_score_recording
except ImportError:  # pragma: no cover - 直接執行 fallback
    from recording_io import load_score_recording  # type: ignore

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "sleep_config.json")


# --------------------------------------------------------------------------- #
#  設定
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class SleepConfig:
    bin_sec: int
    motion_score_threshold: float
    onset_quiet_motion_frac: float
    onset_persist_min: float
    awakening_score_threshold: float
    awakening_min_sec: float
    awakening_merge_gap_sec: float
    restless_energy_norm: float
    restless_w_time: float
    restless_w_energy: float
    ideal_sleep_min_lo: float
    ideal_sleep_min_hi: float
    efficiency_target: float
    awakening_penalty: float
    w_duration: float
    w_efficiency: float
    w_restlessness: float
    w_awakenings: float
    quality_labels: tuple
    min_record_min: float

    @classmethod
    def from_dict(cls, d: dict) -> "SleepConfig":
        return cls(
            bin_sec=int(d["bin_sec"]),
            motion_score_threshold=float(d["motion_score_threshold"]),
            onset_quiet_motion_frac=float(d["onset_quiet_motion_frac"]),
            onset_persist_min=float(d["onset_persist_min"]),
            awakening_score_threshold=float(d["awakening_score_threshold"]),
            awakening_min_sec=float(d["awakening_min_sec"]),
            awakening_merge_gap_sec=float(d["awakening_merge_gap_sec"]),
            restless_energy_norm=float(d["restless_energy_norm"]),
            restless_w_time=float(d["restless_w_time"]),
            restless_w_energy=float(d["restless_w_energy"]),
            ideal_sleep_min_lo=float(d["ideal_sleep_min_lo"]),
            ideal_sleep_min_hi=float(d["ideal_sleep_min_hi"]),
            efficiency_target=float(d["efficiency_target"]),
            awakening_penalty=float(d["awakening_penalty"]),
            w_duration=float(d["w_duration"]),
            w_efficiency=float(d["w_efficiency"]),
            w_restlessness=float(d["w_restlessness"]),
            w_awakenings=float(d["w_awakenings"]),
            quality_labels=tuple((float(t), str(lbl)) for t, lbl in d["quality_labels"]),
            min_record_min=float(d["min_record_min"]),
        )

    @classmethod
    def load(cls, path: str = _CONFIG_PATH) -> "SleepConfig":
        with open(path, encoding="utf-8") as fh:
            return cls.from_dict(json.load(fh))


# --------------------------------------------------------------------------- #
#  輸出報告
# --------------------------------------------------------------------------- #
@dataclass(frozen=True)
class SleepReport:
    sleep_onset: Optional[str]            # ISO8601；無法判定 -> None
    wake_time: Optional[str]              # ISO8601
    time_in_bed_min: Optional[float]
    total_sleep_min: Optional[float]
    restlessness_index: Optional[float]   # 0-1
    awakenings: int
    awakening_events: list               # [{"start","end","peak_score"}]
    sleep_score: Optional[int]            # 0-100
    score_breakdown: dict
    quality_label: Optional[str]
    confidence: str                       # "ok" | "low"
    reason: Optional[str]

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


def _low(reason: str) -> SleepReport:
    """資料不足/無法判定時的誠實降級輸出（規則 1：回 null + 原因，不捏造）。"""
    return SleepReport(
        sleep_onset=None, wake_time=None, time_in_bed_min=None, total_sleep_min=None,
        restlessness_index=None, awakenings=0, awakening_events=[], sleep_score=None,
        score_breakdown={}, quality_label=None, confidence="low", reason=reason,
    )


# --------------------------------------------------------------------------- #
#  小工具（與 TS 版 sleepService.ts 一一對應）
# --------------------------------------------------------------------------- #
def _iso(epoch_sec: float) -> str:
    """epoch 秒 -> ISO8601（毫秒精度 + 'Z'），與 JS Date.toISOString() 格式對齊。"""
    dt = datetime.fromtimestamp(epoch_sec, tz=timezone.utc)
    return dt.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _clip(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def _quiet_blocks(quiet: np.ndarray, min_len: int) -> list[tuple[int, int]]:
    """回傳所有長度 >= min_len 的「連續安靜」區塊 (start, end_exclusive)。"""
    blocks: list[tuple[int, int]] = []
    n = len(quiet)
    i = 0
    while i < n:
        if quiet[i]:
            j = i
            while j < n and quiet[j]:
                j += 1
            if (j - i) >= min_len:
                blocks.append((i, j))
            i = j
        else:
            i += 1
    return blocks


def _bursts(ts: np.ndarray, score: np.ndarray, thr: float,
            min_sec: float, merge_gap_sec: float) -> list[dict]:
    """偵測動作爆發：score 超過 thr 的原始區段，合併間隔 < merge_gap，
    再保留持續時間 >= min_sec 者。回傳 [{start_ts, end_ts, peak_score}]（epoch 秒）。
    """
    above = score > thr
    n = len(score)
    raw: list[list[float]] = []  # [start_ts, end_ts, peak]
    i = 0
    while i < n:
        if above[i]:
            j = i
            while j < n and above[j]:
                j += 1
            raw.append([float(ts[i]), float(ts[j - 1]), float(np.max(score[i:j]))])
            i = j
        else:
            i += 1

    merged: list[list[float]] = []
    for seg in raw:
        if merged and (seg[0] - merged[-1][1]) < merge_gap_sec:
            merged[-1][1] = seg[1]
            merged[-1][2] = max(merged[-1][2], seg[2])
        else:
            merged.append(list(seg))

    return [
        {"start_ts": m[0], "end_ts": m[1], "peak_score": m[2]}
        for m in merged
        if (m[1] - m[0]) >= min_sec
    ]


def _duration_sub(total_sleep_min: float, cfg: SleepConfig) -> float:
    lo, hi = cfg.ideal_sleep_min_lo, cfg.ideal_sleep_min_hi
    if total_sleep_min >= lo and total_sleep_min <= hi:
        return 100.0
    if total_sleep_min < lo:
        return _clip(total_sleep_min / lo * 100.0, 0.0, 100.0)
    return _clip(100.0 - (total_sleep_min - hi) / hi * 100.0, 0.0, 100.0)


def _quality_label(score: int, cfg: SleepConfig) -> str:
    for thr, label in cfg.quality_labels:  # 由高到低
        if score >= thr:
            return label
    return cfg.quality_labels[-1][1]


# --------------------------------------------------------------------------- #
#  主分析
# --------------------------------------------------------------------------- #
def analyze_sleep(ts: np.ndarray, score: np.ndarray,
                  cfg: Optional[SleepConfig] = None) -> SleepReport:
    """純函式、確定性。輸入 score 時序 -> SleepReport。門檻全來自 cfg。"""
    if cfg is None:
        cfg = SleepConfig.load()
    ts = np.asarray(ts, dtype=float)
    score = np.asarray(score, dtype=float)
    n = len(score)

    if n < 2 or len(ts) != n:
        return _low("資料不足：樣本數過少")

    span_min = (ts[-1] - ts[0]) / 60.0
    if span_min < cfg.min_record_min:
        return _low(f"資料時長約 {span_min:.0f} 分鐘，低於最低需求 {cfg.min_record_min:.0f} 分鐘")

    # ---- 1) 分箱（預設每分鐘）：mean_score 與 motion_frac ---- #
    t0 = float(ts[0])
    bin_sec = cfg.bin_sec
    nbins = int(np.floor((ts[-1] - t0) / bin_sec)) + 1
    idx = np.floor((ts - t0) / bin_sec).astype(int)
    idx = np.clip(idx, 0, nbins - 1)
    motion = (score > cfg.motion_score_threshold).astype(float)

    counts = np.zeros(nbins)
    motion_frac = np.zeros(nbins)
    np.add.at(counts, idx, 1.0)
    np.add.at(motion_frac, idx, motion)
    has = counts > 0
    motion_frac[has] /= counts[has]
    # 無資料的箱：視為安靜（夜間連續錄製時罕見）

    # ---- 2) 入睡/起床：找「持續安靜」區塊 ---- #
    persist_bins = max(1, int(round(cfg.onset_persist_min * 60.0 / bin_sec)))
    quiet = motion_frac < cfg.onset_quiet_motion_frac
    blocks = _quiet_blocks(quiet, persist_bins)
    if not blocks:
        return _low("未偵測到持續安靜時段（可能整夜未入睡、離床或訊號異常）")

    onset_ts = t0 + blocks[0][0] * bin_sec
    wake_ts = t0 + blocks[-1][1] * bin_sec
    if wake_ts <= onset_ts:
        return _low("睡眠時段無法界定（起床時間不晚於入睡時間）")
    time_in_bed_min = (wake_ts - onset_ts) / 60.0

    # ---- 3) 睡眠時段內的樣本 ---- #
    in_sleep = (ts >= onset_ts) & (ts < wake_ts)
    s_sleep = score[in_sleep]
    ts_sleep = ts[in_sleep]
    if len(s_sleep) < 2:
        return _low("睡眠時段樣本不足")

    # ---- 4) 夜醒/起身次數 ---- #
    events = _bursts(ts_sleep, s_sleep, cfg.awakening_score_threshold,
                     cfg.awakening_min_sec, cfg.awakening_merge_gap_sec)
    awakenings = len(events)
    awake_min = sum((e["end_ts"] - e["start_ts"]) for e in events) / 60.0
    total_sleep_min = max(0.0, time_in_bed_min - awake_min)

    # ---- 5) 躁動指數（時間佔比 + 能量） ---- #
    motion_time_frac = float(np.mean(s_sleep > cfg.motion_score_threshold))
    excess = np.clip(s_sleep - cfg.motion_score_threshold, 0.0, None)
    motion_energy = min(1.0, float(np.mean(excess)) / cfg.restless_energy_norm)
    restlessness = _clip(
        cfg.restless_w_time * motion_time_frac + cfg.restless_w_energy * motion_energy,
        0.0, 1.0,
    )

    # ---- 6) 綜合睡眠分數 ---- #
    dur_sub = _duration_sub(total_sleep_min, cfg)
    eff = total_sleep_min / time_in_bed_min if time_in_bed_min > 0 else 0.0
    eff_sub = _clip(eff / cfg.efficiency_target * 100.0, 0.0, 100.0)
    rest_sub = _clip((1.0 - restlessness) * 100.0, 0.0, 100.0)
    awk_sub = _clip(100.0 - awakenings * cfg.awakening_penalty, 0.0, 100.0)
    raw_score = (cfg.w_duration * dur_sub + cfg.w_efficiency * eff_sub
                 + cfg.w_restlessness * rest_sub + cfg.w_awakenings * awk_sub)
    sleep_score = int(round(_clip(raw_score, 0.0, 100.0)))

    score_breakdown = {
        "duration": {"weight": cfg.w_duration, "sub": round(dur_sub, 2)},
        "efficiency": {"weight": cfg.w_efficiency, "sub": round(eff_sub, 2)},
        "restlessness": {"weight": cfg.w_restlessness, "sub": round(rest_sub, 2)},
        "awakenings": {"weight": cfg.w_awakenings, "sub": round(awk_sub, 2)},
    }

    return SleepReport(
        sleep_onset=_iso(onset_ts),
        wake_time=_iso(wake_ts),
        time_in_bed_min=round(time_in_bed_min, 2),
        total_sleep_min=round(total_sleep_min, 2),
        restlessness_index=round(restlessness, 4),
        awakenings=awakenings,
        awakening_events=[
            {"start": _iso(e["start_ts"]), "end": _iso(e["end_ts"]),
             "peak_score": round(e["peak_score"], 2)}
            for e in events
        ],
        sleep_score=sleep_score,
        score_breakdown=score_breakdown,
        quality_label=_quality_label(sleep_score, cfg),
        confidence="ok",
        reason=None,
    )


def analyze_recording(path: str, cfg: Optional[SleepConfig] = None) -> SleepReport:
    ts, score = load_score_recording(path)
    return analyze_sleep(ts, score, cfg)


# --------------------------------------------------------------------------- #
#  CLI
# --------------------------------------------------------------------------- #
def main() -> None:
    ap = argparse.ArgumentParser(description="睡眠品質 Lite — 分析 {ts, score} 整夜錄製")
    ap.add_argument("recording", help="core_bridge --record 輸出的 jsonl")
    ap.add_argument("--json", dest="out", default=None, help="輸出報告到 JSON 檔")
    args = ap.parse_args()

    report = analyze_recording(args.recording)
    text = json.dumps(report.to_dict(), ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(text + "\n")
        print(f"已輸出睡眠報告：{args.out}")
    else:
        print(text)


if __name__ == "__main__":
    main()
