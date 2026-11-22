/* A23 Charts — ORB 決策星球套組 (#60 orbBundle / #61 landingCurve / #62 constellationMap / #63 agentSquad)
 * 載入順序：在 a23_charts_reader.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（LCG seed=20261116、零 Math.random、零 Date.now、零閉包累加狀態）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var BG = "#06070c", CARD = "#0c0f18", LINE = "#1f2433";
  var GOLD = "#f5b301", CYAN = "#22d3ee", MAGENTA = "#ec4899";
  var GREEN = "#22c55e", RED = "#ef4444", PURPLE = "#a78bfa";
  var TEXT = "#d4d4d8", FG = "#f4f4f5", DIM = "#a1a1aa", MUTED = "#71717a";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Microsoft JhengHei', monospace";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function easeOut(u) { var x = 1 - clamp(u, 0, 1); return 1 - x * x * x; }

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

  function fitTxt(str, maxW, fSize) {
    var maxCh = Math.max(4, Math.floor(maxW / (fSize * 0.61)));
    return str.length > maxCh ? str.slice(0, maxCh - 1) + "…" : str;
  }

  function drawPill(c, label, x, y, w, h, color, fSize) {
    c.fillStyle = color + "24";
    roundRect(c, x, y, w, h, 3);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 0.85;
    c.stroke();
    text(c, label, x + w * 0.5, y + h * 0.5, fSize, color, "center", "700");
  }

  function cubicPt(p0, p1, p2, p3, s) {
    var inv = 1 - s;
    var a = inv * inv * inv;
    var b = 3 * inv * inv * s;
    var c = 3 * inv * s * s;
    var d = s * s * s;
    return {
      x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
      y: a * p0.y + b * p1.y + c * p2.y + d * p3.y
    };
  }

  /* #60 orbBundle — 觀測→狀態→決策 收斂扇出 (driver n=60) */
  function orbBundle(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;

    var OBS = [
      { name: "LAUNCH RATE",   short: "LNCH", base: 14.2, unit: "/m", amp: 2.1, col: GOLD },
      { name: "CURVE INFLOW",  short: "INFL", base: 86.4, unit: "%",  amp: 6.5, col: CYAN },
      { name: "HOLDER SPREAD", short: "HLDR", base: 0.73, unit: "",   amp: 0.08, col: GOLD },
      { name: "VOLUME ACCEL",  short: "VOLA", base: 2.45, unit: "x",  amp: 0.42, col: CYAN },
      { name: "CREATOR SCORE", short: "CRTR", base: 91.0, unit: "",   amp: 3.5, col: PURPLE },
      { name: "MARKET MOOD",   short: "MOOD", base: 0.68, unit: "",   amp: 0.11, col: GREEN },
      { name: "DEPTH RATIO",   short: "DPTH", base: 4.12, unit: "x",  amp: 0.55, col: GOLD },
      { name: "EXIT VELOCITY", short: "EXIT", base: 0.31, unit: "",   amp: 0.07, col: MAGENTA }
    ];

    var TOKENS = [
      { sym: "TKN-A", base: 0.94 },
      { sym: "TKN-C", base: 0.86 },
      { sym: "TKN-F", base: 0.79 },
      { sym: "TKN-B", base: 0.71 },
      { sym: "TKN-H", base: 0.64 },
      { sym: "TKN-D", base: 0.56 },
      { sym: "TKN-G", base: 0.48 },
      { sym: "TKN-E", base: 0.41 },
      { sym: "TKN-J", base: 0.33 },
      { sym: "TKN-K", base: 0.24 }
    ];

    // Precompute 1,200 deterministic 3D cloud particles on unit sphere shell
    var N_PTS = 1200;
    var CLOUD = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var pi = 0; pi < N_PTS; pi++) {
      var yy = 1 - (pi / (N_PTS - 1)) * 2;
      var rr = Math.sqrt(Math.max(0, 1 - yy * yy));
      var th = golden * pi + (hashLcg(pi, 101) - 0.5) * 0.28;
      var shell = 0.62 + 0.38 * Math.pow(hashLcg(pi, 102), 0.45);
      CLOUD.push({
        x: Math.cos(th) * rr * shell,
        y: yy * shell,
        z: Math.sin(th) * rr * shell,
        gold: hashLcg(pi, 103) < 0.62,
        sz: 0.9 + hashLcg(pi, 104) * 1.1
      });
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 6 : 10;
      var topH = compact ? 20 : 24;

      text(c, compact ? "THE ORB · STATE" : "ORB 01 · OBSERVE → STATE → DECIDE", pad, topH * 0.5, compact ? 8 : 9.5, GOLD, "left", "700");
      text(c, "1,200 PTS · T+" + Math.round(u * 59) + "s", w - pad, topH * 0.5, compact ? 7 : 8.5, CYAN, "right", "600");

      var bodyY = topH + 2;
      var bodyH = h - bodyY - pad;
      var innerW = w - pad * 2;

      // Zone widths: Left 25%, Center 45%, Right 30%
      var wL = Math.round(innerW * 0.25);
      var wC = Math.round(innerW * 0.45);
      var wR = innerW - wL - wC;
      var xL = pad;
      var xC = pad + wL;
      var xR = xC + wC;

      // Zone headers
      var hdrF = compact ? 6.5 : 8;
      text(c, "OBSERVABLES", xL + 2, bodyY + 6, hdrF, DIM, "left", "700");
      text(c, "STATE", xC + wC * 0.5, bodyY + 6, hdrF, GOLD, "center", "700");
      text(c, "DECISION STACK", xR + wR - 2, bodyY + 6, hdrF, MAGENTA, "right", "700");

      var listTop = bodyY + 15;
      var listH = bodyH - 16;

      // Central particle cloud geometry
      var cloudCx = xC + wC * 0.5;
      var cloudCy = listTop + listH * 0.5;
      var cloudR = Math.min(wC * 0.36, listH * 0.38);

      // Left 25%: 8 Observable rows + Bezier bundles to cloud
      var obsRowH = listH / OBS.length;
      var obsAnchors = [];
      for (var oi = 0; oi < OBS.length; oi++) {
        var ob = OBS[oi];
        var oy = listTop + (oi + 0.5) * obsRowH;
        var wave = Math.sin(u * Math.PI * 2 + oi * 0.9 + hashLcg(oi, 201) * 4);
        var val = ob.base + ob.amp * wave;
        var valStr = ob.base >= 10 ? val.toFixed(1) + ob.unit : val.toFixed(2) + ob.unit;

        if (compact) {
          // compact: 隱藏左側走勢線，只留名稱點
          c.fillStyle = ob.col;
          c.beginPath(); c.arc(xL + 5, oy, 2.3, 0, Math.PI * 2); c.fill();
          text(c, ob.short, xL + 11, oy, 6.8, TEXT, "left", "700");
          obsAnchors.push({ x: xL + Math.min(wL - 4, 38), y: oy });
        } else {
          c.fillStyle = CARD;
          roundRect(c, xL, oy - obsRowH * 0.40, wL - 4, obsRowH * 0.80, 3);
          c.fill();
          c.strokeStyle = LINE;
          c.lineWidth = 0.7;
          c.stroke();

          var rowF = w < 540 ? 6.8 : 8.2;
          c.fillStyle = ob.col;
          c.beginPath(); c.arc(xL + 6, oy - obsRowH * 0.14, 2, 0, Math.PI * 2); c.fill();
          text(c, fitTxt(ob.name, wL - 50, rowF - 0.6), xL + 12, oy - obsRowH * 0.14, rowF - 0.6, DIM, "left", "600");
          text(c, valStr, xL + wL - 8, oy - obsRowH * 0.14, rowF - 0.4, FG, "right", "700");

          // Mini sparkline
          var spX = xL + 6;
          var spW = wL - 14;
          var spY0 = oy + obsRowH * 0.16;
          var spH = obsRowH * 0.28;
          c.strokeStyle = ob.col;
          c.lineWidth = 1.05;
          c.beginPath();
          var N_SP = 14;
          for (var si = 0; si < N_SP; si++) {
            var sx = spX + (si / (N_SP - 1)) * spW;
            var phase = si * 0.55 + u * Math.PI * 2 + oi * 1.3;
            var nVal = 0.5 + 0.35 * Math.sin(phase) + 0.15 * (hashLcg(oi * 31 + si, 211) - 0.5);
            var sy = spY0 + (0.5 - clamp(nVal, 0.05, 0.95)) * spH;
            if (si === 0) c.moveTo(sx, sy);
            else c.lineTo(sx, sy);
          }
          c.stroke();

          obsAnchors.push({ x: xL + wL - 3, y: oy });
        }
      }

      // Bezier bundles: 7 curves per observable (6-10) converging to cloud, left gold -> right cyan
      var CURVES_PER_OBS = 7;
      var bezGrad = c.createLinearGradient(xL + wL, cloudCy, cloudCx, cloudCy);
      bezGrad.addColorStop(0, "rgba(245, 179, 1, 0.36)");
      bezGrad.addColorStop(0.55, "rgba(34, 211, 238, 0.24)");
      bezGrad.addColorStop(1, "rgba(34, 211, 238, 0.34)");

      for (var bi = 0; bi < obsAnchors.length; bi++) {
        var anc = obsAnchors[bi];
        for (var ci = 0; ci < CURVES_PER_OBS; ci++) {
          var spread = (ci / (CURVES_PER_OBS - 1) - 0.5) * 2;
          var targetY = cloudCy + spread * cloudR * 0.52 + (hashLcg(bi * 13 + ci, 301) - 0.5) * cloudR * 0.18;
          var targetX = cloudCx - cloudR * (0.18 + 0.32 * hashLcg(bi * 13 + ci, 302));
          var p0 = { x: anc.x, y: anc.y + spread * (compact ? 1.5 : 3.5) };
          var p3 = { x: targetX, y: targetY };
          var p1 = { x: lerp(p0.x, p3.x, 0.42), y: p0.y + spread * (compact ? 6 : 12) };
          var p2 = { x: lerp(p0.x, p3.x, 0.72), y: lerp(p0.y, p3.y, 0.82) };

          c.strokeStyle = bezGrad;
          c.lineWidth = compact ? 0.55 : 0.75;
          c.beginPath();
          c.moveTo(p0.x, p0.y);
          c.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
          c.stroke();

          // Traveling light dot along curve (position = f(t))
          if (ci % 2 === 0) {
            var spd = 1.2 + hashLcg(bi * 7 + ci, 305) * 0.9;
            var ph = hashLcg(bi * 7 + ci, 306);
            var sPos = (u * spd + ph) % 1;
            var pt = cubicPt(p0, p1, p2, p3, sPos);
            c.fillStyle = sPos < 0.45 ? "rgba(245, 179, 1, 0.85)" : "rgba(34, 211, 238, 0.92)";
            c.beginPath();
            c.arc(pt.x, pt.y, compact ? 1.2 : 1.7, 0, Math.PI * 2);
            c.fill();
          }
        }
      }

      // Central particle cloud glow + 1,200 rotating points
      var orbGlow = c.createRadialGradient(cloudCx, cloudCy, cloudR * 0.15, cloudCx, cloudCy, cloudR * 1.25);
      orbGlow.addColorStop(0, "rgba(245, 179, 1, 0.16)");
      orbGlow.addColorStop(0.55, "rgba(34, 211, 238, 0.06)");
      orbGlow.addColorStop(1, "rgba(6, 7, 12, 0)");
      c.fillStyle = orbGlow;
      c.beginPath(); c.arc(cloudCx, cloudCy, cloudR * 1.25, 0, Math.PI * 2); c.fill();

      c.strokeStyle = "rgba(245, 179, 1, 0.22)";
      c.lineWidth = 0.8;
      c.beginPath(); c.arc(cloudCx, cloudCy, cloudR * 1.04, 0, Math.PI * 2); c.stroke();

      var rotY = u * Math.PI * 1.5;
      var rotX = 0.24 + Math.sin(u * Math.PI * 2) * 0.08;
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      var cosX = Math.cos(rotX), sinX = Math.sin(rotX);

      for (var k = 0; k < CLOUD.length; k++) {
        var pt3 = CLOUD[k];
        var rx1 = pt3.x * cosY - pt3.z * sinY;
        var rz1 = pt3.x * sinY + pt3.z * cosY;
        var ry2 = pt3.y * cosX - rz1 * sinX;
        var rz2 = pt3.y * sinX + rz1 * cosX;
        var depth = clamp((rz2 + 1) * 0.5, 0.12, 1);
        var px = cloudCx + rx1 * cloudR;
        var py = cloudCy + ry2 * cloudR;
        var alpha = 0.18 + 0.72 * depth;
        c.fillStyle = pt3.gold
          ? ("rgba(245, 179, 1, " + alpha.toFixed(2) + ")")
          : ("rgba(244, 244, 245, " + (alpha * 0.85).toFixed(2) + ")");
        var pSz = pt3.sz * (compact ? 0.72 : 1.0) * (0.65 + 0.55 * depth);
        c.fillRect(px - pSz * 0.5, py - pSz * 0.5, pSz, pSz);
      }

      // Compute deterministic ranked decision stack
      var ranked = TOKENS.map(function (tk, idx) {
        var jitter = 0.03 * Math.sin(u * Math.PI * 2 + idx * 1.15 + hashLcg(idx, 401) * 6.28);
        return {
          sym: tk.sym,
          score: clamp(tk.base + jitter, 0.12, 0.98)
        };
      });
      ranked.sort(function (a, b) { return b.score - a.score; });

      // Fan-out lines from cloud to each of the 10 decision rows (width = score) + DECISION STACK rows
      var decRowH = listH / ranked.length;
      for (var di = 0; di < ranked.length; di++) {
        var item = ranked[di];
        var dy = listTop + (di + 0.5) * decRowH;
        var isTop = di === 0;
        var isBuy = item.score >= 0.62;

        // Fan-out curve from central cloud to row left edge
        var srcX = cloudCx + cloudR * 0.42;
        var srcY = cloudCy + ((di / (ranked.length - 1)) - 0.5) * cloudR * 0.55;
        var dstX = xR + 2;
        var dstY = dy;
        c.strokeStyle = isTop ? "rgba(236, 72, 153, 0.82)" : (isBuy ? "rgba(34, 211, 238, 0.36)" : "rgba(113, 113, 122, 0.25)");
        c.lineWidth = 0.45 + item.score * (compact ? 1.2 : 2.1);
        c.beginPath();
        c.moveTo(srcX, srcY);
        c.bezierCurveTo(lerp(srcX, dstX, 0.45), srcY, lerp(srcX, dstX, 0.55), dstY, dstX, dstY);
        c.stroke();

        // Row card
        var rowPadY = Math.max(1.2, decRowH * 0.10);
        var rH = decRowH - rowPadY * 2;
        c.fillStyle = isTop ? "rgba(236, 72, 153, 0.22)" : CARD;
        roundRect(c, xR + 2, dy - rH * 0.5, wR - 4, rH, 3);
        c.fill();
        c.strokeStyle = isTop ? MAGENTA : LINE;
        c.lineWidth = isTop ? 1.2 : 0.65;
        c.stroke();

        var df = compact ? 6.4 : (w < 540 ? 7.0 : 8.2);
        var badgeW = compact ? 22 : 28;
        var badgeH = Math.min(12, rH - 2);
        var badgeCol = isTop ? MAGENTA : (isBuy ? GREEN : MUTED);
        drawPill(c, isBuy ? "BUY" : "SKIP", xR + 5, dy - badgeH * 0.5, badgeW, badgeH, badgeCol, compact ? 5.6 : 6.6);

        var symX = xR + 5 + badgeW + 4;
        text(c, item.sym, symX, dy, df, isTop ? FG : TEXT, "left", isTop ? "700" : "500");

        var scoreStr = item.score.toFixed(2);
        text(c, scoreStr, xR + wR - 5, dy, df, isTop ? MAGENTA : (isBuy ? CYAN : DIM), "right", "700");

        if (!compact && wR > 110) {
          var barW = Math.max(18, wR - badgeW - 92);
          var barX = xR + wR - 36 - barW;
          var barH = Math.min(4.5, rH * 0.34);
          c.fillStyle = "#181c28";
          c.fillRect(barX, dy - barH * 0.5, barW, barH);
          c.fillStyle = isTop ? MAGENTA : (isBuy ? GREEN : MUTED);
          c.fillRect(barX, dy - barH * 0.5, barW * item.score, barH);
        }
      }

      return "TOP " + ranked[0].sym + " (" + ranked[0].score.toFixed(2) + ")";
    }, o);
  }

  /* #61 landingCurve — 落點曲線 (driver n=48) */
  function landingCurve(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 48;

    var MARQUEE = "TKN-A +12% · TKN-B -4% · TKN-C +28% · TKN-D -9% · TKN-E +6% · TKN-F +41% · TKN-G -2% · TKN-H +17% · TKN-J +5% · ";

    // Exponential bonding curve helper y in [0, 1]
    var EXP_K = 2.85;
    var EXP_DEN = Math.exp(EXP_K) - 1;
    function curveY(x) {
      return (Math.exp(EXP_K * clamp(x, 0, 1)) - 1) / EXP_DEN;
    }

    // 24 deterministic buy landing points
    var N_BUYS = 24;
    var BUYS = [];
    for (var bi = 0; bi < N_BUYS; bi++) {
      var bx = clamp(0.06 + (bi / (N_BUYS - 1)) * 0.86 + (hashLcg(bi, 501) - 0.5) * 0.025, 0.04, 0.94);
      var win = hashLcg(bi, 502) > 0.34;
      BUYS.push({
        x: bx,
        y: curveY(bx),
        price: 0.12 + curveY(bx) * 2.40,
        win: win,
        appearU: bi / (N_BUYS - 1)
      });
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 7 : 11;
      var topH = compact ? 18 : 22;

      // Top marquee bar
      var mqH = compact ? 16 : 19;
      c.fillStyle = CARD;
      roundRect(c, pad, 4, w - pad * 2, mqH, 3);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 0.8;
      c.stroke();

      c.save();
      roundRect(c, pad + 2, 4, w - pad * 2 - 4, mqH, 2);
      c.clip();
      var mqF = compact ? 7.2 : 8.5;
      c.font = "600 " + mqF + "px " + MONO;
      var mqW = Math.max(120, c.measureText(MARQUEE).width);
      var mqOff = (u * mqW * 1.4) % mqW;
      var mqY = 4 + mqH * 0.5;
      text(c, MARQUEE, pad + 6 - mqOff, mqY, mqF, GOLD, "left", "600");
      text(c, MARQUEE, pad + 6 - mqOff + mqW, mqY, mqF, GOLD, "left", "600");
      c.restore();

      var bodyY = 4 + mqH + (compact ? 6 : 8);
      var sideW = compact ? 92 : (w < 540 ? 124 : 158);
      var gap = compact ? 6 : 10;
      var plotX = pad + (compact ? 20 : 28);
      var plotY = bodyY + (compact ? 14 : 18);
      var plotW = Math.max(80, w - plotX - sideW - gap - pad);
      var plotH = Math.max(60, h - plotY - (compact ? 20 : 24));

      // Header above plot
      text(c, compact ? "LANDING CURVE" : "ORB 02 · WHERE A BUY LANDS ON THE CURVE", pad, bodyY + 5, compact ? 7.5 : 9, DIM, "left", "700");

      // Axes & subtle grid
      c.strokeStyle = LINE;
      c.lineWidth = 0.8;
      for (var gi = 1; gi <= 3; gi++) {
        var gy = plotY + plotH * (gi / 4);
        c.beginPath(); c.moveTo(plotX, gy); c.lineTo(plotX + plotW, gy); c.stroke();
      }
      c.strokeStyle = "#334155";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(plotX, plotY);
      c.lineTo(plotX, plotY + plotH);
      c.lineTo(plotX + plotW, plotY + plotH);
      c.stroke();

      text(c, "PRICE", plotX - 4, plotY + 4, compact ? 6.5 : 7.5, MUTED, "right");
      text(c, "SUPPLY →", plotX + plotW, plotY + plotH + 10, compact ? 6.5 : 7.5, MUTED, "right");

      // Exponential curve + dark-to-gold gradient fill under curve
      var N_SEG = 72;
      var areaGrad = c.createLinearGradient(0, plotY, 0, plotY + plotH);
      areaGrad.addColorStop(0, "rgba(245, 179, 1, 0.36)");
      areaGrad.addColorStop(0.65, "rgba(245, 179, 1, 0.11)");
      areaGrad.addColorStop(1, "rgba(6, 7, 12, 0.02)");

      c.beginPath();
      c.moveTo(plotX, plotY + plotH);
      for (var si = 0; si <= N_SEG; si++) {
        var sxN = si / N_SEG;
        var px = plotX + sxN * plotW;
        var py = plotY + plotH - curveY(sxN) * plotH * 0.92;
        c.lineTo(px, py);
      }
      c.lineTo(plotX + plotW, plotY + plotH);
      c.closePath();
      c.fillStyle = areaGrad;
      c.fill();

      c.strokeStyle = GOLD;
      c.lineWidth = 2.2;
      c.beginPath();
      for (var sj = 0; sj <= N_SEG; sj++) {
        var sxN2 = sj / N_SEG;
        var px2 = plotX + sxN2 * plotW;
        var py2 = plotY + plotH - curveY(sxN2) * plotH * 0.92;
        if (sj === 0) c.moveTo(px2, py2);
        else c.lineTo(px2, py2);
      }
      c.stroke();

      // "YOU ARE HERE" vertical dashed line moving right with t
      var hereU = lerp(0.14, 0.92, u);
      var herePx = plotX + hereU * plotW;
      var herePy = plotY + plotH - curveY(hereU) * plotH * 0.92;

      c.save();
      c.setLineDash([4, 3]);
      c.strokeStyle = CYAN;
      c.lineWidth = 1.25;
      c.beginPath();
      c.moveTo(herePx, plotY + 12);
      c.lineTo(herePx, plotY + plotH);
      c.stroke();
      c.restore();

      c.fillStyle = CYAN;
      c.beginPath(); c.arc(herePx, herePy, 4, 0, Math.PI * 2); c.fill();
      var hereTagW = compact ? 64 : 84;
      var hereTagX = clamp(herePx - hereTagW * 0.5, plotX + 2, plotX + plotW - hereTagW - 2);
      drawPill(c, "YOU ARE HERE", hereTagX, plotY - 2, hereTagW, 13, CYAN, compact ? 5.8 : 6.8);

      // Buy landing points appearing one by one with t
      var latestBuy = BUYS[0];
      for (var k = 0; k < BUYS.length; k++) {
        var b = BUYS[k];
        if (u + 0.001 < b.appearU) continue;
        latestBuy = b;
        var bpx = plotX + b.x * plotW;
        var bpy = plotY + plotH - b.y * plotH * 0.92;
        var isLast = (k === BUYS.length - 1) || (u + 0.001 < BUYS[k + 1].appearU);
        var bCol = b.win ? GREEN : RED;

        if (isLast) {
          c.fillStyle = bCol + "44";
          c.beginPath(); c.arc(bpx, bpy, compact ? 7.5 : 9.5, 0, Math.PI * 2); c.fill();
          c.fillStyle = bCol;
          c.beginPath(); c.arc(bpx, bpy, compact ? 4.2 : 5.2, 0, Math.PI * 2); c.fill();
          c.strokeStyle = FG;
          c.lineWidth = 1.1;
          c.stroke();

          // Callout label "BUY @ x.xx"
          var lblTxt = "BUY @ " + b.price.toFixed(2);
          var lblW = compact ? 58 : 74;
          var lblX = clamp(bpx - lblW - 10, plotX + 4, plotX + plotW - lblW - 4);
          var lblY = clamp(bpy - 26, plotY + 15, plotY + plotH - 20);
          c.strokeStyle = bCol;
          c.lineWidth = 1;
          c.beginPath();
          c.moveTo(bpx, bpy);
          c.lineTo(lblX + lblW * 0.5, lblY + 14);
          c.stroke();
          c.fillStyle = "rgba(6, 7, 12, 0.92)";
          roundRect(c, lblX, lblY, lblW, 14, 3);
          c.fill();
          c.strokeStyle = bCol;
          c.stroke();
          text(c, lblTxt, lblX + lblW * 0.5, lblY + 7, compact ? 6.5 : 7.5, bCol, "center", "700");
        } else {
          c.fillStyle = bCol;
          c.beginPath(); c.arc(bpx, bpy, compact ? 2.4 : 3.0, 0, Math.PI * 2); c.fill();
        }
      }

      // Right 4-row readout computed from current curve data
      var sideX = w - pad - sideW;
      var sideY = plotY;
      var sideH = plotH;
      c.fillStyle = CARD;
      roundRect(c, sideX, sideY, sideW, sideH, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var curPrice = 0.12 + curveY(hereU) * 2.40;
      var curvePct = hereU * 100;
      var slipPct = 0.35 + 2.45 * hereU * hereU;
      var edgePct = (1.0 - hereU) * 26.0 - 4.0;

      var METRICS = [
        { k: "entry",   v: "$" + curPrice.toFixed(2), col: GOLD },
        { k: "curve %", v: curvePct.toFixed(1) + "%", col: CYAN },
        { k: "slip",    v: slipPct.toFixed(2) + "%",  col: slipPct > 1.6 ? RED : TEXT },
        { k: "edge",    v: (edgePct >= 0 ? "+" : "") + edgePct.toFixed(1) + "%", col: edgePct >= 0 ? GREEN : RED }
      ];

      text(c, "CURVE STATE", sideX + 8, sideY + 11, compact ? 6.5 : 7.8, DIM, "left", "700");
      var mTop = sideY + 20;
      var mStep = (sideH - 24) / METRICS.length;
      for (var mi = 0; mi < METRICS.length; mi++) {
        var mt = METRICS[mi];
        var my = mTop + (mi + 0.5) * mStep;
        if (mi > 0) {
          c.strokeStyle = LINE;
          c.lineWidth = 0.6;
          c.beginPath(); c.moveTo(sideX + 6, mTop + mi * mStep); c.lineTo(sideX + sideW - 6, mTop + mi * mStep); c.stroke();
        }
        text(c, mt.k, sideX + 8, my - (compact ? 5 : 6), compact ? 6.8 : 8, MUTED, "left", "600");
        text(c, mt.v, sideX + sideW - 8, my + (compact ? 6 : 7), compact ? 9 : 11.5, mt.col, "right", "700");
      }

      return "BUY @ " + latestBuy.price.toFixed(2) + " · curve " + curvePct.toFixed(0) + "%";
    }, o);
  }

  /* #62 constellationMap — 圓形星座圖 (driver n=60) */
  function constellationMap(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;

    var CLUSTERS = [
      { id: "CLUSTER A", col: GOLD,    ang: -2.55, r: 0.52 },
      { id: "CLUSTER B", col: CYAN,    ang: -1.65, r: 0.58 },
      { id: "CLUSTER C", col: MAGENTA, ang: -0.62, r: 0.48 },
      { id: "CLUSTER D", col: GREEN,   ang:  0.38, r: 0.60 },
      { id: "CLUSTER E", col: PURPLE,  ang:  1.35, r: 0.50 },
      { id: "CLUSTER F", col: "#38bdf8", ang: 2.25, r: 0.56 },
      { id: "CLUSTER G", col: "#fb923c", ang: 3.05, r: 0.42 }
    ];

    // Precompute ~120 deterministic stars across 7 clusters + nearest-neighbor edges per cluster
    var STARS = [];
    var EDGES = [];
    var TOTAL_STARS = 119; // 17 * 7
    for (var ci = 0; ci < CLUSTERS.length; ci++) {
      var cl = CLUSTERS[ci];
      var ccx = Math.cos(cl.ang) * cl.r;
      var ccy = Math.sin(cl.ang) * cl.r;
      var startIdx = STARS.length;
      for (var si = 0; si < 17; si++) {
        var idx = startIdx + si;
        var aLoc = hashLcg(idx, 601) * Math.PI * 2;
        var dLoc = (0.06 + 0.24 * Math.sqrt(hashLcg(idx, 602)));
        var sx = ccx + Math.cos(aLoc) * dLoc;
        var sy = ccy + Math.sin(aLoc) * dLoc;
        var normR = Math.hypot(sx, sy);
        if (normR > 0.90) {
          sx = sx / normR * 0.90;
          sy = sy / normR * 0.90;
        }
        var starAng = Math.atan2(sy, sx);
        STARS.push({
          x: sx, y: sy,
          ang: starAng,
          w: 0.25 + 0.75 * hashLcg(idx, 603),
          cl: ci,
          col: cl.col
        });
      }
      // Connect each star to its 2 nearest neighbors within same cluster
      var endIdx = STARS.length;
      var seen = {};
      for (var a = startIdx; a < endIdx; a++) {
        var dists = [];
        for (var b = startIdx; b < endIdx; b++) {
          if (a === b) continue;
          var dx = STARS[a].x - STARS[b].x;
          var dy = STARS[a].y - STARS[b].y;
          dists.push({ b: b, d2: dx * dx + dy * dy });
        }
        dists.sort(function (p, q) { return p.d2 - q.d2; });
        for (var nn = 0; nn < 2; nn++) {
          var bIdx = dists[nn].b;
          var key = a < bIdx ? (a + ":" + bIdx) : (bIdx + ":" + a);
          if (!seen[key]) {
            seen[key] = 1;
            EDGES.push({ a: a, b: bIdx, col: cl.col });
          }
        }
      }
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 12;
      var topH = compact ? 20 : 24;

      var scanAng = -Math.PI * 0.5 + u * Math.PI * 2.5;
      var litCount = 0;

      // Top bar
      text(c, compact ? "CONSTELLATION" : "ORB 03 · CONSTELLATION MAP", pad, topH * 0.5, compact ? 8 : 9.5, CYAN, "left", "700");

      var cx = w * 0.5;
      var cy = topH + (h - topH) * 0.52;
      var R = Math.min(w - pad * 2, h - topH - pad) * 0.45;

      // Concentric circles
      c.strokeStyle = LINE;
      c.lineWidth = 0.9;
      for (var ri = 1; ri <= 4; ri++) {
        c.beginPath();
        c.arc(cx, cy, R * (ri / 4), 0, Math.PI * 2);
        c.stroke();
      }
      // Outer boundary ring
      c.strokeStyle = "rgba(34, 211, 238, 0.35)";
      c.lineWidth = 1.3;
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();

      // Radial spokes (12 divisions)
      c.strokeStyle = "rgba(31, 36, 51, 0.85)";
      c.lineWidth = 0.7;
      for (var sp = 0; sp < 12; sp++) {
        var sa = (sp / 12) * Math.PI * 2;
        c.beginPath();
        c.moveTo(cx, cy);
        c.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R);
        c.stroke();
      }

      // Rotating scan sector (wedge fade behind scanAng)
      var SWEEP_SPAN = 0.65;
      var WEDGE_SLICES = 14;
      for (var ws = 0; ws < WEDGE_SLICES; ws++) {
        var f0 = ws / WEDGE_SLICES;
        var f1 = (ws + 1) / WEDGE_SLICES;
        var a0 = scanAng - SWEEP_SPAN * (1 - f0);
        var a1 = scanAng - SWEEP_SPAN * (1 - f1);
        c.fillStyle = "rgba(34, 211, 238, " + (0.015 + 0.16 * f0 * f0).toFixed(3) + ")";
        c.beginPath();
        c.moveTo(cx, cy);
        c.arc(cx, cy, R, a0, a1);
        c.closePath();
        c.fill();
      }
      c.strokeStyle = CYAN;
      c.lineWidth = 1.6;
      c.beginPath();
      c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(scanAng) * R, cy + Math.sin(scanAng) * R);
      c.stroke();

      // Compute star brightness boost when swept
      var starGlow = new Array(STARS.length);
      for (var i = 0; i < STARS.length; i++) {
        var st = STARS[i];
        var lag = ((scanAng - st.ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        var gBoost = lag < 0.78 ? (1 - lag / 0.78) : 0;
        starGlow[i] = gBoost;
        if (gBoost > 0.15) litCount++;
      }

      // Constellation edges
      for (var ei = 0; ei < EDGES.length; ei++) {
        var ed = EDGES[ei];
        var saNode = STARS[ed.a], sbNode = STARS[ed.b];
        var eg = Math.max(starGlow[ed.a], starGlow[ed.b]);
        c.strokeStyle = ed.col;
        c.globalAlpha = 0.26 + 0.62 * eg;
        c.lineWidth = 0.7 + 0.9 * eg;
        c.beginPath();
        c.moveTo(cx + saNode.x * R, cy + saNode.y * R);
        c.lineTo(cx + sbNode.x * R, cy + sbNode.y * R);
        c.stroke();
      }
      c.globalAlpha = 1;

      // Stars (size = weight, brightened when swept)
      for (var si2 = 0; si2 < STARS.length; si2++) {
        var sr = STARS[si2];
        var glow = starGlow[si2];
        var px = cx + sr.x * R;
        var py = cy + sr.y * R;
        var baseRad = (compact ? 1.1 : 1.5) + sr.w * (compact ? 1.8 : 2.5);

        if (glow > 0.05) {
          c.fillStyle = sr.col;
          c.globalAlpha = 0.35 * glow;
          c.beginPath();
          c.arc(px, py, baseRad * (1.8 + 1.3 * glow), 0, Math.PI * 2);
          c.fill();
          c.globalAlpha = 1;
        }
        c.fillStyle = glow > 0.45 ? FG : sr.col;
        c.beginPath();
        c.arc(px, py, baseRad * (1 + 0.35 * glow), 0, Math.PI * 2);
        c.fill();
      }

      // Cluster labels (CLUSTER A-G) with dark pill backing outside cluster core
      var lblF = compact ? 6.0 : 7.4;
      var lblW = compact ? 44 : 54;
      var lblH = compact ? 10 : 12;
      for (var li = 0; li < CLUSTERS.length; li++) {
        var clu = CLUSTERS[li];
        var lRad = Math.min(0.95, clu.r + 0.30);
        var lx = cx + Math.cos(clu.ang) * R * lRad;
        var ly = cy + Math.sin(clu.ang) * R * lRad;
        lx = clamp(lx, cx - R * 0.96 + lblW * 0.5, cx + R * 0.96 - lblW * 0.5);
        ly = clamp(ly, cy - R * 0.96 + lblH * 0.5, cy + R * 0.96 - lblH * 0.5);
        c.fillStyle = "rgba(6, 7, 12, 0.84)";
        roundRect(c, lx - lblW * 0.5, ly - lblH * 0.5, lblW, lblH, 3);
        c.fill();
        c.strokeStyle = clu.col + "66";
        c.lineWidth = 0.7;
        c.stroke();
        text(c, clu.id, lx, ly, lblF, clu.col, "center", "700");
      }

      // Top-right ESTABLISHMENT MAP + count
      text(c, "ESTABLISHMENT MAP · " + TOTAL_STARS + " (" + litCount + " LIT)", w - pad, topH * 0.5, compact ? 7 : 8.5, FG, "right", "700");

      return "ESTABLISHMENT MAP · " + litCount + "/" + TOTAL_STARS + " lit";
    }, o);
  }

  /* #63 agentSquad — 六代理匯流排 (driver n=60) */
  function agentSquad(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;

    var AGENTS = [
      { name: "SCOUT",        short: "SCOUT", base: 148, rate: 42, col: CYAN,    icon: "radar" },
      { name: "CARTOGRAPHER", short: "CARTO", base: 94,  rate: 28, col: PURPLE,  icon: "map" },
      { name: "ANALYST",      short: "ANLST", base: 72,  rate: 22, col: GOLD,    icon: "bars" },
      { name: "QUANT",        short: "QUANT", base: 64,  rate: 19, col: MAGENTA, icon: "sigma" },
      { name: "GUARD",        short: "GUARD", base: 51,  rate: 14, col: GREEN,   icon: "shield" },
      { name: "EXECUTOR",     short: "EXEC",  base: 18,  rate: 9,  col: GOLD,    icon: "bolt" }
    ];

    var LOGS = [
      { thr: 0.04, tag: "SCAN",  col: CYAN,    msg: "TKN-A pool detected · vel 3.2x" },
      { thr: 0.20, tag: "MAP",   col: PURPLE,  msg: "TKN-C cluster linked · 17 holders" },
      { thr: 0.36, tag: "SCORE", col: GOLD,    msg: "TKN-A state score 0.94 (+0.08)" },
      { thr: 0.52, tag: "SIZE",  col: MAGENTA, msg: "TKN-F curve slip 0.72% · Kelly OK" },
      { thr: 0.68, tag: "GATE",  col: GREEN,   msg: "GUARD passed · max cap within limit" },
      { thr: 0.84, tag: "EXEC",  col: GOLD,    msg: "BUY TKN-A @ 0.48 · filled 14ms" }
    ];

    var FEATURES = [
      { name: "INFLOW",  init:  0.18, target:  0.84 },
      { name: "SPREAD",  init:  0.12, target:  0.62 },
      { name: "ACCEL",   init: -0.14, target:  0.56 },
      { name: "DEPTH",   init:  0.22, target:  0.48 },
      { name: "CREATOR", init: -0.25, target: -0.68 },
      { name: "MOOD",    init:  0.08, target:  0.39 },
      { name: "SLIP",    init: -0.12, target: -0.52 },
      { name: "RISK",    init: -0.30, target: -0.76 }
    ];

    function drawAgentIcon(c, kind, x, y, r, col) {
      c.save();
      c.translate(x, y);
      c.strokeStyle = col;
      c.fillStyle = col;
      c.lineWidth = 1.2;
      if (kind === "radar") {
        c.beginPath(); c.arc(0, 0, r * 0.85, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.arc(0, 0, r * 0.42, 0, Math.PI * 2); c.stroke();
        c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 0.65, -r * 0.55); c.stroke();
      } else if (kind === "map") {
        c.beginPath();
        c.moveTo(0, -r * 0.9); c.lineTo(r * 0.9, 0); c.lineTo(0, r * 0.9); c.lineTo(-r * 0.9, 0);
        c.closePath(); c.stroke();
        c.beginPath(); c.arc(0, 0, r * 0.24, 0, Math.PI * 2); c.fill();
      } else if (kind === "bars") {
        c.fillRect(-r * 0.75, 0, r * 0.35, r * 0.8);
        c.fillRect(-r * 0.18, -r * 0.55, r * 0.35, r * 1.35);
        c.fillRect(r * 0.40, -r * 0.85, r * 0.35, r * 1.65);
      } else if (kind === "sigma") {
        c.beginPath();
        c.moveTo(r * 0.65, -r * 0.75);
        c.lineTo(-r * 0.65, -r * 0.75);
        c.lineTo(r * 0.20, 0);
        c.lineTo(-r * 0.65, r * 0.75);
        c.lineTo(r * 0.65, r * 0.75);
        c.stroke();
      } else if (kind === "shield") {
        c.beginPath();
        c.moveTo(0, -r * 0.85);
        c.lineTo(r * 0.75, -r * 0.50);
        c.lineTo(r * 0.60, r * 0.35);
        c.lineTo(0, r * 0.90);
        c.lineTo(-r * 0.60, r * 0.35);
        c.lineTo(-r * 0.75, -r * 0.50);
        c.closePath();
        c.stroke();
      } else {
        c.beginPath();
        c.moveTo(r * 0.25, -r * 0.9);
        c.lineTo(-r * 0.50, r * 0.05);
        c.lineTo(r * 0.05, r * 0.05);
        c.lineTo(-r * 0.25, r * 0.9);
        c.lineTo(r * 0.55, -r * 0.10);
        c.lineTo(0, -r * 0.10);
        c.closePath();
        c.fill();
      }
      c.restore();
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 7 : 11;
      var topH = compact ? 20 : 24;
      var gap = compact ? 6 : 9;

      text(c, compact ? "AGENT SQUAD" : "ORB 04 · SIX AGENTS · BUS & STATE BUILDER", pad, topH * 0.5, compact ? 8 : 9.5, GOLD, "left", "700");
      var activeAgentIdx = Math.floor((u * 1.999 * AGENTS.length)) % AGENTS.length;
      text(c, "BUS: " + AGENTS[activeAgentIdx].short + " · " + Math.round(u * 100) + "%", w - pad, topH * 0.5, compact ? 7 : 8.5, CYAN, "right", "700");

      var curY = topH + 3;

      if (compact) {
        // compact: 代理框 3x2，隱藏日誌
        var cols = 3, rows = 2;
        var bw = (w - pad * 2 - gap * (cols - 1)) / cols;
        var bh = 38;

        // Draw bus lines connecting row 1 & row 2
        var r1Y = curY + bh * 0.5;
        var r2Y = curY + bh + gap + bh * 0.5;
        c.strokeStyle = "rgba(34, 211, 238, 0.35)";
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(pad + bw * 0.5, r1Y);
        c.lineTo(w - pad - bw * 0.5, r1Y);
        c.moveTo(w - pad - bw * 0.5, r1Y);
        c.lineTo(w - pad - bw * 0.5, r2Y);
        c.moveTo(w - pad - bw * 0.5, r2Y);
        c.lineTo(pad + bw * 0.5, r2Y);
        c.stroke();

        // Moving bus pulse along 3x2 snake path
        var pFrac = (u * 2.2) % 1;
        var px, py;
        if (pFrac < 0.42) {
          px = lerp(pad + bw * 0.5, w - pad - bw * 0.5, pFrac / 0.42);
          py = r1Y;
        } else if (pFrac < 0.58) {
          px = w - pad - bw * 0.5;
          py = lerp(r1Y, r2Y, (pFrac - 0.42) / 0.16);
        } else {
          px = lerp(w - pad - bw * 0.5, pad + bw * 0.5, (pFrac - 0.58) / 0.42);
          py = r2Y;
        }
        c.fillStyle = GOLD;
        c.beginPath(); c.arc(px, py, 3.2, 0, Math.PI * 2); c.fill();

        for (var ai = 0; ai < AGENTS.length; ai++) {
          var ag = AGENTS[ai];
          var rr = Math.floor(ai / cols);
          var cc = rr === 0 ? (ai % cols) : (cols - 1 - (ai % cols));
          var bx = pad + cc * (bw + gap);
          var by = curY + rr * (bh + gap);
          var isAct = ai === activeAgentIdx;

          c.fillStyle = CARD;
          roundRect(c, bx, by, bw, bh, 4);
          c.fill();
          c.strokeStyle = isAct ? ag.col : LINE;
          c.lineWidth = isAct ? 1.3 : 0.9;
          c.stroke();

          drawAgentIcon(c, ag.icon, bx + 12, by + 13, 6, ag.col);
          c.fillStyle = isAct ? GREEN : ag.col;
          c.beginPath(); c.arc(bx + bw - 7, by + 8, 2.3, 0, Math.PI * 2); c.fill();
          text(c, ag.short, bx + 22, by + 13, 7, FG, "left", "700");
          text(c, String(ag.base + Math.round(ag.rate * u)), bx + bw - 6, by + 28, 8.5, ag.col, "right", "700");
        }

        curY += bh * 2 + gap * 2;
        // Full-width STATE BUILDER (log hidden in compact)
        var sbBox = { x: pad, y: curY, w: w - pad * 2, h: Math.max(70, h - curY - pad) };
        drawStateBuilder(c, sbBox, u, true);
        return "AGENT " + AGENTS[activeAgentIdx].short + " · 3x2";
      }

      // Full layout: Top 6 boxes in 1 row connected by horizontal bus
      var nAg = AGENTS.length;
      var boxGap = w < 540 ? 6 : 10;
      var boxW = (w - pad * 2 - boxGap * (nAg - 1)) / nAg;
      var boxH = h < 390 ? 68 : 86;
      var busY = curY + boxH * 0.5;

      // Horizontal bus line behind boxes
      c.strokeStyle = "rgba(34, 211, 238, 0.38)";
      c.lineWidth = 2.2;
      c.beginPath();
      c.moveTo(pad + boxW * 0.5, busY);
      c.lineTo(w - pad - boxW * 0.5, busY);
      c.stroke();

      // Sequential pulse spots along the bus (position = f(t))
      var N_PULSES = 4;
      for (var pi = 0; pi < N_PULSES; pi++) {
        var pf = (u * 1.8 + pi / N_PULSES) % 1;
        var ppx = lerp(pad + boxW * 0.5, w - pad - boxW * 0.5, pf);
        c.fillStyle = "rgba(245, 179, 1, 0.28)";
        c.beginPath(); c.arc(ppx, busY, 6.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = GOLD;
        c.beginPath(); c.arc(ppx, busY, 3, 0, Math.PI * 2); c.fill();
      }

      for (var aj = 0; aj < nAg; aj++) {
        var ag2 = AGENTS[aj];
        var ax = pad + aj * (boxW + boxGap);
        var ay = curY;
        var active2 = aj === activeAgentIdx;

        c.fillStyle = CARD;
        roundRect(c, ax, ay, boxW, boxH, 5);
        c.fill();
        c.strokeStyle = active2 ? ag2.col : LINE;
        c.lineWidth = active2 ? 1.5 : 1;
        c.stroke();

        // Status light
        c.fillStyle = active2 ? GREEN : (u > aj / nAg ? ag2.col : MUTED);
        c.beginPath(); c.arc(ax + boxW - 8, ay + 9, 2.8, 0, Math.PI * 2); c.fill();

        // Custom geometric icon
        drawAgentIcon(c, ag2.icon, ax + boxW * 0.5, ay + (h < 390 ? 18 : 23), h < 390 ? 7.5 : 9.5, ag2.col);

        var nameStr = fitTxt(ag2.name, boxW - 8, w < 540 ? 6.5 : 7.8);
        text(c, nameStr, ax + boxW * 0.5, ay + (h < 390 ? 38 : 47), w < 540 ? 6.5 : 7.8, FG, "center", "700");

        var cnt = ag2.base + Math.round(ag2.rate * u);
        text(c, String(cnt), ax + boxW * 0.5, ay + boxH - 12, w < 540 ? 9.5 : 12, ag2.col, "center", "700");
      }

      curY += boxH + gap + 2;
      var botH = Math.max(70, h - curY - pad);
      var logW = Math.round((w - pad * 2 - gap) * 0.52);
      var sbW = w - pad * 2 - gap - logW;
      var logBox = { x: pad, y: curY, w: logW, h: botH };
      var stateBox = { x: pad + logW + gap, y: curY, w: sbW, h: botH };

      // Bottom-left: LAST ACTIONS (6 log lines appearing sequentially)
      c.fillStyle = CARD;
      roundRect(c, logBox.x, logBox.y, logBox.w, logBox.h, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var shownLogs = 0;
      for (var lc = 0; lc < LOGS.length; lc++) if (u >= LOGS[lc].thr) shownLogs++;
      var lf = w < 540 ? 6.8 : 8.2;
      text(c, "LAST ACTIONS", logBox.x + 8, logBox.y + 11, lf, CYAN, "left", "700");
      text(c, shownLogs + "/6", logBox.x + logBox.w - 8, logBox.y + 11, lf - 0.5, MUTED, "right", "600");

      var lTop = logBox.y + 20;
      var lRowH = (logBox.h - 24) / LOGS.length;
      for (var li = 0; li < LOGS.length; li++) {
        var lg = LOGS[li];
        if (u < lg.thr) continue;
        var ly = lTop + (li + 0.5) * lRowH;
        var tagW = w < 540 ? 32 : 38;
        drawPill(c, lg.tag, logBox.x + 7, ly - 6, tagW, 12, lg.col, w < 540 ? 5.8 : 6.6);
        text(c, fitTxt(lg.msg, logBox.w - tagW - 20, lf - 0.4), logBox.x + 12 + tagW, ly, lf - 0.4, TEXT, "left");
      }

      // Bottom-right: STATE BUILDER (8 feature weight bars)
      drawStateBuilder(c, stateBox, u, false);

      return "BUS: " + AGENTS[activeAgentIdx].short + " · " + shownLogs + "/6 logs";
    }, o);

    function drawStateBuilder(c, box, u, isCompact) {
      c.fillStyle = CARD;
      roundRect(c, box.x, box.y, box.w, box.h, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var fSz = isCompact ? 7 : 8.2;
      text(c, "STATE BUILDER", box.x + 8, box.y + 11, fSz, MAGENTA, "left", "700");
      text(c, "WEIGHTS", box.x + box.w - 8, box.y + 11, fSz - 0.6, MUTED, "right", "600");

      var top = box.y + 20;
      var rowH = (box.h - 24) / FEATURES.length;
      var lblW = isCompact ? 50 : 62;
      var valW = isCompact ? 38 : 44;
      var trackX = box.x + 8 + lblW;
      var trackW = Math.max(30, box.w - 16 - lblW - valW);
      var midX = trackX + trackW * 0.5;
      var conv = easeOut(u);

      // Center zero axis
      c.strokeStyle = "#334155";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(midX, top);
      c.lineTo(midX, box.y + box.h - 4);
      c.stroke();

      for (var fi = 0; fi < FEATURES.length; fi++) {
        var ft = FEATURES[fi];
        var fy = top + (fi + 0.5) * rowH;
        var wVal = lerp(ft.init, ft.target, conv);
        var isPos = wVal >= 0;
        var col = isPos ? GREEN : RED;
        var barLen = Math.max(2, Math.abs(wVal) * trackW * 0.48);
        var barH = Math.min(8, rowH * 0.56);

        text(c, ft.name, box.x + 8, fy, fSz - 0.6, TEXT, "left", "600");
        c.fillStyle = "#141824";
        c.fillRect(trackX, fy - barH * 0.5, trackW, barH);
        c.fillStyle = col;
        if (isPos) c.fillRect(midX, fy - barH * 0.5, barLen, barH);
        else c.fillRect(midX - barLen, fy - barH * 0.5, barLen, barH);

        text(c, (isPos ? "+" : "") + wVal.toFixed(2), box.x + box.w - 8, fy, fSz - 0.8, col, "right", "700");
      }
    }
  }

  A23.orbBundle = orbBundle;
  A23.landingCurve = landingCurve;
  A23.constellationMap = constellationMap;
  A23.agentSquad = agentSquad;
  g.A23Charts = A23;
})(window);
