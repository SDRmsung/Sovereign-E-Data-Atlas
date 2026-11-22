# 由 s02 tide_timeline.json 聚合出 5 種圖表的示範資料 → data_s02.js
# 用法：python build_demo_data.py <A23_Data_Atlas 根目錄絕對路徑>
import json, sys, os
root = sys.argv[1]
tl = json.load(open(os.path.join(root, 's02_youbike_tide/feed/tide_timeline.json'), encoding='utf-8'))
H = sorted(tl); dh = {}
for h in H:
    for s in tl[h]['stations']:
        a = dh.setdefault(h, {}).setdefault(s['district'], [0, 0, 0, 0, 0.0, 0.0])
        a[0] += s['available_bikes']; a[1] += s['capacity']; a[2] += 1 if s['ratio'] < 0.2 else 0; a[3] += 1; a[4] += s['lon']; a[5] += s['lat']
D = sorted({d for h in dh for d in dh[h]}, key=lambda d: -dh[H[0]].get(d, [0, 0])[1])[:10]
bar = [{"label": h, "values": {d: dh[h][d][0] for d in D if d in dh[h]}} for h in H]
bub = [{"label": h, "points": [{"id": d, "x": round(100*dh[h][d][0]/max(1, dh[h][d][1]), 1), "y": round(100*dh[h][d][2]/max(1, dh[h][d][3]), 1), "r": dh[h][d][0]} for d in D if d in dh[h]]} for h in H]
heat = {"rows": D, "cols": [h[:2] for h in H], "z": [[round(dh[h][d][0]/max(1, dh[h][d][1]), 3) if d in dh[h] else 0 for h in H] for d in D]}
h8 = '08:00' if '08:00' in tl else H[min(8, len(H)-1)]
st = tl[h8]['stations']; top = D[:6]
dm = lambda x: x if x in top else '其他區'
types = sorted({s['type'] for s in st}); labs = sorted({s['status_label'] for s in st})
nodes = [{"id": "類型:"+t, "layer": 0} for t in types] + [{"id": d, "layer": 1} for d in top+['其他區']] + [{"id": l, "layer": 2} for l in labs]
L1 = {}; L2 = {}
for s in st:
    k = ("類型:"+s['type'], dm(s['district'])); L1[k] = L1.get(k, 0)+1
    k = (dm(s['district']), s['status_label']); L2[k] = L2.get(k, 0)+1
links = [{"s": a, "t": b, "v": v} for (a, b), v in list(L1.items())+list(L2.items())]
used = {l['s'] for l in links} | {l['t'] for l in links}
nodes = [n for n in nodes if n['id'] in used]
ha, hb = ('09:00' if '09:00' in tl else H[0]), ('18:00' if '18:00' in tl else H[-1])
cent = {d: [dh[ha][d][4]/dh[ha][d][3], dh[ha][d][5]/dh[ha][d][3]] for d in D if d in dh[ha]}
delta = {d: dh[hb][d][0]-dh[ha][d][0] for d in cent if d in dh[hb]}
los = sorted([[d, -v] for d, v in delta.items() if v < 0], key=lambda x: -x[1]); gai = sorted([[d, v] for d, v in delta.items() if v > 0], key=lambda x: -x[1])
arcs = []; i = j = 0
while i < len(los) and j < len(gai):
    m = min(los[i][1], gai[j][1])
    if m > 0: arcs.append({"from": los[i][0], "to": gai[j][0], "v": m})
    los[i][1] -= m; gai[j][1] -= m
    if los[i][1] <= 0: i += 1
    if gai[j][1] <= 0: j += 1
fm = {"nodes": [{"name": d, "lon": cent[d][0], "lat": cent[d][1]} for d in cent], "arcs": arcs, "note": "推估淨流量 %s→%s（由區間車輛淨增減配對，非實測 OD）" % (ha, hb)}

# ---- 第二批：line / choropleth(Voronoi 示意格) / network(相關性) ----
import math
rat = {d: [dh[h][d][0]/max(1, dh[h][d][1]) if d in dh[h] else 0 for h in H] for d in D}
line = {"x": [h[:2] for h in H], "series": [{"name": d, "values": [round(v, 3) for v in rat[d]]} for d in D[:5]]}
k0 = math.cos(math.radians(sum(c[1] for c in cent.values())/len(cent)))
sites = {d: (cent[d][0]*k0, cent[d][1]) for d in cent}
xs = [p[0] for p in sites.values()]; ys = [p[1] for p in sites.values()]
px = (max(xs)-min(xs))*0.25; py = (max(ys)-min(ys))*0.25
box = [[min(xs)-px, min(ys)-py], [max(xs)+px, min(ys)-py], [max(xs)+px, max(ys)+py], [min(xs)-px, max(ys)+py]]
def clip(poly, a, b, c):
    out = []
    for i in range(len(poly)):
        p = poly[i]; q = poly[(i+1) % len(poly)]
        fp = a*p[0]+b*p[1]-c; fq = a*q[0]+b*q[1]-c
        if fp <= 0: out.append(p)
        if fp*fq < 0:
            t = fp/(fp-fq); out.append([p[0]+t*(q[0]-p[0]), p[1]+t*(q[1]-p[1])])
    return out
feats = []
for d, (xi, yi) in sites.items():
    poly = box
    for e, (xj, yj) in sites.items():
        if e != d: poly = clip(poly, 2*(xj-xi), 2*(yj-yi), xj*xj+yj*yj-xi*xi-yi*yi)
    feats.append({"name": d, "ring": [[round(x/k0, 5), round(y, 5)] for x, y in poly]})
choro = {"features": feats, "frames": [{"label": h, "values": {d: round(rat[d][i], 3) for d in cent}} for i, h in enumerate(H)]}
def pear(a, b):
    n = len(a); ma = sum(a)/n; mb = sum(b)/n
    sa = math.sqrt(sum((x-ma)**2 for x in a)); sb = math.sqrt(sum((x-mb)**2 for x in b))
    return sum((x-ma)*(y-mb) for x, y in zip(a, b))/(sa*sb) if sa*sb else 0
edges = []
for i in range(len(D)):
    for j in range(i+1, len(D)):
        r = pear(rat[D[i]], rat[D[j]])
        if abs(r) >= 0.7: edges.append({"s": D[i], "t": D[j], "w": round(abs(r), 3), "neg": r < 0})
net = {"nodes": [{"id": d, "w": sum(dh[h][d][0] for h in H if d in dh[h])} for d in D], "edges": edges}
out = {"line": line, "choro": choro, "net": net, "source": "s02_youbike_tide/feed/tide_timeline.json", "hours": len(H), "districts": D, "sankey_hour": h8, "bar": bar, "bubble": bub, "heat": heat, "sankey": {"nodes": nodes, "links": links}, "flow": fm}
open(os.path.join(root, '01_shared/viz_core/charts/demo/data_s02.js'), 'w', encoding='utf-8').write("/* 由 build_demo_data.py 聚合自 s02 tide_timeline.json */\nwindow.A23_DEMO_S02=" + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ";\n")
print('edges',len(edges),'feats',len(feats),'arcs', len(arcs), 'nodes', len(nodes), 'links', len(links), ha, hb)
