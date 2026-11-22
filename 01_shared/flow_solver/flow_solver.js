/*
 * flow_solver.js  v1  (A23_Data_Atlas / 01_shared)
 * 穩態網路流量求解器：節點壓力 P、邊阻力 R，流量 Q_ij = (P_i - P_j) / R_ij（類比歐姆定律）。
 * 邊界條件 bc 固定部分節點壓力；其餘節點守恆 ΣQ = 0，解線性方程組（高斯消去＋部分選主元，稠密矩陣，適用 <= 數百節點）。
 * 阻塞（閥門事件）：邊 R = Infinity / null / "inf"，或 opts.blocked 列出邊 id。
 * 零依賴；瀏覽器 window.FlowSolver、Node require / import 皆可。
 * 單位由呼叫端決定（s13 用 P=mmHg, R=mmHg·s/mL, Q=mL/s）。數值是否為真實量測由資料層標示，求解器不判斷。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FlowSolver = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function edgeKey(e) { return e.id != null ? String(e.id) : e.from + '>' + e.to; }

  function isOpenR(R) {
    return R === Infinity || R === null || R === undefined || R === 'inf' || R === 'Infinity';
  }

  /** 套用情境：回傳新的 edges 陣列（不改原物件）。scenario = {blocked:[edgeId], scale:{edgeId:factor}} */
  function applyScenario(edges, scenario) {
    var blocked = {}, scale = {};
    if (scenario && scenario.blocked) scenario.blocked.forEach(function (id) { blocked[id] = true; });
    if (scenario && scenario.scale) scale = scenario.scale;
    return edges.map(function (e) {
      var c = {}; for (var k in e) c[k] = e[k];
      var key = edgeKey(e);
      if (blocked[key]) c.R = Infinity;
      else if (scale[key] != null && !isOpenR(c.R)) c.R = c.R * scale[key];
      return c;
    });
  }

  /**
   * solve({nodes:[{id}], edges:[{id?,from,to,R}], bc:{nodeId:P}}, opts?)
   * 回傳 { P:{id:number|null}, Q:{edgeKey:number}, residual:{id:number}, maxResidual:number,
   *        boundaryFlow:{id:number}, floating:[id], open:[edgeKey] }
   * Q 正值＝從 from 流向 to。P 為 null 的節點＝與任何固定壓力節點斷開（浮動）。
   */
  function solve(model, opts) {
    opts = opts || {};
    var nodes = model.nodes, edges = model.edges, bc = model.bc || {};
    var blockedSet = {};
    (opts.blocked || []).forEach(function (id) { blockedSet[id] = true; });

    var idx = {}, ids = [];
    nodes.forEach(function (n) {
      if (idx[n.id] !== undefined) throw new Error('duplicate node id: ' + n.id);
      idx[n.id] = ids.length; ids.push(n.id);
    });
    var bcIds = Object.keys(bc);
    if (!bcIds.length) throw new Error('bc is empty: need at least one fixed-pressure node');
    bcIds.forEach(function (id) {
      if (idx[id] === undefined) throw new Error('bc refers to unknown node: ' + id);
      if (typeof bc[id] !== 'number' || !isFinite(bc[id])) throw new Error('bc value must be finite number: ' + id);
    });

    // 驗證並整理導通邊
    var keys = [], cond = [], openKeys = [];
    edges.forEach(function (e) {
      var key = edgeKey(e);
      if (idx[e.from] === undefined || idx[e.to] === undefined) throw new Error('edge ' + key + ' refers to unknown node');
      if (e.from === e.to) throw new Error('self-loop edge: ' + key);
      keys.push(key);
      if (blockedSet[key] || isOpenR(e.R)) { openKeys.push(key); cond.push(null); return; }
      if (typeof e.R !== 'number' || !(e.R > 0) || !isFinite(e.R)) throw new Error('edge ' + key + ': R must be a positive finite number or open (Infinity/null)');
      cond.push({ i: idx[e.from], j: idx[e.to], g: 1 / e.R });
    });

    // 從固定壓力節點出發做 BFS，找出可求解的節點
    var adj = ids.map(function () { return []; });
    cond.forEach(function (c) { if (c) { adj[c.i].push(c.j); adj[c.j].push(c.i); } });
    var reach = ids.map(function () { return false; }), queue = [];
    bcIds.forEach(function (id) { reach[idx[id]] = true; queue.push(idx[id]); });
    while (queue.length) {
      var u = queue.pop();
      adj[u].forEach(function (v) { if (!reach[v]) { reach[v] = true; queue.push(v); } });
    }

    var Pv = ids.map(function () { return null; });
    bcIds.forEach(function (id) { Pv[idx[id]] = bc[id]; });

    // 未知數：可達且非固定的節點
    var unk = [], uIdx = {};
    ids.forEach(function (id, k) {
      if (reach[k] && bc[id] === undefined) { uIdx[k] = unk.length; unk.push(k); }
    });
    var n = unk.length;
    if (n > 0) {
      var A = [];
      for (var r = 0; r < n; r++) { A.push(new Array(n + 1)); for (var c0 = 0; c0 <= n; c0++) A[r][c0] = 0; }
      cond.forEach(function (c) {
        if (!c) return;
        var ui = uIdx[c.i], uj = uIdx[c.j];
        if (ui !== undefined) {
          A[ui][ui] += c.g;
          if (uj !== undefined) A[ui][uj] -= c.g; else A[ui][n] += c.g * Pv[c.j];
        }
        if (uj !== undefined) {
          A[uj][uj] += c.g;
          if (ui !== undefined) A[uj][ui] -= c.g; else A[uj][n] += c.g * Pv[c.i];
        }
      });
      // 高斯消去，部分選主元
      for (var col = 0; col < n; col++) {
        var piv = col, best = Math.abs(A[col][col]);
        for (var rr = col + 1; rr < n; rr++) { var a = Math.abs(A[rr][col]); if (a > best) { best = a; piv = rr; } }
        if (best < 1e-300) throw new Error('singular system at node ' + ids[unk[col]]);
        if (piv !== col) { var tmp = A[col]; A[col] = A[piv]; A[piv] = tmp; }
        for (var r2 = col + 1; r2 < n; r2++) {
          var f = A[r2][col] / A[col][col];
          if (f === 0) continue;
          for (var k2 = col; k2 <= n; k2++) A[r2][k2] -= f * A[col][k2];
        }
      }
      var x = new Array(n);
      for (var r3 = n - 1; r3 >= 0; r3--) {
        var s = A[r3][n];
        for (var k3 = r3 + 1; k3 < n; k3++) s -= A[r3][k3] * x[k3];
        x[r3] = s / A[r3][r3];
      }
      unk.forEach(function (k, u2) { Pv[k] = x[u2]; });
    }

    // 流量與守恆殘差
    var Q = {}, net = ids.map(function () { return 0; });
    edges.forEach(function (e, m) {
      var c = cond[m], q = 0;
      if (c && Pv[c.i] !== null && Pv[c.j] !== null) q = c.g * (Pv[c.i] - Pv[c.j]);
      Q[keys[m]] = q;
      net[idx[e.from]] += q; net[idx[e.to]] -= q;
    });
    var P = {}, residual = {}, boundaryFlow = {}, floating = [], maxRes = 0;
    ids.forEach(function (id, k) {
      P[id] = Pv[k];
      if (!reach[k]) floating.push(id);
      if (bc[id] !== undefined) boundaryFlow[id] = net[k];
      else if (reach[k]) { residual[id] = net[k]; if (Math.abs(net[k]) > maxRes) maxRes = Math.abs(net[k]); }
    });
    return { P: P, Q: Q, residual: residual, maxResidual: maxRes, boundaryFlow: boundaryFlow, floating: floating, open: openKeys };
  }

  /**
   * solveRegulated(model, regulation, opts?)  —— v1 自動調節（小動脈舒縮）
   * model = {nodes, edges（已套用情境的 R）, bc}；baselineEdges＝未受擾動的基準 edges（用來取各調節邊的目標流量）。
   * regulation = { edgeId: {min, max} }：調節邊 R 乘上係數 g，g 夾在 [min,max]；
   *   迭代 g ← clamp(g·(Q/Qtarget)^alpha)，Q 低於目標就舒張（R 降）、高於目標就收縮（R 升），直到收斂或碰到上下限（飽和）。
   * opts = { baselineEdges, alpha=0.6, maxIter=300, tol=1e-7 }
   * 回傳 solve() 結果＋ { g:{edgeId}, saturated:[edgeId], iterations, converged, target:{edgeId} }
   * 限制：這是穩態「目標流量」控制器，不是生理機轉模型；阻塞邊（開路）不調節。
   */
  function solveRegulated(model, regulation, opts) {
    opts = opts || {};
    var alpha = opts.alpha != null ? opts.alpha : 0.6, maxIter = opts.maxIter || 300, tol = opts.tol || 1e-7;
    var baseEdges = opts.baselineEdges || model.edges;
    var baseRes = solve({ nodes: model.nodes, edges: baseEdges, bc: model.bc });
    var ids = Object.keys(regulation || {});
    var target = {}, g = {};
    ids.forEach(function (id) { target[id] = baseRes.Q[id]; g[id] = 1; });
    var edges0 = model.edges, res = null, it = 0, converged = false;
    for (it = 1; it <= maxIter; it++) {
      var cur = edges0.map(function (e) {
        var key = edgeKey(e);
        if (g[key] === undefined || isOpenR(e.R)) return e;
        var c = {}; for (var k in e) c[k] = e[k]; c.R = e.R * g[key]; return c;
      });
      res = solve({ nodes: model.nodes, edges: cur, bc: model.bc });
      var worst = 0;
      ids.forEach(function (id) {
        var e = edges0.filter(function (x) { return edgeKey(x) === id; })[0];
        if (!e || isOpenR(e.R)) return;
        var q = res.Q[id], qt = target[id];
        if (!(qt > 0) || !(q > 0)) return;
        var rel = Math.abs(q / qt - 1);
        var gn = g[id] * Math.pow(q / qt, alpha);
        gn = Math.min(regulation[id].max, Math.max(regulation[id].min, gn));
        // 飽和邊不計入收斂誤差
        var atLimit = (gn === regulation[id].min && q < qt) || (gn === regulation[id].max && q > qt);
        if (!atLimit && rel > worst) worst = rel;
        g[id] = gn;
      });
      if (worst < tol) { converged = true; break; }
    }
    res.g = g; res.target = target; res.iterations = it; res.converged = converged;
    res.saturated = ids.filter(function (id) {
      var e = edges0.filter(function (x) { return edgeKey(x) === id; })[0];
      if (!e || isOpenR(e.R)) return false;
      var q = res.Q[id], qt = target[id];
      return Math.abs(q / qt - 1) > 1e-3 && (g[id] === regulation[id].min || g[id] === regulation[id].max);
    });
    return res;
  }

  return { version: 'v1', solve: solve, solveRegulated: solveRegulated, applyScenario: applyScenario, edgeKey: edgeKey };
}));
