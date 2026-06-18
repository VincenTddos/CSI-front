#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""recording_io.py — movement **score** 錄製檔讀取（單一真相）。

資料契約（**score 流**，非原始 CSI）：
    core_bridge.py --record 以每行一筆 jsonl 寫入：
        {"ts": "<ISO8601 UTC>", "score": <float 0-100>}
    參見 core_bridge.py 中 RECORD_FILE 的寫入點。

這裡讀出的是「movement 分數」純量時序（約 10 Hz），**不是** per-subcarrier 的
原始 CSI 振幅。原始 CSI 流請見 breathing.py 的 CsiFrame 契約。
"""

from __future__ import annotations

import json
from datetime import datetime

import numpy as np


def _parse_ts(value) -> float:
    """把 ts 欄位轉成 epoch 秒（float）。接受 ISO8601（含 Z 或 offset）或數字。"""
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    return datetime.fromisoformat(s).timestamp()


def load_score_recording(path: str) -> tuple[np.ndarray, np.ndarray]:
    """讀取 {ts, score} jsonl，回傳 (ts_epoch_sec, score)。

    壞行（缺欄位 / 非法 JSON / 無法解析時間）會被略過，不中斷讀取。
    回傳兩個等長的 1D float ndarray。
    """
    ts_list: list[float] = []
    score_list: list[float] = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                t = _parse_ts(obj["ts"])
                s = float(obj["score"])
            except (KeyError, ValueError, TypeError, json.JSONDecodeError):
                continue
            ts_list.append(t)
            score_list.append(s)
    return np.asarray(ts_list, dtype=float), np.asarray(score_list, dtype=float)
