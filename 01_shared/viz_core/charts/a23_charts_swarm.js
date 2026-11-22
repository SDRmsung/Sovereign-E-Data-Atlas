/* A23 Charts — SWM 群集調度套組 (#49 swarmBurst / #50 runLog / #51 unitGapBoard / #52 moduleMultiples)
 * 載入順序：在 a23_charts_quant.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（LCG seed=20261116、零 Math.random、零 Date.now、零閉包累加狀態）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var BG = "#05080d", CARD = "#070d16", LINE = "#1e293b";
  var CYAN = "#22d3ee", RED = "#f43f5e", TEXT = "#cbd5e1", FG = "#f8fafc", DIM = "#94a3b8", MUTED = "#475569";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Microsoft JhengHei', monospace";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, u) { return a + (b - a) * u; }

  function hashLcg(idx, salt) {
    var s = (20261116 ^ ((idx + 1) * 2654435761) ^ (salt || 0)) >>> 0;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  }

  function fit(cv) {
    var d = g.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    var w = +cv.dataset.w || Math.max(1, Math.round(r.width));
    var h = +cv.dataset.h || Math.max(1, Math.round(r.height));
    if (cv.__w !== w || cv.__h !== h || cv.__d !== d) {
      cv.width = w * d; cv.height = h * d; cv.__w = w; cv.__h = h; cv.__d = d;
    }
    var c = cv.getContext("2d");
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, w, h);
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
    function pause() { playing = false; cancelAnimationFrame(raf); }
    var ctl = {
      n: n,
      play: function () { if (playing) return; playing = true; last = 0; raf = requestAnimationFrame(tick); },
      pause: pause,
      stop: pause,
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
    c.font = (weight ? weight + " " : "") + size + "px " + MONO;
    c.fillStyle = color || TEXT;
    c.textAlign = align || "left";
    c.textBaseline = "middle";
    c.fillText(s, x, y);
  }

  function roundRect(c, x, y, w, h, r) {
    var rad = Math.min(r, w * 0.5, h * 0.5);
    c.beginPath();
    c.moveTo(x + rad, y);
    c.lineTo(x + w - rad, y);
    c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad);
    c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad);
    c.lineTo(x, y + rad);
    c.quadraticCurveTo(x, y, x + rad, y);
    c.closePath();
  }

  function workerStates(t, nFrames) {
    var u = clamp(t / (nFrames - 1), 0, 1);
    var list = new Array(8);
    for (var i = 0; i < 8; i++) {
      var speed = 0.85 + 0.32 * hashLcg(i, 17);
      var delay = i * 0.045;
      var prog = clamp((u * 1.28 - delay) * speed, 0.06, 1);
      var conflict = (i === 2 && t >= 10 && t <= 32) || (i === 5 && t >= 22 && t <= 44);
      // 三態證據：no-evidence（noev）≈ EVIDENCE_POLICY E0（僅導航、待驗證），與 conflict 互斥
      var noev = !conflict && i === 6 && t >= 18 && t <= 40;
      var status = conflict ? "conflict" : (noev ? "noev" : (prog >= 0.985 ? "done" : "run"));
      var load = status === "done" ? 0.38 : (0.55 + 0.45 * Math.sin(t * 0.42 + i * 1.17));
      list[i] = { idx: i, prog: prog, status: status, conflict: conflict, noev: noev, load: clamp(load, 0.2, 1) };
    }
    return list;
  }

  /* #49 swarmBurst — 放射爆發群集圖 (driver n=60，支援可選 opt.data) */
  function swarmBurst(cv, _data, opt) {
    var o = opt || {};
    var D = o.data || (_data && (_data.workers || _data.spikes) ? _data : null);
    var nFrames = 60, N_SPIKES = (D && D.nSpikes) || 720;

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var bgCol = (D && D.bg) || BG, cardCol = (D && D.card) || CARD, lineCol = (D && D.line) || LINE;
      var fgCol = (D && D.fg) || FG, textCol = (D && D.text) || TEXT, dimCol = (D && D.dim) || DIM, mutedCol = (D && D.muted) || MUTED;
      var accCol = (D && D.accent) || CYAN, badCol = (D && D.bad) || RED;
      if (bgCol !== BG) { c.fillStyle = bgCol; c.fillRect(0, 0, w, h); }

      var stepNum = Math.min(4, Math.floor(t / 15) + 1);
      var stepLabel = "Step " + stepNum + "/4";

      var topH = compact ? 22 : 26;
      var tickerH = compact ? 20 : 24;
      var bodyH = Math.max(80, h - topH - tickerH);
      var cx = w * 0.5;
      var cy = topH + bodyH * 0.5;
      var availR = Math.min(w * 0.46, bodyH * 0.48);

      // Header strip
      var hdrTitle = (D && D.title) || (compact ? "SWARM MAP · 8W" : "SWARM BURST · 8 WORKERS · GROK 4.6 VS FABLE 5.2");
      var badgeTxt = (D && D.badge) || stepLabel;
      text(c, hdrTitle, 12, topH * 0.5, compact ? 9 : 10, dimCol, "left", "700");
      var badgeW = compact ? 64 : 74;
      c.fillStyle = "rgba(34, 211, 238, 0.12)";
      roundRect(c, w - badgeW - 10, 4, badgeW, topH - 8, 4);
      c.fill();
      c.strokeStyle = "rgba(34, 211, 238, 0.42)";
      c.lineWidth = 1;
      c.stroke();
      text(c, badgeTxt, w - badgeW * 0.5 - 10, topH * 0.5, compact ? 9 : 10, accCol, "center", "700");

      var workers;
      if (D && Array.isArray(D.workers) && D.workers.length) {
        workers = D.workers.map(function (wItem, i) {
          var st = wItem.status || "run";
          var isConf = !!(wItem.conflict || st === "conflict" || st === "failed" || st === "needs_you");
          var isNoev = !isConf && !!(wItem.noev || st === "noev" || st === "spec_only");
          var normSt = isConf ? "conflict" : (isNoev ? "noev" : (st === "done" || st === "standby" ? "done" : "run"));
          return {
            idx: i,
            id: wItem.id || ("W" + (i + 1)),
            prog: wItem.prog != null ? clamp(wItem.prog, 0.06, 1) : (normSt === "done" ? 1 : 0.72),
            status: normSt,
            conflict: isConf,
            noev: isNoev,
            load: clamp(wItem.load != null ? wItem.load : 0.65, 0.2, 1),
            bars: Array.isArray(wItem.bars) ? wItem.bars : null,
            stTxt: wItem.stTxt || null
          };
        });
      } else {
        workers = workerStates(t, nFrames);
      }
      var nW = workers.length || 8;
      var customSpikes = (D && Array.isArray(D.spikes) && D.spikes.length) ? D.spikes : null;

      var rSphere = Math.max(12, availR * 0.18);
      var rNodes = availR * 0.29;
      var rArc = availR * 0.39;
      var rSpike0 = availR * 0.43;
      var rSpikeMax = availR * 0.77;

      // Radial spikes (custom D.spikes or 720 LCG spikes = worker load * LCG noise)
      c.lineWidth = compact ? 0.85 : 1.05;
      for (var k = 0; k < N_SPIKES; k++) {
        var ang = (k / N_SPIKES) * Math.PI * 2 - Math.PI * 0.5;
        var normAng = ((ang + Math.PI * 0.5 + Math.PI / nW) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        var wi = Math.floor(normAng / (Math.PI * 2 / nW)) % nW;
        var wk = workers[wi];
        var shimmer = 0.84 + 0.16 * Math.sin(t * 0.38 + k * 0.17);
        var lenNorm, rgb, alpha;
        if (customSpikes) {
          var sp = customSpikes[Math.floor((k / N_SPIKES) * customSpikes.length) % customSpikes.length];
          lenNorm = clamp((sp.len != null ? sp.len : 0.22) * shimmer, 0.06, 1);
          rgb = sp.rgb || (sp.conflict ? "244,63,94" : (sp.highlight ? "248,250,252" : "34,211,238"));
          alpha = sp.alpha != null ? sp.alpha : clamp(0.24 + lenNorm * 0.62, 0.14, 0.92);
        } else {
          var n1 = hashLcg(k, 401);
          var n2 = hashLcg(k, 709);
          lenNorm = clamp((0.16 + 0.84 * Math.pow(n1, 1.3)) * wk.load * shimmer, 0.06, 1);
          var isRed = (wk.conflict && n2 < 0.38) || n2 < 0.045;
          var isWhite = !isRed && n2 > 0.78;
          rgb = isRed ? "244,63,94" : (isWhite ? "248,250,252" : "34,211,238");
          alpha = clamp(0.86 - lenNorm * 0.60, 0.14, 0.86);
        }
        var rEnd = rSpike0 + lenNorm * (rSpikeMax - rSpike0);
        var rMid = rSpike0 + (rEnd - rSpike0) * 0.48;

        var cosA = Math.cos(ang), sinA = Math.sin(ang);
        c.strokeStyle = "rgba(" + rgb + "," + alpha.toFixed(2) + ")";
        c.beginPath();
        c.moveTo(cx + cosA * rSpike0, cy + sinA * rSpike0);
        c.lineTo(cx + cosA * rMid, cy + sinA * rMid);
        c.stroke();

        c.strokeStyle = "rgba(" + rgb + "," + (alpha * 0.42).toFixed(2) + ")";
        c.beginPath();
        c.moveTo(cx + cosA * rMid, cy + sinA * rMid);
        c.lineTo(cx + cosA * rEnd, cy + sinA * rEnd);
        c.stroke();
      }

      // Outer arc segments (brightness = worker progress)
      var slice = (Math.PI * 2) / nW;
      for (var ai = 0; ai < nW; ai++) {
        var wkA = workers[ai];
        var aMid = -Math.PI * 0.5 + ai * slice;
        var a0 = aMid - slice * 0.41;
        var a1 = aMid + slice * 0.41;
        c.strokeStyle = "rgba(30, 41, 59, 0.65)";
        c.lineWidth = compact ? 2.5 : 3.5;
        c.beginPath();
        c.arc(cx, cy, rArc, a0, a1);
        c.stroke();

        var sweep = (a1 - a0) * wkA.prog;
        var bright = (0.35 + 0.65 * wkA.prog).toFixed(2);
        c.strokeStyle = wkA.conflict ? "rgba(244,63,94," + bright + ")" : (wkA.status === "done" ? "rgba(248,250,252," + bright + ")" : "rgba(34,211,238," + bright + ")");
        c.beginPath();
        c.arc(cx, cy, rArc, a0, a0 + sweep);
        c.stroke();
      }

      // Inner nodes (white=done, cyan=running, red ring=conflict)
      for (var ni = 0; ni < nW; ni++) {
        var wkN = workers[ni];
        var nAng = -Math.PI * 0.5 + ni * slice;
        var nx = cx + Math.cos(nAng) * rNodes;
        var ny = cy + Math.sin(nAng) * rNodes;
        var nr = compact ? 3.5 : 5;
        if (wkN.conflict) {
          c.fillStyle = "#4c0519";
          c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill();
          c.strokeStyle = badCol;
          c.lineWidth = 2;
          c.beginPath(); c.arc(nx, ny, nr + 2.2, 0, Math.PI * 2); c.stroke();
        } else if (wkN.noev) {
          c.strokeStyle = dimCol;
          c.lineWidth = 1.4;
          c.setLineDash([2, 2]);
          c.beginPath(); c.arc(nx, ny, nr + 1.5, 0, Math.PI * 2); c.stroke();
          c.setLineDash([]);
        } else if (wkN.status === "done") {
          c.fillStyle = fgCol;
          c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill();
        } else {
          c.fillStyle = accCol;
          c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill();
          c.strokeStyle = "rgba(34,211,238,0.35)";
          c.lineWidth = 1.2;
          c.beginPath(); c.arc(nx, ny, nr + 2.5, 0, Math.PI * 2); c.stroke();
        }
      }

      // Central sphere
      var sphereGrad = c.createRadialGradient(cx - rSphere * 0.25, cy - rSphere * 0.25, 2, cx, cy, rSphere);
      sphereGrad.addColorStop(0, "#111827");
      sphereGrad.addColorStop(1, "#03060a");
      c.fillStyle = sphereGrad;
      c.beginPath(); c.arc(cx, cy, rSphere, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(34, 211, 238, 0.45)";
      c.lineWidth = 1.3;
      c.stroke();
      text(c, (D && D.centerLabel) || "SWM", cx, cy - (compact ? 3 : 5), compact ? 7.5 : 9, fgCol, "center", "700");
      text(c, (D && D.centerValue) || "6.7x", cx, cy + (compact ? 5 : 7), compact ? 7 : 8.5, accCol, "center", "700");

      // Outer satellite boxes (each with 6 mini vertical bars)
      var boxW = compact ? 42 : Math.min(72, Math.max(52, w * 0.082));
      var boxH = compact ? 22 : Math.min(34, Math.max(26, bodyH * 0.095));
      var rxSat = Math.min(w * 0.43 - boxW * 0.5, availR * 1.18);
      var rySat = Math.min(bodyH * 0.44 - boxH * 0.5, availR * 0.94);

      for (var si = 0; si < nW; si++) {
        var wkS = workers[si];
        var sAng = -Math.PI * 0.5 + si * slice;
        var sx = clamp(cx + Math.cos(sAng) * rxSat - boxW * 0.5, 8, w - boxW - 8);
        var sy = clamp(cy + Math.sin(sAng) * rySat - boxH * 0.5, topH + 3, h - tickerH - boxH - 3);

        // Connector hairline from outer arc
        c.strokeStyle = wkS.conflict ? "rgba(244,63,94,0.38)" : "rgba(34,211,238,0.22)";
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(cx + Math.cos(sAng) * rArc, cy + Math.sin(sAng) * rArc);
        c.lineTo(sx + boxW * 0.5, sy + boxH * 0.5);
        c.stroke();

        c.fillStyle = "rgba(7, 13, 22, 0.92)";
        roundRect(c, sx, sy, boxW, boxH, 4);
        c.fill();
        c.strokeStyle = wkS.conflict ? badCol : (wkS.noev ? dimCol : (wkS.status === "done" ? "rgba(248,250,252,0.45)" : "rgba(34,211,238,0.45)"));
        c.lineWidth = 1;
        if (wkS.noev) c.setLineDash([3, 2]);
        c.stroke();
        c.setLineDash([]);
        if (!compact && (wkS.conflict || wkS.noev)) {
          var lblY = sy < cy ? sy - 6 : sy + boxH + 7;
          text(c, wkS.conflict ? "CONFLICT" : "NO EVIDENCE", sx + boxW * 0.5, lblY, 7.5, wkS.conflict ? badCol : dimCol, "center", "700");
        }

        text(c, wkS.id || ("W" + (si + 1)), sx + 4, sy + (compact ? 6 : 8), compact ? 7.5 : 8.5, wkS.conflict ? badCol : fgCol, "left", "700");
        if (!compact) {
          var stTxt = wkS.stTxt || (wkS.conflict ? "FLG" : wkS.noev ? "N/E" : (wkS.status === "done" ? "OK" : Math.round(wkS.prog * 100) + "%"));
          text(c, stTxt, sx + boxW - 4, sy + 8, 7.5, wkS.conflict ? badCol : wkS.noev ? dimCol : (wkS.status === "done" ? fgCol : accCol), "right", "600");
        }

        // 6 mini vertical bars (custom bars or closed-form LCG)
        var barsX = sx + 4;
        var barsW = boxW - 8;
        var barStep = barsW / 6;
        var barMaxH = boxH - (compact ? 11 : 15);
        var barBaseY = sy + boxH - 3;
        for (var bi = 0; bi < 6; bi++) {
          var frac;
          if (wkS.bars && wkS.bars.length) {
            frac = clamp(wkS.bars[bi % wkS.bars.length], 0.1, 1);
          } else {
            var tb = Math.max(0, t - (5 - bi) * 1.4);
            frac = 0.22 + 0.78 * hashLcg(si * 101 + Math.floor(tb * 2), 911) * (0.65 + 0.35 * Math.sin(tb * 0.5 + si));
          }
          var bh = Math.max(2, frac * barMaxH);
          c.fillStyle = wkS.conflict ? badCol : wkS.noev ? mutedCol : (bi === 5 ? fgCol : accCol);
          c.fillRect(barsX + bi * barStep + 1, barBaseY - bh, Math.max(2, barStep - 2), bh);
        }
      }

      // Bottom scrolling ticker (displacement = pure function of t)
      var tickY = h - tickerH;
      c.fillStyle = cardCol;
      c.fillRect(0, tickY, w, tickerH);
      c.strokeStyle = lineCol;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, tickY); c.lineTo(w, tickY); c.stroke();

      var tickerMsg = (D && D.ticker) || "$2 IN · $6 OUT · OUT GAP 6.7x · 5.2 VS 5 -20% · 8 WORKERS PARALLEL · GROK 4.6 SWARM ·   ";
      c.save();
      c.beginPath();
      c.rect(0, tickY, w, tickerH);
      c.clip();
      var tFontSize = compact ? 9 : 10.5;
      c.font = "600 " + tFontSize + "px " + MONO;
      var msgW = c.measureText(tickerMsg).width || 480;
      var dx = (t * 26) % msgW;
      var tx = -dx;
      while (tx < w) {
        text(c, tickerMsg, tx, tickY + tickerH * 0.5, tFontSize, textCol, "left", "600");
        tx += msgW;
      }
      c.restore();

      return stepLabel;
    }, o);
  }

  /* #50 runLog — 終端串流＋直立階段 (driver n=60)；舊式 Legacy（無 A23Tex 時回退） */
  function runLogLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var STAGES = [
      { id: "01", name: "SCOUT", desc: "fan-out 8 workers" },
      { id: "02", name: "MERGE", desc: "collect 8 drafts" },
      { id: "03", name: "FLAG",  desc: "audit 2 conflicts" },
      { id: "04", name: "BUILD", desc: "synthesize patch" },
      { id: "05", name: "CHECK", desc: "verify invariants" },
      { id: "06", name: "FIX",   desc: "fix · loop to build" }
    ];

    var LOG_LINES = [
      { kind: "hdr", txt: "[BOOT] init swarm kernel · 8 workers · seed=20261116" },
      { kind: "log", txt: "  mount 1M context window · deterministic clock=on" },
      { kind: "log", txt: "  spawn W1..W8 isolated sandboxes -> ready" },
      { kind: "hdr", txt: "[PRICE] load model tariff table" },
      { kind: "log", txt: "  grok-4.6-swarm  in=$2.00/1M   out=$6.00/1M" },
      { kind: "log", txt: "  fable-5.2-pro   in=$5.00/1M   out=$40.00/1M" },
      { kind: "log", txt: "  out_gap=6.7x  |  5.2 vs 5.0 delta=-20%" },
      { kind: "hdr", txt: "[SCOUT] step 1/4 · parallel probe" },
      { kind: "log", txt: "  W1..W4 scan viz_core/charts -> 482 tok/s" },
      { kind: "log", txt: "  W5..W8 scan gallery/registry -> 510 tok/s" },
      { kind: "log", txt: "  cost_so_far=$1.42 (est_budget=$10-$20)" },
      { kind: "hdr", txt: "[FAN-OUT] step 2/4..3/4 · merge & flag" },
      { kind: "log", txt: "  merge(W1..W8) -> 8/8 reports aligned" },
      { kind: "warn", txt: "  FLAG W3xW6 conflict: schema mismatch -> reroute" },
      { kind: "log", txt: "  resolve conflict W3xW6 -> status=clear" },
      { kind: "log", txt: "  BUILD unified bundle + CHECK 12/12 pass" },
      { kind: "hdr", txt: "[REPORT] step 4/4 · final telemetry" },
      { kind: "log", txt: "  total_in=1.0M ($2.00)  total_out=1.0M ($6.00)" },
      { kind: "log", txt: "  baseline_fable5.2=$40.00  savings=6.7x (-85%)" },
      { kind: "log", txt: "  FIX sealed · exit_code=0 · zero regressions" }
    ];

    var totalChars = 0;
    for (var li = 0; li < LOG_LINES.length; li++) totalChars += LOG_LINES[li].txt.length;

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var stepNum = Math.min(4, Math.floor(t / 15) + 1);
      var stepTag = "step " + stepNum + "/4";
      var curStage = Math.min(5, Math.floor((t / (nFrames - 1)) * 5.99));

      var topH = compact ? 24 : 28;
      var pad = compact ? 8 : 12;

      // Top bar
      text(c, compact ? "EXEC · RUN LOG" : "STAGES  |  EXEC · RUN LOG", pad, topH * 0.5, compact ? 9.5 : 10.5, DIM, "left", "700");
      var bw = compact ? 66 : 74;
      c.fillStyle = "rgba(34, 211, 238, 0.12)";
      roundRect(c, w - bw - pad, 4, bw, topH - 8, 4);
      c.fill();
      c.strokeStyle = "rgba(34, 211, 238, 0.42)";
      c.lineWidth = 1;
      c.stroke();
      text(c, stepTag, w - bw * 0.5 - pad, topH * 0.5, compact ? 9 : 10, CYAN, "center", "700");

      var bodyY = topH + 4;
      var bodyH = h - bodyY - pad;
      var termX = pad;
      var termW = w - pad * 2;

      // Left 40%: Vertical stepper (hidden in compact)
      if (!compact) {
        var leftW = Math.round((w - pad * 3) * 0.40);
        termX = pad * 2 + leftW;
        termW = w - termX - pad;

        var rowGap = 5;
        var rowH = (bodyH - rowGap * (STAGES.length - 1)) / STAGES.length;
        for (var si = 0; si < STAGES.length; si++) {
          var st = STAGES[si];
          var ry = bodyY + si * (rowH + rowGap);
          var isRun = si === curStage;
          var isDone = si < curStage;
          var stateTxt = isDone ? "done" : (isRun ? "run" : "wait");

          c.fillStyle = isRun ? "rgba(34, 211, 238, 0.10)" : CARD;
          roundRect(c, pad, ry, leftW, rowH, 5);
          c.fill();
          c.strokeStyle = isRun ? CYAN : (isDone ? "rgba(248, 250, 252, 0.25)" : LINE);
          c.lineWidth = isRun ? 1.4 : 1;
          c.stroke();

          if (si < STAGES.length - 1) {
            c.strokeStyle = isDone ? "rgba(34, 211, 238, 0.45)" : LINE;
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(pad + 16, ry + rowH);
            c.lineTo(pad + 16, ry + rowH + rowGap);
            c.stroke();
          }

          var midY = ry + rowH * 0.5;
          var nameY = rowH >= 36 ? midY - 6 : midY;
          text(c, st.id + " " + st.name, pad + 8, nameY, 10, isRun ? CYAN : (isDone ? FG : DIM), "left", "700");
          if (rowH >= 36) {
            text(c, st.desc, pad + 8, midY + 8, 8.5, isRun ? TEXT : MUTED, "left");
          }

          var pillW = 36, pillH = 16;
          var px = pad + leftW - pillW - 7;
          var py = midY - pillH * 0.5;
          c.fillStyle = isRun ? "rgba(34, 211, 238, 0.18)" : (isDone ? "rgba(248, 250, 252, 0.09)" : "rgba(71, 85, 105, 0.2)");
          roundRect(c, px, py, pillW, pillH, 4);
          c.fill();
          text(c, stateTxt, px + pillW * 0.5, midY, 8.5, isRun ? CYAN : (isDone ? FG : MUTED), "center", "700");
        }
      }

      // Right 60% (or 100% in compact): Terminal log
      c.fillStyle = CARD;
      roundRect(c, termX, bodyY, termW, bodyH, 6);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var termHdrH = 22;
      c.fillStyle = "rgba(15, 23, 42, 0.7)";
      roundRect(c, termX + 1, bodyY + 1, termW - 2, termHdrH, 5);
      c.fill();
      text(c, "EXEC · RUN LOG", termX + 10, bodyY + termHdrH * 0.5 + 1, 9.5, CYAN, "left", "700");
      text(c, "8W · 1M CTX", termX + termW - 10, bodyY + termHdrH * 0.5 + 1, 8.5, MUTED, "right");

      // Closed-form character reveal
      var budget = Math.floor(lerp(34, totalChars + 10, t / (nFrames - 1)));
      var visLines = [];
      var rem = budget;
      for (var i = 0; i < LOG_LINES.length && rem > 0; i++) {
        var ln = LOG_LINES[i];
        var take = Math.min(ln.txt.length, rem);
        visLines.push({ kind: ln.kind, txt: ln.txt.slice(0, take), partial: take < ln.txt.length });
        rem -= take;
      }

      var lineH = compact ? 15 : 16.5;
      var fontSize = compact ? 8.5 : 9.5;
      var logTop = bodyY + termHdrH + 8;
      var maxRows = Math.max(3, Math.floor((bodyH - termHdrH - 14) / lineH));
      var scrollIdx = Math.max(0, visLines.length - maxRows);
      var blinkOn = (Math.floor(t * 2) % 2) === 0;

      c.save();
      c.beginPath();
      c.rect(termX + 4, bodyY + termHdrH + 2, termW - 8, bodyH - termHdrH - 6);
      c.clip();

      var maxCharsFit = Math.max(18, Math.floor((termW - 20) / (fontSize * 0.6)));
      for (var r = scrollIdx; r < visLines.length; r++) {
        var rowItem = visLines[r];
        var ry2 = logTop + (r - scrollIdx) * lineH + lineH * 0.4;
        var outStr = rowItem.txt;
        if (outStr.length > maxCharsFit) outStr = outStr.slice(0, maxCharsFit - 1) + "…";
        if (r === visLines.length - 1 && blinkOn) outStr += "█";
        var col = rowItem.kind === "hdr" ? CYAN : (rowItem.kind === "warn" ? RED : TEXT);
        text(c, outStr, termX + 10, ry2, fontSize, col, "left", rowItem.kind === "hdr" ? "700" : "400");
      }
      c.restore();

      return "Step " + stepNum + "/4";
    }, o);
  }

  /* #50 runLog — 終端串流 §6.7 新式（A23Tex；S20 2026-11-17）
   * 01 STAGES 直立階段（軌道 orthPath＋hotPacket＋埠點；唯一作用列 activeHalo）＋02 RUN LOG 終端（行號槽＋當前行底條＋游標）
   * ＋03 THROUGHPUT 插畫顯影（tok/s 柱 develop＋柱頂 hotPacket）＋kvBlock（tokens／cost／flags）。
   * 單色 6 階；紅只留 warn、綠只留 done；小卡資訊字 infoFont+2。無 A23Tex 時回退 runLogLegacy。 */
  function runLog(cv, _data, opt) {
    var TX = g.A23Tex; if (!TX) return runLogLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme("#22d3ee")), V = K.V, SR = "#f43f5e", SG = "#22c55e";
    var hasD = _data && typeof _data === "object";
    var o = opt || {}, nFrames = 60;
    var STAGES = (hasD && _data.stages && _data.stages.length) ? _data.stages : [
      { id: "01", name: "SCOUT", desc: "fan-out 8 workers" },
      { id: "02", name: "MERGE", desc: "collect 8 drafts" },
      { id: "03", name: "FLAG",  desc: "audit 2 conflicts" },
      { id: "04", name: "BUILD", desc: "synthesize patch" },
      { id: "05", name: "CHECK", desc: "verify invariants" },
      { id: "06", name: "FIX",   desc: "fix · loop to build" }
    ];
    var NS = STAGES.length;
    var LOG = (hasD && _data.log && _data.log.length) ? _data.log : [
      ["hdr", "[BOOT] init swarm kernel · 8 workers · seed=20261116"],
      ["log", "mount 1M context window · deterministic clock=on"],
      ["log", "spawn W1..W8 isolated sandboxes -> ready"],
      ["hdr", "[PRICE] load model tariff table"],
      ["log", "grok-4.6-swarm  in=$2.00/1M  out=$6.00/1M"],
      ["log", "fable-5.2-pro   in=$5.00/1M  out=$40.00/1M"],
      ["log", "out_gap=6.7x | 5.2 vs 5.0 delta=-20%"],
      ["hdr", "[SCOUT] step 1/4 · parallel probe"],
      ["log", "W1..W4 scan viz_core/charts -> 482 tok/s"],
      ["log", "W5..W8 scan gallery/registry -> 510 tok/s"],
      ["log", "cost_so_far=$1.42 (est_budget=$10-$20)"],
      ["hdr", "[FAN-OUT] step 2/4..3/4 · merge & flag"],
      ["log", "merge(W1..W8) -> 8/8 reports aligned"],
      ["warn", "FLAG W3xW6 conflict: schema mismatch -> reroute"],
      ["log", "resolve conflict W3xW6 -> status=clear"],
      ["log", "BUILD unified bundle + CHECK 11/12 · 1 fail"],
      ["hdr", "[LOOP] FIX -> BUILD · retry 1/1"],
      ["log", "rebuild bundle · CHECK 12/12 pass after fix"],
      ["hdr", "[REPORT] step 4/4 · final telemetry"],
      ["log", "total_in=1.0M ($2.00)  total_out=1.0M ($6.00)"],
      ["log", "baseline_fable5.2=$40.00  savings=6.7x (-85%)"],
      ["log", "FIX sealed · exit_code=0 · zero regressions"]
    ];
    var totalChars = 0, NB = 24, TPS = [];
    for (var li = 0; li < LOG.length; li++) totalChars += LOG[li][1].length;
    for (var bi = 0; bi < NB; bi++) TPS.push(430 + Math.round(K.hh(bi, 50) * 110));

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var f = K.infoFont(w), F = compact ? f + 2 : f, pad = compact ? 6 : 10, gap = compact ? 5 : 8, topH = compact ? 16 : 24;
      var u = K.clamp(t / (nFrames - 1), 0, 1);
      var step = (hasD && _data.step != null) ? _data.step : Math.min(4, Math.floor(t / 15) + 1);
      var stepTot = (hasD && _data.stepTotal != null) ? _data.stepTotal : 4;
      var cur = (hasD && _data.cur != null) ? Math.min(NS - 1, Math.max(0, _data.cur)) : Math.min(5, Math.floor(u * 5.99));
      /* FIX→BUILD 回圈：cur=5 時先回送 04 重建一次（lp 0→1），回圈完成 FIX 才 done；純函式 of t */
      var lp0 = 5 / 5.99, lp = (!hasD && cur === 5) ? K.clamp((u - lp0) / (0.95 - lp0), 0, 1) : 0, loopOn = !hasD && cur === 5, fixDone = loopOn && lp >= 1;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 6 : 8, V.dot);
      K.tx(c, K.fitM(c, (hasD && _data.title) ? _data.title : (compact ? "RUN LOG · SWARM" : "SWARM EXEC · RUN LOG · 8W"), w * 0.66, F, "700"), pad, topH * 0.5, F, V.dim, "left", "700");
      K.tx(c, "STEP " + step + "/" + stepTot, w - pad, topH * 0.5, F, V.acc2, "right", "700");

      function head(b, l, r) {
        K.pane(c, b); K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
        var hy = b.y + 4 + F * 0.5;
        K.tx(c, K.fitM(c, l, b.w * (r ? 0.6 : 0.9), F, "700"), b.x + 6, hy, F, V.dim, "left", "700");
        if (r) K.tx(c, r, b.x + b.w - 6, hy, F, V.acc2, "right", "700");
        return b.y + F + 8;
      }

      /* ── 版面：桌面 [STAGES | LOG／THROUGHPUT]；小卡 LOG 上＋[STAGE|TPS] 下 ── */
      var y0 = topH, availH = h - pad - y0, bS, bL, bP;
      if (!compact) {
        var sW = Math.round((w - pad * 2 - gap) * 0.34), rx = pad + sW + gap, rW = w - pad - rx, lH = Math.round((availH - gap) * 0.62);
        bS = { x: pad, y: y0, w: sW, h: availH };
        bL = { x: rx, y: y0, w: rW, h: lH };
        bP = { x: rx, y: y0 + lH + gap, w: rW, h: availH - lH - gap };
      } else {
        var lH2 = Math.round((availH - gap) * 0.58), hw = (w - pad * 2 - gap) / 2;
        bL = { x: pad, y: y0, w: w - pad * 2, h: lH2 };
        bS = { x: pad, y: y0 + lH2 + gap, w: hw, h: availH - lH2 - gap };
        bP = { x: pad + hw + gap, y: bS.y, w: hw, h: bS.h };
      }

      /* ── 01 STAGES：軌道＋埠點＋熱封包；唯一作用列 activeHalo ── */
      var sTop = head(bS, (hasD && _data.stageTitle) ? _data.stageTitle : (compact ? "01 STAGE" : "01 STAGES"), (cur + 1) + "/" + NS);
      if (!compact) {
        var rowH = (bS.y + bS.h - sTop - 4) / NS, railX = bS.x + 12, cy = [];
        for (var ci = 0; ci < NS; ci++) cy.push(Math.round(sTop + rowH * (ci + 0.5)));
        c.setLineDash([2, 2]); c.strokeStyle = V.line2; c.lineWidth = 1; K.orthPath(c, [[railX, cy[0]], [railX, cy[NS - 1]]], 3); c.setLineDash([]);
        if (cur > 0) { c.strokeStyle = V.acc2; c.lineWidth = 1.4; K.ln(c, railX, cy[0], railX, cy[cur]); }
        for (var si = 0; si < NS; si++) {
          var st = STAGES[si], stSt = st.status || null;
          var isRun = stSt ? (stSt === "run") : (si === cur);
          var isDone = stSt ? (stSt === "done") : (si < cur);
          var ry = cy[si], twoLine = rowH >= F * 2 + 10;
          var nY = twoLine ? ry - F * 0.55 : ry;
          if (isRun) K.activeHalo(c, railX + 8, ry - rowH * 0.5 + 6, bS.x + bS.w - railX - 20, rowH - 12, 8);
          K.kvPort(c, railX, ry, isRun || isDone);
          K.tx(c, st.id + " " + st.name, railX + 10, nY, F, isRun ? V.ink : (isDone ? V.txt : V.dim), "left", "700");
          if (twoLine) K.tx(c, K.fitM(c, st.desc, bS.x + bS.w - railX - 60, F, "400"), railX + 10, ry + F * 0.6, F, isRun ? V.acc2 : V.mute, "left", "400");
          var sDone = isDone || (isRun && fixDone), sLoop = isRun && loopOn && !fixDone;
          K.tx(c, sDone ? "done" : (sLoop ? "loop" : (isRun ? "run" : "wait")), bS.x + bS.w - 8, nY, F, sDone ? SG : (isRun ? V.acc2 : V.mute), "right", "700");
        }
        var pktFrac = hasD ? (NS > 1 ? cur / (NS - 1) : 1) : u;
        K.hotPacket(c, [[railX, cy[0]], [railX, cy[NS - 1]]], pktFrac, V.acc, 2.6);
        if (loopOn) {
          var lpX = railX - 8, lpPath = [[railX - 4, cy[5]], [lpX, cy[5]], [lpX, cy[3]], [railX - 4, cy[3]]];
          c.strokeStyle = fixDone ? V.line2 : V.acc2; c.lineWidth = 1.2;
          if (fixDone) c.setLineDash([2, 2]);
          K.orthPath(c, lpPath, 3); c.setLineDash([]);
          c.fillStyle = fixDone ? V.line2 : V.acc2;
          c.beginPath(); c.moveTo(railX - 3, cy[3]); c.lineTo(railX - 7, cy[3] - 3); c.lineTo(railX - 7, cy[3] + 3); c.closePath(); c.fill();
          if (!fixDone) K.hotPacket(c, lpPath, lp, V.acc, 2.2);
        }
      } else {
        var tY = sTop + Math.max(F, (bS.y + bS.h - sTop) * 0.28), nx = [], x0 = bS.x + 9, x1 = bS.x + bS.w - 9;
        for (var cj = 0; cj < NS; cj++) nx.push(x0 + (x1 - x0) * cj / Math.max(1, NS - 1));
        c.setLineDash([2, 2]); c.strokeStyle = V.line2; c.lineWidth = 1; K.orthPath(c, [[x0, tY], [x1, tY]], 3); c.setLineDash([]);
        if (cur > 0) { c.strokeStyle = V.acc2; c.lineWidth = 1.4; K.ln(c, x0, tY, nx[cur], tY); }
        for (var sj = 0; sj < NS; sj++) K.kvPort(c, nx[sj], tY, sj <= cur);
        K.hotPacket(c, [[x0, tY], [x1, tY]], hasD ? (NS > 1 ? cur / (NS - 1) : 1) : u, V.acc, 1.8);
        if (loopOn) {
          var lpY = tY - Math.max(5, F * 0.6), lpP2 = [[nx[5], tY - 3], [nx[5], lpY], [nx[3], lpY], [nx[3], tY - 3]];
          c.strokeStyle = fixDone ? V.line2 : V.acc2; c.lineWidth = 1;
          if (fixDone) c.setLineDash([2, 2]);
          K.orthPath(c, lpP2, 2); c.setLineDash([]);
          if (!fixDone) K.hotPacket(c, lpP2, lp, V.acc, 1.6);
        }
        var sc = STAGES[cur], l1 = tY + F + 4;
        c.strokeStyle = V.acc2; c.lineWidth = 1; K.roundRect(c, bS.x + 3.5, l1 - F * 0.5 - 2.5, bS.w - 7, F + 5, 2); c.stroke();
        K.tx(c, sc.id + " " + sc.name, bS.x + 7, l1, F, V.ink, "left", "700");
        K.tx(c, (sc.status || (fixDone ? "done" : (loopOn ? "loop" : "run"))), bS.x + bS.w - 7, l1, F, (sc.status === "done" || fixDone) ? SG : V.acc2, "right", "700");
        if (l1 + F * 1.6 < bS.y + bS.h - 2) K.tx(c, K.fitM(c, sc.desc, bS.w - 12, F, "400"), bS.x + 7, l1 + F + 4, F, V.dim, "left", "400");
      }

      /* ── 02 RUN LOG：行號槽＋當前行底條＋游標 ── */
      var lTop = head(bL, (hasD && _data.logTitle) ? _data.logTitle : (compact ? "02 LOG" : "02 RUN LOG · STDOUT"), (hasD && _data.logSub != null) ? _data.logSub : (compact ? "8W" : "8W · 1M CTX"));
      var budget = hasD ? (totalChars + 10) : Math.floor(K.lerp(34, totalChars + 10, u)), vis = [], rem = budget;
      for (var i = 0; i < LOG.length && rem > 0; i++) {
        var take = Math.min(LOG[i][1].length, rem);
        vis.push({ k: LOG[i][0], s: LOG[i][1].slice(0, take), n: i + 1 }); rem -= take;
      }
      var lnH = F + Math.max(4, Math.round(F * 0.6)), gut = Math.round(F * 2.2), maxRows = Math.max(2, Math.floor((bL.y + bL.h - lTop - 4) / lnH));
      var sIdx = Math.max(0, vis.length - maxRows), txX = bL.x + 6 + gut, txW = bL.x + bL.w - 8 - txX;
      c.strokeStyle = V.line; c.lineWidth = 1; K.ln(c, txX - 5.5, lTop, txX - 5.5, bL.y + bL.h - 4);
      c.save(); c.beginPath(); c.rect(bL.x + 2, lTop - 2, bL.w - 4, bL.y + bL.h - lTop); c.clip();
      for (var r = sIdx; r < vis.length; r++) {
        var it = vis[r], yy = Math.round(lTop + (r - sIdx + 0.5) * lnH), last = r === vis.length - 1;
        if (last) { c.fillStyle = V.track; c.fillRect(bL.x + 3, yy - lnH * 0.5, bL.w - 6, lnH); c.fillStyle = V.acc; c.fillRect(bL.x + 3, yy - lnH * 0.5 + 1, 2, lnH - 2); }
        K.tx(c, (it.n < 10 ? "0" : "") + it.n, txX - 9, yy, F, last ? V.acc2 : V.mute, "right", "600");
        var str = (it.k === "log" ? "  " : "") + it.s;
        var col = it.k === "hdr" ? V.acc2 : (it.k === "warn" ? SR : (last ? V.ink : V.txt));
        str = K.fitM(c, str, txW - F, F, it.k === "hdr" ? "700" : "400");
        K.tx(c, str, txX, yy, F, col, "left", it.k === "hdr" ? "700" : "400");
        if (last && (Math.floor(t * 2) % 2) === 0) {
          c.font = (it.k === "hdr" ? "700 " : "400 ") + F + "px " + K.MONO;
          var cwid = c.measureText(str).width; c.fillStyle = V.acc3; c.fillRect(Math.round(txX + cwid + 2), yy - F * 0.5, Math.max(3, Math.round(F * 0.55)), F);
        }
      }
      c.restore();

      /* ── 03 THROUGHPUT：tok/s 柱插畫顯影＋柱頂熱封包＋kvBlock ── */
      var pTop = head(bP, (hasD && _data.tpsTitle) ? _data.tpsTitle : (compact ? "03 TPS" : "03 THROUGHPUT · tok/s"), (hasD && _data.tpsVal != null) ? String(_data.tpsVal) : ("" + TPS[Math.min(NB - 1, Math.floor(u * (NB - 0.01)))]));
      var kvW = compact ? 0 : Math.round(bP.w * 0.42);
      var pl = { x: bP.x + 8, y: pTop + 2, w: bP.w - 16 - kvW, h: bP.y + bP.h - pTop - 8 }, pB = pl.y + pl.h, bw = pl.w / NB, top = [];
      function bh(v) { return (v - 360) / 200 * pl.h; }
      for (var tb = 0; tb < NB; tb++) top.push([pl.x + (tb + 0.5) * bw, pB - bh(TPS[tb])]);
      K.develop(c, { x: pl.x - 2, y: pl.y - 2, w: pl.w + 4, h: pl.h + 4 }, hasD ? 1 : K.clamp(u * 1.5, 0, 1), function (cc, col) {
        cc.strokeStyle = col; cc.lineWidth = 1; K.ln(cc, pl.x, pB + 0.5, pl.x + pl.w, pB + 0.5);
        cc.setLineDash([1, 3]); K.ln(cc, pl.x, Math.round(pB - bh(500)) + 0.5, pl.x + pl.w, Math.round(pB - bh(500)) + 0.5); cc.setLineDash([]);
        cc.fillStyle = col;
        for (var q = 0; q < NB; q++) cc.fillRect(Math.round(pl.x + q * bw + 1), Math.round(top[q][1]), Math.max(1, Math.round(bw) - 2), Math.round(pB - top[q][1]));
      });
      var curX = Math.round(pl.x + pl.w * (hasD ? Math.min(1, (step / stepTot)) : u)) + 0.5;
      c.globalAlpha = 0.6; c.fillStyle = V.bg; c.fillRect(curX + 0.5, pl.y - 2, pl.x + pl.w + 2 - curX, pl.h + 2); c.globalAlpha = 1;
      c.setLineDash([1, 2]); c.strokeStyle = V.line2; c.lineWidth = 1; K.ln(c, curX, pl.y, curX, pB); c.setLineDash([]);
      K.hotPacket(c, top, u, V.acc, compact ? 1.8 : 2.4);
      if (kvW) {
        var flg = cur < 2 ? "—" : (cur === 2 ? "2 open" : "clear");
        var kvs = (hasD && _data.kv && _data.kv.length) ? _data.kv : [["tokens", u.toFixed(2) + "M", false], ["cost", "$" + (8 * u).toFixed(2), true], ["flags", flg, false], ["exit", u >= 0.98 ? "0" : "…", false]];
        K.kvBlock(c, { x: bP.x + bP.w - kvW, y: pTop, w: kvW - 6, h: bP.y + bP.h - pTop - 2 }, kvs, F, bP.x + bP.w - kvW - 4);
      }

      return "Step " + step + "/" + stepTot + " · " + STAGES[cur].name;
    }, o);
  }

  /* #51 unitGapBoard — 單位格對比柱＋倍率環＋KPI 條 (driver n=48)；舊式 Legacy（無 A23Tex 時回退） */
  function unitGapBoardLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 48;

    // Underlying data (KPIs & delta table computed directly from these numbers)
    var WORKERS_ACTIVE = 8, WORKERS_TOTAL = 8;
    var MODELS = [
      { name: "Grok 4.6 Swarm", inPrice: 2, outPrice: 6, color: CYAN },
      { name: "Fable 5.0",      inPrice: 4, outPrice: 32, color: RED },
      { name: "Fable 5.2",      inPrice: 5, outPrice: 40, color: DIM }
    ];
    var refOut = MODELS[2].outPrice; // $40 baseline
    var outA = MODELS[0].outPrice;   // $6
    var outB = MODELS[2].outPrice;   // $40
    var gapMultiplier = outB / outA; // 6.666... -> 6.7x

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var pad = compact ? 8 : 12;
      var stepNum = Math.min(4, Math.floor(t / 12) + 1);
      var prog = 0.16 + 0.84 * Math.min(1, t / (nFrames - 6));

      // Top KPI bar (5 cells)
      var kpiH = compact ? 36 : 42;
      var kpiItems = [
        { k: "WORKERS", v: WORKERS_ACTIVE + "/" + WORKERS_TOTAL, col: FG },
        { k: "MODEL",   v: compact ? "4.6/5.2" : "Grok 4.6", col: CYAN },
        { k: "IN $/1M", v: "$" + MODELS[0].inPrice + " / $" + MODELS[2].inPrice, col: TEXT },
        { k: "OUT $/1M", v: "$" + outA + " / $" + outB, col: RED },
        { k: "GAP",     v: gapMultiplier.toFixed(1) + "x", col: CYAN }
      ];
      var cellGap = compact ? 4 : 6;
      var cellW = (w - pad * 2 - cellGap * 4) / 5;
      for (var ki = 0; ki < 5; ki++) {
        var kx = pad + ki * (cellW + cellGap);
        c.fillStyle = CARD;
        roundRect(c, kx, pad * 0.7, cellW, kpiH, 5);
        c.fill();
        c.strokeStyle = LINE;
        c.lineWidth = 1;
        c.stroke();
        text(c, kpiItems[ki].k, kx + 6, pad * 0.7 + 11, compact ? 7 : 8, MUTED, "left", "700");
        text(c, kpiItems[ki].v, kx + 6, pad * 0.7 + kpiH - 12, compact ? 9 : 11.5, kpiItems[ki].col, "left", "700");
      }

      // Sub-header strip (scouting step + budget range)
      var subY = pad * 0.7 + kpiH + 10;
      text(c, "PRICE BOARD · $10–$20 EST", pad, subY, compact ? 8 : 9.5, DIM, "left", "700");
      text(c, "scouting step " + stepNum + "/4", w - pad, subY, compact ? 8 : 9.5, CYAN, "right", "700");

      // Middle area: Left = Waffle 2 columns ($6 vs $40), Right = 6.7x Multiplier Ring
      var midTop = subY + 12;
      var tableH = compact ? 64 : 74;
      var midH = Math.max(84, h - midTop - tableH - pad * 1.4);
      var leftW = Math.round((w - pad * 3) * 0.52);
      var rightX = pad * 2 + leftW;
      var rightW = w - rightX - pad;

      // Left box: PRICE BOARD waffle
      c.fillStyle = CARD;
      roundRect(c, pad, midTop, leftW, midH, 6);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      // Unit cell geometry: 4 cols x 10 rows = 40 units for B, 4 cols x 2 rows (6 units) for A
      var unitCols = 4, unitRowsB = 10;
      var wafflePadY = 24;
      var availWaffleH = Math.max(40, midH - wafflePadY - 22);
      var availColW = (leftW - 28) * 0.42;
      var slot = Math.floor(Math.min(availColW / unitCols, availWaffleH / unitRowsB));
      var uGap = Math.max(1.5, Math.round(slot * 0.22));
      var uSize = Math.max(3, slot - uGap);
      var colWidth = unitCols * (uSize + uGap) - uGap;
      var baseLineY = midTop + midH - 18;

      var colAX = pad + leftW * 0.28 - colWidth * 0.5;
      var colBX = pad + leftW * 0.72 - colWidth * 0.5;

      var litA = Math.max(1, Math.round(outA * prog));
      for (var ua = 0; ua < outA; ua++) {
        var ca = ua % unitCols, ra = Math.floor(ua / unitCols);
        var ux = colAX + ca * (uSize + uGap);
        var uy = baseLineY - (ra + 1) * (uSize + uGap) + uGap;
        c.fillStyle = ua < litA ? CYAN : "#0f172a";
        c.fillRect(ux, uy, uSize, uSize);
        if (ua >= litA) {
          c.strokeStyle = LINE; c.lineWidth = 0.7; c.strokeRect(ux, uy, uSize, uSize);
        }
      }
      text(c, "$" + outA, colAX + colWidth * 0.5, baseLineY - Math.ceil(outA / unitCols) * (uSize + uGap) - 7, compact ? 9 : 11, CYAN, "center", "700");
      text(c, "SWARM", colAX + colWidth * 0.5, baseLineY + 10, compact ? 7.5 : 8.5, DIM, "center", "600");

      var litB = Math.max(1, Math.round(outB * prog));
      for (var ub = 0; ub < outB; ub++) {
        var cb = ub % unitCols, rb = Math.floor(ub / unitCols);
        var ux2 = colBX + cb * (uSize + uGap);
        var uy2 = baseLineY - (rb + 1) * (uSize + uGap) + uGap;
        c.fillStyle = ub < litB ? RED : "#0f172a";
        c.fillRect(ux2, uy2, uSize, uSize);
        if (ub >= litB) {
          c.strokeStyle = LINE; c.lineWidth = 0.7; c.strokeRect(ux2, uy2, uSize, uSize);
        }
      }
      text(c, "$" + outB, colBX + colWidth * 0.5, baseLineY - unitRowsB * (uSize + uGap) - 7, compact ? 9 : 11, RED, "center", "700");
      text(c, "FABLE 5.2", colBX + colWidth * 0.5, baseLineY + 10, compact ? 7.5 : 8.5, DIM, "center", "600");

      // Right box: 6.7x Multiplier Ring
      c.fillStyle = CARD;
      roundRect(c, rightX, midTop, rightW, midH, 6);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var ringCx = rightX + rightW * 0.5;
      var ringCy = midTop + midH * 0.5;
      var ringR = Math.max(22, Math.min(rightW, midH) * 0.34);
      var ringThick = compact ? 6 : 9;

      c.strokeStyle = "#162032";
      c.lineWidth = ringThick;
      c.beginPath();
      c.arc(ringCx, ringCy, ringR, 0, Math.PI * 2);
      c.stroke();

      var targetFrac = 1 - (outA / outB); // 0.85
      var curFrac = targetFrac * prog;
      var aStart = -Math.PI * 0.5;
      var aEnd = aStart + Math.PI * 2 * curFrac;

      var ringGrad = c.createLinearGradient(ringCx - ringR, ringCy, ringCx + ringR, ringCy);
      ringGrad.addColorStop(0, CYAN);
      ringGrad.addColorStop(1, RED);
      c.strokeStyle = ringGrad;
      c.lineWidth = ringThick;
      c.lineCap = "round";
      c.beginPath();
      c.arc(ringCx, ringCy, ringR, aStart, aEnd);
      c.stroke();
      c.lineCap = "butt";

      // Glowing endpoint dot
      var dotX = ringCx + Math.cos(aEnd) * ringR;
      var dotY = ringCy + Math.sin(aEnd) * ringR;
      c.fillStyle = FG;
      c.beginPath(); c.arc(dotX, dotY, ringThick * 0.45, 0, Math.PI * 2); c.fill();

      text(c, gapMultiplier.toFixed(1) + "x", ringCx, ringCy - 4, compact ? 15 : 22, FG, "center", "700");
      text(c, "OUT GAP", ringCx, ringCy + (compact ? 11 : 15), compact ? 7.5 : 9, CYAN, "center", "700");

      // Bottom price comparison table (3 rows + computed delta)
      var tblY = midTop + midH + 8;
      var tblW = w - pad * 2;
      c.fillStyle = CARD;
      roundRect(c, pad, tblY, tblW, tableH, 6);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var rowStep = tableH / 4;
      var colX = [pad + 10, pad + tblW * 0.45, pad + tblW * 0.68, pad + tblW - 10];
      text(c, "MODEL", colX[0], tblY + rowStep * 0.55, compact ? 7.5 : 8.5, MUTED, "left", "700");
      text(c, "IN /1M", colX[1], tblY + rowStep * 0.55, compact ? 7.5 : 8.5, MUTED, "right", "700");
      text(c, "OUT /1M", colX[2], tblY + rowStep * 0.55, compact ? 7.5 : 8.5, MUTED, "right", "700");
      text(c, "DELTA", colX[3], tblY + rowStep * 0.55, compact ? 7.5 : 8.5, MUTED, "right", "700");

      for (var mi = 0; mi < MODELS.length; mi++) {
        var md = MODELS[mi];
        var ry = tblY + rowStep * (mi + 1.5);
        c.strokeStyle = "rgba(30, 41, 59, 0.7)";
        c.beginPath(); c.moveTo(pad + 6, tblY + rowStep * (mi + 1)); c.lineTo(pad + tblW - 6, tblY + rowStep * (mi + 1)); c.stroke();

        var deltaPct = Math.round(((md.outPrice - refOut) / refOut) * 100);
        var deltaTxt = mi === 2 ? "BASE" : (deltaPct + "%");
        var deltaCol = mi === 1 ? RED : (mi === 0 ? CYAN : DIM);

        text(c, md.name, colX[0], ry, compact ? 8 : 9.5, md.color, "left", "600");
        text(c, "$" + md.inPrice.toFixed(2), colX[1], ry, compact ? 8 : 9.5, TEXT, "right");
        text(c, "$" + md.outPrice.toFixed(2), colX[2], ry, compact ? 8 : 9.5, TEXT, "right");
        text(c, deltaTxt, colX[3], ry, compact ? 8 : 9.5, deltaCol, "right", "700");
      }

      return "Step " + stepNum + "/4 · " + gapMultiplier.toFixed(1) + "x";
    }, o);
  }

  /* #51 unitGapBoard — 價差板 §6.7 新式（A23Tex；S19 2026-11-17）
   * KPI 子窗列（GAP 為作用格）＋01 UNIT WAFFLE（作用欄框＋價差括號 orthPath／hotPacket／埠點）＋02 GAP RING（kvBlock）
   * ＋03 COST @ TOKENS 插畫顯影（develop＋游標 hotPacket）＋04 PRICE TABLE（埠點＋虛點引導；唯一作用列 activeHalo；省下比例語意綠）。
   * 單色 6 階；小卡資訊字 infoFont+2。無 A23Tex 時回退 unitGapBoardLegacy。 */
  function unitGapBoard(cv, _data, opt) {
    var TX = g.A23Tex; if (!TX) return unitGapBoardLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme("#22d3ee")), V = K.V, SG = "#22c55e";
    var o = opt || {}, nFrames = 48;
    var MODELS = [
      { name: "Grok 4.6 Swarm", short: "SWARM", inP: 2, outP: 6 },
      { name: "Fable 5.0", short: "F5.0", inP: 4, outP: 32 },
      { name: "Fable 5.2", short: "F5.2", inP: 5, outP: 40 }
    ];
    var outA = MODELS[0].outP, outB = MODELS[2].outP, gapX = outB / outA, save = outB - outA;
    function dPct(p) { var d = Math.round((p - outB) / outB * 100); return d < 0 ? "−" + (-d) + "%" : (d === 0 ? "BASE" : "+" + d + "%"); }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var f = K.infoFont(w), F = compact ? f + 2 : f, pad = compact ? 6 : 10, gap = compact ? 5 : 8, topH = compact ? 16 : 24;
      var u = K.clamp(t / (nFrames - 6), 0, 1), prog = 0.16 + 0.84 * u, step = Math.min(4, Math.floor(t / 12) + 1);
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 6 : 8, V.dot);
      K.tx(c, K.fitM(c, "PRICE BOARD · OUT $/1M", w * 0.66, F, "700"), pad, topH * 0.5, F, V.dim, "left", "700");
      K.tx(c, "STEP " + step + "/4", w - pad, topH * 0.5, F, V.acc2, "right", "700");

      function head(b, l, r) {
        K.pane(c, b); K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
        var hy = b.y + 4 + F * 0.5;
        K.tx(c, K.fitM(c, l, b.w * (r ? 0.62 : 0.9), F, "700"), b.x + 6, hy, F, V.dim, "left", "700");
        if (r) K.tx(c, r, b.x + b.w - 6, hy, F, V.acc2, "right", "700");
        return b.y + F + 8;
      }

      /* ── KPI 子窗列（GAP＝唯一作用格：側條＋亮鏡面） ── */
      var kpi = compact
        ? [["WORKERS", "8/8", false], ["OUT", "$" + outA + "/$" + outB, false], ["GAP", gapX.toFixed(1) + "x", true]]
        : [["WORKERS", "8/8", false], ["MODEL", "Grok 4.6", false], ["IN $/1M", "$" + MODELS[0].inP + " / $" + MODELS[2].inP, false],
           ["OUT $/1M", "$" + outA + " / $" + outB, false], ["GAP", gapX.toFixed(1) + "x", true]];
      var kH = compact ? 26 : 40, nK = kpi.length, kW = (w - pad * 2 - gap * (nK - 1)) / nK, kY = topH;
      for (var ki = 0; ki < nK; ki++) {
        var kb = { x: pad + ki * (kW + gap), y: kY, w: kW, h: kH }, on = kpi[ki][2], vF = F + (compact ? 1 : 3);
        K.pane(c, kb); K.specEdge(c, kb.x + 3, kb.y + 1, kb.w - 6, on ? 0.18 : 0.08);
        K.tx(c, kpi[ki][0], kb.x + 7, kb.y + kH * 0.3, F - 1, V.dim, "left", "700");
        K.tx(c, K.fitM(c, kpi[ki][1], kb.w - 12, vF, "700"), kb.x + 7, kb.y + kH * 0.7, vF, on ? V.ink : V.txt, "left", "700");
        if (on) { c.fillStyle = V.acc; c.fillRect(kb.x + 1, kb.y + 4, 2, kH - 8); }
      }

      /* ── 版面：桌面 [WAFFLE|RING|COST]＋TABLE 整列；小卡 2×2 ── */
      var y0 = kY + kH + gap, availW = w - pad * 2, bW, bR, bD, bT;
      if (!compact) {
        var tH = Math.round(F * 1.9 * 4 + 16), mH = h - pad - tH - gap - y0;
        var wW = Math.round((availW - gap * 2) * 0.40), rW = Math.round((availW - gap * 2) * 0.27), dW = availW - gap * 2 - wW - rW;
        bW = { x: pad, y: y0, w: wW, h: mH }; bR = { x: pad + wW + gap, y: y0, w: rW, h: mH };
        bD = { x: bR.x + rW + gap, y: y0, w: dW, h: mH }; bT = { x: pad, y: y0 + mH + gap, w: availW, h: tH };
      } else {
        var rest = h - pad - y0, mH2 = Math.round((rest - gap) * 0.56), bH2 = rest - gap - mH2, hw = (availW - gap) / 2;
        bW = { x: pad, y: y0, w: hw, h: mH2 }; bR = { x: pad + hw + gap, y: y0, w: hw, h: mH2 };
        bD = { x: pad, y: y0 + mH2 + gap, w: hw, h: bH2 }; bT = { x: pad + hw + gap, y: y0 + mH2 + gap, w: hw, h: bH2 };
      }

      /* ── 01 UNIT WAFFLE：$1＝1 格；SWARM 作用欄框；價差括號＋熱封包 ── */
      var wTop = head(bW, compact ? "01 UNITS" : "01 UNIT WAFFLE", "$1=1");
      var nameH = F + 6, brH = F + 12, gTop = wTop + brH, gBot = bW.y + bW.h - nameH - 4;
      var cols = 4, rowsB = Math.ceil(outB / cols);
      var slot = Math.max(3, Math.floor(Math.min((bW.w * 0.36) / cols, (gBot - gTop) / rowsB)));
      var ug = Math.max(1, Math.round(slot * 0.22)), us = Math.max(2, slot - ug), cw = cols * slot - ug;
      var aX = Math.round(bW.x + bW.w * 0.27 - cw / 2), bX = Math.round(bW.x + bW.w * 0.70 - cw / 2);
      var litA = Math.max(1, Math.round(outA * prog)), litB = Math.max(1, Math.round(outB * prog));
      function units(x0, n, lit, colOn) {
        for (var i = 0; i < n; i++) {
          var ux = x0 + (i % cols) * slot, uy = gBot - (Math.floor(i / cols) + 1) * slot + ug;
          if (i < lit) { c.fillStyle = colOn; c.fillRect(ux, uy, us, us); }
          else { c.strokeStyle = V.line; c.lineWidth = 1; c.strokeRect(ux + 0.5, uy + 0.5, us - 1, us - 1); }
        }
      }
      units(aX, outA, litA, V.acc2);
      units(bX, outB, litB, V.dim);
      var aTopY = gBot - Math.ceil(outA / cols) * slot + ug, bTopY = gBot - rowsB * slot + ug;
      c.strokeStyle = V.acc2; c.lineWidth = 1; K.roundRect(c, aX - 3.5, aTopY - 3.5, cw + 7, gBot - aTopY + 7, 3); c.stroke();
      var axC = aX + cw / 2, bxC = bX + cw / 2, yBr = bTopY - 6;
      var brPts = [[axC, aTopY - 5], [axC, yBr], [bxC, yBr], [bxC, bTopY - 2]];
      c.setLineDash([2, 2]); c.strokeStyle = V.line2; c.lineWidth = 1; K.orthPath(c, brPts, 3); c.setLineDash([]);
      K.kvPort(c, brPts[0][0], brPts[0][1], true); K.kvPort(c, brPts[3][0], brPts[3][1], false);
      K.hotPacket(c, brPts, (t * 0.045) % 1, V.acc, compact ? 1.8 : 2.6);
      K.tx(c, "+$" + save + " · " + gapX.toFixed(1) + "x", (axC + bxC) / 2, yBr - 5 - F * 0.5, F, V.ink, "center", "700");
      var nmY = gBot + 4 + F * 0.5;
      K.tx(c, "SWARM $" + outA, axC, nmY, F, V.acc2, "center", "700");
      K.tx(c, "F5.2 $" + outB, bxC, nmY, F, V.dim, "center", "600");

      /* ── 02 GAP RING：省下 85% 弧＋10% 刻度＋kvBlock ── */
      var rTop = head(bR, compact ? "02 GAP" : "02 GAP RING", "OUT");
      var kvRows = [["save/1M", "$" + save, true], ["share", Math.round(outA / outB * 100) + "%", false], ["ratio", gapX.toFixed(1) + "x", false]];
      var kvH = compact ? 0 : 3 * (F + Math.max(5, Math.round(F * 0.8))) + 4;
      var rA = { x: bR.x, y: rTop, w: bR.w, h: bR.y + bR.h - rTop - kvH - 2 };
      var rcx = rA.x + rA.w / 2, rcy = rA.y + rA.h / 2, th = compact ? 5 : 8;
      var rr = Math.max(14, Math.min(rA.w, rA.h) * 0.36);
      c.strokeStyle = V.track; c.lineWidth = th; c.beginPath(); c.arc(rcx, rcy, rr, 0, Math.PI * 2); c.stroke();
      var a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * (1 - outA / outB) * prog;
      c.strokeStyle = V.acc; c.lineCap = "round"; c.beginPath(); c.arc(rcx, rcy, rr, a0, a1); c.stroke(); c.lineCap = "butt";
      c.strokeStyle = V.line2; c.lineWidth = 1;
      for (var tk = 0; tk < 10; tk++) {
        var ta = a0 + tk * Math.PI / 5, r1 = rr + th / 2 + 2, r2 = r1 + (compact ? 2 : 3);
        K.ln(c, rcx + Math.cos(ta) * r1, rcy + Math.sin(ta) * r1, rcx + Math.cos(ta) * r2, rcy + Math.sin(ta) * r2);
      }
      c.fillStyle = V.ink; c.beginPath(); c.arc(rcx + Math.cos(a1) * rr, rcy + Math.sin(a1) * rr, th * 0.42, 0, Math.PI * 2); c.fill();
      K.tx(c, gapX.toFixed(1) + "x", rcx, rcy - F * 0.35, compact ? F + 5 : Math.round(F * 2.2), V.ink, "center", "700");
      K.tx(c, "OUT GAP", rcx, rcy + (compact ? F * 0.95 : F * 1.35), F, V.acc2, "center", "700");
      if (kvH) K.kvBlock(c, { x: bR.x + 6, y: bR.y + bR.h - kvH - 2, w: bR.w - 10, h: kvH }, kvRows, F, bR.x + 0.5);

      /* ── 03 COST @ TOKENS：成本線插畫顯影＋游標熱封包 ── */
      var dTop = head(bD, compact ? "03 COST" : "03 COST @ TOKENS", "0→1M");
      var cRows = [["tokens", prog.toFixed(2) + "M", false], ["swarm", "$" + (outA * prog).toFixed(2), true], ["fable 5.2", "$" + (outB * prog).toFixed(2), false]];
      var cKvH = compact ? 0 : 3 * (F + Math.max(5, Math.round(F * 0.8))) + 4, lblW = Math.round(F * 2.6);
      var pl = { x: bD.x + 8, y: dTop + 4, w: bD.w - 8 - lblW - 8, h: bD.y + bD.h - dTop - 10 - cKvH };
      var devP = K.clamp(u * 1.6, 0, 1), pB = pl.y + pl.h;
      function yC(cost) { return pB - cost / outB * pl.h; }
      K.develop(c, { x: pl.x - 2, y: pl.y - 2, w: pl.w + 4, h: pl.h + 4 }, devP, function (cc, col, lit) {
        cc.strokeStyle = col; cc.lineWidth = 1; cc.setLineDash([]);
        K.ln(cc, pl.x, pl.y, pl.x, pB); K.ln(cc, pl.x, pB, pl.x + pl.w, pB);
        for (var gi = 1; gi < 4; gi++) { var gy = Math.round(pB - pl.h * gi / 4) + 0.5; cc.setLineDash([1, 3]); K.ln(cc, pl.x, gy, pl.x + pl.w, gy); }
        cc.setLineDash([]);
        for (var mi = 0; mi < 3; mi++) {
          cc.lineWidth = mi === 0 ? 2 : 1; if (mi === 1) cc.setLineDash([3, 2]);
          K.ln(cc, pl.x, pB, pl.x + pl.w, yC(MODELS[mi].outP)); cc.setLineDash([]);
        }
      });
      for (var li = 0; li < 3; li++) {
        var ly = yC(MODELS[li].outP), lyT = li === 1 ? Math.min(ly + F + 1, yC(outA) - F - 1) : ly;
        K.tx(c, "$" + MODELS[li].outP, pl.x + pl.w + 5, lyT, F, li === 0 ? V.acc2 : V.dim, "left", li === 0 ? "700" : "600");
      }
      var cx0 = pl.x + pl.w * prog;
      c.setLineDash([1, 2]); c.strokeStyle = V.line2; c.lineWidth = 1; K.ln(c, Math.round(cx0) + 0.5, pl.y, Math.round(cx0) + 0.5, pB); c.setLineDash([]);
      K.hotPacket(c, [[pl.x, pB], [pl.x + pl.w, yC(outA)]], prog, V.acc, compact ? 1.8 : 2.6);
      if (cKvH) K.kvBlock(c, { x: bD.x + 6, y: bD.y + bD.h - cKvH - 2, w: bD.w - 10, h: cKvH }, cRows, F, bD.x + 0.5);

      /* ── 04 PRICE TABLE：埠點＋虛點引導；SWARM＝唯一作用列 ── */
      if (!compact) {
        /* ── 05 GAP DRIFT：雙時框列（短 5m × 12 格／長 15m × 4 格，對齊同一時距）＋紅綠發散（Polymarket RESOLUTION GRID 借鏡） ── */
        var gW5 = Math.round((availW - gap) * 0.40), RD = "#ef4444";
        var bG = { x: pad + availW - gW5, y: bT.y, w: gW5, h: bT.h };
        bT = { x: bT.x, y: bT.y, w: availW - gap - gW5, h: bT.h };
        var gTop5 = head(bG, "05 GAP DRIFT · 5m / 15m", "Δ vs " + gapX.toFixed(1) + "x");
        var N5 = 12, d5 = [], d15 = [];
        for (var di = 0; di < N5; di++) d5.push(K.clamp(0.85 * Math.sin(di * 1.7 + 0.6) * Math.cos(di * 0.53) + 0.18, -1, 1));
        for (var dj = 0; dj < 4; dj++) d15.push((d5[dj * 3] + d5[dj * 3 + 1] + d5[dj * 3 + 2]) / 3);
        var lgH = F + 6, lbW = Math.round(F * 5.2), gx0 = bG.x + 6 + lbW, gx1 = bG.x + bG.w - 8;
        var rowGH = Math.max(F + 4, Math.floor((bG.y + bG.h - gTop5 - lgH - 6) / 2)), cG = 2;
        var cw5 = (gx1 - gx0 - cG * (N5 - 1)) / N5, lit5 = Math.max(1, Math.round(N5 * prog)), agree = 0, done15 = 0;
        function dCell(x, y, cw, ch, d, on, hot) {
          if (!on) { c.strokeStyle = V.line; c.lineWidth = 1; c.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(cw) - 1, Math.round(ch) - 1); return; }
          c.globalAlpha = 0.22 + 0.68 * Math.min(1, Math.abs(d)); c.fillStyle = d >= 0 ? SG : RD;
          c.fillRect(Math.round(x), Math.round(y), Math.round(cw), Math.round(ch)); c.globalAlpha = 1;
          if (cw > F * 2.4) K.tx(c, (Math.round(d * 10) > 0 ? "+" : (Math.round(d * 10) < 0 ? "−" : "±")) + Math.abs(Math.round(d * 10) / 10).toFixed(1), x + cw / 2, y + ch / 2, F - 1, V.ink, "center", "700");
          if (hot) { c.strokeStyle = V.ink; c.lineWidth = 1; c.strokeRect(Math.round(x) - 0.5, Math.round(y) - 0.5, Math.round(cw) + 1, Math.round(ch) + 1); }
        }
        var ry5 = gTop5 + 2, ry15 = ry5 + rowGH + 4;
        K.tx(c, "SHORT 5m", bG.x + 6, ry5 + rowGH / 2, F, V.dim, "left", "700");
        K.tx(c, "LONG 15m", bG.x + 6, ry15 + rowGH / 2, F, V.dim, "left", "700");
        for (var c5 = 0; c5 < N5; c5++) dCell(gx0 + c5 * (cw5 + cG), ry5, cw5, rowGH, d5[c5], c5 < lit5, c5 === lit5 - 1);
        for (var c15 = 0; c15 < 4; c15++) {
          var on15 = (c15 + 1) * 3 <= lit5, x15 = gx0 + c15 * 3 * (cw5 + cG);
          dCell(x15, ry15, cw5 * 3 + cG * 2, rowGH, d15[c15], on15, false);
          if (on15) { done15++; for (var k3 = 0; k3 < 3; k3++) if ((d5[c15 * 3 + k3] >= 0) === (d15[c15] >= 0)) agree++; }
        }
        var lgY = bG.y + bG.h - lgH / 2 - 2;
        c.fillStyle = SG; c.fillRect(bG.x + 6, Math.round(lgY - 3), 6, 6); K.tx(c, "cheaper", bG.x + 16, lgY, F - 1, V.txt, "left", "600");
        c.fillStyle = RD; c.fillRect(bG.x + 16 + F * 4.2, Math.round(lgY - 3), 6, 6); K.tx(c, "dearer", bG.x + 26 + F * 4.2, lgY, F - 1, V.txt, "left", "600");
        K.tx(c, "5m↔15m agree " + agree + "/" + done15 * 3, gx1, lgY, F - 1, V.acc2, "right", "700");

        var tTop = head(bT, "04 PRICE TABLE");
        var cIn = bT.x + bT.w * 0.56, cOut = bT.x + bT.w * 0.74, cD = bT.x + bT.w - 12, hy = bT.y + 4 + F * 0.5;
        K.tx(c, "IN /1M", cIn, hy, F, V.dim, "right", "700"); K.tx(c, "OUT /1M", cOut, hy, F, V.dim, "right", "700");
        K.tx(c, "Δ OUT", cD, hy, F, V.dim, "right", "700");
        var rowH = (bT.y + bT.h - tTop - 2) / 3;
        for (var ri = 0; ri < 3; ri++) {
          var md = MODELS[ri], ry = Math.round(tTop + rowH * (ri + 0.5)), act = ri === 0;
          if (act) K.activeHalo(c, bT.x + 10, ry - F * 0.5 - 1, bT.w - 20, F + 2, 8);
          K.kvPort(c, bT.x + 0.5, ry, act);
          K.leader(c, md.name, "$" + md.inP.toFixed(2), bT.x + 14, cIn, ry, F, act);
          K.tx(c, "$" + md.outP.toFixed(2), cOut, ry, F, act ? V.ink : V.txt, "right", "600");
          K.tx(c, dPct(md.outP), cD, ry, F, act ? SG : (ri === 2 ? V.dim : V.txt), "right", "700");
        }
      } else {
        var tTop2 = head(bT, "04 Δ vs F5.2", "OUT");
        var rowH2 = (bT.y + bT.h - tTop2 - 2) / 3;
        for (var rj = 0; rj < 3; rj++) {
          var mj = MODELS[rj], ry2 = Math.round(tTop2 + rowH2 * (rj + 0.5)), act2 = rj === 0;
          if (act2) { c.strokeStyle = V.acc2; c.lineWidth = 1; K.roundRect(c, bT.x + 3.5, ry2 - F * 0.5 - 2.5, bT.w - 7, F + 5, 2); c.stroke(); }
          K.kvPort(c, bT.x + 0.5, ry2, act2);
          K.leader(c, mj.short, "$" + mj.outP, bT.x + 7, bT.x + bT.w * 0.62, ry2, F, act2);
          K.tx(c, dPct(mj.outP), bT.x + bT.w - 7, ry2, F, act2 ? SG : (rj === 2 ? V.dim : V.txt), "right", "700");
        }
      }

      return "Step " + step + "/4 · " + gapX.toFixed(1) + "x";
    }, o);
  }

  /* #52 moduleMultiples — 小倍數組合框 (driver n=60) */
  function moduleMultiplesLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var TITLES = ["WORKERS", "FIELDS", "CONTEXT", "CONFLICTS", "MAP"];

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var pad = compact ? 7 : 11;
      var topH = compact ? 20 : 24;
      var u = clamp(t / (nFrames - 1), 0, 1);

      text(c, "MODULE VIEW · SMALL MULTIPLES", pad, topH * 0.5, compact ? 8.5 : 10, DIM, "left", "700");
      text(c, "F" + (Math.floor(t) + 1) + "/60", w - pad, topH * 0.5, compact ? 8.5 : 9.5, CYAN, "right", "700");

      // Compute 5 panel boxes (5-across on desktop, 2-col grid on compact)
      var boxes = [];
      var availW = w - pad * 2;
      var availH = h - topH - pad;
      var gap = compact ? 6 : 8;

      if (!compact) {
        var pw = (availW - gap * 4) / 5;
        for (var i = 0; i < 5; i++) {
          boxes.push({ x: pad + i * (pw + gap), y: topH + 2, w: pw, h: availH });
        }
      } else {
        var cw = (availW - gap) / 2;
        var rh = (availH - gap * 2) / 3;
        boxes.push({ x: pad, y: topH + 2, w: cw, h: rh });
        boxes.push({ x: pad + cw + gap, y: topH + 2, w: cw, h: rh });
        boxes.push({ x: pad, y: topH + 2 + rh + gap, w: cw, h: rh });
        boxes.push({ x: pad + cw + gap, y: topH + 2 + rh + gap, w: cw, h: rh });
        boxes.push({ x: pad, y: topH + 2 + (rh + gap) * 2, w: availW, h: rh });
      }

      // Pre-evaluate conflicts 8x8 tri-state matrix at time t
      var mat = new Array(64);
      var clearRows = 0, resolvedCount = 0;
      for (var r = 0; r < 8; r++) {
        var rowConflict = false;
        for (var col = 0; col < 8; col++) {
          var idx = r * 8 + col;
          if (r === col) {
            mat[idx] = 0; // agree
          } else {
            var revAt = 0.08 + 0.72 * hashLcg(Math.min(r, col) * 13 + Math.max(r, col), 503);
            if (u < revAt) {
              mat[idx] = -1; // no evidence
            } else {
              resolvedCount++;
              var isConf = ((r === 2 && col === 5) || (r === 5 && col === 2)) && (t >= 12 && t <= 42);
              var randConf = hashLcg(idx, 607) < 0.06 && t < 38;
              if (isConf || randConf) { mat[idx] = 1; rowConflict = true; }
              else mat[idx] = 0;
            }
          }
        }
        if (!rowConflict) clearRows++;
      }

      var bigVals = ["8", "4", "1M", String(clearRows), "8+1"];
      var subVals = ["8 parallel", "4 per report", "1M", "clear/" + Math.max(8, Math.round(resolvedCount / 7)), "8+1"];

      for (var pi = 0; pi < 5; pi++) {
        var bx = boxes[pi];
        c.fillStyle = CARD;
        roundRect(c, bx.x, bx.y, bx.w, bx.h, 6);
        c.fill();
        c.strokeStyle = LINE;
        c.lineWidth = 1;
        c.stroke();

        var hdrY = bx.y + (compact ? 11 : 14);
        text(c, TITLES[pi], bx.x + bx.w * 0.5, hdrY, compact ? 8 : 9.5, CYAN, "center", "700");

        var footH = compact ? 26 : 36;
        var vx = bx.x + 8;
        var vy = hdrY + 9;
        var vw = bx.w - 16;
        var vh = Math.max(24, bx.h - (hdrY - bx.y) - footH - 12);

        if (pi === 0) {
          // 1. WORKERS: 8 horizontal bars
          var barGap = 2.5;
          var bh = Math.max(2.5, (vh - barGap * 7) / 8);
          for (var wi = 0; wi < 8; wi++) {
            var wProg = clamp((u * 1.25 - wi * 0.05) * (0.85 + 0.3 * hashLcg(wi, 19)), 0.12, 1);
            var wConf = (wi === 2 && t >= 12 && t <= 36);
            var by = vy + wi * (bh + barGap);
            c.fillStyle = "#0f172a";
            c.fillRect(vx, by, vw, bh);
            c.fillStyle = wConf ? RED : (wProg > 0.96 ? FG : CYAN);
            c.fillRect(vx, by, vw * wProg, bh);
          }
        } else if (pi === 1) {
          // 2. FIELDS: 4 x 8 dot matrix (JOB/FN/IN/OUT)
          var F_LBL = ["JOB", "FN", "IN", "OUT"];
          var lblOff = vw > 65 ? 24 : 0;
          var gridW = vw - lblOff;
          var dx = gridW / 8, dy = vh / 4;
          var rad = Math.max(1.8, Math.min(dx, dy) * 0.30);
          for (var fr = 0; fr < 4; fr++) {
            if (lblOff > 0) text(c, F_LBL[fr], vx, vy + (fr + 0.5) * dy, 7, DIM, "left", "600");
            for (var fc = 0; fc < 8; fc++) {
              var thr = (fc * 0.08 + fr * 0.14);
              var lit = u >= thr;
              var flagged = fr === 3 && fc === 5 && t >= 16 && t <= 38;
              c.fillStyle = flagged ? RED : (lit ? CYAN : "#162032");
              c.beginPath();
              c.arc(vx + lblOff + (fc + 0.5) * dx, vy + (fr + 0.5) * dy, rad, 0, Math.PI * 2);
              c.fill();
            }
          }
        } else if (pi === 2) {
          // 3. CONTEXT: 12 vertical bars (1M window)
          var cGap = 2.5;
          var cbw = Math.max(2.5, (vw - cGap * 11) / 12);
          for (var ci = 0; ci < 12; ci++) {
            var baseV = 0.25 + 0.65 * hashLcg(ci, 313);
            var wave = 0.72 + 0.28 * Math.sin(t * 0.26 + ci * 0.65);
            var ch = clamp(baseV * wave * (0.35 + 0.65 * u), 0.1, 1) * vh;
            var cx2 = vx + ci * (cbw + cGap);
            c.fillStyle = "#0f172a";
            c.fillRect(cx2, vy, cbw, vh);
            c.fillStyle = ch / vh > 0.84 ? RED : CYAN;
            c.fillRect(cx2, vy + vh - ch, cbw, ch);
          }
        } else if (pi === 3) {
          // 4. CONFLICTS: 8x8 tri-state matrix (agree gray / conflict red / no-evidence dark)
          var mSize = Math.min(vw, vh);
          var mx0 = vx + (vw - mSize) * 0.5;
          var my0 = vy + (vh - mSize) * 0.5;
          var stepM = mSize / 8;
          var padM = Math.max(0.8, stepM * 0.14);
          for (var mr = 0; mr < 8; mr++) {
            for (var mc = 0; mc < 8; mc++) {
              var stVal = mat[mr * 8 + mc];
              c.fillStyle = stVal === 1 ? RED : (stVal === 0 ? "#64748b" : "#0f172a");
              c.fillRect(mx0 + mc * stepM + padM, my0 + mr * stepM + padM, stepM - padM * 2, stepM - padM * 2);
            }
          }
        } else {
          // 5. MAP: mini network 8 + 1 nodes
          var mcx = vx + vw * 0.5;
          var mcy = vy + vh * 0.5;
          var mRad = Math.max(10, Math.min(vw, vh) * 0.38);
          for (var mi = 0; mi < 8; mi++) {
            var ma = -Math.PI * 0.5 + mi * (Math.PI * 2 / 8);
            var mnx = mcx + Math.cos(ma) * mRad;
            var mny = mcy + Math.sin(ma) * mRad;
            var isC = (mi === 2 && t >= 12 && t <= 36);
            c.strokeStyle = isC ? "rgba(244,63,94,0.6)" : "rgba(34,211,238,0.4)";
            c.lineWidth = 1;
            c.beginPath(); c.moveTo(mcx, mcy); c.lineTo(mnx, mny); c.stroke();

            // Traveling pulse dot along edge
            var pU = (t * 0.18 + mi * 0.125) % 1;
            c.fillStyle = isC ? RED : FG;
            c.beginPath();
            c.arc(lerp(mcx, mnx, pU), lerp(mcy, mny, pU), 1.6, 0, Math.PI * 2);
            c.fill();

            c.fillStyle = isC ? RED : CYAN;
            c.beginPath(); c.arc(mnx, mny, compact ? 2.6 : 3.4, 0, Math.PI * 2); c.fill();
          }
          c.fillStyle = FG;
          c.beginPath(); c.arc(mcx, mcy, compact ? 3.5 : 4.5, 0, Math.PI * 2); c.fill();
        }

        // Bottom big number + small sub-label
        var bigY = bx.y + bx.h - (compact ? 15 : 22);
        var subY2 = bx.y + bx.h - (compact ? 6 : 9);
        text(c, bigVals[pi], bx.x + bx.w * 0.5, bigY, compact ? 11 : 15, FG, "center", "700");
        text(c, subVals[pi], bx.x + bx.w * 0.5, subY2, compact ? 7 : 8, DIM, "center", "600");
      }

      return "Frame " + (Math.floor(t) + 1) + "/60";
    }, o);
  }

  /* #52 moduleMultiples — 小倍數組合框 §6.7 新式（A23Tex；S16 2026-11-17）
   * 五格同構：標題列＋主圖＋鍵值列（壓框埠點）＋大數；MAP 格＝網路插畫顯影＋輻條展開車道（hotPacket）＋單一作用車道光暈。
   * 無 A23Tex 時回退 moduleMultiplesLegacy。 */
  function moduleMultiples(cv, _data, opt) {
    var TX = g.A23Tex; if (!TX) return moduleMultiplesLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme("#22d3ee")), V = K.V, SR = "#f43f5e";
    var o = opt || {}, nFrames = 60;
    var TITLES = ["WORKERS", "FIELDS", "CONTEXT", "CONFLICTS", "MAP"];

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var f = K.infoFont(w), pad = compact ? 6 : 10, topH = compact ? 16 : 24, gap = compact ? 5 : 8;
      var u = K.clamp(t / (nFrames - 1), 0, 1), ti = Math.floor(t);
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 6 : 8, V.dot);
      K.tx(c, K.fitM(c, "MODULE VIEW · SMALL MULTIPLES", w * 0.72, f, "700"), pad, topH * 0.5, f, V.dim, "left", "700");
      K.tx(c, "F" + (ti + 1) + "/60", w - pad, topH * 0.5, f, V.acc2, "right", "700");

      /* ── 狀態（全部由 t 決定） ── */
      var wk = [], nDone = 0, nBlock = 0;
      for (var wi = 0; wi < 8; wi++) {
        var wp = K.clamp((u * 1.25 - wi * 0.05) * (0.85 + 0.3 * K.hh(wi, 19)), 0.12, 1);
        var wc = wi === 2 && t >= 12 && t <= 36;
        wk.push({ p: wp, c: wc });
        if (wc) nBlock++; else if (wp > 0.96) nDone++;
      }
      var fLit = 0, fFlag = t >= 16 && t <= 38;
      for (var fr0 = 0; fr0 < 4; fr0++) for (var fc0 = 0; fc0 < 8; fc0++) if (u >= fc0 * 0.08 + fr0 * 0.14) fLit++;
      var ctx = [], peak = 0, avg = 0, over = 0;
      for (var ci = 0; ci < 12; ci++) {
        var cv0 = K.clamp((0.25 + 0.65 * K.hh(ci, 313)) * (0.72 + 0.28 * Math.sin(t * 0.26 + ci * 0.65)) * (0.35 + 0.65 * u), 0.1, 1);
        ctx.push(cv0); avg += cv0 / 12; if (cv0 > peak) peak = cv0; if (cv0 > 0.84) over++;
      }
      var mat = new Array(64), clearRows = 0, resolved = 0;
      for (var r = 0; r < 8; r++) {
        var rowC = false;
        for (var col = 0; col < 8; col++) {
          var idx = r * 8 + col;
          if (r === col) { mat[idx] = 0; continue; }
          var revAt = 0.08 + 0.72 * K.hh(Math.min(r, col) * 13 + Math.max(r, col), 503);
          if (u < revAt) { mat[idx] = -1; continue; }
          resolved++;
          var isC = ((r === 2 && col === 5) || (r === 5 && col === 2)) && t >= 12 && t <= 42;
          var rnd = K.hh(Math.min(r, col) * 8 + Math.max(r, col), 607) < 0.06 && t < 38;
          if (isC || rnd) { mat[idx] = 1; rowC = true; } else mat[idx] = 0;
        }
        if (!rowC) clearRows++;
      }
      var noevP = 0; // 三態證據：-1＝no-evidence（≈E0 待驗證，僅導航）
      for (var nr0 = 0; nr0 < 8; nr0++) for (var nc0 = nr0 + 1; nc0 < 8; nc0++) if (mat[nr0 * 8 + nc0] === -1) noevP++;
      var mConf = t >= 12 && t <= 36, act = mConf ? 2 : Math.floor(t / 7.5) % 8;
      var devP = K.clamp(u * 1.8, 0, 1);

      var big = [nDone + "/8", fLit + "/32", Math.round(peak * 100) + "%", clearRows + "/8", "8+1"];
      var sub = ["done", "fields", "peak", "clear", "nodes"];
      var alert = [nBlock > 0, fFlag, peak > 0.84, clearRows < 8, mConf];
      var kvs = [
        [["run", String(8 - nDone - nBlock), false], ["block", String(nBlock), nBlock > 0], ["par", "8", false]],
        [["rpt", "4", false], ["flag", fFlag ? "OUT·6" : "0", fFlag], ["cols", "8", false]],
        [["avg", Math.round(avg * 100) + "%", false], ["over", String(over), over > 0], ["win", "1M", false]],
        [["open", String(8 - clearRows), clearRows < 8], ["res", Math.round(resolved / 56 * 100) + "%", false], ["noev", String(noevP), noevP > 0]],
        [["hub", "8+1", false], ["pkt", "N" + (act + 1), !mConf], ["alert", mConf ? "N3" : "—", mConf]]
      ];

      /* ── 版面：桌面 5 欄；縮圖 2×2＋MAP 整列 ── */
      var boxes = [], availW = w - pad * 2, availH = h - topH - pad;
      if (!compact) {
        var pw = (availW - gap * 4) / 5;
        for (var i = 0; i < 5; i++) boxes.push({ x: pad + i * (pw + gap), y: topH, w: pw, h: availH });
      } else {
        var cw = (availW - gap) / 2, rh = (availH - gap * 2) / 3;
        boxes.push({ x: pad, y: topH, w: cw, h: rh }, { x: pad + cw + gap, y: topH, w: cw, h: rh },
          { x: pad, y: topH + rh + gap, w: cw, h: rh }, { x: pad + cw + gap, y: topH + rh + gap, w: cw, h: rh },
          { x: pad, y: topH + (rh + gap) * 2, w: availW, h: rh });
      }

      function lanes(lx, ly, lw, lh, withLbl) {
        var step = lh / 8, trackX = lx + (withLbl ? f * 2 + 4 : 0), trackW = lx + lw - trackX;
        for (var li = 0; li < 8; li++) {
          var y = Math.round(ly + step * (li + 0.5)) + 0.5, isAct = li === act, cf = mConf && li === 2;
          if (withLbl) K.tx(c, "N" + (li + 1), lx, y, f, isAct ? V.ink : V.dim, "left", isAct ? "700" : "600");
          c.strokeStyle = cf ? K.rgba(SR, 0.55) : (isAct ? V.line2 : V.track); c.lineWidth = 1;
          K.ln(c, trackX, y, trackX + trackW, y);
          var pU = (t * 0.18 + li * 0.125) % 1, pts = [[trackX, y], [trackX + trackW, y]];
          if (isAct) {
            if (!compact) K.activeHalo(c, trackX, y - 3, trackW, 6, 8);
            else { c.strokeStyle = V.acc2; c.lineWidth = 1; K.roundRect(c, trackX - 1.5, y - 2.5, trackW + 3, 5, 2); c.stroke(); }
            K.hotPacket(c, pts, pU, cf ? SR : V.acc, compact ? 1.8 : 2.6);
          } else {
            c.fillStyle = cf ? SR : V.acc2; c.beginPath(); c.arc(K.lerp(trackX, trackX + trackW, pU), y, compact ? 1.1 : 1.6, 0, Math.PI * 2); c.fill();
          }
        }
      }

      function network(nb) {
        var side = Math.min(nb.w, nb.h), cx = nb.x + nb.w * 0.5, cy = nb.y + nb.h * 0.5, R = side * 0.38;
        var nodes = [];
        for (var mi = 0; mi < 8; mi++) { var a = -Math.PI * 0.5 + mi * Math.PI / 4; nodes.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]); }
        c.strokeStyle = V.line; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
        K.develop(c, { x: nb.x, y: nb.y, w: nb.w, h: nb.h }, devP, function (cc, col, lit) {
          for (var k = 0; k < 8; k++) {
            var cf = lit && mConf && k === 2;
            cc.strokeStyle = cf ? SR : col; cc.lineWidth = 1;
            if (cf) cc.setLineDash([2, 2]);
            K.ln(cc, cx, cy, nodes[k][0], nodes[k][1]); cc.setLineDash([]);
            cc.fillStyle = cf ? SR : col; cc.beginPath(); cc.arc(nodes[k][0], nodes[k][1], compact ? 2 : 3.2, 0, Math.PI * 2); cc.fill();
          }
          cc.fillStyle = lit ? V.ink : col; cc.beginPath(); cc.arc(cx, cy, compact ? 3 : 4.6, 0, Math.PI * 2); cc.fill();
        });
        if (devP >= 1) K.hotPacket(c, [[cx, cy], nodes[act]], (t * 0.18 + act * 0.125) % 1, mConf ? SR : V.acc, compact ? 1.6 : 2.2);
        if (!compact) K.tx(c, "N1", nodes[0][0], nodes[0][1] - 9, f, V.dim, "center", "600");
      }

      for (var pi = 0; pi < 5; pi++) {
        var b = boxes[pi];
        K.pane(c, b); K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
        var titH = compact ? 11 : 18, tY = b.y + titH * 0.5 + 1;
        K.tx(c, K.fitM(c, "0" + (pi + 1) + " " + TITLES[pi], b.w - 18, f, "700"), b.x + 5, tY, f, V.acc2, "left", "700");
        c.fillStyle = alert[pi] ? SR : V.acc; c.beginPath(); c.arc(b.x + b.w - 7, tY, compact ? 1.6 : 2.2, 0, Math.PI * 2); c.fill();

        if (compact && pi === 4) {
          /* 縮圖 MAP 整列：網路顯影｜輻條車道｜鍵值列（4 列） */
          var cy0 = b.y + titH + 2, ch0 = b.h - titH - 5, side = Math.min(ch0, 56);
          network({ x: b.x + 6, y: cy0, w: side, h: ch0 });
          var lx = b.x + 6 + side + 8, lw = (b.w - side - 26) * 0.46;
          lanes(lx, cy0 + 1, lw, ch0 - 2, false);
          var kx = lx + lw + 8;
          c.strokeStyle = V.line; K.ln(c, kx - 4, cy0 + 2, kx - 4, cy0 + ch0 - 2);
          K.kvBlock(c, { x: kx, y: cy0, w: b.x + b.w - kx - 2, h: ch0 },
            kvs[4].concat([["live", "8/8", false]]), f, null);
          continue;
        }

        var nKv = compact ? 0 : 3, rowH = f + Math.max(5, Math.round(f * 0.8));
        var kvH = nKv ? nKv * rowH + 2 : 0, bigH = compact ? 12 : 28;
        var vz = { x: b.x + 6, y: b.y + titH + 3, w: b.w - 12, h: b.h - titH - 3 - kvH - bigH - (nKv ? 8 : 3) };
        var vx = vz.x, vy = vz.y, vw = vz.w, vh = vz.h;

        if (pi === 0) {
          var bg = 2.5, bh = Math.max(2, (vh - bg * 7) / 8);
          for (var a0 = 0; a0 < 8; a0++) {
            var by = vy + a0 * (bh + bg);
            c.fillStyle = V.track; c.fillRect(vx, by, vw, bh);
            c.fillStyle = wk[a0].c ? SR : (wk[a0].p > 0.96 ? V.acc3 : V.acc); c.fillRect(vx, by, vw * wk[a0].p, bh);
          }
        } else if (pi === 1) {
          var FL = ["JOB", "FN", "IN", "OUT"], lo = vw > 65 ? (compact ? 16 : f * 2 + 6) : 0;
          var dx = (vw - lo) / 8, dy = vh / 4, rad = Math.max(1.4, Math.min(dx, dy) * 0.28);
          for (var fr = 0; fr < 4; fr++) {
            if (lo) K.tx(c, FL[fr], vx, vy + (fr + 0.5) * dy, f, V.dim, "left", "600");
            for (var fc = 0; fc < 8; fc++) {
              var fl = fr === 3 && fc === 5 && fFlag, lit = u >= fc * 0.08 + fr * 0.14;
              c.fillStyle = fl ? SR : (lit ? V.acc : V.track);
              c.beginPath(); c.arc(vx + lo + (fc + 0.5) * dx, vy + (fr + 0.5) * dy, rad, 0, Math.PI * 2); c.fill();
            }
          }
        } else if (pi === 2) {
          var cg = compact ? 1.5 : 2.5, cbw = Math.max(1.5, (vw - cg * 11) / 12);
          for (var c2 = 0; c2 < 12; c2++) {
            var bx2 = vx + c2 * (cbw + cg), hh2 = ctx[c2] * vh;
            c.fillStyle = V.track; c.fillRect(bx2, vy, cbw, vh);
            c.fillStyle = ctx[c2] > 0.84 ? SR : V.acc; c.fillRect(bx2, vy + vh - hh2, cbw, hh2);
          }
          var ly84 = Math.round(vy + vh * 0.16) + 0.5;
          c.setLineDash([2, 3]); c.strokeStyle = V.mute; c.lineWidth = 1; K.ln(c, vx, ly84, vx + vw, ly84); c.setLineDash([]);
        } else if (pi === 3) {
          var lgRow = f + 4, lgH = compact ? 0 : lgRow * 3 + 4, mvh = vh - lgH;
          var ms = Math.min(vw, mvh), mx0 = vx + (vw - ms) * 0.5, my0 = vy + (mvh - ms) * 0.5, st = ms / 8, pm = Math.max(0.6, st * 0.14);
          for (var mr = 0; mr < 8; mr++) for (var mc = 0; mc < 8; mc++) {
            var sv = mat[mr * 8 + mc], qx = mx0 + mc * st + pm, qy = my0 + mr * st + pm, qs = st - pm * 2;
            if (mr === mc) { c.fillStyle = V.track; c.fillRect(qx + qs * 0.35, qy + qs * 0.35, qs * 0.3, qs * 0.3); continue; }
            if (sv === -1) { c.strokeStyle = V.dim; c.lineWidth = 1; c.strokeRect(Math.round(qx) + 0.5, Math.round(qy) + 0.5, Math.max(1, qs - 1), Math.max(1, qs - 1)); continue; }
            c.fillStyle = sv === 1 ? SR : V.dim;
            c.fillRect(qx, qy, qs, qs);
          }
          if (lgH) {
            /* 三態圖例：■agree ■conflict □no-evid */
            var sq = Math.max(5, f * 0.7), lgItems = [["agree", 0], ["conflict", 1], ["no evidence", -1]];
            var lgW = vw;
            for (var li3 = 0; li3 < 3; li3++) {
              var lx3 = vx + 2, lgY = vy + vh - lgH + 4 + lgRow * (li3 + 0.5), st3 = lgItems[li3][1];
              if (st3 === -1) { c.strokeStyle = V.dim; c.lineWidth = 1; c.strokeRect(Math.round(lx3) + 0.5, Math.round(lgY - sq * 0.5) + 0.5, sq - 1, sq - 1); }
              else { c.fillStyle = st3 === 1 ? SR : V.dim; c.fillRect(lx3, lgY - sq * 0.5, sq, sq); }
              K.tx(c, K.fitM(c, lgItems[li3][0], lgW - sq - 4, f, "600"), lx3 + sq + 3, lgY, f, V.dim, "left", "600");
            }
          }
        } else {
          /* 桌面 MAP：上＝網路顯影，下＝輻條展開車道（N1–N8），作用車道光暈 */
          var ns = Math.min(vw, vh * 0.42);
          network({ x: vx + (vw - ns) * 0.5, y: vy + 4, w: ns, h: ns });
          var lyT = vy + ns + 14;
          c.strokeStyle = V.line; K.ln(c, vx, lyT - 6.5, vx + vw, lyT - 6.5);
          lanes(vx, lyT, vw, vy + vh - lyT, true);
        }

        if (nKv) {
          var ky = vy + vh + 4;
          c.strokeStyle = V.line; c.lineWidth = 1; K.ln(c, b.x + 4, Math.round(ky) + 0.5, b.x + b.w - 4, Math.round(ky) + 0.5);
          K.kvBlock(c, { x: b.x + 3, y: ky + 2, w: b.w - 6, h: kvH }, kvs[pi], f, b.x + 0.5);
        }
        var bY = b.y + b.h - bigH * 0.5 - 2, bf = compact ? 9 : f + 6;
        K.tx(c, big[pi], b.x + 6, bY, bf, V.ink, "left", "700");
        c.font = "700 " + bf + "px " + K.MONO;
        var bw = c.measureText(big[pi]).width;
        K.tx(c, K.fitM(c, sub[pi], b.w - bw - 16, f, "600"), b.x + b.w - 6, bY, f, V.dim, "right", "600");
      }

      return "Frame " + (ti + 1) + "/60";
    }, o);
  }

  A23.swarmBurst = swarmBurst;
  A23.runLog = runLog;
  A23.unitGapBoard = unitGapBoard;
  A23.moduleMultiples = moduleMultiples;
  g.A23Charts = A23;
})(window);
