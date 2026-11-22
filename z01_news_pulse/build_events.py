#!/usr/bin/env python3
"""z01 突發事件（斷點）建置：同一件事被多個「獨立來源」報導 → 事件。
讀 feed/latest_frame.json + feed/snapshots_*.ndjson.gz + feed/trend_v2.js(frames)；
輸出 feed/events_v2.js（window.A23_EVENTS_V2）。不改寫任何歷史檔。純標準庫。
規則（皆為 E0＝待驗證；只有 >=2 獨立來源才標 confirmed）：
  - 只看新聞源 region in (tw, intl)；arXiv/GitHub/HF/HN 不參與。
  - 標題（優先 title_zh）字元二連詞 TF-IDF 餘弦 >= SIM，單鏈聚類，首見時間差 <= WINDOW_H 小時。
  - 獨立來源：同母公司視為 1 個（WSJ=MarketWatch=Dow Jones）。
  - 更正：同網址標題在不同快照改變 → title_updates；撤回只讀 corrections.json，保留不刪除。
用法：python build_events.py            # 建置
      python build_events.py --retract <event_key> --reason "原因" [--by 姓名]   # 寫入撤回（只標記）
"""
import glob, gzip, hashlib, json, math, os, re, sys, collections
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
try:  # 主題必須用 v2 分類（與前端、消長圖一致），不能用 collector 舊 cluster_id
    from build_trend_v2 import classify as _classify, _txt as _txtv2
except Exception:
    _classify = None
FEED = os.path.join(BASE, "feed")
CORR = os.path.join(BASE, "corrections.json")
# 舊快照沒有 region 欄，故以來源名判斷「新聞源」（arXiv/GitHub/HF/HN 不參與）
NEWS_SOURCES = {"中央社", "公視", "自由時報", "Newtalk", "Google新聞", "BBC", "CNBC", "WSJ", "MarketWatch", "Bloomberg", "半島電視台"}
INDEP = {"MarketWatch": "DowJones", "WSJ": "DowJones"}
SIM = 0.22
DFCAP = 0.4
WINDOW_H = 12
LATE_MIN = 360  # 原文發布超過 6 小時才首次入河＝「晚入河」，不当突發旗標
# stale=True 只代表「資料集第一張快照的初始積壓」；其餘以河中首見時間定位，並記 delay_min（原文發布→河中首見）
RULE_TEXT = "標題相似度≥%.2f 且 ≥2 個獨立來源（同母公司算 1 個）；自動判定一律待驗證" % SIM
LOCAL = timezone(timedelta(hours=8))
try:  # 漣漪圈（提及擴散）；失敗不影響事件主流程
    import ripple as _rp
except Exception:
    _rp = None


def _local(iso):
    """ISO（含時區）→ 本地 'YYYY-MM-DD HH:MM'；失敗回 None。"""
    try:
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(LOCAL).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return None


def _title(a):
    return a.get("title_zh") or a.get("title") or ""


def _feats(a):
    t = _title(a).lower()
    f = collections.Counter()
    for run in re.findall(r"[一-鿿]+", t):
        for i in range(len(run) - 1):
            f[run[i:i + 2]] += 1
    for w in re.findall(r"[a-z0-9]{3,}", t):
        if not w.isdigit() and (_rp is None or w not in getattr(_rp, "EN_STOP", set())):
            f[w] += 1
    return f


