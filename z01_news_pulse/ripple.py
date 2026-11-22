# -*- coding: utf-8 -*-
"""z01 漣漪圈：核心詞抽取、事件合併、提及擴散（只看標題實際提到什麼；E0 待驗證，不下因果）。
由 build_events.py 匯入；任何失敗由呼叫端捕捉，不影響事件主流程。"""
import collections, math, re
from datetime import timedelta

WINDOW_H = 24      # 漣漪統計窗（小時）
K_TERMS = 16       # 每事件核心二字詞上限
DF_RATIO = 0.30    # 核心詞在全池標題的占比上限（過泛不取）
MIN_HITS = 2       # 標題需命中 ≥2 個互不重疊的核心詞才算「提及」
MERGE_FRAC = 0.6   # 小事件有 ≥60% 成員命中大事件核心詞才併入（同主題）
MERGE_HITS = 2     # 併入時的命中數門檻（比提及嚴，避免把「也提到選舉」的別件事併入）
CAP_ITEMS = 12     # 每扇最多帶幾則標題（n 仍為完整數）

_S = "党赢国议员选举总统会经济关预计数买卖产财务银进战争军场领导长观华发动资贸区实际们对将这时来为与东岛规转车运电网级爷际调声"
_T = "黨贏國議員選舉總統會經濟關預計數買賣產財務銀進戰爭軍場領導長觀華發動資貿區實際們對將這時來為與東島規轉車運電網級爺際調聲"
assert len(_S) == len(_T), (len(_S), len(_T))
_TAB = str.maketrans(_S, _T)
_STOP = set("顯示 結果 表示 可能 指出 報導 宣布 表現 持續 目前 今年 明年 預期 公布 首次 最新 繼續 已經 因為 之後 之前 沒有 認為 成為 如何 什麼 為何 今日 本週 週五 週四 週三 週二 週一 昨日 周五 意味 味著 著什 什麼 麼對 獲取 獲得 表達 顯現 市場 影響 公司 相關 消息 分析 專家 報告 數據 美國 全球 中國 台灣 政府 支持 調查 要求 呼籲 批評 表態 質疑 強調 爭取 推動 引發 恐遭 遭指 成立 掃街".split())
_FUNC = set("的了在是和與將對及等於也都仍但而並被把讓向從比")
EN_STOP = set("""
a about above after again against all am an and any are aren't as at be because
been before being below between both but by can can't cannot could couldn't did
didn't do does doesn't doing don't down during each few for from further had
hadn't has hasn't have haven't having he he'd he'll he's her here here's hers
herself him himself his how how's i i'd i'll i'm i've if in into is isn't it
it's its itself let's me more most mustn't my myself no nor not of off on once
only or other ought our ours ourselves out over own same shan't she she'd she'll
she's should shouldn't so some such than that that's the their theirs them
themselves then there there's these they they'd they'll they're they've this
those through to too under until up very was wasn't we we'd we'll we're we've
were weren't what what's when when's where where's which while who who's whom
why why's with won't would wouldn't you you'd you'll you're you've your yours
yourself yourselves new per via vs
""".split())
_ALIAS = [(re.compile(r"trump", re.I), "特朗普"), (re.compile(r"川普"), "特朗普"),
          (re.compile(r"中期選舉|期中選舉"), "期中選舉"), (re.compile(r"(?<!期)中選"), "期中選舉"),
          (re.compile(r"election", re.I), "選舉")]


def norm(s):
    s = (s or "").lower().translate(_TAB)
    for rx, rep in _ALIAS:
        s = rx.sub(rep, s)
    return s


def feats(t):
    f = set()
    for run in re.findall(r"[一-鿿]+", t):
        for i in range(len(run) - 1):
            b = run[i:i + 2]
            if b in _STOP or b[0] in _FUNC or b[1] in _FUNC:
                continue
            f.add(b)
    for w in re.findall(r"[a-z0-9]{3,}", t):
        if not w.isdigit() and w not in EN_STOP:
            f.add(w)
    return f


class Ctx:
    def __init__(self, arts, local):
        self.n = len(arts)
        self.arts = arts
        self.NT = [norm(a.get("title_zh") or a.get("title") or "") for a in arts]
        self.FS = [feats(t) for t in self.NT]
        self.df = collections.Counter()
        for f in self.FS:
            self.df.update(f)
        self.t = [a.get("_t") for a in arts]
        ts = [x for x in self.t if x]
        self.tref = max(ts) if ts else None
        self.at = [local(a.get("ts") or a.get("fetched_at") or "") or "" for a in arts]


def core_terms(ctx, g):
    mc = collections.Counter()
    for i in g:
        mc.update(ctx.FS[i])
    cap = max(10, DF_RATIO * ctx.n)
    minc = max(2, math.ceil(0.15 * len(g)))
    sc = []
    for k, c in mc.items():
        if c >= minc and ctx.df[k] <= cap:
            sc.append((c ** 1.5 * math.log((ctx.n + 1) / (ctx.df[k] + 0.5)), k))
    sc.sort(reverse=True)
    return [k for _, k in sc[:K_TERMS]]


