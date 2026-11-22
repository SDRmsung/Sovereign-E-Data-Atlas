/* A23 Charts — Stanford Discovery 缺口補齊組件 (#43 corticalTorus3D / #44 dagPipeline / #45 dumbbellPlot / #46 marimekkoStrip)
 * 載入順序：在 a23_charts.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（固定 LCG 種子、零 Math.random、零 Date.now、零閉包累加狀態）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var BG = "#070b12", FG = "#e2e8f0", DIM = "#94a3b8", MUTED = "#64748b";

  function lerp(a, b, u) { return a + (b - a) * u; }

  function fit(cv) {
    var d = g.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    var w = +cv.dataset.w || Math.max(1, Math.round(r.width));
    var h = +cv.dataset.h || Math.max(1, Math.round(r.height));
    if (cv.__w !== w || cv.__h !== h) {
      cv.width = w * d; cv.height = h * d; cv.__w = w; cv.__h = h;
    }
    var c = cv.getContext("2d");
    c.setTransform(d, 0, 0, d, 0, 0);
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

  function text(c, s, x, y, size, color, align, weight) {
    c.font = (weight ? weight + " " : "") + size + "px ui-monospace, SFMono-Regular, Menlo, 'Microsoft JhengHei', monospace";
    c.fillStyle = color || FG;
    c.textAlign = align || "left";
    c.textBaseline = "middle";
    c.fillText(s, x, y);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  /* #43 3D 腦皮層／C 型環面邊捆綁網路 (3D Cortical C-Torus Edge-Bundled Graph) */
  function corticalTorus3D(cv, _data, opt) {
    var o = opt || {};
    var seed = 42;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }

    var nodes = [], edges = [], pulses = [], N = 480;
    for (var i = 0; i < N; i++) {
      var theta = -Math.PI * 0.78 + rnd() * Math.PI * 1.66;
      var phi = rnd() * Math.PI * 2;
      var R = 122 + 16 * Math.sin(theta * 1.5);
      var rTube = (42 + 14 * Math.cos(theta * 0.9)) * (0.45 + 0.55 * Math.sqrt(rnd()));
      var x = (R + rTube * Math.cos(phi)) * Math.sin(theta) * 0.88;
      var y = (R + rTube * Math.cos(phi)) * Math.cos(theta) * 1.05;
      var z = rTube * Math.sin(phi) * 1.15;
      var isHot = (Math.abs(theta) < 0.42 && y > 58);
      var isInner = (Math.cos(phi) < -0.2);
      var col = isHot ? (rnd() < 0.5 ? "#ffb700" : "#fde047") : (isInner ? "#a78bfa" : (rnd() < 0.65 ? "#7dd3fc" : "#e0f2fe"));
      nodes.push({ x: x, y: y, z: z, theta: theta, col: col, isHot: isHot, sz: isHot ? (1.7 + rnd() * 1.8) : (0.9 + rnd() * 1.2) });
    }
    for (var e = 0; e < 260; e++) {
      var a = Math.floor(rnd() * N), b = Math.floor(rnd() * N);
      var na = nodes[a], nb = nodes[b];
      if (Math.abs(na.theta - nb.theta) < 0.75 || na.isHot || nb.isHot) {
        var hot = (na.isHot || nb.isHot);
        edges.push({ a: a, b: b, hot: hot, col: hot ? "rgba(255,183,0,0.24)" : (rnd() < 0.4 ? "rgba(167,139,250,0.18)" : "rgba(125,211,252,0.18)") });
      }
    }
    for (var p = 0; p < 40; p++) {
      pulses.push({ edgeIdx: Math.floor(rnd() * edges.length), pos: rnd(), speed: 0.25 + rnd() * 0.55 });
    }

    var nFrames = 12;
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var cx = w * 0.5, cy = h * 0.5, scale = Math.min(w, h) / 310;
      var phase = (t / (nFrames - 1)) * Math.PI * 2;
      var rotY = -0.38 + Math.sin(phase) * 0.42, rotX = 0.22;
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY), cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      function proj(x, y, z) {
        var x1 = x * cosY - z * sinY, z1 = x * sinY + z * cosY;
        var y2 = y * cosX - z1 * sinX, z2 = y * sinX + z1 * cosX;
        var persp = 520 / (520 + z2 + 260);
        return { sx: cx + x1 * persp * scale, sy: cy + y2 * persp * scale, p: persp };
      }

      c.strokeStyle = "rgba(30,58,95,0.28)";
      c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, 148 * scale, 0, Math.PI * 2); c.stroke();

      var pr = nodes.map(function (nd) { return proj(nd.x, nd.y, nd.z); });
      c.lineWidth = compact ? 0.6 : 0.85;
      edges.forEach(function (ed) {
        var pa = pr[ed.a], pb = pr[ed.b];
        var mx = (pa.sx + pb.sx) * 0.5 + (cx - (pa.sx + pb.sx) * 0.5) * 0.22;
        var my = (pa.sy + pb.sy) * 0.5 + (cy - (pa.sy + pb.sy) * 0.5) * 0.15;
        c.strokeStyle = ed.col;
        c.beginPath(); c.moveTo(pa.sx, pa.sy); c.quadraticCurveTo(mx, my, pb.sx, pb.sy); c.stroke();
      });

      var hotC = proj(0, 126, 0);
      var grad = c.createRadialGradient(hotC.sx, hotC.sy, 2, hotC.sx, hotC.sy, 68 * scale);
      grad.addColorStop(0, "rgba(255,195,0,0.38)");
      grad.addColorStop(1, "rgba(245,158,11,0)");
      c.fillStyle = grad;
      c.beginPath(); c.arc(hotC.sx, hotC.sy, 68 * scale, 0, Math.PI * 2); c.fill();

      nodes.forEach(function (nd, idx) {
        var pt = pr[idx];
        c.globalAlpha = Math.max(0.2, Math.min(0.95, (pt.p - 0.65) * 2.2));
        c.fillStyle = nd.col;
        c.beginPath(); c.arc(pt.sx, pt.sy, nd.sz * pt.p * (compact ? 0.75 : 1), 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1;

      pulses.forEach(function (pl) {
        var ed = edges[pl.edgeIdx], pa = pr[ed.a], pb = pr[ed.b];
        var u = (pl.pos + (t / (nFrames - 1)) * 2.0 * pl.speed) % 1;
        c.fillStyle = ed.hot ? "#fde047" : "#00f0ff";
        c.beginPath(); c.arc(lerp(pa.sx, pb.sx, u), lerp(pa.sy, pb.sy, u), compact ? 1.5 : 2.1, 0, Math.PI * 2); c.fill();
      });

      if (!compact) {
        text(c, "14K-NODE CORTICAL MANIFOLD // EDGE-BUNDLED 3D TORUS", 14, 16, 11, DIM, "left", "700");
        text(c, "Q=0.842 · HOTSPOT: EXEC_VERIFY", w - 14, 16, 10, "#ffb700", "right");
      }
      return "相位 " + Math.round((t / (nFrames - 1)) * 100) + "%";
    }, o);
  }

  /* #44 雙層有向狀態機膠囊管線圖 (2-Row DAG Capsule Pipeline) */
  function dagPipeline(cv, _data, opt) {
    var o = opt || {};
    var row1 = [
      { id: "system_query", col: "#64748b", fill: "rgba(30,41,59,0.75)" },
      { id: "extract_pipe", col: "#f59e0b", fill: "rgba(245,158,11,0.22)" },
      { id: "select_eval", col: "#38bdf8", fill: "rgba(56,189,248,0.18)" },
      { id: "act_propose", col: "#10b981", fill: "rgba(16,185,129,0.22)" },
      { id: "eval_metric", col: "#ffb700", fill: "rgba(255,183,0,0.26)" },
      { id: "act_verify", col: "#00f0ff", fill: "rgba(0,240,255,0.2)" }
    ];
    var row2 = [
      { id: "parse_ast", col: "#475569", fill: "rgba(15,23,42,0.85)" },
      { id: "cypher_hop", col: "#38bdf8", fill: "rgba(56,189,248,0.16)" },
      { id: "hypo_rank", col: "#a855f7", fill: "rgba(168,85,247,0.18)" },
      { id: "sandbox_run", col: "#10b981", fill: "rgba(16,185,129,0.18)" },
      { id: "reward_bp", col: "#f59e0b", fill: "rgba(245,158,11,0.2)" },
      { id: "commit_node", col: "#38bdf8", fill: "rgba(56,189,248,0.22)" }
    ];
    var nFrames = 12;
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var n = row1.length, padX = compact ? 10 : 28;
      var stepX = (w - padX * 2) / n, boxW = Math.max(32, Math.min(132, stepX - (compact ? 8 : 22)));
      var boxH = compact ? 22 : 34;
      var y1 = h * 0.30 - boxH * 0.5, y2 = h * 0.68 - boxH * 0.5;
      var phase = t / (nFrames - 1);
      var activeIdx = Math.floor(phase * n) % n;

      if (!compact) {
        text(c, "EXECUTION DAG // DUAL-TIER STATE PIPELINE", 14, 18, 11, DIM, "left", "700");
        text(c, "STAGE " + (activeIdx + 1) + " / " + n, w - 14, 18, 10, "#00f0ff", "right");
      }

      for (var i = 0; i < n; i++) {
        var x = padX + i * stepX + (stepX - boxW) * 0.5, cx = x + boxW * 0.5;
        c.strokeStyle = "rgba(56,189,248,0.28)";
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(cx, y1 + boxH); c.lineTo(cx, y2); c.stroke();
        if (i < n - 1) {
          var nx = padX + (i + 1) * stepX + (stepX - boxW) * 0.5;
          c.strokeStyle = "rgba(148,163,184,0.4)";
          c.beginPath(); c.moveTo(x + boxW, y1 + boxH * 0.5); c.lineTo(nx, y1 + boxH * 0.5); c.stroke();
          c.strokeStyle = "rgba(100,116,139,0.35)";
          c.beginPath(); c.moveTo(x + boxW, y2 + boxH * 0.5); c.lineTo(nx, y2 + boxH * 0.5); c.stroke();
          var u = (phase * 3 - i * 0.22) % 1;
          if (u < 0) u += 1;
          c.fillStyle = "#00f0ff";
          c.beginPath(); c.arc(lerp(x + boxW, nx, u), y1 + boxH * 0.5, compact ? 2 : 3, 0, Math.PI * 2); c.fill();
        }
      }

      [row1, row2].forEach(function (row, ri) {
        var yy = ri === 0 ? y1 : y2;
        row.forEach(function (nd, idx) {
          var x = padX + idx * stepX + (stepX - boxW) * 0.5, isHot = (idx === activeIdx);
          roundRect(c, x, yy, boxW, boxH, 5);
          c.fillStyle = nd.fill; c.fill();
          c.lineWidth = isHot ? 1.8 : 1;
          c.strokeStyle = isHot ? "#ffffff" : nd.col; c.stroke();
          if (!compact) text(c, nd.id, x + boxW * 0.5, yy + boxH * 0.5, 10.5, isHot ? "#ffffff" : FG, "center", ri === 0 ? "700" : "400");
        });
      });
      return "Step " + (activeIdx + 1) + "/" + n;
    }, o);
  }

  /* #45 前後對比水平啞鈴游標圖 (Before/After Dumbbell Slider Plot) */
  function dumbbellPlot(cv, _data, opt) {
    var o = opt || {};
    var rows = [
      { metric: "sharpe_ratio", before: 0.34, after: 0.78, delta: "+28.4%", col: "#10b981" },
      { metric: "node_recall", before: 0.42, after: 0.86, delta: "+24.1%", col: "#00f0ff" },
      { metric: "verify_acc", before: 0.51, after: 0.89, delta: "+19.6%", col: "#10b981" },
      { metric: "token_eff", before: 0.28, after: 0.68, delta: "+16.2%", col: "#ffb700" },
      { metric: "latency_p99", before: 0.74, after: 0.32, delta: "-42.0%", col: "#38bdf8" },
      { metric: "drawdown_cap", before: 0.66, after: 0.29, delta: "-31.5%", col: "#f43f5e" }
    ];
    var nFrames = 12;
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var MT = compact ? 14 : 40, MB = compact ? 10 : 28;
      var L = compact ? 52 : 124, R = compact ? 42 : 76, trackW = Math.max(40, w - L - R);
      var rowH = (h - MT - MB) / rows.length;
      var phase = (t / (nFrames - 1)) * Math.PI * 2;

      if (!compact) {
        text(c, "BENCHMARK METRICS // BEFORE (○) vs AFTER (●)", 14, 18, 11, DIM, "left", "700");
        text(c, "DELTA %", w - 14, 18, 10, "#10b981", "right");
      }

      rows.forEach(function (d, i) {
        var cy = MT + i * rowH + rowH * 0.5;
        text(c, compact ? d.metric.slice(0, 7) : d.metric, compact ? 6 : 14, cy, compact ? 8 : 11, DIM, "left");
        c.strokeStyle = "#1e293b"; c.lineWidth = 2;
        c.beginPath(); c.moveTo(L, cy); c.lineTo(L + trackW, cy); c.stroke();

        var bx = L + d.before * trackW;
        var ax = L + Math.max(0.05, Math.min(0.95, d.after + 0.03 * Math.sin(phase + i * 0.9))) * trackW;
        c.strokeStyle = d.col; c.lineWidth = compact ? 2 : 3;
        c.beginPath(); c.moveTo(bx, cy); c.lineTo(ax, cy); c.stroke();

        c.fillStyle = BG; c.strokeStyle = DIM; c.lineWidth = 1.6;
        c.beginPath(); c.arc(bx, cy, compact ? 3.5 : 5.5, 0, Math.PI * 2); c.fill(); c.stroke();

        c.fillStyle = d.col;
        c.beginPath(); c.arc(ax, cy, compact ? 4.2 : 6.5, 0, Math.PI * 2); c.fill();

        text(c, d.delta, w - (compact ? 6 : 14), cy, compact ? 8 : 11, d.col, "right", "700");
      });
      return "Epoch " + (Math.round(t) + 1);
    }, o);
  }

  /* #46 多列不等寬分段狀態條碼 (Multi-Row Marimekko State Strip) */
  function marimekkoStrip(cv, _data, opt) {
    var o = opt || {};
    var rows = [
      [0.24, 0.18, 0.28, 0.16, 0.14],
      [0.15, 0.32, 0.19, 0.22, 0.12],
      [0.30, 0.14, 0.24, 0.18, 0.14],
      [0.18, 0.26, 0.22, 0.20, 0.14],
      [0.21, 0.21, 0.18, 0.25, 0.15]
    ];
    var cols = ["#38bdf8", "#ffb700", "#a855f7", "#10b981", "#f43f5e"];
    var nFrames = 12;
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var MT = compact ? 10 : 42, MB = compact ? 10 : 32, padX = compact ? 8 : 22;
      var availW = w - padX * 2, rowH = (h - MT - MB) / rows.length;
      var phase = (t / (nFrames - 1)) * Math.PI * 2;

      if (!compact) {
        text(c, "LAYER ATTENTION ALLOCATION // MARIMEKKO STATE BARCODE", 14, 18, 11, DIM, "left", "700");
        text(c, "2.48 M TOK/SEC", w - 14, 18, 11, "#ffb700", "right", "700");
      }

      for (var r = 0; r < rows.length; r++) {
        var y = MT + r * rowH + 3, bh = Math.max(6, rowH - 6);
        var segs = rows[r], weights = [], sumW = 0;
        for (var k = 0; k < segs.length; k++) {
          var wt = segs[k] * (1 + 0.18 * Math.sin(phase + r * 0.8 + k * 1.1));
          weights.push(wt); sumW += wt;
        }
        var x = padX;
        for (var j = 0; j < segs.length; j++) {
          var sw = (weights[j] / sumW) * availW;
          c.fillStyle = cols[(j + r) % cols.length];
          c.fillRect(x, y, Math.max(2, sw - 3), bh);
          if (!compact && sw > 48) {
            text(c, Math.round((weights[j] / sumW) * 100) + "%", x + sw * 0.5, y + bh * 0.5, 9.5, "#050912", "center", "700");
          }
          x += sw;
        }
      }
      if (!compact) text(c, "■ QUERY  ■ EXEC  ■ MEMORY  ■ VERIFY  ■ GATE", padX, h - 14, 9.5, MUTED, "left");
      return "Frame " + (Math.round(t) + 1);
    }, o);
  }

  A23.corticalTorus3D = corticalTorus3D;
  A23.dagPipeline = dagPipeline;
  A23.dumbbellPlot = dumbbellPlot;
  A23.marimekkoStrip = marimekkoStrip;
  g.A23Charts = A23;
})(window);
