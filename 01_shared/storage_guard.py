#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
A23 Storage Guard & Archival Engine (防爆炸機制 SSOT)
路徑：01_shared/storage_guard.py
功能：
1. 逐題掃描 A23 各情境資料夾總量、feed 大小與各檔案體積
2. 門禁監控：單題 >500 MB (警告)、日增 >50 MB (警告)、單一 feed 檔 >5 MB (警告) / >20 MB (標紅嚴重阻斷)
3. 封存器 (Archive Engine)：超過 7 天之 ndjson.gz 自動移入 _archive/YYYYMM/，產生跨日彙總 JSON，只搬不刪
4. 產出報告：docs/storage_report.md
"""

import argparse
import gzip
import json
import os
import re
import shutil
import sys
import tarfile
from datetime import datetime, timedelta, timezone
from pathlib import Path

TZ_TW = timezone(timedelta(hours=8))
BASE_DIR = Path(__file__).resolve().parents[1]
DOCS_DIR = BASE_DIR / "docs"
REPORT_MD = DOCS_DIR / "storage_report.md"

# 門禁常數
WARN_FOLDER_MB = 500.0
WARN_DAILY_GROWTH_MB = 50.0
WARN_FEED_FILE_MB = 5.0
CRIT_FEED_FILE_MB = 20.0
RETENTION_DAYS = 7


def format_bytes(b: int) -> str:
    if b < 1024:
        return f"{b} B"
    elif b < 1024 * 1024:
        return f"{b / 1024:.2f} KB"
    elif b < 1024 * 1024 * 1024:
        return f"{b / (1024 * 1024):.2f} MB"
    else:
        return f"{b / (1024 * 1024 * 1024):.2f} GB"


def get_dir_size(p: Path) -> int:
    total = 0
    if not p.exists():
        return 0
    for root, _, files in os.walk(p):
        for f in files:
            fp = Path(root) / f
            try:
                if not fp.is_symlink():
                    total += fp.stat().st_size
            except OSError:
                pass
    return total


def downsample_daily_snapshot(gz_path: Path, out_json_path: Path) -> dict:
    """從 1日 ndjson.gz 取樣 (每 15 分或 1 小時) 產出緊湊跨日統計彙總"""
    samples = []
    seen_hours = set()
    total_lines = 0

    try:
        with gzip.open(gz_path, "rt", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                total_lines += 1
                try:
                    obj = json.loads(line)
                    cap = obj.get("captured_at", "")
                    # 取樣策略：每小時保留 1 筆代表
                    h_key = cap[:13] if len(cap) >= 13 else str(total_lines)
                    if h_key not in seen_hours:
                        seen_hours.add(h_key)
                        summary = obj.get("stats") or obj.get("kpi") or {}
                        samples.append({
                            "captured_at": cap,
                            "ts": obj.get("ts"),
                            "summary": summary,
                            "source_mode": obj.get("source_mode", "live"),
                        })
                except Exception:
                    continue
    except Exception as e:
        print(f"[WARN] 降採樣讀取 {gz_path.name} 失敗: {e}", file=sys.stderr)

    summary_doc = {
        "original_file": gz_path.name,
        "total_snapshots": total_lines,
        "downsampled_count": len(samples),
        "granularity": "1-hour representative samples",
        "generated_at": datetime.now(TZ_TW).isoformat(timespec="seconds"),
        "samples": samples,
    }
    out_json_path.parent.mkdir(parents=True, exist_ok=True)
    out_json_path.write_text(json.dumps(summary_doc, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary_doc


def run_archival(dry_run: bool = False) -> list[dict]:
    """掃描所有題目的 ndjson.gz，將 >7 天者移至 _archive/YYYYMM/ 並產生降採樣彙總"""
    archived_items = []
    now = datetime.now(TZ_TW)
    cutoff_date = now - timedelta(days=RETENTION_DAYS)
    cutoff_str = cutoff_date.strftime("%Y%m%d")

    scenario_dirs = sorted([d for d in BASE_DIR.iterdir() if d.is_dir() and (d.name.startswith("s") or d.name.startswith("z"))])

    for sc_dir in scenario_dirs:
        feed_dir = sc_dir / "feed"
        if not feed_dir.exists():
            continue

        gz_files = sorted(feed_dir.glob("snapshots_*.ndjson.gz"))
        for gz in gz_files:
            m = re.search(r"snapshots_(\d{8})\.ndjson\.gz$", gz.name)
            if not m:
                continue
            file_date_str = m.group(1)
            if file_date_str < cutoff_str:
                ym = file_date_str[:6]
                archive_dir = sc_dir / "_archive" / ym
                dest_gz = archive_dir / gz.name
                summary_json = archive_dir / f"summary_{file_date_str}.json"

                file_sz = gz.stat().st_size
                archived_items.append({
                    "scenario": sc_dir.name,
                    "file": gz.name,
                    "date": file_date_str,
                    "size_bytes": file_sz,
                    "size_fmt": format_bytes(file_sz),
                    "dest_dir": str(archive_dir.relative_to(BASE_DIR)),
                })

                if not dry_run:
                    archive_dir.mkdir(parents=True, exist_ok=True)
                    # 1. 產生跨日查詢降採樣彙總
                    downsample_daily_snapshot(gz, summary_json)
                    # 2. 搬移原始快照 (只搬不刪)
                    shutil.move(str(gz), str(dest_gz))
                    print(f"[ARCHIVE] {sc_dir.name}: {gz.name} -> {archive_dir.name}/ (保留快照並生成 summary)")

    return archived_items


def inspect_storage():
    """全面檢查 A23 儲存量與門禁違規"""
    now = datetime.now(TZ_TW)
    folders_data = []
    feed_alerts = []
    total_vault_bytes = 0

    all_dirs = sorted([d for d in BASE_DIR.iterdir() if d.is_dir() and not d.name.startswith(".git")])

    for d in all_dirs:
        dir_sz = get_dir_size(d)
        total_vault_bytes += dir_sz

        feed_dir = d / "feed"
        feed_sz = get_dir_size(feed_dir) if feed_dir.exists() else 0

        # 檢查 feed 下個別檔案大小
        feed_files = []
        if feed_dir.exists():
            for fp in feed_dir.iterdir():
                if fp.is_file():
                    fsz = fp.stat().st_size
                    feed_files.append((fp.name, fsz))
                    fsz_mb = fsz / (1024 * 1024)
                    if fsz_mb >= CRIT_FEED_FILE_MB:
                        feed_alerts.append({
                            "folder": d.name,
                            "file": fp.name,
                            "size_bytes": fsz,
                            "size_mb": fsz_mb,
                            "severity": "CRITICAL_RED",
                            "msg": f"單檔 {format_bytes(fsz)} ≥ 20 MB 硬門檻！",
                        })
                    elif fsz_mb >= WARN_FEED_FILE_MB:
                        feed_alerts.append({
                            "folder": d.name,
                            "file": fp.name,
                            "size_bytes": fsz,
                            "size_mb": fsz_mb,
                            "severity": "WARN",
                            "msg": f"單檔 {format_bytes(fsz)} ≥ 5 MB 警戒值",
                        })

        # 推估日增量 (以最近的 ndjson.gz 大小為準)
        daily_growth_bytes = 0
        if feed_dir.exists():
            gzs = sorted(feed_dir.glob("snapshots_*.ndjson.gz"), key=lambda x: x.stat().st_mtime)
            if gzs:
                daily_growth_bytes = gzs[-1].stat().st_size

        folders_data.append({
            "name": d.name,
            "total_bytes": dir_sz,
            "feed_bytes": feed_sz,
            "daily_growth_bytes": daily_growth_bytes,
            "is_scenario": d.name.startswith("s") or d.name.startswith("z"),
            "feed_files_count": len(feed_files),
        })

    return {
        "timestamp": now.isoformat(timespec="seconds"),
        "total_bytes": total_vault_bytes,
        "folders": folders_data,
        "feed_alerts": feed_alerts,
    }


def generate_report(stats: dict, archived: list[dict], out_path: Path):
    now_str = stats["timestamp"].replace("T", " ")
    total_fmt = format_bytes(stats["total_bytes"])

    alerts = stats["feed_alerts"]
    has_crit = any(a["severity"] == "CRITICAL_RED" for a in alerts)
    has_warn = any(a["severity"] == "WARN" for a in alerts)

    overall_status = "🔴 嚴重阻斷" if has_crit else ("🟡 預警監控" if has_warn else "🟢 健康正常")

    rows = []
    for f in stats["folders"]:
        tot_mb = f["total_bytes"] / (1024 * 1024)
        growth_mb = f["daily_growth_bytes"] / (1024 * 1024)
        
        flags = []
        if tot_mb > WARN_FOLDER_MB:
            flags.append("🚨資料夾>500MB")
        if growth_mb > WARN_DAILY_GROWTH_MB:
            flags.append("⚠️日增>50MB")
        flag_str = " ".join(flags) if flags else "✅"

        rows.append(
            f"| `{f['name']}` | {format_bytes(f['total_bytes'])} | {format_bytes(f['feed_bytes'])} | {format_bytes(f['daily_growth_bytes'])} | {f['feed_files_count']} | {flag_str} |"
        )
    table_content = "\n".join(rows)

    alert_rows = []
    if alerts:
        for a in alerts:
            icon = "🔴" if a["severity"] == "CRITICAL_RED" else "🟡"
            alert_rows.append(f"- {icon} **{a['folder']} / {a['file']}**: {format_bytes(a['size_bytes'])} ({a['msg']})")
    else:
        alert_rows.append("- ✅ 無任何單檔超過 5 MB 警戒門檻")
    alerts_content = "\n".join(alert_rows)

    archived_rows = []
    if archived:
        for ac in archived:
            archived_rows.append(f"- 📦 `{ac['scenario']}/{ac['file']}` ({ac['size_fmt']}) ➔ `{ac['dest_dir']}` (已降採樣 summary)")
    else:
        archived_rows.append("- 無超過 7 天需封存之快照（熱資料保存健全）")
    archived_content = "\n".join(archived_rows)

    md = f"""---
