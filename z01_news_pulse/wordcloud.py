# -*- coding: utf-8 -*-
"""z01 文字雲封面條資料：輸出 feed/wordcloud_v2.js（window.A23_WORDCLOUD_V2）。
詞＝ripple.py 的標題特徵詞（簡繁正規化＋停用表）；大小＝近 24 小時含該詞的新聞篇數；
色＝該詞文章最多的主題；mixed(◐)＝分散 ≥3 主題且單一主題 <60%；delta＝前後半段變化。
時間軸＝全期間 3 小時一桶（Asia/Taipei 對齊 00/03/06...），輸出 buckets、bucket_n、每詞 series 與 surge。
語境＝依事件（events_v2.js 的 key）分組，無事件者依主題；代表「最新 24h」，不判因果（E0 待驗證）。
由 build_trend_v2.py 結尾呼叫；失敗不影響河流。純標準庫。"""
import collections, hashlib, json, math, os, sys
from datetime import datetime, timedelta, timezone

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
import build_events as be
import ripple as rp
import build_trend_v2 as bt

MAXW, MINDF, WIN_H = 20, 6, 24
MAX_UNION = 24             # 24h top20 與全期間 top20 聯集上限
MAXG, MAXI = 3, 8          # 每詞最多 3 個語境、每語境最多 8 則
STOP_JSON = os.path.join(BASE, "stopwords_v2.json")
if os.path.exists(STOP_JSON):
    try:
        _sj = json.load(open(STOP_JSON, encoding="utf-8"))
        WC_STOP = set()
        for _cat in ("units_and_quantities", "vague_roles_and_domains", "vague_actions_and_campaigns", "fragments_and_grammar"):
            WC_STOP.update(_sj.get(_cat, []))
    except Exception:
        WC_STOP = set()
else:
    WC_STOP = set('下跌 上漲 增長 投資 政策 市場 公司 全球 企業 報告 美國 中國 台灣 日本 今年 預期 大幅 表示 專家 分析 可能 影響 美元指 控制 支持 調查 要求 呼籲 批評 表態 質疑 強調 爭取 推動 引發 恐遭 遭指 成立 掃街 市長 科技 經濟 美元 股市 總統 議員 候選 候選人 中心 預算 消息 相關 方案 計劃 面臨 最新 走勢 情況 says huang 億美元 億元'.split())
JACC = 0.70                # 與已選詞文章集合重疊 >70% 視為同一詞的碎片


def _pool():
    latest_path = os.path.join(be.FEED, "latest_frame.json")
    latest = json.load(open(latest_path, encoding="utf-8")) if os.path.exists(latest_path) else {}
    pool = {}
    for s in sorted(be._load_snaps(), key=lambda x: x.get("captured_at", "")) + ([latest] if latest else []):
        for a in s.get("articles", []):
            if a.get("url") and a.get("source") in be.NEWS_SOURCES:
                pool[a["url"]] = a
    arts = []
    for a in pool.values():
        b = dict(a); b["_t"] = None
        try:
            d = datetime.fromisoformat((a.get("ts") or a.get("fetched_at") or "").replace("Z", "+00:00"))
            b["_t"] = d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            pass
        arts.append(b)
    return arts