def phrases(terms):
    cj = [t for t in terms if re.fullmatch(r"[一-鿿]{2}", t)]
    la = [t for t in terms if t not in cj]
    nxt = collections.defaultdict(list)
    for t in cj:
        nxt[t[0]].append(t)
    heads = [t for t in cj if not any(u[1] == t[0] for u in cj if u != t)]
    used, out = set(), []
    for h in sorted(heads):
        s, cur = h, h
        used.add(h)
        while True:
            c = [u for u in nxt.get(cur[1], []) if u not in used]
            if not c:
                break
            u = c[0]
            used.add(u)
            s += u[1]
            cur = u
        out.append(s)
    out += [t for t in cj if t not in used]
    return out + la


def hits(ctx, terms, i):
    """回傳 (互不重疊命中數, 命中字串)；重疊的二字詞（民主＋主黨）合併算 1 個。"""
    tx = ctx.NT[i]
    iv = []
    for k in terms:
        p = tx.find(k)
        while p >= 0:
            iv.append((p, p + len(k)))
            p = tx.find(k, p + 1)
    iv.sort()
    m = []
    for s, e in iv:
        if m and s < m[-1][1]:
            m[-1] = (m[-1][0], max(m[-1][1], e))
        else:
            m.append((s, e))
    ms = list(dict.fromkeys(tx[s:e] for s, e in m))  # 同一個詞出現多次只算 1 個
    return len(ms), ms


def shown(ctx, g, terms):
    """畫面用比對詞：成員標題中實際被核心詞覆蓋的連續字串，出現在 ≥2 則者，依次數排序。"""
    cnt = collections.Counter()
    for i in g:
        cnt.update(set(hits(ctx, terms, i)[1]))
    out = []
    for k, c in cnt.most_common():
        while len(k) > 3 and (k[-1] in '中後時在' or k[0] in '中後時在'):
            k = k[:-1] if k[-1] in '中後時在' else k[1:]
        for _ in range(3):
            if len(k) > 3 and k[1:] in cnt and cnt[k[1:]] >= c:
                k = k[1:]
            elif len(k) > 3 and k[:-1] in cnt and cnt[k[:-1]] >= c:
                k = k[:-1]
        if c >= 2 and len(k) >= 2 and k not in out:
            out.append(k)
    out = [k for k in out if not any(k != o and k in o for o in out)]
    return out[:6]


def gtopic(g, tid_of):
    c = collections.Counter(tid_of[i] for i in g)
    c.pop(-1, None)
    c.pop(None, None)
    return c.most_common(1)[0][0] if c else -1


def merge_groups(ctx, groups, tid_of):
    gs = sorted([list(g) for g in groups if len(g) >= 2], key=len, reverse=True)
    singles = [g for g in groups if len(g) < 2]
    for _ in range(5):
        changed, out = False, []
        for g in gs:
            tg = gtopic(g, tid_of)
            done = False
            if tg != -1:
                for h in out:
                    if gtopic(h, tid_of) != tg:
                        continue
                    terms = core_terms(ctx, h)
                    if len(shown(ctx, h, terms)) < 2:
                        continue
                    ok = sum(1 for i in g if hits(ctx, terms, i)[0] >= MERGE_HITS)
                    if ok / len(g) >= MERGE_FRAC:
                        h.extend(g)
                        done = changed = True
                        break
            if not done:
                out.append(list(g))
        gs = sorted(out, key=len, reverse=True)
        if not changed:
            break
    return gs + singles


def build_ripple(ctx, g, tid_of, topic, span_h=None):
    terms = core_terms(ctx, g)
    ph = shown(ctx, g, terms)
    base = {"terms": ph, "window_h": WINDOW_H, "span_h": span_h, "core_n": len(g), "evidence": "E0 待驗證"}
    need = MIN_HITS if len(g) >= 4 else MIN_HITS + 1  # 成員 ≤3 則的小事件證據弱，門檻多 1 個詞
    base["min_hits"] = need
    if len(ph) < need or ctx.tref is None:
        base["insufficient"] = True
        return base
    gs = set(g)
    lo = ctx.tref - timedelta(hours=WINDOW_H)
    r1, r2 = [], collections.defaultdict(list)
    for i in range(ctx.n):
        if i in gs or ctx.t[i] is None or ctx.t[i] < lo:
            continue
        c, ms = hits(ctx, terms, i)
        if c < need:
            continue
        a = ctx.arts[i]
        it = (ctx.t[i], {"title": a.get("title_zh") or a.get("title") or "", "source": a.get("source", ""),
                         "url": a.get("url", ""), "at": ctx.at[i], "match": ms})
        tid = tid_of[i] if tid_of[i] is not None else -1
        (r1 if tid == topic else r2[tid]).append(it)

    def pack(lst):
        lst.sort(key=lambda x: x[0], reverse=True)
        return {"n": len(lst), "items": [x[1] for x in lst[:CAP_ITEMS]]}
    base["ring1"] = pack(r1)
    base["ring2"] = sorted([dict(topic=t, **pack(v)) for t, v in r2.items()], key=lambda d: -d["n"])
    base["total"] = base["ring1"]["n"] + sum(d["n"] for d in base["ring2"])
    return base