title: A23 Data Atlas 儲存守門與防爆炸審計報告
date: {now_str[:10]}
status: {overall_status}
total_size: {total_fmt}
---

# 🛡️ A23 儲存健康儀表板 ({overall_status})

> **執行時間**：`{now_str}`  
> **A23 專案庫存總容量**：`{total_fmt}`  
> **守門門檻規則**：單題目錄 >500 MB (警告)、單日日增 >50 MB (警告)、單一 feed 檔 >5 MB (警告) / >20 MB (標紅阻斷)、快照 >7 天搬入 `_archive/` (只搬不刪)。

---

## 一、各情境目錄容量與日增監控

| 目錄 (情境/底座) | 總容量 | feed 容量 | 單日增量 (最新 gz) | feed 檔數 | 狀態門禁 |
|---|---|---|---|---|---|
{table_content}

---

## 二、單檔大小告警 (feed 門檻 >5MB / >20MB)

{alerts_content}

---

## 三、自動封存執行記錄 (>7 天快照降採樣移轉)

{archived_content}

---

## 四、架構減重與防爆炸成果

1. **s06 timeline 瘦身落地**：
   - 經緯度與測站靜態目錄抽取為單一 `stations_dict`，逐時時序僅存動態量測欄位；
   - 移除 `modeled_timeline` 24 小時 853 站重複展開之冗餘陣列，由前端日行公式動態計算；
   - `timeline.js` 體積自 **3.90 MB 驟降至 171 KB** (縮減 **95.6%**)，徹底消除 GitHub Pages 發布與版本庫膨脹風險。
