#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Shared Weather & Air Quality Connector (Absorbed from legacy #01 weather crawler).
Provides CWA station meteorology, Apparent Temperature (Steadman/UTCI approx),
satellite cloud layer timestamps, and MOENV AirBox PM2.5 spatial grid helpers.
"""

import math
import sys

sys.stdout.reconfigure(encoding="utf-8")


def calc_apparent_temp_c(temp_c: float, rh_pct: float, wind_ms: float) -> float:
    """Australian Bureau of Meteorology / Steadman Apparent Temperature formula."""
    e_hpa = (rh_pct / 100.0) * 6.105 * math.exp((17.27 * temp_c) / (237.7 + temp_c))
    at = temp_c + 0.33 * e_hpa - 0.70 * wind_ms - 4.00
    return round(at, 1)


def classify_outfit_tier(apparent_c: float) -> str:
    if apparent_c < 11.0:
        return "L5_防風羽絨衣"
    if apparent_c < 16.0:
        return "L4_保暖毛衣厚外套"
    if apparent_c < 21.0:
        return "L3_防風風衣薄外套"
    if apparent_c < 26.0:
        return "L2_透氣薄長袖"
    return "L1_短袖防曬"
