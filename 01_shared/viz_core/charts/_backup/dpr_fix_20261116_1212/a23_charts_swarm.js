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
    if (cv.__w !== w || cv.__h !== h) {
      cv.width = w * d; cv.height = h * d; cv.__w = w; cv.__h = h;
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
      var status = conflict ? "conflict" : (prog >= 0.985 ? "done" : "run");
      var load = status === "done" ? 0.38 : (0.55 + 0.45 * Math.sin(t * 0.42 + i * 1.17));
      list[i] = { idx: i, prog: prog, status: status, conflict: conflict, load: clamp(load, 0.2, 1) };
    }
    return list;
  }

  /* #49 swarmBurst — 放射爆發群集圖 (driver n=60) */
  function swarmBurst(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60, N_SPIKES = 720;

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var stepNum = Math.min(4, Math.floor(t / 15) + 1);
      var stepLabel = "Step " + stepNum + "/4";

      var topH = compact ? 22 : 26;
      var tickerH = compact ? 20 : 24;
      var bodyH = Math.max(80, h - topH - tickerH);
      var cx = w * 0.5;
      var cy = topH + bodyH * 0.5;
      var availR = Math.min(w * 0.46, bodyH * 0.48);

      // Header strip
      text(c, compact ? "SWARM MAP · 8W" : "SWARM BURST · 8 WORKERS · GROK 4.6 VS FABLE 5.2", 12, topH * 0.5, compact ? 9 : 10, DIM, "left", "700");
      var badgeW = compact ? 64 : 74;
      c.fillStyle = "rgba(34, 211, 238, 0.12)";
      roundRect(c, w - badgeW - 10, 4, badgeW, topH - 8, 4);
      c.fill();
      c.strokeStyle = "rgba(34, 211, 238, 0.42)";
      c.lineWidth = 1;
      c.stroke();
      text(c, stepLabel, w - badgeW * 0.5 - 10, topH * 0.5, compact ? 9 : 10, CYAN, "center", "700");

      var workers = workerStates(t, nFrames);

      var rSphere = Math.max(12, availR * 0.18);
      var rNodes = availR * 0.29;
      var rArc = availR * 0.39;
      var rSpike0 = availR * 0.43;
      var rSpikeMax = availR * 0.77;

      // 720 radial spikes (length = worker load * LCG noise; alpha decreases with length)
      c.lineWidth = compact ? 0.85 : 1.05;
      for (var k = 0; k < N_SPIKES; k++) {
        var ang = (k / N_SPIKES) * Math.PI * 2 - Math.PI * 0.5;
        var normAng = ((ang + Math.PI * 0.5 + Math.PI / 8) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        var wi = Math.floor(normAng / (Math.PI * 2 / 8)) % 8;
        var wk = workers[wi];
        var n1 = hashLcg(k, 401);
        var n2 = hashLcg(k, 709);
        var shimmer = 0.84 + 0.16 * Math.sin(t * 0.38 + k * 0.17);
        var lenNorm = clamp((0.16 + 0.84 * Math.pow(n1, 1.3)) * wk.load * shimmer, 0.06, 1);
        var rEnd = rSpike0 + lenNorm * (rSpikeMax - rSpike0);
        var rMid = rSpike0 + (rEnd - rSpike0) * 0.48;

        var isRed = (wk.conflict && n2 < 0.38) || n2 < 0.045;
        var isWhite = !isRed && n2 > 0.78;
        var rgb = isRed ? "244,63,94" : (isWhite ? "248,250,252" : "34,211,238");
        var alpha = clamp(0.86 - lenNorm * 0.60, 0.14, 0.86);

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

      // Outer 8 arc segments (brightness = worker progress)
      var slice = (Math.PI * 2) / 8;
      for (var ai = 0; ai < 8; ai++) {
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

      // Inner 8 nodes (white=done, cyan=running, red ring=conflict)
      for (var ni = 0; ni < 8; ni++) {
        var wkN = workers[ni];
        var nAng = -Math.PI * 0.5 + ni * slice;
        var nx = cx + Math.cos(nAng) * rNodes;
        var ny = cy + Math.sin(nAng) * rNodes;
        var nr = compact ? 3.5 : 5;
        if (wkN.conflict) {
          c.fillStyle = "#4c0519";
          c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill();
          c.strokeStyle = RED;
          c.lineWidth = 2;
          c.beginPath(); c.arc(nx, ny, nr + 2.2, 0, Math.PI * 2); c.stroke();
        } else if (wkN.status === "done") {
          c.fillStyle = FG;
          c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill();
        } else {
          c.fillStyle = CYAN;
          c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill();
          c.strokeStyle = "rgba(34,211,238,0.35)";
          c.lineWidth = 1.2;
          c.beginPath(); c.arc(nx, ny, nr + 2.5, 0, Math.PI * 2); c.stroke();
        }
      }

      // Central black sphere
      var sphereGrad = c.createRadialGradient(cx - rSphere * 0.25, cy - rSphere * 0.25, 2, cx, cy, rSphere);
      sphereGrad.addColorStop(0, "#111827");
      sphereGrad.addColorStop(1, "#03060a");
      c.fillStyle = sphereGrad;
      c.beginPath(); c.arc(cx, cy, rSphere, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(34, 211, 238, 0.45)";
      c.lineWidth = 1.3;
      c.stroke();
      text(c, "SWM", cx, cy - (compact ? 3 : 5), compact ? 7.5 : 9, FG, "center", "700");
      text(c, "6.7x", cx, cy + (compact ? 5 : 7), compact ? 7 : 8.5, CYAN, "center", "700");

      // 8 outer satellite boxes W1–W8 (each with 6 mini vertical bars)
      var boxW = compact ? 42 : Math.min(72, Math.max(52, w * 0.082));
      var boxH = compact ? 22 : Math.min(34, Math.max(26, bodyH * 0.095));
      var rxSat = Math.min(w * 0.43 - boxW * 0.5, availR * 1.18);
      var rySat = Math.min(bodyH * 0.44 - boxH * 0.5, availR * 0.94);

      for (var si = 0; si < 8; si++) {
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
        c.strokeStyle = wkS.conflict ? RED : (wkS.status === "done" ? "rgba(248,250,252,0.45)" : "rgba(34,211,238,0.45)");
        c.lineWidth = 1;
        c.stroke();

        text(c, "W" + (si + 1), sx + 4, sy + (compact ? 6 : 8), compact ? 7.5 : 8.5, wkS.conflict ? RED : FG, "left", "700");
        if (!compact) {
          var stTxt = wkS.conflict ? "FLG" : (wkS.status === "done" ? "OK" : Math.round(wkS.prog * 100) + "%");
          text(c, stTxt, sx + boxW - 4, sy + 8, 7.5, wkS.conflict ? RED : (wkS.status === "done" ? FG : CYAN), "right", "600");
        }

        // 6 mini vertical bars (last 6 frames token volume, closed-form from t)
        var barsX = sx + 4;
        var barsW = boxW - 8;
        var barStep = barsW / 6;
        var barMaxH = boxH - (compact ? 11 : 15);
        var barBaseY = sy + boxH - 3;
        for (var bi = 0; bi < 6; bi++) {
          var tb = Math.max(0, t - (5 - bi) * 1.4);
          var frac = 0.22 + 0.78 * hashLcg(si * 101 + Math.floor(tb * 2), 911) * (0.65 + 0.35 * Math.sin(tb * 0.5 + si));
          var bh = Math.max(2, frac * barMaxH);
          c.fillStyle = wkS.conflict ? RED : (bi === 5 ? FG : CYAN);
          c.fillRect(barsX + bi * barStep + 1, barBaseY - bh, Math.max(2, barStep - 2), bh);
        }
      }

      // Bottom scrolling ticker (displacement = pure function of t)
      var tickY = h - tickerH;
      c.fillStyle = CARD;
      c.fillRect(0, tickY, w, tickerH);
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, tickY); c.lineTo(w, tickY); c.stroke();

      var tickerMsg = "$2 IN · $6 OUT · OUT GAP 6.7x · 5.2 VS 5 -20% · 8 WORKERS PARALLEL · GROK 4.6 SWARM ·   ";
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
        text(c, tickerMsg, tx, tickY + tickerH * 0.5, tFontSize, TEXT, "left", "600");
        tx += msgW;
      }
      c.restore();

      return stepLabel;
    }, o);
  }

  /* #50 runLog — 終端串流＋直立階段 (driver n=60) */
  function runLog(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var STAGES = [
      { id: "01", name: "SCOUT", desc: "fan-out 8 workers" },
      { id: "02", name: "MERGE", desc: "collect 8 drafts" },
      { id: "03", name: "FLAG",  desc: "audit 2 conflicts" },
      { id: "04", name: "BUILD", desc: "synthesize patch" },
      { id: "05", name: "CHECK", desc: "verify invariants" },
      { id: "06", name: "FIX",   desc: "seal & emit report" }
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

  /* #51 unitGapBoard — 單位格對比柱＋倍率環＋KPI 條 (driver n=48) */
  function unitGapBoard(cv, _data, opt) {
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

  /* #52 moduleMultiples — 小倍數組合框 (driver n=60) */
  function moduleMultiples(cv, _data, opt) {
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

  A23.swarmBurst = swarmBurst;
  A23.runLog = runLog;
  A23.unitGapBoard = unitGapBoard;
  A23.moduleMultiples = moduleMultiples;
  g.A23Charts = A23;
})(window);
