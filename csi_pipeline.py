#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
csi_pipeline.py — Wi-Care CSI 訊號處理管線示範

處理鏈：原始 CSI 振幅序列
        → Hampel 過濾 (去離群值)
        → Butterworth 低通 (去高頻雜訊)
        → 特徵萃取 (方差 / 能量 / 峰均比 / 頻譜熵)
        → STFT 時頻分析 (跌倒 vs 行走的頻譜特徵)

依賴：pip install numpy scipy matplotlib
用法：python csi_pipeline.py recording.jsonl   # 處理 core_bridge --record 的輸出
      python csi_pipeline.py --demo            # 用合成資料示範
"""

import json
import sys

import numpy as np
from scipy import signal as sp_signal

FS = 10.0  # 取樣率 (Hz) — 對應 core_bridge 10Hz 推播


# --------------------------------------------------------------------------- #
#  1. Hampel 過濾器 — 以滑動視窗中位數 + MAD 剔除離群值
# --------------------------------------------------------------------------- #
def hampel_filter(x: np.ndarray, window: int = 7, n_sigma: float = 3.0) -> np.ndarray:
    """對一維序列做 Hampel 過濾，離群點以視窗中位數取代。"""
    x = np.asarray(x, dtype=float)
    out = x.copy()
    k = 1.4826  # MAD → std 的尺度因子 (常態分布)
    half = window // 2
    for i in range(half, len(x) - half):
        seg = x[i - half: i + half + 1]
        med = np.median(seg)
        mad = k * np.median(np.abs(seg - med))
        if mad > 0 and abs(x[i] - med) > n_sigma * mad:
            out[i] = med
    return out


# --------------------------------------------------------------------------- #
#  2. Butterworth 低通 — 人體動作能量主要在 0–5Hz，濾掉高頻電氣雜訊
# --------------------------------------------------------------------------- #
def butterworth_lowpass(x: np.ndarray, cutoff_hz: float = 3.0,
                        fs: float = FS, order: int = 4) -> np.ndarray:
    nyq = fs / 2.0
    # scipy 型別存根對 butter 回傳值定義過寬（重載未依 output 區分）；預設 output='ba' 即 (b, a)
    b, a = sp_signal.butter(order, cutoff_hz / nyq, btype="low")  # type: ignore[misc]
    return sp_signal.filtfilt(b, a, x)  # filtfilt: 零相位，不造成時間偏移


# --------------------------------------------------------------------------- #
#  3. 特徵萃取 — 每個時間窗算 4 個統計特徵
# --------------------------------------------------------------------------- #
def extract_features(x: np.ndarray, win_sec: float = 2.0, fs: float = FS) -> list:
    """滑動視窗特徵：方差、能量、峰均比、頻譜熵。"""
    win = max(2, int(win_sec * fs))
    feats = []
    for start in range(0, len(x) - win + 1, max(1, win // 2)):  # 50% overlap
        seg = x[start: start + win]
        # 頻譜熵：活動越規律 (走路) 熵越低，越突發 (跌倒) 熵越高
        f, pxx = sp_signal.periodogram(seg, fs=fs)
        p = pxx / (pxx.sum() + 1e-12)
        spectral_entropy = float(-(p * np.log2(p + 1e-12)).sum())
        feats.append({
            "t_start": start / fs,
            "variance": float(np.var(seg)),
            "energy":   float(np.mean(seg ** 2)),
            "crest":    float(np.max(np.abs(seg)) / (np.sqrt(np.mean(seg ** 2)) + 1e-12)),
            "spectral_entropy": spectral_entropy,
        })
    return feats


# --------------------------------------------------------------------------- #
#  4. STFT 時頻圖 — 跌倒在時頻圖上呈現「短暫、寬頻」的能量爆發
# --------------------------------------------------------------------------- #
def stft_spectrogram(x: np.ndarray, fs: float = FS):
    nperseg = min(len(x), int(fs * 2))
    noverlap = int(nperseg * 0.75)
    f, t, zxx = sp_signal.stft(x, fs=fs, nperseg=nperseg, noverlap=noverlap)
    return f, t, np.abs(zxx)


# --------------------------------------------------------------------------- #
#  合成示範資料：行走 (週期性) + 跌倒 (突發尖峰) + 靜止
# --------------------------------------------------------------------------- #
def make_demo_signal(duration_sec: float = 60.0, fs: float = FS) -> np.ndarray:
    n = int(duration_sec * fs)
    t = np.arange(n) / fs
    sig = 5.0 + np.random.normal(0, 1.0, n)                       # 環境噪聲
    walk = (t > 10) & (t < 30)
    sig[walk] += 12 * np.abs(np.sin(2 * np.pi * 1.2 * t[walk]))   # 行走 ~1.2Hz
    fall_idx = int(45 * fs)
    sig[fall_idx: fall_idx + int(0.8 * fs)] += 60.0              # 跌倒：0.8 秒爆發
    sig[fall_idx + int(0.8 * fs): fall_idx + int(6 * fs)] = 3.0  # 跌倒後靜止
    return sig


def load_recording(path: str) -> np.ndarray:
    """讀取 core_bridge --record 輸出的 jsonl (每行一筆 {ts, score})。"""
    scores = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            try:
                scores.append(float(json.loads(line)["score"]))
            except (KeyError, ValueError, json.JSONDecodeError):
                continue
    return np.array(scores)


def main():
    if len(sys.argv) > 1 and sys.argv[1] != "--demo":
        raw = load_recording(sys.argv[1])
        print(f"已載入 {len(raw)} 筆樣本 ({len(raw)/FS:.0f} 秒)")
    else:
        raw = make_demo_signal()
        print("使用合成示範資料 (60 秒：噪聲 → 行走 → 跌倒 → 靜止)")

    if len(raw) < int(FS * 2):
        print("樣本數不足，至少需要 2 秒資料。")
        return

    # ---- 處理鏈 ---- #
    step1 = hampel_filter(raw)
    step2 = butterworth_lowpass(step1)
    feats = extract_features(step2)
    f, t, sxx = stft_spectrogram(step2)

    # ---- 輸出特徵摘要 ---- #
    print(f"\n特徵視窗數：{len(feats)}")
    if feats:
        peak = max(feats, key=lambda d: d["energy"])
        print(f"能量最大視窗：t={peak['t_start']:.1f}s  "
              f"energy={peak['energy']:.1f}  crest={peak['crest']:.2f}  "
              f"entropy={peak['spectral_entropy']:.2f}")

    # ---- 畫圖 (報告用三聯圖) ---- #
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("\n未安裝 matplotlib，略過繪圖 (pip install matplotlib)。")
        return

    matplotlib.rcParams["font.sans-serif"] = ["Microsoft JhengHei", "PingFang TC",
                                              "Noto Sans CJK TC", "sans-serif"]
    matplotlib.rcParams["axes.unicode_minus"] = False

    fig, axes = plt.subplots(3, 1, figsize=(12, 10))
    tx = np.arange(len(raw)) / FS
    axes[0].plot(tx, raw, alpha=0.4, label="原始")
    axes[0].plot(tx, step2, label="Hampel + Butterworth")
    axes[0].set_title("CSI 移動分數：去噪前後")
    axes[0].set_xlabel("時間 (s)"); axes[0].legend()

    ft = [d["t_start"] for d in feats]
    axes[1].plot(ft, [d["variance"] for d in feats], label="方差")
    axes[1].plot(ft, [d["spectral_entropy"] for d in feats], label="頻譜熵")
    axes[1].set_title("滑動視窗特徵"); axes[1].set_xlabel("時間 (s)"); axes[1].legend()

    axes[2].pcolormesh(t, f, sxx, shading="gouraud")
    axes[2].set_title("STFT 時頻圖 — 跌倒呈現短暫寬頻能量爆發")
    axes[2].set_xlabel("時間 (s)"); axes[2].set_ylabel("頻率 (Hz)")

    plt.tight_layout()
    plt.savefig("csi_pipeline_output.png", dpi=150)
    print("\n圖已輸出：csi_pipeline_output.png")


if __name__ == "__main__":
    main()
