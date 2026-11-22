# 第 1 批台灣資料圖型（#24 Gauge／#4 Donut／#5 Histogram／#18 Box）→ data_batch4.js
# 資料：s02 tide_timeline.json（24h）＋ s06 snapshots_YYYYMMDD.ndjson.gz（CWA 實測快照，source_mode=live）
# 用法：python build_batch4_data.py <A23_Data_Atlas 根目錄絕對路徑> [s06 快照日期 YYYYMMDD]
import json, sys, os, gzip, glob
root = sys.argv[1]
# ---- #24 Gauge：s02 全市滿載率×24h（可借車/總車柱），副值＝缺車站（ratio<0.2）數
tl = json.load(open(os.path.join(root, 's02_youbike_tide/feed/tide_timeline.json'), encoding='utf-8'))
gauge = []
for h in sorted(tl):
    st = tl[h]['stations']; b = sum(s['available_bikes'] for s in st); c = sum(s['capacity'] for s in st)
    gauge.append({"label": h, "value": round(b / max(1, c), 3), "low": sum(1 for s in st if s['ratio'] < 0.2), "high": sum(1 for s in st if s['ratio'] > 0.9), "n": len(st)})
# ---- s06 實測快照（同分鐘去重）
fs = sorted(glob.glob(os.path.join(root, 's06_temp_outfit/feed/snapshots_%s.ndjson.gz' % (sys.argv[2] if len(sys.argv) > 2 else '*'))))
snaps = {}
for f in fs:
    for l in gzip.open(f, 'rt', encoding='utf-8'):
        j = json.loads(l)
        if j.get('source_mode') != 'live' or not j.get('stations'): continue
        snaps[j['captured_at'][:16]] = j
K = sorted(snaps)
# 測站 → 縣市（點落多邊形；界線同 build_chart_agg.py）
gp = os.path.join(root, '01_shared/geo/tw_towns_2021_rings.js'); t = open(gp, encoding='utf-8').read()
towns = json.loads(t[t.index('['):t.rindex(']') + 1])
def pip(x, y, r):
    ins = False; j = len(r) - 1
    for i in range(len(r)):
        xi, yi = r[i]; xj, yj = r[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: ins = not ins
        j = i
    return ins
st2c = {}; lat = {}
for k in K:
    for s in snaps[k]['stations']:
        if s['id'] in st2c: continue
        for tw in towns:
            if any(pip(s['lon'], s['lat'], r) for r in tw['rings']): st2c[s['id']] = tw['county']; break
        lat.setdefault(st2c.get(s['id']), []).append(s['lat'])
lab = lambda k: k[11:16]
# ---- #4 Donut：s06 穿搭級距佔比（測站數）
tiers = sorted({s['tier'] for k in K for s in snaps[k]['stations'] if s.get('tier')})
donut = [{"label": lab(k), "values": {ti: sum(1 for s in snaps[k]['stations'] if s.get('tier') == ti) for ti in tiers}} for k in K]
# ---- #5 Histogram：s06 全台測站體感溫度原始值
hist = [{"label": lab(k), "values": [s['apparent'] for s in snaps[k]['stations'] if s.get('apparent') is not None]} for k in K]
# ---- #18 Box：s06 各縣市體感五數（只取 ≥15 站縣市，北→南）
def q(a, p):
    i = (len(a) - 1) * p; f = int(i); return a[f] + (a[min(f + 1, len(a) - 1)] - a[f]) * (i - f)
cnt = {}
for s in snaps[K[-1]]['stations']:
    c = st2c.get(s['id']); cnt[c] = cnt.get(c, 0) + 1
G = sorted([c for c, n in cnt.items() if c and n >= 15], key=lambda c: -sum(lat[c]) / len(lat[c]))
box = []
for k in K:
    by = {}
    for s in snaps[k]['stations']:
        c = st2c.get(s['id'])
        if c in G and s.get('apparent') is not None: by.setdefault(c, []).append(s['apparent'])
    stats = []
    for c in G:
        a = sorted(by.get(c, [])); stats.append({"lo": a[0], "q1": round(q(a, .25), 1), "med": round(q(a, .5), 1), "q3": round(q(a, .75), 1), "hi": a[-1], "n": len(a)} if a else None)
    box.append({"label": lab(k), "stats": stats})
out = {"gauge": {"frames": gauge, "note": "s02 全市可借車/車柱；缺車＝站點<20%"},
       "donut": {"frames": donut, "note": "s06 CWA 實測快照 %d 筆（%s–%s）" % (len(K), lab(K[0]), lab(K[-1]))},
       "hist": {"frames": hist, "note": "s06 全台測站體感溫度（實測）"},
       "box": {"groups": G, "frames": box, "note": "s06 各縣市測站體感（實測，≥15 站）"},
       "meta": {"s06_snapshots": K, "s06_mapped": len(st2c), "s02_hours": len(gauge)}}
open(os.path.join(root, '01_shared/viz_core/charts/demo/data_batch4.js'), 'w', encoding='utf-8').write(
    "/* 由 build_batch4_data.py 產生：s02 24h＋s06 CWA 實測快照（勿手改） */\nwindow.A23_DEMO_B4=" + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ";\n")
print('s02 hours', len(gauge), '| s06 snaps', len(K), K[0], '→', K[-1], '| mapped', len(st2c), '| box counties', G)
