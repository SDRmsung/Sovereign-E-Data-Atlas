#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pipeline for s04_freeway_rest: (傳) 國道服務區滯留
模式：
  live   讀 sources.json 的 parking 來源（AGY 探測後填入），source_mode=LIVE
  sample 無真實來源時的示意資料，source_mode=SYNTHETIC_DEMO（頁面會明確標示，不可當真實資料）
  auto   有 parking.url 就 live，失敗退 sample 並寫 fallback_reason
"""
import argparse
import gzip
import json
import math
import sys
import urllib.request
import zlib
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

APP_DIR = Path(__file__).resolve().parent
SHARED_DIR = APP_DIR.parent / "01_shared"
if str(SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR))

from connectors.ndjson_sink import write_dual_feed  # noqa: E402

TZ_TW = timezone(timedelta(hours=8))
FULL_TH, BUSY_TH = 0.95, 0.80


def load_json(name: str) -> dict:
    return json.loads((APP_DIR / name).read_text(encoding="utf-8"))


def state_of(fill: float) -> str:
    return "FULL" if fill >= FULL_TH else "BUSY" if fill >= BUSY_TH else "OK"


# ---------- sample（示意）----------
def synth_fill(sa: dict, hour: float, holiday: bool) -> float:
    seed = zlib.crc32(sa["id"].encode())
    base = 0.50 + (seed % 25) / 100            # 0.50–0.74
    curve = 0.25 + 0.75 * math.exp(-(((hour - 12.5) / 3.6) ** 2))  # 中午高峰
    if holiday:
        curve = min(1.2, curve * 1.25 + 0.1)
    v = (base + sa.get("hot", 0.0)) * curve
    return round(max(0.03, min(1.0, v)), 3)


def build_sample(areas: list, hour: float, holiday: bool) -> tuple[list, dict]:
    cur = [synth_fill(a, hour, holiday) for a in areas]
    frames = {str(h): [synth_fill(a, h, holiday) for a in areas] for h in range(24)}
    return cur, frames


# ---------- live ----------
def fetch_json(url: str, timeout: int = 15):
    req = urllib.request.Request(url, headers={"User-Agent": "A23-Crawler/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return json.loads(raw.decode("utf-8-sig"))


def dig(obj, path: str):
    for k in [p for p in path.split(".") if p != ""]:
        obj = obj[int(k)] if isinstance(obj, list) else obj[k]
    return obj


def norm(s: str) -> str:
    return str(s).replace("服務區", "").replace("休息站", "").strip()


LIGHT_FILL = {"green": 0.4, "綠": 0.4, "orange": 0.8, "橙": 0.8, "yellow": 0.8, "red": 1.0, "紅": 1.0}


def build_live(areas: list, src: dict) -> list:
    if not src.get("url"):
        raise RuntimeError("sources.json parking.url 為空（尚未探測）")
    rows = dig(fetch_json(src["url"]), src.get("list_path", ""))
    by_name = {norm(r[src["name_key"]]): r for r in rows}
    out = []
    for a in areas:
        r = by_name.get(norm(a["name"]))
        if r is None:
            out.append(None)
            continue
        if src.get("light_key"):
            out.append(LIGHT_FILL.get(str(r[src["light_key"]]).strip().lower()))
        else:
            tot, free = float(r[src["total_key"]]), float(r[src["free_key"]])
            out.append(round(max(0.0, min(1.0, 1 - free / tot)), 3) if tot > 0 else None)
    if all(v is None for v in out):
        raise RuntimeError("live 來源無任何服務區對上名稱")
    return out


def run_once(mode: str = "auto", hour: float | None = None, holiday: bool = False) -> dict:
    now = datetime.now(TZ_TW)
    sa_doc = load_json("service_areas.json")
    areas = sa_doc["areas"]
    hr = now.hour + now.minute / 60 if hour is None else hour
    fills, frames, source_mode, reason = None, None, "SYNTHETIC_DEMO", None
    if mode in ("live", "auto"):
        try:
            fills = build_live(areas, load_json("sources.json").get("parking", {}))
            source_mode = "LIVE"
        except Exception as e:  # noqa: BLE001
            reason = f"{type(e).__name__}: {e}"
            if mode == "live":
                raise
    if fills is None:
        fills, frames = build_sample(areas, hr, holiday)

    items = []
    for a, f in zip(areas, fills):
        items.append({"id": a["id"], "name": a["name"], "hwy": a["hwy"], "lon": a["lon"], "lat": a["lat"],
                      "fill": f, "state": state_of(f) if f is not None else "NA"})
    valid = [i for i in items if i["fill"] is not None]
    top = max(valid, key=lambda i: i["fill"])
    n_full = sum(1 for i in valid if i["state"] == "FULL")
    lons, lats = [i["lon"] for i in items], [i["lat"] for i in items]
    snapshot = {
        "schema": "a23.s04_freeway_rest.feed.v2",
        "topic_id": "s04_freeway_rest",
        "title": "國道服務區滯留",
        "category": "傳",
        "granularity": "分鐘級（1 至 5 分鐘更新）",
        "captured_at": now.isoformat(timespec="seconds"),
        "date_key": now.strftime("%Y%m%d"),
        "source_mode": source_mode,
        "fallback_reason": reason,
        "coord_status": sa_doc.get("coord_status", "unknown"),
        "demo_hour": None if source_mode == "LIVE" else hr,
        "bounds": {"minLon": min(lons), "maxLon": max(lons), "minLat": min(lats), "maxLat": max(lats)},
        "thresholds": {"busy": BUSY_TH, "full": FULL_TH},
        "areas": items,
        "frames": frames,
        "kpi": {
            "監測服務區": f"{len(valid)} 站",
            "最高滿載率": f"{top['name']} {round(top['fill'] * 100)}%",
            "平均滿載率": f"{round(sum(i['fill'] for i in valid) / len(valid) * 100)}%",
            "額滿警戒": f"{n_full} 站",
        },
    }
    write_dual_feed(APP_DIR, snapshot)
    return snapshot


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["auto", "live", "sample"], default="auto")
    ap.add_argument("--hour", type=float, default=None)
    ap.add_argument("--weekday", action="store_true", help="示意資料改用平日曲線（預設連假）")
    a = ap.parse_args()
    s = run_once(a.mode, a.hour, not a.weekday)
    print(f"[OK] {s['topic_id']} mode={s['source_mode']} coords={s['coord_status']} ({s['captured_at']})"
          + (f" fallback={s['fallback_reason']}" if s["fallback_reason"] else ""))
