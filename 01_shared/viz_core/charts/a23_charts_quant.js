/* A23 Charts — Quant Terminal QNT 套組 (#47 tailRidge / #48 galtonLattice)
 * 載入順序：在 a23_charts_stanford.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（LCG seed=20261116、零 Math.random、零 Date.now、零閉包累加狀態）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var BG = "#070b12", FG = "#e2e8f0", DIM = "#94a3b8", MUTED = "#64748b";
  var LIME = "#a3e635", PURPLE = "#7c3aed", MAGENTA = "#c026d3", RED = "#ef4444", GREEN = "#84cc16";

  function lerp(a, b, u) { return a + (b - a) * u; }

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

  function hashLcg(idx, salt) {
    var s = (20261116 ^ ((idx + 1) * 2654435761) ^ (salt || 0)) >>> 0;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  }

  function gauss(x, mu, sig) {
    var z = (x - mu) / sig;
    return Math.exp(-0.5 * z * z) / (sig * 2.50662827463);
  }

  /* #47 尾部機率山脊 (Tail Probability Ridge) */
  function tailRidge(cv, _data, opt) {
    var o = opt || {};
    var ROWS = 24, M = 112, XMIN = -3.0, XMAX = 4.0, STRIKE = 1.5;
    var nFrames = 48;

    function buildRow(k) {
      var r1 = hashLcg(k, 11), r2 = hashLcg(k, 23), r3 = hashLcg(k, 37);
      var drift = -0.35 + ((k % 32) / 31) * 0.75 + (r1 - 0.5) * 0.22;
      var tailWave = 0.5 + 0.5 * Math.sin(k * 0.42);
      var w1 = 0.58 - 0.14 * tailWave;
      var w2 = 0.28;
      var w3 = 1 - w1 - w2;
      var mu1 = drift - 0.45, sig1 = 0.72 + r2 * 0.14;
      var mu2 = drift + 0.65, sig2 = 0.82 + r3 * 0.16;
      var mu3 = 1.55 + 0.55 * tailWave + (r1 - 0.5) * 0.2, sig3 = 0.62 + 0.25 * tailWave;

      var vals = new Array(M), total = 0, tailSum = 0, maxV = 0, peakIdx = 0;
      for (var m = 0; m < M; m++) {
        var x = XMIN + (XMAX - XMIN) * (m / (M - 1));
        var v = w1 * gauss(x, mu1, sig1) + w2 * gauss(x, mu2, sig2) + w3 * gauss(x, mu3, sig3);
        vals[m] = v;
        total += v;
        if (x >= STRIKE) tailSum += v;
        if (v > maxV) { maxV = v; peakIdx = m; }
      }
      var pStrike = total > 0 ? (tailSum / total) * 100 : 0;
      var iv = 21 + 16 * tailWave + (r2 - 0.5) * 4;
      var edge = 0.18 + 0.24 * tailWave + (r3 - 0.5) * 0.08;
      return { vals: vals, maxV: maxV, peakIdx: peakIdx, pStrike: pStrike, iv: iv, edge: edge };
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var sideW = compact ? 0 : Math.min(132, Math.max(108, w * 0.22));
      var padR = compact ? 14 : 24, padT = compact ? 26 : 36, padB = compact ? 22 : 28;
      var plotX = sideW + (compact ? 12 : 18);
      var plotW = Math.max(120, w - plotX - padR);
      var topY = padT + 14;
      var botY = h - padB;
      var spanY = Math.max(80, botY - topY);
      var rowGap = spanY / ROWS;
      var ridgeH = Math.max(22, rowGap * 3.1);
      var skewStep = compact ? 1.1 : 1.9;

      var baseIdx = Math.floor(t), frac = t - baseIdx;
      var strikeU = (STRIKE - XMIN) / (XMAX - XMIN);

      // Compute visible rows back -> front
      var frontRow = buildRow(baseIdx + ROWS - 1);
      var sumEdge = 0, sumTail = 0;

      for (var i = 0; i < ROWS; i++) {
        var k = baseIdx + (ROWS - 1 - i);
        var row = (i === ROWS - 1) ? frontRow : buildRow(k);
        sumEdge += row.edge;
        sumTail += row.pStrike;

        var u = i + frac; // 0 (back) .. ROWS (front)
        var depth = Math.min(1, u / (ROWS - 1));
        var y0 = topY + u * rowGap;
        var rowW = plotW * lerp(0.75, 1.0, depth);
        var xStart = plotX + (ROWS - 1 - u) * skewStep + (plotW - rowW) * 0.5;
        var xEnd = xStart + rowW;
        var xStrike = xStart + strikeU * rowW;

        // Build full ridge path
        c.beginPath();
        c.moveTo(xStart, y0);
        for (var m = 0; m < M; m++) {
          var xm = xStart + (m / (M - 1)) * rowW;
          var ym = y0 - (row.vals[m] / Math.max(0.01, row.maxV)) * ridgeH * lerp(0.72, 1.0, depth);
          c.lineTo(xm, ym);
        }
        c.lineTo(xEnd, y0);
        c.closePath();

        // Occlude rows behind
        c.fillStyle = BG;
        c.fill();

        // Clip & fill left (purple) vs right (magenta -> red)
        c.save();
        c.clip();
        c.fillStyle = "rgba(124, 58, 237, " + lerp(0.14, 0.34, depth).toFixed(2) + ")";
        c.fillRect(xStart, y0 - ridgeH - 4, xStrike - xStart, ridgeH + 6);

        var grad = c.createLinearGradient(xStrike, y0, xEnd, y0);
        grad.addColorStop(0, "rgba(192, 38, 211, " + lerp(0.28, 0.68, depth).toFixed(2) + ")");
        grad.addColorStop(1, "rgba(239, 68, 68, " + lerp(0.42, 0.85, depth).toFixed(2) + ")");
        c.fillStyle = grad;
        c.fillRect(xStrike, y0 - ridgeH - 4, xEnd - xStrike + 2, ridgeH + 6);
        c.restore();

        // Stroke top curve
        c.save();
        if (u >= ROWS - 3.5) {
          c.shadowBlur = 6;
          c.shadowColor = MAGENTA;
        }
        var lineGrad = c.createLinearGradient(xStart, y0, xEnd, y0);
        lineGrad.addColorStop(0, "rgba(167, 139, 250, " + lerp(0.35, 0.9, depth).toFixed(2) + ")");
        lineGrad.addColorStop(strikeU, "rgba(192, 38, 211, " + lerp(0.45, 0.95, depth).toFixed(2) + ")");
        lineGrad.addColorStop(1, "rgba(239, 68, 68, " + lerp(0.55, 1.0, depth).toFixed(2) + ")");
        c.strokeStyle = lineGrad;
        c.lineWidth = 1;
        c.beginPath();
        for (var m2 = 0; m2 < M; m2++) {
          var xm2 = xStart + (m2 / (M - 1)) * rowW;
          var ym2 = y0 - (row.vals[m2] / Math.max(0.01, row.maxV)) * ridgeH * lerp(0.72, 1.0, depth);
          if (m2 === 0) c.moveTo(xm2, ym2);
          else c.lineTo(xm2, ym2);
        }
        c.stroke();
        c.restore();
      }

      // Front strike dashed line
      var frontStrikeX = plotX + strikeU * plotW;
      c.save();
      c.setLineDash([4, 4]);
      c.strokeStyle = "rgba(248, 250, 252, 0.40)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(frontStrikeX, topY - 4);
      c.lineTo(frontStrikeX, botY + 4);
      c.stroke();
      c.restore();
      text(c, "STRIKE", frontStrikeX, topY - 11, 9.5, "rgba(248,250,252,0.75)", "center", "700");

      // Front peak tooltip
      var frontU = (ROWS - 1) + frac;
      var frontY0 = topY + Math.min(ROWS - 0.1, frontU) * rowGap;
      var peakX = plotX + (frontRow.peakIdx / (M - 1)) * plotW;
      var peakY = frontY0 - ridgeH;
      var tipTxt = "P(≥STRIKE) " + frontRow.pStrike.toFixed(2) + "% · IV " + frontRow.iv.toFixed(0) + "%";
      var tipW = compact ? 156 : 182, tipH = 22;
      var tipX = Math.max(plotX + 4, Math.min(plotX + plotW - tipW - 4, peakX - tipW * 0.35));
      var tipY = Math.max(topY + 4, peakY - 28);
      c.fillStyle = "rgba(15, 23, 42, 0.92)";
      roundRect(c, tipX, tipY, tipW, tipH, 5);
      c.fill();
      c.strokeStyle = "rgba(192, 38, 211, 0.65)";
      c.lineWidth = 1;
      c.stroke();
      text(c, tipTxt, tipX + tipW * 0.5, tipY + tipH * 0.5, compact ? 9 : 10, FG, "center", "600");

      // X axis labels
      text(c, "-3σ", plotX, botY + 13, 9, MUTED, "left");
      text(c, "0", plotX + (3 / 7) * plotW, botY + 13, 9, MUTED, "center");
      text(c, "+4σ", plotX + plotW, botY + 13, 9, MUTED, "right");

      // Left sidebar
      if (!compact) {
        c.strokeStyle = "rgba(148, 163, 184, 0.15)";
        c.beginPath(); c.moveTo(sideW, 18); c.lineTo(sideW, h - 18); c.stroke();
        var cards = [
          ["SESSIONS", String(baseIdx + ROWS), FG],
          ["TAIL MASS", frontRow.pStrike.toFixed(2) + "%", "#e879f9"],
          ["IMPLIED VOL", frontRow.iv.toFixed(1) + "%", "#f87171"],
          ["AVG EDGE", "+" + (sumEdge / ROWS).toFixed(2) + "σ", LIME]
        ];
        var sy = 44, stepY = (h - 68) / cards.length;
        for (var ci = 0; ci < cards.length; ci++) {
          text(c, cards[ci][0], 14, sy + ci * stepY, 9, MUTED, "left", "700");
          text(c, cards[ci][1], 14, sy + ci * stepY + 18, 15, cards[ci][2], "left", "700");
        }
        text(c, "模擬資料", 14, h - 14, 9, MUTED, "left");
      } else {
        text(c, "模擬資料", w - 12, 12, 8.5, MUTED, "right");
      }

      return "Session " + (baseIdx + 1);
    }, o);
  }

  /* #48 機率晶格 (Galton Lattice) */
  function galtonLattice(cv, _data, opt) {
    var o = opt || {};
    var R = 12, BINS = R + 1, N = 1200, L = 6, nFrames = 60;
    var STRIKE_BIN = 7.5; // between bin 7 and 8

    // Precompute 1200 deterministic particles with LCG seed=20261116
    var seed = 20261116;
    function rnd32() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    }

    var particles = new Array(N);
    for (var i = 0; i < N; i++) {
      var bits = rnd32();
      var path = new Array(R + 1);
      var col = 0;
      path[0] = 0;
      for (var r = 0; r < R; r++) {
        var right = (bits >>> r) & 1;
        col += right ? 0.5 : -0.5;
        path[r + 1] = col;
      }
      var bin = Math.round(col + R * 0.5);
      var s_i = i * (nFrames - 1) * 0.8 / N;
      particles[i] = { s: s_i, path: path, bin: bin };
    }

    /* §6.7（2026-11-16 S11）：建立後 seek 50% 當代表幀（縮圖不再停在第 0 幀空晶格）；左欄統計改子窗＋埠點、資訊字 infoFont；紅綠只留盈虧語意 */
    var TX = g.A23Tex, K = TX.kit(TX.theme(QNT_ACC)), V = K.V;
    var ctl = driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var sideW = compact ? 0 : Math.min(136, Math.max(112, w * 0.23));
      var plotX = sideW + (compact ? 12 : 18);
      var plotW = Math.max(140, w - plotX - (compact ? 12 : 20));
      var cx = plotX + plotW * 0.5;

      var topStarY = compact ? 22 : 26;
      var pegTopY = topStarY + 18;
      var pegSpanY = (h - pegTopY) * 0.44;
      var pegDy = pegSpanY / R;
      var pegDx = Math.min(24, (plotW - 24) / (R + 1));

      var histTopY = pegTopY + pegSpanY + 24;
      var histBotY = h - (compact ? 22 : 26);
      var histH = Math.max(36, histBotY - histTopY);

      // Starburst at top center
      c.save();
      c.strokeStyle = "rgba(163, 230, 53, 0.55)";
      c.lineWidth = 1;
      for (var a = 0; a < 4; a++) {
        var ang = (a * Math.PI) / 4;
        var len = a % 2 === 0 ? 11 : 7;
        c.beginPath();
        c.moveTo(cx - Math.cos(ang) * len, topStarY - Math.sin(ang) * len);
        c.lineTo(cx + Math.cos(ang) * len, topStarY + Math.sin(ang) * len);
        c.stroke();
      }
      c.shadowBlur = 8;
      c.shadowColor = LIME;
      c.fillStyle = LIME;
      c.beginPath(); c.arc(cx, topStarY, 3, 0, Math.PI * 2); c.fill();
      c.restore();

      // Peg matrix
      c.fillStyle = V.line2;
      for (var r = 0; r < R; r++) {
        var py = pegTopY + r * pegDy;
        for (var p = 0; p <= r; p++) {
          var px = cx + (p - r * 0.5) * pegDx;
          c.beginPath();
          c.arc(px, py, compact ? 1.5 : 2, 0, Math.PI * 2);
          c.fill();
        }
      }

      // Closed-form landed bin counts + collect in-flight particles
      var counts = new Array(BINS);
      for (var b = 0; b < BINS; b++) counts[b] = 0;
      var landed = 0, greenCount = 0, evSum = 0;
      var inFlight = [];

      for (var i = 0; i < N; i++) {
        var pt = particles[i];
        if (pt.s + L <= t) {
          counts[pt.bin]++;
          landed++;
          if (pt.bin >= 8) greenCount++;
          evSum += (pt.bin - STRIKE_BIN) * 140;
        } else if (pt.s <= t) {
          inFlight.push(pt);
        }
      }

      // Draw up to 120 in-flight particles with 3-seg trail
      var startFlight = Math.max(0, inFlight.length - 120);
      for (var fi = startFlight; fi < inFlight.length; fi++) {
        var fp = inFlight[fi];
        var u = Math.max(0, Math.min(0.9999, (t - fp.s) / L));
        var pts = [];
        for (var tr = 3; tr >= 0; tr--) {
          var ut = Math.max(0, u - tr * 0.032);
          var rf = ut * R;
          var r0 = Math.min(R - 1, Math.floor(rf));
          var f = rf - r0;
          var xOff = lerp(fp.path[r0], fp.path[r0 + 1], f);
          var bounce = Math.sin(f * Math.PI) * -pegDy * 0.25;
          pts.push({
            x: cx + xOff * pegDx,
            y: pegTopY + rf * pegDy + bounce
          });
        }
        for (var sIdx = 0; sIdx < 3; sIdx++) {
          c.strokeStyle = "rgba(163, 230, 53, " + (0.18 + sIdx * 0.22).toFixed(2) + ")";
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(pts[sIdx].x, pts[sIdx].y);
          c.lineTo(pts[sIdx + 1].x, pts[sIdx + 1].y);
          c.stroke();
        }
        var head = pts[3];
        c.fillStyle = (fi % 4 === 0) ? "#f8fafc" : LIME;
        c.beginPath(); c.arc(head.x, head.y, compact ? 1.8 : 2.3, 0, Math.PI * 2); c.fill();
      }

      // Strike dashed line between bin 7 and 8
      var strikeX = cx + (STRIKE_BIN - R * 0.5) * pegDx;
      c.save();
      c.setLineDash([3, 3]);
      c.strokeStyle = "rgba(248, 250, 252, 0.45)";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(strikeX, histTopY - 12);
      c.lineTo(strikeX, histBotY + 2);
      c.stroke();
      c.restore();

      text(c, "LOSS ZONE", strikeX - 8, histTopY - 8, compact ? 8 : 9, "rgba(239, 68, 68, 0.85)", "right", "700");
      text(c, "PROFIT ZONE", strikeX + 8, histTopY - 8, compact ? 8 : 9, "rgba(132, 204, 22, 0.9)", "left", "700");

      // Histogram bars
      var maxC = 1;
      for (var b2 = 0; b2 < BINS; b2++) if (counts[b2] > maxC) maxC = counts[b2];
      var barW = Math.max(4, pegDx * 0.74);
      for (var b3 = 0; b3 < BINS; b3++) {
        var bx = cx + (b3 - R * 0.5) * pegDx - barW * 0.5;
        var bh = (counts[b3] / maxC) * histH;
        c.fillStyle = (b3 >= 8) ? GREEN : RED;
        if (bh > 0.5) {
          c.fillRect(bx, histBotY - bh, barW, bh);
        }
        c.fillStyle = "rgba(148,163,184,0.18)";
        c.fillRect(bx, histBotY, barW, 1);
      }

      // Left sidebar
      var greenPct = landed > 0 ? (greenCount / landed) * 100 : 0;
      var evTrade = landed > 0 ? evSum / landed : 0;
      function fmtMoney(v) {
        var sign = v >= 0 ? "+$" : "-$";
        return sign + Math.round(Math.abs(v)).toLocaleString("en-US");
      }

      if (!compact) {
        var fI = K.infoFont(w);
        var cards = [
          ["BALLS DROPPED", String(landed), FG],
          ["LANDED GREEN %", greenPct.toFixed(1) + "%", LIME],
          ["EV/TRADE", fmtMoney(evTrade), evTrade >= 0 ? LIME : RED],
          ["NET", fmtMoney(evSum), evSum >= 0 ? LIME : RED]
        ];
        var sy = 30, stepY = (h - 56) / cards.length, cH = Math.min(stepY - 6, fI + 34);
        for (var ci = 0; ci < cards.length; ci++) {
          var cb = { x: 8, y: Math.round(sy + ci * stepY), w: sideW - 14, h: Math.round(cH) };
          K.pane(c, cb);
          K.specEdge(c, cb.x + 3, cb.y + 1, cb.w - 6, ci === 3 ? 0.14 : 0.06);
          text(c, cards[ci][0], cb.x + 7, cb.y + fI * 0.5 + 6, fI, V.dim, "left", "700");
          text(c, cards[ci][1], cb.x + 7, cb.y + cb.h - 13, 15, cards[ci][2], "left", "700");
          K.kvPort(c, cb.x + cb.w, cb.y + cb.h - 13, ci === 3);
        }
        text(c, "模擬資料", 14, h - 14, fI, V.mute, "left");
      } else {
        text(c, "模擬資料", w - 12, 12, 8.5, MUTED, "right");
      }

      return "Drop " + landed;
    }, o);
    ctl.seek(Math.round((nFrames - 1) * 0.5));
    return ctl;
  }

  A23.tailRidge = tailRidge;
  A23.galtonLattice = galtonLattice;

  /* =========================================================================
   * #68–#70 QNT 鏈上持有人掃描擴充 (verdictStack / checkTree / operatorMap)
   * seed=20261116, driver n=60, fps=1.5, 100% deterministic seek(t)
   * ========================================================================= */
  var AMBER = "#f59e0b", EMERALD = "#22c55e", CARD_BG = "#0c121e", LINE_COL = "#1e293b";

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function easeOut(u) { var x = 1 - clamp(u, 0, 1); return 1 - x * x * x; }
  function fitTxt(str, maxW, fSize) {
    var maxCh = Math.max(4, Math.floor(maxW / (fSize * 0.62)));
    return str.length > maxCh ? str.slice(0, maxCh - 1) + "…" : str;
  }
  function drawPill(c, label, x, y, w, h, color, fSize) {
    c.fillStyle = color + "24";
    roundRect(c, x, y, w, h, 3);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 0.9;
    c.stroke();
    text(c, label, x + w * 0.5, y + h * 0.5, fSize, color, "center", "700");
  }

  /* #68 判決卡堆疊 — §6.7 升級（2026-11-16；A23Tex.kit(theme(QNT 主色 LIME))；紅/綠/琥珀只給 DANGER/CLEAN/RISKY 語意） */
  var QNT_ACC = LIME;
  var QV_REASONS = {
    CLEAN: ["籌碼分散 · 前10持有人占 18%", "獨立資金來源 · 無關聯叢集", "流動性鎖定 · 賣壓低於均線", "持倉穩定 · 近期無異常轉出"],
    RISKY: ["前 10 持有人占 52% · 略集中", "關聯錢包 3 組 · 疑似協同買入", "首批買家仍持有 41% 籌碼", "流動性池未完全鎖定 · 留意"],
    DANGER: ["前 10 持有人占 65% · 高度集中", "同一資金來源 4 個錢包關聯", "偵測高頻倒貨地址 · 賣壓 2.4x", "單一實體控制 38% 流通量"]
  };
  function qntSem(st) { return st === "CLEAN" ? EMERALD : (st === "RISKY" ? AMBER : RED); }
  function qntVerdictCard(idx) {
    var HX = "0123456789abcdef", k = idx + 500;
    var r1 = hashLcg(k, 101), r2 = hashLcg(k, 203), r3 = hashLcg(k, 307);
    var score = r1 < 0.42 ? Math.round(70 + r2 * 28) : (r1 < 0.74 ? Math.round(40 + r2 * 29) : Math.round(12 + r2 * 27));
    var state = score >= 70 ? "CLEAN" : (score >= 40 ? "RISKY" : "DANGER");
    var wallet = "0x" + HX[Math.floor(hashLcg(k, 401) * 16)] + HX[Math.floor(hashLcg(k, 409) * 16)] + "…" +
      HX[Math.floor(hashLcg(k, 419) * 16)] + HX[Math.floor(hashLcg(k, 431) * 16)];
    var pool = QV_REASONS[state], u = score / 100;
    return { idx: idx, score: score, state: state, col: qntSem(state), wallet: wallet, reason: pool[Math.floor(r3 * pool.length) % pool.length],
      top10: Math.round(lerp(68, 14, u) + (hashLcg(k, 503) - 0.5) * 8),
      linked: Math.max(0, Math.round(lerp(5, 0, u) + (hashLcg(k, 509) - 0.5) * 1.6)),
      early: Math.round(lerp(48, 6, u) + (hashLcg(k, 521) - 0.5) * 8),
      sell: (lerp(2.6, 0.4, u) + (hashLcg(k, 523) - 0.5) * 0.3).toFixed(1),
      lock: score >= 55 ? "LOCKED" : (score >= 35 ? "PARTIAL" : "OPEN") };
  }
  function verdictStackLive(cv, data, opt, TX) {
    var o = opt || {};
    var K = TX.kit(TX.theme(QNT_ACC)), V = K.V, tx = K.tx;
    var raw = data.verdicts || [];
    var cards = raw.slice(0, 8).map(function (v) {
      var st = String(v.verdict || "RETRY").toUpperCase();
      var col = st === "PASS" ? EMERALD : (st === "ESCALATE" ? RED : AMBER);
      var reasons = Array.isArray(v.reasons) ? v.reasons : [];
      var ev = Array.isArray(v.evidence_paths) ? v.evidence_paths : [];
      return {
        task_id: v.task_id || "—",
        round: Number(v.round || 1),
        model: v.reviewer_model || "—",
        state: st,
        col: col,
        reasons: reasons,
        reason: reasons[0] || "—",
        evidence: ev
      };
    });
    var cnt = { PASS: 0, RETRY: 0, ESCALATE: 0 };
    cards.forEach(function (cd) { cnt[cd.state] = (cnt[cd.state] || 0) + 1; });
    return driver(Math.max(1, cards.length), function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var f = K.infoFont(w), pad = compact ? 6 : 12, hdH = compact ? 16 : Math.round(f * 2.4);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      var hy = Math.round(pad * 0.5 + hdH * 0.5);
      tx(c, compact ? "VERDICT STACK" : "VERDICT STACK · 三態判決卡", pad, hy, f + 1, V.ink, "left", "700");

      var total = Math.max(1, cards.length);
      var barW = Math.min(compact ? 70 : 170, w * 0.3), barH = compact ? 4 : 6, bx = w - pad - barW, by = Math.round(hy - barH / 2);
      var sp = barW * cnt.PASS / total, sr = barW * cnt.RETRY / total;
      c.fillStyle = EMERALD; c.fillRect(bx, by, sp, barH);
      c.fillStyle = AMBER; c.fillRect(bx + sp, by, sr, barH);
      c.fillStyle = RED; c.fillRect(bx + sp + sr, by, barW - sp - sr, barH);
      K.specEdge(c, bx, by, barW, 0.14);
      if (!compact) tx(c, "P " + cnt.PASS + " · R " + cnt.RETRY + " · E " + cnt.ESCALATE, bx - 8, hy, f, V.dim, "right", "600");

      var top = pad + hdH, foot = compact ? 3 : Math.round(f * 1.8), bodyH = h - top - foot - Math.round(pad * 0.5);
      var gapC = compact ? 8 : 18, lw = Math.round((w - pad * 2 - gapC) * 0.58);
      var L = { x: pad, y: top, w: lw, h: bodyH }, rx = pad + lw + gapC, rw = w - pad - rx;
      var vg = compact ? 4 : 8, hpH = Math.round(bodyH * 0.44);
      var R1 = { x: rx, y: top, w: rw, h: hpH }, R2 = { x: rx, y: top + hpH + vg, w: rw, h: bodyH - hpH - vg };

      var ib = K.pane(c, L, "VERDICTS · " + cards.length, compact ? "" : "round");
      K.specEdge(c, L.x + 3, L.y + 1, L.w - 6);
      if (!cards.length) {
        tx(c, "尚無 verdict 紀錄", ib.x + ib.w / 2, ib.y + ib.h / 2, f, V.dim, "center", "600");
        return "Verdicts 0";
      }
      var selIdx = Math.floor(t) % cards.length;
      var it0 = cards[selIdx];
      var slots = Math.max(cards.length, 5), gp = compact ? 2 : 4, ch = (ib.h - gp * (slots - 1)) / slots, pitch = ch + gp;
      var two = lw >= 200 && ch >= f * 2.4;
      var cx = ib.x + 3, cw = ib.w - 6, ff = compact ? f + 0.5 : f;
      for (var j = 0; j < cards.length; j++) {
        var it = cards[j], y = ib.y + j * pitch, isSel = j === selIdx;
        c.fillStyle = isSel ? V.card : V.pane; K.roundRect(c, cx, y, cw, ch, 3); c.fill();
        c.strokeStyle = isSel ? it.col : V.line; c.lineWidth = isSel ? 1.2 : 1; K.roundRect(c, cx + 0.5, y + 0.5, cw - 1, ch - 1, 3); c.stroke();
        c.fillStyle = it.col; c.fillRect(cx + 1, y + 2, 2.5, Math.max(3, ch - 4));
        if (isSel) K.activeHalo(c, cx, y, cw, ch, compact ? 5 : 8);
        var sbW = Math.round(ff * 3.1), sbH = Math.round(Math.min(ch - 5, ff * 2.0)), sbX = cx + cw - sbW - 4, sbY = Math.round(y + (ch - sbH) / 2);
        var y1 = two ? y + ch * 0.34 : y + ch / 2, x0 = cx + 9;
        if (!compact) {
          tx(c, it.state, x0, y1, f, it.col, "left", "700");
          x0 += f * 5.2;
        }
        tx(c, it.task_id, x0, y1, ff, isSel ? V.ink : V.txt, "left", "600");
        if (two) tx(c, K.fitM(c, it.reason, sbX - cx - 16, f, "400"), cx + 9, y + ch * 0.72, f, V.dim, "left", "400");
        c.fillStyle = K.rgba(it.col, 0.16); K.roundRect(c, sbX, sbY, sbW, sbH, 3); c.fill();
        c.strokeStyle = it.col; c.lineWidth = 0.9; c.stroke();
        tx(c, "R" + it.round, sbX + sbW / 2, sbY + sbH / 2, ff, it.col, "center", "700");
      }

      var py = Math.round(ib.y + selIdx * pitch + ch / 2) + 0.5, mx = Math.round(L.x + L.w + gapC / 2) + 0.5, ty = Math.round(R1.y + R1.h / 2) + 0.5;
      var route = [[L.x + L.w, py], [mx, py], [mx, ty], [R1.x, ty]];
      c.strokeStyle = it0.col; c.lineWidth = 1; c.setLineDash([2, 2]); K.orthPath(c, route, 4); c.setLineDash([]);
      K.kvPort(c, L.x + L.w, py, true); K.kvPort(c, R1.x, ty, true);

      var rb = K.pane(c, R1, "REASONS (≤3)", it0.task_id + " · R" + it0.round);
      K.specEdge(c, R1.x + 3, R1.y + 1, R1.w - 6);
      var rStep = Math.max(f + 6, Math.floor((rb.h - 4) / 3));
      for (var r = 0; r < Math.min(3, it0.reasons.length); r++) {
        var rY = rb.y + 6 + r * rStep;
        c.fillStyle = it0.col; c.fillRect(rb.x + 4, rY - 3, 2.5, 6);
        tx(c, K.fitM(c, (r + 1) + ". " + it0.reasons[r], rb.w - 16, f, "400"), rb.x + 11, rY, f, V.txt, "left", "400");
      }

      var kb = K.pane(c, R2, "VERDICT SPEC", it0.state);
      K.specEdge(c, R2.x + 3, R2.y + 1, R2.w - 6);
      c.fillStyle = it0.col; c.fillRect(R2.x + 1, R2.y + 3, 2, R2.h - 6);
      var ev0 = it0.evidence[0] ? String(it0.evidence[0]).split("/").pop() : "—";
      var rows = [
        ["verdict", it0.state, true],
        ["task_id", it0.task_id, true],
        ["round", "R" + it0.round],
        ["reviewer", K.fitM(c, it0.model, Math.max(60, kb.w * 0.52), f, "600")],
        ["evidence", it0.evidence.length + " files (" + ev0 + ")"]
      ];
      K.kvBlock(c, { x: kb.x + 3, y: kb.y, w: kb.w - 3, h: kb.h }, rows, f, R2.x);

      if (!compact) {
        tx(c, "tri_role_state.json · LIVE", pad, h - foot / 2 - 2, f, V.mute, "left");
        tx(c, "verdicts " + cards.length, w - pad, h - foot / 2 - 2, f, V.mute, "right");
      }
      return it0.task_id + " · " + it0.state + " (R" + it0.round + ")";
    }, o);
  }

  function verdictStack(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return verdictStackLegacy(cv, _data, opt);
    if (_data && Array.isArray(_data.verdicts)) {
      return verdictStackLive(cv, _data, opt, TX);
    }
    var o = opt || {};
    var K = TX.kit(TX.theme(QNT_ACC)), V = K.V, tx = K.tx;
    /* 持有人集中度插畫：10 根遞減長條（集中度越高衰減越陡），非 CLEAN 時最大戶顯影為語意色 */
    function holders(c, b, it, col, lit) {
      var dec = lerp(0.55, 0.12, it.score / 100), n = 10, gp = Math.max(1, Math.round(b.w / 60));
      var bw = (b.w - 8 - gp * (n - 1)) / n, base = b.y + b.h - 3;
      for (var k = 0; k < n; k++) {
        var hk = (b.h - 8) * Math.exp(-k * dec) * (0.86 + 0.14 * K.hh(it.idx * 7 + k, 3));
        c.fillStyle = (lit && k === 0 && it.state !== "CLEAN") ? it.col : col;
        c.fillRect(Math.round(b.x + 4 + k * (bw + gp)), Math.round(base - hk), Math.max(1, Math.round(bw)), Math.round(hk));
      }
      c.fillStyle = col; c.fillRect(b.x + 3, base, b.w - 6, 1);
    }
    return driver(60, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var f = K.infoFont(w);
      var step = t * 0.5 + 0.75, headIdx = Math.floor(step), frac = step - headIdx;
      var slideU = easeOut(clamp(frac / 0.48, 0, 1)), flash = frac < 0.42 ? 1 - frac / 0.42 : 0;
      var cards = [], cnt = { CLEAN: 0, RISKY: 0, DANGER: 0 };
      for (var i = 0; i < 8; i++) { var cd = qntVerdictCard(headIdx - i); cards.push(cd); cnt[cd.state]++; }
      var it0 = cards[0];
      var pad = compact ? 6 : 12, hdH = compact ? 16 : Math.round(f * 2.4);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);

      /* 標頭：標題＋三態計數條（語意色） */
      var hy = Math.round(pad * 0.5 + hdH * 0.5);
      tx(c, compact ? "VERDICT STACK" : "VERDICT STACK · 判決堆疊", pad, hy, f + 1, V.ink, "left", "700");
      var barW = Math.min(compact ? 70 : 170, w * 0.3), barH = compact ? 4 : 6, bx = w - pad - barW, by = Math.round(hy - barH / 2);
      var sc = barW * cnt.CLEAN / 8, sr = barW * cnt.RISKY / 8;
      c.fillStyle = EMERALD; c.fillRect(bx, by, sc, barH);
      c.fillStyle = AMBER; c.fillRect(bx + sc, by, sr, barH);
      c.fillStyle = RED; c.fillRect(bx + sc + sr, by, barW - sc - sr, barH);
      K.specEdge(c, bx, by, barW, 0.14);
      if (!compact) tx(c, "C " + cnt.CLEAN + " · R " + cnt.RISKY + " · D " + cnt.DANGER, bx - 8, hy, f, V.dim, "right", "600");

      /* 版面：左＝判決堆疊子窗；右上＝HOLDERS 插畫預覽；右下＝SIGNALS 鍵值列 */
      var top = pad + hdH, foot = compact ? 3 : Math.round(f * 1.8), bodyH = h - top - foot - Math.round(pad * 0.5);
      var gapC = compact ? 8 : 18, lw = Math.round((w - pad * 2 - gapC) * 0.6);
      var L = { x: pad, y: top, w: lw, h: bodyH }, rx = pad + lw + gapC, rw = w - pad - rx;
      var vg = compact ? 4 : 8, hpH = Math.round(bodyH * 0.44);
      var R1 = { x: rx, y: top, w: rw, h: hpH }, R2 = { x: rx, y: top + hpH + vg, w: rw, h: bodyH - hpH - vg };

      var ib = K.pane(c, L, "VERDICTS · 8", compact ? "" : "score");
      K.specEdge(c, L.x + 3, L.y + 1, L.w - 6);
      var gp = compact ? 2 : 4, ch = (ib.h - gp * 7) / 8, pitch = ch + gp, two = lw >= 200 && ch >= f * 2.5;
      var cx = ib.x + 3, cw = ib.w - 6, ff = compact ? f + 0.5 : f;
      c.save(); c.beginPath(); c.rect(ib.x, ib.y, ib.w, ib.h); c.clip();
      for (var j = 0; j < 8; j++) {
        var it = cards[j], y = ib.y + j * pitch - (1 - slideU) * pitch;
        var a = j === 0 ? lerp(0.4, 1, slideU) : (j === 7 ? lerp(0.6, 0.2, slideU) : 1 - j * 0.06);
        c.globalAlpha = clamp(a, 0.15, 1);
        c.fillStyle = j === 0 ? V.card : V.pane; K.roundRect(c, cx, y, cw, ch, 3); c.fill();
        if (j === 0 && flash > 0.02) { c.fillStyle = K.rgba(it.col, 0.12 * flash); c.fill(); }
        c.strokeStyle = j === 0 ? V.line2 : V.line; c.lineWidth = 1; K.roundRect(c, cx + 0.5, y + 0.5, cw - 1, ch - 1, 3); c.stroke();
        c.fillStyle = it.col; c.fillRect(cx + 1, y + 2, 2.5, Math.max(3, ch - 4));
        var sbW = Math.round(ff * 3.3), sbH = Math.round(Math.min(ch - 5, ff * 2.1)), sbX = cx + cw - sbW - 4, sbY = Math.round(y + (ch - sbH) / 2);
        var y1 = two ? y + ch * 0.32 : y + ch / 2, x0 = cx + 9;
        if (!compact) {
          tx(c, it.state, x0, y1, f, it.col, "left", "700");
          x0 += f * 4.6;
        }
        tx(c, it.wallet, x0, y1, ff, j === 0 ? V.ink : V.txt, "left", "600");
        c.font = "600 " + ff + "px " + K.MONO;
        var wx = x0 + c.measureText(it.wallet).width + 4;
        if (sbX - 4 > wx + 6) { c.setLineDash([1, 2]); c.strokeStyle = V.lead; K.ln(c, wx, Math.round(y1) + 0.5, sbX - 4, Math.round(y1) + 0.5); c.setLineDash([]); }
        if (two) tx(c, K.fitM(c, it.reason, sbX - cx - 16, f, "400"), cx + 9, y + ch * 0.7, f, V.dim, "left", "400");
        c.fillStyle = K.rgba(it.col, 0.16); K.roundRect(c, sbX, sbY, sbW, sbH, 3); c.fill();
        c.strokeStyle = it.col; c.lineWidth = 0.9; c.stroke();
        tx(c, String(it.score), sbX + sbW / 2, sbY + sbH / 2, ff + 0.5, it.col, "center", "700");
      }
      c.globalAlpha = 1; c.restore();

      /* 作用卡：光暈＋閃框＋右緣埠點 → 走線熱封包到 HOLDERS */
      var ay = ib.y - (1 - slideU) * pitch;
      if (slideU > 0.25) { c.globalAlpha = clamp((slideU - 0.25) / 0.5, 0, 1); K.activeHalo(c, cx, ay, cw, ch, compact ? 7 : 12); c.globalAlpha = 1; }
      if (flash > 0.02) { c.strokeStyle = V.acc; c.lineWidth = 1 + flash * 1.2; K.roundRect(c, cx, ay, cw, ch, 3); c.stroke(); }
      var py = Math.round(ib.y + ch / 2) + 0.5, mx = Math.round(L.x + L.w + gapC / 2) + 0.5, ty = Math.round(R1.y + R1.h / 2) + 0.5;
      var route = [[L.x + L.w, py], [mx, py], [mx, ty], [R1.x, ty]];
      c.strokeStyle = V.line2; c.lineWidth = 1; c.setLineDash([2, 2]); K.orthPath(c, route, 4); c.setLineDash([]);
      K.kvPort(c, L.x + L.w, py, true); K.kvPort(c, R1.x, ty, slideU > 0.9);
      K.hotPacket(c, route, frac, V.acc2, compact ? 2 : 2.6);

      /* HOLDERS：最大戶集中度插畫顯影 */
      var hb = K.pane(c, R1, "HOLDERS", "top10 " + it0.top10 + "%");
      K.specEdge(c, R1.x + 3, R1.y + 1, R1.w - 6);
      if (it0.top10 >= 50 && hb.h > 20) {
        var thy = Math.round(hb.y + hb.h * 0.3) + 0.5;
        c.setLineDash([2, 3]); c.strokeStyle = K.rgba(AMBER, 0.55); K.ln(c, hb.x + 3, thy, hb.x + hb.w - 3, thy); c.setLineDash([]);
      }
      K.develop(c, hb, clamp(0.3 + frac * 1.4, 0, 1), function (cc, col, lit) { holders(cc, hb, it0, col, lit); });

      /* SIGNALS：作用錢包鍵值列（左緣語意條＋埠點） */
      var kb = K.pane(c, R2, "SIGNALS", compact ? "" : it0.wallet);
      K.specEdge(c, R2.x + 3, R2.y + 1, R2.w - 6);
      c.fillStyle = it0.col; c.fillRect(R2.x + 1, R2.y + 3, 2, R2.h - 6);
      var rows = [["state", it0.state, true], ["score", it0.score + "/100", true], ["top10", it0.top10 + "%"], ["linked", it0.linked + " wal"],
        ["early buy", it0.early + "%"], ["sell ×", it0.sell], ["liquidity", it0.lock]];
      var nr = K.kvBlock(c, { x: kb.x + 3, y: kb.y, w: kb.w - 3, h: kb.h }, rows, f, R2.x);
      var rowH = f + Math.max(5, Math.round(f * 0.8)), restY = kb.y + rowH * nr + f;
      if (!compact && nr === rows.length && restY + f < kb.y + kb.h) tx(c, K.fitM(c, it0.reason, kb.w - 10, f, "400"), kb.x + 7, restY, f, V.dim, "left", "400");

      if (!compact) {
        tx(c, "模擬資料 · seed=20261116", pad, h - foot / 2 - 2, f, V.mute, "left");
        tx(c, "stack #" + headIdx, w - pad, h - foot / 2 - 2, f, V.mute, "right");
      }
      return "Stack #" + headIdx + " (" + it0.score + ")";
    }, o);
  }

  /* #68 判決卡堆疊 (Verdict Stack) — 舊版（A23Tex 缺席時退回） */
  function verdictStackLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var HEX = "0123456789abcdef";
    var REASONS = {
      CLEAN: [
        "籌碼分散 · 前10持有人占 18%",
        "獨立資金來源 · 無關聯叢集",
        "流動性鎖定 · 賣壓低於均線",
        "持倉穩定 · 近期無異常轉出"
      ],
      RISKY: [
        "前 10 持有人占 52% · 略集中",
        "關聯錢包 3 組 · 疑似協同買入",
        "首批買家仍持有 41% 籌碼",
        "流動性池未完全鎖定 · 留意"
      ],
      DANGER: [
        "前 10 持有人占 65% · 高度集中",
        "同一資金來源 4 個錢包關聯",
        "偵測高頻倒貨地址 · 賣壓 2.4x",
        "單一實體控制 38% 流通量"
      ]
    };

    function buildCard(idx) {
      var r1 = hashLcg(idx + 500, 101);
      var r2 = hashLcg(idx + 500, 203);
      var r3 = hashLcg(idx + 500, 307);
      var score;
      if (r1 < 0.42) score = Math.round(70 + r2 * 28);
      else if (r1 < 0.74) score = Math.round(40 + r2 * 29);
      else score = Math.round(12 + r2 * 27);

      var state = score >= 70 ? "CLEAN" : (score >= 40 ? "RISKY" : "DANGER");
      var col = state === "CLEAN" ? EMERALD : (state === "RISKY" ? AMBER : RED);
      var b1 = HEX[Math.floor(hashLcg(idx + 500, 401) * 16)];
      var b2 = HEX[Math.floor(hashLcg(idx + 500, 409) * 16)];
      var e1 = HEX[Math.floor(hashLcg(idx + 500, 419) * 16)];
      var e2 = HEX[Math.floor(hashLcg(idx + 500, 431) * 16)];
      var wallet = "0x" + b1 + b2 + "…" + e1 + e2;
      var pool = REASONS[state];
      var reason = pool[Math.floor(r3 * pool.length) % pool.length];
      return { idx: idx, score: score, state: state, col: col, wallet: wallet, reason: reason };
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var step = t * 0.5;
      var headIdx = Math.floor(step);
      var frac = step - headIdx;
      var slideU = easeOut(clamp(frac / 0.48, 0, 1));
      var flash = frac < 0.42 ? (1 - frac / 0.42) : 0;

      var cards = [];
      var cntClean = 0, cntRisky = 0, cntDanger = 0;
      for (var i = 0; i < 8; i++) {
        var card = buildCard(headIdx - i);
        cards.push(card);
        if (card.state === "CLEAN") cntClean++;
        else if (card.state === "RISKY") cntRisky++;
        else cntDanger++;
      }

      var padX = compact ? 10 : 18;
      var topY = compact ? 28 : 42;
      var botPad = compact ? 10 : 22;
      var latest = cards[0];

      // Header
      if (!compact) {
        text(c, "判決堆疊 · 最新分數 " + latest.score, padX, 20, 12.5, LIME, "left", "700");
        // Tri-state count bar
        var barW = Math.min(180, w * 0.34), barH = 7;
        var bx = w - padX - barW, by = 16.5;
        var segC = barW * (cntClean / 8), segR = barW * (cntRisky / 8), segD = barW - segC - segR;
        c.fillStyle = EMERALD; c.fillRect(bx, by, segC, barH);
        c.fillStyle = AMBER; c.fillRect(bx + segC, by, segR, barH);
        c.fillStyle = RED; c.fillRect(bx + segC + segR, by, segD, barH);
        text(c, "C:" + cntClean + " R:" + cntRisky + " D:" + cntDanger, bx - 8, 20, 9.5, DIM, "right", "600");
      } else {
        text(c, "判決堆疊 · " + latest.score, padX, 14, 10, LIME, "left", "700");
        text(c, cntClean + "/" + cntRisky + "/" + cntDanger, w - padX, 14, 9, DIM, "right", "600");
      }

      // 8 stacked cards
      var availH = Math.max(80, h - topY - botPad);
      var gap = compact ? 3 : 5;
      var cardH = (availH - gap * 7) / 8;
      var cardW = w - padX * 2;

      c.save();
      c.beginPath();
      c.rect(padX - 4, topY - 4, cardW + 8, availH + 8);
      c.clip();

      for (var j = 0; j < 8; j++) {
        var it = cards[j];
        var baseY = topY + j * (cardH + gap);
        var y = j === 0
          ? lerp(topY - cardH * 0.85, baseY, slideU)
          : lerp(baseY - (cardH + gap) * 0.35, baseY, slideU);
        var alpha = j === 7 ? lerp(0.95, 0.25, slideU) : (j === 0 ? lerp(0.35, 1.0, slideU) : 1.0 - j * 0.06);

        c.save();
        c.globalAlpha = clamp(alpha, 0.15, 1);
        c.fillStyle = CARD_BG;
        roundRect(c, padX, y, cardW, cardH, 4);
        c.fill();

        if (j === 0 && flash > 0.02) {
          c.strokeStyle = LIME;
          c.lineWidth = 1.6 + flash * 1.4;
          c.stroke();
          c.fillStyle = it.col + "1c";
          roundRect(c, padX, y, cardW, cardH, 4);
          c.fill();
        } else {
          c.strokeStyle = LINE_COL;
          c.lineWidth = 1;
          c.stroke();
        }

        // Left tri-state bar
        c.fillStyle = it.col;
        c.fillRect(padX + 1, y + 2, compact ? 4 : 3.5, Math.max(4, cardH - 4));

        var scoreBoxW = compact ? 28 : 34;
        var scoreBoxH = Math.max(12, cardH - (compact ? 4 : 8));
        var sbX = padX + cardW - scoreBoxW - (compact ? 4 : 7);
        var sbY = y + (cardH - scoreBoxH) * 0.5;

        if (!compact) {
          // Solid square + verdict label
          var sq = 7;
          c.fillStyle = it.col;
          c.fillRect(padX + 12, y + cardH * 0.5 - sq * 0.5, sq, sq);
          text(c, it.state, padX + 24, y + cardH * 0.5, 9.5, it.col, "left", "700");
          text(c, it.wallet, padX + 82, y + cardH * 0.5, 9.5, FG, "left", "600");
          var reasonX = padX + 146;
          var reasonMaxW = Math.max(40, sbX - reasonX - 8);
          text(c, fitTxt(it.reason, reasonMaxW, 9.5), reasonX, y + cardH * 0.5, 9.5, DIM, "left");
        } else {
          // Compact: color bar + wallet + score
          text(c, it.wallet, padX + 10, y + cardH * 0.5, 8.5, FG, "left", "600");
        }

        // Right score box
        c.fillStyle = it.col + "28";
        roundRect(c, sbX, sbY, scoreBoxW, scoreBoxH, 3);
        c.fill();
        c.strokeStyle = it.col;
        c.lineWidth = 0.9;
        c.stroke();
        text(c, String(it.score), sbX + scoreBoxW * 0.5, sbY + scoreBoxH * 0.5, compact ? 9 : 10.5, it.col, "center", "700");

        c.restore();
      }
      c.restore();

      if (!compact) {
        text(c, "模擬資料 · seed=20261116", padX, h - 10, 8.5, MUTED, "left");
      }
      return "Stack #" + headIdx + " (" + latest.score + ")";
    }, o);
  }

  /* #69 檢查樹→圖示磚 — §6.7 升級（2026-11-16；A23Tex.kit(theme(QNT 主色 LIME))；磚面判定色＝語意紅/綠/琥珀） */
  var QCT_TILES = [
    { name: "持有人", val: "127,541", state: "CLEAN", thr: "≥5k", wt: "15%" },
    { name: "關聯錢包", val: "11.3%", state: "DANGER", thr: "<5%", wt: "25%" },
    { name: "首批買家", val: "42.0%", state: "RISKY", thr: "<30%", wt: "20%" },
    { name: "綁定", val: "0.8%", state: "CLEAN", thr: "<2%", wt: "10%" },
    { name: "流動性", val: "29.4%", state: "RISKY", thr: "≥40%", wt: "20%" },
    { name: "賣壓", val: "0.79x", state: "CLEAN", thr: "<1.0x", wt: "10%" }
  ];
  /* 6 種檢查圖示（線條；bg＝節點挖空底色） */
  function qntCheckIcon(c, idx, cx, cy, sz, col, bg) {
    c.save(); c.strokeStyle = col; c.lineWidth = sz < 14 ? 1 : 1.4; c.lineCap = "round"; c.lineJoin = "round";
    var r = sz * 0.42;
    if (idx === 0) {
      c.beginPath(); c.arc(cx - r * 0.25, cy - r * 0.28, r * 0.26, 0, Math.PI * 2);
      c.moveTo(cx - r * 0.72, cy + r * 0.55); c.quadraticCurveTo(cx - r * 0.25, cy + r * 0.05, cx + r * 0.22, cy + r * 0.55); c.stroke();
      c.beginPath(); c.arc(cx + r * 0.38, cy - r * 0.18, r * 0.2, 0, Math.PI * 2);
      c.moveTo(cx + r * 0.12, cy + r * 0.52); c.quadraticCurveTo(cx + r * 0.42, cy + r * 0.14, cx + r * 0.72, cy + r * 0.52); c.stroke();
    } else if (idx === 1) {
      var pts = [[cx, cy - r * 0.55], [cx - r * 0.55, cy + r * 0.42], [cx + r * 0.55, cy + r * 0.42]];
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]); c.closePath(); c.stroke();
      for (var k = 0; k < 3; k++) { c.fillStyle = bg; c.beginPath(); c.arc(pts[k][0], pts[k][1], r * 0.2, 0, Math.PI * 2); c.fill(); c.stroke(); }
    } else if (idx === 2) {
      c.beginPath(); c.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
      c.moveTo(cx, cy - r * 0.35); c.lineTo(cx, cy); c.lineTo(cx + r * 0.35, cy + r * 0.15); c.stroke();
    } else if (idx === 3) {
      c.beginPath(); c.arc(cx, cy - r * 0.2, r * 0.32, Math.PI, 0); c.stroke();
      roundRect(c, cx - r * 0.52, cy - r * 0.15, r * 1.04, r * 0.82, 2); c.stroke();
    } else if (idx === 4) {
      c.beginPath(); c.moveTo(cx, cy - r * 0.68);
      c.quadraticCurveTo(cx + r * 0.65, cy + r * 0.05, cx, cy + r * 0.65); c.quadraticCurveTo(cx - r * 0.65, cy + r * 0.05, cx, cy - r * 0.68); c.stroke();
    } else {
      c.beginPath();
      c.moveTo(cx - r * 0.5, cy + r * 0.45); c.lineTo(cx - r * 0.5, cy - r * 0.15);
      c.moveTo(cx, cy + r * 0.45); c.lineTo(cx, cy - r * 0.45);
      c.moveTo(cx + r * 0.5, cy + r * 0.45); c.lineTo(cx + r * 0.5, cy + r * 0.05);
      c.moveTo(cx - r * 0.65, cy - r * 0.55); c.lineTo(cx + r * 0.65, cy - r * 0.15); c.stroke();
    }
    c.restore();
  }
  function checkTree(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return checkTreeLegacy(cv, _data, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme(QNT_ACC)), V = K.V, tx = K.tx;
    /* 磚底插畫：7 根近 7 日指標長條（決定性），由 develop 隨掃描顯影 */
    function spark(c, b, i, col) {
      var n = 7, gp = 2, bw = Math.max(1.5, (b.w - 4 - gp * (n - 1)) / n);
      for (var k = 0; k < n; k++) {
        var bh = (0.28 + 0.72 * hashLcg(i * 31 + k, 701)) * (b.h - 3);
        c.fillStyle = col; c.fillRect(Math.round(b.x + 2 + k * (bw + gp)), Math.round(b.y + b.h - 1 - bh), Math.max(1, Math.round(bw)), Math.round(bh));
      }
      c.fillStyle = col; c.fillRect(b.x + 1, b.y + b.h - 1, b.w - 2, 1);
    }
    return driver(60, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var f = K.infoFont(w), pad = compact ? 6 : 12;
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      var scanPos = clamp(t / 46, 0, 1) * 6, allDone = t >= 48;
      var cnt = { CLEAN: 0, RISKY: 0, DANGER: 0 }, litU = [], i;
      for (i = 0; i < 6; i++) { litU[i] = clamp(scanPos - i, 0, 1); if (litU[i] >= 0.85) cnt[QCT_TILES[i].state]++; }
      var litCount = cnt.CLEAN + cnt.RISKY + cnt.DANGER;

      /* 頂列：TALLY ｜ 根節點 6 項檢查 ｜ VERDICT */
      var H0 = compact ? 30 : Math.round(f * 7.4), rootW = compact ? 100 : Math.round(Math.min(190, w * 0.27));
      var RT = { x: Math.round(w / 2 - rootW / 2), y: pad, w: rootW, h: H0 };
      var rb = K.pane(c, RT, compact ? "" : "ROOT", compact ? "" : "scan " + litCount + "/6");
      K.specEdge(c, RT.x + 3, RT.y + 1, RT.w - 6);
      if (allDone) { c.strokeStyle = V.acc2; c.lineWidth = 1; K.roundRect(c, RT.x + 0.5, RT.y + 0.5, RT.w - 1, RT.h - 1, 3); c.stroke(); }
      tx(c, "6 項檢查", RT.x + RT.w / 2, rb.y + rb.h * (compact ? 0.36 : 0.32), f + 1, V.ink, "center", "700");
      var segW = (rb.w - 12 - 5 * 3) / 6, segY = Math.round(rb.y + rb.h * (compact ? 0.78 : 0.62));
      for (i = 0; i < 6; i++) {
        var sx = rb.x + 6 + i * (segW + 3);
        c.fillStyle = V.track; c.fillRect(sx, segY, segW, 3);
        var u = litU[i];
        if (u > 0) { c.fillStyle = u >= 0.85 ? qntSem(QCT_TILES[i].state) : V.acc; c.fillRect(sx, segY, segW * Math.min(1, u / 0.85), 3); }
      }
      if (!compact) K.leader(c, "progress", Math.round(scanPos / 6 * 100) + "%", rb.x + 6, rb.x + rb.w - 6, Math.round(rb.y + rb.h * 0.86), f, false);

      var sideW = Math.round(RT.x - pad - (compact ? 6 : 18));
      if (!compact) {
        var TL = { x: pad, y: pad, w: sideW, h: H0 };
        var tb = K.pane(c, TL, "TALLY", "lit " + litCount);
        K.specEdge(c, TL.x + 3, TL.y + 1, TL.w - 6);
        K.kvBlock(c, { x: tb.x + 2, y: tb.y, w: tb.w - 2, h: tb.h }, [["CLEAN", cnt.CLEAN, cnt.CLEAN > 0], ["RISKY", cnt.RISKY, cnt.RISKY > 0], ["DANGER", cnt.DANGER, cnt.DANGER > 0]], f, TL.x);
        var VR = { x: w - pad - sideW, y: pad, w: sideW, h: H0 };
        var vb = K.pane(c, VR, "VERDICT", allDone ? "final" : "pending");
        K.specEdge(c, VR.x + 3, VR.y + 1, VR.w - 6);
        var badgeU = allDone ? easeOut(clamp((t - 48) / 8, 0, 1)) : 0;
        if (allDone) {
          c.globalAlpha = badgeU;
          var cw0 = Math.round(f * 6.4), ch0 = Math.round(f * 2), cx0 = vb.x + 6, cy0 = Math.round(vb.y + vb.h * 0.32 - ch0 / 2);
          c.fillStyle = K.rgba(AMBER, 0.16); K.roundRect(c, cx0, cy0, cw0, ch0, 3); c.fill(); c.strokeStyle = AMBER; c.lineWidth = 1; c.stroke();
          tx(c, "RISKY", cx0 + cw0 / 2, cy0 + ch0 / 2, f + 1, AMBER, "center", "700");
          tx(c, "62", vb.x + vb.w - 6, cy0 + ch0 / 2, f + 3, V.ink, "right", "700");
          K.leader(c, "weighted", "62/100", vb.x + 6, vb.x + vb.w - 6, Math.round(vb.y + vb.h * 0.78), f, true);
          c.globalAlpha = 1;
        } else {
          tx(c, "掃描中…", vb.x + 6, Math.round(vb.y + vb.h * 0.32), f, V.dim, "left", "600");
          K.leader(c, "weighted", "—", vb.x + 6, vb.x + vb.w - 6, Math.round(vb.y + vb.h * 0.78), f, false);
        }
      } else {
        tx(c, "C" + cnt.CLEAN + " R" + cnt.RISKY + " D" + cnt.DANGER, pad, RT.y + RT.h / 2, f + 0.5, V.dim, "left", "600");
        if (allDone) {
          var bw0 = 46, bh0 = 14, bx0 = w - pad - bw0, by0 = Math.round(RT.y + RT.h / 2 - bh0 / 2);
          c.fillStyle = K.rgba(AMBER, 0.16); K.roundRect(c, bx0, by0, bw0, bh0, 3); c.fill(); c.strokeStyle = AMBER; c.lineWidth = 1; c.stroke();
          tx(c, "RISKY 62", bx0 + bw0 / 2, by0 + bh0 / 2, f, AMBER, "center", "700");
        }
      }

      /* 曼哈頓括號樹 → 6 磚 */
      var rootBot = RT.y + RT.h, busY = Math.round(rootBot + (compact ? 10 : 18)) + 0.5, tileTop = Math.round(busY + (compact ? 10 : 18));
      var foot = compact ? 3 : Math.round(f * 1.8), tileH = Math.max(48, h - tileTop - foot - Math.round(pad * 0.5));
      var gap = compact ? 4 : 9, tileW = (w - pad * 2 - gap * 5) / 6, rx0 = Math.round(w / 2) + 0.5, scanIdx = -1;
      for (i = 0; i < 6; i++) {
        var tcx = Math.round(pad + i * (tileW + gap) + tileW / 2) + 0.5, route = [[rx0, rootBot], [rx0, busY], [tcx, busY], [tcx, tileTop]];
        var lu = litU[i], lit = lu >= 0.85, scanning = lu > 0.05 && !lit;
        if (scanning) scanIdx = i;
        c.strokeStyle = lit ? K.rgba(qntSem(QCT_TILES[i].state), 0.75) : (scanning ? V.acc : V.line2);
        c.lineWidth = lit || scanning ? 1.3 : 1;
        if (!lit && !scanning) c.setLineDash([2, 2]);
        K.orthPath(c, route, compact ? 3 : 5); c.setLineDash([]);
        if (scanning) K.hotPacket(c, route, lu / 0.85, V.acc2, compact ? 2 : 2.8);
      }
      K.kvPort(c, rx0, rootBot, litCount > 0);

      for (i = 0; i < 6; i++) {
        var T = QCT_TILES[i], col = qntSem(T.state), lu2 = litU[i], on = lu2 >= 0.85;
        var TB = { x: Math.round(pad + i * (tileW + gap)), y: tileTop, w: Math.round(tileW), h: tileH };
        if (i === scanIdx) K.activeHalo(c, TB.x, TB.y, TB.w, TB.h, compact ? 6 : 10);
        var ib = K.pane(c, TB, compact ? "" : "CHK·0" + (i + 1), compact ? "" : (on ? T.state.charAt(0) : ""));
        if (on) { c.fillStyle = col; c.fillRect(TB.x + 2, TB.y + 1, TB.w - 4, 2); } else K.specEdge(c, TB.x + 3, TB.y + 1, TB.w - 6);
        K.kvPort(c, TB.x + TB.w / 2, TB.y, on || i === scanIdx);
        var mcx = TB.x + TB.w / 2, icol = on ? col : (i === scanIdx ? V.acc2 : V.mute);
        if (!compact) {
          qntCheckIcon(c, i, mcx, ib.y + ib.h * 0.12, Math.min(24, ib.w * 0.34, ib.h * 0.17), icol, V.pane);
          tx(c, K.fitM(c, T.name, ib.w - 6, f, "600"), mcx, ib.y + ib.h * 0.27, f, on ? V.ink : V.dim, "center", "600");
          tx(c, T.val, mcx, ib.y + ib.h * 0.37, f + 2, on ? col : V.mute, "center", "700");
          var kx0 = ib.x + 3, kx1 = ib.x + ib.w - 3, ky = ib.y + ib.h * 0.5, kd = Math.max(f + 5, ib.h * 0.085);
          K.leader(c, "st", on ? T.state : "—", kx0, kx1, Math.round(ky), f, on);
          K.leader(c, "thr", T.thr, kx0, kx1, Math.round(ky + kd), f, false);
          K.leader(c, "wt", T.wt, kx0, kx1, Math.round(ky + kd * 2), f, false);
        } else {
          qntCheckIcon(c, i, mcx, ib.y + ib.h * 0.22, Math.min(18, ib.w * 0.44, ib.h * 0.26), icol, V.pane);
          tx(c, T.val, mcx, ib.y + ib.h * 0.48, f, on ? col : V.mute, "center", "700");
          c.fillStyle = on ? col : V.line2; c.beginPath(); c.arc(mcx, ib.y + ib.h * 0.62, 2, 0, Math.PI * 2); c.fill();
        }
        var sb = { x: ib.x + 2, y: Math.round(ib.y + ib.h * (compact ? 0.72 : 0.76)), w: ib.w - 4, h: Math.round(ib.h * (compact ? 0.24 : 0.2)) };
        K.develop(c, sb, lu2 / 0.85, function (cc, cl) { spark(cc, sb, i, cl); });
      }

      if (!compact) tx(c, "模擬資料 · seed=20261116", pad, h - foot / 2 - 2, f, V.mute, "left");
      return "Check " + Math.min(6, Math.floor(scanPos + 0.15)) + "/6";
    }, o);
  }

  /* #69 檢查樹→圖示磚 (Check Tree Tiles) — 舊版（A23Tex 缺席時退回） */
  function checkTreeLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var TILES = [
      { id: "holders", name: "持有人", val: "127,541", state: "CLEAN", col: EMERALD },
      { id: "linked", name: "關聯錢包", val: "11.3%", state: "DANGER", col: RED },
      { id: "buyers", name: "首批買家", val: "42.0%", state: "RISKY", col: AMBER },
      { id: "freeze", name: "綁定", val: "0.8%", state: "CLEAN", col: EMERALD },
      { id: "liq", name: "流動性", val: "29.4%", state: "RISKY", col: AMBER },
      { id: "sell", name: "賣壓", val: "0.79x", state: "CLEAN", col: EMERALD }
    ];

    function drawTileIcon(c, idx, cx, cy, sz, col) {
      c.save();
      c.strokeStyle = col;
      c.lineWidth = 1.4;
      c.lineCap = "round";
      c.lineJoin = "round";
      var r = sz * 0.42;
      if (idx === 0) {
        // Holders: two person silhouettes
        c.beginPath();
        c.arc(cx - r * 0.25, cy - r * 0.28, r * 0.26, 0, Math.PI * 2);
        c.moveTo(cx - r * 0.72, cy + r * 0.55);
        c.quadraticCurveTo(cx - r * 0.25, cy + r * 0.05, cx + r * 0.22, cy + r * 0.55);
        c.stroke();
        c.beginPath();
        c.arc(cx + r * 0.38, cy - r * 0.18, r * 0.2, 0, Math.PI * 2);
        c.moveTo(cx + r * 0.12, cy + r * 0.52);
        c.quadraticCurveTo(cx + r * 0.42, cy + r * 0.14, cx + r * 0.72, cy + r * 0.52);
        c.stroke();
      } else if (idx === 1) {
        // Linked wallets: 3 connected nodes
        var pts = [[cx, cy - r * 0.55], [cx - r * 0.55, cy + r * 0.42], [cx + r * 0.55, cy + r * 0.42]];
        c.beginPath();
        c.moveTo(pts[0][0], pts[0][1]);
        c.lineTo(pts[1][0], pts[1][1]);
        c.lineTo(pts[2][0], pts[2][1]);
        c.closePath();
        c.stroke();
        for (var k = 0; k < 3; k++) {
          c.fillStyle = BG;
          c.beginPath(); c.arc(pts[k][0], pts[k][1], r * 0.2, 0, Math.PI * 2); c.fill(); c.stroke();
        }
      } else if (idx === 2) {
        // First buyers: target circle + clock hands
        c.beginPath();
        c.arc(cx, cy, r * 0.65, 0, Math.PI * 2);
        c.moveTo(cx, cy - r * 0.35); c.lineTo(cx, cy); c.lineTo(cx + r * 0.35, cy + r * 0.15);
        c.stroke();
      } else if (idx === 3) {
        // Freeze/Lock: padlock
        c.beginPath();
        c.arc(cx, cy - r * 0.2, r * 0.32, Math.PI, 0);
        c.stroke();
        roundRect(c, cx - r * 0.52, cy - r * 0.15, r * 1.04, r * 0.82, 2);
        c.stroke();
      } else if (idx === 4) {
        // Liquidity: wave / droplet
        c.beginPath();
        c.moveTo(cx, cy - r * 0.68);
        c.quadraticCurveTo(cx + r * 0.65, cy + r * 0.05, cx, cy + r * 0.65);
        c.quadraticCurveTo(cx - r * 0.65, cy + r * 0.05, cx, cy - r * 0.68);
        c.stroke();
      } else {
        // Sell pressure: 3 candlesticks / bars + down arrow
        c.beginPath();
        c.moveTo(cx - r * 0.5, cy + r * 0.45); c.lineTo(cx - r * 0.5, cy - r * 0.15);
        c.moveTo(cx, cy + r * 0.45); c.lineTo(cx, cy - r * 0.45);
        c.moveTo(cx + r * 0.5, cy + r * 0.45); c.lineTo(cx + r * 0.5, cy + r * 0.05);
        c.moveTo(cx - r * 0.65, cy - r * 0.55); c.lineTo(cx + r * 0.65, cy - r * 0.15);
        c.stroke();
      }
      c.restore();
    }

    function drawOrthoBranch(c, rx, ry, bx, by, busY, rad, color, lw) {
      c.strokeStyle = color;
      c.lineWidth = lw;
      c.beginPath();
      c.moveTo(rx, ry);
      c.lineTo(rx, busY);
      if (Math.abs(bx - rx) > rad * 2) {
        var dir = bx > rx ? 1 : -1;
        c.lineTo(bx - dir * rad, busY);
        c.quadraticCurveTo(bx, busY, bx, busY + rad);
      } else {
        c.lineTo(bx, busY);
      }
      c.lineTo(bx, by);
      c.stroke();
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var padX = compact ? 10 : 18;
      var rootW = compact ? 86 : 114, rootH = compact ? 22 : 26;
      var rootX = w * 0.5 - rootW * 0.5;
      var rootY = compact ? 14 : 20;
      var rootBotY = rootY + rootH;
      var busY = rootBotY + (compact ? 14 : 22);
      var tileTopY = busY + (compact ? 16 : 24);
      var botPad = compact ? 10 : 22;
      var tileH = Math.max(48, h - tileTopY - botPad);
      var gap = compact ? 5 : 9;
      var tileW = (w - padX * 2 - gap * 5) / 6;

      // Timing: t in [0..46] lights tiles 0..5 sequentially; t >= 48 shows total badge
      var scanPos = clamp(t / 46, 0, 1) * 6;
      var allDone = t >= 48;

      // Root node
      c.fillStyle = CARD_BG;
      roundRect(c, rootX, rootY, rootW, rootH, 4);
      c.fill();
      c.strokeStyle = allDone ? LIME : DIM;
      c.lineWidth = allDone ? 1.4 : 1;
      c.stroke();
      text(c, "6 項檢查", w * 0.5, rootY + rootH * 0.5, compact ? 9.5 : 11, FG, "center", "700");

      // Total verdict badge beside root after all 6 lit
      if (allDone) {
        var badgeU = easeOut(clamp((t - 48) / 8, 0, 1));
        c.save();
        c.globalAlpha = badgeU;
        var bw = compact ? 64 : 88, bh = compact ? 18 : 22;
        var bx = rootX + rootW + (compact ? 6 : 12);
        var by = rootY + (rootH - bh) * 0.5;
        drawPill(c, compact ? "RISKY 62" : "總判決 RISKY", bx, by, bw, bh, AMBER, compact ? 8 : 9.5);
        c.restore();
      }

      // Draw orthogonal bracket tree + 6 tiles
      for (var i = 0; i < 6; i++) {
        var tile = TILES[i];
        var tx = padX + i * (tileW + gap);
        var cx = tx + tileW * 0.5;
        var litU = clamp(scanPos - i, 0, 1);
        var isLit = litU >= 0.85;
        var isScanning = litU > 0.05 && litU < 0.85;
        var branchCol = isLit ? tile.col : (isScanning ? LIME : "#334155");

        // Base orthogonal branch (radius r=4)
        drawOrthoBranch(c, w * 0.5, rootBotY, cx, tileTopY, busY, 4, branchCol, isLit || isScanning ? 1.5 : 1.0);

        // Moving pulse dot along branch while scanning
        if (isScanning) {
          var p = litU / 0.85;
          var px, py;
          if (p < 0.3) {
            px = w * 0.5;
            py = lerp(rootBotY, busY, p / 0.3);
          } else if (p < 0.7) {
            px = lerp(w * 0.5, cx, (p - 0.3) / 0.4);
            py = busY;
          } else {
            px = cx;
            py = lerp(busY, tileTopY, (p - 0.7) / 0.3);
          }
          c.fillStyle = LIME;
          c.beginPath(); c.arc(px, py, compact ? 2.5 : 3.2, 0, Math.PI * 2); c.fill();
        }

        // Tile card
        var activeCol = isLit ? tile.col : MUTED;
        c.fillStyle = CARD_BG;
        roundRect(c, tx, tileTopY, tileW, tileH, 4);
        c.fill();
        c.strokeStyle = isLit ? tile.col : (isScanning ? LIME : LINE_COL);
        c.lineWidth = isLit || isScanning ? 1.4 : 1;
        c.stroke();

        // Top accent strip
        c.fillStyle = isLit ? tile.col : "#1e293b";
        c.fillRect(tx + 2, tileTopY + 2, tileW - 4, 3);

        if (!compact) {
          var iconSz = Math.min(24, tileW * 0.34, tileH * 0.26);
          drawTileIcon(c, i, cx, tileTopY + tileH * 0.26, iconSz, activeCol);
          text(c, tile.name, cx, tileTopY + tileH * 0.48, 9.5, isLit ? FG : MUTED, "center", "600");
          text(c, tile.val, cx, tileTopY + tileH * 0.65, 11.5, isLit ? tile.col : DIM, "center", "700");
        } else {
          // Compact: icon + color status bar
          var cIconSz = Math.min(18, tileW * 0.44, tileH * 0.34);
          drawTileIcon(c, i, cx, tileTopY + tileH * 0.36, cIconSz, activeCol);
          text(c, tile.val, cx, tileTopY + tileH * 0.66, 8, isLit ? tile.col : MUTED, "center", "700");
        }

        // Bottom 7 mini bars
        var nBars = 7;
        var barAreaW = tileW - (compact ? 8 : 14);
        var barGap = 2;
        var bw2 = Math.max(1.5, (barAreaW - barGap * (nBars - 1)) / nBars);
        var barBaseY = tileTopY + tileH - (compact ? 6 : 10);
        var maxBarH = compact ? 10 : 18;
        for (var b = 0; b < nBars; b++) {
          var bh2 = (0.28 + 0.72 * hashLcg(i * 31 + b, 701)) * maxBarH;
          c.fillStyle = isLit ? (tile.col + "cc") : "#334155";
          c.fillRect(tx + (compact ? 4 : 7) + b * (bw2 + barGap), barBaseY - bh2, bw2, bh2);
        }
      }

      if (!compact) {
        text(c, "模擬資料 · seed=20261116", padX, h - 10, 8.5, MUTED, "left");
      }
      var litCount = Math.min(6, Math.floor(scanPos + 0.15));
      return "Check " + litCount + "/6";
    }, o);
  }

  /* #70 持有人歸併圖 — §6.7 升級（2026-11-16；實體以 QNT 單色階區分；紅＝控盤≥20%、琥珀＝≥15% 只作語意旗標） */
  var QOM_ENT = [
    { id: "E1", name: "實體 01", count: 5, pct: 24.6 }, { id: "E2", name: "實體 02", count: 4, pct: 18.2 },
    { id: "E3", name: "實體 03", count: 4, pct: 14.5 }, { id: "E4", name: "實體 04", count: 4, pct: 11.8 },
    { id: "E5", name: "實體 05", count: 3, pct: 7.4 }
  ];
  function qomRisk(p) { return p >= 20 ? RED : (p >= 15 ? AMBER : null); }
  function qomNodes() {
    var out = [], n = 0;
    for (var e = 0; e < QOM_ENT.length; e++) {
      var an = (e / QOM_ENT.length) * Math.PI * 2 - Math.PI * 0.4, ent = QOM_ENT[e];
      for (var k = 0; k < ent.count; k++, n++)
        out.push({ idx: n, label: "H" + (n + 1 < 10 ? "0" : "") + (n + 1), eIdx: e,
          sx: 0.12 + hashLcg(n, 801) * 0.76, sy: 0.14 + hashLcg(n, 809) * 0.72,
          tx: 0.5 + Math.cos(an) * 0.28, ty: 0.5 + Math.sin(an) * 0.28, share: ent.pct / ent.count * (0.75 + hashLcg(n, 823) * 0.5) });
    }
    return out;
  }
  function operatorMap(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return operatorMapLegacy(cv, _data, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme(QNT_ACC)), V = K.V, tx = K.tx, NODES = qomNodes();
    var SH = [V.acc2, V.acc, K.mix(V.acc, V.ink, 0.45), K.mix(V.acc, V.dim, 0.45), K.mix(V.acc, V.mute, 0.6)];
    function mU(e, t) { return easeOut(clamp((t - (16 + e * 4)) / 18, 0, 1)); }
    /* 集中度插畫：5 實體＋其他 的累積占比階梯（Lorenz 式），對角虛線＝均分 */
    function lorenz(c, b, col, lit) {
      var cum = 0, x0 = b.x + 4, y0 = b.y + b.h - 3, W = b.w - 8, H = b.h - 6, n = QOM_ENT.length + 1;
      c.strokeStyle = col; c.lineWidth = lit ? 1.4 : 1; c.beginPath(); c.moveTo(x0, y0);
      for (var e = 0; e < n; e++) {
        cum += e < QOM_ENT.length ? QOM_ENT[e].pct : 100 - 76.5;
        var x = x0 + W * (e + 1) / n, y = y0 - H * cum / 100;
        c.lineTo(x - W / n, y); c.lineTo(x, y);
      }
      c.stroke();
      c.fillStyle = col;
      for (e = 0, cum = 0; e < QOM_ENT.length; e++) {
        cum += QOM_ENT[e].pct;
        var r = qomRisk(QOM_ENT[e].pct);
        c.fillStyle = lit && r ? r : col; c.fillRect(Math.round(x0 + W * (e + 0.5) / n) - 1, Math.round(y0 - H * cum / 100) - 1, 3, 3);
      }
    }
    return driver(60, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var f = K.infoFont(w), fl = w >= 540 ? Math.max(9, f - 1) : f - 1, pad = compact ? 6 : 12, e, i;
      var linkU = clamp(t / 14, 0, 1), mus = [], merged = 0, act = -1;
      for (e = 0; e < 5; e++) { mus[e] = mU(e, t); if (t >= 28 + e * 4) merged++; if (act < 0 && mus[e] > 0.02 && mus[e] < 0.98) act = e; }
      if (act < 0 && t >= 50) act = 0;

      var hdH = compact ? 16 : Math.round(f * 2.4), hy = Math.round(pad * 0.5 + hdH * 0.5);
      tx(c, compact ? "20 → 5 實體" : "OPERATOR MAP · 20 持有人 → 5 個實體", pad, hy, f + 1, V.ink, "left", "700");
      tx(c, "merged " + merged + "/5", w - pad, hy, f, merged === 5 ? V.acc2 : V.dim, "right", "600");

      var top = pad + hdH, foot = compact ? 3 : Math.round(f * 1.8), bodyH = h - top - foot - Math.round(pad * 0.5);
      var gapC = compact ? 8 : 18, mw = Math.round((w - pad * 2 - gapC) * (compact ? 0.62 : 0.57));
      var MP = { x: pad, y: top, w: mw, h: bodyH }, rx = pad + mw + gapC, rw = w - pad - rx;
      var mb = K.pane(c, MP, compact ? "" : "FUNDING GRAPH", compact ? "" : "共同資金來源");
      K.specEdge(c, MP.x + 3, MP.y + 1, MP.w - 6);
      K.dotGrid(c, mb.x, mb.y, mb.w, mb.h, compact ? 9 : 12, V.dot2);
      function P(nx, ny) { return [mb.x + nx * mb.w, mb.y + ny * mb.h]; }

      /* 資金來源星狀連線（來源方塊＝實體中心）＋作用實體熱封包 */
      c.save(); c.beginPath(); c.rect(mb.x, mb.y, mb.w, mb.h); c.clip();
      for (i = 0; i < NODES.length; i++) {
        var nd = NODES[i], u = mus[nd.eIdx], src = P(nd.tx, nd.ty), p = P(lerp(nd.sx, nd.tx, u), lerp(nd.sy, nd.ty, u));
        if (linkU > 0.02 && u < 0.97) {
          c.globalAlpha = linkU * (1 - u) * (nd.eIdx === act ? 0.9 : 0.5);
          c.strokeStyle = nd.eIdx === act ? V.acc : V.line2; c.lineWidth = 1; c.setLineDash([2, 3]); K.ln(c, src[0], src[1], p[0], p[1]); c.setLineDash([]);
          c.globalAlpha = 1;
          if (nd.eIdx === act || (act < 0 && linkU < 1)) K.hotPacket(c, [src, p], (t * 0.17 + i * 0.13) % 1, V.acc2, compact ? 1.6 : 2.2);
        }
      }
      for (e = 0; e < 5; e++) {
        if (mus[e] > 0.35 || linkU < 0.02) continue;
        var an = (e / 5) * Math.PI * 2 - Math.PI * 0.4, sp = P(0.5 + Math.cos(an) * 0.28, 0.5 + Math.sin(an) * 0.28);
        c.fillStyle = V.bg; c.strokeStyle = SH[e]; c.lineWidth = 1; c.fillRect(sp[0] - 3, sp[1] - 3, 6, 6); c.strokeRect(sp[0] - 2.5, sp[1] - 2.5, 5, 5);
      }
      /* 20 持有人小圓（向實體收斂、淡出） */
      for (i = 0; i < NODES.length; i++) {
        var n2 = NODES[i], u2 = mus[n2.eIdx], q = P(lerp(n2.sx, n2.tx, u2), lerp(n2.sy, n2.ty, u2));
        var nr = clamp(3 + n2.share * 0.75, 3, compact ? 6 : 9), fade = 1 - clamp((u2 - 0.7) / 0.3, 0, 1) * 0.9;
        c.globalAlpha = fade; c.fillStyle = K.rgba(SH[n2.eIdx], 0.28); c.strokeStyle = SH[n2.eIdx]; c.lineWidth = 1;
        c.beginPath(); c.arc(q[0], q[1], nr, 0, Math.PI * 2); c.fill(); c.stroke();
        if (!compact && u2 < 0.6) tx(c, n2.label, q[0], q[1] - nr - fl * 0.6, fl, V.dim, "center");
        c.globalAlpha = 1;
      }
      /* 5 實體大圓（語意旗標：控盤紅、警告琥珀） */
      var ePos = [];
      for (e = 0; e < 5; e++) {
        var E = QOM_ENT[e], an2 = (e / 5) * Math.PI * 2 - Math.PI * 0.4, ep = P(0.5 + Math.cos(an2) * 0.28, 0.5 + Math.sin(an2) * 0.28);
        ePos.push(ep);
        if (mus[e] <= 0.35) continue;
        var ap = clamp((mus[e] - 0.35) / 0.65, 0, 1), er = ((compact ? 11 : 18) + E.count * (compact ? 1.2 : 2)) * ap, rk = qomRisk(E.pct);
        c.globalAlpha = ap;
        c.fillStyle = K.rgba(SH[e], 0.13); c.strokeStyle = SH[e]; c.lineWidth = 1.5;
        c.beginPath(); c.arc(ep[0], ep[1], er, 0, Math.PI * 2); c.fill(); c.stroke();
        if (rk) { c.strokeStyle = rk; c.lineWidth = 1; c.setLineDash([2, 2]); c.beginPath(); c.arc(ep[0], ep[1], er + 3.5, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
        K.specEdge(c, ep[0] - er * 0.45, ep[1] - er + 2, er * 0.9, 0.1);
        tx(c, E.id, ep[0], ep[1] - f * 0.55, f, V.ink, "center", "700");
        tx(c, E.count + (compact ? "" : " 錢包"), ep[0], ep[1] + f * 0.6, fl, rk || V.acc3, "center", "600");
        c.globalAlpha = 1;
      }
      c.restore();

      /* 右欄：ENTITIES 對照表（逐列填入；作用列光暈＋埠點）、CONCENTRATION 插畫 */
      var etH = compact ? bodyH : Math.round(bodyH * 0.6), ET = { x: rx, y: top, w: rw, h: etH };
      var eb = K.pane(c, ET, compact ? "" : "ENTITIES", compact ? "" : "wal · share");
      K.specEdge(c, ET.x + 3, ET.y + 1, ET.w - 6);
      var rh = eb.h / 5, rowY = [];
      for (var r = 0; r < 5; r++) {
        var E2 = QOM_ENT[r], ru = easeOut(clamp((t - (26 + r * 4)) / 10, 0, 1)), ry = eb.y + r * rh, rk2 = qomRisk(E2.pct), cyr = Math.round(ry + rh * (compact ? 0.5 : 0.36));
        rowY.push(cyr);
        c.globalAlpha = 0.3 + 0.7 * ru;
        c.fillStyle = SH[r]; c.beginPath(); c.arc(eb.x + 7, cyr, compact ? 2 : 2.6, 0, Math.PI * 2); c.fill();
        var pctS = ru > 0.2 ? E2.pct.toFixed(1) + "%" : "—";
        K.leader(c, compact ? E2.id : E2.name, pctS, eb.x + 13, eb.x + eb.w - 5, cyr, f, r === act);
        if (rk2 && ru > 0.2) tx(c, pctS, eb.x + eb.w - 5, cyr, f, rk2, "right", "600");
        if (!compact && rh > f * 2.6) {
          var by = Math.round(ry + rh * 0.72), bw = eb.w - 18 - f * 4.2;
          c.fillStyle = V.track; c.fillRect(eb.x + 13, by, bw, 2);
          c.fillStyle = SH[r]; c.fillRect(eb.x + 13, by, bw * (E2.pct / 30) * ru, 2);
          tx(c, ru > 0.2 ? E2.count + " wal" : "—", eb.x + eb.w - 5, by + 1, fl, V.dim, "right");
        }
        c.globalAlpha = 1;
        K.kvPort(c, ET.x, cyr, ru > 0.5);
      }
      if (act >= 0) {
        K.activeHalo(c, eb.x + 2, eb.y + act * rh + 2, eb.w - 4, rh - 4, compact ? 6 : 10);
        var mxp = Math.round(MP.x + MP.w + gapC / 2) + 0.5, eyp = Math.round(clamp(ePos[act][1], mb.y + 4, mb.y + mb.h - 4)) + 0.5;
        var route = [[MP.x + MP.w, eyp], [mxp, eyp], [mxp, rowY[act]], [ET.x, rowY[act]]];
        c.strokeStyle = V.line2; c.lineWidth = 1; c.setLineDash([2, 2]); K.orthPath(c, route, 4); c.setLineDash([]);
        K.kvPort(c, MP.x + MP.w, eyp, true);
        K.hotPacket(c, route, mus[act] > 0.97 ? (t * 0.1) % 1 : mus[act], V.acc2, compact ? 2 : 2.6);
      }
      if (!compact) {
        var CN = { x: rx, y: top + etH + 8, w: rw, h: bodyH - etH - 8 };
        var cb = K.pane(c, CN, "CONCENTRATION", "top5 76.5%");
        K.specEdge(c, CN.x + 3, CN.y + 1, CN.w - 6);
        var lb = { x: cb.x, y: cb.y, w: cb.w, h: cb.h - f * 1.6 };
        c.setLineDash([2, 3]); c.strokeStyle = V.lead; K.ln(c, lb.x + 4, lb.y + lb.h - 3, lb.x + lb.w - 4, lb.y + 3); c.setLineDash([]);
        K.develop(c, lb, clamp((t - 16) / 34, 0, 1), function (cc, col, lit) { lorenz(cc, lb, col, lit); });
        K.leader(c, "top entity", merged > 0 ? "24.6%" : "—", cb.x + 4, cb.x + cb.w - 4, Math.round(cb.y + cb.h - f * 0.7), f, merged > 0);
        tx(c, "模擬資料 · seed=20261116", pad, h - foot / 2 - 2, f, V.mute, "left");
      }
      return "Merged " + merged + "/5";
    }, o);
  }

  /* #70 持有人歸併圖 (Operator Map) — 舊版（A23Tex 缺席時退回） */
  function operatorMapLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var ENTITIES = [
      { id: "E1", name: "實體 01", count: 5, pct: 24.6, col: RED },
      { id: "E2", name: "實體 02", count: 4, pct: 18.2, col: AMBER },
      { id: "E3", name: "實體 03", count: 4, pct: 14.5, col: LIME },
      { id: "E4", name: "實體 04", count: 4, pct: 11.8, col: EMERALD },
      { id: "E5", name: "實體 05", count: 3, pct: 7.4, col: "#38bdf8" }
    ];

    // Precompute 20 deterministic holders partitioned into 5 entities (5+4+4+4+3=20)
    var NODES = [];
    var nIdx = 0;
    for (var e = 0; e < ENTITIES.length; e++) {
      var ent = ENTITIES[e];
      // Cluster target normalized [0..1]
      var angle = (e / ENTITIES.length) * Math.PI * 2 - Math.PI * 0.4;
      var tx = 0.5 + Math.cos(angle) * 0.28;
      var ty = 0.5 + Math.sin(angle) * 0.28;
      for (var k = 0; k < ent.count; k++) {
        var sx = 0.12 + hashLcg(nIdx, 801) * 0.76;
        var sy = 0.14 + hashLcg(nIdx, 809) * 0.72;
        var share = ent.pct / ent.count * (0.75 + hashLcg(nIdx, 823) * 0.5);
        NODES.push({
          idx: nIdx,
          label: "H" + (nIdx + 1 < 10 ? "0" + (nIdx + 1) : (nIdx + 1)),
          eIdx: e,
          col: ent.col,
          sx: sx, sy: sy,
          tx: tx, ty: ty,
          share: share
        });
        nIdx++;
      }
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var padX = compact ? 10 : 18;
      var topY = compact ? 24 : 38;
      var botPad = compact ? 10 : 22;

      // Header
      text(c, "20 持有人 → 5 個實體", padX, compact ? 13 : 19, compact ? 10 : 12.5, LIME, "left", "700");

      var mapW = compact ? (w - padX * 2) : Math.max(180, (w - padX * 2) * 0.58);
      var mapH = Math.max(80, h - topY - botPad);
      var mapX = padX, mapY = topY;

      // Subtle map frame
      c.fillStyle = "#090f1a";
      roundRect(c, mapX, mapY, mapW, mapH, 5);
      c.fill();
      c.strokeStyle = LINE_COL;
      c.lineWidth = 1;
      c.stroke();

      // Phase timing:
      // 0..16: funding links appear
      // 16..46: nodes converge into 5 entities (staggered slightly by entity)
      var linkU = clamp(t / 14, 0, 1);

      // Draw common funding source links within each cluster
      if (linkU > 0.02) {
        c.save();
        for (var e1 = 0; e1 < ENTITIES.length; e1++) {
          var mergeU = easeOut(clamp((t - (16 + e1 * 4)) / 18, 0, 1));
          var clNodes = [];
          for (var ni = 0; ni < NODES.length; ni++) {
            if (NODES[ni].eIdx === e1) clNodes.push(NODES[ni]);
          }
          c.strokeStyle = ENTITIES[e1].col;
          c.globalAlpha = linkU * (1 - mergeU * 0.75) * 0.55;
          c.lineWidth = 1;
          c.setLineDash([3, 3]);
          for (var a = 0; a < clNodes.length - 1; a++) {
            var nA = clNodes[a], nB = clNodes[a + 1];
            var ax = mapX + lerp(nA.sx, nA.tx, mergeU) * mapW;
            var ay = mapY + lerp(nA.sy, nA.ty, mergeU) * mapH;
            var bx = mapX + lerp(nB.sx, nB.tx, mergeU) * mapW;
            var by = mapY + lerp(nB.sy, nB.ty, mergeU) * mapH;
            c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
          }
        }
        c.restore();
      }

      // Draw 20 holder circles converging
      for (var i = 0; i < NODES.length; i++) {
        var nd = NODES[i];
        var mU = easeOut(clamp((t - (16 + nd.eIdx * 4)) / 18, 0, 1));
        var nx = mapX + lerp(nd.sx, nd.tx, mU) * mapW;
        var ny = mapY + lerp(nd.sy, nd.ty, mU) * mapH;
        var nr = clamp(3.5 + nd.share * 0.9, 4, compact ? 8 : 11);
        var fade = 1 - clamp((mU - 0.7) / 0.3, 0, 1) * 0.85;
        c.save();
        c.globalAlpha = fade;
        c.fillStyle = nd.col + "55";
        c.strokeStyle = nd.col;
        c.lineWidth = 1.1;
        c.beginPath(); c.arc(nx, ny, nr, 0, Math.PI * 2); c.fill(); c.stroke();
        if (!compact && mU < 0.65) {
          text(c, nd.label, nx, ny - nr - 5, 7.5, DIM, "center");
        }
        c.restore();
      }

      // Draw 5 merged entity rings
      for (var e2 = 0; e2 < ENTITIES.length; e2++) {
        var ent2 = ENTITIES[e2];
        var mergeU2 = easeOut(clamp((t - (16 + e2 * 4)) / 18, 0, 1));
        if (mergeU2 > 0.35) {
          var appearU = clamp((mergeU2 - 0.35) / 0.65, 0, 1);
          var angle2 = (e2 / ENTITIES.length) * Math.PI * 2 - Math.PI * 0.4;
          var ex = mapX + (0.5 + Math.cos(angle2) * 0.28) * mapW;
          var ey = mapY + (0.5 + Math.sin(angle2) * 0.28) * mapH;
          var er = (compact ? 14 : 20) + ent2.count * (compact ? 1.2 : 2.0);
          c.save();
          c.globalAlpha = appearU;
          c.fillStyle = ent2.col + "1e";
          c.strokeStyle = ent2.col;
          c.lineWidth = 2;
          c.beginPath(); c.arc(ex, ey, er * appearU, 0, Math.PI * 2); c.fill(); c.stroke();
          text(c, ent2.id, ex, ey - (compact ? 4 : 5), compact ? 8 : 9.5, FG, "center", "700");
          text(c, ent2.count + " 錢包", ex, ey + (compact ? 5 : 7), compact ? 7.5 : 8.5, ent2.col, "center", "600");
          c.restore();
        }
      }

      // Right summary table (full mode)
      if (!compact) {
        var tblX = mapX + mapW + 14;
        var tblW = w - padX - tblX;
        var rowH = Math.min(34, (mapH - 26) / 5);
        text(c, "實體", tblX + 6, mapY + 10, 9.5, MUTED, "left", "700");
        text(c, "錢包數", tblX + tblW * 0.56, mapY + 10, 9.5, MUTED, "center", "700");
        text(c, "合計占比", tblX + tblW - 6, mapY + 10, 9.5, MUTED, "right", "700");
        c.strokeStyle = LINE_COL;
        c.beginPath(); c.moveTo(tblX, mapY + 20); c.lineTo(tblX + tblW, mapY + 20); c.stroke();

        for (var r = 0; r < ENTITIES.length; r++) {
          var ent3 = ENTITIES[r];
          var rowU = easeOut(clamp((t - (26 + r * 4)) / 10, 0, 1));
          var ry = mapY + 26 + r * rowH;
          c.save();
          c.globalAlpha = 0.15 + 0.85 * rowU;
          c.fillStyle = CARD_BG;
          roundRect(c, tblX, ry, tblW, rowH - 4, 3);
          c.fill();
          c.strokeStyle = rowU > 0.5 ? ent3.col + "88" : LINE_COL;
          c.lineWidth = 1;
          c.stroke();
          c.fillStyle = ent3.col;
          c.fillRect(tblX + 2, ry + 3, 3, rowH - 10);
          text(c, ent3.name, tblX + 12, ry + (rowH - 4) * 0.5, 9.5, FG, "left", "600");
          text(c, rowU > 0.2 ? (ent3.count + " 錢包") : "—", tblX + tblW * 0.56, ry + (rowH - 4) * 0.5, 9.5, DIM, "center");
          text(c, rowU > 0.2 ? (ent3.pct.toFixed(1) + "%") : "—", tblX + tblW - 8, ry + (rowH - 4) * 0.5, 10, ent3.col, "right", "700");
          c.restore();
        }
        text(c, "模擬資料 · seed=20261116", padX, h - 10, 8.5, MUTED, "left");
      }

      var mergedCount = 0;
      for (var mc = 0; mc < 5; mc++) {
        if (t >= 26 + mc * 4) mergedCount++;
      }
      return "Merged " + mergedCount + "/5";
    }, o);
  }

  /* ===== #72–#74 借鏡 Polymarket bot 儀表板（2026-11-17，Claude；模擬資料 seed=20261117）===== */
  function qntNoTexLegacy(cv, opt) {
    return driver(2, function () { var s = fit(cv); s.c.fillStyle = DIM; s.c.font = "12px sans-serif"; s.c.fillText("A23Tex 未載入", 12, 22); return ""; }, opt || {});
  }
  function qntGauss(K, i, s) { var u = Math.max(1e-6, K.hh(i, s)), v = K.hh(i, s + 0.37); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * v); }
  function qntFmt(v, d) { return v.toFixed(d).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
  function qntPct(v) { return Math.round(v * 100) + "%"; }
  function qntLay(w, h, f, compact, lr, r1) {
    var pad = compact ? 6 : 12, hdH = compact ? 16 : Math.round(f * 2.4);
    var top = pad + hdH, foot = compact ? 3 : Math.round(f * 1.8), bodyH = h - top - foot - Math.round(pad * 0.5);
    var gapC = compact ? 8 : 18, lw = Math.round((w - pad * 2 - gapC) * lr);
    var rx = pad + lw + gapC, rw = w - pad - rx, vg = compact ? 4 : 8, hpH = Math.round(bodyH * r1);
    return { pad: pad, hy: Math.round(pad * 0.5 + hdH * 0.5), foot: foot, gapC: gapC,
      L: { x: pad, y: top, w: lw, h: bodyH }, R1: { x: rx, y: top, w: rw, h: hpH }, R2: { x: rx, y: top + hpH + vg, w: rw, h: bodyH - hpH - vg } };
  }

  /* #72 大數法則收斂錐 (LLN Convergence Cone)：12 條樣本累積均值在 ±2σ/√n 錐內收斂，判斷「漂移是否跑出雜訊」 */
  function lawCone(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return qntNoTexLegacy(cv, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme(QNT_ACC)), V = K.V, tx = K.tx;
    var NP = 12, NMAX = 400, MU = 0.9, SIG = 6, NF = 120, ACT = 3, YR = 6;
    var CM = [];
    for (var p = 0; p < NP; p++) {
      var sum = 0, row = [];
      for (var k = 0; k < NMAX; k++) { sum += MU + SIG * qntGauss(K, p * 1000 + k + 1, 11 + p); row.push(sum / (k + 1)); }
      CM.push(row);
    }
    return driver(NF, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var f = K.infoFont(w), u = clamp(t / (NF - 1), 0, 1), frac = t - Math.floor(t);
      var n = Math.max(2, Math.round(2 + (NMAX - 2) * Math.pow(u, 1.5)));
      var se = SIG / Math.sqrt(n), m = CM[ACT][n - 1], z = m / se;
      var vcol = z >= 2 ? EMERALD : (z >= 1 ? AMBER : RED), vtxt = z >= 2 ? "EDGE 顯著" : (z >= 1 ? "觀察中" : "雜訊內");
      var Y = qntLay(w, h, f, compact, 0.62, 0.46), pad = Y.pad, L = Y.L, R1 = Y.R1, R2 = Y.R2;
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, compact ? "LLN CONE" : "LAW OF LARGE NUMBERS · 漂移 vs 雜訊", pad, Y.hy, f + 1, V.ink, "left", "700");
      tx(c, vtxt + (compact ? "" : "  z=" + z.toFixed(2)), w - pad, Y.hy, f, vcol, "right", "700");

      /* 主圖：以 0 為虛無假設的 ±1σ/±2σ 收斂錐（log n 軸）＋ 12 條樣本累積均值 */
      var ib = K.pane(c, L, "DRIFT vs NOISE", compact ? "" : "n=" + n);
      K.specEdge(c, L.x + 3, L.y + 1, L.w - 6);
      var ax0 = ib.x + (compact ? 16 : Math.round(f * 3.4)), ax1 = ib.x + ib.w - 6, ay0 = ib.y + 4, ay1 = ib.y + ib.h - (compact ? 4 : Math.round(f * 1.9));
      var lnN = Math.log(NMAX), my = (ay0 + ay1) / 2, hy2 = (ay1 - ay0) / 2;
      function px(kk) { return ax0 + (ax1 - ax0) * Math.log(kk) / lnN; }
      function pv(v) { return clamp(my - v / YR * hy2, ay0, ay1); }
      [2, 1].forEach(function (ks) {
        c.beginPath();
        for (var k1 = 1; k1 <= NMAX; k1++) c.lineTo(px(k1), pv(ks * SIG / Math.sqrt(k1)));
        for (var k2 = NMAX; k2 >= 1; k2--) c.lineTo(px(k2), pv(-ks * SIG / Math.sqrt(k2)));
        c.closePath(); c.fillStyle = K.rgba(V.acc, ks === 2 ? 0.06 : 0.08); c.fill();
        c.strokeStyle = ks === 2 ? V.line2 : V.line; c.lineWidth = 1; c.stroke();
      });
      c.strokeStyle = V.line; c.lineWidth = 1; K.ln(c, ax0, Math.round(my) + 0.5, ax1, Math.round(my) + 0.5);
      c.setLineDash([4, 3]); c.strokeStyle = K.rgba(EMERALD, 0.7); K.ln(c, ax0, Math.round(pv(MU)) + 0.5, ax1, Math.round(pv(MU)) + 0.5); c.setLineDash([]);
      if (!compact) {
        tx(c, "drift μ=" + MU + "¢", ax1 - 2, pv(MU) - f * 0.8, f, EMERALD, "right", "600");
        tx(c, "±2σ/√n", px(14), pv(2 * SIG / Math.sqrt(14)) - f * 0.8, f, V.dim, "left", "600");
        [-YR, 0, YR].forEach(function (v) { tx(c, (v > 0 ? "+" : "") + v + "¢", ax0 - 4, pv(v), f, V.mute, "right", "500"); });
        [1, 10, 100, NMAX].forEach(function (kk) { tx(c, String(kk), px(kk), ay1 + f * 0.95, f, V.mute, "center", "500"); });
      }
      for (var p1 = 0; p1 < NP; p1++) {
        if (p1 === ACT) continue;
        c.beginPath();
        for (var k3 = 1; k3 <= n; k3++) { if (k3 === 1) c.moveTo(px(k3), pv(CM[p1][0])); else c.lineTo(px(k3), pv(CM[p1][k3 - 1])); }
        c.strokeStyle = K.rgba(V.txt, 0.22); c.lineWidth = 1; c.stroke();
      }
      c.beginPath();
      for (var k4 = 1; k4 <= n; k4++) { if (k4 === 1) c.moveTo(px(k4), pv(CM[ACT][0])); else c.lineTo(px(k4), pv(CM[ACT][k4 - 1])); }
      c.strokeStyle = V.acc2; c.lineWidth = compact ? 1.3 : 1.8; c.stroke();
      var nx = Math.round(px(n)) + 0.5;
      c.setLineDash([2, 3]); c.strokeStyle = V.lead; K.ln(c, nx, ay0, nx, ay1); c.setLineDash([]);
      var hx = px(n), hyy = pv(m);
      K.activeHalo(c, hx - 5, hyy - 5, 10, 10, compact ? 6 : 10);
      c.fillStyle = vcol; c.beginPath(); c.arc(hx, hyy, compact ? 2.2 : 3, 0, 6.2832); c.fill();

      /* 走線：作用路徑高度 → EDGE TEST 鍵值窗 */
      var mx = Math.round(L.x + L.w + Y.gapC / 2) + 0.5, ty = Math.round(R2.y + R2.h * 0.3) + 0.5, sy = Math.round(hyy) + 0.5;
      var route = [[L.x + L.w, sy], [mx, sy], [mx, ty], [R2.x, ty]];
      c.strokeStyle = V.line2; c.lineWidth = 1; c.setLineDash([2, 2]); K.orthPath(c, route, 4); c.setLineDash([]);
      K.kvPort(c, L.x + L.w, sy, true); K.kvPort(c, R2.x, ty, z >= 2);
      K.hotPacket(c, route, frac, V.acc2, compact ? 2 : 2.6);

      /* DIST：12 條路徑當下均值分佈（顯影）；跑出 +2σ/√n 的柱顯影為綠 */
      var hb = K.pane(c, R1, "DIST · " + NP + " bots", compact ? "" : "μ̂ 分佈");
      K.specEdge(c, R1.x + 3, R1.y + 1, R1.w - 6);
      var NB = 12, bins = [];
      for (var b = 0; b < NB; b++) bins.push(0);
      for (var p2 = 0; p2 < NP; p2++) bins[clamp(Math.floor((CM[p2][n - 1] + 3) / 6 * NB), 0, NB - 1)]++;
      K.develop(c, hb, clamp(0.3 + frac * 1.4, 0, 1), function (cc, col, lit) {
        var bw = (hb.w - 8) / NB, base = hb.y + hb.h - 3, mxb = Math.max(4, Math.max.apply(null, bins));
        for (var b2 = 0; b2 < NB; b2++) {
          var lo = -3 + b2 * 0.5, bh = (hb.h - 10) * bins[b2] / mxb;
          cc.fillStyle = (lit && lo >= 2 * se) ? EMERALD : col;
          cc.fillRect(Math.round(hb.x + 4 + b2 * bw + 1), Math.round(base - bh), Math.max(1, Math.round(bw - 2)), Math.round(bh));
        }
        cc.fillStyle = col; cc.fillRect(hb.x + 3, base, hb.w - 6, 1);
        var cL = clamp(hb.x + 4 + (hb.w - 8) * (3 - 2 * se) / 6, hb.x + 3, hb.x + hb.w - 3), cR = clamp(hb.x + 4 + (hb.w - 8) * (3 + 2 * se) / 6, hb.x + 3, hb.x + hb.w - 3);
        cc.setLineDash([2, 3]); cc.strokeStyle = col; K.ln(cc, cL, hb.y + 4, cL, base); K.ln(cc, cR, hb.y + 4, cR, base); cc.setLineDash([]);
      });

      /* EDGE TEST：作用路徑的 z 檢定鍵值列 */
      var kb = K.pane(c, R2, "EDGE TEST", compact ? "" : "bot#" + (ACT + 1));
      K.specEdge(c, R2.x + 3, R2.y + 1, R2.w - 6);
      c.fillStyle = vcol; c.fillRect(R2.x + 1, R2.y + 3, 2, R2.h - 6);
      var rows = [["verdict", vtxt, true], ["n trades", String(n)], ["μ̂", (m >= 0 ? "+" : "") + m.toFixed(2) + "¢", true],
        ["σ/√n", se.toFixed(2) + "¢"], ["z", z.toFixed(2)], ["need n", String(Math.ceil(Math.pow(2 * SIG / MU, 2)))]];
      K.kvBlock(c, { x: kb.x + 3, y: kb.y, w: kb.w - 3, h: kb.h }, rows, f, R2.x);
      if (!compact) {
        tx(c, "模擬資料 · seed=20261117 · 12 條樣本路徑", pad, h - Y.foot / 2 - 2, f, V.mute, "left");
        tx(c, "x = log n", w - pad, h - Y.foot / 2 - 2, f, V.mute, "right");
      }
      return "n=" + n + " z=" + z.toFixed(1);
    }, o);
  }

  /* #73 狀態轉移鏈 (Direction State Chain)：3 狀態馬可夫鏈，箭頭粗細＝轉移機率，右側轉移矩陣（理論＋實測） */
  function stateChain(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return qntNoTexLegacy(cv, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme(QNT_ACC)), V = K.V, tx = K.tx;
    var P = [[0.52, 0.30, 0.18], [0.33, 0.38, 0.29], [0.20, 0.31, 0.49]];
    var NM = ["UP", "FLAT", "DOWN"], SCOL = [EMERALD, V.acc3, RED], NF = 200, seq = [1];
    for (var i = 1; i <= NF; i++) { var r = K.hh(i, 29), a0 = seq[i - 1]; seq.push(r < P[a0][0] ? 0 : (r < P[a0][0] + P[a0][1] ? 1 : 2)); }
    function argmax(rw) { return rw[0] >= rw[1] && rw[0] >= rw[2] ? 0 : (rw[1] >= rw[2] ? 1 : 2); }
    return driver(NF, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var f = K.infoFont(w), step = Math.max(1, Math.min(NF, Math.floor(t) + 1)), frac = t - Math.floor(t), sc = compact ? 0.6 : 1;
      var cur = seq[step], prev = seq[step - 1], streak = 1, hit = 0, cnt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], tot = [0, 0, 0];
      while (step - streak >= 0 && seq[step - streak] === cur) streak++;
      for (var j = 1; j <= step; j++) { if (argmax(P[seq[j - 1]]) === seq[j]) hit++; cnt[seq[j - 1]][seq[j]]++; tot[seq[j - 1]]++; }
      var Y = qntLay(w, h, f, compact, 0.56, 0.52), pad = Y.pad, L = Y.L, R1 = Y.R1, R2 = Y.R2;
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, compact ? "STATE CHAIN" : "DIRECTION CHAIN · 狀態轉移鏈", pad, Y.hy, f + 1, V.ink, "left", "700");
      tx(c, NM[prev] + " → " + NM[cur], w - pad, Y.hy, f, SCOL[cur], "right", "700");

      /* 左：三狀態節點＋雙向弧（粗細＝機率）＋自迴圈＋底部方向帶 */
      var ib = K.pane(c, L, "MARKOV · 3 STATES", compact ? "" : "step " + step);
      K.specEdge(c, L.x + 3, L.y + 1, L.w - 6);
      var tapeH = compact ? 5 : Math.round(f * 1.3), gy0 = ib.y + 6, gy1 = ib.y + ib.h - tapeH - 10;
      var gcx = ib.x + ib.w / 2, gcy = (gy0 + gy1) / 2 + (gy1 - gy0) * 0.08, RR = Math.min(ib.w * 0.32, (gy1 - gy0) * 0.4), nr = Math.max(8, RR * 0.27);
      var pos = [[gcx, gcy - RR], [gcx - RR * 0.95, gcy + RR * 0.55], [gcx + RR * 0.95, gcy + RR * 0.55]];
      function curvePts(a, b) {
        var A = pos[a], B = pos[b], dx = B[0] - A[0], dy = B[1] - A[1], d = Math.sqrt(dx * dx + dy * dy), ux = dx / d, uy = dy / d;
        var sx = A[0] + ux * nr, sy = A[1] + uy * nr, ex = B[0] - ux * (nr + 3), ey = B[1] - uy * (nr + 3);
        var qx = (sx + ex) / 2 - uy * d * 0.16, qy = (sy + ey) / 2 + ux * d * 0.16, pts = [];
        for (var q = 0; q <= 14; q++) { var tt = q / 14, w1 = (1 - tt) * (1 - tt), w2 = 2 * (1 - tt) * tt, w3 = tt * tt; pts.push([w1 * sx + w2 * qx + w3 * ex, w1 * sy + w2 * qy + w3 * ey]); }
        return pts;
      }
      function loopPts(a) {
        var A = pos[a], ox = A[0] - gcx, oy = A[1] - gcy, od = Math.sqrt(ox * ox + oy * oy) || 1, lx = A[0] + ox / od * nr * 1.35, ly = A[1] + oy / od * nr * 1.35, pts = [];
        for (var q = 0; q <= 16; q++) { var an = Math.atan2(-oy, -ox) + 0.6 + q / 16 * (6.2832 - 1.2); pts.push([lx + Math.cos(an) * nr * 0.62, ly + Math.sin(an) * nr * 0.62]); }
        return pts;
      }
      function poly(pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var q = 1; q < pts.length; q++) c.lineTo(pts[q][0], pts[q][1]); c.stroke(); }
      function arrow(pts, col, sz) {
        var e = pts[pts.length - 1], p0 = pts[pts.length - 3], an = Math.atan2(e[1] - p0[1], e[0] - p0[0]);
        c.fillStyle = col; c.beginPath(); c.moveTo(e[0] + Math.cos(an) * sz, e[1] + Math.sin(an) * sz);
        c.lineTo(e[0] + Math.cos(an + 2.5) * sz, e[1] + Math.sin(an + 2.5) * sz); c.lineTo(e[0] + Math.cos(an - 2.5) * sz, e[1] + Math.sin(an - 2.5) * sz); c.closePath(); c.fill();
      }
      var actPts = null;
      for (var a = 0; a < 3; a++) {
        for (var b = 0; b < 3; b++) {
          var pts = a === b ? loopPts(a) : curvePts(a, b), act = a === prev && b === cur, pr = P[a][b];
          c.strokeStyle = act ? V.acc2 : K.rgba(SCOL[a], 0.22 + pr * 0.6); c.lineWidth = (0.6 + pr * 6) * sc; poly(pts);
          arrow(pts, act ? V.acc2 : K.rgba(SCOL[a], 0.45 + pr * 0.45), (3 + pr * 4) * sc);
          if (act) actPts = pts;
          if (!compact && a !== b) { var mp = pts[7], A2 = pos[a], B2 = pos[b], nx2 = -(B2[1] - A2[1]), ny2 = B2[0] - A2[0], nd = Math.sqrt(nx2 * nx2 + ny2 * ny2) || 1;
            tx(c, qntPct(pr), mp[0] + nx2 / nd * f * 1.1, mp[1] + ny2 / nd * f * 1.1, f, act ? V.acc2 : V.dim, "center", "600"); }
        }
      }
      for (var a3 = 0; a3 < 3; a3++) {
        var Q = pos[a3], on = a3 === cur;
        if (on) K.activeHalo(c, Q[0] - nr, Q[1] - nr, nr * 2, nr * 2, compact ? 8 : 14);
        c.fillStyle = on ? V.card : V.pane; c.beginPath(); c.arc(Q[0], Q[1], nr, 0, 6.2832); c.fill();
        c.strokeStyle = SCOL[a3]; c.lineWidth = on ? 2.2 : 1.2; c.stroke();
        tx(c, NM[a3], Q[0], Q[1] - (compact ? 0 : f * 0.45), compact ? f : f + 0.5, SCOL[a3], "center", "700");
        if (!compact) tx(c, "↻" + qntPct(P[a3][a3]), Q[0], Q[1] + f * 0.75, f, V.dim, "center", "600");
      }
      if (actPts) K.hotPacket(c, actPts, easeOut(frac), V.acc2, compact ? 2 : 2.8);
      var NT = compact ? 20 : 36, tw = (ib.w - 8) / NT, ty0 = ib.y + ib.h - tapeH - 3;
      for (var q2 = 0; q2 < NT; q2++) {
        var si = step - (NT - 1 - q2);
        if (si < 0) continue;
        c.fillStyle = K.rgba(SCOL[seq[si]], q2 === NT - 1 ? 1 : 0.5); c.fillRect(Math.round(ib.x + 4 + q2 * tw), ty0, Math.max(1, Math.round(tw - 1)), tapeH);
      }

      /* 右上：轉移矩陣（理論機率；下行小字＝實測頻率），作用列＝當前狀態 */
      var mb = K.pane(c, R1, "P(next | now)", compact ? "" : "實測 " + step + " 步");
      K.specEdge(c, R1.x + 3, R1.y + 1, R1.w - 6);
      var hd = compact ? 12 : Math.round(f * 3.6), hdy = compact ? 8 : Math.round(f * 1.6);
      var cw = (mb.w - hd - 4) / 3, chh = (mb.h - hdy - 4) / 3, mx0 = mb.x + hd, my0 = mb.y + hdy;
      for (var b3 = 0; b3 < 3; b3++) tx(c, compact ? NM[b3].charAt(0) : NM[b3], mx0 + cw * (b3 + 0.5), mb.y + hdy * 0.5, f, SCOL[b3], "center", "700");
      for (var a4 = 0; a4 < 3; a4++) {
        tx(c, compact ? NM[a4].charAt(0) : NM[a4], mx0 - 4, my0 + chh * (a4 + 0.5), f, SCOL[a4], "right", "700");
        for (var b4 = 0; b4 < 3; b4++) {
          var x0 = mx0 + cw * b4 + 1, y0 = my0 + chh * a4 + 1;
          c.fillStyle = K.rgba(V.acc, 0.06 + P[a4][b4] * 0.6); K.roundRect(c, x0, y0, cw - 2, chh - 2, 2); c.fill();
          var two = !compact && chh > f * 2.8;
          tx(c, qntPct(P[a4][b4]), x0 + (cw - 2) / 2, y0 + (chh - 2) * (two ? 0.38 : 0.5), f, V.ink, "center", "700");
          if (two) tx(c, tot[a4] ? qntPct(cnt[a4][b4] / tot[a4]) : "–", x0 + (cw - 2) / 2, y0 + (chh - 2) * 0.72, f, V.dim, "center", "500");
        }
      }
      var rowY = Math.round(my0 + chh * (cur + 0.5)) + 0.5;
      c.strokeStyle = V.acc; c.lineWidth = 1.2; K.roundRect(c, mx0 + 0.5, my0 + chh * cur + 0.5, cw * 3 - 1, chh - 1, 3); c.stroke();
      var Qc = pos[cur], ny = Math.round(Qc[1]) + 0.5, mx = Math.round(L.x + L.w + Y.gapC / 2) + 0.5;
      c.strokeStyle = V.line2; c.lineWidth = 1; c.setLineDash([2, 2]); K.orthPath(c, [[L.x + L.w, ny], [mx, ny], [mx, rowY], [R1.x, rowY]], 4); c.setLineDash([]);
      K.kvPort(c, L.x + L.w, ny, true); K.kvPort(c, R1.x, rowY, true);

      /* 右下：訊號鍵值列 */
      var nxt = argmax(P[cur]), kb = K.pane(c, R2, "SIGNAL", compact ? "" : "argmax 預測");
      K.specEdge(c, R2.x + 3, R2.y + 1, R2.w - 6);
      c.fillStyle = SCOL[cur]; c.fillRect(R2.x + 1, R2.y + 3, 2, R2.h - 6);
      var rows = [["now", NM[cur], true], ["prev", NM[prev]], ["streak", streak + " 步"], ["next ≈", NM[nxt] + " " + qntPct(P[cur][nxt]), true],
        ["hit rate", qntPct(hit / step)], ["steps", String(step)]];
      K.kvBlock(c, { x: kb.x + 3, y: kb.y, w: kb.w - 3, h: kb.h }, rows, f, R2.x);
      if (!compact) {
        tx(c, "模擬資料 · seed=20261117 · 箭頭粗細＝轉移機率", pad, h - Y.foot / 2 - 2, f, V.mute, "left");
        tx(c, "矩陣下行＝實測", w - pad, h - Y.foot / 2 - 2, f, V.mute, "right");
      }
      return NM[prev] + "→" + NM[cur];
    }, o);
  }

  /* #74 K 線＋掛單階梯 (Candle + Depth Ladder)：左 K 線＋量能，右買賣價位深度階梯＋失衡比 */
  function depthLadder(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return qntNoTexLegacy(cv, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme(QNT_ACC)), V = K.V, tx = K.tx;
    var NC = 170, WIN = 32, NF = NC - WIN - 1, TICK = 2.5, CD = [], p0 = 79880;
    for (var i = 0; i < NC; i++) {
      var op = p0, dr = qntGauss(K, i + 1, 41) * 14 + Math.sin(i / 9) * 4, cl = op + dr;
      CD.push({ o: op, c: cl, h: Math.max(op, cl) + Math.abs(qntGauss(K, i + 1, 43)) * 6, l: Math.min(op, cl) - Math.abs(qntGauss(K, i + 1, 47)) * 6,
        v: 0.3 + K.hh(i + 1, 53) * 0.7 + Math.min(1, Math.abs(dr) / 30) });
      p0 = cl;
    }
    function sz(bs, side, r) { return (0.25 + K.hh(bs * 7 + r + side * 100, 61) * 0.9) * (1 + r * 0.18); }
    return driver(NF, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var f = K.infoFont(w), base = Math.min(NF - 1, Math.floor(t)), frac = t - Math.floor(t), ef = easeOut(frac), win = compact ? 20 : WIN;
      var i1 = base + WIN, cdl = [];
      for (var k = i1 - win + 1; k <= i1; k++) cdl.push(CD[k]);
      var lc = CD[i1], live = { o: lc.o, c: lerp(lc.o, lc.c, ef), v: lc.v * Math.max(0.15, ef) };
      live.h = Math.max(lerp(lc.o, lc.h, ef), live.o, live.c); live.l = Math.min(lerp(lc.o, lc.l, ef), live.o, live.c);
      cdl[cdl.length - 1] = live;
      var last = live.c, up = live.c >= live.o, lo = 1e9, hi = -1e9, vmax = 0;
      cdl.forEach(function (d) { lo = Math.min(lo, d.l); hi = Math.max(hi, d.h); vmax = Math.max(vmax, d.v); });
      var pp = (hi - lo) * 0.08 + 2; lo -= pp; hi += pp;
      var chg = (last - cdl[0].o) / cdl[0].o * 100, pcol = up ? EMERALD : RED;
      var Y = qntLay(w, h, f, compact, 0.58, 0.7), pad = Y.pad, L = Y.L, R1 = Y.R1, R2 = Y.R2;
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, compact ? "SPOT · BOOK" : "SPOT · ORDER BOOK · K 線＋掛單階梯", pad, Y.hy, f + 1, V.ink, "left", "700");
      tx(c, qntFmt(last, 1), w - pad, Y.hy, f + 1, pcol, "right", "700");

      /* 左：K 線＋量能＋最新價虛線與價籤 */
      var ib = K.pane(c, L, "SPOT · 1m", compact ? "" : "Δ " + (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%");
      K.specEdge(c, L.x + 3, L.y + 1, L.w - 6);
      var tagW = compact ? 0 : Math.round(f * 5.8), cx0 = ib.x + 3, cx1 = ib.x + ib.w - tagW - 4, vh = Math.round(ib.h * 0.18), cy0 = ib.y + 4, cy1 = ib.y + ib.h - vh - 6;
      function yP(v) { return cy0 + (hi - v) / (hi - lo) * (cy1 - cy0); }
      var cwid = (cx1 - cx0) / cdl.length, bw = Math.max(1, Math.round(cwid * 0.62));
      for (var gq = 1; gq < 4; gq++) {
        var gy = Math.round(cy0 + (cy1 - cy0) * gq / 4) + 0.5;
        c.strokeStyle = V.line; c.lineWidth = 1; c.setLineDash([1, 3]); K.ln(c, cx0, gy, cx1, gy); c.setLineDash([]);
        if (!compact) tx(c, qntFmt(hi - (hi - lo) * gq / 4, 0), ib.x + ib.w - 3, gy, f, V.mute, "right", "500");
      }
      cdl.forEach(function (d, q) {
        var xm = Math.round(cx0 + cwid * (q + 0.5)) + 0.5, col = d.c >= d.o ? EMERALD : RED, yt = yP(Math.max(d.o, d.c)), yb = yP(Math.min(d.o, d.c));
        c.strokeStyle = col; c.lineWidth = 1; K.ln(c, xm, yP(d.h), xm, yP(d.l));
        c.fillStyle = q === cdl.length - 1 ? col : K.rgba(col, 0.72); c.fillRect(Math.round(xm - bw / 2), Math.round(yt), bw, Math.max(1, Math.round(yb - yt)));
        var vv = (vh - 2) * d.v / vmax; c.fillStyle = K.rgba(col, 0.28); c.fillRect(Math.round(xm - bw / 2), Math.round(ib.y + ib.h - 3 - vv), bw, Math.round(vv));
      });
      var ly = Math.round(yP(last)) + 0.5;
      c.setLineDash([3, 3]); c.strokeStyle = V.acc2; K.ln(c, cx0, ly, cx1, ly); c.setLineDash([]);
      if (!compact) {
        c.fillStyle = pcol; K.roundRect(c, ib.x + ib.w - tagW - 1, ly - f * 0.8, tagW, f * 1.6, 2); c.fill();
        tx(c, qntFmt(last, 1), ib.x + ib.w - tagW / 2 - 1, ly, f, V.bg, "center", "700");
      }

      /* 右上：掛單階梯（上 asks 紅、下 bids 綠；條＝單價位量，淡底＝累積深度） */
      var NR = compact ? 5 : 8, lb = K.pane(c, R1, "ORDER BOOK", compact ? "" : "tick " + TICK.toFixed(1));
      K.specEdge(c, R1.x + 3, R1.y + 1, R1.w - 6);
      var bid0 = Math.floor(last / TICK) * TICK, ask0 = bid0 + TICK, mid = bid0 + TICK / 2, rh = lb.h / (NR * 2 + 1);
      var A = [], B = [], ca = 0, cb = 0, mxs = 0;
      for (var r = 0; r < NR; r++) {
        var sa = lerp(sz(base, 0, r), sz(base + 1, 0, r), ef), sb = lerp(sz(base, 1, r), sz(base + 1, 1, r), ef) * (up ? 1.12 : 0.9);
        ca += sa; cb += sb; A.push([sa, ca]); B.push([sb, cb]); mxs = Math.max(mxs, sa, sb);
      }
      var cmx = Math.max(ca, cb), barMax = lb.w * 0.55;
      function rowDraw(yy, price, s1, cum, col, isBest) {
        c.fillStyle = K.rgba(col, 0.08); c.fillRect(lb.x + 2, yy + 1, (lb.w - 4) * cum / cmx, rh - 2);
        var bwid = barMax * s1 / mxs; c.fillStyle = K.rgba(col, isBest ? 0.5 : 0.3); c.fillRect(lb.x + lb.w - 2 - bwid, yy + 1, bwid, rh - 2);
        tx(c, qntFmt(price, 1), lb.x + 5, yy + rh / 2, f, col, "left", isBest ? "700" : "500");
        if (!compact) tx(c, s1.toFixed(2), lb.x + lb.w - 5, yy + rh / 2, f, isBest ? V.ink : V.txt, "right", "600");
      }
      for (var ra = 0; ra < NR; ra++) rowDraw(lb.y + (NR - 1 - ra) * rh, ask0 + ra * TICK, A[ra][0], A[ra][1], RED, ra === 0);
      var spY = lb.y + NR * rh;
      c.fillStyle = V.card; c.fillRect(lb.x + 2, spY + 1, lb.w - 4, rh - 2);
      tx(c, compact ? qntFmt(mid, 2) : "spread " + TICK.toFixed(1) + " · mid " + qntFmt(mid, 2), lb.x + lb.w / 2, spY + rh / 2, f, V.acc2, "center", "700");
      for (var rb = 0; rb < NR; rb++) rowDraw(spY + (rb + 1) * rh, bid0 - rb * TICK, B[rb][0], B[rb][1], EMERALD, rb === 0);
      var actY = up ? lb.y + (NR - 1) * rh : spY + rh;
      K.activeHalo(c, lb.x + 2, actY + 1, lb.w - 4, rh - 2, compact ? 6 : 10);

      /* 走線：最新價 → 價差列 */
      var sY = Math.round(spY + rh / 2) + 0.5, mx = Math.round(L.x + L.w + Y.gapC / 2) + 0.5, route = [[L.x + L.w, ly], [mx, ly], [mx, sY], [R1.x, sY]];
      c.strokeStyle = V.line2; c.lineWidth = 1; c.setLineDash([2, 2]); K.orthPath(c, route, 4); c.setLineDash([]);
      K.kvPort(c, L.x + L.w, ly, true); K.kvPort(c, R1.x, sY, true);
      K.hotPacket(c, route, frac, V.acc2, compact ? 2 : 2.6);

      /* 右下：盤口鍵值列（左緣語意條＝失衡方向） */
      var imb = cb / (ca + cb), kb = K.pane(c, R2, "BOOK STATS", "");
      K.specEdge(c, R2.x + 3, R2.y + 1, R2.w - 6);
      c.fillStyle = imb >= 0.5 ? EMERALD : RED; c.fillRect(R2.x + 1, R2.y + 3, 2, R2.h - 6);
      var rows = [["mid", qntFmt(mid, 2), true], ["imbalance", "B " + qntPct(imb), true], ["spread", TICK.toFixed(1)], ["Δ win", (chg >= 0 ? "+" : "") + chg.toFixed(2) + "%"]];
      K.kvBlock(c, { x: kb.x + 3, y: kb.y, w: kb.w - 3, h: kb.h }, rows, f, R2.x);
      if (!compact) {
        tx(c, "模擬資料 · seed=20261117 · 綠買紅賣", pad, h - Y.foot / 2 - 2, f, V.mute, "left");
        tx(c, "bar " + (base + WIN), w - pad, h - Y.foot / 2 - 2, f, V.mute, "right");
      }
      return qntFmt(last, 1);
    }, o);
  }

  A23.lawCone = lawCone;
  A23.stateChain = stateChain;
  A23.depthLadder = depthLadder;

  A23.verdictStack = verdictStack;
  A23.checkTree = checkTree;
  A23.operatorMap = operatorMap;
  g.A23Charts = A23;
})(window);
