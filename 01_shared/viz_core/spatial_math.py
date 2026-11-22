#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared Deterministic Spatial & Statistical Operators for A23 Topics (s01-s12)."""

import math
import sys

sys.stdout.reconfigure(encoding="utf-8")


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * max(0.0, min(1.0, t))


def haversine_km(lon1: float, lat1: float, lon2: float, lat2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def did_estimator(pre_treat: float, post_treat: float, pre_ctrl: float, post_ctrl: float) -> float:
    """Difference-in-Differences (DID) scar estimator for s11_flood_scar."""
    return round((post_treat - pre_treat) - (post_ctrl - pre_ctrl), 4)
