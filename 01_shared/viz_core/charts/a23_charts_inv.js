/* A23 Charts — 庫存戰情組件 S2 (#37 invCccBar / #40 invBulletWall / #41 invWarehouseHeat)
 * 載入順序：在 a23_charts.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（零閉包累加狀態、零 Math.random、零 Date.now）。
 * note: "模擬資料"
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var PAL = ["#10b981", "#38bdf8", "#f59e0b", "#f43f5e", "#a78bfa", "#14b8a6", "#eab308", "#fb7185", "#60a5fa", "#34d399", "#f97316", "#c084fc"];
  var BG = "#0b1220", FG = "#e2e8f0", DIM = "#94a3b8";
  var RAMP = ["#0b1220", "#1e3a8a", "#0ea5e9", "#10b981", "#facc15", "#f43f5e"];

  function col(i) { return PAL[i % PAL.length]; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ease(u) { return u * u * (3 - 2 * u); }
  function hex2rgb(h) { return [1, 3, 5].map(function (k) { return parseInt(h.substr(k, 2), 16); }); }
  function mix(a, b, f) {
    var A = hex2rgb(a), B = hex2rgb(b);
    return "rgb(" + A.map(function (x, i) { return Math.round(lerp(x, B[i], f)); }).join(",") + ")";
  }
  var ramp = A23.ramp || function (u) {
    u = Math.max(0, Math.min(1, u));
    var n = RAMP.length - 1, p = u * n, i = Math.min(n - 1, Math.floor(p));
    return mix(RAMP[i], RAMP[i + 1], p - i);
  };

  function fit(cv) {
    var d = g.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    var w = +cv.dataset.w || Math.max(1, Math.round(r.width));
    var h = +cv.dataset.h || Math.max(1, Math.round(r.height));
    if (cv.__w !== w || cv.__h !== h || cv.__d !== d) {
      cv.width = w * d; cv.height = h * d; cv.__w = w; cv.__h = h; cv.__d = d;
    }
    var c = cv.getContext("2d");
    c.setTransform(d, 0, 0, d, 0, 0);
    c.shadowBlur = 0;
    c.shadowColor = "transparent";
    c.globalAlpha = 1;
    c.setLineDash([]);
    c.lineDashOffset = 0;
    c.lineWidth = 1;
    c.fillStyle = BG;
    c.fillRect(0, 0, w, h);
    return { c: c, w: w, h: h };
  }

  function driver(n, draw, o) {
    o = o || {};
    var fps = o.fps || 1.5, t = 0, playing = false, last = 0, raf = 0;
    function tick(ts) {
      if (!playing) return;
      if (last) t += (ts - last) / 1000 * fps;
      last = ts;
      if (t > n - 1) {
        if (o.loop === false) { t = n - 1; playing = false; }
        else t = 0;
      }
      var lbl = draw(t);
      if (o.onTick) o.onTick(t, n, lbl);
      raf = requestAnimationFrame(tick);
    }
    var ctl = {
      n: n,
      play: function () { if (playing) return; playing = true; last = 0; raf = requestAnimationFrame(tick); },
      pause: function () { playing = false; cancelAnimationFrame(raf); },
      seek: function (x) {
        t = Math.max(0, Math.min(n - 1, x));
        var lbl = draw(t);
        if (o.onTick) o.onTick(t, n, lbl);
      },
      redraw: function () {
        var lbl = draw(t);
        if (o.onTick) o.onTick(t, n, lbl);
      }
    };
    Object.defineProperty(ctl, "t", { get: function () { return t; } });
    Object.defineProperty(ctl, "playing", { get: function () { return playing; } });
    ctl.seek(0);
    return ctl;
  }

  function fsz(w, compact, sz) {
    return (w >= 560 || !compact) ? Math.max(11, sz) : sz;
  }

  function text(c, s, x, y, size, color, align, weight) {
    c.font = (weight ? weight + " " : "") + size + "px 'Microsoft JhengHei',system-ui,sans-serif";
    c.fillStyle = color || FG;
    c.textAlign = align || "left";
    c.textBaseline = "middle";
    c.fillText(s, x, y);
  }

  function fitText(c, str, maxW) {
    if (!str) return "";
    if (c.measureText(str).width <= maxW) return str;
    var ell = "…";
    if (c.measureText(ell).width > maxW) return "";
    var lo = 0, hi = str.length;
    while (lo < hi) {
      var mid = (lo + hi + 1) >> 1;
      if (c.measureText(str.slice(0, mid) + ell).width <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return lo > 0 ? (str.slice(0, lo) + ell) : ell;
  }

  function fr(frames, t) {
    var n = frames.length;
    var k = Math.max(0, Math.min(n - 1, Math.floor(t)));
    var u = ease(Math.max(0, Math.min(1, t - k)));
    return { k: k, k2: Math.min(n - 1, k + 1), u: k < n - 1 ? u : 0 };
  }

  function resolveInvData(d) {
    var raw = typeof d === "function" ? d() : d;
    if (raw && (raw.ccc_series || raw.skus)) return raw;
    if (g.A23_DEMO_INV) return g.A23_DEMO_INV;
    return { note: "模擬資料", ccc_series: [], skus: [] };
  }

  function drawSimBadge(c, w, y, compact) {
    var txt = "模擬資料";
    var wide = w >= 560 || !compact;
    var fontSize = wide ? 11 : 9;
    var bw = wide ? 64 : 48, bh = wide ? 20 : 15;
    var bx = w - bw - 8, by = Math.max(3, (y || 14) - bh / 2);
    c.fillStyle = "rgba(245,158,11,0.2)";
    c.strokeStyle = "#f59e0b";
    c.lineWidth = 1;
    c.fillRect(bx, by, bw, bh);
    c.strokeRect(bx, by, bw, bh);
    text(c, txt, bx + bw / 2, by + bh / 2 + 0.5, fontSize, "#facc15", "center", "700");
  }

  function bindHover(cv, getTip) {
    if (!cv || !cv.addEventListener) return;
    if (cv.__invMove) cv.removeEventListener("mousemove", cv.__invMove);
    if (cv.__invLeave) cv.removeEventListener("mouseleave", cv.__invLeave);
    cv.__invMove = function (ev) {
      var r = cv.getBoundingClientRect();
      var scaleX = (cv.__w || r.width || 1) / (r.width || 1);
      var scaleY = (cv.__h || r.height || 1) / (r.height || 1);
      var x = (ev.clientX - r.left) * scaleX;
      var y = (ev.clientY - r.top) * scaleY;
      var tip = getTip(x, y);
      cv.title = tip || "";
    };
    cv.__invLeave = function () { cv.title = ""; };
    cv.addEventListener("mousemove", cv.__invMove);
    cv.addEventListener("mouseleave", cv.__invLeave);
  }

  /* =========================================================================
   * #37 invCccBar（§6.7 A23Tex 新式，2026-11-17 S15）
   * 01 EQUATION 公式列｜02 CYCLE 雙條（列標置條上方不裁、DPO 標置於 DPO 段上方、引導走線只走條間空隙）
   * 03 LEDGER kvBlock｜04 TREND 顯影預覽（當月唯一作用欄；數值帶底框，不被目標虛線穿）
   * ========================================================================= */
  function invCccBar(cv, d, opt) {
    var TX = g.A23Tex;
    if (!TX) return invCccBarLegacy(cv, d, opt);
    var K = TX.kit(TX.theme("#38bdf8")), V = K.V, tx = K.tx;
    var RED = "#f43f5e", GRN = "#10b981", AMB = "#f59e0b", AMB2 = "#fbbf24";
    var o = opt || {};
    var inv = resolveInvData(d);
    var series = (inv.ccc_series && inv.ccc_series.length) ? inv.ccc_series : [
      { month: "2026-01", DIO: 54, DSO: 42, DPO: 34, CCC: 62 },
      { month: "2026-02", DIO: 56, DSO: 43, DPO: 33, CCC: 66 },
      { month: "2026-03", DIO: 53, DSO: 41, DPO: 35, CCC: 59 },
      { month: "2026-04", DIO: 51, DSO: 40, DPO: 36, CCC: 55 }
    ];
    var n = series.length, i, maxOp = 0, cMin = 1e9, cMax = -1e9;
    for (i = 0; i < n; i++) {
      maxOp = Math.max(maxOp, (series[i].DIO || 0) + (series[i].DSO || 0));
      cMin = Math.min(cMin, series[i].CCC); cMax = Math.max(cMax, series[i].CCC);
    }
    var maxSpan = Math.ceil((maxOp + 4) / 20) * 20;
    function tgtOf(m) { return m.target_ccc != null ? m.target_ccc : 55; }
    function semCol(v, tg) { return v > tg + 5 ? RED : (v > tg ? AMB : GRN); }
    function okLbl(s) { return s && !(s.length <= 3 && s.charAt(s.length - 1) === "…"); }

    var hitRects = [];
    bindHover(cv, function (x, y) {
      for (var j = 0; j < hitRects.length; j++) {
        var r = hitRects[j];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.tip;
      }
      return "INV 01 · 現金循環方程式 CCC = DIO + DSO − DPO（模擬資料）";
    });

    return driver(n, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420 || h < 240;
      var f = K.infoFont(w), pad = compact ? 6 : 10, gap = compact ? 5 : 8, inner = w - pad * 2;
      var p = fr(series, t), A = series[p.k], B = series[p.k2];
      var dio = Math.round(lerp(A.DIO, B.DIO, p.u) * 10) / 10;
      var dso = Math.round(lerp(A.DSO, B.DSO, p.u) * 10) / 10;
      var dpo = Math.round(lerp(A.DPO, B.DPO, p.u) * 10) / 10;
      var ccc = Math.round((dio + dso - dpo) * 10) / 10, op = Math.round((dio + dso) * 10) / 10;
      var curK = p.u < 0.5 ? p.k : p.k2, cur = series[curK], tgt = tgtOf(cur), cc = semCol(ccc, tgt);
      var dm = curK > 0 ? cur.CCC - series[curK - 1].CCC : 0;
      var ph = t - Math.floor(t);
      hitRects = [];

      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);

      /* 標題列＋模擬資料徽章（MONO、語意琥珀） */
      c.font = "700 " + f + "px " + K.MONO;
      var bw = Math.round(c.measureText("模擬資料").width + 10), bh = f + 6, bx = w - pad - bw, by = 11 - bh / 2;
      c.fillStyle = K.rgba(AMB, 0.16); K.roundRect(c, bx, by, bw, bh, 3); c.fill();
      c.strokeStyle = AMB; c.lineWidth = 1; K.roundRect(c, bx + 0.5, by + 0.5, bw - 1, bh - 1, 3); c.stroke();
      tx(c, "模擬資料", bx + bw / 2, 11, f, AMB2, "center", "700");
      var ttl = (compact ? "INV 01 · CCC" : (o.title || "INV 01 · CASH CONVERSION CYCLE")) + " · " + cur.month;
      tx(c, K.fitM(c, ttl, bx - pad - 8, f + 1, "700"), pad, 11, f + 1, V.ink, "left", "700");

      /* 01 EQUATION（桌面） */
      var y0 = 21;
      if (!compact) {
        var eqH = f + 12, E = { x: pad, y: y0, w: inner, h: eqH };
        K.pane(c, E); K.specEdge(c, E.x + 3, E.y + 1, E.w - 6);
        var P = [["01 EQ  ", V.mute, "600"], ["DIO ", V.dim, "600"], [dio.toFixed(1) + "d", V.acc, "700"], ["  +  ", V.mute, "600"],
          ["DSO ", V.dim, "600"], [dso.toFixed(1) + "d", V.acc2, "700"], ["  −  ", V.mute, "600"],
          ["DPO ", V.dim, "600"], [dpo.toFixed(1) + "d", V.txt, "700"], ["  =  ", V.mute, "600"],
          ["CCC ", V.dim, "600"], [ccc.toFixed(1) + "d", cc, "700"]];
        var fs = f + 1, tot = 0;
        for (var tries = 0; tries < 3; tries++) {
          tot = 0;
          for (i = 0; i < P.length; i++) { c.font = P[i][2] + " " + fs + "px " + K.MONO; tot += c.measureText(P[i][0]).width; }
          if (tot <= inner - 16 || fs <= 7) break;
          fs--;
        }
        var ex = Math.max(E.x + 8, E.x + (E.w - tot) / 2), eyc = E.y + eqH / 2;
        for (i = 0; i < P.length; i++) {
          tx(c, P[i][0], ex, eyc, fs, P[i][1], "left", P[i][2]);
          c.font = P[i][2] + " " + fs + "px " + K.MONO; ex += c.measureText(P[i][0]).width;
        }
        y0 += eqH + gap;
      }

      /* 版面：桌面＝上列 02(64%)+03，下列 04；縮圖＝上列 02，下列 03(44%)+04 */
      var rest = h - y0 - pad - gap, H1 = Math.round(rest * (compact ? 0.5 : 0.54)), H2 = rest - H1, Bp, Lp, Tp;
      if (compact) {
        Bp = { x: pad, y: y0, w: inner, h: H1 };
        var lw = Math.round((inner - gap) * 0.44);
        Lp = { x: pad, y: y0 + H1 + gap, w: lw, h: H2 };
        Tp = { x: pad + lw + gap, y: y0 + H1 + gap, w: inner - lw - gap, h: H2 };
      } else {
        var bw2 = Math.round((inner - gap) * 0.64);
        Bp = { x: pad, y: y0, w: bw2, h: H1 };
        Lp = { x: pad + bw2 + gap, y: y0, w: inner - bw2 - gap, h: H1 };
        Tp = { x: pad, y: y0 + H1 + gap, w: inner, h: H2 };
      }

      /* 02 CYCLE：列標在條上方（不裁）；DPO 標在 DPO 段上方右齊；走線只在條間空隙 */
      var ib = K.pane(c, Bp, compact ? "02 CYCLE" : "02 CYCLE · DIO+DSO → −DPO", "0–" + maxSpan + "d");
      var x0 = ib.x + 6, barW = Math.max(40, ib.w - 6 - (compact ? 10 : 14));
      function sx(v) { return x0 + (v / maxSpan) * barW; }
      var lblH = f + 4, gapR = compact ? 6 : 10, axH = f + 6;
      var barH = Math.max(8, Math.min(compact ? 22 : 34, Math.floor((ib.h - lblH * 2 - gapR - axH - 4) / 2)));
      var blockH = lblH * 2 + gapR + barH * 2 + axH;
      var yb = ib.y + Math.max(0, Math.round((ib.h - blockH) / 2));
      var y1 = yb + lblH, y2 = y1 + barH + gapR + lblH, yAx = y2 + barH + axH * 0.62;
      var xDio = sx(dio), xOp = sx(op), xCcc = sx(ccc);
      /* 刻度（只在軸列，不穿文字） */
      c.font = "400 " + f + "px " + K.MONO;
      var tStep = 20; while ((sx(tStep) - x0) < c.measureText(String(maxSpan) + "d").width + 6) tStep += 20;
      c.strokeStyle = V.line; c.lineWidth = 1;
      for (var gv = 0; gv <= maxSpan; gv += tStep) {
        var gx = Math.round(sx(gv)) + 0.5;
        K.ln(c, gx, y2 + barH + 1, gx, y2 + barH + 3);
        tx(c, gv + (gv === maxSpan ? "d" : ""), gx, yAx, f, V.mute, "center");
      }
      /* 列 1：營業週期 */
      tx(c, K.fitM(c, compact ? "OP CYCLE" : "OPERATING CYCLE · 營業週期", Math.max(20, xOp - x0 - 4), f, "600"), x0, y1 - lblH / 2, f, V.dim, "left", "600");
      c.fillStyle = V.acc; c.fillRect(x0, y1, Math.max(2, xDio - x0), barH);
      c.fillStyle = V.acc2; c.fillRect(xDio, y1, Math.max(2, xOp - xDio), barH);
      K.specEdge(c, x0, y1, xOp - x0, 0.22);
      var sDio = K.fitM(c, "DIO " + dio.toFixed(1), xDio - x0 - 6, f, "700");
      if (okLbl(sDio)) tx(c, sDio, (x0 + xDio) / 2, y1 + barH / 2, f, V.bg, "center", "700");
      var sDso = K.fitM(c, "DSO " + dso.toFixed(1), xOp - xDio - 6, f, "700");
      if (okLbl(sDso)) tx(c, sDso, (xDio + xOp) / 2, y1 + barH / 2, f, V.bg, "center", "700");
      /* 列 2：淨現金循環＝CCC 段＋DPO 抵扣段（斜紋） */
      tx(c, K.fitM(c, compact ? "NET CCC" : "NET CCC · 抵扣餘段", Math.max(16, xCcc - x0 - 6), f, "600"), x0, y2 - lblH / 2, f, V.dim, "left", "600");
      var sDpo = K.fitM(c, "← DPO −" + dpo.toFixed(1) + "d", Math.max(16, xOp - xCcc - 8), f, "700");
      if (okLbl(sDpo)) tx(c, sDpo, xOp - 4, y2 - lblH / 2, f, V.txt, "right", "700");
      c.fillStyle = cc; c.globalAlpha = 0.9; c.fillRect(x0, y2, Math.max(2, xCcc - x0), barH); c.globalAlpha = 1;
      K.specEdge(c, x0, y2, xCcc - x0, 0.22);
      c.save(); c.beginPath(); c.rect(xCcc, y2, Math.max(1, xOp - xCcc), barH); c.clip();
      c.fillStyle = K.rgba(V.acc, 0.08); c.fillRect(xCcc, y2, xOp - xCcc, barH);
      c.strokeStyle = V.lead; c.lineWidth = 1;
      for (var hx = xCcc - barH; hx < xOp; hx += 5) K.ln(c, hx, y2 + barH, hx + barH, y2);
      c.restore();
      c.strokeStyle = V.line2; c.strokeRect(xCcc + 0.5, y2 + 0.5, Math.max(1, xOp - xCcc - 1), barH - 1);
      var sCcc = K.fitM(c, "CCC " + ccc.toFixed(1) + "d", xCcc - x0 - 6, f, "700");
      if (okLbl(sCcc)) tx(c, sCcc, (x0 + xCcc) / 2, y2 + barH / 2, f, V.bg, "center", "700");
      /* 目標刻記（條下小三角，不畫穿越線） */
      var xT = sx(tgt); c.fillStyle = V.acc3;
      c.beginPath(); c.moveTo(xT, y2 + barH + 1); c.lineTo(xT - 3, y2 + barH + 5); c.lineTo(xT + 3, y2 + barH + 5); c.closePath(); c.fill();
      /* 抵扣走線：營業週期終點 → 條間空隙 → CCC 終點（曼哈頓＋熱封包＋兩端埠點） */
      var yM = y1 + barH + Math.round(gapR / 2);
      var route = [[xOp, y1 + barH], [xOp, yM], [xCcc, yM], [xCcc, y2]];
      c.strokeStyle = V.line2; c.lineWidth = 1; K.orthPath(c, route, 3);
      K.hotPacket(c, route, K.clamp(ph, 0, 1), V.acc3, compact ? 2 : 2.6);
      K.kvPort(c, xOp, y1 + barH, true); K.kvPort(c, xCcc, y2, true);
      hitRects.push({ x: x0, y: y1, w: xOp - x0, h: barH, tip: cur.month + "｜營業週期 DIO " + dio.toFixed(1) + "d + DSO " + dso.toFixed(1) + "d = " + op.toFixed(1) + "d" });
      hitRects.push({ x: x0, y: y2, w: xOp - x0, h: barH, tip: cur.month + "｜CCC = " + op.toFixed(1) + " − DPO " + dpo.toFixed(1) + " = " + ccc.toFixed(1) + "d（目標 " + tgt + "d）" });

      /* 03 LEDGER：鍵值列（CCC 列唯一點亮） */
      var il = K.pane(c, Lp, "03 LEDGER", cur.month.slice(5) + "/" + n);
      var dmS = (dm > 0 ? "+" : "") + dm + "d";
      var rows = compact
        ? [["CCC", ccc.toFixed(1) + "d", true], ["DIO", dio.toFixed(1) + "d"], ["DSO", dso.toFixed(1) + "d"], ["DPO", "−" + dpo.toFixed(1) + "d"], ["TGT", tgt + "d"], ["ΔMoM", dmS]]
        : [["DIO 庫存天數", dio.toFixed(1) + "d"], ["DSO 收款天數", dso.toFixed(1) + "d"], ["OP 營業週期", op.toFixed(1) + "d"],
           ["DPO 付款天數", "−" + dpo.toFixed(1) + "d"], ["CCC 現金循環", ccc.toFixed(1) + "d", true], ["TARGET 目標", tgt + "d"], ["Δ MoM", dmS]];
      K.kvBlock(c, { x: il.x, y: il.y + 2, w: il.w, h: il.h - 2 }, rows, f, Lp.x);

      /* 04 TREND：顯影預覽；當月唯一作用欄；數值帶底框 */
      var it = K.pane(c, Tp, compact ? "04 TREND" : "04 CCC TREND · " + n + "M", "TGT " + tgt + "d");
      var valH = f + 4, monH = f + 4;
      var PL = { x: it.x + 2, y: it.y + valH, w: it.w - 4, h: Math.max(10, it.h - valH - monH) };
      var lo = Math.max(0, Math.floor((cMin - 12) / 10) * 10), hi = cMax + 2;
      function vy(v) { return PL.y + PL.h - ((v - lo) / Math.max(1, hi - lo)) * PL.h; }
      var colW = PL.w / n;
      K.develop(c, PL, K.clamp((t + 1) / n, 0, 1), function (cx, col, lit) {
        for (var mi = 0; mi < n; mi++) {
          var m = series[mi], bx2 = PL.x + mi * colW + colW * 0.2, yv = vy(m.CCC);
          cx.fillStyle = col; cx.globalAlpha = lit ? 0.55 : 1;
          cx.fillRect(bx2, yv, colW * 0.6, PL.y + PL.h - yv); cx.globalAlpha = 1;
          if (lit && m.CCC > tgtOf(m)) { cx.fillStyle = semCol(m.CCC, tgtOf(m)); cx.fillRect(bx2, yv, colW * 0.6, 2); }
        }
      });
      var yt = Math.round(vy(tgt)) + 0.5;
      c.setLineDash([3, 3]); c.strokeStyle = V.acc3; c.globalAlpha = 0.6; K.ln(c, PL.x, yt, PL.x + PL.w, yt); c.globalAlpha = 1; c.setLineDash([]);
      c.font = "700 " + f + "px " + K.MONO;
      var allVals = colW >= c.measureText(String(cMax)).width + 6;
      for (var mj = 0; mj < n; mj++) {
        var mm = series[mj], cxm = PL.x + (mj + 0.5) * colW, isCur = mj === curK, yv2 = vy(mm.CCC);
        if (isCur) {
          var hb = { x: PL.x + mj * colW + colW * 0.12, y: yv2 - valH, w: colW * 0.76, h: PL.y + PL.h - yv2 + valH };
          if (compact) { c.strokeStyle = V.acc2; c.lineWidth = 1; K.roundRect(c, hb.x, hb.y, hb.w, hb.h, 2); c.stroke(); }
          else K.activeHalo(c, hb.x, hb.y, hb.w, hb.h, 10);
          c.fillStyle = V.acc3; c.fillRect(PL.x + mj * colW + colW * 0.2, yv2, colW * 0.6, 2);
        }
        if (allVals || isCur) {
          var vs = String(mm.CCC), vw = c.measureText(vs).width, vyy = yv2 - valH / 2;
          c.fillStyle = V.pane; c.fillRect(cxm - vw / 2 - 2, vyy - f / 2 - 1, vw + 4, f + 2);
          tx(c, vs, cxm, vyy, f, isCur ? V.ink : (mm.CCC > tgtOf(mm) + 5 ? RED : V.dim), "center", isCur ? "700" : "600");
        }
        if (colW >= f * 1.4 || mj % 2 === 0 || isCur) tx(c, mm.month.slice(5), cxm, PL.y + PL.h + monH / 2 + 1, f, isCur ? V.ink : V.mute, "center", isCur ? "700" : "400");
        hitRects.push({ x: PL.x + mj * colW, y: Tp.y, w: colW, h: Tp.h, tip: mm.month + "｜DIO " + mm.DIO + "d + DSO " + mm.DSO + "d − DPO " + mm.DPO + "d = CCC " + mm.CCC + "d" });
      }
      return cur.month;
    }, o);
  }

  /* =========================================================================
   * #37 invCccBarLegacy（無 A23Tex 回退）— 現金循環方程式條 (DIO + DSO - DPO = CCC)
   * ========================================================================= */
  function invCccBarLegacy(cv, d, opt) {
    var o = opt || {};
    var inv = resolveInvData(d);
    var series = (inv.ccc_series && inv.ccc_series.length) ? inv.ccc_series : [
      { month: "2026-01", DIO: 54, DSO: 42, DPO: 34, CCC: 62 },
      { month: "2026-02", DIO: 56, DSO: 43, DPO: 33, CCC: 66 },
      { month: "2026-03", DIO: 53, DSO: 41, DPO: 35, CCC: 59 },
      { month: "2026-04", DIO: 51, DSO: 40, DPO: 36, CCC: 55 }
    ];

    var maxSpan = 110;
    series.forEach(function (m) {
      maxSpan = Math.max(maxSpan, (m.DIO || 0) + (m.DSO || 0) + 8);
    });

    var hitRects = [];
    bindHover(cv, function (x, y) {
      for (var i = 0; i < hitRects.length; i++) {
        var r = hitRects[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.tip;
      }
      return "INV 01 · 現金循環方程式 CCC = DIO + DSO − DPO（模擬資料）";
    });

    return driver(series.length, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420 || h < 240;
      var F = function (sz) { return fsz(w, compact, sz); };
      var p = fr(series, t), A = series[p.k], B = series[p.k2];

      var dioRaw = lerp(A.DIO, B.DIO, p.u);
      var dsoRaw = lerp(A.DSO, B.DSO, p.u);
      var dpoRaw = lerp(A.DPO, B.DPO, p.u);
      var dio = Math.round(dioRaw * 10) / 10;
      var dso = Math.round(dsoRaw * 10) / 10;
      var dpo = Math.round(dpoRaw * 10) / 10;
      var ccc = Math.round((dio + dso - dpo) * 10) / 10;
      var opCycle = Math.round((dio + dso) * 10) / 10;
      var curLabel = (p.u < 0.5 ? A : B).month;
      hitRects = [];

      // 頂部標題與模擬資料標籤
      var titleStr = (o.title || "INV 01 · 現金循環方程式") + " · " + curLabel;
      c.font = "700 " + F(13) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      titleStr = fitText(c, titleStr, w - (w >= 560 || !compact ? 86 : 64));
      text(c, titleStr, 10, 14, F(13), FG, "left", "700");

      // 方程式公式橫幅：DIO + DSO − DPO = CCC
      var eqY = compact ? 33 : 40;
      var eqH = compact ? 22 : 26;
      c.fillStyle = "#111c30";
      c.strokeStyle = "#1e293b";
      c.lineWidth = 1;
      c.fillRect(10, eqY - eqH / 2, w - 20, eqH);
      c.strokeRect(10, eqY - eqH / 2, w - 20, eqH);

      var eqStr = "DIO " + dio.toFixed(1) + "d + DSO " + dso.toFixed(1) + "d − DPO " + dpo.toFixed(1) + "d = CCC " + ccc.toFixed(1) + "d";
      text(c, "DIO + DSO − DPO = CCC", 16, eqY, F(11), "#38bdf8", "left", "700");
      if (w >= 380) {
        text(c, eqStr, w - 16, eqY, F(11), "#facc15", "right", "700");
      }

      // 主橫條區
      var ML = compact ? 48 : 74, MR = compact ? 16 : 24;
      var barW = Math.max(60, w - ML - MR);
      function sx(val) { return ML + (val / maxSpan) * barW; }

      var topBarY = compact ? 54 : 70;
      var barH = compact ? 20 : Math.min(30, Math.max(20, Math.round(h * 0.095)));
      var gapY = compact ? 18 : 24;
      var botBarY = topBarY + barH + gapY;

      // 座標格線
      c.strokeStyle = "#1e293b";
      c.lineWidth = 1;
      for (var gv = 0; gv <= 100; gv += 20) {
        var gx = sx(gv);
        c.beginPath();
        c.moveTo(gx, topBarY - 6);
        c.lineTo(gx, botBarY + barH + 8);
        c.stroke();
        text(c, gv + "d", gx, botBarY + barH + (compact ? 16 : 19), F(11), DIM, "center");
      }

      // 第 1 條：DIO + DSO 向右接續
      var x0 = sx(0), xDio = sx(dio), xOp = sx(dio + dso);
      text(c, "正向週期", ML - 8, topBarY + barH / 2, F(11), DIM, "right");

      c.fillStyle = "#38bdf8";
      c.globalAlpha = 0.92;
      c.fillRect(x0, topBarY, Math.max(2, xDio - x0), barH);
      c.fillStyle = "#f59e0b";
      c.fillRect(xDio, topBarY, Math.max(2, xOp - xDio), barH);
      c.globalAlpha = 1;

      c.font = "700 " + F(11) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      text(c, fitText(c, "DIO +" + dio.toFixed(1) + "d →", Math.max(20, xDio - x0 - 6)), (x0 + xDio) / 2, topBarY + barH / 2, F(11), "#0b1220", "center", "700");
      text(c, fitText(c, "DSO +" + dso.toFixed(1) + "d →", Math.max(20, xOp - xDio - 6)), (xDio + xOp) / 2, topBarY + barH / 2, F(11), "#0b1220", "center", "700");

      // 第 2 條：DPO 由 xOp 向左抵扣，餘段 = CCC
      var xCcc = sx(ccc);
      text(c, "抵扣餘段", ML - 8, botBarY + barH / 2, F(11), DIM, "right");

      var cccColor = ccc > 58 ? "#f43f5e" : (ccc > 52 ? "#10b981" : "#14b8a6");
      c.fillStyle = cccColor;
      c.globalAlpha = 0.92;
      c.fillRect(x0, botBarY, Math.max(2, xCcc - x0), barH);

      c.fillStyle = "rgba(167,139,250,0.32)";
      c.strokeStyle = "#a78bfa";
      c.lineWidth = 1.5;
      c.fillRect(xCcc, botBarY, Math.max(2, xOp - xCcc), barH);
      c.strokeRect(xCcc, botBarY, Math.max(2, xOp - xCcc), barH);
      c.globalAlpha = 1;

      c.font = "700 " + F(11) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      text(c, fitText(c, "餘段 CCC = " + ccc.toFixed(1) + "d", Math.max(24, xCcc - x0 - 6)), (x0 + xCcc) / 2, botBarY + barH / 2, F(11), "#0b1220", "center", "700");
      text(c, fitText(c, "← DPO −" + dpo.toFixed(1) + "d", Math.max(24, xOp - xCcc - 6)), (xCcc + xOp) / 2, botBarY + barH / 2, F(11), "#e2e8f0", "center", "700");

      // 垂直對齊虛線
      c.strokeStyle = "#facc15";
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(xOp, topBarY);
      c.lineTo(xOp, botBarY + barH);
      c.moveTo(xCcc, topBarY + barH);
      c.lineTo(xCcc, botBarY + barH);
      c.stroke();
      c.setLineDash([]);

      var midY = topBarY + barH + gapY / 2;
      text(c, "營業週期 (DIO+DSO) = " + opCycle.toFixed(1) + " 天", (x0 + xOp) / 2, midY, F(11), "#cbd5e1", "center");

      // 底部：12 個月 CCC 趨勢對照列
      var trendTop = botBarY + barH + (compact ? 28 : 36);
      var trendH = h - trendTop - (compact ? 20 : 26);
      if (trendH >= 36) {
        c.strokeStyle = "#1e293b";
        c.strokeRect(ML, trendTop, barW, trendH);
        var mCount = series.length;
        var colW = barW / mCount;
        for (var mi = 0; mi < mCount; mi++) {
          var mItem = series[mi];
          var mx = ML + mi * colW;
          var isCur = (mi === p.k);
          var ratio = Math.max(0.1, Math.min(1, (mItem.CCC - 30) / 50));
          var mh = ratio * (trendH - 18);
          c.fillStyle = isCur ? "#facc15" : (mItem.CCC > 58 ? "#f43f5e" : "#38bdf8");
          c.globalAlpha = isCur ? 0.95 : 0.52;
          c.fillRect(mx + colW * 0.18, trendTop + trendH - mh - 2, colW * 0.64, mh);
          c.globalAlpha = 1;
          text(c, mItem.CCC + "", mx + colW / 2, trendTop + trendH - mh - 9, F(11), isCur ? "#facc15" : DIM, "center", isCur ? "700" : "");
          text(c, mItem.month.slice(5), mx + colW / 2, trendTop + trendH + (compact ? 9 : 12), F(11), isCur ? FG : DIM, "center", isCur ? "700" : "");
          hitRects.push({
            x: mx, y: trendTop, w: colW, h: trendH + 20,
            tip: mItem.month + "｜DIO " + mItem.DIO + "d + DSO " + mItem.DSO + "d − DPO " + mItem.DPO + "d = CCC " + mItem.CCC + "d"
          });
        }
      }

      drawSimBadge(c, w, 14, compact);
      return curLabel;
    }, o);
  }

  /* =========================================================================
   * #40 invBulletWall — 子彈預警牆
   * available = on_hand + on_order - allocated；在途量畫成可用量條尾端淡色延伸段；
   * 700px 寬下文字 >= 11px，左側兩行顯示（料號+ABC、品名省略加…），完整名稱給 hover。
   * ========================================================================= */
  function invBulletWall(cv, d, opt) {
    var o = opt || {};
    /* §6.7（2026-11-16 S11）：OK 條改主題單色階（依剩餘天數深→亮），紅／琥珀只留語意（左條＋門檻線＋淡填）；最急列光暈＋埠點 */
    var TX = g.A23Tex, K = TX.kit(TX.theme("#38bdf8")), V = K.V;
    var inv = resolveInvData(d);
    var allSkus = (inv.skus && inv.skus.length) ? inv.skus : [];
    var pool = allSkus.slice(0, 20);
    var nFrames = 12;

    var hitRows = [];
    bindHover(cv, function (x, y) {
      for (var i = 0; i < hitRows.length; i++) {
        var r = hitRows[i];
        if (y >= r.y && y <= r.y + r.h) return r.tip;
      }
      return "INV 04 · 子彈補貨預警牆（可用量 = 現有 + 在途 − 已分配，模擬資料）";
    });

    function stateAt(sku, idx, t) {
      var baseAvail = sku.available;
      var drain = sku.daily_usage * (t * 0.42) * (0.85 + ((idx * 7) % 5) * 0.08);
      var curAvail = Math.max(Math.round(sku.ss * 0.22), Math.round(baseAvail - drain));
      var daysLeft = curAvail / Math.max(0.5, sku.daily_usage);
      var status = curAvail < sku.ss ? 2 : (curAvail < sku.rop ? 1 : 0);
      var sortKey = (status === 2 ? -1000 : (status === 1 ? -200 : 0)) + daysLeft;
      return { sku: sku, avail: curAvail, daysLeft: daysLeft, status: status, sortKey: sortKey };
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420 || h < 260;
      var F = function (sz) { return fsz(w, compact, sz); };
      var rowsToShow = Math.max(12, o.rows || 12);

      var k0 = Math.max(0, Math.min(nFrames - 1, Math.floor(t)));
      var k1 = Math.min(nFrames - 1, k0 + 1);
      var u = ease(Math.max(0, Math.min(1, t - k0)));

      var list0 = pool.map(function (sk, i) { return stateAt(sk, i, k0); }).sort(function (a, b) { return a.sortKey - b.sortKey; });
      var list1 = pool.map(function (sk, i) { return stateAt(sk, i, k1); }).sort(function (a, b) { return a.sortKey - b.sortKey; });
      var rank0 = {}, rank1 = {}, map0 = {}, map1 = {};
      list0.forEach(function (it, r) { rank0[it.sku.id] = r; map0[it.sku.id] = it; });
      list1.forEach(function (it, r) { rank1[it.sku.id] = r; map1[it.sku.id] = it; });

      var dayLabel = "D+" + (t * 2.5).toFixed(1) + "d";
      c.font = "700 " + F(13) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      var headTitle = fitText(c, (o.title || "INV 04 · 子彈補貨預警牆") + " (" + dayLabel + ")", w - (w >= 560 || !compact ? 86 : 64));
      text(c, headTitle, 10, 14, F(13), FG, "left", "700");

      var legY = compact ? 28 : 32;
      c.font = F(11) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      var legTxt = fitText(c, "■ 紅<SS(浮頂)  ■ 黃<ROP  ░ 淡尾端=在途量(未到貨)  │ 紅線=SS  黃線=ROP  右界=Max", w - 20);
      text(c, legTxt, 10, legY, F(11), DIM, "left");

      var MT = compact ? 38 : 46, MB = compact ? 6 : 10;
      var ML = compact ? 88 : (w >= 560 ? 186 : 148);
      var MR = compact ? 74 : (w >= 560 ? 124 : 100);
      var barW = Math.max(50, w - ML - MR);
      var rowH = (h - MT - MB) / rowsToShow;
      hitRows = [];

      var merged = pool.map(function (sk) {
        var a = map0[sk.id], b = map1[sk.id];
        var r0 = rank0[sk.id], r1 = rank1[sk.id];
        var pos = lerp(r0, r1, u);
        var av = lerp(a.avail, b.avail, u);
        var dl = lerp(a.daysLeft, b.daysLeft, u);
        return { sku: sk, pos: pos, avail: av, daysLeft: dl, delta: r1 - r0 };
      }).filter(function (it) { return it.pos < rowsToShow + 0.4; });

      // 往下降的列先畫，往上升的列最後畫在最上層
      merged.sort(function (a, b) {
        var pa = a.delta > 0 ? 0 : (a.delta === 0 ? 1 : 2);
        var pb = b.delta > 0 ? 0 : (b.delta === 0 ? 1 : 2);
        return pa - pb;
      });

      merged.forEach(function (it) {
        var sk = it.sku;
        var y = MT + it.pos * rowH;
        if (y + rowH > h - 2 || y < MT - rowH * 0.5) return;

        var xShift = it.delta < 0 ? Math.sin(Math.PI * u) * 10 : 0;
        c.save();
        c.translate(xShift, 0);
        if (it.delta > 0) {
          c.globalAlpha = 1 - 0.42 * Math.sin(Math.PI * u);
        }
        // 不透明底色，防止下層文字透出
        c.fillStyle = BG;
        c.fillRect(2, y, w - 4, rowH);

        var bh = Math.max(6, rowH - (compact ? 3 : 5));
        var by = y + (rowH - bh) / 2;
        var maxV = sk.max;

        var isCrit = it.avail < sk.ss;
        var isWarn = !isCrit && (it.avail < sk.rop);
        var barCol = isCrit ? "#f43f5e" : (isWarn ? "#fbbf24" : K.mix(V.deep, V.acc2, K.clamp(it.daysLeft / 40, 0.15, 1)));

        // 1. 底槽（Max 上限背景）
        c.fillStyle = V.track;
        c.strokeStyle = V.line;
        c.lineWidth = 1;
        c.fillRect(ML, by, barW, bh);
        c.strokeRect(ML, by, barW, bh);

        // 2. 可用量條 = 現有淨可用實心段 + 尾端在途量淡色延伸段
        var onOrderQty = Math.max(0, sk.on_order || 0);
        var onOrderPart = Math.min(it.avail, onOrderQty);
        var solidPart = Math.max(0, it.avail - onOrderPart);
        var solidW = Math.max(0, Math.min(barW, (solidPart / maxV) * barW));
        var totalW = Math.max(2, Math.min(barW, (it.avail / maxV) * barW));
        var extW = Math.max(0, totalW - solidW);

        if (solidW > 0.5) {
          c.fillStyle = (isCrit || isWarn) ? K.mix(V.pane, barCol, isCrit ? 0.5 : 0.42) : barCol;
          c.fillRect(ML, by + 1, solidW, Math.max(3, bh - 2));
          if (isCrit || isWarn) { c.fillStyle = barCol; c.fillRect(ML, by + 1, 2, Math.max(3, bh - 2)); }
          K.specEdge(c, ML + 1, by + 1, Math.max(0, solidW - 2), 0.12);
        }
        if (extW > 0.5) {
          var extX = ML + solidW;
          c.fillStyle = barCol;
          c.globalAlpha = 0.26;
          c.fillRect(extX, by + 1, extW, Math.max(3, bh - 2));
          c.globalAlpha = 0.72;
          c.strokeStyle = barCol;
          c.lineWidth = 1;
          c.setLineDash([3, 2]);
          c.strokeRect(extX + 0.5, by + 1.5, Math.max(1, extW - 1), Math.max(2, bh - 3));
          c.setLineDash([]);
          c.globalAlpha = 1;
        }

        // 3. SS 紅線
        var xSS = ML + Math.min(barW, (sk.ss / maxV) * barW);
        c.strokeStyle = "#f43f5e";
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(xSS, by - 1);
        c.lineTo(xSS, by + bh + 1);
        c.stroke();

        // 4. ROP 警戒黃線
        var xROP = ML + Math.min(barW, (sk.rop / maxV) * barW);
        c.strokeStyle = "#fbbf24";
        c.lineWidth = 1.8;
        c.beginPath();
        c.moveTo(xROP, by - 1);
        c.lineTo(xROP, by + bh + 1);
        c.stroke();

        // 5. Max 上限右端標記線
        c.strokeStyle = V.acc2;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(ML + barW, by - 1);
        c.lineTo(ML + barW, by + bh + 1);
        c.stroke();

        // 左欄：>=11px 時不硬切，兩行或寬欄省略加「…」
        var lblCol = isCrit ? "#fb7185" : (isWarn ? "#fbbf24" : FG);
        var abcCol = sk.abc === "A" ? V.acc3 : (sk.abc === "B" ? V.acc2 : V.dim);
        var lblFont = Math.max(F(11), K.infoFont(w));
        if (!compact && rowH >= 26) {
          // 兩行排版：上行 料號 + ABC 徽章，下行 品名（自動加…）
          var cyTop = by + bh * 0.28;
          var cyBot = by + bh * 0.76;
          text(c, sk.id, 10, cyTop, lblFont, lblCol, "left", "700");
          var badgeX = 76;
          c.fillStyle = V.pane;
          c.strokeStyle = abcCol;
          c.lineWidth = 1;
          c.fillRect(badgeX, cyTop - 7, 22, 14);
          c.strokeRect(badgeX, cyTop - 7, 22, 14);
          text(c, sk.abc, badgeX + 11, cyTop + 0.5, lblFont, abcCol, "center", "700");

          c.font = lblFont + "px 'Microsoft JhengHei',system-ui,sans-serif";
          var partFitted = fitText(c, sk.short_name, ML - 18);
          text(c, partFitted, 10, cyBot, lblFont, V.txt, "left");
        } else {
          var onePrefix = sk.id + " [" + sk.abc + "] ";
          c.font = (isCrit ? "700 " : "") + lblFont + "px 'Microsoft JhengHei',system-ui,sans-serif";
          var oneLine = compact
            ? fitText(c, sk.id + "(" + sk.abc + ")", ML - 8)
            : (onePrefix + fitText(c, sk.short_name, Math.max(16, ML - 14 - c.measureText(onePrefix).width)));
          text(c, oneLine, ML - 6, by + bh / 2, lblFont, lblCol, "right", isCrit ? "700" : "");
        }

        // 條內數值與斷料日（保證對比度）
        var inTxt = Math.round(it.avail) + "/" + sk.rop + " (" + it.daysLeft.toFixed(1) + "d)";
        if (onOrderQty > 0 && !compact && barW >= 240) {
          inTxt += " · 途+" + onOrderQty;
        }
        var inFont = F(11);
        c.font = "700 " + inFont + "px 'Microsoft JhengHei',system-ui,sans-serif";
        inTxt = fitText(c, inTxt, barW - 10);
        var inTxtW = c.measureText(inTxt).width;
        text(c, inTxt, ML + 6, by + bh / 2, inFont, (!isCrit && !isWarn && solidW > inTxtW + 10 && it.daysLeft > 26) ? V.bg : V.ink, "left", "700");

        // 列尾行動標籤
        var hasTransfer = sk.other_wh_avail > 0;
        var actText = hasTransfer ? ("調撥優先(+" + sk.other_wh_avail + ")") : "緊急採購";
        if (compact) actText = hasTransfer ? "調撥優先" : "採購";
        var actCol = hasTransfer ? V.acc2 : (isCrit ? "#f43f5e" : "#f59e0b");

        var tagX = ML + barW + 6;
        var tagW = MR - 10;
        c.fillStyle = hasTransfer ? K.rgba(V.acc, 0.12) : K.rgba(actCol, 0.1);
        c.strokeStyle = actCol;
        c.lineWidth = 1;
        c.fillRect(tagX, by, tagW, bh);
        c.strokeRect(tagX, by, tagW, bh);
        c.font = "700 " + F(11) + "px 'Microsoft JhengHei',system-ui,sans-serif";
        text(c, fitText(c, actText, tagW - 6), tagX + tagW / 2, by + bh / 2, F(11), actCol, "center", "700");

        K.kvPort(c, ML, by + bh / 2, isCrit);
        if (it.pos < 0.5 && it.delta === 0) K.activeHalo(c, ML, by, barW, bh, compact ? 5 : 9);
        hitRows.push({
          y: by, h: bh,
          tip: sk.name + " [" + sk.abc + "/" + sk.xyz + "/" + sk.fmr + "]｜現有:" + sk.on_hand + " + 在途:" + sk.on_order + " − 分配:" + sk.allocated + " = 可用:" + Math.round(it.avail) + " (ROP:" + sk.rop + ", SS:" + sk.ss + ")｜預計斷料:" + it.daysLeft.toFixed(1) + "天｜" + (hasTransfer ? ("他倉餘量+" + sk.other_wh_avail + " → 調撥優先") : "緊急採購")
        });
        c.restore();
      });

      drawSimBadge(c, w, 14, compact);
      return dayLabel;
    }, o);
  }

  /* =========================================================================
   * #41 invWarehouseHeat — 儲位熱力＋揀貨動線 (S2 質感強化版)
   * - 格子漸層＋內陰影；F 類微光、R 類壓暗拉開對比
   * - 走道流向底紋＋出貨口脈衝光暈
   * - 粒子放大並加確定性拖尾
   * - 錯放格紅色閃框＋指向黃金儲位虛線建議箭頭
   * ========================================================================= */
  function invWarehouseHeat(cv, d, opt) {
    var o = opt || {};
    var inv = resolveInvData(d);
    var skus = (inv.skus && inv.skus.length) ? inv.skus : [];
    var cells = [];
    for (var r = 1; r <= 6; r++) {
      for (var cl = 1; cl <= 8; cl++) {
        var whTarget = cl <= 4 ? "A" : "B";
        var subCol = cl <= 4 ? cl : (cl - 4);
        var match = null;
        for (var k = 0; k < skus.length; k++) {
          if (skus[k].warehouse === whTarget && skus[k].row === r && skus[k].col === subCol) {
            match = skus[k];
            break;
          }
        }
        var fmr = match ? match.fmr : "";
        var freq = match ? match.pick_freq : 0;
        var misplaced = match ? (fmr === "F" && r >= 5) : false;
        cells.push({
          row: r,
          col: cl,
          wh: whTarget,
          empty: !match,
          sku: match ? match.id : null,
          fullName: match ? match.name : "空儲位",
          fmr: fmr,
          freq: freq,
          misplaced: misplaced,
          golden: r <= 2
        });
      }
    }

    // 預先為每顆錯放格配對一個黃金儲位目標（優先同倉 R1/R2 非 F 類儲位，確保確定性）
    var goldenTargets = {};
    cells.forEach(function (cell, idx) {
      if (!cell.misplaced) return;
      var cand = cells.filter(function (gCell) {
        return gCell.wh === cell.wh && gCell.row <= 2 && gCell.fmr !== "F";
      });
      if (!cand.length) {
        cand = cells.filter(function (gCell) { return gCell.wh === cell.wh && gCell.row <= 2; });
      }
      var pick = cand[idx % cand.length] || cells[0];
      goldenTargets[cell.row + "-" + cell.col] = pick;
    });

    // 預先建立決定性揀貨粒子池
    var particles = [];
    cells.forEach(function (cell, ci) {
      if (cell.empty) return;
      var pCount = cell.fmr === "F" ? 4 : (cell.fmr === "M" ? 2 : 1);
      for (var pi = 0; pi < pCount; pi++) {
        particles.push({
          cell: cell,
          phase: ((ci * 17 + pi * 31) % 100) / 100,
          speed: 0.035 + (cell.freq / 100) * 0.025
        });
      }
    });

    var hitCells = [];
    bindHover(cv, function (x, y) {
      for (var i = 0; i < hitCells.length; i++) {
        var r = hitCells[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.tip;
      }
      return "INV 05 · 儲位 FMR 熱力＋揀貨動線（模擬資料）";
    });

    /* §6.7（2026-11-16 S11）：F/M/R 改主題單色 6 階（亮→暗）、黃金區改主色框；紅只留錯放語意；調儲建議改曼哈頓沿走道 arcTo；格內兩行依格高決定（防互疊） */
    var TX = g.A23Tex, K = TX.kit(TX.theme("#38bdf8")), V = K.V;
    return driver(120, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420 || h < 260;
      var F = function (sz) { return fsz(w, compact, sz); };

      c.font = "700 " + F(13) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      var headTitle = fitText(c, o.title || "INV 05 · 儲位 FMR 熱力＋揀貨動線", w - (w >= 560 || !compact ? 86 : 64));
      text(c, headTitle, 10, 14, F(13), FG, "left", "700");

      var legY = compact ? 28 : 32;
      c.font = F(11) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      var legStr = fitText(c, "F(高頻微光) / M(中頻) / R(低頻壓暗) · 金框=黃金儲位 · 紅閃箭頭=錯放調儲建議", w - 20);
      text(c, legStr, 10, legY, F(11), DIM, "left");

      var ML = compact ? 32 : 52, MR = compact ? 12 : 20;
      var MT = compact ? 42 : 52, MB = compact ? 28 : 38;
      var W = w - ML - MR, H = h - MT - MB;

      var aisleX = ML + W * 0.5;
      var aisleW = Math.max(18, W * 0.095);
      var dockW = Math.min(180, W * 0.42), dockH = compact ? 18 : 24;
      var dockX = aisleX - dockW / 2, dockY = h - dockH - 5;

      function cellRect(r, cl) {
        var invR = 6 - r;
        var rowBandH = (H - 14) / 6;
        var aisleGap = (invR >= 2 ? 6 : 0) + (invR >= 4 ? 6 : 0);
        var cy = MT + invR * rowBandH + aisleGap;
        var ch = rowBandH - (compact ? 4 : 7);

        var halfW = (W - aisleW) / 2;
        var cw = (halfW / 4) - (compact ? 3 : 5);
        var cx;
        if (cl <= 4) {
          cx = ML + (cl - 1) * (halfW / 4) + 1;
        } else {
          cx = aisleX + aisleW / 2 + (cl - 5) * (halfW / 4) + 2;
        }
        return { x: cx, y: cy, w: cw, h: ch, cx: cx + cw / 2, cy: cy + ch / 2 };
      }

      // 1. 中央主走道＋流向底紋（確定性隨 t 下流動）
      c.fillStyle = V.pane;
      c.fillRect(aisleX - aisleW / 2, MT, aisleW, dockY - MT);
      c.save();
      c.beginPath();
      c.rect(aisleX - aisleW / 2, MT, aisleW, dockY - MT);
      c.clip();
      var chevSpacing = 18;
      var chevOffset = (t * 2.4) % chevSpacing;
      c.strokeStyle = "rgba(56,189,248,0.28)";
      c.lineWidth = 1.5;
      for (var cyy = MT - chevSpacing + chevOffset; cyy < dockY + chevSpacing; cyy += chevSpacing) {
        c.beginPath();
        c.moveTo(aisleX - aisleW * 0.3, cyy - 4);
        c.lineTo(aisleX, cyy + 3);
        c.lineTo(aisleX + aisleW * 0.3, cyy - 4);
        c.stroke();
      }
      c.restore();

      // 支走道底色與流向虛線
      [cellRect(4, 1), cellRect(2, 1)].forEach(function (refR) {
        var hy = refR.y - 4;
        c.strokeStyle = "rgba(56,189,248,0.18)";
        c.lineWidth = 1;
        c.setLineDash([4, 4]);
        c.lineDashOffset = -(t * 1.6);
        c.beginPath();
        c.moveTo(ML, hy);
        c.lineTo(aisleX - aisleW / 2, hy);
        c.moveTo(ML + W, hy);
        c.lineTo(aisleX + aisleW / 2, hy);
        c.stroke();
        c.setLineDash([]);
        c.lineDashOffset = 0;
      });

      // 2. 出貨口脈衝光暈
      var dockPulse = 0.5 + 0.5 * Math.sin(t * 0.45);
      var gradAura = c.createRadialGradient(aisleX, dockY + dockH * 0.3, 4, aisleX, dockY + dockH * 0.3, dockW * (0.65 + 0.12 * dockPulse));
      gradAura.addColorStop(0, "rgba(16,185,129," + (0.38 + 0.24 * dockPulse).toFixed(3) + ")");
      gradAura.addColorStop(0.6, "rgba(16,185,129," + (0.12 + 0.08 * dockPulse).toFixed(3) + ")");
      gradAura.addColorStop(1, "rgba(16,185,129,0)");
      c.fillStyle = gradAura;
      c.fillRect(aisleX - dockW * 0.9, dockY - dockH * 1.4, dockW * 1.8, dockH * 3.0);

      // 3. 繪製儲位格（漸層＋內陰影；F 微光、R 壓暗）
      var pulse = 0.5 + 0.5 * Math.sin(t * 0.38);
      hitCells = [];
      cells.forEach(function (cell) {
        var rc = cellRect(cell.row, cell.col);
        if (cell.empty) {
          c.fillStyle = "rgba(15,23,42,0.45)";
          c.fillRect(rc.x, rc.y, rc.w, rc.h);
          c.strokeStyle = "#1e293b";
          c.lineWidth = 1;
          c.strokeRect(rc.x, rc.y, rc.w, rc.h);
          var subC = cell.col <= 4 ? cell.col : (cell.col - 4);
          hitCells.push({
            x: rc.x, y: rc.y, w: rc.w, h: rc.h,
            tip: cell.wh + "-R" + cell.row + "-C" + subC + "｜空儲位"
          });
          return;
        }
        var grad = c.createLinearGradient(rc.x, rc.y, rc.x, rc.y + rc.h);
        if (cell.fmr === "F") {
          grad.addColorStop(0, V.acc3);
          grad.addColorStop(0.55, V.acc2);
          grad.addColorStop(1, V.acc);
        } else if (cell.fmr === "M") {
          grad.addColorStop(0, K.mix(V.deep, V.acc, 0.55));
          grad.addColorStop(1, V.deep);
        } else {
          grad.addColorStop(0, V.card);
          grad.addColorStop(1, V.pane);
        }

        c.save();
        if (cell.fmr === "F") {
          c.shadowBlur = 10;
          c.shadowColor = K.rgba(V.acc2, 0.42);
        }
        c.fillStyle = grad;
        c.globalAlpha = cell.fmr === "F" ? 0.95 : (cell.fmr === "M" ? 0.85 : 0.72);
        c.fillRect(rc.x, rc.y, rc.w, rc.h);
        c.restore();

        // 內高光與內陰影（層次感）
        c.strokeStyle = cell.fmr === "F" ? "rgba(255,255,255,0.38)" : (cell.fmr === "M" ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)");
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(rc.x + 1, rc.y + 1);
        c.lineTo(rc.x + rc.w - 1, rc.y + 1);
        c.stroke();

        c.strokeStyle = "rgba(0,0,0,0.45)";
        c.beginPath();
        c.moveTo(rc.x + 1, rc.y + rc.h - 1);
        c.lineTo(rc.x + rc.w - 1, rc.y + rc.h - 1);
        c.stroke();

        c.strokeStyle = cell.fmr === "R" ? V.line : V.line2;
        c.strokeRect(rc.x, rc.y, rc.w, rc.h);

        // 格內文字（非 compact 時兩行：上行料號末三碼，下行 F·頻率；compact 維持單字母）
        var txtCol = cell.fmr === "F" ? V.bg : (cell.fmr === "M" ? V.ink : V.dim);
        var fc = compact ? F(11) : Math.max(K.infoFont(w), F(11));
        if (compact || rc.h < fc * 2.2 + 4) {
          text(c, compact ? cell.fmr : (cell.sku ? cell.sku.slice(-3) : cell.fmr), rc.cx, rc.cy, fc, txtCol, "center", "700");
        } else {
          var skuTail = cell.sku ? cell.sku.slice(-3) : "";
          text(c, skuTail, rc.cx, rc.cy - fc * 0.55, fc, txtCol, "center", "700");
          text(c, cell.fmr + "·" + cell.freq, rc.cx, rc.cy + fc * 0.6, fc, txtCol, "center", "600");
        }

        // 錯放格：紅色閃框
        if (cell.misplaced) {
          c.save();
          c.shadowBlur = 8 + 4 * pulse;
          c.shadowColor = "rgba(244,63,94,0.8)";
          c.strokeStyle = mix("#ef4444", "#fca5a5", pulse);
          c.lineWidth = compact ? 2 : 2.6;
          c.strokeRect(rc.x - 1, rc.y - 1, rc.w + 2, rc.h + 2);
          c.restore();

          c.fillStyle = pulse > 0.45 ? "#ef4444" : "#b91c1c";
          if (compact) {
            /* S12：320 寬列距不足 → 徽章改格內右上角標（不再壓上一列） */
            var tagS = Math.max(8, Math.min(11, rc.h * 0.45));
            c.fillRect(rc.x + rc.w - tagS, rc.y, tagS, tagS);
            text(c, "錯", rc.x + rc.w - tagS / 2, rc.y + tagS / 2 + 0.5, Math.max(6, tagS - 3), "#ffffff", "center", "700");
          } else {
            var badgeH = 15, badgeW = Math.min(rc.w, 42);
            c.fillRect(rc.cx - badgeW / 2, rc.y - badgeH + 3, badgeW, badgeH);
            text(c, "錯放", rc.cx, rc.y - badgeH / 2 + 3.5, F(11), "#ffffff", "center", "700");
          }
        }

        hitCells.push({
          x: rc.x, y: rc.y, w: rc.w, h: rc.h,
          tip: cell.wh + "-R" + cell.row + "-C" + cell.col + "｜" + cell.fullName + "｜" + cell.fmr + "類 頻率:" + cell.freq + (cell.misplaced ? "｜⚠ 遠區錯放，建議移至黃金儲位" : (cell.golden ? "｜★ 黃金儲位" : ""))
        });
      });

      // 4. 黃金儲位區外框
      var gTopLeft = cellRect(2, 1), gBotRight = cellRect(1, 8);
      var gx = gTopLeft.x - 4, gy = gTopLeft.y - 4;
      var gw = (gBotRight.x + gBotRight.w) - gTopLeft.x + 8;
      var gh = (gBotRight.y + gBotRight.h) - gTopLeft.y + 8;
      c.strokeStyle = V.acc3;
      c.lineWidth = 1.5;
      c.setLineDash([5, 3]);
      c.strokeRect(gx, gy, gw, gh);
      c.setLineDash([]);
      c.font = "700 " + F(11) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      var gLab = "★ 黃金儲位區 (R1–R2)", gLw = c.measureText(gLab).width + 10, gLh = F(11) + 4;
      c.fillStyle = V.pane; K.roundRect(c, gx + 4, gy - gLh / 2, gLw, gLh, 3); c.fill();
      c.strokeStyle = V.acc3; c.lineWidth = 1; K.roundRect(c, gx + 4.5, gy - gLh / 2 + 0.5, gLw - 1, gLh - 1, 3); c.stroke();
      text(c, gLab, gx + 9, gy + 0.5, F(11), V.acc3, "left", "700");

      // 左側列標示
      for (var r = 1; r <= 6; r++) {
        var rRect = cellRect(r, 1);
        text(c, "R" + r, ML - 8, rRect.cy, F(11), r <= 2 ? V.acc3 : DIM, "right", r <= 2 ? "700" : "");
      }

      // 5. 錯放格指向黃金儲位之虛線建議箭頭
      cells.forEach(function (cell) {
        if (!cell.misplaced) return;
        var tgt = goldenTargets[cell.row + "-" + cell.col];
        if (!tgt) return;
        var srcR = cellRect(cell.row, cell.col);
        var dstR = cellRect(tgt.row, tgt.col);
        var ctrlX = (srcR.cx < aisleX) ? (aisleX - aisleW * 0.25) : (aisleX + aisleW * 0.25);
        var ctrlY = (srcR.cy + dstR.cy) * 0.5;

        c.save();
        c.strokeStyle = "rgba(244,63,94,0.88)";
        c.lineWidth = 1.8;
        c.setLineDash([5, 4]);
        c.lineDashOffset = -(t * 2.2);
        var sgn = dstR.cx > ctrlX ? 1 : -1, tipX = dstR.cx - sgn * dstR.w * 0.28, tipY = dstR.cy;
        var route = [[srcR.cx + (srcR.cx < ctrlX ? 1 : -1) * srcR.w * 0.28, srcR.cy], [ctrlX, srcR.cy], [ctrlX, dstR.cy], [tipX, tipY]];
        K.orthPath(c, route, 6);
        c.setLineDash([]);
        c.lineDashOffset = 0;
        K.kvPort(c, route[0][0], route[0][1], true);
        var ang = sgn > 0 ? 0 : Math.PI;
        c.fillStyle = "#fb7185";
        c.beginPath();
        c.moveTo(tipX, tipY);
        c.lineTo(tipX - 8 * Math.cos(ang - 0.45), tipY - 8 * Math.sin(ang - 0.45));
        c.lineTo(tipX - 8 * Math.cos(ang + 0.45), tipY - 8 * Math.sin(ang + 0.45));
        c.closePath();
        c.fill();
        c.restore();
      });

      // 6. 揀貨粒子（放大＋確定性拖尾，嚴禁狀態累加）
      function posAt(pt, rc, uVal) {
        if (uVal < 0.45) {
          return [lerp(rc.cx, aisleX + (pt.cell.col <= 4 ? -4 : 4), uVal / 0.45), rc.cy];
        }
        return [aisleX + (pt.cell.col <= 4 ? -4 : 4), lerp(rc.cy, dockY, (uVal - 0.45) / 0.55)];
      }
      particles.forEach(function (pt) {
        var rc = cellRect(pt.cell.row, pt.cell.col);
        var u = (t * pt.speed + pt.phase) % 1;
        var pCol = pt.cell.fmr === "F" ? V.acc3 : (pt.cell.fmr === "M" ? V.acc2 : V.dim);
        var baseR = pt.cell.fmr === "F" ? (compact ? 2.8 : 4.2) : (pt.cell.fmr === "M" ? (compact ? 2.2 : 3.2) : (compact ? 1.8 : 2.4));

        // 4 段拖尾（不跨回頭邊界）
        for (var k = 4; k >= 1; k--) {
          var uTrail = u - k * 0.015;
          if (uTrail < 0) continue;
          var tp = posAt(pt, rc, uTrail);
          c.fillStyle = pCol;
          c.globalAlpha = (5 - k) * 0.14;
          c.beginPath();
          c.arc(tp[0], tp[1], Math.max(1, baseR * (1 - k * 0.16)), 0, 6.2832);
          c.fill();
        }
        c.globalAlpha = 1;

        var hp = posAt(pt, rc, u);
        c.fillStyle = pCol;
        c.beginPath();
        c.arc(hp[0], hp[1], baseR, 0, 6.2832);
        c.fill();
        c.fillStyle = "#ffffff";
        c.beginPath();
        c.arc(hp[0], hp[1], Math.max(1, baseR * 0.42), 0, 6.2832);
        c.fill();
      });

      // 7. 底部出貨口 (Shipping Dock)
      c.save();
      c.shadowBlur = 10 + 8 * dockPulse;
      c.shadowColor = "rgba(16,185,129,0.7)";
      c.fillStyle = K.mix(V.acc, V.acc3, dockPulse);
      c.fillRect(dockX, dockY, dockW, dockH);
      c.restore();
      text(c, "▼ 出貨口 (SHIPPING DOCK)", aisleX, dockY + dockH / 2 + 0.5, F(11), V.bg, "center", "700");

      drawSimBadge(c, w, 14, compact);
      return "T+" + Math.round(t) + "f";
    }, { fps: o.fps || 18, onTick: o.onTick, loop: o.loop });
  }

  /* =========================================================================
   * #38 invPareto — 柏拉圖 ABC 累積曲線
   * 120 SKU 依年消耗金額降冪長條 + 累積百分比折線（終點=100%）；
   * 80%/95% 截斷線與 A/B/C 分色；動畫依序長出，越過截斷線時該線閃一下。
   * ========================================================================= */
  function invPareto(cv, d, opt) {
    var o = opt || {};
    var inv = resolveInvData(d);
    var skus = (inv.skus && inv.skus.length) ? inv.skus.slice() : [];
    var items = skus.map(function (sk) {
      var ann = sk.annual_usage_value || (sk.daily_usage * 365 * sk.unit_price) || 1;
      return { sku: sk, ann: ann };
    }).sort(function (a, b) { return b.ann - a.ann; });

    var totalAnn = items.reduce(function (acc, it) { return acc + it.ann; }, 0) || 1;
    var cum = 0, idx80 = items.length - 1, idx95 = items.length - 1, found80 = false, found95 = false;
    items.forEach(function (it, idx) {
      cum += it.ann;
      it.pct = (it.ann / totalAnn) * 100;
      it.cumPct = (cum / totalAnn) * 100;
      if (!found80 && it.cumPct >= 80) { idx80 = idx; found80 = true; }
      if (!found95 && it.cumPct >= 95) { idx95 = idx; found95 = true; }
      it.tier = (it.sku.abc === "A" || it.sku.abc === "B" || it.sku.abc === "C")
        ? it.sku.abc
        : (idx <= idx80 ? "A" : (idx <= idx95 ? "B" : "C"));
    });
    if (items.length) items[items.length - 1].cumPct = 100.0;

    var hitBars = [];
    bindHover(cv, function (x, y) {
      for (var i = 0; i < hitBars.length; i++) {
        var r = hitBars[i];
        if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.tip;
      }
      return "INV 02 · 柏拉圖 ABC 累積曲線（120 SKU 年消耗金額降冪，模擬資料）";
    });

    /* §6.7（2026-11-16 S11）：A/B/C 改主題單色階（亮→暗）、累積線改亮墨＋熱封包尖端、截斷線埠點；建立後 seek 50% 當代表幀（縮圖不再空白） */
    var TX = g.A23Tex, K = TX.kit(TX.theme("#38bdf8")), V = K.V;
    var nFrames = 120;
    var N = Math.max(1, items.length);
    var t80 = (idx80 / N * 0.85 + 0.08) * (nFrames - 1);
    var t95 = (idx95 / N * 0.85 + 0.08) * (nFrames - 1);

    var ctl = driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420 || h < 250;
      var F = function (sz) { return fsz(w, compact, sz); };
      var prog = t / (nFrames - 1);

      c.font = "700 " + F(13) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      var headTitle = fitText(c, o.title || "INV 02 · 柏拉圖 ABC 價值集中度", w - (w >= 560 || !compact ? 86 : 64));
      text(c, headTitle, 10, 14, F(13), FG, "left", "700");

      var legY = compact ? 28 : 32;
      c.font = F(11) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      text(c, fitText(c, "■ A類(前80%)  ■ B類(80–95%)  ■ C類(95–100%)  — 累積%", w - 20), 10, legY, F(11), DIM, "left");

      var ML = compact ? 44 : 58, MR = compact ? 38 : 48;
      var MT = compact ? 42 : 52, MB = compact ? 28 : 34;
      var W = Math.max(60, w - ML - MR), H = Math.max(50, h - MT - MB);
      var maxAnn = items.length ? items[0].ann : 1;

      // 水平格線與雙 Y 軸刻度
      c.strokeStyle = V.line;
      c.lineWidth = 1;
      for (var g = 0; g <= 5; g++) {
        var pctVal = g * 20;
        var gy = MT + H - (pctVal / 100) * H;
        c.beginPath();
        c.moveTo(ML, gy);
        c.lineTo(ML + W, gy);
        c.stroke();
        text(c, pctVal + "%", ML + W + 6, gy, F(11), DIM, "left");
        var leftVal = (maxAnn * (pctVal / 100)) / 10000;
        text(c, Math.round(leftVal) + "萬", ML - 6, gy, F(11), DIM, "right");
      }

      // 80% / 95% 截斷線（越過時閃爍）
      var flash80 = Math.exp(-Math.pow((t - t80) / 3.6, 2));
      var flash95 = Math.exp(-Math.pow((t - t95) / 3.6, 2));

      function drawCutoff(pctCut, color, flash, lbl) {
        var cy = MT + H - (pctCut / 100) * H;
        c.save();
        c.setLineDash([6, 4]);
        if (flash > 0.05) {
          c.strokeStyle = color;
          c.lineWidth = 6 * flash;
          c.globalAlpha = 0.28 * flash;
          c.beginPath();
          c.moveTo(ML, cy);
          c.lineTo(ML + W, cy);
          c.stroke();

          c.strokeStyle = "#ffffff";
          c.lineWidth = 2 + 1.5 * flash;
          c.globalAlpha = 0.5 + 0.5 * flash;
        } else {
          c.strokeStyle = color;
          c.lineWidth = 1.4;
          c.globalAlpha = 0.78;
        }
        c.beginPath();
        c.moveTo(ML, cy);
        c.lineTo(ML + W, cy);
        c.stroke();
        c.setLineDash([]);
        c.restore();
        text(c, lbl + (flash > 0.35 ? " ⚡" : ""), ML + 6, cy - (compact ? 7 : 9), F(11), flash > 0.35 ? "#ffffff" : color, "left", "700");
      }

      // 長條依序長出
      var stepW = W / N;
      var bw = Math.max(1.2, stepW - (stepW > 4 ? 1 : 0));
      var pts = [];
      var lastCum = 0, lastIdx = 0;
      hitBars = [];

      for (var i = 0; i < N; i++) {
        var it = items[i];
        var startP = (i / N) * 0.85;
        var gRaw = Math.max(0, Math.min(1, (prog - startP) / 0.15));
        var gVal = ease(gRaw);
        var bx = ML + i * stepW;
        var fullH = (it.ann / maxAnn) * H;
        var bh = fullH * gVal;
        var bCol = it.tier === "A" ? V.acc2 : (it.tier === "B" ? K.mix(V.deep, V.acc, 0.45) : K.mix(V.pane, V.deep, 0.8));

        if (bh > 0.3) {
          c.fillStyle = bCol;
          c.globalAlpha = 0.86;
          c.fillRect(bx, MT + H - bh, bw, bh);
          c.globalAlpha = 1;
        }

        if (gRaw > 0.02) {
          var px = bx + bw * 0.5;
          var py = MT + H - (it.cumPct / 100) * H;
          pts.push([px, py, it.cumPct]);
          lastCum = it.cumPct;
          lastIdx = i;
        }

        hitBars.push({
          x: bx, y: MT, w: Math.max(4, stepW), h: H,
          tip: "#" + (i + 1) + " " + it.sku.name + " [" + it.tier + "類]｜年消耗:" + Math.round(it.ann / 10000) + "萬 (" + it.pct.toFixed(1) + "%)｜累積:" + it.cumPct.toFixed(1) + "%"
        });
      }

      drawCutoff(80, V.acc3, flash80, "80% A/B界線 (#" + (idx80 + 1) + ")");
      drawCutoff(95, V.acc2, flash95, "95% B/C界線 (#" + (idx95 + 1) + ")");
      K.kvPort(c, ML, MT + H * 0.2, flash80 > 0.35 || prog * 120 > t80); K.kvPort(c, ML, MT + H * 0.05, flash95 > 0.35 || prog * 120 > t95);

      // 累積百分比折線
      if (pts.length > 1) {
        c.strokeStyle = V.ink;
        c.lineWidth = compact ? 1.6 : 2;
        c.beginPath();
        pts.forEach(function (pt, pi) {
          if (pi === 0) c.moveTo(pt[0], pt[1]);
          else c.lineTo(pt[0], pt[1]);
        });
        c.stroke();

        var tipPt = pts[pts.length - 1];
        K.hotPacket(c, pts.slice(-12).map(function (pq) { return [pq[0], pq[1]]; }), 1, V.acc3, compact ? 2.6 : 3.4);

        var cumTxt = "累積 " + (prog >= 0.999 ? "100.0" : lastCum.toFixed(1)) + "%";
        text(c, cumTxt, Math.min(ML + W - 46, tipPt[0] + 6), (tipPt[1] < MT + H * 0.3 ? tipPt[1] + 16 : Math.max(MT + 10, tipPt[1] - 12)), Math.max(F(11), K.infoFont(w)), V.acc3, "left", "700");
      }

      // X 軸標籤
      text(c, "SKU #1", ML, MT + H + 14, F(11), DIM, "left");
      text(c, "A:" + (idx80 + 1) + " / B:" + (idx95 - idx80) + " / C:" + (N - idx95 - 1) + " (共" + N + "料)", ML + W * 0.5, MT + H + 14, F(11), FG, "center");
      text(c, "#" + N, ML + W, MT + H + 14, F(11), DIM, "right");

      drawSimBadge(c, w, 14, compact);
      return (lastIdx + 1) + " / " + N;
    }, { fps: o.fps || 24, onTick: o.onTick, loop: o.loop });
    ctl.seek(Math.round((nFrames - 1) * 0.5));
    return ctl;
  }

  /* =========================================================================
   * #39 invAbcXyz — ABC×XYZ 九宮格策略矩陣
   * 3×3 格顯示 SKU 數與庫存金額佔比，底色對應金額；格內散點 X=CV、大小=庫存金額；
   * 動畫逐月推進，點跨格移動並留短軌跡；每格角落標建議策略。
   * ========================================================================= */
  function invAbcXyz(cv, d, opt) {
    var o = opt || {};
    var inv = resolveInvData(d);
    var skus = (inv.skus && inv.skus.length) ? inv.skus : [];
    var months = (inv.months && inv.months.length) ? inv.months : ["2026-01", "2026-02", "2026-03", "2026-04"];
    var nFrames = months.length;

    var STRATEGY = {
      AX: "JIT連續補貨", AY: "動態ROP滾動", AZ: "預測+安全時",
      BX: "定期定量補", BY: "雙箱週期檢", BZ: "緩衝+交期控",
      CX: "低頻自動補", CY: "合併採購降本", CZ: "MTO接單才買"
    };

    function xyzFromCv(cvVal) {
      return cvVal < 0.25 ? 0 : (cvVal < 0.55 ? 1 : 2);
    }
    function cvNormX(cvVal) {
      if (cvVal < 0.25) return Math.max(0.06, Math.min(0.94, cvVal / 0.25)) / 3;
      if (cvVal < 0.55) return (1 + Math.max(0.06, Math.min(0.94, (cvVal - 0.25) / 0.30))) / 3;
      return (2 + Math.max(0.06, Math.min(0.94, (cvVal - 0.55) / 0.55))) / 3;
    }
    function skuStateAt(sk, idx, tVal) {
      var k = Math.max(0, Math.min(nFrames - 1, Math.floor(tVal)));
      var k2 = Math.min(nFrames - 1, k + 1);
      var u = ease(Math.max(0, Math.min(1, tVal - k)));
      var cvs = sk.monthly_cv || [sk.cv || 0.3];
      var vals = sk.monthly_inv_value || [sk.inv_value || 10000];
      var c0 = cvs[k % cvs.length], c1 = cvs[k2 % cvs.length];
      var v0 = vals[k % vals.length], v1 = vals[k2 % vals.length];
      var cvNow = lerp(c0, c1, u);
      var valNow = lerp(v0, v1, u);
      var rowI = sk.abc === "A" ? 0 : (sk.abc === "B" ? 1 : 2);
      var colI = xyzFromCv(cvNow);
      var yNorm = (rowI + 0.24 + 0.52 * (((idx * 37 + 13) % 100) / 100)) / 3;
      var xNorm = cvNormX(cvNow);
      return { cv: cvNow, val: valNow, row: rowI, col: colI, xNorm: xNorm, yNorm: yNorm };
    }

    var hitDots = [];
    bindHover(cv, function (x, y) {
      for (var i = hitDots.length - 1; i >= 0; i--) {
        var r = hitDots[i];
        var dx = x - r.x, dy = y - r.y;
        if (dx * dx + dy * dy <= (r.r + 4) * (r.r + 4)) return r.tip;
      }
      return "INV 03 · ABC×XYZ 九宮格策略矩陣（X=需求變異 CV，大小=庫存金額，模擬資料）";
    });

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420 || h < 260;
      var F = function (sz) { return fsz(w, compact, sz); };
      var kCur = Math.max(0, Math.min(nFrames - 1, Math.floor(t + 0.5)));
      var mLabel = months[kCur] || "";

      c.font = "700 " + F(13) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      text(c, fitText(c, (o.title || "INV 03 · ABC×XYZ 策略九宮格") + " · " + mLabel, w - (w >= 560 || !compact ? 86 : 64)), 10, 14, F(13), FG, "left", "700");

      var ML = compact ? 34 : 52, MR = compact ? 12 : 18;
      var MT = compact ? 42 : 54, MB = compact ? 22 : 28;
      var W = Math.max(90, w - ML - MR), H = Math.max(90, h - MT - MB);
      var cw = W / 3, ch = H / 3;

      var states = skus.map(function (sk, idx) { return skuStateAt(sk, idx, t); });
      var counts = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      var vals = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      var totVal = 0, maxCellVal = 1;

      states.forEach(function (st) {
        counts[st.row][st.col] += 1;
        vals[st.row][st.col] += st.val;
        totVal += st.val;
      });
      totVal = totVal || 1;
      for (var rr = 0; rr < 3; rr++) {
        for (var cc = 0; cc < 3; cc++) maxCellVal = Math.max(maxCellVal, vals[rr][cc]);
      }

      var abcRows = ["A類(高價)", "B類(中價)", "C類(低價)"];
      var xyzCols = ["X 穩定 (CV<0.25)", "Y 波動 (0.25–0.55)", "Z 劇烈 (CV≥0.55)"];
      var abcShort = ["A", "B", "C"], xyzShort = ["X", "Y", "Z"];

      for (var cIdx = 0; cIdx < 3; cIdx++) {
        text(c, compact ? xyzShort[cIdx] : xyzCols[cIdx], ML + cw * (cIdx + 0.5), MT - (compact ? 10 : 13), F(11), DIM, "center", "700");
      }
      for (var rIdx = 0; rIdx < 3; rIdx++) {
        text(c, compact ? abcShort[rIdx] : abcRows[rIdx].slice(0, 2), ML - 8, MT + ch * (rIdx + 0.5), F(11), DIM, "right", "700");
      }

      // 繪製 3×3 格子（底色深淺對應金額佔比）
      for (var r = 0; r < 3; r++) {
        for (var cl = 0; cl < 3; cl++) {
          var gx = ML + cl * cw, gy = MT + r * ch;
          var share = vals[r][cl] / totVal;
          var intensity = Math.max(0.08, Math.min(0.85, (vals[r][cl] / maxCellVal) * 0.78 + 0.08));
          c.fillStyle = mix("#0f172a", r === 0 ? "#0369a1" : (r === 1 ? "#b45309" : "#047857"), intensity);
          c.fillRect(gx + 1, gy + 1, cw - 2, ch - 2);
          c.strokeStyle = "#334155";
          c.lineWidth = 1;
          c.strokeRect(gx + 1, gy + 1, cw - 2, ch - 2);

          var code = abcShort[r] + xyzShort[cl];
          var hdrTxt = compact ? (code + " " + counts[r][cl]) : (code + " · " + counts[r][cl] + "顆 (" + (share * 100).toFixed(1) + "%)");
          text(c, hdrTxt, gx + 6, gy + (compact ? 9 : 12), F(11), "#f8fafc", "left", "700");
          text(c, STRATEGY[code], gx + cw - 6, gy + ch - (compact ? 9 : 11), F(11), "#cbd5e1", "right");
        }
      }

      // 繪製散點＋短軌跡（確定性由 t-0.25, t-0.5 計算）
      hitDots = [];
      skus.forEach(function (sk, idx) {
        var st = states[idx];
        var dCol = st.row === 0 ? "#38bdf8" : (st.row === 1 ? "#facc15" : "#34d399");
        var rad = Math.max(compact ? 2.2 : 3.0, Math.min(compact ? 6.5 : 9.5, Math.sqrt(st.val / 15000) * 1.4));

        for (var k = 3; k >= 1; k--) {
          var tPrev = Math.max(0, t - k * 0.22);
          var sp = skuStateAt(sk, idx, tPrev);
          c.fillStyle = dCol;
          c.globalAlpha = (4 - k) * 0.14;
          c.beginPath();
          c.arc(ML + sp.xNorm * W, MT + sp.yNorm * H, Math.max(1.5, rad * (1 - k * 0.16)), 0, 6.2832);
          c.fill();
        }
        c.globalAlpha = 0.88;
        var px = ML + st.xNorm * W, py = MT + st.yNorm * H;
        c.fillStyle = dCol;
        c.beginPath();
        c.arc(px, py, rad, 0, 6.2832);
        c.fill();
        c.globalAlpha = 1;
        c.strokeStyle = "#0b1220";
        c.lineWidth = 1;
        c.stroke();

        hitDots.push({
          x: px, y: py, r: rad,
          tip: sk.name + " [" + abcShort[st.row] + xyzShort[st.col] + "]｜CV=" + st.cv.toFixed(2) + "｜庫存金額:" + Math.round(st.val / 1000) + "K｜策略:" + STRATEGY[abcShort[st.row] + xyzShort[st.col]]
        });
      });

      text(c, "總SKU=" + skus.length + " (9格合計=" + counts.flat().reduce(function (a, b) { return a + b; }, 0) + ") · X軸=需求變異 CV", ML, h - 10, F(11), DIM, "left");
      drawSimBadge(c, w, 14, compact);
      return mLabel;
    }, { fps: o.fps || 1.2, onTick: o.onTick, loop: o.loop });
  }

  /* =========================================================================
   * #42 invTradeoff — What-If 服務水準取捨曲線
   * X=服務水準 (90%–99.9%)，雙軸畫「庫存持有成本」與「缺貨風險」及交會建議區；
   * 游標沿 X 來回掃並顯示「釋放資金／增加缺貨率」；opt.serviceLevel 可固定游標。
   * ========================================================================= */
  function invTradeoff(cv, d, opt) {
    var o = opt || {};
    var fixedSL = (typeof o.serviceLevel === "number") ? Math.max(90, Math.min(99.9, o.serviceLevel)) : null;
    var inv = resolveInvData(d);
    var skus = (inv.skus && inv.skus.length) ? inv.skus : [];
    var totalValWan = Math.max(400, skus.reduce(function (a, s) { return a + (s.inv_value || 0); }, 0) / 10000);

    // 服務水準 -> Z 分位數近似
    function zScore(slPct) {
      var p = Math.max(0.5, Math.min(0.9995, slPct / 100));
      var t = Math.sqrt(-2 * Math.log(1 - p));
      var c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
      var d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
      return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
    }

    var BASE_SL = 95.0;
    var baseZ = zScore(BASE_SL);
    function holdCostAt(slPct) {
      // 持有成本（萬元）：隨 Z 線性成長＋高水位非線性倉儲溢價
      var z = zScore(slPct);
      return totalValWan * (0.14 + 0.085 * z + 0.018 * Math.max(0, z - 1.6) * Math.max(0, z - 1.6));
    }
    function stockoutRiskAt(slPct) {
      // 缺貨風險率 (%) 與換算缺貨衝擊
      return Math.max(0.1, 100 - slPct);
    }

    var ptsN = 100;
    var curve = [];
    var minHC = 1e9, maxHC = -1e9;
    for (var i = 0; i < ptsN; i++) {
      var sl = 90 + (9.9 * i) / (ptsN - 1);
      var hc = holdCostAt(sl);
      var sr = stockoutRiskAt(sl);
      minHC = Math.min(minHC, hc);
      maxHC = Math.max(maxHC, hc);
      curve.push({ sl: sl, hc: hc, sr: sr });
    }
    var baseHC = holdCostAt(BASE_SL);
    var baseSR = stockoutRiskAt(BASE_SL);
    var nFrames = 120;

    var ctlRef = null;
    var drawFn = function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420 || h < 250;
      var F = function (sz) { return fsz(w, compact, sz); };

      var curSL = fixedSL !== null
        ? fixedSL
        : (90 + 9.9 * (0.5 - 0.5 * Math.cos((t / (nFrames - 1)) * Math.PI * 2)));

      c.font = "700 " + F(13) + "px 'Microsoft JhengHei',system-ui,sans-serif";
      text(c, fitText(c, o.title || "INV 06 · What-If 服務水準取捨曲線", w - (w >= 560 || !compact ? 86 : 64)), 10, 14, F(13), FG, "left", "700");

      var ML = compact ? 48 : 62, MR = compact ? 42 : 56;
      var MT = compact ? 42 : 52, MB = compact ? 28 : 34;
      var W = Math.max(70, w - ML - MR), H = Math.max(60, h - MT - MB);

      function sx(slVal) { return ML + ((slVal - 90) / 9.9) * W; }
      function syHC(hcVal) { return MT + H - ((hcVal - minHC * 0.92) / (maxHC * 1.06 - minHC * 0.92)) * H; }
      function sySR(srVal) { return MT + H - (srVal / 10.5) * H; }

      // 建議交會區帶 (95.5% - 97.5%)
      var zx0 = sx(95.5), zx1 = sx(97.5);
      c.fillStyle = "rgba(16,185,129,0.16)";
      c.fillRect(zx0, MT, zx1 - zx0, H);
      c.strokeStyle = "rgba(16,185,129,0.5)";
      c.setLineDash([3, 3]);
      c.strokeRect(zx0, MT, zx1 - zx0, H);
      c.setLineDash([]);
      text(c, "建議區", (zx0 + zx1) / 2, MT + 12, F(11), "#34d399", "center", "700");

      // 水平格線與雙軸刻度
      c.strokeStyle = "#1e293b";
      c.lineWidth = 1;
      for (var g = 0; g <= 4; g++) {
        var gy = MT + (H * g) / 4;
        c.beginPath();
        c.moveTo(ML, gy);
        c.lineTo(ML + W, gy);
        c.stroke();
        var hcTick = lerp(maxHC * 1.06, minHC * 0.92, g / 4);
        var srTick = lerp(10.5, 0, g / 4);
        text(c, Math.round(hcTick) + "萬", ML - 6, gy, F(11), "#38bdf8", "right");
        text(c, srTick.toFixed(1) + "%", ML + W + 6, gy, F(11), "#f43f5e", "left");
      }

      // X 軸刻度
      [90, 92.5, 95, 97.5, 99.9].forEach(function (xv) {
        text(c, xv + "%", sx(xv), MT + H + 14, F(11), xv === 95 ? "#facc15" : DIM, "center");
      });

      // 持有成本曲線 (天藍)
      c.strokeStyle = "#38bdf8";
      c.lineWidth = 2.6;
      c.beginPath();
      curve.forEach(function (pt, i) {
        var px = sx(pt.sl), py = syHC(pt.hc);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.stroke();

      // 缺貨風險曲線 (玫紅)
      c.strokeStyle = "#f43f5e";
      c.lineWidth = 2.6;
      c.beginPath();
      curve.forEach(function (pt, i) {
        var px = sx(pt.sl), py = sySR(pt.sr);
        if (i === 0) c.moveTo(px, py);
        else c.lineTo(px, py);
      });
      c.stroke();

      // 圖例
      text(c, "— 庫存持有成本 (左軸)", ML, MT - 12, F(11), "#38bdf8", "left", "700");
      text(c, "— 缺貨風險率 (右軸)", ML + W, MT - 12, F(11), "#f43f5e", "right", "700");

      // 游標與即時試算卡片
      var curHC = holdCostAt(curSL), curSR = stockoutRiskAt(curSL);
      var releaseCash = baseHC - curHC; // >0 表示釋放資金，<0 表示需增資
      var deltaRisk = curSR - baseSR;   // >0 表示增加缺貨率
      var cx = sx(curSL), cyHC = syHC(curHC), cySR = sySR(curSR);

      c.strokeStyle = "#facc15";
      c.lineWidth = 1.6;
      c.setLineDash([4, 3]);
      c.beginPath();
      c.moveTo(cx, MT);
      c.lineTo(cx, MT + H);
      c.stroke();
      c.setLineDash([]);

      c.fillStyle = "#38bdf8"; c.beginPath(); c.arc(cx, cyHC, 5, 0, 6.2832); c.fill();
      c.fillStyle = "#f43f5e"; c.beginPath(); c.arc(cx, cySR, 5, 0, 6.2832); c.fill();

      var cardW = compact ? 148 : 196, cardH = compact ? 58 : 70;
      var cardX = cx + 10 + cardW > ML + W ? cx - cardW - 10 : cx + 10;
      var cardY = MT + 24;
      c.fillStyle = "rgba(11,18,32,0.92)";
      c.strokeStyle = "#facc15";
      c.lineWidth = 1.2;
      c.fillRect(cardX, cardY, cardW, cardH);
      c.strokeRect(cardX, cardY, cardW, cardH);

      var cashTxt = "釋放資金: " + (releaseCash >= 0 ? "+" : "") + Math.round(releaseCash) + "萬";
      var riskTxt = "增加缺貨率: " + (deltaRisk >= 0 ? "+" : "") + deltaRisk.toFixed(1) + "%";
      text(c, "SL = " + curSL.toFixed(1) + "% (基準95%)", cardX + 8, cardY + 13, F(11), "#facc15", "left", "700");
      text(c, cashTxt, cardX + 8, cardY + (compact ? 30 : 35), F(11), releaseCash >= 0 ? "#10b981" : "#f59e0b", "left", "700");
      text(c, riskTxt, cardX + 8, cardY + (compact ? 47 : 56), F(11), deltaRisk > 0 ? "#fb7185" : "#34d399", "left", "700");

      drawSimBadge(c, w, 14, compact);
      return "SL " + curSL.toFixed(1) + "%";
    };

    ctlRef = driver(nFrames, drawFn, { fps: o.fps || 20, onTick: o.onTick, loop: o.loop });
    ctlRef.setServiceLevel = function (slVal) {
      fixedSL = (typeof slVal === "number") ? Math.max(90, Math.min(99.9, slVal)) : null;
      ctlRef.redraw();
    };
    return ctlRef;
  }

  A23.invCccBar = invCccBar;
  A23.invPareto = invPareto;
  A23.invAbcXyz = invAbcXyz;
  A23.invBulletWall = invBulletWall;
  A23.invWarehouseHeat = invWarehouseHeat;
  A23.invTradeoff = invTradeoff;
  g.A23Charts = A23;
})(window);
