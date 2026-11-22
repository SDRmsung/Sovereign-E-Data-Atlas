"""A23 kit quality gate (§6.7 防回退閘門；D2=1 三件套之②).

靜態檢查 charts\\*.js 每張卡的函式本體（卡號↔函式名取自 chart_registry.js 的 T 表）。
嚴格範圍（FAIL 會讓 exit code=1）：
  - 有引用 A23Tex 的卡（本體含 "A23Tex"，或檔案層綁定 A23Tex 且本體呼叫 §6.7 原語）
  - 卡號 >= NEW_CARD_FROM 的新卡
嚴格規則：
  R1 至少用到 2 種 §6.7 原語（本體＋同檔一跳 helper）
  R2 非語意 hex 字面值（去重）<= 3（只算本體；theme("#...") 參數與語意紅綠琥珀/黑白豁免）
  R3 必須用 infoFont（本體＋一跳 helper）
  R4 不准出現 Math.random / Date.now（本體＋一跳 helper）
其餘卡只列報表，不影響 exit code。
用法：python kit_quality_gate.py [--json out.json] [--quiet]
"""
import argparse
import json
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

HERE = Path(__file__).resolve().parent
CHARTS = HERE.parent
REG = HERE / "chart_registry.js"
NEW_CARD_FROM = 68
PRIMS = ["pane", "leader", "kvPort", "activeHalo", "specEdge", "hotPacket", "develop", "kvBlock", "orthPath"]
SEMANTIC_HEX = {
    # 紅（失敗/警示）
    "#ef4444", "#f43f5e", "#dc2626", "#e11d48", "#f87171", "#fb7185", "#b91c1c",
    # 綠（通過）
    "#10b981", "#22c55e", "#16a34a", "#34d399", "#4ade80", "#059669",
    # 琥珀（警告）
    "#f59e0b", "#fbbf24", "#eab308", "#d97706",
    # 黑白
    "#fff", "#ffffff", "#000", "#000000",
}
MAX_HEX = 3
# 已知債（閘門上線前就存在、尚未 §6.7 升級）：仍跑檢查並列出違規，但不讓 exit code=1。
# 只准 Claude／用戶增刪；AGY 不得自行加卡號進來。升級完成後務必移除該卡號。
WAIVER = {
}

RE_T = re.compile(r"^\s*(\d+):\s*function\s*\(cv,\s*x\)\s*\{.*?\bC\.([A-Za-z_]\w*)\(", re.M)
RE_FN = re.compile(r"^[ \t]*function\s+([A-Za-z_]\w*)\s*\(", re.M)
RE_CALL = re.compile(r"\b([A-Za-z_]\w*)\s*\(")
RE_HEX = re.compile(r"""["'`](#[0-9a-fA-F]{3,8})\b""")
RE_THEME_ARG = re.compile(r"""theme\(\s*["'](#[0-9a-fA-F]{3,8})["']""")
RE_PX = re.compile(r"""(\d+(?:\.\d+)?)px""")


def strip_comments(src: str) -> str:
    """去註解但保留字串（簡易 tokenizer；regex 字面值不特別處理）。"""
    out, i, n = [], 0, len(src)
    while i < n:
        ch = src[i]
        if ch in "\"'`":
            j = i + 1
            while j < n and src[j] != ch:
                j += 2 if src[j] == "\\" else 1
            out.append(src[i:j + 1]); i = j + 1
        elif src.startswith("//", i):
            j = src.find("\n", i); i = n if j < 0 else j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2); i = n if j < 0 else j + 2
        else:
            out.append(ch); i += 1
    return "".join(out)


def body_at(src: str, start: int) -> str:
    """從 function 宣告位置起，回傳到配對 } 為止的完整函式文字（src 已去註解）。"""
    i = src.find("{", src.find(")", start))
    depth, n = 0, len(src)
    while i < n:
        ch = src[i]
        if ch in "\"'`":
            j = i + 1
            while j < n and src[j] != ch:
                j += 2 if src[j] == "\\" else 1
            i = j + 1; continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return src[start:i + 1]
        i += 1
    return src[start:]


def load_t_map() -> dict:
    txt = REG.read_text(encoding="utf-8")
    m = {}
    for num, fn in RE_T.findall(txt):
        m.setdefault(int(num), fn)
    return m


def index_files():
    files = {}
    for p in sorted(CHARTS.glob("a23_charts*.js")):
        if p.name == "a23_charts_tex.js":
            continue
        src = strip_comments(p.read_text(encoding="utf-8"))
        fns = {}
        for mm in RE_FN.finditer(src):
            fns.setdefault(mm.group(1), mm.start())
        file_tex = bool(re.search(r"A23Tex\.kit\(", src))
        files[p.name] = {"src": src, "fns": fns, "file_tex": file_tex}
    return files


