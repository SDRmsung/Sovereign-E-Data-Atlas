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

    return driver(nFrames, function (t) {
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
      c.fillStyle = "#334155";
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
        c.strokeStyle = "rgba(148, 163, 184, 0.15)";
        c.beginPath(); c.moveTo(sideW, 18); c.lineTo(sideW, h - 18); c.stroke();
        var cards = [
          ["BALLS DROPPED", String(landed), FG],
          ["LANDED GREEN %", greenPct.toFixed(1) + "%", LIME],
          ["EV/TRADE", fmtMoney(evTrade), evTrade >= 0 ? LIME : RED],
          ["NET", fmtMoney(evSum), evSum >= 0 ? LIME : RED]
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

      return "Drop " + landed;
    }, o);
  }

  A23.tailRidge = tailRidge;
  A23.galtonLattice = galtonLattice;
  g.A23Charts = A23;
})(window);