def _load_snaps():
    out = []
    for fp in sorted(glob.glob(os.path.join(FEED, "snapshots_*.ndjson.gz"))):
        with gzip.open(fp, "rt", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    try:
                        out.append(json.loads(line))
                    except Exception:
                        pass
    for fp in sorted(glob.glob(os.path.join(FEED, "snapshots", "*", "*.json"))):
        try:
            with open(fp, "r", encoding="utf-8") as fh:
                out.append(json.load(fh))
        except Exception:
            pass
    return out


def title_updates(snaps):
    """同網址原標題在不同快照改變 → {url: [{at,title}...]}（只標記，不改寫）。"""
    seen = {}
    for s in sorted(snaps, key=lambda x: x.get("captured_at", "")):
        for a in s.get("articles", []):
            u, t = a.get("url"), a.get("title")
            if not u or not t:
                continue
            h = seen.setdefault(u, [])
            if not h or h[-1][1] != t:
                h.append((s.get("captured_at", ""), t))
    return {u: [{"at": at, "title": t} for at, t in h] for u, h in seen.items() if len(h) > 1}


def load_corrections():
    try:
        return json.load(open(CORR, encoding="utf-8")).get("retractions", [])
    except Exception:
        return []


def retract(key, reason, by):
    data = {"retractions": load_corrections()}
    data["retractions"].append({"event_key": key, "reason": reason, "by": by,
                                "on": datetime.now().strftime("%Y-%m-%d %H:%M")})
    json.dump(data, open(CORR, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("已寫入撤回（只標記，事件保留）:", key)


def cluster(arts):
    n = len(arts)
    F = [_feats(a) for a in arts]
    df = collections.Counter()
    for f in F:
        df.update(f.keys())
    V = [{k: v * math.log((n + 1) / (df[k] + 0.5)) for k, v in f.items() if df[k] <= n * DFCAP} for f in F]
    nm = [math.sqrt(sum(x * x for x in v.values())) or 1.0 for v in V]
    par = list(range(n))

    def find(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    for i in range(n):
        for j in range(i + 1, n):
            ti, tj = arts[i]["_t"], arts[j]["_t"]
            if ti is not None and tj is not None and abs((ti - tj).total_seconds()) > WINDOW_H * 3600:
                continue
            s = sum(x * V[j].get(k, 0) for k, x in V[i].items()) / (nm[i] * nm[j])
            if s >= SIM:
                par[find(i)] = find(j)
    groups = collections.defaultdict(list)
    for i in range(n):
        groups[find(i)].append(i)
    return list(groups.values())


def main():
    latest = json.load(open(os.path.join(FEED, "latest_frame.json"), encoding="utf-8"))
    snaps = _load_snaps()
    upd = title_updates(snaps)
    # 文章池：最新幀＋歷史快照（以 url 去重，保留最早首見）
    pool, first_cap = {}, {}
    for s in sorted(snaps, key=lambda x: x.get("captured_at", "")) + [latest]:
        for a in s.get("articles", []):
            u = a.get("url")
            if not u or a.get("source") not in NEWS_SOURCES:
                continue
            first_cap.setdefault(u, s.get("captured_at", ""))
            pool[u] = a
    arts = []
    for u, a in pool.items():
        b = dict(a)
        iso = a.get("ts") or a.get("fetched_at")
        b["_t"] = None
        try:
            d = datetime.fromisoformat((iso or "").replace("Z", "+00:00"))
            b["_t"] = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            pass
        arts.append(b)
    retracted = {r["event_key"]: r for r in load_corrections()}
    FIRST_CAP = min(first_cap.values()) if first_cap else ""

    # 幀（供前後對照）
    frames = []
    try:
        t = open(os.path.join(FEED, "trend_v2.js"), encoding="utf-8").read()
        frames = json.loads(t[t.index("{"):t.rindex("}") + 1]).get("frames", [])
    except Exception:
        pass

    def share(frame, tid):
        if not frame or frame.get("missing"):
            return None
        tot = sum(sum(r) for r in frame["counts"])
        return None if tot == 0 else (sum(frame["counts"][tid]), tot)

    events, ev_idx = [], []
    tid_of = [(_classify(_txtv2(a), a.get("source")) if _classify else a.get("cluster_id")) for a in arts]
    groups_idx = cluster(arts)
    ctx = None
    if _rp:
        try:
            ctx = _rp.Ctx(arts, _local)
            groups_idx = _rp.merge_groups(ctx, groups_idx, tid_of)
        except Exception as ex:
            print("ripple merge 失敗（沿用原聚類）：", ex)
            ctx = None
    for g in groups_idx:
        if len(g) < 2:
            continue
        mem = sorted((arts[i] for i in g), key=lambda a: (a["_t"] is None, a["_t"] or datetime.max.replace(tzinfo=timezone.utc)))
        groups = {INDEP.get(a["source"], a["source"]) for a in mem}
        status = "confirmed" if len(groups) >= 2 else "pending"
        key = hashlib.sha1(mem[0]["url"].encode()).hexdigest()[:10]
        first = _local(mem[0].get("ts") or mem[0].get("fetched_at") or "") or ""
        cap0 = min((first_cap.get(a["url"], "9") for a in mem))
        cap0 = cap0 if cap0 != "9" else ""
        # 初始積壓：首次入快照就是資料集第一張快照，無法判斷是否突發 → 不畫旗標
        stale = (cap0 == FIRST_CAP)
        delay = None
        try:
            delay = int((datetime.strptime(cap0, "%Y-%m-%d %H:%M:%S") - datetime.strptime(first, "%Y-%m-%d %H:%M")).total_seconds() // 60)
        except Exception:
            pass
        if _classify:
            tid_c = collections.Counter(_classify(_txtv2(a), a.get("source")) for a in mem)
        else:
            tid_c = collections.Counter(a.get("cluster_id") for a in mem)
        tid_c.pop(-1, None)
        tid_c.pop(None, None)
        tid = tid_c.most_common(1)[0][0] if tid_c else -1
        srcs = []
        seen_g = set()
        for a in mem:
            gname = INDEP.get(a["source"], a["source"])
            srcs.append({"source": a["source"], "group": gname, "title": a.get("title", ""), "title_zh": a.get("title_zh"),
                         "url": a["url"], "at": _local(a.get("ts") or a.get("fetched_at") or ""),
                         "new_group": gname not in seen_g, "title_updates": upd.get(a["url"], [])})
            seen_g.add(gname)
        # 前後對照（事實對照，不下因果）
        impact = None
        if tid >= 0 and cap0 and not stale:
            idx = next((k for k, f in enumerate(frames) if f["timestamp"][:13] == cap0[:13]), None)
            if idx is not None:
                prev = [share(frames[k], tid) for k in range(max(0, idx - 3), idx)]
                prev = [p for p in prev if p]
                at = share(frames[idx], tid)
                now = share(frames[-1], tid)
                if prev and at and now:
                    pc = sum(p[0] for p in prev) / len(prev)
                    ps = sum(p[0] / p[1] for p in prev) / len(prev)
                    impact = {"before_n": len(prev), "before_cnt": round(pc, 1), "before_share": round(ps * 100, 1),
                              "at_cnt": at[0], "at_share": round(at[0] / at[1] * 100, 1),
                              "now_cnt": now[0], "now_share": round(now[0] / now[1] * 100, 1),
                              "src_count": len(groups)}
        ev = {"key": key, "status": status, "topic": tid, "first_seen": first, "captured": cap0, "hour": cap0[:13], "stale": stale, "delay_min": delay, "late": bool(delay is not None and delay > LATE_MIN),
              "title": _title(mem[0]), "n_articles": len(mem), "n_groups": len(groups),
              "sources": srcs, "impact": impact, "has_title_update": any(s["title_updates"] for s in srcs)}
        if key in retracted:
            ev["retracted"] = retracted[key]
        events.append(ev)
        ev_idx.append((ev, g))
    if ctx is not None:
        span_h = None
        try:
            span_h = round((datetime.strptime(str(latest.get("captured_at"))[:19].replace("T", " "), "%Y-%m-%d %H:%M:%S") - datetime.strptime(FIRST_CAP, "%Y-%m-%d %H:%M:%S")).total_seconds() / 3600, 1)
        except Exception:
            pass
        for ev, g in ev_idx:
            try:
                ev["ripple"] = _rp.build_ripple(ctx, g, tid_of, ev["topic"], span_h)
            except Exception as ex:
                print("ripple 失敗", ev["key"], ex)
    events.sort(key=lambda e: e["first_seen"])
    out = {"built_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "rule": RULE_TEXT,
           "evidence": "E0（自動判定，待驗證）", "events": events}
    with open(os.path.join(FEED, "events_v2.js"), "w", encoding="utf-8") as f:
        f.write("// Auto-generated by build_events.py\nwindow.A23_EVENTS_V2 = ")
        json.dump(out, f, ensure_ascii=False)
        f.write(";\n")
    nc = sum(1 for e in events if e["status"] == "confirmed")
    print("events_v2: 事件 %d（已確認 %d／待確認 %d，撤回 %d，標題更新 %d）" % (
        len(events), nc, len(events) - nc, sum(1 for e in events if e.get("retracted")),
        sum(1 for e in events if e["has_title_update"])))


if __name__ == "__main__":
    if "--retract" in sys.argv:
        a = sys.argv
        k = a[a.index("--retract") + 1]
        r = a[a.index("--reason") + 1] if "--reason" in a else "未填"
        b = a[a.index("--by") + 1] if "--by" in a else "Owner"
        retract(k, r, b)
    main()
