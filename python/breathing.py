#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""breathing.py — 呼吸率處理管線（原始 CSI → BPM）。

⚠️ 資料契約（**原始 CSI 流**，與 movement score 流不同）：
    輸入為 per-subcarrier 的 CSI **振幅**時序，封裝在 CsiFrame：
        CsiFrame.ts  : shape (n,)    每個封包的時間（epoch 秒）
        CsiFrame.amp : shape (n, k)  第 i 列為第 i 個封包、第 j 行為第 j 個子載波的振幅
    現有 core_bridge.py 只輸出 movement score，**拿不到**原始 CSI，故本管線
    刻意獨立設計、不綁 score 流。真實取得原始 CSI 的方式見 docs/sleep-breathing.md
    （需第二顆 ESP32-S3 燒 esp-csi / ESP32-CSI-Tool）。

管線：
    adapter 解析（複數 → 振幅） → Hampel 去離群（重用 csi_pipeline）
    → detrend → 子載波挑選（呼吸帶內 SNR 最高）
    → Butterworth 帶通 0.1-0.5 Hz → FFT 找峰（拋物線內插）+ 自相關交叉驗證
    → SNR/信心值 → 滑動視窗即時輸出

誠實標註（規則 1 + 5）：信心低於門檻 → bpm=None、status="unreliable" + reason，
**絕不**捏造數字。設計假設：人需相對靜止（大動作會污染呼吸訊號）、單人、近距離、
封包率穩定。

CLI：
    python -m python.breathing capture.csv [--format esp-csi-tool|esp-csi] [--stream]
