/* A23 Charts — LOP 增長閉環套組 (#53 loopSphere / #54 loopScrubber / #55 signalDecisionDiff / #56 guardrailFunnel)
 * 載入順序：在 a23_charts_swarm.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（LCG seed=20261116、零 Math.random、零 Date.now、零閉包累加狀態）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var BG = "#07090c", CARD = "#0d1117", LINE = "#27272a";
  var ORANGE = "#f97316", GREEN = "#22c55e", RED = "#ef4444", BLUE = "#38bdf8", PURPLE = "#a855f7";
  var TEXT = "#d4d4d8", FG = "#f4f4f5", DIM = "#a1a1aa", MUTED = "#71717a";
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

  function rotPoint(x, y, z, rotY, tiltX) {
    var cy = Math.cos(rotY), sy = Math.sin(rotY);
    var x1 = x * cy + z * sy;
    var z1 = -x * sy + z * cy;
    var cx = Math.cos(tiltX), sx = Math.sin(tiltX);
    var y2 = y * cx - z1 * sx;
    var z2 = y * sx + z1 * cx;
    return { x: x1, y: y2, z: z2 };
  }

  function sphereXYZ(lat, lon) {
    var cl = Math.cos(lat);
    return { x: cl * Math.sin(lon), y: Math.sin(lat), z: cl * Math.cos(lon) };
  }

  /* #53 loopSphere — 點雲球＋軌道環＋引線註解 (driver n=60) */
  function loopSphere(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var N_PTS = 3064;
    var GOLDEN = Math.PI * (3 - Math.sqrt(5));

    // Precompute deterministic Fibonacci point cloud (3064 * 4 = 12,256 points; 257 paying)
    var pts = new Array(N_PTS);
    var totalPointsCount = 0;
    var payingCount = 0;
    for (var i = 0; i < N_PTS; i++) {
      var yy = 1 - (i / (N_PTS - 1)) * 2;
      var rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      var th = GOLDEN * i;
      var radNoise = 0.90 + 0.16 * hashLcg(i, 101);
      var kind = 0; // 0: base, 1: paying(green), 2: event(orange), 3: bug(red)
      if (i % 11 === 3 && payingCount < 257) {
        kind = 1;
        payingCount++;
      } else if (hashLcg(i, 307) < 0.068) {
        kind = 2;
      } else if (hashLcg(i, 409) < 0.015) {
        kind = 3;
      }
      var weight = 4;
      totalPointsCount += weight;
      pts[i] = {
        x: Math.cos(th) * rr * radNoise,
        y: yy * radNoise,
        z: Math.sin(th) * rr * radNoise,
        kind: kind,
        sz: kind === 1 ? 1.75 : (kind === 2 ? 1.55 : 1.15)
      };
    }

    var ORBITS = [
      { r: 1.16, rx: 0.42, rz: -0.34, col: "rgba(103,232,249,0.42)" },
      { r: 1.24, rx: -0.58, rz: 0.48, col: "rgba(148,163,184,0.34)" },
      { r: 1.30, rx: 0.18, rz: 0.85, col: "rgba(94,234,212,0.28)" }
    ];

    var ANCHORS = [
      { id: "support", label: "support/", lat: 0.44, lon: -0.60, col: ORANGE, side: -1 },
      { id: "auth", label: "auth/", lat: -0.46, lon: 0.14, col: BLUE, side: 1 },
      { id: "result", label: "RESULT · bug fixed — customer answered", lat: 0.16, lon: -0.78, col: GREEN, side: 1 }
    ];

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 14;
      var topH = compact ? 26 : 32;

      // Top-left status badge: BUG / MEASURED (green box)
      var bw = compact ? 106 : 122, bh = compact ? 18 : 20;
      c.fillStyle = "rgba(34, 197, 94, 0.12)";
      roundRect(c, pad, 6, bw, bh, 4);
      c.fill();
      c.strokeStyle = GREEN;
      c.lineWidth = 1;
      c.stroke();
      c.fillStyle = GREEN;
      c.beginPath(); c.arc(pad + 9, 6 + bh * 0.5, 2.5, 0, Math.PI * 2); c.fill();
      text(c, "BUG / MEASURED", pad + 16, 6 + bh * 0.5, compact ? 8 : 9, GREEN, "left", "700");

      // Top-right points & paying summary (derived directly from pts array)
      var statStr = totalPointsCount.toLocaleString("en-US") + " POINTS · " + payingCount + " PAYING";
      text(c, statStr, w - pad, 6 + bh * 0.5, compact ? 7.5 : 9.5, DIM, "right", "600");

      var cx = w * 0.5;
      var cy = topH + (h - topH) * 0.52;
      var R = Math.min(w * 0.31, (h - topH) * 0.34);
      var rotY = -0.45 + u * 1.45;
      var tiltX = 0.24;

      // Subtle core glow
      var glow = c.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.35);
      glow.addColorStop(0, "rgba(249, 115, 22, 0.08)");
      glow.addColorStop(0.55, "rgba(34, 197, 94, 0.03)");
      glow.addColorStop(1, "rgba(7, 9, 12, 0)");
      c.fillStyle = glow;
      c.beginPath(); c.arc(cx, cy, R * 1.35, 0, Math.PI * 2); c.fill();

      // Outer radial spectrum contour (sawtooth spikes)
      var nSpikes = compact ? 144 : 216;
      var rSpike0 = R * 1.05;
      var maxSpike = R * 0.23;
      c.lineWidth = compact ? 0.9 : 1.1;
      for (var sk = 0; sk < nSpikes; sk++) {
        var ang = (sk / nSpikes) * Math.PI * 2;
        var baseNoise = hashLcg(sk, 601);
        var evtWave = 0.45 + 0.55 * Math.abs(Math.sin(ang * 3 + t * 0.22 + hashLcg(sk, 607) * 2.5));
        var pulse = 0.65 + 0.35 * Math.sin(t * 0.35 + sk * 0.28);
        var intensity = clamp(baseNoise * evtWave * pulse, 0.08, 1);
        var rOut = rSpike0 + intensity * maxSpike;
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var colSpike = intensity > 0.78 ? ORANGE : (intensity > 0.62 && sk % 5 === 0 ? GREEN : (sk % 19 === 0 && u < 0.5 ? "rgba(239,68,68,0.65)" : "rgba(113,113,122,0.52)"));
        c.strokeStyle = colSpike;
        c.beginPath();
        c.moveTo(cx + ca * rSpike0, cy + sa * rSpike0);
        c.lineTo(cx + ca * rOut, cy + sa * rOut);
        c.stroke();
      }

      // Draw back half of orbits, then back points, then front points, then front half of orbits
      function drawOrbitHalf(front) {
        var steps = 84;
        for (var oi = 0; oi < ORBITS.length; oi++) {
          var ob = ORBITS[oi];
          var crx = Math.cos(ob.rx), srx = Math.sin(ob.rx);
          var crz = Math.cos(ob.rz), srz = Math.sin(ob.rz);
          c.strokeStyle = front ? ob.col : "rgba(63, 63, 70, 0.25)";
          c.lineWidth = front ? 1.1 : 0.75;
          var drawing = false;
          c.beginPath();
          for (var si = 0; si <= steps; si++) {
            var a = (si / steps) * Math.PI * 2;
            var px = Math.cos(a) * ob.r;
            var pz = Math.sin(a) * ob.r;
            var py = 0;
            // tilt around X then Z
            var y1 = py * crx - pz * srx;
            var z1 = py * srx + pz * crx;
            var x2 = px * crz - y1 * srz;
            var y2 = px * srz + y1 * crz;
            var pr = rotPoint(x2, y2, z1, rotY, tiltX);
            var isF = pr.z >= 0;
            var sx = cx + pr.x * R;
            var sy = cy - pr.y * R;
            if (isF === front) {
              if (!drawing) { c.moveTo(sx, sy); drawing = true; }
              else c.lineTo(sx, sy);
            } else {
              drawing = false;
            }
          }
          c.stroke();
          if (front) {
            // Orbiting satellite node
            var na = (u * Math.PI * 2 + oi * 2.1) % (Math.PI * 2);
            var nx0 = Math.cos(na) * ob.r, nz0 = Math.sin(na) * ob.r;
            var ny1 = -nz0 * srx, nz1 = nz0 * crx;
            var nx2 = nx0 * crz - ny1 * srz, ny2 = nx0 * srz + ny1 * crz;
            var np = rotPoint(nx2, ny2, nz1, rotY, tiltX);
            if (np.z >= 0) {
              c.fillStyle = oi === 0 ? BLUE : (oi === 1 ? ORANGE : GREEN);
              c.beginPath(); c.arc(cx + np.x * R, cy - np.y * R, compact ? 2.1 : 2.6, 0, Math.PI * 2); c.fill();
            }
          }
        }
      }

      drawOrbitHalf(false);

      // Project all points and split back/front
      var backPts = [];
      var frontPts = [];
      for (var pi = 0; pi < N_PTS; pi++) {
        var p = pts[pi];
        var rp = rotPoint(p.x, p.y, p.z, rotY, tiltX);
        var item = { sx: cx + rp.x * R, sy: cy - rp.y * R, z: rp.z, kind: p.kind, sz: p.sz };
        if (rp.z < 0) backPts.push(item);
        else frontPts.push(item);
      }

      for (var bi = 0; bi < backPts.length; bi++) {
        var bp = backPts[bi];
        var bAlpha = clamp(0.14 + (bp.z + 1) * 0.14, 0.08, 0.28);
        c.fillStyle = bp.kind === 1 ? "rgba(34,197,94," + (bAlpha * 1.2).toFixed(2) + ")"
          : (bp.kind === 2 ? "rgba(249,115,22," + (bAlpha * 1.1).toFixed(2) + ")"
          : "rgba(161,161,170," + bAlpha.toFixed(2) + ")");
        c.fillRect(bp.sx - 0.6, bp.sy - 0.6, 1.2, 1.2);
      }

      for (var fi = 0; fi < frontPts.length; fi++) {
        var fp = frontPts[fi];
        var bright = clamp(0.45 + fp.z * 0.55, 0.4, 1);
        if (fp.kind === 1) c.fillStyle = "rgba(34,197,94," + bright.toFixed(2) + ")";
        else if (fp.kind === 2) c.fillStyle = "rgba(249,115,22," + bright.toFixed(2) + ")";
        else if (fp.kind === 3) c.fillStyle = u >= 0.5 ? "rgba(34,197,94," + bright.toFixed(2) + ")" : "rgba(239,68,68," + bright.toFixed(2) + ")";
        else c.fillStyle = "rgba(228,228,231," + (bright * 0.85).toFixed(2) + ")";
        var sz = fp.sz * (compact ? 0.88 : 1.0);
        c.fillRect(fp.sx - sz * 0.5, fp.sy - sz * 0.5, sz, sz);
      }

      drawOrbitHalf(true);

      // Leader callouts: support/, auth/, and RESULT box (t > 50%)
      for (var ai = 0; ai < ANCHORS.length; ai++) {
        var an = ANCHORS[ai];
        if (an.id === "result" && u < 0.5) continue;

        var xyz = sphereXYZ(an.lat, an.lon);
        var ap = rotPoint(xyz.x, xyz.y, xyz.z, rotY, tiltX);
        var ax = cx + ap.x * R;
        var ay = cy - ap.y * R;

        var boxX, boxY, boxW, boxH;
        if (an.id === "result") {
          var resStr = compact ? "RESULT · bug fixed" : "RESULT · bug fixed — customer answered";
          boxW = compact ? 132 : 246;
          boxH = compact ? 28 : 24;
          var elbowX = clamp(ax + (compact ? 18 : 34), pad + 4, w - boxW - pad - 12);
          var elbowY = clamp(ay - (compact ? 26 : 36), topH + 14, cy - 8);
          boxX = clamp(elbowX + 10, pad, w - boxW - pad);
          boxY = clamp(elbowY - boxH * 0.5, topH + 10, cy - boxH - 4);

          // Polyline leader
          c.strokeStyle = GREEN;
          c.lineWidth = 1.25;
          c.beginPath();
          c.moveTo(ax, ay);
          c.lineTo(elbowX, elbowY);
          c.lineTo(boxX, boxY + boxH * 0.5);
          c.stroke();

          c.fillStyle = GREEN;
          c.beginPath(); c.arc(ax, ay, 3.2, 0, Math.PI * 2); c.fill();
          c.strokeStyle = FG; c.lineWidth = 1; c.stroke();

          c.fillStyle = "rgba(7, 22, 14, 0.92)";
          roundRect(c, boxX, boxY, boxW, boxH, 4);
          c.fill();
          c.strokeStyle = GREEN;
          c.lineWidth = 1.2;
          c.stroke();
          if (compact) {
            text(c, resStr, boxX + 8, boxY + 9, 8, GREEN, "left", "700");
            text(c, "customer answered", boxX + 8, boxY + 20, 7.5, FG, "left", "600");
          } else {
            text(c, resStr, boxX + 9, boxY + boxH * 0.5, 9, GREEN, "left", "700");
          }
        } else {
          var dirX = an.side;
          var kLen = compact ? 22 : 36;
          var ex = ax + dirX * kLen;
          var ey = ay + (an.id === "support" ? -24 : 32);
          boxW = compact ? 64 : 74;
          boxH = 18;
          boxX = dirX < 0 ? clamp(ex - boxW - 6, pad, w - boxW - pad) : clamp(ex + 6, pad, w - boxW - pad);
          boxY = clamp(ey - boxH * 0.5, topH + 8, h - boxH - 18);
          var attachX = dirX < 0 ? boxX + boxW : boxX;

          c.strokeStyle = an.col;
          c.lineWidth = 1.1;
          c.beginPath();
          c.moveTo(ax, ay);
          c.lineTo(ex, ey);
          c.lineTo(attachX, boxY + boxH * 0.5);
          c.stroke();

          c.fillStyle = an.col;
          c.beginPath(); c.arc(ax, ay, 2.8, 0, Math.PI * 2); c.fill();

          c.fillStyle = "rgba(13, 17, 23, 0.9)";
          roundRect(c, boxX, boxY, boxW, boxH, 3);
          c.fill();
          c.strokeStyle = an.col;
          c.lineWidth = 0.9;
          c.stroke();
          text(c, an.label, boxX + boxW * 0.5, boxY + boxH * 0.5, compact ? 8 : 9, FG, "center", "700");
        }
      }

      // Bottom subtle cycle tag
      text(c, "DAY " + Math.round(lerp(1, 124, u)) + " · 3D TELEMETRY SPHERE", pad, h - 10, compact ? 7.5 : 8.5, MUTED, "left", "600");
      text(c, u >= 0.5 ? "PATCH VERIFIED" : "SCANNING SIGNALS", w - pad, h - 10, compact ? 7.5 : 8.5, u >= 0.5 ? GREEN : ORANGE, "right", "700");

      return "Day " + Math.round(lerp(1, 124, u)) + "/124";
    }, o);
  }

  /* #54 loopScrubber — 橫向五階刷軸＋請求熱帶＋頻譜 (driver n=60) */
  function loopScrubber(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var STAGES = ["SIGNAL", "DECISION", "CHANGE", "RESULT", "LOOP"];
    var N_HEAT = 120;
    var N_SPEC = 32;

    var specBase = new Array(N_SPEC);
    for (var si = 0; si < N_SPEC; si++) {
      specBase[si] = 0.24 + 0.72 * hashLcg(si, 809);
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 10 : 16;
      var curStage = Math.min(4, Math.floor(u * 4.999));

      // Header
      var hdrY = compact ? 14 : 16;
      text(c, "04 LOOP SCRUBBER · 5-STAGE CYCLE", pad, hdrY, compact ? 8.5 : 10, DIM, "left", "700");
      text(c, STAGES[curStage] + " · " + Math.round(u * 100) + "%", w - pad, hdrY, compact ? 8.5 : 9.5, ORANGE, "right", "700");

      // Top section: 5-stage horizontal scrubber + dense ticks + playhead
      var trackX = pad;
      var trackW = w - pad * 2;
      var segW = trackW / 5;
      var stageLblY = compact ? 38 : 42;
      var rulerTop = stageLblY + 14;
      var rulerH = compact ? 28 : 26;

      c.fillStyle = CARD;
      roundRect(c, trackX, rulerTop - 4, trackW, rulerH + 8, 4);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      for (var i = 0; i < 5; i++) {
        var sx = trackX + i * segW;
        var passed = i < curStage;
        var active = i === curStage;
        var lblCol = active ? FG : (passed ? ORANGE : MUTED);
        text(c, STAGES[i], sx + segW * 0.5, stageLblY, compact ? 7.5 : 9.5, lblCol, "center", active || passed ? "700" : "600");
        if (active) {
          c.strokeStyle = ORANGE;
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(sx + 8, stageLblY + 8);
          c.lineTo(sx + segW - 8, stageLblY + 8);
          c.stroke();
        }
      }

      // Dense ruler ticks
      var nTicks = compact ? 60 : 90;
      var playX = trackX + u * trackW;
      for (var tk = 0; tk <= nTicks; tk++) {
        var tx = trackX + (tk / nTicks) * trackW;
        var isMajor = tk % (nTicks / 5) === 0;
        var isMid = !isMajor && tk % (nTicks / 10) === 0;
        var th = isMajor ? rulerH - 2 : (isMid ? rulerH * 0.62 : rulerH * 0.36);
        c.strokeStyle = tx <= playX ? (isMajor ? ORANGE : "rgba(249,115,22,0.55)") : (isMajor ? "#52525b" : LINE);
        c.lineWidth = isMajor ? 1.4 : 0.9;
        c.beginPath();
        c.moveTo(tx, rulerTop + rulerH - th);
        c.lineTo(tx, rulerTop + rulerH);
        c.stroke();
      }

      // Playhead (crisp white vertical line = t)
      c.strokeStyle = "#ffffff";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(playX, rulerTop - 6);
      c.lineTo(playX, rulerTop + rulerH + 6);
      c.stroke();
      c.fillStyle = "#ffffff";
      c.beginPath();
      c.moveTo(playX - 4, rulerTop - 8);
      c.lineTo(playX + 4, rulerTop - 8);
      c.lineTo(playX, rulerTop - 2);
      c.closePath();
      c.fill();

      // Middle section: REQUEST HEAT 1D band (~120 cells x 1 row, shifting left with t)
      var heatHdrY = rulerTop + rulerH + (compact ? 24 : 22);
      text(c, "REQUEST HEAT", pad, heatHdrY, compact ? 8.5 : 9.5, TEXT, "left", "700");
      var shiftSlots = Math.floor(t * 2);
      var peakNow = 0;
      var heatTop = heatHdrY + 12;
      var heatH = compact ? Math.max(54, Math.min(92, h - heatTop - 26)) : Math.max(36, Math.min(54, (h - heatTop) * 0.25));

      c.fillStyle = CARD;
      roundRect(c, trackX, heatTop, trackW, heatH, 4);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var cellW = (trackW - 4) / N_HEAT;
      for (var hi = 0; hi < N_HEAT; hi++) {
        var sampleIdx = hi + shiftSlots;
        var base = hashLcg(sampleIdx, 919);
        var burst = Math.pow(0.5 + 0.5 * Math.sin(sampleIdx * 0.14), 3);
        var val = clamp(base * 0.55 + burst * 0.55, 0.04, 1);
        if (hi === N_HEAT - 1) peakNow = Math.round(val * 420);

        // Color ramp: dark -> orange -> white
        var rCol, gCol, bCol;
        if (val < 0.45) {
          var k1 = val / 0.45;
          rCol = Math.round(lerp(18, 194, k1));
          gCol = Math.round(lerp(20, 65, k1));
          bCol = Math.round(lerp(26, 12, k1));
        } else if (val < 0.82) {
          var k2 = (val - 0.45) / 0.37;
          rCol = Math.round(lerp(194, 249, k2));
          gCol = Math.round(lerp(65, 138, k2));
          bCol = Math.round(lerp(12, 36, k2));
        } else {
          var k3 = (val - 0.82) / 0.18;
          rCol = Math.round(lerp(249, 255, k3));
          gCol = Math.round(lerp(138, 250, k3));
          bCol = Math.round(lerp(36, 240, k3));
        }
        c.fillStyle = "rgb(" + rCol + "," + gCol + "," + bCol + ")";
        c.fillRect(trackX + 2 + hi * cellW, heatTop + 2, Math.max(1, cellW - 0.4), heatH - 4);
      }
      text(c, "120 SLOTS · " + peakNow + " REQ/M", w - pad, heatHdrY, compact ? 7.5 : 8.5, DIM, "right", "600");

      if (compact) {
        // Compact mode: hide SIGNAL SPECTRUM, keep scrubber + heat band + compact footer
        text(c, "SHIFT: -" + shiftSlots + " SLOTS", pad, h - 12, 8, MUTED, "left", "600");
        text(c, "COMPACT MODE · SPECTRUM HIDDEN", w - pad, h - 12, 7.5, MUTED, "right", "600");
        return STAGES[curStage] + " · " + (Math.floor(t) + 1) + "/60";
      }

      // Bottom area (desktop): Left summary card + Right SIGNAL SPECTRUM (32 orange/blue bars)
      var botTop = heatTop + heatH + 14;
      var botH = Math.max(70, h - botTop - 12);
      var leftW = Math.round(trackW * 0.33);
      var rightX = trackX + leftW + 12;
      var rightW = trackW - leftW - 12;

      // Left cycle telemetry card
      c.fillStyle = CARD;
      roundRect(c, trackX, botTop, leftW, botH, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();
      text(c, "CYCLE TELEMETRY", trackX + 10, botTop + 14, 9, DIM, "left", "700");
      var rows = [
        ["STAGE", STAGES[curStage], ORANGE],
        ["THROUGHPUT", peakNow + " req/m", FG],
        ["LATENCY p95", (42 + Math.round(18 * Math.sin(t * 0.3))) + " ms", GREEN],
        ["GUARDRAIL", "ARMED", GREEN]
      ];
      var rStep = Math.max(16, (botH - 28) / 4);
      for (var ri = 0; ri < rows.length; ri++) {
        var ry = botTop + 30 + ri * rStep;
        if (ry > botTop + botH - 8) break;
        text(c, rows[ri][0], trackX + 10, ry, 8.5, MUTED, "left", "600");
        text(c, rows[ri][1], trackX + leftW - 10, ry, 9, rows[ri][2], "right", "700");
      }

      // Bottom-right: SIGNAL SPECTRUM (32 alternating orange/blue bars)
      c.fillStyle = CARD;
      roundRect(c, rightX, botTop, rightW, botH, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      text(c, "SIGNAL SPECTRUM", rightX + 10, botTop + 14, 9, TEXT, "left", "700");
      text(c, "32 BANDS · ORANGE/BLUE", rightX + rightW - 10, botTop + 14, 8, MUTED, "right", "600");

      var barAreaX = rightX + 10;
      var barAreaW = rightW - 20;
      var barBaseY = botTop + botH - 10;
      var barMaxH = Math.max(24, botH - 34);
      var bStep = barAreaW / N_SPEC;
      var bw = Math.max(2, bStep * 0.68);

      for (var bi = 0; bi < N_SPEC; bi++) {
        var phase = 0.6 + 0.4 * Math.sin(t * 0.36 + bi * 0.45);
        var bh = clamp(specBase[bi] * phase, 0.08, 1) * barMaxH;
        var bx = barAreaX + bi * bStep;
        c.fillStyle = (bi % 2 === 0) ? ORANGE : BLUE;
        c.fillRect(bx, barBaseY - bh, bw, bh);
      }

      return STAGES[curStage] + " · " + (Math.floor(t) + 1) + "/60";
    }, o);
  }

  /* #55 signalDecisionDiff — 收件匣／決策日誌／產品差異三欄 (driver n=60) */
  function signalDecisionDiff(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;

    var INBOX = [
      { tag: "support", col: ORANGE, txt: "auth callback 401 on mobile", st: "done" },
      { tag: "bug",     col: RED,    txt: "token refresh race in Safari", st: "done" },
      { tag: "search",  col: BLUE,   txt: "query: cli gateway webhook", st: "live" },
      { tag: "stripe",  col: PURPLE, txt: "checkout +1 paying seat", st: "done" },
      { tag: "support", col: ORANGE, txt: "webhook timeout on retry", st: "live" },
      { tag: "bug",     col: RED,    txt: "trial day counter off by 1", st: "live" }
    ];

    var DECISIONS = [
      { txt: "→ cluster 14 support hits -> auth", rule: false },
      { txt: "→ prioritize PKCE state fix (P0)", rule: false },
      { txt: "→ launch $50 ad test · cli devs", rule: false },
      { txt: "→ rule: stop at 3 qualified signups", rule: true },
      { txt: "→ patch auth/callback.ts + test", rule: false },
      { txt: "→ reply customer + measure MRR", rule: false }
    ];

    var DIFFS = [
      { op: "-", txt: "- sid = req.cookies.get('sid')", sel: false },
      { op: "+", txt: "+ sid = verifyPkceState(req)", sel: false },
      { op: "-", txt: "- retries = 0 // silent 401", sel: false },
      { op: "+", txt: "+ retries = 3 // exp backoff", sel: true },
      { op: "-", txt: "- return status(401, 'expired')", sel: false },
      { op: "+", txt: "+ return refreshSession(uid)", sel: false },
      { op: "+", txt: "+ notifyCustomer(tid, 'fixed')", sel: false },
      { op: "+", txt: "+ emitMetric('bug_measured', 1)", sel: false }
    ];

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 12;
      var topH = compact ? 22 : 26;

      // Closed-form causal chain line counts: Inbox -> Decision -> Diff
      var visInbox = Math.min(INBOX.length, 1 + Math.floor(u * 9.5));
      var visDec = clamp(Math.floor((u - 0.08) * 10.0), 0, DECISIONS.length);
      var visDiff = clamp(Math.floor((u - 0.16) * 11.8), 0, DIFFS.length);

      text(c, compact ? "SIGNAL → DECISION → DIFF" : "CAUSAL LOGS · SIGNAL → DECISION → PRODUCT DIFF", pad, topH * 0.5, compact ? 8.5 : 9.5, DIM, "left", "700");
      text(c, "INBOX " + visInbox + "/6 · DIFF " + visDiff + "/8", w - pad, topH * 0.5, compact ? 8 : 9, ORANGE, "right", "700");

      var bodyY = topH + 4;
      var bodyH = h - bodyY - pad;
      var gap = compact ? 6 : 8;

      var panels;
      if (!compact) {
        var pw = (w - pad * 2 - gap * 2) / 3;
        panels = [
          { x: pad, y: bodyY, w: pw, h: bodyH },
          { x: pad + pw + gap, y: bodyY, w: pw, h: bodyH },
          { x: pad + (pw + gap) * 2, y: bodyY, w: pw, h: bodyH }
        ];
      } else {
        var ph = (bodyH - gap * 2) / 3;
        panels = [
          { x: pad, y: bodyY, w: w - pad * 2, h: ph },
          { x: pad, y: bodyY + ph + gap, w: w - pad * 2, h: ph },
          { x: pad, y: bodyY + (ph + gap) * 2, w: w - pad * 2, h: ph }
        ];
      }

      var maxRowsPerCol = compact ? 3 : 8;
      var hdrH = compact ? 18 : 24;

      function fitTxt(str, maxW, fSize) {
        var maxCh = Math.max(10, Math.floor(maxW / (fSize * 0.6)));
        return str.length > maxCh ? str.slice(0, maxCh - 1) + "…" : str;
      }

      // Panel 1: 01 SIGNAL INBOX
      var p1 = panels[0];
      c.fillStyle = CARD; roundRect(c, p1.x, p1.y, p1.w, p1.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "01 SIGNAL INBOX", p1.x + 8, p1.y + hdrH * 0.5, compact ? 8 : 9.5, ORANGE, "left", "700");
      text(c, visInbox + "/6", p1.x + p1.w - 8, p1.y + hdrH * 0.5, 8, MUTED, "right", "600");

      var start1 = compact ? Math.max(0, visInbox - 3) : 0;
      var rows1 = visInbox - start1;
      var rStep1 = (p1.h - hdrH - 8) / (compact ? 3 : 6);
      for (var i1 = 0; i1 < rows1; i1++) {
        var item1 = INBOX[start1 + i1];
        var ry1 = p1.y + hdrH + 4 + i1 * rStep1 + rStep1 * 0.5;
        var isLast1 = (start1 + i1 === visInbox - 1) && visInbox < INBOX.length;
        if (isLast1) text(c, "▶", p1.x + 4, ry1, 7, ORANGE, "left", "700");

        var tagW = compact ? 44 : 48;
        var tagX = p1.x + (isLast1 ? 12 : 8);
        c.fillStyle = item1.col + "22";
        roundRect(c, tagX, ry1 - 7, tagW, 14, 3);
        c.fill();
        c.strokeStyle = item1.col;
        c.lineWidth = 0.8;
        c.stroke();
        text(c, item1.tag, tagX + tagW * 0.5, ry1, 7.5, item1.col, "center", "700");

        var stW = 28;
        var msgX = tagX + tagW + 6;
        var msgMaxW = p1.x + p1.w - stW - 10 - msgX;
        text(c, fitTxt(item1.txt, msgMaxW, compact ? 7.5 : 8.5), msgX, ry1, compact ? 7.5 : 8.5, TEXT, "left");
        text(c, item1.st, p1.x + p1.w - 8, ry1, 7.5, item1.st === "live" ? ORANGE : GREEN, "right", "700");
      }

      // Panel 2: 02 DECISION LOG
      var p2 = panels[1];
      c.fillStyle = CARD; roundRect(c, p2.x, p2.y, p2.w, p2.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "02 DECISION LOG", p2.x + 8, p2.y + hdrH * 0.5, compact ? 8 : 9.5, BLUE, "left", "700");
      text(c, visDec + "/6", p2.x + p2.w - 8, p2.y + hdrH * 0.5, 8, MUTED, "right", "600");

      var start2 = compact ? Math.max(0, visDec - 3) : 0;
      var rows2 = Math.min(maxRowsPerCol, visDec - start2);
      var rStep2 = (p2.h - hdrH - 8) / (compact ? 3 : 6);
      for (var i2 = 0; i2 < rows2; i2++) {
        var item2 = DECISIONS[start2 + i2];
        var ry2 = p2.y + hdrH + 4 + i2 * rStep2 + rStep2 * 0.5;
        var isLast2 = (start2 + i2 === visDec - 1) && visDec < DECISIONS.length;
        if (item2.rule) {
          c.fillStyle = "rgba(239, 68, 68, 0.14)";
          roundRect(c, p2.x + 6, ry2 - rStep2 * 0.40, p2.w - 12, rStep2 * 0.80, 4);
          c.fill();
          c.strokeStyle = RED;
          c.lineWidth = 1.1;
          c.stroke();
        }
        if (isLast2) text(c, "▶", p2.x + 8, ry2, 7, BLUE, "left", "700");
        var tx2 = p2.x + (isLast2 ? 17 : 10);
        var maxW2 = p2.x + p2.w - 10 - tx2;
        text(c, fitTxt(item2.txt, maxW2, compact ? 7.5 : 8.5), tx2, ry2, compact ? 7.5 : 8.5, item2.rule ? RED : TEXT, "left", item2.rule ? "700" : "400");
      }

      // Panel 3: 03 PRODUCT DIFF
      var p3 = panels[2];
      c.fillStyle = CARD; roundRect(c, p3.x, p3.y, p3.w, p3.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "03 PRODUCT DIFF", p3.x + 8, p3.y + hdrH * 0.5, compact ? 8 : 9.5, GREEN, "left", "700");
      // "shipped" badge on right of header
      c.fillStyle = "rgba(34, 197, 94, 0.14)";
      roundRect(c, p3.x + p3.w - 54, p3.y + 3, 46, hdrH - 6, 3);
      c.fill();
      c.strokeStyle = "rgba(34, 197, 94, 0.45)";
      c.lineWidth = 0.8;
      c.stroke();
      text(c, "shipped", p3.x + p3.w - 31, p3.y + hdrH * 0.5, 7.5, GREEN, "center", "700");

      var start3 = compact ? Math.max(0, visDiff - 3) : 0;
      var rows3 = Math.min(maxRowsPerCol, visDiff - start3);
      var rStep3 = (p3.h - hdrH - 8) / (compact ? 3 : 8);
      for (var i3 = 0; i3 < rows3; i3++) {
        var item3 = DIFFS[start3 + i3];
        var ry3 = p3.y + hdrH + 4 + i3 * rStep3 + rStep3 * 0.5;
        var isLast3 = (start3 + i3 === visDiff - 1) && visDiff < DIFFS.length;
        if (item3.sel) {
          c.fillStyle = "rgba(34, 197, 94, 0.13)";
          roundRect(c, p3.x + 6, ry3 - rStep3 * 0.42, p3.w - 12, rStep3 * 0.84, 4);
          c.fill();
          c.strokeStyle = GREEN;
          c.lineWidth = 1.1;
          c.stroke();
        }
        if (isLast3) text(c, "▶", p3.x + 8, ry3, 7, GREEN, "left", "700");
        var tx3 = p3.x + (isLast3 ? 17 : 10);
        var maxW3 = p3.x + p3.w - 10 - tx3;
        var col3 = item3.op === "+" ? GREEN : RED;
        text(c, fitTxt(item3.txt, maxW3, compact ? 7.5 : 8.5), tx3, ry3, compact ? 7.5 : 8.5, col3, "left", item3.sel ? "700" : "500");
      }

      return "Inbox " + visInbox + "/6 · Diff " + visDiff + "/8";
    }, o);
  }

  /* #56 guardrailFunnel — KPI 狀態列＋實驗熔斷＋步驟漏斗 (driver n=48) */
  function guardrailFunnel(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 48;
    var N_AD_BARS = 14;
    var STEPS = [
      { name: "visit site",    pct: 100 },
      { name: "test message",  pct: 62 },
      { name: "sign up",       pct: 14 },
      { name: "verify",        pct: 9 },
      { name: "first message", pct: 4 }
    ];

    var adBars = new Array(N_AD_BARS);
    for (var bi = 0; bi < N_AD_BARS; bi++) {
      adBars[bi] = 0.25 + 0.70 * hashLcg(bi, 1031);
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 12;

      var adProg = clamp(u / 0.7, 0, 1);
      var stopped = u >= 0.7;
      var spendNow = Math.round(lerp(18, 150, adProg));
      var clicksNow = Math.round(lerp(12, 184, adProg));
      var qualifiedNow = 0;

      // Top 8 KPI cells (8x1 on desktop, 4x2 on compact)
      var kpis = [
        { k: "MRR $",     v: "$" + Math.round(lerp(1840, 4820, u)).toLocaleString("en-US"), alert: false },
        { k: "PAYING",    v: String(Math.round(lerp(112, 257, u))), alert: false },
        { k: "DAY",       v: String(Math.round(lerp(1, 124, u))), alert: false },
        { k: "SIGNALS",   v: Math.round(lerp(840, 12256, u)).toLocaleString("en-US"), alert: false },
        { k: "SHIPPED",   v: String(Math.round(lerp(14, 148, u))), alert: false },
        { k: "CLICKS",    v: String(clicksNow), alert: false },
        { k: "AD SPEND",  v: "$" + spendNow, alert: true },
        { k: "QUALIFIED", v: String(qualifiedNow), alert: true }
      ];

      var cols = compact ? 4 : 8;
      var rowsKpi = compact ? 2 : 1;
      var kGap = compact ? 4 : 6;
      var kCellW = (w - pad * 2 - kGap * (cols - 1)) / cols;
      var kCellH = compact ? 32 : 40;
      var kTop = pad;

      for (var ki = 0; ki < kpis.length; ki++) {
        var kp = kpis[ki];
        var kr = Math.floor(ki / cols), kc = ki % cols;
        var kx = pad + kc * (kCellW + kGap);
        var ky = kTop + kr * (kCellH + kGap);
        c.fillStyle = kp.alert ? "rgba(239, 68, 68, 0.14)" : "rgba(34, 197, 94, 0.10)";
        roundRect(c, kx, ky, kCellW, kCellH, 4);
        c.fill();
        c.strokeStyle = kp.alert ? "rgba(239, 68, 68, 0.55)" : "rgba(34, 197, 94, 0.42)";
        c.lineWidth = 1;
        c.stroke();

        text(c, kp.k, kx + 6, ky + (compact ? 9 : 11), compact ? 6.5 : 7.5, kp.alert ? RED : GREEN, "left", "700");
        text(c, kp.v, kx + 6, ky + kCellH - (compact ? 9 : 11), compact ? 9 : 11, kp.alert ? FG : FG, "left", "700");
      }

      var bodyTop = kTop + rowsKpi * kCellH + (rowsKpi - 1) * kGap + (compact ? 8 : 12);
      var bodyH = h - bodyTop - pad;
      var gap = compact ? 8 : 10;

      var adBox, fnBox;
      if (!compact) {
        var lw = Math.round((w - pad * 2 - gap) * 0.46);
        adBox = { x: pad, y: bodyTop, w: lw, h: bodyH };
        fnBox = { x: pad + lw + gap, y: bodyTop, w: w - pad * 2 - lw - gap, h: bodyH };
      } else {
        var topH2 = Math.round((bodyH - gap) * 0.44);
        adBox = { x: pad, y: bodyTop, w: w - pad * 2, h: topH2 };
        fnBox = { x: pad, y: bodyTop + topH2 + gap, w: w - pad * 2, h: bodyH - topH2 - gap };
      }

      // Bottom-left: 06 AD TEST
      c.fillStyle = CARD; roundRect(c, adBox.x, adBox.y, adBox.w, adBox.h, 5); c.fill();
      c.strokeStyle = stopped ? "rgba(239, 68, 68, 0.65)" : LINE; c.lineWidth = 1; c.stroke();
      text(c, "06 AD TEST", adBox.x + 10, adBox.y + 13, compact ? 8.5 : 9.5, ORANGE, "left", "700");
      text(c, stopped ? "GUARDRAIL TRIPPED" : "LIVE TEST", adBox.x + adBox.w - 10, adBox.y + 13, compact ? 7.5 : 8.5, stopped ? RED : GREEN, "right", "700");

      var metricY0 = adBox.y + 28;
      var metricStep = compact ? 14 : 18;
      var adMetrics = [
        ["spend", "$" + spendNow + " / $150 cap", TEXT],
        ["clicks", clicksNow + " (+3 in 2d)", TEXT],
        ["qualified signups", String(qualifiedNow) + "  (stop @ 3)", RED]
      ];
      for (var mi = 0; mi < adMetrics.length; mi++) {
        var my = metricY0 + mi * metricStep;
        text(c, adMetrics[mi][0], adBox.x + 10, my, compact ? 8 : 9, DIM, "left", "600");
        text(c, adMetrics[mi][1], adBox.x + adBox.w - 10, my, compact ? 8 : 9, adMetrics[mi][2], "right", "700");
      }

      // 14 mini vertical bars
      var bannerH = compact ? 22 : 26;
      var bannerY = adBox.y + adBox.h - bannerH - 8;
      var barsTop = metricY0 + adMetrics.length * metricStep + 4;
      var barsH = Math.max(18, bannerY - barsTop - 8);
      var bx0 = adBox.x + 10;
      var bwTotal = adBox.w - 20;
      var bStep = bwTotal / N_AD_BARS;
      var activeCount = Math.max(2, Math.round(adProg * N_AD_BARS));

      for (var ai = 0; ai < N_AD_BARS; ai++) {
        var bx = bx0 + ai * bStep;
        var bw = Math.max(3, bStep * 0.65);
        var activeBar = ai < activeCount;
        var bh = activeBar ? Math.max(4, adBars[ai] * barsH) : 3;
        c.fillStyle = activeBar ? (stopped && ai >= activeCount - 2 ? RED : ORANGE) : "#18181b";
        c.fillRect(bx, barsTop + barsH - bh, bw, bh);
      }

      // Guardrail stop banner when u >= 0.7 and qualified === 0
      if (stopped && qualifiedNow === 0) {
        c.fillStyle = "rgba(239, 68, 68, 0.22)";
        roundRect(c, adBox.x + 8, bannerY, adBox.w - 16, bannerH, 4);
        c.fill();
        c.strokeStyle = RED;
        c.lineWidth = 1.3;
        c.stroke();
        text(c, "STOPPED BY THE AGENT", adBox.x + adBox.w * 0.5, bannerY + bannerH * 0.5, compact ? 8.5 : 10, RED, "center", "700");
      } else {
        c.fillStyle = "rgba(39, 39, 42, 0.35)";
        roundRect(c, adBox.x + 8, bannerY, adBox.w - 16, bannerH, 4);
        c.fill();
        c.strokeStyle = LINE;
        c.lineWidth = 1;
        c.stroke();
        text(c, "WATCHING · SPEND $" + spendNow + " / $150", adBox.x + adBox.w * 0.5, bannerY + bannerH * 0.5, compact ? 8 : 9, DIM, "center", "600");
      }

      // Bottom-right: 07 SIGNUP FUNNEL
      c.fillStyle = CARD; roundRect(c, fnBox.x, fnBox.y, fnBox.w, fnBox.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "07 SIGNUP FUNNEL", fnBox.x + 10, fnBox.y + 13, compact ? 8.5 : 9.5, GREEN, "left", "700");
      text(c, "5 STEPS", fnBox.x + fnBox.w - 10, fnBox.y + 13, compact ? 7.5 : 8.5, MUTED, "right", "600");

      // Compute biggest drop step dynamically
      var maxDrop = -1, dropIdx = -1;
      for (var di = 1; di < STEPS.length; di++) {
        var dVal = STEPS[di - 1].pct - STEPS[di].pct;
        if (dVal > maxDrop) { maxDrop = dVal; dropIdx = di; }
      }

      var trialH = compact ? 24 : 28;
      var trialY = fnBox.y + fnBox.h - trialH - 8;
      var fListTop = fnBox.y + 24;
      var fListH = Math.max(60, trialY - fListTop - 8);
      var stepRowH = fListH / STEPS.length;
      var ease = 0.25 + 0.75 * clamp(u * 1.25, 0, 1);

      var lblW = compact ? 84 : 104;
      var pctW = 36;
      var barX = fnBox.x + 12 + lblW;
      var barMaxW = Math.max(40, fnBox.w - 24 - lblW - pctW);

      for (var fi = 0; fi < STEPS.length; fi++) {
        var st = STEPS[fi];
        var ry = fListTop + fi * stepRowH;
        var midY = ry + stepRowH * 0.5;
        var isDrop = fi === dropIdx;

        if (isDrop) {
          c.fillStyle = "rgba(239, 68, 68, 0.12)";
          roundRect(c, fnBox.x + 6, ry + 1, fnBox.w - 12, stepRowH - 2, 4);
          c.fill();
          c.strokeStyle = RED;
          c.lineWidth = 1.1;
          c.stroke();
        }

        text(c, st.name, fnBox.x + 12, midY, compact ? 7.5 : 8.5, isDrop ? RED : TEXT, "left", isDrop ? "700" : "500");

        var curPct = st.pct * ease;
        var bw2 = Math.max(4, (curPct / 100) * barMaxW);
        var bh2 = Math.min(10, stepRowH * 0.45);
        c.fillStyle = "#18181b";
        c.fillRect(barX, midY - bh2 * 0.5, barMaxW, bh2);
        c.fillStyle = isDrop ? RED : (fi === 0 ? DIM : GREEN);
        c.fillRect(barX, midY - bh2 * 0.5, bw2, bh2);

        if (isDrop) {
          // Strikethrough across the drop step label & bar
          c.strokeStyle = RED;
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(fnBox.x + 10, midY);
          c.lineTo(barX + bw2 + 6, midY);
          c.stroke();
        }

        text(c, Math.round(curPct) + "%", fnBox.x + fnBox.w - 10, midY, compact ? 7.5 : 8.5, isDrop ? RED : FG, "right", "700");
      }

      // Bottom green 7-day trial bar + "clicks +3 in 2 days"
      c.fillStyle = "rgba(34, 197, 94, 0.10)";
      roundRect(c, fnBox.x + 8, trialY, fnBox.w - 16, trialH, 4);
      c.fill();
      c.strokeStyle = "rgba(34, 197, 94, 0.45)";
      c.lineWidth = 1;
      c.stroke();

      var trialFillW = (fnBox.w - 20) * (0.35 + 0.65 * u);
      c.fillStyle = "rgba(34, 197, 94, 0.25)";
      roundRect(c, fnBox.x + 10, trialY + 2, trialFillW, trialH - 4, 3);
      c.fill();

      text(c, "7-day trial", fnBox.x + 16, trialY + trialH * 0.5, compact ? 8 : 9, GREEN, "left", "700");
      text(c, "clicks +3 in 2 days", fnBox.x + fnBox.w - 14, trialY + trialH * 0.5, compact ? 7.5 : 8.5, TEXT, "right", "600");

      return stopped ? "STOPPED · Day 124" : "Running · " + Math.round(u * 100) + "%";
    }, o);
  }

  A23.loopSphere = loopSphere;
  A23.loopScrubber = loopScrubber;
  A23.signalDecisionDiff = signalDecisionDiff;
  A23.guardrailFunnel = guardrailFunnel;
  g.A23Charts = A23;
})(window);
