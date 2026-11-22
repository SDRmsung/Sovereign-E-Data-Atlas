#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
z01_news_pulse Pipeline
Fetches RSS (CNA FirstNews, CNA Finance, PTS), Tech (arXiv, GitHub Trending, HF Models),
clusters articles via TF-IDF & keywords into 6-10 topics, generates:
1. feed/latest_frame.json & feed/latest_frame.js
2. feed/timeline.js (rolling 24h hourly frames, truth from snapshots ndjson, missing:true for empty slots)
3. feed/snapshots_YYYYMMDD.ndjson.gz
"""

import sys
import os
import json
import gzip
import re
import ssl
import email.utils
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import Counter

sys.stdout.reconfigure(encoding="utf-8")

APP_DIR = Path(__file__).resolve().parent
FEED_DIR = APP_DIR / "feed"
FEED_DIR.mkdir(parents=True, exist_ok=True)

# SSL context for robust scraping
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) A23_NewsPulse/1.0"}

TOPIC_DEFS = [
    {"id": 0, "name": "AI與生成科技", "color": "#38bdf8", "kw": ["ai", "model", "llm", "diffusion", "gpt", "agent", "intelligence", "learning", "neural", "flow", "prompt", "人工智慧", "智慧", "大模型", "生成式"]},
    {"id": 1, "name": "開源與軟體架構", "color": "#a855f7", "kw": ["github", "code", "repo", "framework", "python", "rust", "build", "api", "platform", "software", "工具", "框架", "開源", "架構"]},
    {"id": 2, "name": "半導體與硬體運算", "color": "#ec4899", "kw": ["chip", "semiconductor", "tsmc", "nvidia", "hardware", "gpu", "台積電", "半導體", "晶圓", "晶片", "輝達", "代工", "算力"]},
    {"id": 3, "name": "總經與資本市場", "color": "#f59e0b", "kw": ["market", "stock", "fed", "inflation", "economy", "trade", "fund", "通膨", "股市", "大盤", "指數", "降息", "央行", "外資", "證券", "金融", "國發會"]},
    {"id": 4, "name": "地緣政經與國防", "color": "#ef4444", "kw": ["defense", "security", "war", "taiwan", "china", "us", "biden", "trump", "military", "國防", "軍事", "外交", "美中", "兩岸", "共軍", "安全", "地緣"]},
    {"id": 5, "name": "永續能源與基礎建設", "color": "#10b981", "kw": ["green", "energy", "solar", "wind", "power", "climate", "grid", "綠能", "電力", "供電", "核能", "風電", "光電", "水情", "碳排", "水庫", "交通", "鐵路"]},
    {"id": 6, "name": "社會法政與民生消費", "color": "#6366f1", "kw": ["court", "policy", "labor", "social", "hospital", "health", "勞工", "檢調", "法院", "醫療", "衛福", "教育", "物價", "生活", "交通部", "勞動部"]},
    {"id": 7, "name": "全球焦點與特寫", "color": "#06b6d4", "kw": ["global", "world", "asia", "europe", "japan", "korea", "國際", "日本", "南韓", "歐洲", "美歐", "聯合國", "外媒"]},
]


def parse_date_to_iso(dt_str: str | None) -> str | None:
    """Parse RFC 2822 or ISO 8601 date string to standard UTC ISO format."""
    if not dt_str:
        return None
    s = dt_str.strip()
    if not s:
        return None
    try:
        dt = email.utils.parsedate_to_datetime(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    try:
        if s.endswith("Z"):
            s = s[:-1] + "+00:00"
        dt = datetime.fromisoformat(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except Exception:
        pass
    return None


def fetch_cna_rss(fetched_at: str) -> list:
    items = []
    urls = [
        ("CNA_First", "https://feeds.feedburner.com/cnaFirstNews"),
        ("CNA_Finance", "https://feeds.feedburner.com/rsscna/finance"),
        ("CNA_FeedX", "https://feedx.net/rss/cna.xml"),
    ]
    for src, url in urls:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as r:
                xml_data = r.read()
                root = ET.fromstring(xml_data)
                for item in root.findall(".//item")[:20]:
                    title_elem = item.find("title")
                    link_elem = item.find("link")
                    pub_elem = item.find("pubDate")
                    if title_elem is not None and title_elem.text:
                        t = title_elem.text.strip()
                        l = link_elem.text.strip() if link_elem is not None and link_elem.text else ""
                        pub_raw = pub_elem.text.strip() if pub_elem is not None and pub_elem.text else None
                        items.append({
                            "title": t,
                            "url": l,
                            "source": "中央社",
                            "ts": parse_date_to_iso(pub_raw),
                            "fetched_at": fetched_at,
                        })
        except Exception as e:
            print(f"[WARN] Fetch {src} failed: {e}")
    return items


def fetch_pts_rss(fetched_at: str) -> list:
    items = []
    try:
        req = urllib.request.Request("https://news.pts.org.tw/xml/newsfeed.xml", headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as r:
            root = ET.fromstring(r.read())
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            # PTS is Atom feed with entry elements
            entries = root.findall("atom:entry", ns)
            if entries:
                for entry in entries[:20]:
                    title_elem = entry.find("atom:title", ns)
                    link_elem = entry.find("atom:link", ns)
                    upd_elem = entry.find("atom:updated", ns)
                    pub_elem = entry.find("atom:published", ns)
                    if title_elem is not None and title_elem.text:
                        t = title_elem.text.strip()
                        l = link_elem.get("href") if link_elem is not None else ""
                        date_str = (upd_elem.text.strip() if upd_elem is not None and upd_elem.text
                                    else (pub_elem.text.strip() if pub_elem is not None and pub_elem.text else None))
                        items.append({
                            "title": t,
                            "url": l,
                            "source": "公視",
                            "ts": parse_date_to_iso(date_str),
                            "fetched_at": fetched_at,
                        })
            else:
                for item in root.findall(".//item")[:15]:
                    title_elem = item.find("title")
                    link_elem = item.find("link")
                    pub_elem = item.find("pubDate")
                    if title_elem is not None and title_elem.text:
                        items.append({
                            "title": title_elem.text.strip(),
                            "url": link_elem.text.strip() if link_elem is not None and link_elem.text else "",
                            "source": "公視",
                            "ts": parse_date_to_iso(pub_elem.text.strip() if pub_elem is not None and pub_elem.text else None),
                            "fetched_at": fetched_at,
                        })
    except Exception as e:
        print(f"[WARN] Fetch PTS failed: {e}")
    return items


def fetch_arxiv(fetched_at: str) -> list:
    items = []
    try:
        url = "https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=15"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as r:
            root = ET.fromstring(r.read())
            ns = {"atom": "http://www.w3.org/2005/Atom"}
            for entry in root.findall("atom:entry", ns):
                t = entry.find("atom:title", ns).text.strip().replace("\n", " ")
                l = entry.find("atom:id", ns).text.strip()
                upd_elem = entry.find("atom:updated", ns)
                pub_elem = entry.find("atom:published", ns)
                date_str = (upd_elem.text.strip() if upd_elem is not None and upd_elem.text
                            else (pub_elem.text.strip() if pub_elem is not None and pub_elem.text else None))
                items.append({
                    "title": t,
                    "url": l,
                    "source": "arXiv",
                    "ts": parse_date_to_iso(date_str),
                    "fetched_at": fetched_at,
                })
    except Exception as e:
        print(f"[WARN] Fetch arXiv failed: {e}")
    return items


def fetch_github(fetched_at: str) -> list:
    items = []
    try:
        url = "https://api.github.com/search/repositories?q=stars:>1000+pushed:>2026-10-01&sort=stars&order=desc&per_page=15"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as r:
            data = json.loads(r.read().decode("utf-8"))
            for repo in data.get("items", [])[:15]:
                desc = repo.get("description", "") or ""
                t = f"{repo['name']}: {desc}" if desc else repo["name"]
                pushed_at = repo.get("pushed_at")
                items.append({
                    "title": t[:120],
                    "url": repo["html_url"],
                    "source": "GitHub",
                    "ts": parse_date_to_iso(pushed_at),
                    "fetched_at": fetched_at,
                })
    except Exception as e:
        print(f"[WARN] Fetch GitHub failed: {e}")
    return items


def fetch_hf_trending(fetched_at: str) -> list:
    items = []
    try:
        url = "https://huggingface.co/api/models?sort=trendingScore&direction=-1&limit=12"
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=8, context=SSL_CTX) as r:
            data = json.loads(r.read().decode("utf-8"))
            for model in data[:12]:
                m_id = model.get("id", "")
                # Trending models do not have article publication time; leave ts as null
                items.append({
                    "title": f"Trending Model: {m_id}",
                    "url": f"https://huggingface.co/{m_id}",
                    "source": "HuggingFace",
                    "ts": None,
                    "fetched_at": fetched_at,
                })
    except Exception as e:
        print(f"[WARN] Fetch HF failed: {e}")
    return items


# P0-1 (2026-11-04): 金融優先規則 + 英文關鍵字字界比對 + 固定 fallback（不再用隨機 hash）
FINANCE_PRIORITY = ["台股", "美股", "大盤", "新台幣", "匯率", "貶值", "升值", "外資", "殖利率", "降息", "升息", "股價", "收盤", "漲停", "跌停", "道瓊", "那斯達克", "費半", "指數"]
FINANCE_POINTS = re.compile(r"(跌|漲|收|守|失|挫|震盪|重挫).{0,6}\d+.{0,3}點|\d+\s*點")

def _kw_hit(kw: str, t_lower: str) -> bool:
    if kw.isascii() and kw.replace("-", "").isalnum():
        tail = r"(?![a-z0-9])" if len(kw) <= 3 else ""  # 短詞要完整字界；長詞允許詞尾變化(models/agents)
        return re.search(r"(?<![a-z0-9])" + re.escape(kw) + tail, t_lower) is not None
    return kw in t_lower

TOPIC_DEFS[4]["kw"] += ["期中選舉", "民主黨", "共和黨", "川普", "國台辦", "菲中", "間諜", "外長", "制裁", "國會", "參院", "選舉", "民調", "總統", "習近平"]
TOPIC_DEFS[6]["kw"] += ["起火", "失聯", "認養", "不適", "水質", "宿舍", "住持", "捐款", "空氣品質", "棄包裹", "醫院", "校方", "社區", "食安", "詐騙"]
TOPIC_DEFS[3]["kw"] += ["證交所", "彭博", "貿易", "進博會"]
TOPIC_DEFS[4]["kw"] += ["北韓", "中國", "金與正", "反制", "炸彈"]
HN_URL = "https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=25"


def fetch_hn(fetched_at: str) -> list:
    """Hacker News 首頁（Algolia API，免金鑰；補 AI／開源／科技社群視角）。region=tech，不計入 30/70 配額。"""
    items = []
    try:
        req = urllib.request.Request(os.environ.get("Z01_HN_URL", HN_URL), headers=HEADERS)
        with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as r:
            data = json.loads(r.read().decode("utf-8"))
        for h in data.get("hits", []):
            t = (h.get("title") or "").strip()
            if not t:
                continue
            items.append({
                "title": t,
                "url": h.get("url") or ("https://news.ycombinator.com/item?id=%s" % h.get("objectID", "")),
                "source": "HackerNews",
                "ts": parse_date_to_iso(h.get("created_at")),
                "fetched_at": fetched_at,
            })
        print(f"[HN] HackerNews: {len(items)} items")
    except Exception as e:
        print(f"[WARN] Fetch HackerNews failed: {e}")
    return items


SOURCE_DEFAULT = {"arXiv": 0, "HuggingFace": 0, "GitHub": 1, "HackerNews": 4}

def classify_article(title: str, source: str = "") -> int:
    t_lower = title.lower()
    if any(k in title for k in FINANCE_PRIORITY) or FINANCE_POINTS.search(title):
        return 3
    scores = [0] * len(TOPIC_DEFS)
    for topic in TOPIC_DEFS:
        t_id = topic["id"]
        for kw in topic["kw"]:
            if _kw_hit(kw, t_lower):
                scores[t_id] += 1
    max_score = max(scores)
    if max_score > 0:
        return scores.index(max_score)
    if source in SOURCE_DEFAULT:
        return SOURCE_DEFAULT[source]
    return 7  # 無命中 -> 全球焦點與特寫（可預期，不隨機）


# ===== 國際財經來源（AGY 本機實測 2026-11-04：docs\AGY_prompts\z01_intl_finance_rss_probe_result.md）=====
# 不接：CNN 舊 RSS（停更 2017~2023）、WSJ 舊 feeds.a.dj.com（停在 2025-01）
# (來源顯示名, URL, 付費屬性 free/partial/paywall, 單檔上限則數)
INTL_FEEDS = [
    ("BBC", "https://feeds.bbci.co.uk/news/business/rss.xml", "free", 15),
    ("CNBC", "https://www.cnbc.com/id/100003114/device/rss/rss.html", "free", 12),
    ("CNBC", "https://www.cnbc.com/id/10001147/device/rss/rss.html", "free", 8),
    ("半島電視台", "https://www.aljazeera.com/xml/rss/all.xml", "free", 12),
    ("MarketWatch", "https://feeds.content.dowjones.io/public/rss/mw_topstories", "partial", 10),
    ("WSJ", "https://feeds.content.dowjones.io/public/rss/RSSMarketsMain", "paywall", 15),
    ("WSJ", "https://feeds.content.dowjones.io/public/rss/RSSWorldNews", "paywall", 15),
    ("Bloomberg", "https://feeds.bloomberg.com/markets/news.rss", "paywall", 12),
    ("Bloomberg", "https://feeds.bloomberg.com/economics/news.rss", "paywall", 12),
    ("Bloomberg", "https://feeds.bloomberg.com/politics/news.rss", "paywall", 10),
]
# 地區：tw=台灣新聞、intl=國外新聞、tech=技術源(非新聞，不進 30/70 配額)
REGION_OF = {"中央社": "tw", "公視": "tw", "自由時報": "tw", "Newtalk": "tw", "Google新聞": "tw", "arXiv": "tech", "GitHub": "tech", "HuggingFace": "tech", "HackerNews": "tech"}


def fetch_intl_rss(fetched_at: str) -> list:
    import html as _html
    items = []
    for src, url, paywall, cap in INTL_FEEDS:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as r:
                root = ET.fromstring(r.read())
            n = 0
            for item in root.findall(".//item")[:cap]:
                te, le, pe = item.find("title"), item.find("link"), item.find("pubDate")
                if te is None or not (te.text or "").strip():
                    continue
                items.append({
                    "title": _html.unescape(te.text.strip()),
                    "url": (le.text or "").strip() if le is not None else "",
                    "source": src,
                    "ts": parse_date_to_iso(pe.text.strip() if pe is not None and pe.text else None),
                    "fetched_at": fetched_at,
                    "paywall": paywall,
                })
                n += 1
            print(f"[INTL] {src} ({url.split('/')[-1][:24]}): {n} items")
        except Exception as e:
            print(f"[WARN] Fetch intl {src} failed: {e}")
    return items


# ===== 政治類來源（AGY 實測 2026-11-04：docs\AGY\reports\z01_politics_rss_probe_20261104.md，8 OK）=====
# 不接：中時（404）、風傳媒（非 XML）。Google 新聞是聚合源（標題尾巴 " - 媒體名" 會剝掉，連結為 Google 轉址）。
POLITICS_FEEDS = [
    ("中央社", "https://feeds.feedburner.com/rsscna/politics", 15),
    ("自由時報", "https://news.ltn.com.tw/rss/politics.xml", 20),
    ("Newtalk", "https://newtalk.tw/rss/category/2", 20),
    ("Google新聞", "https://news.google.com/rss/search?q=%E5%9C%B0%E6%96%B9%E9%81%B8%E8%88%89+%E7%B8%A3%E5%B8%82%E9%95%B7&hl=zh-TW&gl=TW&ceid=TW:zh-Hant", 25),
]


def parse_rss_items(data: bytes, src: str, cap: int, fetched_at: str) -> list:
    import html as _html
    root = ET.fromstring(data)
    out = []
    for item in root.findall(".//item")[:cap]:
        te, le, pe = item.find("title"), item.find("link"), item.find("pubDate")
        if te is None or not (te.text or "").strip():
            continue
        t = _html.unescape(te.text.strip())
        if src == "Google新聞" and " - " in t:
            t = t.rsplit(" - ", 1)[0].strip()
        out.append({"title": t, "url": (le.text or "").strip() if le is not None else "", "source": src,
                    "ts": parse_date_to_iso(pe.text.strip() if pe is not None and pe.text else None), "fetched_at": fetched_at})
    return out


def fetch_politics_rss(fetched_at: str) -> list:
    items = []
    for src, url, cap in POLITICS_FEEDS:
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=10, context=SSL_CTX) as r:
                got = parse_rss_items(r.read(), src, cap, fetched_at)
            items.extend(got)
            print(f"[POLITICS] {src}: {len(got)} items")
        except Exception as e:
            print(f"[WARN] Fetch politics {src} failed: {e}")
    return items


# ===== 河流標題中文化（第 15 項）：非中文 → 譯成 15~25 字；中文超過 25 字 → 濃縮 =====
# 本機 Ollama（http://127.0.0.1:11434）；連不上就退回原標題（不編造）。環境變數：Z01_OLLAMA_URL / Z01_OLLAMA_MODEL
import hashlib
ZH_MAX = 25
ZH_BUDGET = int(os.environ.get("Z01_ZH_BUDGET", "80"))   # 每次最多處理幾則新標題
ZH_BATCH = 8
ZH_CACHE_PATH = FEED_DIR / "title_zh_cache.json"
OLLAMA_URL = os.environ.get("Z01_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
_CJK = re.compile(r"[一-鿿]")


def _is_zh(s: str) -> bool:
    letters = [c for c in s if c.isalnum()]
    return bool(letters) and sum(1 for c in letters if _CJK.match(c)) / len(letters) >= 0.5


def _cut(s: str, n: int = ZH_MAX) -> str:
    return s if len(s) <= n else s[: n - 1] + "…"


def _ollama_pick_model():
    import urllib.request as ur
    want = os.environ.get("Z01_OLLAMA_MODEL", "").strip()
    with ur.urlopen(OLLAMA_URL + "/api/tags", timeout=4) as r:
        names = [m["name"] for m in json.loads(r.read().decode("utf-8")).get("models", [])]
    if want:
        return want if want in names else (want if names else None)
    names = [n for n in names if "embed" not in n.lower()]
    for pref in ("qwen3", "qwen2.5", "qwen", "gemma", "llama3", "mistral"):
        for n in names:
            if pref in n.lower():
                return n
    return names[0] if names else None


def _ollama_zh_batch(titles: list, model: str) -> dict:
    lines = "\n".join(f"{i + 1}|{t}" for i, t in enumerate(titles))
    prompt = (
        "你是台灣財經新聞編輯。把下列每則新聞標題改寫成繁體中文（台灣用語）標題，"
        "每則 15 到 25 個字，保留關鍵數字、公司名、人名與地名，不要加入原文沒有的資訊或評論。"
        "只輸出「編號|中文標題」，一行一則，不要其他文字。\n\n" + lines
    )
    payload = json.dumps({"model": model, "prompt": prompt, "stream": False, "think": False,
                          "options": {"temperature": 0.2, "num_predict": 600}}).encode("utf-8")
    req = urllib.request.Request(OLLAMA_URL + "/api/generate", data=payload,
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=150) as r:
        out = json.loads(r.read().decode("utf-8")).get("response", "")
    out = re.sub(r"<think>.*?</think>", "", out, flags=re.S)
    res = {}
    for ln in out.splitlines():
        m = re.match(r"^\s*(\d+)\s*[|｜:：.、]\s*(.+?)\s*$", ln)
        if not m:
            continue
        i, zh = int(m.group(1)) - 1, m.group(2).strip().strip("「」\"'")
        if 0 <= i < len(titles) and _CJK.search(zh) and len(zh) >= 6:
            res[i] = _cut(zh, 30) if len(zh) > 30 else zh
    return res


def attach_zh(articles: list) -> dict:
    # 回傳統計；每則加 title_zh、zh_by(orig/cache/ollama/cut/none)
    try:
        cache = json.loads(ZH_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        cache = {}
    key = lambda t: hashlib.sha1(t.encode("utf-8")).hexdigest()[:16]
    todo = []
    for a in articles:
        t = a["title"]
        if _is_zh(t) and len(t) <= ZH_MAX:
            a["title_zh"], a["zh_by"] = t, "orig"
        elif key(t) in cache:
            a["title_zh"], a["zh_by"] = cache[key(t)], "cache"
        else:
            todo.append(a)
    stats = {"orig": 0, "cache": 0, "ollama": 0, "cut": 0, "none": 0, "model": None}
    model = None
    if todo:
        try:
            model = _ollama_pick_model()
        except Exception as e:
            print(f"[WARN] Ollama 不可用，標題維持原文（{e}）")
        stats["model"] = model
    done = 0
    for i in range(0, len(todo), ZH_BATCH):
        batch = todo[i:i + ZH_BATCH]
        got = {}
        if model and done < ZH_BUDGET:
            try:
                got = _ollama_zh_batch([a["title"] for a in batch], model)
                done += len(batch)
            except Exception as e:
                print(f"[WARN] Ollama 批次失敗，其餘維持原文：{e}")
                model = None
        for j, a in enumerate(batch):
            if j in got:
                a["title_zh"], a["zh_by"] = got[j], "ollama"
                cache[key(a["title"])] = got[j]
            elif _is_zh(a["title"]):
                a["title_zh"], a["zh_by"] = _cut(a["title"]), "cut"
            else:
                a["title_zh"], a["zh_by"] = None, "none"
    for a in articles:
        stats[a.get("zh_by") or "none"] = stats.get(a.get("zh_by") or "none", 0) + 1
    if len(cache) > 3000:
        cache = dict(list(cache.items())[-3000:])
    try:
        ZH_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    except Exception as e:
        print(f"[WARN] 無法寫入 title_zh_cache：{e}")
    return stats


def run_pipeline():
    now_utc = datetime.now(timezone.utc)
    fetched_at = now_utc.isoformat()
    now_local = now_utc + timedelta(hours=8)
    date_key = now_local.strftime("%Y%m%d")
    hour_key = now_local.strftime("%Y-%m-%d %H:00")

    print(f"[INFO] z01_news_pulse starting at {now_local.isoformat()}...")

    # Fetch from all sources
    raw_articles = []
    raw_articles.extend(fetch_cna_rss(fetched_at))
    raw_articles.extend(fetch_pts_rss(fetched_at))
    raw_articles.extend(fetch_politics_rss(fetched_at))
    raw_articles.extend(fetch_arxiv(fetched_at))
    raw_articles.extend(fetch_github(fetched_at))
    raw_articles.extend(fetch_hf_trending(fetched_at))
    raw_articles.extend(fetch_intl_rss(fetched_at))
    raw_articles.extend(fetch_hn(fetched_at))

    # Deduplicate by title
    seen = set()
    deduped = []
    for a in raw_articles:
        norm_t = re.sub(r"\s+", "", a["title"])
        if norm_t and norm_t not in seen:
            seen.add(norm_t)
            cid = classify_article(a["title"], a.get("source", ""))
            deduped.append({
                "ts": a["ts"],
                "fetched_at": a["fetched_at"],
                "source": a["source"],
                "title": a["title"],
                "url": a["url"],
                "cluster_id": cid,
                "region": REGION_OF.get(a["source"], "intl"),
                "paywall": a.get("paywall"),
            })

    raw_count = len(deduped)
    counts_before = Counter(a["source"] for a in deduped)
    print(f"[INFO] Deduplicated articles before 48h filter: {raw_count} articles")
    for s_name, count in counts_before.items():
        print(f"  [RAW] {s_name}: {count} items")

    # Filter out articles older than 48 hours (only if ts is present)
    cutoff_time = now_utc - timedelta(hours=48)
    articles = []
    for a in deduped:
        if a["ts"]:
            try:
                dt = datetime.fromisoformat(a["ts"])
                if dt < cutoff_time:
                    continue
            except Exception:
                pass
        articles.append(a)

    zh_stats = attach_zh(articles)
    print(f"[INFO] 中文標題：{zh_stats}")
    region_counts = dict(Counter(a["region"] for a in articles))
    print(f"[INFO] 地區分布：{region_counts}")

    filtered_count = len(articles)
    counts_after = Counter(a["source"] for a in articles)
    print(f"[INFO] Articles after 48h filter: {filtered_count} (filtered out {raw_count - filtered_count} stale articles)")
    for s_name, count in counts_after.items():
        print(f"  [KEPT] {s_name}: {count} items")

    # Topic distribution
    topic_counts = Counter(a["cluster_id"] for a in articles)
    print("[INFO] Topic breakdown:")
    for t in TOPIC_DEFS:
        print(f"  [{t['id']}] {t['name']}: {topic_counts.get(t['id'], 0)} items")

    # Dual Feed export
    snapshot = {
        "captured_at": now_local.strftime("%Y-%m-%d %H:%M:%S"),
        "date_key": date_key,
        "source_mode": "live",
        "total_articles": len(articles),
        "update_interval_min": 30,
        "region_counts": region_counts,
        "zh_stats": zh_stats,
        "sources": sorted({a["source"] for a in articles}),
        "topics": TOPIC_DEFS,
        "articles": articles,
    }

    # 1. latest_frame.json & latest_frame.js
    json_str = json.dumps(snapshot, ensure_ascii=False, indent=2)
    (FEED_DIR / "latest_frame.json").write_text(json_str, encoding="utf-8")
    js_code = f"// Auto-generated Zero-CORS Feed\nwindow.A23_FEED = {json_str};\n"
    (FEED_DIR / "latest_frame.js").write_text(js_code, encoding="utf-8")

    # 2. Save snapshot to feed/snapshots/YYYYMMDD/HH.json (and optional ndjson.gz)
    hour_str = now_local.strftime("%H")
    snap_dir = FEED_DIR / "snapshots" / date_key
    snap_dir.mkdir(parents=True, exist_ok=True)
    snap_file = snap_dir / f"{hour_str}.json"
    snap_file.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding="utf-8")

    try:
        ndjson_gz = FEED_DIR / f"snapshots_{date_key}.ndjson.gz"
        with gzip.open(ndjson_gz, "at", encoding="utf-8") as gz:
            gz.write(json.dumps(snapshot, ensure_ascii=False) + "\n")
    except Exception as e:
        print(f"[WARN] Append to ndjson.gz failed: {e}")

    # 3. Rolling 24h timeline generation
    # Source of truth is snapshots_*.ndjson.gz and feed/snapshots/*/*.json
    hourly_snaps = {}
    for gz_path in sorted(FEED_DIR.glob("snapshots_*.ndjson.gz")):
        try:
            with gzip.open(gz_path, "rt", encoding="utf-8") as gz:
                for line in gz:
                    line = line.strip()
                    if not line:
                        continue
                    snap = json.loads(line)
                    cap_str = snap.get("captured_at")
                    if not cap_str:
                        continue
                    try:
                        cap_dt = datetime.strptime(cap_str, "%Y-%m-%d %H:%M:%S")
                        slot_k = cap_dt.strftime("%Y-%m-%d %H:00")
                        snap_arts = snap.get("articles", [])
                        c_counts = Counter(a.get("cluster_id") for a in snap_arts)
                        hourly_snaps[slot_k] = {
                            "timestamp": slot_k,
                            "missing": False,
                            "total": len(snap_arts),
                            "cluster_counts": [c_counts.get(t["id"], 0) for t in TOPIC_DEFS],
                        }
                    except Exception:
                        pass
        except Exception as e:
            print(f"[WARN] Error reading {gz_path.name}: {e}")

    for json_path in sorted(FEED_DIR.glob("snapshots/*/*.json")):
        try:
            snap = json.loads(json_path.read_text(encoding="utf-8"))
            cap_str = snap.get("captured_at")
            if not cap_str:
                continue
            cap_dt = datetime.strptime(cap_str, "%Y-%m-%d %H:%M:%S")
            slot_k = cap_dt.strftime("%Y-%m-%d %H:00")
            snap_arts = snap.get("articles", [])
            c_counts = Counter(a.get("cluster_id") for a in snap_arts)
            hourly_snaps[slot_k] = {
                "timestamp": slot_k,
                "missing": False,
                "total": len(snap_arts),
                "cluster_counts": [c_counts.get(t["id"], 0) for t in TOPIC_DEFS],
            }
        except Exception as e:
            print(f"[WARN] Error reading {json_path}: {e}")

    # Add current frame
    curr_frame = {
        "timestamp": hour_key,
        "missing": False,
        "total": len(articles),
        "cluster_counts": [topic_counts.get(t["id"], 0) for t in TOPIC_DEFS],
    }
    hourly_snaps[hour_key] = curr_frame

    # Construct strict 24 hourly slots
    frames_24h = []
    base_dt = now_local.replace(minute=0, second=0, microsecond=0)
    for i in range(23, -1, -1):
        slot_dt = base_dt - timedelta(hours=i)
        slot_key = slot_dt.strftime("%Y-%m-%d %H:00")
        if slot_key in hourly_snaps:
            frames_24h.append(hourly_snaps[slot_key])
        else:
            frames_24h.append({
                "timestamp": slot_key,
                "missing": True,
                "total": 0,
                "cluster_counts": [0] * len(TOPIC_DEFS),
            })

    timeline_data = {
        "updated_at": now_local.strftime("%Y-%m-%d %H:%M:%S"),
        "topics": TOPIC_DEFS,
        "frame_count": len(frames_24h),
        "frames": frames_24h,
    }
    tl_json = json.dumps(timeline_data, ensure_ascii=False, indent=2)
    timeline_js = f"// Auto-generated 24h Rolling Stream Timeline\nwindow.A23_TIMELINE = {tl_json};\n"
    (FEED_DIR / "timeline.js").write_text(timeline_js, encoding="utf-8")

    real_count = sum(1 for f in frames_24h if not f["missing"])
    missing_count = sum(1 for f in frames_24h if f["missing"])
    print(f"[OK] z01 pipeline complete. Frames: 24 (Real: {real_count}, Missing: {missing_count}). Feed files updated.")


if __name__ == "__main__":
    run_pipeline()