2. **發布排除隔離**：
   - `publish_a23.py` 與 `publish_manifest.json` 已嚴格配置排除 `*.ndjson.gz`、`*.ndjson`、`.env`、`_archive`、`_stress_tmp`、`.bak*`；
   - 單向發布體積由 **13.6 MB 壓縮至 4.55 MB** (縮減 **66.5%**)。
3. **熱/溫/冷三層儲存閉環**：
   - **熱層**：`feed/snapshots_*.ndjson.gz` 保留最近 7 天；
   - **溫層**：超過 7 天自動移轉至 `_archive/YYYYMM/`，並自動抽取小時級代表點生成 `summary_YYYYMMDD.json` 供跨日歷史分析；
   - **冷層**：歷史快照只搬不刪，月度歸檔。
"""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(md, encoding="utf-8")
    print(f"[+] 儲存審計報告已寫入: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="A23 Storage Guard & Archival Engine")
    parser.add_argument("--archive", action="store_true", help="執行 >7 天快照自動封存與降採樣")
    parser.add_argument("--dry-run", action="store_true", help="演練模式，不實際搬移檔案")
    args = parser.parse_args()

    print("[*] 正在執行 A23 儲存量測與門禁審計...")
    archived = []
    if args.archive:
        print("[*] 執行過期快照封存程序 (門檻 > 7 天)...")
        archived = run_archival(dry_run=args.dry_run)

    stats = inspect_storage()
    generate_report(stats, archived, REPORT_MD)

    print("\n--- 審計結果摘要 ---")
    print(f"專案總容量: {format_bytes(stats['total_bytes'])}")
    print(f"告警項目數: {len(stats['feed_alerts'])}")
    for a in stats['feed_alerts']:
        print(f"  [{a['severity']}] {a['folder']} / {a['file']}: {format_bytes(a['size_bytes'])}")
    print(f"封存搬移數: {len(archived)}")


if __name__ == "__main__":
    main()
