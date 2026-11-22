---
id: "a23.s01_artery_flow.readme"
title: "s01. (傳)台灣的大動脈：國道與雙鐵脈動"
aliases:
  - "s01_artery_flow"
description: "ARA|A23|S01|SPATIOTEMPORAL_TOPIC_SPEC"
tags:
  - domain/sys
  - domain/eng
  - area/A23
  - state/active
type: note
compiler_status: active
created: "2026-11-01"
updated: "2026-11-02"
parent:
  - "[[35-Areas/A23_Data_Atlas/000_MOC_A23_Data_Atlas|🕷️ A23 爬蟲情報中樞總圖]]"
related:
  - "[[35-Areas/A23_Data_Atlas/00_notes/n00_story_scoring_gate|🎯 n00. 五維評分門檻]]"
  - "[[35-Areas/A23_Data_Atlas/00_notes/n03_deckgl_shader_grammar|⚡ n03. deck.gl 渲染語法]]"
agent_harness:
  trigger:
    - on_read
  actions:
    - bind_shared_pipeline
  boundary:
    - max_tokens: 600
    - mode: read_only
---

# 🛣️ `s01_artery_flow` — (傳) 台灣的大動脈：國道與雙鐵脈動

> **一句話反差副標**：颱風日全台十萬車流與軌道停駛韌性縮時  
> **時間顆粒度**：1 分鐘即時快照

## 1. 受眾與價值主張

- **主要受眾**：一般大眾與媒體（颱風日看交通與軌道韌性）；次要：防災單位事後檢討
- **價值主張**：一眼看出颱風天哪裡斷了、哪裡還在跑（西部動脈流動 vs 東部斷流）
- **不做（Out of Scope）**：即時路況導航、封路預測

## 2. 指標與代理變數

- 採 Track A 高公局免金鑰 + Track B TDX OAuth2 雙軌擷取，單日附加寫入 snapshots_YYYYMMDD.ndjson.gz。
- 輸出 latest_frame.json 與零 CORS latest_frame.js，將西部走廊與台 74 線區間速率映射至發光路網。

## 3. 資料源與限制

- 高公局免金鑰直連：tisvcloud.freeway.gov.tw VDLive.xml.gz（國道全線分鐘級車速與流量）
- 交通部 TDX 平臺：省道快速道路 VD（v2/Road/Traffic/Live/VD/Highway）與台鐵/高鐵即時位置
- 中央氣象署開放資料：紅外線颱風衛星雲圖序列（17:30+ 疊層）
- **限制**：VD 為路段斷面聚合速率，光跡是沿路段依速率動畫，不代表個別車輛軌跡；衛星雲圖與車流需以時間戳對齊並標註來源。

## 4. 視覺映射規格（`deck.gl`；底圖依敘事選用，不強制 DEM）

- 底圖與圖層：內政部 20m DEM 暗色浮雕 + deck.gl PathLayer（雙層光暈）+ ScatterplotLayer（VD 節點）。
- 視覺反差敘事：東部蘇花與北迴線因颱風預警封閉斷流，對照西部走廊冰晶藍高速動脈與台中大雅/台74琥珀橘尖峰脈動。

## 5. 五力評估與風險（資料力 + 視覺力 + 故事力 + 共鳴力 + 應用力）

> 只寫理由與扣分點，不評分；扣分基準見 [[35-Areas/A23_Data_Atlas/00_notes/n00_story_scoring_gate|n00. 評分門檻]]。

- **資料力**：免金鑰即時 API 穩定；座標與時間戳齊全，扣分：VD 為聚合斷面非個體軌跡，雙鐵與氣象更新頻率不同需對齊。
- **視覺力**：光跡流動天生適合縮時；西部流動對照東部斷流反差強，扣分：長時間縮時若無分鏡易單調。
- **故事力**：颱風天仍有十萬車流，一句講完；平靜、封路、恢復起伏完整，扣分：依賴颱風事件，平日無劇情。
- **共鳴力**：人人開過國道搭過雙鐵，3 秒看懂；扣分：非災區居民轉發動機較弱。
- **應用力**：可供防災疏運檢討與媒體報導；扣分：屬已知議題政策新解有限，未驗證可作即時調度依據。



## 資料誠信
- 資料更新：2026-11（即時/快照）
- 來源：開放資料平台 / 權威機關
- 聲明：本頁為民間加值整理，非官方資訊；以原始機關公告為準
- 結構化資訊：頁面 <head> 含 JSON-LD（Dataset：name/description/dateModified/license）

## 無 JS 備援
- 地圖下方輸出 <noscript> 或靜態 <details> 清單，依行政區分組，含筆數
- 適用：點位型專案（canvas=geo 且有座標點）