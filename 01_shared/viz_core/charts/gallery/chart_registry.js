/* A23 Chart Registry (shared by chart_grid.html & chart_render.html) */
(function (global) {
  var D = global.A23_DEMO_S02, B4 = global.A23_DEMO_B4, B5 = global.A23_DEMO_B5, C = global.A23Charts;
  function X(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in (b || {})) o[k] = b[k]; return o; }

  var names = Object.keys(D.bar[0].values), hrs = D.bar.map(function (f) { return f.label.slice(0, 2); });
  var ST = { x: hrs, series: names.slice(0, 6).map(function (n) { return { name: n, values: D.bar.map(function (f) { return f.values[n] || 0; }) }; }) };
  var R6 = D.heat.rows.slice(0, 6), ri = R6.map(function (r) { return D.heat.rows.indexOf(r); });
  var avg = ri.map(function (i) { var a = D.heat.z[i]; return a.reduce(function (p, q) { return p + q; }, 0) / a.length; });
  var RD = { axes: R6, max: 1, frames: D.heat.cols.map(function (cl, h) { return { label: cl + "時", series: [{ name: "該時段", values: ri.map(function (i) { return D.heat.z[i][h]; }) }, { name: "全日均", values: avg }] }; }) };
  var cn = []; D.flow.arcs.forEach(function (a) { if (cn.indexOf(a.from) < 0) cn.push(a.from); if (cn.indexOf(a.to) < 0) cn.push(a.to); });
  var M = cn.map(function () { return cn.map(function () { return 0; }); }); D.flow.arcs.forEach(function (a) { M[cn.indexOf(a.from)][cn.indexOf(a.to)] += a.v; });
  var TPE = ["中正區", "大同區", "中山區", "松山區", "大安區", "萬華區", "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區"];
  function grp(f) { return names.filter(f).map(function (n) { return { name: n.replace("區", ""), values: D.bar.map(function (b) { return b.values[n] || 0; }) }; }); }
  var SB = { x: D.bar.map(function (f) { return f.label; }), tree: { name: "可借車", children: [{ name: "臺北", children: grp(function (n) { return TPE.indexOf(n) >= 0; }) }, { name: "新北", children: grp(function (n) { return TPE.indexOf(n) < 0; }) }] } };
  var GEO = (global.A23_TW_TOWNS || []).filter(function (t) { return t.county === "台北市" || t.county === "新北市"; }).map(function (t) { return { key: t.name, name: t.name, rings: t.rings }; });

  var CODEX_30 = {
    clusters: [
      { id: "CORE", label: "CORE", lat: 24, lon: -35, color: "#38bdf8", count: 24 },
      { id: "TOOLS", label: "TOOLS", lat: -14, lon: 22, color: "#10b981", count: 19 },
      { id: "AGENTS", label: "AGENTS", lat: 38, lon: 78, color: "#a78bfa", count: 16 },
      { id: "WORKFLOW", label: "WORKFLOW", lat: -28, lon: -105, color: "#f59e0b", count: 14 },
      { id: "MEMORY", label: "MEMORY", lat: 12, lon: 145, color: "#14b8a6", count: 18 },
      { id: "SECURITY", label: "SECURITY", lat: -36, lon: 108, color: "#f43f5e", count: 11 }
    ],
    arcs: [
      { from: "CORE", to: "TOOLS" }, { from: "CORE", to: "AGENTS" }, { from: "CORE", to: "MEMORY" },
      { from: "TOOLS", to: "WORKFLOW" }, { from: "AGENTS", to: "SECURITY" }, { from: "MEMORY", to: "SECURITY" },
      { from: "WORKFLOW", to: "CORE" }
    ]
  };

  var LIVE = {
    1: function (cv, x) { return C.barRace(cv, D.bar, X({ topN: 6, fps: 1.2 }, x)); },
    2: function (cv, x) { return C.line(cv, D.line, X({ fps: 1.5 }, x)); },
    3: function (cv, x) { return C.streamgraph(cv, ST, X({ fps: 1.5, dec: 0 }, x)); },
    4: function (cv, x) { return C.donut(cv, B4.donut, X({ fps: 1.2, unit: "測站", short: function (k) { return k.split("_")[1] || k; }, note: B4.donut.note }, x)); },
    5: function (cv, x) { return C.histogram(cv, B4.hist, X({ fps: 1.2, min: -4, max: 38, bins: 21, unit: "°C", note: B4.hist.note }, x)); },
    6: function (cv, x) { return C.waterfall(cv, B5["6"], X({ fps: 1.2, note: "可借車Δ·雙北各區", short: function (k) { return k.replace(/區$/, ""); } }, x)); },
    7: function (cv, x) { return C.funnel(cv, B5["7"], X({ fps: 1.0, note: "Eurostat 電商使用漏斗" }, x)); },
    8: function (cv, x) { return C.bubble(cv, D.bubble, X({ fps: 1.2 }, x)); },
    9: function (cv, x) { return C.scatter(cv, B5["9"], X({ fps: 1.2, note: "站點容量×滿載率", xlab: "車柱容量 →", ylab: "↑ 滿載率" }, x)); },
    10: function (cv, x) { return C.heatmap(cv, D.heat, X({ fps: 1.5, min: 0, max: 1 }, x)); },
    11: function (cv, x) { return C.radar(cv, RD, X({ fps: 1.2 }, x)); },
    12: function (cv, x) { return C.sankey(cv, D.sankey, X({}, x)); },
    13: function (cv, x) { return C.chord(cv, { names: cn, frames: [{ label: "推估", matrix: M }, { label: "推估", matrix: M }] }, X({ fps: 0.5 }, x)); },
    14: function (cv, x) { return C.network(cv, D.net, X({}, x)); },
    15: function (cv, x) { return C.treemap(cv, D.bar, X({ fps: 1.2 }, x)); },
    16: function (cv, x) { return C.sunburst(cv, SB, X({ fps: 1.2, dec: 0 }, x)); },
    17: function (cv, x) { return C.parallel(cv, B5["17"], X({ fps: 1.0, note: "OECD 多維福祉指標" }, x)); },
    18: function (cv, x) { return C.boxPlot(cv, B4.box, X({ fps: 1.2, unit: "°C", short: function (g) { return g.replace(/[市縣]$/, ""); }, note: "體感°C·各縣市" }, x)); },
    19: function (cv, x) { return GEO.length ? C.choropleth(cv, { features: GEO, frames: D.choro.frames }, X({ fps: 1.2, min: 0, max: 1, lineWidth: 0.5, fitData: true, labels: false }, x)) : C.choropleth(cv, D.choro, X({ fps: 1.2, min: 0, max: 1 }, x)); },
    20: function (cv, x) { return C.flowMap(cv, D.flow, X({}, x)); },
    21: function (cv, x) { return C.trajectory(cv, B5["21"], X({ fps: 1.2, note: "NOAA AIS 船舶航跡" }, x)); },
    22: function (cv, x) { return C.globeArcs(cv, B5["22"], X({ fps: 1.2, note: "OpenFlights 航線記錄數" }, x)); },
    23: function (cv, x) { return C.dotDensity(cv, B5["23"], X({ fps: 1.2, note: "USGS 全球 M4.0+ 地震" }, x)); },
    24: function (cv, x) { return C.gauge(cv, B4.gauge, X({ fps: 1.5, unit: "全市滿載率（s02）" }, x)); },
    25: function (cv, x) { return C.wordCloud(cv, B5["25"], X({ fps: 1.0, note: "美國聯邦公報政策詞頻" }, x)); },
    26: function (cv, x) { return C.timeline(cv, B5["26"], X({ fps: 1.2, note: "A23 專案里程碑演進" }, x)); },
    27: function (cv, x) { return C.gantt(cv, B5["27"], X({ fps: 1.0, note: "A23 場景開發排程 (來源: 本機檔案 mtime)" }, x)); },
    28: function (cv, x) { return C.corrMatrix(cv, B5["28"], X({ fps: 1.2, note: "CWA 氣象要素皮爾森相關" }, x)); },
    29: function (cv, x) { return C.surface(cv, B5["29"], X({ fps: 1.2, note: "美國財政部公債殖利率曲線 2.5D" }, x)); },
    30: function (cv, x) { return C.codexGlobe(cv, CODEX_30, X({ fps: 1.5, radiusScale: 0.39, note: "CODEX // PLUGINS 3D 測地線星系 (支援拖曳旋轉)" }, x)); },
    31: function (cv, x) { return C.ycGraph(cv, {}, X({ fps: 1.5 }, x)); },
    32: function (cv, x) { return C.ycWikiTree(cv, {}, X({ fps: 1.5 }, x)); },
    33: function (cv, x) { return C.ycAiMemory(cv, {}, X({ fps: 1.5 }, x)); },
    34: function (cv, x) { return C.ycVoiceNote(cv, {}, X({ fps: 1.5 }, x)); },
    35: function (cv, x) { return C.ycNightlyPass(cv, {}, X({ fps: 1.5 }, x)); },
    36: function (cv, x) { return C.ycCdeMklink(cv, {}, X({ fps: 1.5 }, x)); },
    37: function (cv, x) { return C.invCccBar(cv, global.A23_DEMO_INV, X({ fps: 1.2 }, x)); },
    38: function (cv, x) { return C.invPareto(cv, global.A23_DEMO_INV, X({ fps: 24 }, x)); },
    39: function (cv, x) { return C.invAbcXyz(cv, global.A23_DEMO_INV, X({ fps: 1.2 }, x)); },
    40: function (cv, x) { return C.invBulletWall(cv, global.A23_DEMO_INV, X({ fps: 1.2 }, x)); },
    41: function (cv, x) { return C.invWarehouseHeat(cv, global.A23_DEMO_INV, X({ fps: 18 }, x)); },
    42: function (cv, x) { return C.invTradeoff(cv, global.A23_DEMO_INV, X({ fps: 20 }, x)); },
    43: function (cv, x) { return C.corticalTorus3D(cv, {}, X({ fps: 1.5 }, x)); },
    44: function (cv, x) { return C.dagPipeline(cv, {}, X({ fps: 1.5 }, x)); },
    45: function (cv, x) { return C.dumbbellPlot(cv, {}, X({ fps: 1.5 }, x)); },
    46: function (cv, x) { return C.marimekkoStrip(cv, {}, X({ fps: 1.5 }, x)); },
    47: function (cv, x) { return C.tailRidge(cv, {}, X({ fps: 1.2 }, x)); },
    48: function (cv, x) { return C.galtonLattice(cv, {}, X({ fps: 1.5 }, x)); },
    49: function (cv, x) { return C.swarmBurst(cv, {}, X({ fps: 1.5 }, x)); },
    50: function (cv, x) { return C.runLog(cv, {}, X({ fps: 1.5 }, x)); },
    51: function (cv, x) { return C.unitGapBoard(cv, {}, X({ fps: 1.5 }, x)); },
    52: function (cv, x) { return C.moduleMultiples(cv, {}, X({ fps: 1.5 }, x)); },
    53: function (cv, x) { return C.loopSphere(cv, {}, X({ fps: 1.5 }, x)); },
    54: function (cv, x) { return C.loopScrubber(cv, {}, X({ fps: 1.5 }, x)); },
    55: function (cv, x) { return C.signalDecisionDiff(cv, {}, X({ fps: 1.5 }, x)); },
    56: function (cv, x) { return C.guardrailFunnel(cv, {}, X({ fps: 1.5 }, x)); },
    57: function (cv, x) { return C.spanPointer(cv, {}, X({ fps: 1.5 }, x)); },
    58: function (cv, x) { return C.orbitRace(cv, {}, X({ fps: 1.5 }, x)); },
    59: function (cv, x) { return C.modelCostBoard(cv, {}, X({ fps: 1.5 }, x)); },
    60: function (cv, x) { return C.orbBundle(cv, {}, X({ fps: 1.5 }, x)); },
    61: function (cv, x) { return C.landingCurve(cv, {}, X({ fps: 1.5 }, x)); },
    62: function (cv, x) { return C.constellationMap(cv, {}, X({ fps: 1.5 }, x)); },
    63: function (cv, x) { return C.agentSquad(cv, {}, X({ fps: 1.5 }, x)); },
    64: function (cv, x) { return C.stageCards(cv, {}, X({ fps: 1.5 }, x)); },
    65: function (cv, x) { return C.pcbBus(cv, {}, X({ fps: 1.5 }, x)); },
    66: function (cv, x) { return C.nleTimeline(cv, {}, X({ fps: 1.5 }, x)); },
    67: function (cv, x) { return C.costDrop(cv, {}, X({ fps: 1.5 }, x)); },
    68: function (cv, x) { return C.verdictStack(cv, {}, X({ fps: 1.5 }, x)); },
    69: function (cv, x) { return C.checkTree(cv, {}, X({ fps: 1.5 }, x)); },
    70: function (cv, x) { return C.operatorMap(cv, {}, X({ fps: 1.5 }, x)); },
    71: function (cv, x) { return C.glassMonolith(cv, {}, X({ fps: 1.5 }, x)); },
    72: function (cv, x) { return C.lawCone(cv, {}, X({ fps: 12 }, x)); },
    73: function (cv, x) { return C.stateChain(cv, {}, X({ fps: 1.2 }, x)); },
    74: function (cv, x) { return C.depthLadder(cv, {}, X({ fps: 1.5 }, x)); },
    75: function (cv, x) { return C.hudVitals(cv, {}, X({ fps: 1.5 }, x)); },
    76: function (cv, x) { return C.hudLoadout(cv, {}, X({ fps: 1.5 }, x)); },
    77: function (cv, x) { return C.hudSkillTree(cv, {}, X({ fps: 1.5 }, x)); },
    78: function (cv, x) { return C.hudLockOn(cv, {}, X({ fps: 1.5 }, x)); },
    79: function (cv, x) { return C.hudRadialMenu(cv, {}, X({ fps: 1.5 }, x)); },
    80: function (cv, x) { return C.hudCompass(cv, {}, X({ fps: 1.5 }, x)); },
    81: function (cv, x) { return C.hudFeedback(cv, {}, X({ fps: 1.5 }, x)); }
  };

  /* Part C: 沿用既有 5 型接庫存模擬資料（獨立具名入口，不佔 #1–#42 編號，供 S3 戰情頁呼叫） */
  var INV_REUSE = {
    invWaterfall: function (cv, x) {
      return C.waterfall(cv, global.A23_DEMO_INV.invWaterfall, X({ fps: 1.2, title: "INV · 庫存資金瀑布 (期初→入庫→領用→報廢→期末)", note: "模擬資料·萬元" }, x));
    },
    invAgingTreemap: function (cv, x) {
      return C.treemap(cv, global.A23_DEMO_INV.invAgingTreemap, X({ fps: 1.2, title: "INV · 呆滯品類庫齡面積 (萬元·模擬資料)" }, x));
    },
    invKitSankey: function (cv, x) {
      return C.sankey(cv, global.A23_DEMO_INV.invKitSankey, X({ rightPad: 175, labelFit: true, rightLabelLeft: true }, x));
    },
    invLeadBox: function (cv, x) {
      return C.boxPlot(cv, global.A23_DEMO_INV.invLeadBox, X({ fps: 1.2, title: "INV · 供應商交期變異 (天)", unit: "天", note: "模擬資料·交期天數" }, x));
    },
    invIraGauge: function (cv, x) {
      return C.gauge(cv, global.A23_DEMO_INV.invIraGauge, X({ fps: 1.2, min: 0.7, max: 1.0, bands: [[0.85, "#f43f5e"], [0.95, "#f59e0b"], [1.0, "#10b981"]], title: "INV · 盤點帳實相符率 (IRA)", unit: "帳實相符率 (模擬資料)" }, x));
    }
  };

  var BY_KEY = {
    barRace: 1, line: 2, streamgraph: 3, donut: 4, histogram: 5,
    waterfall: 6, funnel: 7, bubble: 8, scatter: 9, heatmap: 10,
    radar: 11, sankey: 12, chord: 13, network: 14, treemap: 15,
    sunburst: 16, parallel: 17, boxPlot: 18, choropleth: 19, flowMap: 20,
    trajectory: 21, globeArcs: 22, dotDensity: 23, gauge: 24, wordCloud: 25,
    timeline: 26, gantt: 27, corrMatrix: 28, surface: 29, codexGlobe: 30,
    ycGraph: 31, ycWikiTree: 32, ycAiMemory: 33, ycVoiceNote: 34, ycNightlyPass: 35, ycCdeMklink: 36,
    invCccBar: 37, invPareto: 38, invAbcXyz: 39, invBulletWall: 40, invWarehouseHeat: 41, invTradeoff: 42,
    corticalTorus3D: 43, dagPipeline: 44, dumbbellPlot: 45, marimekkoStrip: 46,
    tailRidge: 47, galtonLattice: 48,
    swarmBurst: 49, runLog: 50, unitGapBoard: 51, moduleMultiples: 52,
    loopSphere: 53, loopScrubber: 54, signalDecisionDiff: 55, guardrailFunnel: 56,
    spanPointer: 57, orbitRace: 58, modelCostBoard: 59,
    orbBundle: 60, landingCurve: 61, constellationMap: 62, agentSquad: 63,
    stageCards: 64, pcbBus: 65, nleTimeline: 66, costDrop: 67,
    verdictStack: 68, checkTree: 69, operatorMap: 70, glassMonolith: 71, lawCone: 72, stateChain: 73, depthLadder: 74,
    hudVitals: 75, hudLoadout: 76, hudSkillTree: 77, hudLockOn: 78, hudRadialMenu: 79, hudCompass: 80, hudFeedback: 81
  };

  var CONT = { 12: 1, 14: 1, 20: 1, 21: 1, 22: 1, 30: 1, 31: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1, 38: 1, 41: 1, 42: 1, 43: 1, 44: 1, 45: 1, 46: 1, 47: 1, 48: 1, 49: 1, 50: 1, 51: 1, 52: 1, 53: 1, 54: 1, 55: 1, 56: 1, 57: 1, 58: 1, 59: 1, 60: 1, 61: 1, 62: 1, 63: 1, 64: 1, 65: 1, 66: 1, 67: 1, 68: 1, 69: 1, 70: 1, 71: 1, 72: 1, 73: 1, 74: 1, 75: 1, 76: 1, 77: 1, 78: 1, 79: 1, 80: 1, 81: 1 };

  var T = {
    1: "Bar Chart Race", 2: "Animated Line", 3: "Area / Streamgraph", 4: "Pie / Donut", 5: "Histogram",
    6: "Waterfall", 7: "Funnel", 8: "Animated Bubble", 9: "Animated Scatter", 10: "Animated Heatmap",
    11: "Animated Radar", 12: "Sankey", 13: "Chord", 14: "Network", 15: "Treemap",
    16: "Sunburst", 17: "Parallel Coordinates", 18: "Box Plot", 19: "Choropleth（實界）", 20: "Flow Map",
    21: "Trajectory", 22: "3D Globe Arcs", 23: "Dot Density", 24: "Gauge / KPI", 25: "Word Cloud",
    26: "Timeline", 27: "Gantt", 28: "Correlation Matrix", 29: "3D Surface", 30: "CODEX 3D 測地線星系",
    31: "YC 01 · GRAPH 多星團知識圖譜", 32: "YC 02 · LLM-WIKI 放射貝茲樹", 33: "YC 03 · AI-MEMORY 雙 Agent 記憶槽",
    34: "YC 04 · VOICE->NOTE 聲波轉筆記", 35: "YC 05 · OMNI 夜間排程規則收斂", 36: "YC 06 · CDE MKLINK 矩陣與 PR 樹",
    37: "INV 01 · 現金循環方程式條 (CCC)", 38: "INV 02 · 柏拉圖 ABC 累積曲線", 39: "INV 03 · ABC×XYZ 九宮格矩陣",
    40: "INV 04 · 子彈補貨預警牆", 41: "INV 05 · 儲位熱力＋揀貨動線", 42: "INV 06 · What-If 取捨曲線",
    43: "STL 01 · 3D 腦皮層環面邊捆綁網路", 44: "STL 02 · 雙層 DAG 膠囊狀態管線",
    45: "STL 03 · Before/After 啞鈴游標圖", 46: "STL 04 · Marimekko 多列狀態條碼",
    47: "QNT 01 · Tail Probability Ridge", 48: "QNT 02 · Probability Lattice (Galton)",
    49: "SWM 01 · Swarm Burst Map", 50: "SWM 02 · Run Log + Stages",
    51: "SWM 03 · Unit Gap Board", 52: "SWM 04 · Module Multiples",
    53: "LOP 01 · Point Cloud Sphere", 54: "LOP 02 · Loop Scrubber + Heat",
    55: "LOP 03 · Signal → Decision → Diff", 56: "LOP 04 · Guardrail Funnel",
    57: "RDR 01 · Span Pointer", 58: "RDR 02 · Orbit Race", 59: "RDR 03 · Model Cost Board",
    60: "ORB 01 · Observe→State→Decide", 61: "ORB 02 · Landing Curve",
    62: "ORB 03 · Constellation Map", 63: "ORB 04 · Agent Squad",
    64: "STU 01 · Stage Workstation Cards", 65: "STU 02 · PCB Orthogonal Bus",
    66: "STU 03 · NLE Multi-Track Timeline", 67: "STU 04 · Cost Drop & Export",
    68: "QNT 03 · Verdict Stack", 69: "QNT 04 · Check Tree Tiles", 70: "QNT 05 · Operator Map",
    71: "MNL 01 · Glass Monolith Cube",
    72: "QNT 06 · LLN Convergence Cone", 73: "QNT 07 · Direction State Chain", 74: "QNT 08 · Candle + Depth Ladder",
    75: "HUD 01 · Vitals Strip & Cooldown", 76: "HUD 02 · Loadout & Stat Delta", 77: "HUD 03 · Skill Unlock DAG",
    78: "HUD 04 · Spatial Lock-On Reticle", 79: "HUD 05 · Radial Command Wheel", 80: "HUD 06 · Compass & Edge Tracker",
    81: "HUD 07 · Streak & Toast Cascade"
  };

  var SH = {
    4: "類別佔比×時間", 5: "數值分佈×時間", 6: "起點＋增減項", 7: "階段轉換量", 9: "x,y×時間",
    17: "多維特徵", 18: "分佈統計×時間", 21: "軌跡 (t,x,y)", 22: "全球 OD", 23: "點事件×時間",
    24: "單值＋閾值", 25: "詞頻×時間", 26: "事件序列", 27: "任務起訖", 28: "變數×變數 r×時間",
    29: "z=f(x,y)×時間", 30: "Fibonacci 網格＋星團", 31: "760節點×7星團×浮窗", 32: "核心G→7倉貝茲粒子樹",
    33: "雙Agent Context×4記憶槽", 34: "手機聲波頻譜→結構化筆記", 35: "02:00排程雷達×規則收斂", 36: "Waffle矩陣×12燈號×PR樹",
    37: "DIO+DSO−DPO=CCC×月", 38: "SKU金額排序＋80/15/5累積線", 39: "價值ABC×波動XYZ九宮格",
    40: "可用量×SS紅線×ROP×調撥優先", 41: "2D儲位FMR熱力×揀貨粒子流", 42: "安全庫存×缺貨率取捨曲線",
    43: "3D C-Torus 邊捆綁×極區熱點", 44: "雙層膠囊節點×脈衝流向",
    45: "基準空心圓→優化實心圓×Δ%", 46: "多列不等寬層級資源配置條",
    47: "偽3D混合高斯山脊×尾部漸層", 48: "12列Galton落球×盈虧直方",
    49: "720放射刺芒×8衛星框×跑馬燈", 50: "直立6階Stepper×逐字終端串流",
    51: "單位格Waffle×6.7x環×價差表", 52: "5格小倍數×三態衝突矩陣",
    53: "~3k點雲球×軌道環×引線註解", 54: "五階刷軸×一維熱帶×頻譜",
    55: "收件匣×決策日誌×差異行", 56: "8格KPI×熔斷橫幅×步驟漏斗",
    57: "文件高亮×答案引線×出處驗證", 58: "發光核心×軌道盤×模型衛星競速", 59: "模型卡×對數成本排名×倍率",
    60: "觀測列×粒子雲×決策排名", 61: "指數曲線×落點×目前位置",
    62: "圓形星座×旋轉掃描", 63: "六代理匯流排×日誌×權重條",
    64: "3×3工作站×埠點規格×預覽進度", 65: "正交PCB走線×晶片×封包×光暈",
    66: "五軌時間軸×播放頭×麵包屑工序", 67: "刪除線→大字倒數×節省條×終端",
    68: "三態判決卡×分數×推入堆疊", 69: "正交檢查樹×6圖示磚×迷你長條", 70: "20持有人×資金連線×收斂5實體",
    71: "3×3×3玻璃魔方×四材質×邊緣流光",
    72: "12路徑累積均值×±2σ/√n收斂錐×z檢定", 73: "3狀態轉移弧×轉移矩陣×方向帶", 74: "K線＋量能×買賣掛單階梯×失衡比",
    75: "分段槽條×延遲殘影×4冷卻扇形遮罩", 76: "2×2配置槽×正交匯流排×綠增紅減Δ條",
    77: "4層9節點狀態機×解鎖脈衝×前置依賴", 78: "四角鎖定準星×旋轉環×空間引線浮卡",
    79: "6扇區放射輪盤×彈出選取×快捷鍵中心", 80: "1D捲動方位羅盤×視窗邊緣越界箭頭",
    81: "連擊衰減環×階段顯影條×分級通知堆疊"
  };

  var S02 = "s02 YouBike 2.0 雙北站點即時資料 → 行政區 24h 聚合（每小時一幀）";
  var S06 = "s06 CWA 氣象署測站實測快照 7 筆（11-03 07:16–08:22，847–853 站），體感溫度";
  var SRC = {
    1: S02 + "；各區可借車數排名。", 2: S02 + "；各區可借車數折線。", 3: S02 + "；前 6 區堆疊河流圖。",
    4: S06 + "；穿搭級距測站數佔比。", 5: S06 + "；全台測站體感溫度分佈（21 組距）。",
    6: S02 + "；相鄰小時全市可借車變化，依行政區拆成增（綠）減（紅）。",
    7: "EU Eurostat（isoc_ec_ib20，2021–2025）電商使用漏斗：曾網購→近1年網購→近3月網購→高頻網購(6次+)。",
    8: S02 + "；x=站數、y=滿載率、大小=可借車。",
    9: S02 + "；雙北站點容量×滿載率散布圖，色=行政區。",
    10: S02 + "；行政區×時段滿載率。", 11: S02 + "；前 6 區該時段滿載率 vs 全日均。",
    12: S02 + "；可借車在區間的分配（示意）。", 13: "示意：推估淨流量",
    14: S02 + "；行政區關聯網路。", 15: S02 + "；各區可借車面積佔比，隨時間重排。",
    16: S02 + "；臺北／新北 → 行政區階層。", 18: S06 + "；各縣市五數摘要。",
    19: S02 + "；真實行政區界（taiwan-atlas MIT，01_shared\\geo）著色滿載率。",
    20: "示意：推估淨流量", 24: S02 + "；全市滿載率儀表。",
    37: "模擬資料（seed=20261116，12 個月）：DIO + DSO − DPO = CCC 現金循環方程式條。",
    38: "模擬資料（seed=20261116，120 SKU）：依年消耗金額降冪之柏拉圖長條＋累積百分比折線，含 80%/95% 截斷線與 A/B/C 分色。",
    39: "模擬資料（seed=20261116，120 SKU × 12 月）：ABC 價值 × XYZ 需求變異九宮格熱力矩陣＋散點軌跡與補貨策略標註。",
    40: "模擬資料（seed=20261116，120 SKU × 4 倉）：子彈補貨預警牆（可用量 = 現有+在途−已分配、SS 紅線、ROP 警戒線、跨倉調撥優先）。",
    41: "模擬資料（seed=20261116，4 倉儲位平面）：2D 倉庫 FMR 儲位熱力圖＋揀貨粒子拖尾＋黃金儲位框線＋錯放調儲建議箭頭。",
    42: "模擬資料（seed=20261116，服務水準 90%–99.9%）：庫存持有成本 vs 缺貨風險雙軸取捨曲線與即時資金釋放試算游標。",
    43: "Stanford Discovery 戰情室逆向還原（模擬資料）：3D C 型環面流形網路、曲線光絲邊捆綁與底部琥珀極區熱點。",
    44: "Stanford Discovery 戰情室逆向還原（模擬資料）：雙層有向膠囊節點執行管線（system_query → act_verify）。",
    45: "Stanford Discovery 戰情室逆向還原（模擬資料）：Benchmark Before/After 水平啞鈴游標對比圖。",
    46: "Stanford Discovery 戰情室逆向還原（模擬資料）：多列不等寬 Marimekko 層級注意力配置條碼。",
    47: "量化終端逆向還原（模擬資料，seed=20261116）：偽 3D 混合高斯尾部機率山脊圖與 strike 尾部積分提示。",
    48: "量化終端逆向還原（模擬資料，seed=20261116）：12 列 Galton 機率晶格落球與紅綠盈虧直方圖。",
    49: "群集調度戰情逆向還原（模擬資料，seed=20261116）",
    50: "群集調度戰情逆向還原（模擬資料，seed=20261116）",
    51: "群集調度戰情逆向還原（模擬資料，seed=20261116）",
    52: "群集調度戰情逆向還原（模擬資料，seed=20261116）",
    53: "增長閉環戰情逆向還原（模擬資料，seed=20261116）",
    54: "增長閉環戰情逆向還原（模擬資料，seed=20261116）",
    55: "增長閉環戰情逆向還原（模擬資料，seed=20261116）",
    56: "增長閉環戰情逆向還原（模擬資料，seed=20261116）",
    57: "引證閱讀戰情逆向還原（模擬資料，seed=20261116）",
    58: "引證閱讀戰情逆向還原（模擬資料，seed=20261116）",
    59: "引證閱讀戰情逆向還原（模擬資料，seed=20261116）",
    60: "決策星球戰情逆向還原（模擬資料，seed=20261116）",
    61: "決策星球戰情逆向還原（模擬資料，seed=20261116）",
    62: "決策星球戰情逆向還原（模擬資料，seed=20261116）",
    63: "決策星球戰情逆向還原（模擬資料，seed=20261116）",
    64: "製片管線戰情逆向還原（模擬資料，seed=20261116）",
    65: "製片管線戰情逆向還原（模擬資料，seed=20261116）",
    66: "製片管線戰情逆向還原（模擬資料，seed=20261116）",
    67: "製片管線戰情逆向還原（模擬資料，seed=20261116）",
    68: "鏈上持有人風控戰情逆向還原（模擬資料，seed=20261116）",
    69: "鏈上持有人風控戰情逆向還原（模擬資料，seed=20261116）",
    70: "鏈上持有人風控戰情逆向還原（模擬資料，seed=20261116）",
    71: "Monolith 首屏逆向還原（純代碼程序化渲染，零模型零貼圖）",
    72: "Polymarket bot 儀表板借鏡：大數法則收斂錐（模擬資料，seed=20261117）", 73: "Polymarket bot 儀表板借鏡：方向馬可夫鏈（模擬資料，seed=20261117）", 74: "Polymarket bot 儀表板借鏡：K 線＋掛單簿深度（模擬資料，seed=20261117）",
    75: "Game UI Database 借鏡：HUD 多段資源槽條＋延遲扣損殘影＋API 扇形冷卻遮罩（模擬資料）",
    76: "Game UI Database 借鏡：2×2 裝備／模型配置槽＋屬性增減 Δ 對比卡（模擬資料）",
    77: "Game UI Database 借鏡：四態技能／能力解鎖狀態機 DAG（模擬資料）",
    78: "Game UI Database 借鏡：空間目標四角鎖定準星＋動態引線遙測浮卡（模擬資料）",
    79: "Game UI Database 借鏡：6 扇區放射環形快選輪盤＋熱鍵控制中樞（模擬資料）",
    80: "Game UI Database 借鏡：1D 捲動方位羅盤＋視窗邊緣越界告警指標（模擬資料）",
    81: "Game UI Database 借鏡：門禁連擊衰減環＋階段顯影條＋分級通知推入堆疊（模擬資料）"
  };

  var TITLE_ZH = {
    1: "雙北 YouBike 可借車排名", 2: "雙北 YouBike 可借車折線", 3: "雙北前 6 區堆疊河流圖",
    4: "全台測站穿搭體感佔比", 5: "全台測站體感溫度分佈", 6: "雙北各區可借車增減瀑布",
    7: "歐盟電商使用轉換漏斗", 8: "雙北站數與滿載率氣泡", 9: "雙北站點容量與滿載率",
    10: "雙北行政區時段滿載率", 11: "前 6 區時段 vs 全日均", 12: "雙北可借車區間流向",
    13: "雙北區域推估淨流量弦圖", 14: "雙北行政區關聯網路圖", 15: "雙北各區可借車矩形樹圖",
    16: "雙北行政區階層旭日圖", 17: "OECD 多維福祉平行座標", 18: "各縣市體感溫度箱形圖",
    19: "雙北 YouBike 各區滿載率", 20: "雙北區域推估淨流量流向", 21: "NOAA 船舶航跡動態圖",
    22: "全球航線 3D 弧線圖", 23: "USGS 全球地震點密度", 24: "雙北全市滿載率儀表",
    25: "美國聯邦公報政策詞雲", 26: "A23 專案里程碑時間軸", 27: "A23 場景開發甘特排程",
    28: "CWA 氣象要素相關矩陣", 29: "美債殖利率 2.5D 曲面", 30: "CODEX 3D 測地線星系",
    31: "YC 01 多星團知識圖譜", 32: "YC 02 放射貝茲知識樹", 33: "YC 03 雙 Agent 記憶槽",
    34: "YC 04 聲波轉結構化筆記", 35: "YC 05 夜間排程規則收斂", 36: "YC 06 矩陣燈號與 PR 樹",
    37: "INV 01 現金循環方程式條", 38: "INV 02 柏拉圖 ABC 曲線", 39: "INV 03 ABC×XYZ 九宮格",
    40: "INV 04 子彈補貨預警牆", 41: "INV 05 儲位熱力與揀貨動線", 42: "INV 06 What-If 取捨曲線",
    43: "STL 01 3D 環面邊捆綁網路", 44: "STL 02 雙層 DAG 狀態管線",
    45: "STL 03 前後對比啞鈴游標圖", 46: "STL 04 多列不等寬狀態條碼",
    47: "QNT 01 尾部機率山脊", 48: "QNT 02 機率晶格 Galton 板",
    49: "SWM 01 群集放射爆發圖", 50: "SWM 02 終端串流與階段",
    51: "SWM 03 單位格價差板", 52: "SWM 04 模組小倍數面板",
    53: "LOP 01 點雲球與軌道註解", 54: "LOP 02 閉環刷軸與請求熱帶",
    55: "LOP 03 訊號決策差異三欄", 56: "LOP 04 實驗熔斷與步驟漏斗",
    57: "RDR 01 答案出處指標", 58: "RDR 02 軌道延遲競速", 59: "RDR 03 模型成本板",
    60: "ORB 01 觀測狀態決策束", 61: "ORB 02 落點曲線",
    62: "ORB 03 圓形星座圖", 63: "ORB 04 六代理匯流排",
    64: "STU 01 角色工作站卡矩陣", 65: "STU 02 PCB 正交匯流排",
    66: "STU 03 非線性多軌時間軸", 67: "STU 04 成本對照與匯出終端",
    68: "QNT 03 判決卡堆疊", 69: "QNT 04 檢查樹圖示磚", 70: "QNT 05 持有人歸併圖",
    71: "MNL 01 玻璃魔方首屏",
    72: "QNT 06 大數法則收斂錐", 73: "QNT 07 狀態轉移鏈", 74: "QNT 08 K線＋掛單階梯",
    75: "HUD 01 多段資源條與冷卻遮罩", 76: "HUD 02 配置槽與屬性 Δ 對比", 77: "HUD 03 技能解鎖狀態機 DAG",
    78: "HUD 04 空間鎖定準星與浮卡", 79: "HUD 05 放射環形快選輪盤", 80: "HUD 06 線性羅盤與越界指標",
    81: "HUD 07 連擊計數與通知堆疊"
  };

  var VOCAB = {
    purpose: {
      change: "隨時間變化", compare: "比較", rank: "排名", part: "佔比", dist: "分佈",
      corr: "相關", flow: "流動", hier: "階層", mag: "量級／監控", explore: "探索"
    },
    form: {
      bars: "長條", lines: "線", areas: "面積", circles: "圓點", pies: "圓餅",
      radial: "放射", maps: "地圖", "3d": "立體", links: "節點連線", matrix: "矩陣",
      text: "文字", panel: "組合面板"
    },
    kit: {
      CODEX: "外掛星系", YC: "第二大腦", INV: "庫存戰情", STL: "研究探索", QNT: "量化終端", SWM: "群集調度", LOP: "增長閉環", RDR: "引證閱讀", ORB: "決策星球", STU: "製片管線", MNL: "玻璃魔方", HUD: "戰術 HUD"
    }
  };

  var PURPOSE = {
    1: ["rank", "change"], 2: ["change", "compare"], 3: ["change", "part"], 4: ["part"], 5: ["dist"],
    6: ["change", "part"], 7: ["flow", "mag"], 8: ["corr", "mag"], 9: ["corr", "dist"], 10: ["dist", "change"],
    11: ["compare"], 12: ["flow", "part"], 13: ["flow"], 14: ["explore"], 15: ["part", "hier"],
    16: ["hier", "part"], 17: ["compare", "corr", "explore"], 18: ["dist", "compare"], 19: ["mag", "compare"], 20: ["flow"],
    21: ["flow", "change"], 22: ["flow"], 23: ["dist"], 24: ["mag"], 25: ["mag", "explore"],
    26: ["change"], 27: ["change", "compare"], 28: ["corr"], 29: ["change", "mag"], 30: ["explore"],
    31: ["explore"], 32: ["hier", "flow"], 33: ["flow", "mag"], 34: ["flow"], 35: ["change", "flow"],
    36: ["hier", "mag"], 37: ["change", "part"], 38: ["rank", "part"], 39: ["corr", "dist"], 40: ["mag", "compare"],
    41: ["dist", "flow"], 42: ["corr", "compare", "explore"], 43: ["explore"], 44: ["flow"], 45: ["compare", "change"],
    46: ["part", "compare"], 47: ["dist", "compare"], 48: ["dist", "flow"],
    49: ["flow", "mag"], 50: ["change", "explore"], 51: ["compare", "mag"], 52: ["compare", "corr"],
    53: ["explore", "mag"], 54: ["change", "flow"], 55: ["flow", "explore"], 56: ["mag", "flow"],
    57: ["explore", "flow"], 58: ["compare", "change"], 59: ["compare", "rank"],
    60: ["flow", "rank"], 61: ["change", "dist"], 62: ["explore", "corr"], 63: ["flow", "mag"],
    64: ["mag", "flow"], 65: ["flow", "explore"], 66: ["change", "flow"], 67: ["compare", "mag"],
    68: ["compare"], 69: ["part", "flow"], 70: ["part", "flow"],
    71: ["explore", "mag"],
    72: ["dist", "change"], 73: ["flow", "compare"], 74: ["change", "compare"],
    75: ["mag", "change"], 76: ["compare", "mag"], 77: ["hier", "flow"], 78: ["explore", "mag"],
    79: ["explore", "compare"], 80: ["mag", "explore"], 81: ["change", "mag"]
  };

  var FORM = {
    1: ["bars"], 2: ["lines"], 3: ["areas"], 4: ["pies"], 5: ["bars"],
    6: ["bars"], 7: ["bars"], 8: ["circles"], 9: ["circles"], 10: ["matrix"],
    11: ["radial"], 12: ["links"], 13: ["links", "radial"], 14: ["links"], 15: ["areas"],
    16: ["radial", "pies"], 17: ["lines"], 18: ["bars"], 19: ["maps"], 20: ["maps", "links"],
    21: ["maps", "lines"], 22: ["maps", "3d"], 23: ["maps", "circles"], 24: ["radial"], 25: ["text"],
    26: ["lines"], 27: ["bars"], 28: ["matrix"], 29: ["3d", "areas"], 30: ["3d", "links"],
    31: ["links", "circles"], 32: ["links", "panel"], 33: ["panel"], 34: ["panel", "text"], 35: ["panel", "radial"],
    36: ["panel", "matrix"], 37: ["bars"], 38: ["bars", "lines"], 39: ["matrix", "circles"], 40: ["bars"],
    41: ["matrix"], 42: ["lines"], 43: ["3d", "links"], 44: ["links"], 45: ["circles"],
    46: ["bars", "areas"], 47: ["3d", "areas"], 48: ["bars", "circles"],
    49: ["radial", "bars"], 50: ["text", "panel"], 51: ["bars", "radial"], 52: ["panel", "matrix"],
    53: ["3d", "circles"], 54: ["matrix", "bars"], 55: ["text", "panel"], 56: ["panel", "bars"],
    57: ["text", "panel"], 58: ["radial", "circles"], 59: ["bars", "panel"],
    60: ["links", "circles"], 61: ["lines", "areas"], 62: ["radial", "links"], 63: ["panel", "bars"],
    64: ["panel", "matrix"], 65: ["links", "panel"], 66: ["bars", "panel"], 67: ["panel", "bars"],
    68: ["panel"], 69: ["links", "bars"], 70: ["links"],
    71: ["3d", "panel"],
    72: ["lines", "areas"], 73: ["links", "matrix"], 74: ["bars", "panel"],
    75: ["bars", "radial"], 76: ["panel", "bars"], 77: ["links", "panel"], 78: ["radial", "panel"],
    79: ["radial", "panel"], 80: ["bars", "maps"], 81: ["panel", "radial"]
  };

  var NAME_ZH = {
    1: "長條競賽", 2: "動態折線", 3: "堆疊河流", 4: "圓餅／環圈", 5: "直方圖",
    6: "瀑布圖", 7: "漏斗圖", 8: "動態氣泡", 9: "動態散布", 10: "動態熱力",
    11: "動態雷達", 12: "桑基圖", 13: "弦圖", 14: "網路圖", 15: "矩形樹圖",
    16: "旭日圖", 17: "平行座標", 18: "箱形圖", 19: "分級設色地圖", 20: "流向地圖",
    21: "軌跡圖", 22: "3D 地球弧線", 23: "點密度圖", 24: "儀表／KPI", 25: "文字雲",
    26: "時間軸", 27: "甘特圖", 28: "相關矩陣", 29: "3D 曲面", 30: "測地線星系",
    31: "多星團知識圖譜", 32: "放射知識樹", 33: "雙 Agent 記憶槽", 34: "聲波轉筆記", 35: "夜間排程收斂",
    36: "矩陣燈號＋PR 樹", 37: "現金循環條", 38: "柏拉圖 ABC", 39: "ABC×XYZ 九宮格", 40: "補貨預警牆",
    41: "儲位熱力＋動線", 42: "What-If 取捨曲線", 43: "3D 環面網路", 44: "雙層 DAG 管線", 45: "前後啞鈴圖",
    46: "Marimekko 狀態條", 47: "尾部機率山脊", 48: "機率晶格 Galton 板",
    49: "群集放射圖", 50: "終端串流＋階段", 51: "單位格價差板", 52: "模組小倍數",
    53: "點雲球註解", 54: "閉環刷軸熱帶", 55: "訊號決策差異", 56: "熔斷步驟漏斗",
    57: "答案出處指標", 58: "軌道延遲競速", 59: "模型成本板",
    60: "觀測決策束", 61: "落點曲線", 62: "圓形星座圖", 63: "六代理匯流排",
    64: "工作站卡矩陣", 65: "PCB 正交匯流排", 66: "非線性多軌軸", 67: "成本對照終端",
    68: "判決卡堆疊", 69: "檢查樹圖示磚", 70: "持有人歸併圖",
    71: "玻璃魔方首屏",
    72: "大數法則收斂錐", 73: "狀態轉移鏈", 74: "K線＋掛單階梯",
    75: "HUD 狀態條＋冷卻", 76: "配置槽＋屬性對比", 77: "技能解鎖狀態樹", 78: "空間鎖定準星浮卡",
    79: "放射環形快選輪盤", 80: "線性羅盤越界指標", 81: "連擊微回饋通知流"
  };

  var KIT = {
    30: "CODEX",
    31: "YC", 32: "YC", 33: "YC", 34: "YC", 35: "YC", 36: "YC",
    37: "INV", 38: "INV", 39: "INV", 40: "INV", 41: "INV", 42: "INV",
    43: "STL", 44: "STL", 45: "STL", 46: "STL",
    47: "QNT", 48: "QNT", 68: "QNT", 69: "QNT", 70: "QNT",
    49: "SWM", 50: "SWM", 51: "SWM", 52: "SWM",
    53: "LOP", 54: "LOP", 55: "LOP", 56: "LOP",
    57: "RDR", 58: "RDR", 59: "RDR",
    60: "ORB", 61: "ORB", 62: "ORB", 63: "ORB",
    64: "STU", 65: "STU", 66: "STU", 67: "STU",
    71: "MNL",
    72: "QNT", 73: "QNT", 74: "QNT",
    75: "HUD", 76: "HUD", 77: "HUD", 78: "HUD", 79: "HUD", 80: "HUD", 81: "HUD"
  };

  var KIT_SHAPE_ORDER = ["sphere", "network", "bars", "matrix", "panel"];
  var KIT_SHAPE_GROUPS = {
    sphere: [30, 53, 58, 43, 49, 60, 62, 71, 78, 79],
    network: [31, 70, 32, 69, 35, 73, 77],
    bars: [37, 48, 54, 56, 52, 38, 42, 61, 47, 51, 72, 74, 75, 80],
    matrix: [44, 66, 46, 39, 41, 36, 40, 59],
    panel: [33, 34, 50, 68, 55, 57, 63, 64, 65, 67, 45, 76, 81]
  };
  var KIT_SHAPE = {};
  var KIT_ORDER = [];
  KIT_SHAPE_ORDER.forEach(function (g) {
    (KIT_SHAPE_GROUPS[g] || []).forEach(function (id) {
      KIT_SHAPE[id] = g;
      KIT_ORDER.push(id);
    });
  });

  global.A23_REGISTRY = {
    LIVE: LIVE, INV_REUSE: INV_REUSE, BY_KEY: BY_KEY, CONT: CONT, T: T, TITLE_ZH: TITLE_ZH, SH: SH, SRC: SRC,
    VOCAB: VOCAB, PURPOSE: PURPOSE, FORM: FORM, NAME_ZH: NAME_ZH, KIT: KIT,
    KIT_SHAPE_ORDER: KIT_SHAPE_ORDER, KIT_SHAPE: KIT_SHAPE, KIT_ORDER: KIT_ORDER,
    GEO: GEO, CODEX_30: CODEX_30, X: X, S02: S02, S06: S06
  };
})(window);
