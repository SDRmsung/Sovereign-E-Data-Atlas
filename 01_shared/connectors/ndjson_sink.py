#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared Gzip NDJSON Time-Series Appender & Zero-CORS Feed Exporter."""

import gzip
import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")


def write_dual_feed(app_dir: Path, snapshot: dict, global_alias: str | None = None) -> Path:
    feed_dir = app_dir / "feed"
    feed_dir.mkdir(parents=True, exist_ok=True)
    date_key = snapshot.get("date_key", "latest")

    ndjson_gz = feed_dir / f"snapshots_{date_key}.ndjson.gz"
    with gzip.open(ndjson_gz, "at", encoding="utf-8") as gz:
        gz.write(json.dumps(snapshot, ensure_ascii=False) + "\n")

    json_str = json.dumps(snapshot, ensure_ascii=False, indent=2)
    (feed_dir / "latest_frame.json").write_text(json_str, encoding="utf-8")

    alias_assign = f"window.{global_alias} = " if global_alias else ""
    js_code = f"// Auto-generated Zero-CORS Feed\nwindow.A23_FEED = {alias_assign}{json_str};\n"
    js_path = feed_dir / "latest_frame.js"
    js_path.write_text(js_code, encoding="utf-8")
    return js_path