def _candidates(ctx, max_w=20, min_df=6):
    n = ctx.n
    NT = ctx.NT
    cjk = lambda ch: "\u4e00" <= ch <= "\u9fff"

    def extend(k, dset):
        if not all(cjk(c) for c in k): return k
        sub = list(dset)
        for side in ("R", "L"):
            while len(k) < 6:
                cc = collections.Counter()
                for i in sub:
                    j = NT[i].find(k)
                    if j < 0: continue
                    ch = NT[i][j + len(k)] if side == "R" and j + len(k) < len(NT[i]) else (NT[i][j - 1] if side == "L" and j > 0 else "")
                    cc[ch] += 1
                if not cc: break
                ch, c0 = cc.most_common(1)[0]
                if ch and cjk(ch) and c0 >= 0.60 * len(sub): k = k + ch if side == "R" else ch + k
                else: break
        return k

    cand = [(k, c) for k, c in ctx.df.most_common(500) if c >= min_df and len(k) >= 2 and k not in WC_STOP]
    extended_cand = []
    for k, c in cand:
        d0 = {i for i in range(n) if k in ctx.FS[i]}
        lab = extend(k, d0)
        if lab not in WC_STOP and len(lab) >= 2:
            score = c * (math.sqrt(len(lab)) if all(cjk(x) for x in lab) else 1.0)
            extended_cand.append((lab, d0, score, c))

    extended_cand.sort(key=lambda x: -x[2])

    chosen, used = [], set()
    for lab, d0, score, c in extended_cand:
        if lab in used or lab in WC_STOP: continue
        dd = {i for i in range(n) if lab in NT[i]} if all(cjk(x) for x in lab) else d0
        if len(dd) < min_df: continue
        if any(len(dd & d1) / len(dd | d1) > JACC for _, d1 in chosen): continue
        if any(len(lab) >= 4 and len(l1) >= 4 and (lab[-3:] == l1[-3:] or lab[:3] == l1[:3]) and len(dd & d1) / len(dd | d1) > 0.35 for l1, d1 in chosen): continue
        chosen.append((lab, dd)); used.add(lab)
        if len(chosen) >= max_w: break
    return chosen, used


