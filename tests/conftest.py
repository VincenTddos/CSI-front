# -*- coding: utf-8 -*-
"""pytest 設定：把專案根與 python/ 放進 sys.path。

讓測試可用 `from python.sleep_quality import ...`、`from tests.synth import ...`
以及重用既有 `from csi_pipeline import ...`（位於專案根）。
"""

import os
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (_ROOT, os.path.join(_ROOT, "python")):
    if p not in sys.path:
        sys.path.insert(0, p)
