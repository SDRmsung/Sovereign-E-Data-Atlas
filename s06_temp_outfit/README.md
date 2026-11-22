---
id: "a23.s06_temp_outfit.readme"
title: "s06. (傳)體感溫度穿搭地圖"
aliases:
  - "s06_temp_outfit"
description: "ARA|A23|S06|SPATIOTEMPORAL_TOPIC_SPEC"
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

# 🧥 `s06_temp_outfit` — (傳) 體感溫度穿搭地圖

> **一句話反差副標**：氣候站雨量＋風速＋濕度對全台一日穿搭的撕裂影響（整併原 #01 氣象爬蟲）  
> **時間顆粒度**：小時級（逐時觀測與鄉鎮預報）

## 1. 受眾與價值主張

- **主要受眾**：一般大眾與媒體（每天決定穿什麼）；次要：長者照顧單位
- **價值主張**：同一天不同縣市的體感差距，化為穿搭分區
- **不做（Out of Scope）**：個人化穿搭推薦、健康預警

## 2. 指標與代理變數

- 套用通用熱氣候指數（UTCI）/ 勞斯體感公式，將「氣溫＋濕度＋東北季風風速」即時換算為真實體感溫度。
- 以反距離權重法（IDW）/ 克里金插值生成全島連續網格場，映射為 5 級穿搭決策區（短袖、薄長袖、風衣、毛衣、防風羽絨）。

## 3. 資料源與限制

- 中央氣象署開放資料平臺（CWA）：自動氣象站與局屬測站逐時 API（氣溫、相對濕度、瞬間風速、雨量）
- 中央氣象署開放資料平臺（CWA）：鄉鎮逐時體感溫度預報資料集
- **限制**：觀測站稀疏處以 IDW 內插，山區與離島為推估；體感換算（UTCI）的假設需註明。

## 4. 視覺映射規格（`deck.gl`；底圖依敘事選用，不強制 DEM）

- 底圖與圖層：ContourLayer（體感等溫推進波）+ WebGL 粒子風場 + 動態穿搭圖示 HUD。
- 視覺反差敘事：強烈冷氣團伴隨白色風場粒子自富貴角如海嘯向南吞噬，同框對比「桃園體感 8°C 羽絨衣」與「屏東 26°C 短袖陽光」。

## 5. 五力評估與風險（資料力 + 視覺力 + 故事力 + 共鳴力 + 應用力）

> 只寫理由與扣分點，不評分；扣分基準見 [[35-Areas/A23_Data_Atlas/00_notes/n00_story_scoring_gate|n00. 評分門檻]]。

- **資料力**：官方逐時觀測與預報穩定；扣分：小時級偏粗，站點稀疏區靠內插。
- **視覺力**：體感等溫推進波加風場粒子如寒潮南下；扣分：非寒流日畫面平淡。
- **故事力**：同一天桃園穿羽絨屏東穿短袖，反差清楚；扣分：起伏依賴冷氣團事件。
- **共鳴力**：每天出門都要決定穿什麼，最貼身；扣分：體感換算與個人差異大。
- **應用力**：可供寒流宣導；扣分：商業用途多於政策，非醫療或健康建議。



## 資料誠信
- 資料更新：2026-11（即時/快照）
- 來源：開放資料平台 / 權威機關
- 聲明：本頁為民間加值整理，非官方資訊；以原始機關公告為準
- 結構化資訊：頁面 <head> 含 JSON-LD（Dataset：name/description/dateModified/license）

## 無 JS 備援
- 地圖下方輸出 <noscript> 或靜態 <details> 清單，依行政區分組，含筆數
- 適用：點位型專案（canvas=geo 且有座標點）