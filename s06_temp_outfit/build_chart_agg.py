# 由 feed/timeline.json 聚合 → feed/chart_agg.js（s06 非地圖圖表用；n05 型錄實戰案例）
# 用法：python build_chart_agg.py <s06_temp_outfit 資料夾絕對路徑>
import json, sys, os
root = sys.argv[1]
tl = json.load(open(os.path.join(root, 'feed/timeline.json'), encoding='utf-8'))
# 24h 以 modeled_timeline 為底；有實測（missing=False）的小時改用實測，並標註來源
mt = tl.get('modeled_timeline', {})
H = sorted(mt) if mt else sorted(k for k in tl if k[2:3] == ':' and not tl[k].get('missing'))
src = {}
dict_ = tl.get('stations_dict', {})
meta_ = tl.get('meta', {})
tier_names = meta_.get('tier_names', ["L1_短袖防曬", "L2_透氣薄長袖", "L3_防風風衣薄外套", "L4_保暖毛衣厚外套", "L5_防風羽絨衣"])
scale = meta_.get('scale', 10)
st_keys = list(dict_.keys())

def decode_frame_stations(frame):
    if not frame or frame.get('missing'):
        return []
    if 'stations' in frame and frame['stations']:
        return frame['stations']
    if 'cols' in frame and frame['cols']:
        cols = frame['cols']
        out = []
        for i, sid in enumerate(st_keys):
            if cols['t'][i] is None and cols['ap'][i] is None:
                continue
            t_idx = cols['tier'][i] if cols.get('tier') else None
            out.append({
                'id': sid,
                'temp': cols['t'][i] / scale if cols['t'][i] is not None else None,
                'rh': float(cols['rh'][i]) if cols.get('rh') and cols['rh'][i] is not None else None,
                'wind_ms': cols['w'][i] / scale if cols.get('w') and cols['w'][i] is not None else None,
                'apparent': cols['ap'][i] / scale if cols.get('ap') and cols['ap'][i] is not None else None,
                'tier': tier_names[t_idx] if t_idx is not None and 0 <= t_idx < len(tier_names) else None,
            })
        return out
    return []

for h in H:
    if h in tl and not tl[h].get('missing') and (tl[h].get('stations') or tl[h].get('cols')): src[h] = 'observed'
    else: src[h] = 'modeled'
tl_raw = tl
tl = {h: (tl[h] if src[h] == 'observed' else mt[h]) for h in H}
# modeled_timeline 自 2026-11-03 起只存 summary：缺逐站者以 latest_frame 依 pipeline 同式（正弦日行）重算
import math, datetime
sys.path.insert(0, os.path.join(root, '..', '01_shared'))
from connectors.cwa_moenv_client import calc_apparent_temp_c, classify_outfit_tier
_lf = json.load(open(os.path.join(root, 'feed/latest_frame.json'), encoding='utf-8'))
_cur_h = datetime.datetime.fromisoformat(_lf['captured_at']).hour
def _model(h):
    out_ = []; cf = math.sin((h - 5.5) / 12.0 * math.pi)
    for st in _lf['stations']:
        t0, rh0, w0 = st['temp'], st['rh'], st['wind_ms']
        hi = st.get('daily_high') or (t0 + 2.5); lo = st.get('daily_low') or (t0 - 2.5)
        if hi < lo: hi, lo = lo, hi
        if h == _cur_h: t, rh, w = t0, rh0, w0
        else:
            t = round((hi + lo) / 2 + max(1.5, (hi - lo) / 2) * cf, 1)
            rh = max(35.0, min(98.0, round(rh0 - cf * 12.0, 1)))
            w = max(0.5, round(w0 * (1 + 0.25 * cf if cf > 0 else 1 + 0.15 * cf), 1))
        ap = calc_apparent_temp_c(t, rh, w)
        out_.append({'id': st['id'], 'temp': t, 'rh': rh, 'wind_ms': w, 'apparent': ap, 'tier': classify_outfit_tier(ap)})
    return out_
for h in H:
    if 'stations' not in tl[h]:
        dec = decode_frame_stations(tl[h])
        if dec:
            tl[h] = dict(tl[h], stations=dec)
        else:
            tl[h] = dict(tl[h], stations=_model(int(h[:2])))
tiers = sorted({s['tier'] for h in H for s in tl[h]['stations']})
agg = {}
for h in H:
    for s in tl[h]['stations']:
        a = agg.setdefault(h, {}).setdefault(s['tier'], [0, 0.0, 0.0, 0.0])
        a[0] += 1; a[1] += s['apparent']; a[2] += s['rh']; a[3] += s['temp']
heat = {"rows": tiers, "cols": [h[:2] for h in H],
        "z": [[round(agg[h].get(t, [0])[0] / max(1, tl[h]['station_count']), 3) for h in H] for t in tiers]}
bub = [{"label": h + ("實測" if src[h]=="observed" else "推估"), "points": [{"id": t, "x": round(a[1]/a[0], 1), "y": round(a[2]/a[0], 1), "r": a[0]} for t, a in agg[h].items()]} for h in H]
line = {"x": [h[:2] for h in H], "series": [
    {"name": "最低體感", "values": [tl[h]['summary']['min_apparent'] for h in H]},
    {"name": "平均體感", "values": [tl[h]['summary']['avg_apparent'] for h in H]},
    {"name": "最高體感", "values": [tl[h]['summary']['max_apparent'] for h in H]}]}
bar = [{"label": h + ("實測" if src[h]=="observed" else "推估"), "values": {t: agg[h].get(t, [0])[0] for t in tiers}} for h in H]
out = {"hour_src": src, "source": "s06_temp_outfit/feed/timeline.json", "tiers": tiers, "heat": heat, "bubble": bub, "line": line, "bar": bar}
# 實界 Choropleth：測站經緯度 → 縣市（點落多邊形，界線 01_shared/geo/tw_towns_2021_rings.js）→ 每小時縣市平均體感
def _load_towns():
    gp = os.path.join(root, '..', '01_shared', 'geo', 'tw_towns_2021_rings.js')
    t = open(gp, encoding='utf-8').read(); return json.loads(t[t.index('['):t.rindex(']') + 1])
def _pip(x, y, r):
    ins = False; n = len(r); j = n - 1
    for i in range(n):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
towns = _load_towns(); sd = tl_raw.get('stations_dict', {}); st2c = {}
for sid, m in sd.items():
    for tw in towns:
        if any(_pip(m['lon'], m['lat'], r) for r in tw['rings']): st2c[sid] = tw['county']; break
cagg = {}
for h in H:
    for s in tl[h]['stations']:
        c = st2c.get(s['id'])
        if c: a = cagg.setdefault(h, {}).setdefault(c, [0, 0.0]); a[0] += 1; a[1] += s['apparent']
out['choro'] = {"frames": [{"label": h + ("實測" if src[h]=="observed" else "推估"), "values": {c: round(a[1]/a[0], 1) for c, a in cagg.get(h, {}).items()}} for h in H]}
out['choro_meta'] = {"stations_mapped": len(st2c), "stations_total": len(sd)}
open(os.path.join(root, 'feed/chart_agg.js'), 'w', encoding='utf-8').write("/* 由 build_chart_agg.py 聚合 */\nwindow.A23_S06_AGG=" + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ";\n")
print(len(H), 'hours', len(tiers), 'tiers')
