---
id: "a23.s02_youbike_tide.readme"
title: "s02. (傳)YouBike潮汐調度戰"
aliases:
  - "s02_youbike_tide"
description: "ARA|A23|S02|SPATIOTEMPORAL_TOPIC_SPEC"
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

# 🚲 `s02_youbike_tide` — (傳) YouBike潮汐調度戰

> **一句話反差副標**：通勤潮如何搬空一座城市的車  
> **時間顆粒度**：分鐘級（5 分鐘批次更新）

## 1. 受眾與價值主張

- **主要受眾**：通勤族與媒體；次要：YouBike 營運商（事後檢討調度）
- **價值主張**：看見通勤潮一早搬空住宅區的車、捷運站塞爆，以及半夜調度車逆向補回
- **不做（Out of Scope）**：站點即時借還推薦、調度派車最佳化

## 2. 指標與代理變數

- 每 5 分鐘拉取都會區全站點 AvailableRentBikes 與 AvailableReturnBikes，計算滿車率並寫入時序庫。
- 利用空間鄰近度與時間差計算站點群組間「淨流量梯度向量場（Gradient Vector Field）」，反推通勤潮與深夜調度保母車流向。

## 3. 資料源與限制

- 交通部 TDX 平臺：公共自行車即時車位 API（v2/Bike/Availability/City/{City}）與站點基本資料 API
- 內政部國土測繪中心：捷運站點 / 火車站出入口座標圖資（通勤核心錨點）
- **限制**：只有站點車位數的 5 分鐘快照，看不到個別騎乘；淨流量為車位變化推算，含調度車搬運，需區分。

## 4. 視覺映射規格（`deck.gl`；底圖依敘事選用，不強制 DEM）

- 底圖與圖層：黑底 MapLibre + deck.gl ScatterplotLayer（站點呼吸燈）+ HeatmapLayer（區域缺車熱力）。
- 視覺反差敘事：07:00–09:00 住宅區瞬間由綠轉刺眼紅光歸零，捷運站爆出亮白塞爆光斑；凌晨 02:00 調度車逆向補回綠光。

## 5. 五力評估與風險（資料力 + 視覺力 + 故事力 + 共鳴力 + 應用力）

> 只寫理由與扣分點，不評分；扣分基準見 [[35-Areas/A23_Data_Atlas/00_notes/n00_story_scoring_gate|n00. 評分門檻]]。

- **資料力**：官方車位 API 穩定且全都會覆蓋；扣分：僅站點層級 5 分鐘快照，淨流量混入調度車搬運。
- **視覺力**：站點呼吸燈加缺車熱力，潮汐感強；扣分：站點密集區光點重疊需控制密度。
- **故事力**：通勤潮搬空一座城市的車，早晚與半夜調度起伏完整；扣分：假日劇情較弱。
- **共鳴力**：借不到、還不了是通勤族日常；扣分：非騎乘者無切身感。
- **應用力**：可供營運商調度與增設站點參考；扣分：屬營運優化而非重大政策，未驗證營運商會採用。



## 資料誠信
- 資料更新：2026-11（即時/快照）
- 來源：開放資料平台 / 權威機關
- 聲明：本頁為民間加值整理，非官方資訊；以原始機關公告為準
- 結構化資訊：頁面 <head> 含 JSON-LD（Dataset：name/description/dateModified/license）

## 無 JS 備援
- 地圖下方輸出 <noscript> 或靜態 <details> 清單，依行政區分組，含筆數
- 適用：點位型專案（canvas=geo 且有座標點）