def main():
    arts_all = _pool()
    if not arts_all:
        print("wordcloud: 無文章，略過"); return

    ts_all = [a["_t"] for a in arts_all if a["_t"]]
    if not ts_all:
        print("wordcloud: 無時間戳文章，略過"); return

    # 1. 24h 子集
    tref = max(ts_all)
    arts_24h = [a for a in arts_all if a["_t"] and a["_t"] >= tref - timedelta(hours=WIN_H)]
    if not arts_24h:
        arts_24h = arts_all

    ctx_all = rp.Ctx(arts_all, be._local)
    ctx_24h = rp.Ctx(arts_24h, be._local)
    n_24h = ctx_24h.n
    cjk = lambda ch: "\u4e00" <= ch <= "\u9fff"

    # 2. 時間桶：3 小時一格（本地時間 Asia/Taipei，對齊 00/03/06...）
    ts_local = [a["_t"].astimezone(be.LOCAL) for a in arts_all if a["_t"]]
    t_min, t_max = min(ts_local), max(ts_local)
    cur = t_min.replace(hour=(t_min.hour // 3) * 3, minute=0, second=0, microsecond=0)
    buckets, bucket_intervals = [], []
    while cur <= t_max:
        b_end = cur + timedelta(hours=3)
        buckets.append(cur.strftime("%m-%d %H:%M"))
        bucket_intervals.append((cur, b_end))
        cur = b_end

    bucket_n = [sum(1 for dt in ts_local if b_start <= dt < b_end) for b_start, b_end in bucket_intervals]

    # 3. 詞表：24h top20 + 全期間 top20 聯集（上限 24 詞，保持去重）
    c_24h, used_24h = _candidates(ctx_24h, max_w=MAXW, min_df=MINDF)
    c_all, used_all = _candidates(ctx_all, max_w=MAXW, min_df=MINDF)

    chosen_merged = list(c_24h)
    used_merged = set(used_24h)
    for lab, dd_all in c_all:
        if lab in used_merged: continue
        dd = {i for i in range(ctx_all.n) if lab in ctx_all.NT[i]} if all(cjk(x) for x in lab) else {i for i in range(ctx_all.n) if lab in ctx_all.FS[i]}
        overlap = False
        for l1, _ in chosen_merged:
            dd1 = {i for i in range(ctx_all.n) if l1 in ctx_all.NT[i]} if all(cjk(x) for x in l1) else {i for i in range(ctx_all.n) if l1 in ctx_all.FS[i]}
            if len(dd | dd1) > 0 and len(dd & dd1) / len(dd | dd1) > JACC:
                overlap = True; break
            if len(lab) >= 4 and len(l1) >= 4 and (lab[-3:] == l1[-3:] or lab[:3] == l1[:3]) and len(dd | dd1) > 0 and len(dd & dd1) / len(dd | dd1) > 0.35:
                overlap = True; break
        if overlap: continue
        chosen_merged.append((lab, dd))
        used_merged.add(lab)
        if len(chosen_merged) >= MAX_UNION: break

    # 4. 24h 語境與事件成員準備
    tid_24h = [be._classify(be._txtv2(a), a.get("source")) for a in arts_24h]
    try:
        t = open(os.path.join(be.FEED, "events_v2.js"), encoding="utf-8").read()
        evs = {e["key"]: e for e in json.loads(t[t.index("{"):t.rindex("}") + 1]).get("events", [])}
    except Exception:
        evs = {}
    ev_of = {}
    try:
        groups = rp.merge_groups(ctx_24h, be.cluster(arts_24h), tid_24h)
        for g in groups:
            if len(g) < 2: continue
            mem = sorted(g, key=lambda i: (arts_24h[i]["_t"] is None, arts_24h[i]["_t"] or datetime.max.replace(tzinfo=timezone.utc)))
            k = hashlib.sha1(arts_24h[mem[0]]["url"].encode()).hexdigest()[:10]
            if k in evs:
                for i in g: ev_of[i] = k
    except Exception as ex:
        print("wordcloud: 事件分群略過：", ex)

    mid_24h = sorted(a["_t"] for a in arts_24h if a["_t"])[len([1 for a in arts_24h if a["_t"]]) // 2] if arts_24h else None
    names = {t_["id"]: t_["name"] for t_ in bt.TOPICS}

    words = []
    for lab, _ in chosen_merged:
        # (a) 全期間 series 與 surge
        matching_all = {i for i in range(ctx_all.n) if lab in ctx_all.NT[i]} if all(cjk(x) for x in lab) else {i for i in range(ctx_all.n) if lab in ctx_all.FS[i]}
        series = []
        for b_start, b_end in bucket_intervals:
            cnt = sum(1 for i in matching_all if arts_all[i]["_t"] and b_start <= arts_all[i]["_t"].astimezone(be.LOCAL) < b_end)
            series.append(cnt)
        surge = [0]
        for t in range(1, len(series)):
            p, c = series[t - 1], series[t]
            surge.append(1 if (c >= 2 * p and c >= 3) else 0)

        total_n = sum(series)

        # (b) 24h 語境與既有欄位
        dd_24h = {i for i in range(n_24h) if lab in ctx_24h.NT[i]} if all(cjk(x) for x in lab) else {i for i in range(n_24h) if lab in ctx_24h.FS[i]}
        c_24h = len(dd_24h)

        if c_24h > 0:
            idx = sorted(dd_24h, key=lambda i: (arts_24h[i]["_t"] is None, arts_24h[i]["_t"]), reverse=True)
            tc = collections.Counter(tid_24h[i] for i in idx)
            top, topn = tc.most_common(1)[0]
            mixed = len([x for x in tc if x >= 0]) >= 3 and topn / c_24h < 0.6
            a1 = sum(1 for i in idx if mid_24h and arts_24h[i]["_t"] and arts_24h[i]["_t"] < mid_24h)
            a2 = sum(1 for i in idx if mid_24h and arts_24h[i]["_t"] and arts_24h[i]["_t"] >= mid_24h)
            delta = 1 if a2 - a1 >= 3 and a2 >= 1.5 * max(a1, 1) else (-1 if a1 - a2 >= 3 and a1 >= 1.5 * max(a2, 1) else 0)

            gl = []
            evg = collections.OrderedDict()
            for i in idx:
                if i in ev_of: evg.setdefault(ev_of[i], []).append(i)
            for ek, mem in evg.items(): gl.append(("event", evs[ek]["title"], mem))
            rest = [i for i in idx if i not in ev_of]
            for _ in range(MAXG):
                if len(rest) < 4: break
                cc = collections.Counter()
                for i in rest:
                    for f in ctx_24h.FS[i]:
                        if f not in WC_STOP and f not in lab and len(f) >= 2: cc[f] += 1
                pick = next(((f, v) for f, v in cc.most_common(40) if 3 <= v <= 0.85 * len(rest) and f not in lab), None)
                if not pick: break
                sub_fs = {i for i in rest if pick[0] in ctx_24h.FS[i]}
                # 延伸共現詞
                co = pick[0]
                if all(cjk(x) for x in co):
                    sub = list(sub_fs)
                    for side in ("R", "L"):
                        while len(co) < 6:
                            ccc = collections.Counter()
                            for i in sub:
                                j = ctx_24h.NT[i].find(co)
                                if j < 0: continue
                                ch = ctx_24h.NT[i][j + len(co)] if side == "R" and j + len(co) < len(ctx_24h.NT[i]) else (ctx_24h.NT[i][j - 1] if side == "L" and j > 0 else "")
                                ccc[ch] += 1
                            if not ccc: break
                            ch, c0 = ccc.most_common(1)[0]
                            if ch and cjk(ch) and c0 >= 0.75 * len(sub): co = co + ch if side == "R" else ch + co
                            else: break
                mem = [i for i in rest if co in ctx_24h.NT[i]] if all(cjk(x) for x in co) else [i for i in rest if pick[0] in ctx_24h.FS[i]]
                if len(mem) < 3: break
                gl.append(("topic", "與「%s」共現" % co, mem)); rest = [i for i in rest if i not in set(mem)]
            if rest:
                top_unc = collections.Counter(tid_24h[i] for i in rest).most_common(1)[0][0]
                gl.append(("topic", "其他（以「%s」為主）" % names.get(top_unc, "未分類"), rest))
            ctxs = [{"kind": kd, "label": lb, "n": len(mem), "items": [{"t": be._title(arts_24h[i])[:80], "s": arts_24h[i].get("source", ""), "u": arts_24h[i]["url"]} for i in mem[:MAXI]]}
                    for kd, lb, mem in sorted(gl, key=lambda x: -len(x[2]))[:MAXG]]
        else:
            # 24h 內無篇數時的回退
            all_tids = [be._classify(be._txtv2(arts_all[i]), arts_all[i].get("source")) for i in matching_all]
            tc = collections.Counter(all_tids)
            top = tc.most_common(1)[0][0] if tc else -1
            mixed, a1, a2, delta, ctxs = False, 0, 0, 0, []

        words.append({
            "w": lab, "n": c_24h, "total_n": total_n, "topic": top,
            "mixed": mixed, "delta": delta, "a1": a1, "a2": a2, "ctx": ctxs,
            "series": series, "surge": surge
        })

    # 詞序固定：依全期間總篇數排序
    words.sort(key=lambda w: (-w["total_n"], -w["n"], w["w"]))

    hrs = round((max(ts_all) - min(ts_all)).total_seconds() / 3600, 1) if ts_all else 0
    out = {
        "built_at": datetime.now(be.LOCAL).strftime("%Y-%m-%d %H:%M:%S"),
        "window_h": WIN_H, "span_h": hrs, "pool": n_24h, "pool_all": len(arts_all),
        "evidence": "E0（標題共現／事件成員，不判因果，待驗證）",
        "buckets": buckets, "bucket_n": bucket_n,
        "words": words
    }
    with open(os.path.join(be.FEED, "wordcloud_v2.js"), "w", encoding="utf-8") as f:
        f.write("// Auto-generated by wordcloud.py\nwindow.A23_WORDCLOUD_V2 = ")
        json.dump(out, f, ensure_ascii=False); f.write(";\n")
    print("wordcloud: %d 詞（24h池 %d、全池 %d 則、%d 桶、資料跨度 %s 小時）：%s" % (
        len(words), n_24h, len(arts_all), len(buckets), hrs, " ".join(w["w"] for w in words[:10])))


if __name__ == "__main__":
    main()
