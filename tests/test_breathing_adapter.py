# -*- coding: utf-8 -*-
"""CSI adapter 測試：ESP32-CSI-Tool / esp-csi CSV → CsiFrame（已知答案）。"""

import math

import numpy as np

from python.breathing import parse_esp_csi_tool_csv, parse_esp_csi_csv

# ESP32-CSI-Tool 標準欄位（最後一欄 CSI_DATA 為括號內 int8 交錯陣列）
_HEADER = ("type,role,mac,rssi,rate,sig_mode,mcs,bandwidth,smoothing,not_sounding,"
           "aggregation,stbc,fec_coding,sgi,noise_floor,ampdu_cnt,channel,"
           "secondary_channel,local_timestamp,ant,sig_len,rx_state,real_time_set,"
           "real_timestamp,len,CSI_DATA")

# 交錯 (imag, real)：(3,4)->5, (0,5)->5, (6,8)->10, (5,12)->13
_INTS = "3 4 0 5 6 8 5 12"
_EXPECTED_AMP = [5.0, 5.0, 10.0, 13.0]


def _row(real_ts: float) -> str:
    # 對齊 header 欄位數；只有 real_timestamp 與 CSI_DATA 內容重要，其餘填佔位
    fields = ["CSI_DATA", "STA", "aa:bb:cc:dd:ee:ff", "-40", "11", "1", "7", "0",
              "1", "0", "0", "0", "0", "1", "-94", "0", "6", "1",
              "123456", "0", "128", "0", "1", f"{real_ts:.3f}", "8", f"[{_INTS}]"]
    return ",".join(fields)


def test_parse_esp_csi_tool_amplitude_and_shape():
    n = 40
    lines = [_HEADER] + [_row(1000.0 + i * 0.05) for i in range(n)]  # 20 Hz
    frame = parse_esp_csi_tool_csv("\n".join(lines))

    assert frame.amp.shape == (n, 4)
    assert np.allclose(frame.amp[0], _EXPECTED_AMP)
    assert np.allclose(frame.amp[-1], _EXPECTED_AMP)
    # real_timestamp 為秒，fs 應約 20 Hz
    assert math.isclose(frame.estimate_fs(20.0), 20.0, rel_tol=0.05)


def test_parse_filters_inconsistent_subcarrier_counts():
    """不同 PHY 模式（子載波數不同）的列應被濾除，只留眾數長度，組成矩形矩陣。"""
    n_good = 30
    lines = [_HEADER] + [_row(1000.0 + i * 0.05) for i in range(n_good)]
    # 插入 2 列長度不同（6 個 int = 3 子載波）的雜訊列
    odd = _row(0).replace(f"[{_INTS}]", "[1 1 2 2 3 3]")
    lines.insert(5, odd)
    lines.insert(10, odd)
    frame = parse_esp_csi_tool_csv("\n".join(lines))
    assert frame.amp.shape == (n_good, 4)   # 4 子載波（眾數），雜訊列被丟棄


def test_parse_esp_csi_no_header_uses_fallback_fs():
    """esp-csi 變體：無 header → 依索引用 fallback fs 合成時間。"""
    lines = [f"CSI_DATA,{i},aa:bb,-50,11,[{_INTS}]" for i in range(50)]
    frame = parse_esp_csi_csv("\n".join(lines), fs_fallback=25.0)
    assert frame.amp.shape == (50, 4)
    assert np.allclose(frame.amp[0], _EXPECTED_AMP)
    assert math.isclose(frame.estimate_fs(25.0), 25.0, rel_tol=0.05)
