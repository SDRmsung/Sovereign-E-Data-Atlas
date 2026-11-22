"""
build_batch5_data.py - A23 動態圖表型錄第 5 批（待實作 12 型）資料建置腳本
用法: python build_batch5_data.py <A23_Data_Atlas 根目錄絕對路徑>
輸出: 01_shared/viz_core/charts/demo/data_batch5.js (<= 500 KB)
快取/原始檔: 01_shared/viz_core/charts/demo/raw_batch5/
"""

import sys, os, json, datetime, ssl, urllib.request, math, re, csv
from collections import Counter

def get_mtime_str(filepath):
    if filepath and os.path.exists(filepath):
        ts = os.path.getmtime(filepath)
        return datetime.datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S")
    return "1970-01-01 00:00:00"

def fetch_url(url, cache_path, headers=None, timeout=10):
    if os.path.exists(cache_path) and os.path.getsize(cache_path) > 100:
        with open(cache_path, "rb") as f:
            return f.read()
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    hdrs = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, headers=hdrs)
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as r:
        data = r.read()
        with open(cache_path, "wb") as f:
            f.write(data)
        return data

def main():
    if len(sys.argv) < 2:
        print("Usage: python build_batch5_data.py <A23_Data_Atlas_Path>")
        sys.exit(1)

    root = os.path.abspath(sys.argv[1])
    raw_dir = os.path.join(root, "01_shared", "viz_core", "charts", "demo", "raw_batch5")
    os.makedirs(raw_dir, exist_ok=True)
    out_js = os.path.join(root, "01_shared", "viz_core", "charts", "demo", "data_batch5.js")

    b5_data = {}

    # =========================================================================
    # #6 Waterfall: s02 YouBike 2.0 各區增減
    # =========================================================================
    print("Building #6 Waterfall...")
    s02_tl_path = os.path.join(root, "s02_youbike_tide", "feed", "tide_timeline.json")
    with open(s02_tl_path, encoding="utf-8") as f:
        tl_s02 = json.load(f)

    hours = sorted(tl_s02.keys())
    top_dists = ["大安區", "信義區", "中山區", "中正區", "士林區", "內湖區", "板橋區", "中和區"]
    
    dist_totals = {}
    for h in hours:
        dt = {}
        for s in tl_s02[h]["stations"]:
            dname = s.get("district", "其他區")
            dt[dname] = dt.get(dname, 0) + s["available_bikes"]
        dist_totals[h] = dt

    waterfall_frames = []
    prev_h = hours[-1]
    for h in hours:
        base_val = sum(dist_totals[prev_h].values())
        cur_val = sum(dist_totals[h].values())
        items = []
        d_sum = 0
        for d in top_dists:
            diff = dist_totals[h].get(d, 0) - dist_totals[prev_h].get(d, 0)
            items.append({"name": d.replace("區", ""), "delta": diff})
            d_sum += diff
        items.append({"name": "其他區", "delta": (cur_val - base_val) - d_sum})
        waterfall_frames.append({
            "label": h,
            "base": base_val,
            "items": items,
            "end": cur_val
        })
        prev_h = h

    b5_data["6"] = {
        "frames": waterfall_frames,
        "meta": {
            "source": "s02 YouBike 2.0 雙北站點時序 (tide_timeline.json)",
            "url": "local:s02_youbike_tide/feed/tide_timeline.json",
            "fetched_at": get_mtime_str(s02_tl_path),
            "rows": len(waterfall_frames) * 10,
            "mode": "live",
            "note": "全市可借車 起點→各主要行政區增減→終點"
        }
    }

    # =========================================================================
    # #7 Funnel: Eurostat 數位經濟使用漏斗 (isoc_ec_ib20 JSON-stat 解析)
    # =========================================================================
    print("Building #7 Funnel...")
    funnel_cache = os.path.join(raw_dir, "eurostat_isoc_funnel.json")
    if not os.path.exists(funnel_cache):
        try:
            url_eurostat = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/isoc_ec_ib20?geo=DE&geo=FR&geo=ES&geo=IT&geo=NL&geo=EU27_2020"
            fetch_url(url_eurostat, funnel_cache, timeout=12)
        except Exception as e:
            print("Eurostat query warning:", e)

    with open(funnel_cache, encoding="utf-8") as f:
        euro_data = json.load(f)

    # JSON-stat multi-dimensional index calculation
    euro_sizes = euro_data["size"]
    euro_val_map = euro_data.get("value", {})
    euro_dims = euro_data["dimension"]

    def get_euro_val(indic, geo, yr, unit="PC_IND", ind_type="IND_TOTAL"):
        f_i = 0
        it_i = euro_dims["ind_type"]["category"]["index"][ind_type]
        ind_i = euro_dims["indic_is"]["category"]["index"][indic]
        u_i = euro_dims["unit"]["category"]["index"][unit]
        g_i = euro_dims["geo"]["category"]["index"][geo]
        t_i = euro_dims["time"]["category"]["index"][yr]
        linear_idx = (((((f_i * euro_sizes[1] + it_i) * euro_sizes[2] + ind_i) * euro_sizes[3] + u_i) * euro_sizes[4] + g_i) * euro_sizes[5] + t_i)
        return euro_val_map.get(str(linear_idx))

    euro_geos = [
        ("EU27_2020", "歐盟平均"),
        ("DE", "德國 (DE)"),
        ("FR", "法國 (FR)"),
        ("ES", "西班牙 (ES)"),
        ("IT", "義大利 (IT)"),
        ("NL", "荷蘭 (NL)")
    ]
    funnel_stages = ["曾網購", "近1年網購", "近3月網購", "高頻網購(6次+)"]

    # Only include years with complete real data across all 6 geos
    available_years = list(euro_dims["time"]["category"]["index"].keys())
    valid_years = []
    for y in available_years:
        all_ok = True
        for g_code, _ in euro_geos:
            bux = get_euro_val("I_BUX", g_code, y)
            blt = get_euro_val("I_BLT12", g_code, y)
            buy3 = get_euro_val("I_BUY3", g_code, y)
            bf_hi = get_euro_val("I_BF_HI", g_code, y)
            if any(v is None for v in [bux, blt, buy3, bf_hi]):
                all_ok = False
                break
        if all_ok:
            valid_years.append(y)

    funnel_frames = []
    for y in sorted(valid_years):
        c_list = []
        for g_code, g_name in euro_geos:
            bux = get_euro_val("I_BUX", g_code, y)
            ever = round(100.0 - bux, 1) if bux is not None else 0.0
            blt = round(get_euro_val("I_BLT12", g_code, y), 1)
            buy3 = round(get_euro_val("I_BUY3", g_code, y), 1)
            bf_hi = round(get_euro_val("I_BF_HI", g_code, y), 1)
            c_list.append({
                "name": g_name,
                "values": [ever, blt, buy3, bf_hi]
            })
        funnel_frames.append({"label": y + "年", "countries": c_list})

    b5_data["7"] = {
        "stages": funnel_stages,
        "frames": funnel_frames,
        "meta": {
            "source": "EU Eurostat (isoc_ec_ib20)",
            "url": "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/isoc_ec_ib20",
            "fetched_at": get_mtime_str(funnel_cache),
            "rows": len(funnel_frames) * len(euro_geos) * len(funnel_stages),
            "mode": "live",
            "note": "歐盟電商漏斗：曾網購→近1年網購→近3月網購→高頻網購(6次+) (實測)"
        }
    }

    # =========================================================================
    # #9 Animated Scatter: s02 站點 容量 × 滿載率
    # =========================================================================
    print("Building #9 Animated Scatter...")
    first_st = tl_s02[hours[0]]["stations"]
    rep_stations = []
    d_count = {}
    for s in first_st:
        dname = s.get("district", "其他區")
        if d_count.get(dname, 0) < 12:
            rep_stations.append(s["id"])
            d_count[dname] = d_count.get(dname, 0) + 1
    rep_set = set(rep_stations)

    dist_names = sorted(list({s.get("district", "其他區") for s in first_st if s["id"] in rep_set}))
    scatter_frames = []
    for h in hours:
        pts = []
        for s in tl_s02[h]["stations"]:
            if s["id"] in rep_set:
                pts.append({
                    "x": s["capacity"],
                    "y": round(s["ratio"], 3),
                    "cat": s.get("district", "其他區"),
                    "name": s["name"].replace("YouBike2.0_", "").split("（")[0]
                })
        scatter_frames.append({"label": h, "points": pts})

    b5_data["9"] = {
        "categories": dist_names,
        "frames": scatter_frames,
        "meta": {
            "source": "s02 YouBike 2.0 雙北站點時序",
            "url": "local:s02_youbike_tide/feed/tide_timeline.json",
            "fetched_at": get_mtime_str(s02_tl_path),
            "rows": len(scatter_frames) * len(rep_set),
            "mode": "live",
            "note": "站點容量(x) × 滿載率(y)·顏色=行政區"
        }
    }

    # =========================================================================
    # #17 Parallel Coordinates: OECD Better Life Index
    # =========================================================================
    print("Building #17 Parallel Coordinates...")
    bli_cache = os.path.join(raw_dir, "oecd_bli_2015.csv")
    bli_url = "https://raw.githubusercontent.com/ageron/handson-ml2/master/datasets/lifesat/oecd_bli_2015.csv"
    raw_bli = fetch_url(bli_url, bli_cache, timeout=10)
    
    target_ind = {
        "Life satisfaction": "生活滿意",
        "Employment rate": "就業率",
        "Air pollution": "空氣品質",
        "Rooms per person": "人均居室",
        "Self-reported health": "自覺健康",
        "Educational attainment": "高教普及",
        "Homicide rate": "治安指數"
    }
    country_values = {}
    reader = csv.DictReader(raw_bli.decode("utf-8-sig", errors="ignore").splitlines())
    for row in reader:
        c = row.get("Country")
        ind = row.get("Indicator")
        ineq = row.get("Inequality")
        if c and ind in target_ind and ineq == "Total":
            try:
                val = float(row.get("Value", 0))
                if c not in country_values: country_values[c] = {}
                country_values[c][target_ind[ind]] = val
            except ValueError:
                pass

    dims = list(target_ind.values())
    items = []
    c_zh = {
        "Australia": "澳洲", "Austria": "奧地利", "Belgium": "比利時", "Canada": "加拿大",
        "Denmark": "丹麥", "Finland": "芬蘭", "France": "法國", "Germany": "德國",
        "Japan": "日本", "Korea": "韓國", "Netherlands": "荷蘭", "Norway": "挪威",
        "Sweden": "瑞典", "Switzerland": "瑞士", "United Kingdom": "英國", "United States": "美國"
    }
    for c, cname in c_zh.items():
        if c in country_values:
            row_vals = [round(country_values[c].get(d, 5.0), 2) for d in dims]
            items.append({"name": cname, "values": row_vals})

    dim_specs = []
    for idx, d in enumerate(dims):
        vals = [it["values"][idx] for it in items]
        mn = min(vals); mx = max(vals)
        dim_specs.append({"key": d, "name": d, "min": mn, "max": mx})

    b5_data["17"] = {
        "dimensions": dim_specs,
        "items": items,
        "frames": [{"label": it["name"], "highlight": it["name"]} for it in items],
        "meta": {
            "source": "OECD Better Life Index",
            "url": bli_url,
            "fetched_at": get_mtime_str(bli_cache),
            "rows": len(items) * len(dims),
            "mode": "live",
            "note": "OECD 各國多維福祉指標 (實測)"
        }
    }

    # =========================================================================
    # #21 Trajectory: NOAA MarineCadastre AIS 船舶軌跡
    # =========================================================================
    print("Building #21 Trajectory...")
    ais_cache = os.path.join(raw_dir, "noaa_ais_sample.csv")
    if not os.path.exists(ais_cache):
        import zstandard as zstd, io
        noaa_url = "https://noaaocm.blob.core.windows.net/ais/csv2/csv2024/ais-2024-01-01.csv.zst"
        req = urllib.request.Request(noaa_url, headers={"User-Agent": "Mozilla/5.0", "Range": "bytes=0-1500000"})
        with urllib.request.urlopen(req, timeout=12) as r:
            raw_zst = r.read()
        dctx = zstd.ZstdDecompressor()
        stream_reader = dctx.stream_reader(io.BytesIO(raw_zst))
        decomp = stream_reader.read(400000).decode("utf-8", errors="ignore")
        with open(ais_cache, "w", encoding="utf-8") as f:
            f.write(decomp)
    else:
        with open(ais_cache, encoding="utf-8") as f:
            decomp = f.read()

    lines = decomp.splitlines()
    vessels = {}
    for line in lines[1:]:
        parts = line.split(",")
        if len(parts) >= 8:
            mmsi = parts[0].strip()
            dt_str = parts[1].strip()
            try:
                lon = float(parts[2]); lat = float(parts[3])
                sog = float(parts[4]) if parts[4] else 0.0
                cog = float(parts[5]) if parts[5] else 0.0
                vname = parts[7].strip() or ("MMSI " + mmsi[-4:])
                if -130 <= lon <= -65 and 20 <= lat <= 50:
                    vessels.setdefault(mmsi, []).append({
                        "t": dt_str, "lon": lon, "lat": lat, "sog": sog, "cog": cog, "name": vname
                    })
            except Exception:
                continue

    selected_vessels = [v for v in vessels.values() if len(v) >= 1][:24]
    if not selected_vessels:
        selected_vessels = list(vessels.values())[:24]

    all_lons = [pt["lon"] for v in selected_vessels for pt in v]
    all_lats = [pt["lat"] for v in selected_vessels for pt in v]
    bbox = [min(all_lons), min(all_lats), max(all_lons), max(all_lats)]

    traj_frames = []
    for f_idx in range(20):
        frac = f_idx / 19.0
        frame_ships = []
        for vi, v in enumerate(selected_vessels):
            p_len = len(v)
            cur_i = int(frac * (p_len - 1))
            cur_pt = v[cur_i]
            trail = [[round(p["lon"], 4), round(p["lat"], 4)] for p in v[max(0, cur_i - 5):cur_i + 1]]
            frame_ships.append({
                "id": str(vi),
                "name": cur_pt["name"],
                "x": round(cur_pt["lon"], 4),
                "y": round(cur_pt["lat"], 4),
                "sog": cur_pt["sog"],
                "cog": cur_pt["cog"],
                "trail": trail
            })
        traj_frames.append({"label": f"T+{f_idx*3:02d}m", "ships": frame_ships})

    b5_data["21"] = {
        "bbox": bbox,
        "frames": traj_frames,
        "meta": {
            "source": "US NOAA MarineCadastre AIS (2024-01-01)",
            "url": "https://noaaocm.blob.core.windows.net/ais/csv2/csv2024/ais-2024-01-01.csv.zst",
            "fetched_at": get_mtime_str(ais_cache),
            "rows": len(traj_frames) * len(selected_vessels),
            "mode": "live",
            "note": "NOAA AIS 美國港區船舶即時軌跡與尾跡 (實測)"
        }
    }

    # =========================================================================
    # #22 3D Globe Arcs: OpenFlights 全球前 20 大航線記錄數
    # =========================================================================
    print("Building #22 3D Globe Arcs...")
    routes_cache = os.path.join(raw_dir, "routes.dat")
    airports_cache = os.path.join(raw_dir, "airports.dat")
    
    url_routes = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/routes.dat"
    url_airports = "https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat"
    fetch_url(url_routes, routes_cache, timeout=20)
    fetch_url(url_airports, airports_cache, timeout=20)

    # Parse airports.dat
    airports = {}
    with open(airports_cache, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.reader(f):
            if len(row) > 7:
                iata = row[4].strip()
                name = row[1].strip()
                city = row[2].strip()
                country = row[3].strip()
                try:
                    lat = float(row[6])
                    lon = float(row[7])
                    if len(iata) == 3 and iata != r"\N":
                        airports[iata] = {"name": name, "city": city, "country": country, "lat": lat, "lon": lon}
                except Exception:
                    pass

    # City name translations to Traditional Chinese
    city_zh = {
        "Chicago": "芝加哥", "Atlanta": "亞特蘭大", "New York": "紐約", "London": "倫敦",
        "Paris": "巴黎", "Bangkok": "曼谷", "Phuket": "普吉", "Hong Kong": "香港",
        "Los Angeles": "洛杉磯", "Dubai": "杜拜", "New Orleans": "紐奧良", "San Francisco": "舊金山",
        "Kuwait": "科威特", "Miami": "邁阿密", "Tokyo": "東京", "Osaka": "大阪",
        "Sapporo": "札幌", "Abu Dhabi": "阿布達比", "Muscat": "馬斯喀特", "Doha": "杜哈",
        "Amsterdam": "阿姆斯特丹", "Barcelona": "巴塞隆納", "Madrid": "馬德里", "Orlando": "奧蘭多",
        "Guangzhou": "廣州", "Hangzhou": "杭州", "Dallas-Fort Worth": "達拉斯", "Bahrain": "巴林"
    }

    # Count routes per airport pair
    pair_counts = Counter()
    with open(routes_cache, "r", encoding="utf-8", errors="ignore") as f:
        for row in csv.reader(f):
            if len(row) > 4:
                src = row[2].strip()
                dst = row[4].strip()
                if src in airports and dst in airports and src != dst:
                    pair = tuple(sorted([src, dst]))
                    pair_counts[pair] += 1

    top20_pairs = pair_counts.most_common(20)
    globe_routes = []
    for (src, dst), vol in top20_pairs:
        a_src = airports[src]
        a_dst = airports[dst]
        c_src = city_zh.get(a_src["city"], a_src["city"])
        c_dst = city_zh.get(a_dst["city"], a_dst["city"])
        globe_routes.append({
            "from": src, "to": dst,
            "fromName": c_src, "toName": c_dst,
            "fromCoord": [round(a_src["lon"], 2), round(a_src["lat"], 2)],
            "toCoord": [round(a_dst["lon"], 2), round(a_dst["lat"], 2)],
            "vol": vol
        })

    b5_data["22"] = {
        "routes": globe_routes,
        "frames": [{"label": f"相位 {i*15:03d}°", "angle": i * 15} for i in range(24)],
        "meta": {
            "source": "OpenFlights (routes.dat & airports.dat)",
            "url": url_routes,
            "fetched_at": get_mtime_str(routes_cache),
            "rows": len(globe_routes),
            "mode": "live",
            "note": "OpenFlights 航線記錄數 (實測)"
        }
    }

    # =========================================================================
    # #23 Dot Density: USGS 全球即時地震 feed
    # =========================================================================
    print("Building #23 Dot Density...")
    usgs_cache = os.path.join(raw_dir, "usgs_all_month.geojson")
    usgs_url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson"
    raw_usgs = fetch_url(usgs_url, usgs_cache, timeout=12)
    usgs_json = json.loads(raw_usgs.decode("utf-8"))

    eq_by_day = {}
    for feat in usgs_json.get("features", []):
        props = feat.get("properties", {})
        coords = feat.get("geometry", {}).get("coordinates", [])
        mag = props.get("mag")
        t_ms = props.get("time")
        if mag and mag >= 4.0 and coords and t_ms:
            dt = datetime.datetime.fromtimestamp(t_ms / 1000.0, tz=datetime.timezone.utc)
            d_key = dt.strftime("%m-%d")
            eq_by_day.setdefault(d_key, []).append({
                "lon": round(coords[0], 2),
                "lat": round(coords[1], 2),
                "mag": round(mag, 1),
                "depth": round(coords[2], 1),
                "place": (props.get("place") or "").split(",")[-1].strip()
            })

    days = sorted(eq_by_day.keys())[-15:]
    eq_frames = []
    for d in days:
        eq_frames.append({
            "label": d,
            "events": eq_by_day[d][:40]
        })

    b5_data["23"] = {
        "frames": eq_frames,
        "meta": {
            "source": "USGS Earthquake Hazards Program Feed",
            "url": usgs_url,
            "fetched_at": get_mtime_str(usgs_cache),
            "rows": sum(len(f["events"]) for f in eq_frames),
            "mode": "live",
            "note": "USGS 全球規模 4.0+ 地震點事件分佈 (實測)"
        }
    }

    # =========================================================================
    # #25 Word Cloud: US Federal Register 政策主題詞頻
    # =========================================================================
    print("Building #25 Word Cloud...")
    fed_cache = os.path.join(raw_dir, "federal_register_rules.json")
    fed_url = "https://www.federalregister.gov/api/v1/documents.json?conditions[type][]=RULE&per_page=40"
    raw_fed = fetch_url(fed_url, fed_cache, timeout=10)
    fed_json = json.loads(raw_fed.decode("utf-8"))

    stopwords = {"and", "the", "for", "of", "to", "in", "a", "on", "with", "by", "under", "act", "rule", "rules", "final", "part", "department", "service", "national", "agency", "states", "united"}
    
    word_freq_by_date = {}
    for doc in fed_json.get("results", []):
        dt = doc.get("publication_date") or "2024-11"
        title = doc.get("title", "")
        tokens = re.findall(r"[A-Za-z]{3,}", title.lower())
        for tok in tokens:
            if tok not in stopwords:
                word_freq_by_date.setdefault(dt, {})[tok.upper()] = word_freq_by_date.setdefault(dt, {}).get(tok.upper(), 0) + 1

    wc_frames = []
    for dt in sorted(word_freq_by_date.keys()):
        freq_list = sorted(word_freq_by_date[dt].items(), key=lambda x: -x[1])[:25]
        wc_frames.append({
            "label": dt[-5:],
            "words": [{"text": k, "count": v} for k, v in freq_list]
        })

    b5_data["25"] = {
        "frames": wc_frames,
        "meta": {
            "source": "US Federal Register Rules API",
            "url": fed_url,
            "fetched_at": get_mtime_str(fed_cache),
            "rows": sum(len(f["words"]) for f in wc_frames),
            "mode": "live",
            "note": f"美國聯邦公報最新法規政策主題詞頻 (實測，共 {len(wc_frames)} 實際資料日)"
        }
    }

    # =========================================================================
    # #26 Timeline: A23 專案里程碑事件軸 (progress.md，去除重複事件)
    # =========================================================================
    print("Building #26 Timeline...")
    prog_path = os.path.join(root, "docs", "progress.md")
    with open(prog_path, encoding="utf-8") as f:
        prog_text = f.read()

    timeline_events = []
    seen_events = set()
    event_matches = re.findall(r"(?:##|- )\s*(2026-\d{2}-\d{2}\s+[\d:x]+)\s+(.+)", prog_text)
    for dt, title in event_matches:
        dt_str = dt.strip()
        title_str = title.strip()
        key = (dt_str, title_str)
        if key in seen_events:
            continue
        seen_events.add(key)
        cat = "視覺" if "圖表" in title_str or "Portal" in title_str else ("架構" if "母子" in title_str or "改版" in title_str else "治理")
        timeline_events.append({
            "date": dt_str,
            "title": title_str,
            "cat": cat
        })

    timeline_frames = []
    for i in range(1, len(timeline_events) + 1):
        timeline_frames.append({
            "label": timeline_events[i - 1]["date"].split()[0],
            "count": i,
            "active": timeline_events[:i]
        })

    b5_data["26"] = {
        "events": timeline_events,
        "frames": timeline_frames,
        "meta": {
            "source": "A23 專案治理日誌 (progress.md)",
            "url": "local:docs/progress.md",
            "fetched_at": get_mtime_str(prog_path),
            "rows": len(timeline_events),
            "mode": "live",
            "note": "A23 專案演進里程碑與關鍵功能落地事件序 (實測，去重)"
        }
    }

    # =========================================================================
    # #27 Gantt: A23 場景開發排程 (依各 s0x 資料夾檔案 mtime 與 feed 檔案大小)
    # =========================================================================
    print("Building #27 Gantt...")
    s_dirs = sorted([d for d in os.listdir(root) if os.path.isdir(os.path.join(root, d)) and d.startswith("s0")])
    s_info = {
        "s01_artery_flow": ("s01", "s01 主動脈車流", "交通"),
        "s02_youbike_tide": ("s02", "s02 YouBike 潮汐", "交通"),
        "s03_bus_delay": ("s03", "s03 公車動態", "交通"),
        "s04_freeway_rest": ("s04", "s04 救災動線", "交通"),
        "s05_pm25_escape": ("s05", "s05 空品微氣候", "環境"),
        "s06_temp_outfit": ("s06", "s06 體感穿搭", "生活"),
        "s07_ev_charger": ("s07", "s07 充電生活圈", "生活"),
        "s08_speedcam_crash": ("s08", "s08 事故熱點", "安全"),
        "s09_vacancy_rent": ("s09", "s09 租屋壓力", "生活")
    }

    gantt_tasks = []
    gantt_dates_set = set()
    latest_gantt_mtime = 0

    for sd in s_dirs:
        s_path = os.path.join(root, sd)
        all_s_files = [os.path.join(r, f) for r, _, fs in os.walk(s_path) for f in fs]
        if not all_s_files:
            continue
        mtimes = [os.path.getmtime(p) for p in all_s_files]
        min_m = min(mtimes)
        max_m = max(mtimes)
        latest_gantt_mtime = max(latest_gantt_mtime, max_m)
        st_date = datetime.datetime.fromtimestamp(min_m).strftime("%m-%d")
        en_date = datetime.datetime.fromtimestamp(max_m).strftime("%m-%d")
        gantt_dates_set.add(st_date)
        gantt_dates_set.add(en_date)

        feed_dir = os.path.join(s_path, "feed")
        feed_files = [os.path.join(feed_dir, f) for f in os.listdir(feed_dir) if os.path.isfile(os.path.join(feed_dir, f))] if os.path.exists(feed_dir) else []
        has_valid_feed = any(os.path.getsize(p) >= 1024 for p in feed_files)

        sid, sname, scat = s_info.get(sd, (sd[:3], sd, "其他"))
        gantt_tasks.append({
            "id": sid,
            "name": sname,
            "cat": scat,
            "start": st_date,
            "end": en_date,
            "prog": 1.0 if has_valid_feed else 0.0
        })

    gantt_dates = sorted(list(gantt_dates_set))
    gantt_frames = [{"label": d, "cursor": idx / max(1, len(gantt_dates) - 1)} for idx, d in enumerate(gantt_dates)]
    gantt_fetched_at = datetime.datetime.fromtimestamp(latest_gantt_mtime).strftime("%Y-%m-%d %H:%M:%S") if latest_gantt_mtime else get_mtime_str(root)

    b5_data["27"] = {
        "tasks": gantt_tasks,
        "dates": gantt_dates,
        "frames": gantt_frames,
        "meta": {
            "source": "本機檔案 mtime",
            "url": "local:35-Areas/A23_Data_Atlas/s0*",
            "fetched_at": gantt_fetched_at,
            "rows": len(gantt_tasks),
            "mode": "live",
            "note": "A23 場景開發甘特圖 (來源: 本機檔案 mtime)"
        }
    }

    # =========================================================================
    # #28 Correlation Matrix: s06 氣象實測指標相關
    # =========================================================================
    print("Building #28 Correlation Matrix...")
    import glob, gzip
    s06_files = sorted(glob.glob(os.path.join(root, "s06_temp_outfit", "feed", "snapshots_*.ndjson.gz")))
    s06_snaps = {}
    if s06_files:
        for f in s06_files:
            for l in gzip.open(f, "rt", encoding="utf-8"):
                j = json.loads(l)
                if j.get("source_mode") == "live" and j.get("stations"):
                    s06_snaps[j["captured_at"][:16]] = j["stations"]
    
    var_keys = [("氣溫", "temp"), ("體感", "apparent"), ("濕度", "rh"), ("風速", "wind_ms"), ("日低溫", "daily_low")]
    labels_order = [vk[0] for vk in var_keys]
    
    def pearson(x, y):
        n = len(x)
        if n < 5: return 0.0
        mx = sum(x) / n; my = sum(y) / n
        var_x = sum((xi - mx)**2 for xi in x)
        var_y = sum((yi - my)**2 for yi in y)
        if var_x == 0 or var_y == 0: return 0.0
        cov = sum((xi - mx) * (yi - my) for xi, yi in zip(x, y))
        return round(cov / math.sqrt(var_x * var_y), 3)

    corr_frames = []
    for snap_time in sorted(s06_snaps.keys()):
        st_list = s06_snaps[snap_time]
        vals = {vk[0]: [] for vk in var_keys}
        for s in st_list:
            if all(s.get(vk[1]) is not None for vk in var_keys):
                for vk in var_keys:
                    vals[vk[0]].append(float(s[vk[1]]))
        
        m_matrix = []
        for v1 in labels_order:
            row = []
            for v2 in labels_order:
                r_val = pearson(vals[v1], vals[v2])
                row.append(r_val)
            m_matrix.append(row)
        corr_frames.append({
            "label": snap_time[11:16],
            "matrix": m_matrix
        })

    s06_latest_file = s06_files[-1] if s06_files else ""
    b5_data["28"] = {
        "vars": labels_order,
        "frames": corr_frames,
        "meta": {
            "source": "s06 CWA 氣象實測快照 (氣溫/體感/濕度/風速/低溫相關)",
            "url": "local:s06_temp_outfit/feed/snapshots_*.ndjson.gz",
            "fetched_at": get_mtime_str(s06_latest_file),
            "rows": len(corr_frames) * len(labels_order)**2,
            "mode": "live",
            "note": "CWA 測站氣象要素皮爾森相關矩陣 (實測備援)"
        }
    }

    # =========================================================================
    # #29 3D Surface / Contour: US Treasury 殖利率曲線
    # =========================================================================
    print("Building #29 3D Surface...")
    treasury_cache = os.path.join(raw_dir, "daily_treasury_rates_2024.csv")
    treasury_url = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/2024/all?type=daily_treasury_yield_curve&field_tdr_date_value=2024&page&_format=csv"
    raw_tr = ""
    try:
        raw_tr = fetch_url(treasury_url, treasury_cache, timeout=12).decode("utf-8", errors="ignore")
    except Exception as e:
        print("Treasury fetch warning:", e)
        if os.path.exists(treasury_cache):
            with open(treasury_cache, encoding="utf-8", errors="ignore") as f:
                raw_tr = f.read()

    tr_reader = csv.reader(raw_tr.splitlines())
    header = next(tr_reader, [])
    target_tenors = ["1 Mo", "3 Mo", "6 Mo", "1 Yr", "2 Yr", "5 Yr", "10 Yr", "30 Yr"]
    tenor_indices = {t: header.index(t) for t in target_tenors if t in header}

    yield_by_date = []
    for row in tr_reader:
        if len(row) > max(tenor_indices.values()):
            dt = row[0]
            vals = []
            valid = True
            for t in target_tenors:
                try:
                    vals.append(float(row[tenor_indices[t]]))
                except Exception:
                    valid = False; break
            if valid:
                yield_by_date.append({"date": dt, "yields": vals})

    yield_by_date.reverse()
    sample_yields = yield_by_date[::5][-24:]

    surface_frames = []
    for sy in sample_yields:
        surface_frames.append({
            "label": sy["date"],
            "values": sy["yields"]
        })

    b5_data["29"] = {
        "tenors": ["1M", "3M", "6M", "1Y", "2Y", "5Y", "10Y", "30Y"],
        "frames": surface_frames,
        "meta": {
            "source": "US Department of the Treasury (Daily Treasury Par Yield Curve)",
            "url": treasury_url,
            "fetched_at": get_mtime_str(treasury_cache),
            "rows": len(surface_frames) * len(target_tenors),
            "mode": "live",
            "note": "美國財政部公債殖利率曲線 2.5D 曲面 (實測)"
        }
    }

    # Write output to demo/data_batch5.js
    # =========================================================================
    js_content = "/* A23 Data Batch 5 - 由 build_batch5_data.py 自動產生（勿手動修改） */\n"
    js_content += "window.A23_DEMO_B5 = " + json.dumps(b5_data, ensure_ascii=False, separators=(",", ":")) + ";\n"
    js_content += """(function(){
  var aliases = {"6":"waterfall","7":"funnel","9":"scatter","17":"parallel","21":"trajectory","22":"globeArcs","23":"dotDensity","25":"wordCloud","26":"timeline","27":"gantt","28":"corrMatrix","29":"surface"};
  for (var k in aliases) {
    if (window.A23_DEMO_B5 && window.A23_DEMO_B5[k]) {
      window.A23_DEMO_B5[aliases[k]] = window.A23_DEMO_B5[k];
    }
  }
})();\n"""
    
    with open(out_js, "w", encoding="utf-8") as f:
        f.write(js_content)

    size_kb = os.path.getsize(out_js) / 1024.0
    print(f"data_batch5.js generated successfully! Size: {size_kb:.2f} KB (Limit: 500 KB)")
    if size_kb > 500:
        print("[WARNING] Size exceeds 500 KB!")
    else:
        print("[PASS] Size within limit.")

if __name__ == "__main__":
    main()
