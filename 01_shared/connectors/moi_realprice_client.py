#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared MOI Real-Price Transaction & Rental Normalizer (for s09 Vacancy Rent & s11 Flood Scar)."""

import csv
import sys

sys.stdout.reconfigure(encoding="utf-8")
csv.field_size_limit(2147483647)

PING_PER_SQM = 0.3025


def sqm_to_ping_price(total_ntd: float, area_sqm: float) -> float:
    ping = area_sqm * PING_PER_SQM
    if ping <= 0:
        return 0.0
    return round(total_ntd / ping, 1)