"""

from __future__ import annotations

import argparse
import dataclasses
import json
import os
import re
import sys
from dataclasses import dataclass
from typing import Optional

import numpy as np
from scipy import signal as sp_signal

# 重用既有 csi_pipeline 的 Hampel（位於專案根）。
try:
    from csi_pipeline import hampel_filter
except ImportError:  # pragma: no cover - 確保套件匯入時也找得到專案根
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from csi_pipeline import hampel_filter

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "breathing_config.json")


# --------------------------------------------------------------------------- #
#  資料結構
# --------------------------------------------------------------------------- #
@dataclass
class CsiFrame:
    """原始 CSI 振幅輸入契約。ts:(n,) epoch 秒；amp:(n,k) 每列一封包、每行一子載波。"""
    ts: np.ndarray
    amp: np.ndarray

    def duration_sec(self) -> float:
        return float(self.ts[-1] - self.ts[0]) if len(self.ts) >= 2 else 0.0

    def estimate_fs(self, fallback: float) -> float:
        if len(self.ts) < 2:
            return fallback
        dt = np.diff(self.ts)
        dt = dt[dt > 0]
        if len(dt) == 0:
            return fallback
        return float(1.0 / np.median(dt))


@dataclass(frozen=True)
class BreathingConfig:
    fs_default: float
    band_lo_hz: float
    band_hi_hz: float
    butter_order: int
    hampel_window: int
    hampel_n_sigma: float
    window_sec: float
    hop_sec: float
    min_window_sec: float
    top_subcarriers: int
    min_confidence: float
    min_method_agreement: float
    agreement_tol_bpm: float
    snr_db_floor: float
    snr_db_ceil: float

    @classmethod
    def from_dict(cls, d: dict) -> "BreathingConfig":
        return cls(
            fs_default=float(d["fs_default"]),
            band_lo_hz=float(d["band_lo_hz"]),
            band_hi_hz=float(d["band_hi_hz"]),
            butter_order=int(d["butter_order"]),
            hampel_window=int(d["hampel_window"]),
            hampel_n_sigma=float(d["hampel_n_sigma"]),
            window_sec=float(d["window_sec"]),
            hop_sec=float(d["hop_sec"]),
            min_window_sec=float(d["min_window_sec"]),
            top_subcarriers=int(d["top_subcarriers"]),
            min_confidence=float(d["min_confidence"]),
            min_method_agreement=float(d["min_method_agreement"]),
            agreement_tol_bpm=float(d["agreement_tol_bpm"]),
            snr_db_floor=float(d["snr_db_floor"]),
            snr_db_ceil=float(d["snr_db_ceil"]),
        )

    @classmethod
    def load(cls, path: str = _CONFIG_PATH) -> "BreathingConfig":
        with open(path, encoding="utf-8") as fh:
            return cls.from_dict(json.load(fh))


@dataclass(frozen=True)
class BreathingEstimate:
    bpm: Optional[float]
    confidence: float                 # 0-1（源於帶內 SNR）
    status: str                       # "ok" | "unreliable"
    t_start: float
    t_end: float
    method_agreement: Optional[float]  # FFT 峰 vs 自相關 一致性 0-1
    n_subcarriers_used: int
    reason: Optional[str]

    def to_dict(self) -> dict:
        return dataclasses.asdict(self)


def _unreliable(t_start: float, t_end: float, reason: str,
                confidence: float = 0.0, agreement: Optional[float] = None,
                n_used: int = 0) -> BreathingEstimate:
    """信心不足 → 誠實回 unreliable（規則 1：不捏造 bpm）。"""
    return BreathingEstimate(
        bpm=None, confidence=round(confidence, 4), status="unreliable",
        t_start=t_start, t_end=t_end, method_agreement=agreement,
        n_subcarriers_used=n_used, reason=reason,
    )


# --------------------------------------------------------------------------- #
#  Adapter：原始 CSI 來源 → CsiFrame
# --------------------------------------------------------------------------- #
_BRACKET_RE = re.compile(r"\[([^\]]*)\]")


def _csi_ints_to_amplitude(ints: list[int]) -> Optional[np.ndarray]:
    """Espressif 慣例：陣列為 (imag, real) 交錯 int8。回傳每子載波振幅 sqrt(re^2+im^2)。"""
    if len(ints) < 2:
        return None
    arr = np.asarray(ints[: (len(ints) // 2) * 2], dtype=float)
    imag = arr[0::2]
    real = arr[1::2]
    return np.hypot(real, imag)


def _parse_csi_lines(text: str, ts_cols: tuple[str, ...],
                     fs_fallback: float) -> CsiFrame:
    """通用 CSI CSV 解析核心：抓每行括號內的 int 陣列 → 振幅；時間取 ts_cols 第一個可用欄。

    只保留「子載波數 = 眾數」的列，組成矩形 amp 矩陣（不同 PHY 模式長度不同會被濾除）。
    若無時間欄，依索引用 fs_fallback 合成時間。
    """
    lines = text.splitlines()
    header_map: dict[str, int] = {}
    rows: list[tuple[Optional[float], np.ndarray]] = []

    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        # header
        if not header_map and ("CSI_DATA" in line and "[" not in line):
            cols = [c.strip().lower() for c in line.split(",")]
            header_map = {name: i for i, name in enumerate(cols)}
            continue

        m = _BRACKET_RE.search(line)
        if not m:
            continue
        try:
            ints = [int(x) for x in m.group(1).split()]
        except ValueError:
            continue
        amp = _csi_ints_to_amplitude(ints)
        if amp is None:
            continue

        ts_val: Optional[float] = None
        if header_map:
            fields = line.split(",")
            for cname in ts_cols:
                ci = header_map.get(cname)
                if ci is not None and ci < len(fields):
                    try:
                        ts_val = float(fields[ci])
                        break
                    except ValueError:
                        continue
        rows.append((ts_val, amp))

    if not rows:
        raise ValueError("找不到任何可解析的 CSI 資料列（檢查格式 / 括號陣列）。")

    # 取子載波數眾數，組矩形矩陣
    lengths = [len(a) for _, a in rows]
    modal = int(np.bincount(lengths).argmax())
    kept = [(t, a) for (t, a) in rows if len(a) == modal]
    amp = np.vstack([a for _, a in kept])

    ts_vals = [t for t, _ in kept]
    if all(t is not None for t in ts_vals) and len(ts_vals) >= 2:
        ts = np.asarray(ts_vals, dtype=float)
        # local_timestamp 常為微秒/毫秒；若量級過大則正規化成秒
        if np.median(np.diff(ts)) > 1e3:
            ts = (ts - ts[0]) / 1e6
    else:
        ts = np.arange(len(kept), dtype=float) / fs_fallback

    return CsiFrame(ts=ts, amp=amp)


def parse_esp_csi_tool_csv(source: str, fs_fallback: float = 20.0) -> CsiFrame:
    """ESP32-CSI-Tool CSV（含 header、CSI_DATA 欄為括號 int8 交錯陣列）。source 可為路徑或字串。"""
    text = _read(source)
    return _parse_csi_lines(text, ts_cols=("real_timestamp", "local_timestamp"),
                            fs_fallback=fs_fallback)


def parse_esp_csi_csv(source: str, fs_fallback: float = 20.0) -> CsiFrame:
    """Espressif esp-csi 主控台輸出變體（CSI_DATA 起頭、括號陣列在行末）。"""
    text = _read(source)
    return _parse_csi_lines(text, ts_cols=("timestamp", "local_timestamp"),
                            fs_fallback=fs_fallback)


def _read(source: str) -> str:
    if "\n" in source or "[" in source:  # 已經是內容字串
        return source
    with open(source, encoding="utf-8") as fh:
        return fh.read()


# --------------------------------------------------------------------------- #
#  DSP
# --------------------------------------------------------------------------- #
def _butter_bandpass(x: np.ndarray, lo: float, hi: float, fs: float,
                     order: int) -> np.ndarray:
    nyq = fs / 2.0
    lo_n = max(1e-6, lo / nyq)
    hi_n = min(0.999999, hi / nyq)
    b, a = sp_signal.butter(order, [lo_n, hi_n], btype="band")  # type: ignore[misc]
    return sp_signal.filtfilt(b, a, x)


def _inband_power_ratio(x: np.ndarray, fs: float, lo: float, hi: float) -> float:
    """帶內功率 / 總功率（去 DC）。用於子載波挑選與信心。"""
    f, pxx = sp_signal.periodogram(x, fs=fs)
    total = pxx[f > 0].sum() + 1e-12
    band = pxx[(f >= lo) & (f <= hi)].sum()
    return float(band / total)


def _snr_db_inband(x: np.ndarray, fs: float, lo: float, hi: float) -> tuple[float, float]:
    """回傳 (snr_db, peak_freq_hz)：帶內峰值功率 vs 帶外中位數雜訊。"""
    f, pxx = sp_signal.periodogram(x, fs=fs)
    band = (f >= lo) & (f <= hi)
    if not np.any(band):
        return -np.inf, 0.0
    peak_idx_in_band = np.argmax(pxx[band])
    peak_power = pxx[band][peak_idx_in_band]
    peak_freq = f[band][peak_idx_in_band]
    out = pxx[(f > 0) & (~band)]
    noise = np.median(out) if len(out) else (pxx[f > 0].mean() + 1e-12)
    snr = peak_power / (noise + 1e-12)
    return 10.0 * np.log10(snr + 1e-12), float(peak_freq)


def _fft_bpm(x: np.ndarray, fs: float, lo: float, hi: float) -> Optional[float]:
    """FFT 找帶內峰 + 拋物線內插取得 sub-bin 頻率 → BPM。"""
    f, pxx = sp_signal.periodogram(x, fs=fs)
    band = (f >= lo) & (f <= hi)
    if not np.any(band):
        return None
    band_idx = np.where(band)[0]
    local = int(np.argmax(pxx[band_idx]))
    k = band_idx[local]
    # 拋物線內插（需左右鄰點）
    if 1 <= k < len(pxx) - 1:
        a, b, c = pxx[k - 1], pxx[k], pxx[k + 1]
        denom = (a - 2 * b + c)
        delta = 0.5 * (a - c) / denom if abs(denom) > 1e-12 else 0.0
        delta = float(np.clip(delta, -0.5, 0.5))
    else:
        delta = 0.0
    df = f[1] - f[0]
    peak_freq = f[k] + delta * df
    return float(peak_freq * 60.0)


def _acf_bpm(x: np.ndarray, fs: float, lo: float, hi: float) -> Optional[float]:
    """自相關：在呼吸週期範圍內找第一個顯著峰 → BPM（交叉驗證）。"""
    x = x - np.mean(x)
    if np.allclose(x, 0):
        return None
    corr = np.correlate(x, x, mode="full")[len(x) - 1:]
    lag_min = int(np.floor(fs / hi))   # 最高頻 → 最短週期 → 最小 lag
    lag_max = int(np.ceil(fs / lo))    # 最低頻 → 最長週期 → 最大 lag
    lag_max = min(lag_max, len(corr) - 1)
    if lag_min < 1 or lag_max <= lag_min:
        return None
    seg = corr[lag_min:lag_max + 1]
    best = int(np.argmax(seg)) + lag_min
    if best <= 0:
        return None
    return float(60.0 * fs / best)


# --------------------------------------------------------------------------- #
#  主估算
# --------------------------------------------------------------------------- #
def estimate_bpm(frame: CsiFrame, cfg: Optional[BreathingConfig] = None) -> BreathingEstimate:
    """對整段 CsiFrame 估算呼吸 BPM。純函式、確定性。"""
    if cfg is None:
        cfg = BreathingConfig.load()
    n = len(frame.ts)
    t_start = float(frame.ts[0]) if n else 0.0
    t_end = float(frame.ts[-1]) if n else 0.0

    if n < 4 or frame.amp.ndim != 2:
        return _unreliable(t_start, t_end, "資料樣本過少")

    fs = frame.estimate_fs(cfg.fs_default)
    dur = frame.duration_sec()
    if dur < cfg.min_window_sec:
        return _unreliable(t_start, t_end,
                           f"視窗 {dur:.0f}s < 最低 {cfg.min_window_sec:.0f}s（解析度不足）")

    # 前處理 + 子載波評分
    k = frame.amp.shape[1]
    processed: list[np.ndarray] = []
    ratios: list[float] = []
    for j in range(k):
        col = frame.amp[:, j].astype(float)
        if np.std(col) < 1e-9:
            processed.append(None)  # type: ignore[arg-type]
            ratios.append(-1.0)
            continue
        col = hampel_filter(col, window=cfg.hampel_window, n_sigma=cfg.hampel_n_sigma)
        col = sp_signal.detrend(col, type="linear")
        processed.append(col)
        ratios.append(_inband_power_ratio(col, fs, cfg.band_lo_hz, cfg.band_hi_hz))

    order = np.argsort(ratios)[::-1]
    chosen = [int(j) for j in order if ratios[j] > 0][: max(1, cfg.top_subcarriers)]
    if not chosen:
        return _unreliable(t_start, t_end, "找不到帶內有效週期性的子載波（可能無人或大動作干擾）")

    # 合成：對選中子載波帶通後 z-score 平均，增強共同的呼吸成分
    stacked = []
    for j in chosen:
        bp = _butter_bandpass(processed[j], cfg.band_lo_hz, cfg.band_hi_hz, fs, cfg.butter_order)
        sd = np.std(bp)
        if sd > 1e-9:
            stacked.append(bp / sd)
    if not stacked:
        return _unreliable(t_start, t_end, "帶通後訊號能量過低", n_used=len(chosen))
    sig = np.mean(np.vstack(stacked), axis=0)

    # 估算
    snr_db, _peak_f = _snr_db_inband(sig, fs, cfg.band_lo_hz, cfg.band_hi_hz)
    confidence = float(np.clip(
        (snr_db - cfg.snr_db_floor) / (cfg.snr_db_ceil - cfg.snr_db_floor), 0.0, 1.0))

    bpm_fft = _fft_bpm(sig, fs, cfg.band_lo_hz, cfg.band_hi_hz)
    bpm_acf = _acf_bpm(sig, fs, cfg.band_lo_hz, cfg.band_hi_hz)

    agreement: Optional[float] = None
    if bpm_fft is not None and bpm_acf is not None:
        agreement = float(np.clip(
            1.0 - abs(bpm_fft - bpm_acf) / cfg.agreement_tol_bpm, 0.0, 1.0))

    if bpm_fft is None:
        return _unreliable(t_start, t_end, "帶內無峰值", confidence, agreement, len(chosen))
    if confidence < cfg.min_confidence:
        return _unreliable(t_start, t_end,
                           f"信心不足（SNR {snr_db:.1f} dB）", confidence, agreement, len(chosen))
    if agreement is not None and agreement < cfg.min_method_agreement:
        return _unreliable(t_start, t_end,
                           f"FFT 與自相關不一致（{bpm_fft:.1f} vs {bpm_acf:.1f} BPM）",
                           confidence, agreement, len(chosen))

    return BreathingEstimate(
        bpm=round(bpm_fft, 2),
        confidence=round(confidence, 4),
        status="ok",
        t_start=t_start, t_end=t_end,
        method_agreement=None if agreement is None else round(agreement, 4),
        n_subcarriers_used=len(chosen),
        reason=None,
    )


def estimate_bpm_stream(frame: CsiFrame,
                        cfg: Optional[BreathingConfig] = None) -> list[BreathingEstimate]:
    """滑動視窗即時輸出：每 hop_sec 推進，視窗長 window_sec。回傳每窗一個估計。"""
    if cfg is None:
        cfg = BreathingConfig.load()
    n = len(frame.ts)
    if n < 4:
        return [_unreliable(
            float(frame.ts[0]) if n else 0.0, float(frame.ts[-1]) if n else 0.0,
            "資料樣本過少")]

    fs = frame.estimate_fs(cfg.fs_default)
    win = max(1, int(round(cfg.window_sec * fs)))
    hop = max(1, int(round(cfg.hop_sec * fs)))
    out: list[BreathingEstimate] = []
    start = 0
    while start + win <= n:
        sub = CsiFrame(ts=frame.ts[start:start + win], amp=frame.amp[start:start + win])
        out.append(estimate_bpm(sub, cfg))
        start += hop
    if not out:  # 整段比一個視窗短 → 用整段估一次
        out.append(estimate_bpm(frame, cfg))
    return out


# --------------------------------------------------------------------------- #
#  CLI
# --------------------------------------------------------------------------- #
def main() -> None:
    ap = argparse.ArgumentParser(description="呼吸率管線 — 原始 CSI → BPM")
    ap.add_argument("capture", help="CSI CSV（ESP32-CSI-Tool / esp-csi）")
    ap.add_argument("--format", choices=["esp-csi-tool", "esp-csi"], default="esp-csi-tool")
    ap.add_argument("--stream", action="store_true", help="滑動視窗輸出（預設整段一次）")
    args = ap.parse_args()

    parse = parse_esp_csi_tool_csv if args.format == "esp-csi-tool" else parse_esp_csi_csv
    frame = parse(args.capture)
    cfg = BreathingConfig.load()
    if args.stream:
        result = [e.to_dict() for e in estimate_bpm_stream(frame, cfg)]
    else:
        result = estimate_bpm(frame, cfg).to_dict()
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