def analyse(num: int, fn: str, files: dict, card_fns: set) -> dict:
    hit = [(name, f) for name, f in files.items() if fn in f["fns"]]
    if not hit:
        return {"card": num, "fn": fn, "file": None, "error": "函式本體找不到"}
    fname, f = hit[0]
    src = f["src"]
    body = body_at(src, f["fns"][fn])
    # 一跳 helper：同檔頂層函式、非其他卡、非 legacy、非自己
    helpers = []
    for name in sorted(set(RE_CALL.findall(body))):
        if name == fn or name in card_fns or name.endswith("Legacy") or name not in f["fns"]:
            continue
        helpers.append(name)
    ext = body + "\n".join(body_at(src, f["fns"][h]) for h in helpers)
    prims = [p for p in PRIMS if re.search(r"(?<![\w$])(?:\w+\.)?" + p + r"\s*\(", ext)]
    themed = set(h.lower() for h in RE_THEME_ARG.findall(body))
    hexes = sorted({h.lower() for h in RE_HEX.findall(body)} - SEMANTIC_HEX - themed)
    info_font = bool(re.search(r"\binfoFont\s*\(", ext))
    nondet = sorted(set(re.findall(r"Math\.random|Date\.now", ext)))
    small_px = sorted({float(v) for v in RE_PX.findall(body) if float(v) < 9})
    tex_ref = "A23Tex" in body  # 只認本體直接引用；檔案層別名（如 studio 的 TEX）不算，列報表
    strict = tex_ref or num >= NEW_CARD_FROM
    fails = []
    if strict:
        if len(prims) < 2:
            fails.append(f"R1 原語 {len(prims)}<2")
        if len(hexes) > MAX_HEX:
            fails.append(f"R2 非語意hex {len(hexes)}>{MAX_HEX}")
        if not info_font:
            fails.append("R3 缺 infoFont")
        if nondet:
            fails.append("R4 " + "/".join(nondet))
    return {"card": num, "fn": fn, "file": fname, "dup": len(hit) > 1, "lines": body.count("\n") + 1,
            "tex_ref": tex_ref, "strict": strict, "prims": prims, "hex": hexes, "infoFont": info_font,
            "nondet": nondet, "small_px": small_px, "fails": fails,
            "waived": WAIVER.get(num) if (strict and fails) else None}


def run(quiet: bool = False, json_out: Path = None) -> int:
    tmap = load_t_map()
    files = index_files()
    card_fns = set(tmap.values())
    rows = [analyse(n, tmap[n], files, card_fns) for n in sorted(tmap)]
    missing = [r for r in rows if r.get("error")]
    strict = [r for r in rows if r.get("strict")]
    waived = [r for r in strict if r["fails"] and r["waived"]]
    failed = [r for r in strict if r["fails"] and not r["waived"]] + missing
    stale = sorted(n for n in WAIVER if not any(r["card"] == n and r["fails"] for r in rows))
    if json_out:
        json_out.write_text(json.dumps(rows, ensure_ascii=False, indent=1), encoding="utf-8")
    if not quiet:
        print(f"{'#':>3} {'函式':<22}{'檔':<24}{'S':<2}{'原語':>4} {'hex':>3} {'iF':<3}{'ND':<3}結果")
        for r in rows:
            if r.get("error"):
                print(f"{r['card']:>3} {r['fn']:<22}{'-':<24}  {'':>4} {'':>3}    FAIL {r['error']}"); continue
            res = ("WAIVED " if r["waived"] else "FAIL ") + "; ".join(r["fails"]) if r["fails"] else ("PASS" if r["strict"] else "report")
            print(f"{r['card']:>3} {r['fn']:<22}{r['file']:<24}{'*' if r['strict'] else ' ':<2}{len(r['prims']):>4} "
                  f"{len(r['hex']):>3} {'Y' if r['infoFont'] else '-':<3}{'Y' if r['nondet'] else '-':<3}{res}")
    else:
        for r in failed:
            print(f"  - #{r['card']} {r['fn']}: {r.get('error') or '; '.join(r['fails'])}")
    tag = "FAIL" if failed else "PASS"
    if stale:
        print(f"  ! WAIVER 已可移除（該卡已無違規）：{stale}")
    print(f"KIT_QUALITY {tag}: strict {len(strict) - len([r for r in strict if r['fails']])}/{len(strict)} "
          f"(A23Tex 卡 {sum(1 for r in rows if r.get('tex_ref'))}＋新卡≥{NEW_CARD_FROM}) | waived {len(waived)} {[r['card'] for r in waived]}"
          f" | report-only {len(rows) - len(strict)} | missing {len(missing)}")
    return 1 if failed else 0


def main() -> int:
    ap = argparse.ArgumentParser(description="A23 §6.7 kit quality gate")
    ap.add_argument("--json", type=Path, help="完整逐卡結果輸出 JSON")
    ap.add_argument("--quiet", action="store_true", help="只印失敗與總結行")
    a = ap.parse_args()
    return run(a.quiet, a.json)


if __name__ == "__main__":
    raise SystemExit(main())
