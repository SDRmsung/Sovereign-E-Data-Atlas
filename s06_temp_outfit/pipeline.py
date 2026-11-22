#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Pipeline for s06_temp_outfit: 體感溫度穿搭地圖
即時串接中央氣象署 (CWA) O-A0003-001 (局屬氣象站) 與 O-A0001-001 (自動氣象站)
產出 feed/latest_frame.js、latest_frame.json、feed/timeline.js (24小時真實觀測時序)
"""

import argparse
import gzip
import json
import math
import os
import ssl
import sys
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

APP_DIR = Path(__file__).resolve().parent
ATLAS_DIR = APP_DIR.parent
SHARED_DIR = ATLAS_DIR / "01_shared"
if str(SHARED_DIR) not in sys.path:
    sys.path.insert(0, str(SHARED_DIR))

from connectors.ndjson_sink import write_dual_feed
from connectors.cwa_moenv_client import calc_apparent_temp_c, classify_outfit_tier
from connectors.tdx_client import load_env

TZ_TW = timezone(timedelta(hours=8))


def get_api_key() -> str:
    """載入 CWA_API_KEY：優先順序 ① 環境變數 ② ATLAS/.env"""
    load_env(ATLAS_DIR / ".env")
    load_env(SHARED_DIR / "connectors" / ".env")
    key = os.environ.get("CWA_API_KEY", "").strip()
    if not key:
        raise ValueError("找不到 CWA_API_KEY！請確認環境變數或 35-Areas/A23_Data_Atlas/.env")
    return key


def fetch_cwa_dataset(dataset_id: str, api_key: str) -> list:
    """抓取 CWA 開放資料集"""
    url = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/{dataset_id}?Authorization={api_key}"
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url, headers={"User-Agent": "A23-Data-Atlas/s06_outfit"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as resp:
            if resp.getcode() == 200:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("records", {}).get("Station", [])
    except Exception as e:
        print(f"[WARN] 抓取 {dataset_id} 失敗: {e}", file=sys.stderr)
    return []


def parse_station_record(raw: dict) -> dict | None:
    """解析單一測站資料為標準格式"""
    sid = raw.get("StationId")
    name = raw.get("StationName")
    if not sid or not name:
        return None

    coords = raw.get("GeoInfo", {}).get("Coordinates", [])
    lat, lon = None, None
    for c in coords:
        if c.get("CoordinateName") == "WGS84":
            try:
                lat = float(c.get("StationLatitude", 0))
                lon = float(c.get("StationLongitude", 0))
            except (ValueError, TypeError):
                pass
            break

    # 台灣本島與外島邊界過濾 (Lat 21.0~26.5, Lon 118.0~122.5)
    if not lat or not lon or not (21.0 <= lat <= 26.5 and 118.0 <= lon <= 122.5):
        return None

    we = raw.get("WeatherElement", {})
    try:
        temp = float(we.get("AirTemperature", -99))
        rh = float(we.get("RelativeHumidity", -99))
        wind_ms = float(we.get("WindSpeed", -99))
        wind_dir = float(we.get("WindDirection", -99))
    except (ValueError, TypeError):
        return None

    # 檢查無效值標記（CWA 常見 -99, -999）
    if temp < -40.0 or temp > 55.0 or rh < 0.0 or rh > 100.0:
        return None
    if wind_ms < 0.0 or wind_ms > 100.0:
        wind_ms = 0.0
    if wind_dir < 0.0 or wind_dir > 360.0:
        wind_dir = 0.0

    apparent = calc_apparent_temp_c(temp, rh, wind_ms)
    tier = classify_outfit_tier(apparent)

    # 取得當日高低溫極值 (若有)
    daily_high = None
    daily_low = None
    de = we.get("DailyExtreme", {})
    try:
        dh_val = de.get("DailyHigh", {}).get("TemperatureInfo", {}).get("AirTemperature")
        if dh_val is not None and float(dh_val) > -40:
            daily_high = float(dh_val)
    except Exception:
        pass
    try:
        dl_val = de.get("DailyLow", {}).get("TemperatureInfo", {}).get("AirTemperature")
        if dl_val is not None and float(dl_val) > -40:
            daily_low = float(dl_val)
    except Exception:
        pass

    return {
        "id": sid,
        "name": name,
        "lat": round(lat, 5),
        "lon": round(lon, 5),
        "temp": round(temp, 1),
        "rh": round(rh, 1),
        "wind_ms": round(wind_ms, 1),
        "wind_dir": round(wind_dir, 1),
        "apparent": apparent,
        "tier": tier,
        "daily_high": daily_high,
        "daily_low": daily_low,
    }


def compute_summary(stations: list, stations_dict: dict = None) -> dict:
    if not stations:
        return {
            "min_name": "-",
            "min_apparent": None,
            "max_name": "-",
            "max_apparent": None,
            "avg_apparent": None,
        }
    min_st = min(stations, key=lambda x: x["apparent"])
    max_st = max(stations, key=lambda x: x["apparent"])
    avg_app = round(sum(x["apparent"] for x in stations) / len(stations), 1)
    min_name = min_st.get("name") or (stations_dict.get(min_st["id"], {}).get("name") if stations_dict else min_st["id"])
    max_name = max_st.get("name") or (stations_dict.get(max_st["id"], {}).get("name") if stations_dict else max_st["id"])
    return {
        "min_name": min_name,
        "min_apparent": min_st["apparent"],
        "max_name": max_name,
        "max_apparent": max_st["apparent"],
        "avg_apparent": avg_app,
    }


def load_snapshots_from_ndjson(feed_dir: Path, date_keys: list[str]) -> dict[int, dict]:
    """
    從 ndjson.gz 載入真實觀測快照，按小時歸類。
    若同一小時內有多筆快照，保留最新的一筆。
    回傳: {hour_int: snapshot_dict}
    """
    hour_snaps = {}
    for dk in date_keys:
        gz_path = feed_dir / f"snapshots_{dk}.ndjson.gz"
        if not gz_path.exists():
            continue
        try:
            with gzip.open(gz_path, "rt", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        snap = json.loads(line)
                        cap = snap.get("captured_at")
                        if not cap:
                            continue
                        dt = datetime.fromisoformat(cap)
                        h = dt.astimezone(TZ_TW).hour
                        # 以時間最新者為準
                        hour_snaps[h] = snap
                    except Exception:
                        continue
        except Exception as e:
            print(f"[WARN] 讀取 {gz_path.name} 失敗: {e}", file=sys.stderr)
    return hour_snaps


def generate_modeled_timeline(stations: list, current_dt: datetime) -> dict:
    """
    太陽輻射日行週期正弦公式推估示意 (供使用者在前端手動切換對比)
    """
    timeline = {}
    current_hour = current_dt.hour

    st_dict = {s["id"]: s for s in stations}
    for h in range(24):
        hour_key = f"{h:02d}:00"
        hour_stations = []

        cycle_phase = (h - 5.5) / 12.0 * math.pi
        cycle_factor = math.sin(cycle_phase)

        for st in stations:
            cur_t = st["temp"]
            cur_rh = st["rh"]
            cur_wind = st["wind_ms"]
            cur_wdir = st["wind_dir"]

            high = st.get("daily_high") or (cur_t + 2.5)
            low = st.get("daily_low") or (cur_t - 2.5)
            if high < low:
                high, low = low, high

            amplitude = max(1.5, (high - low) / 2.0)
            mid_t = (high + low) / 2.0

            if h == current_hour:
                sim_t = cur_t
                sim_rh = cur_rh
                sim_wind = cur_wind
                sim_wdir = cur_wdir
            else:
                sim_t = round(mid_t + amplitude * cycle_factor, 1)
                sim_rh = max(35.0, min(98.0, round(cur_rh - cycle_factor * 12.0, 1)))
                wind_factor = 1.0 + 0.25 * cycle_factor if cycle_factor > 0 else 1.0 + 0.15 * cycle_factor
                sim_wind = max(0.5, round(cur_wind * wind_factor, 1))
                sim_wdir = cur_wdir

            app_t = calc_apparent_temp_c(sim_t, sim_rh, sim_wind)
            tier_h = classify_outfit_tier(app_t)

            hour_stations.append({
                "id": st["id"],
                "temp": sim_t,
                "rh": sim_rh,
                "wind_ms": sim_wind,
                "wind_dir": sim_wdir,
                "apparent": app_t,
                "tier": tier_h,
            })

        timeline[hour_key] = {
            "hour": h,
            "hour_key": hour_key,
            "missing": False,
            "source": "modeled",
            "station_count": len(hour_stations),
            "summary": compute_summary(hour_stations, st_dict),
        }

    return timeline


def probe_cwa_history(api_key: str, current_dt: datetime) -> None:
    """嘗試從 CWA 歷史端點 (C-B0024-001) 取得當日逐時資料"""
    url = f"https://opendata.cwa.gov.tw/api/v1/rest/datastore/C-B0024-001?Authorization={api_key}"
    print(f"[*] 嘗試 CWA 歷史端點: C-B0024-001...")
    req = urllib.request.Request(url, headers={"User-Agent": "A23-Data-Atlas/s06_outfit"})
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=15) as resp:
            code = resp.getcode()
            print(f"[+] CWA 歷史端點 C-B0024-001 回應: HTTP {code}")
            if code == 200:
                data = json.loads(resp.read().decode("utf-8"))
                locations = data.get("records", {}).get("location", [])
                today_str = current_dt.strftime("%Y-%m-%d")
                today_records = []
                for loc in locations:
                    obs_times = loc.get("stationObsTimes", {}).get("stationObsTime", [])
                    for ot in obs_times:
                        if ot.get("DateTime", "").startswith(today_str):
                            today_records.append(ot)
                if not today_records:
                    print(f"[-] 無可用逐時歷史 API (C-B0024-001 僅提供歷史前日資料，無當日 {today_str} 逐時記錄)")
                else:
                    print(f"[+] 取得 C-B0024-001 當日歷史記錄: {len(today_records)} 筆")
    except urllib.error.HTTPError as e:
        print(f"[-] CWA 歷史端點 C-B0024-001 HTTP 錯誤: {e.code}")
    except Exception as e:
        print(f"[-] CWA 歷史端點 C-B0024-001 請求失敗: {e}")


def generate_timeline(stations: list, current_dt: datetime, feed_dir: Path, force_modeled: bool = False) -> tuple[dict, dict]:
    """
    組裝 24 小時時序資料：
    - 預設 (timeline_mode="observed")：只從 ndjson 載入真實觀測快照；缺格標記 missing=True，stations=[]。
    - 若指定 force_modeled=True，則全以物理公式推算，標記 timeline_mode="modeled"。
    - 回傳 (timeline, modeled_timeline) 雙物件，modeled 不嵌入 timeline 本體
    """
    today_key = current_dt.strftime("%Y%m%d")
    prev_key = (current_dt - timedelta(days=1)).strftime("%Y%m%d")
    hour_snaps = load_snapshots_from_ndjson(feed_dir, [prev_key, today_key])

    timeline = {}
    stations_dict = {
        s["id"]: {"name": s["name"], "lat": s["lat"], "lon": s["lon"]}
        for s in stations
    }
    # 擴充 stations_dict 包含 ndjson 歷史站點，確保站序穩定
    for snap in hour_snaps.values():
        for s in snap.get("stations", []):
            if s["id"] not in stations_dict:
                stations_dict[s["id"]] = {"name": s.get("name", s["id"]), "lat": s.get("lat", 0), "lon": s.get("lon", 0)}

    tier_names = ["L1_短袖防曬", "L2_透氣薄長袖", "L3_防風風衣薄外套", "L4_保暖毛衣厚外套", "L5_防風羽絨衣"]
    tier_to_idx = {name: i for i, name in enumerate(tier_names)}
    st_keys = list(stations_dict.keys())
    scale = 10

    obs_count = 0
    missing_count = 0
    history_count = 0

    modeled_preview = generate_modeled_timeline(stations, current_dt)

    current_hour = current_dt.hour

    for h in range(24):
        hour_key = f"{h:02d}:00"
        if force_modeled:
            timeline[hour_key] = modeled_preview[hour_key]
            continue

        snap = hour_snaps.get(h)
        if snap and snap.get("stations"):
            snap_stations = snap["stations"]
            st_map = {s["id"]: s for s in snap_stations}
            t_arr, rh_arr, w_arr, wd_arr, ap_arr, tier_arr = [], [], [], [], [], []
            for sid in st_keys:
                st = st_map.get(sid)
                if not st:
                    t_arr.append(None)
                    rh_arr.append(None)
                    w_arr.append(None)
                    wd_arr.append(None)
                    ap_arr.append(None)
                    tier_arr.append(None)
                else:
                    t_arr.append(round(st["temp"] * scale) if st.get("temp") is not None else None)
                    rh_arr.append(round(st["rh"]) if st.get("rh") is not None else None)
                    w_arr.append(round(st["wind_ms"] * scale) if st.get("wind_ms") is not None else None)
                    wd_arr.append(round(st["wind_dir"]) if st.get("wind_dir") is not None else None)
                    ap_arr.append(round(st["apparent"] * scale) if st.get("apparent") is not None else None)
                    tier_idx = tier_to_idx.get(st.get("tier"))
                    tier_arr.append(tier_idx if tier_idx is not None else None)

            timeline[hour_key] = {
                "hour": h,
                "hour_key": hour_key,
                "missing": False,
                "source": "observed" if h != current_hour else "live",
                "captured_at": snap.get("captured_at"),
                "station_count": len(snap_stations),
                "summary": compute_summary(snap_stations, stations_dict),
                "cols": {
                    "t": t_arr,
                    "rh": rh_arr,
                    "w": w_arr,
                    "wd": wd_arr,
                    "ap": ap_arr,
                    "tier": tier_arr,
                },
            }
            obs_count += 1
        else:
            timeline[hour_key] = {
                "hour": h,
                "hour_key": hour_key,
                "missing": True,
                "source": "missing",
                "captured_at": None,
                "station_count": 0,
                "summary": compute_summary([]),
            }
            missing_count += 1

    timeline_mode = "modeled" if force_modeled else "observed"

    timeline["stations_dict"] = stations_dict
    timeline["meta"] = {
        "timeline_mode": timeline_mode,
        "captured_at": current_dt.isoformat(timespec="seconds"),
        "date_key": today_key,
        "hours_total": 24,
        "hours_observed": obs_count,
        "hours_cwa_history": history_count,
        "hours_missing": missing_count,
        "encoding": "cols_v1",
        "scale": scale,
        "tier_names": tier_names,
    }
    return timeline, modeled_preview


def run_pipeline(force_modeled: bool = False) -> dict:
    now_dt = datetime.now(TZ_TW)
    api_key = get_api_key()

    print(f"[*] 正在抓取 CWA O-A0003-001 (局屬站)...")
    raw_03 = fetch_cwa_dataset("O-A0003-001", api_key)
    print(f"[+] O-A0003-001 取得 {len(raw_03)} 筆站點")

    print(f"[*] 正在抓取 CWA O-A0001-001 (自動站)...")
    raw_01 = fetch_cwa_dataset("O-A0001-001", api_key)
    print(f"[+] O-A0001-001 取得 {len(raw_01)} 筆站點")

    station_map = {}
    for r in raw_01:
        st = parse_station_record(r)
        if st:
            station_map[st["id"]] = st

    for r in raw_03:
        st = parse_station_record(r)
        if st:
            station_map[st["id"]] = st

    all_stations = list(station_map.values())
    if not all_stations:
        raise RuntimeError("無法解析出任何有效氣象站點資料！")

    all_stations.sort(key=lambda s: s["lat"], reverse=True)
    print(f"[+] 總計解析有效站點數: {len(all_stations)} 站")

    min_st = min(all_stations, key=lambda s: s["apparent"])
    max_st = max(all_stations, key=lambda s: s["apparent"])

    tiers_present = set(s["tier"] for s in all_stations)
    tier_span = len(tiers_present)

    snapshot = {
        "schema": "a23.s06_temp_outfit.feed.v1",
        "topic_id": "s06_temp_outfit",
        "title": "體感溫度穿搭地圖",
        "category": "傳",
        "granularity": "小時級（逐時觀測與時空風場）",
        "captured_at": now_dt.isoformat(timespec="seconds"),
        "ts": int(now_dt.timestamp()),
        "date_key": now_dt.strftime("%Y%m%d"),
        "source_mode": "live",
        "cwa_dataset": ["O-A0003-001", "O-A0001-001"],
        "kpi": {
            "即時氣象測站": f"{len(all_stations)} 站",
            "最低體感測站": f"{min_st['name']} ({min_st['apparent']} °C)",
            "最高體感測站": f"{max_st['name']} ({max_st['apparent']} °C)",
            "南北穿搭跨度": f"{tier_span} 級滿跨 ({min_st['tier'][:2]}~{max_st['tier'][:2]})",
        },
        "stats": {
            "station_count": len(all_stations),
            "min_apparent": min_st["apparent"],
            "min_station": min_st["name"],
            "min_tier": min_st["tier"],
            "max_apparent": max_st["apparent"],
            "max_station": max_st["name"],
            "max_tier": max_st["tier"],
            "tier_span": tier_span,
        },
        "stations": all_stations,
    }

    # 1. 寫入 latest_frame.js / latest_frame.json / ndjson.gz
    feed_dir = APP_DIR / "feed"
    feed_dir.mkdir(parents=True, exist_ok=True)
    js_path = write_dual_feed(APP_DIR, snapshot, global_alias="A23_OUTFIT_FEED")
    print(f"[+] 已寫入即時數據: {js_path}")

    # 2. 探測 CWA 歷史 API
    probe_cwa_history(api_key, now_dt)

    # 3. 生成 24 小時時序 (真實觀測累積模式，預設 observed)
    print(f"[*] 正在組裝 24 小時時空時序 (真實觀測模式)...")
    timeline, modeled_preview = generate_timeline(all_stations, now_dt, feed_dir, force_modeled=force_modeled)

    meta = timeline.get("meta", {})
    print(f"[+] 時序組裝完成: 觀測格數={meta.get('hours_observed')}/24 | 缺格數={meta.get('hours_missing')}/24 | 模式={meta.get('timeline_mode')}")

    timeline_json_path = feed_dir / "timeline.json"
    timeline_json_path.write_text(json.dumps(timeline, ensure_ascii=False, indent=2), encoding="utf-8")

    timeline_js_path = feed_dir / "timeline.js"
    timeline_compact_str = json.dumps(timeline, ensure_ascii=False, separators=(",", ":"))
    timeline_js_path.write_text(
        f"// Auto-generated Zero-CORS Timeline Feed\nwindow.A23_OUTFIT_TIMELINE = {timeline_compact_str};\n",
        encoding="utf-8",
    )
    print(f"[+] 已寫入時序數據: {timeline_js_path}")

    # 4. 寫入獨立推估檔 timeline_modeled (不入 timeline.js SSOT)
    modeled_json_path = feed_dir / "timeline_modeled.json"
    modeled_json_path.write_text(json.dumps(modeled_preview, ensure_ascii=False, indent=2), encoding="utf-8")

    modeled_js_path = feed_dir / "timeline_modeled.js"
    modeled_js_path.write_text(
        f"// Auto-generated Zero-CORS Modeled Timeline Feed (Excluded from Publish)\nwindow.A23_OUTFIT_TIMELINE_MODELED = {json.dumps(modeled_preview, ensure_ascii=False)};\n",
        encoding="utf-8",
    )
    print(f"[+] 已寫入獨立推估數據: {modeled_js_path}")

    return snapshot


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="A23 s06 outfit pipeline")
    parser.add_argument("--modeled", action="store_true", help="強制以正弦日行推估生成時序 (預設關閉，使用真實觀測)")
    args = parser.parse_args()

    snap = run_pipeline(force_modeled=args.modeled)
    print(f"\n[OK] {snap['topic_id']} -> live feed 完成更新！")
    print(f"     測站數: {snap['stats']['station_count']} | 最低體感: {snap['stats']['min_station']} {snap['stats']['min_apparent']}°C | 最高: {snap['stats']['max_station']} {snap['stats']['max_apparent']}°C")
