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

  /* #53 §6.7 版（LOP 橘單色）：左 01 SPHERE 子窗＝點雲球＋頻譜環＋軌道（單色 6 階；bug 點語意紅→綠）；錨點註解＝大字膠囊（infoFont+1／小卡 +2）＋orthPath 直角引線＋kvPort；
     唯一作用錨點 activeHalo＋hotPacket（<50% auth/ BUG 語意紅；≥50% RESULT 語意綠）；右 02 SIGNALS kvBlock 6 列（作用列語意側條）；03 BAND SCAN 緯帶事件直方 develop 顯影＋峰值列；A23Tex 缺席退回 legacy */
  function loopSphere(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return loopSphereLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme(ORANGE)), V = K.V, tx = K.tx;
    var o = opt || {}, nFrames = 60, N = 3064, NBD = 12, GOLD = Math.PI * (3 - Math.sqrt(5));
    var pts = new Array(N), paying = 0, nEvt = 0, nBug = 0, band = [], bandBug = [], i, j;
    for (i = 0; i < NBD; i++) { band.push(0); bandBug.push(0); }
    for (i = 0; i < N; i++) {
      var yy = 1 - (i / (N - 1)) * 2, rr = Math.sqrt(Math.max(0, 1 - yy * yy)), th = GOLD * i, rn = 0.90 + 0.16 * K.hh(i, 101), kind = 0;
      if (i % 11 === 3 && paying < 257) { kind = 1; paying++; }
      else if (K.hh(i, 307) < 0.068) { kind = 2; nEvt++; }
      else if (K.hh(i, 409) < 0.015) { kind = 3; nBug++; }
      var bi = Math.min(NBD - 1, Math.floor((1 - yy) / 2 * NBD));
      if (kind === 2) band[bi]++;
      if (kind === 3) { band[bi]++; bandBug[bi]++; }
      pts[i] = { x: Math.cos(th) * rr * rn, y: yy * rn, z: Math.sin(th) * rr * rn, kind: kind };
    }
    var bMax = 1, pk = 0;
    for (i = 0; i < NBD; i++) { bMax = Math.max(bMax, band[i]); if (band[i] > band[pk]) pk = i; }
    var ORB = [[1.16, 0.42, -0.34, 0.5], [1.24, -0.58, 0.48, 0.36], [1.30, 0.18, 0.85, 0.26]];
    var AN = [{ t: "support/", lat: 0.44, lon: -0.60, side: -1, slot: 0.14 },
      { t: "auth/ · BUG", t2: "auth/ · PATCHED", lat: -0.46, lon: 0.14, side: 1, slot: 0.86 },
      { t: "RESULT · bug fixed", tc: "RESULT · FIXED", sub: "customer answered", lat: 0.16, lon: -0.78, side: 1, slot: 0.13 }];
    function orbitPt(ob, a, rotY, tiltX) {
      var px = Math.cos(a) * ob[0], pz = Math.sin(a) * ob[0], crx = Math.cos(ob[1]), srx = Math.sin(ob[1]), crz = Math.cos(ob[2]), srz = Math.sin(ob[2]);
      var y1 = -pz * srx, z1 = pz * crx;
      return rotPoint(px * crz - y1 * srz, px * srz + y1 * crz, z1, rotY, tiltX);
    }
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      var u = clamp(t / (nFrames - 1), 0, 1), f = K.infoFont(w), fl = compact ? f + 2 : f + 1, pad = compact ? 6 : 10, gap = compact ? 5 : 8;
      var fixed = u >= 0.5, day = Math.round(lerp(1, 124, u));
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, compact ? "LOP 01 · SPHERE" : "LOP 01 · TELEMETRY SPHERE × ORBIT NOTES", w * 0.62, f + 1, "700"), pad, 10, f + 1, V.ink, "left", "700");
      tx(c, fixed ? "PATCH VERIFIED" : "SCANNING · D" + day, w - pad, 10, f, fixed ? GREEN : V.acc2, "right", "700");
      var top = compact ? 18 : 22, bh = h - top - pad, lw = Math.round((w - pad * 2 - gap) * (compact ? 0.6 : 0.63));
      var S = { x: pad, y: top, w: lw, h: bh }, rx = pad + lw + gap, rw = w - pad - rx;
      var rowKV = f + Math.max(5, Math.round(f * 0.8)), P2 = { x: rx, y: top, w: rw, h: rowKV * 6 + 17 };
      var P3 = { x: rx, y: top + P2.h + gap, w: rw, h: bh - P2.h - gap };
      /* 01 SPHERE */
      var is = K.pane(c, S, "01 SPHERE", "3D TELEMETRY");
      K.specEdge(c, S.x + 4, S.y + 1, S.w - 8);
      var cx = is.x + is.w * (compact ? 0.5 : 0.6), cy = is.y + is.h * 0.53, R = Math.min(is.w * (compact ? 0.27 : 0.255), is.h * 0.33);
      var rotY = -0.45 + u * 1.45, tiltX = 0.24;
      c.save(); c.beginPath(); c.rect(is.x, is.y, is.w, is.h); c.clip();
      var gl = c.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.35);
      gl.addColorStop(0, K.rgba(V.acc, 0.09)); gl.addColorStop(1, K.rgba(V.acc, 0));
      c.fillStyle = gl; c.beginPath(); c.arc(cx, cy, R * 1.35, 0, Math.PI * 2); c.fill();
      var nSp = compact ? 120 : 200, r0 = R * 1.05, mS = R * 0.22, sk;
      c.lineWidth = compact ? 0.9 : 1.1;
      for (sk = 0; sk < nSp; sk++) {
        var ang = sk / nSp * Math.PI * 2, ev = 0.45 + 0.55 * Math.abs(Math.sin(ang * 3 + t * 0.22 + K.hh(sk, 607) * 2.5));
        var it = clamp(K.hh(sk, 601) * ev * (0.65 + 0.35 * Math.sin(t * 0.35 + sk * 0.28)), 0.08, 1), ro = r0 + it * mS;
        c.strokeStyle = it > 0.78 ? V.acc3 : (it > 0.55 ? V.acc : V.line2);
        K.ln(c, cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0, cx + Math.cos(ang) * ro, cy + Math.sin(ang) * ro);
      }
      function orbits(front) {
        for (var oi = 0; oi < ORB.length; oi++) {
          var ob = ORB[oi], dr = false;
          c.strokeStyle = front ? K.rgba(V.acc2, ob[3]) : V.line; c.lineWidth = front ? 1.1 : 0.75; c.beginPath();
          for (var si = 0; si <= 84; si++) {
            var p = orbitPt(ob, si / 84 * Math.PI * 2, rotY, tiltX), sx = cx + p.x * R, sy = cy - p.y * R;
            if ((p.z >= 0) === front) { if (!dr) { c.moveTo(sx, sy); dr = true; } else c.lineTo(sx, sy); } else dr = false;
          }
          c.stroke();
          if (front) {
            var np = orbitPt(ob, (u * Math.PI * 2 + oi * 2.1) % (Math.PI * 2), rotY, tiltX);
            if (np.z >= 0) { c.fillStyle = V.acc3; c.beginPath(); c.arc(cx + np.x * R, cy - np.y * R, compact ? 2 : 2.6, 0, Math.PI * 2); c.fill(); }
          }
        }
      }
      orbits(false);
      var proj = new Array(N), colK = [V.txt, V.acc, V.acc2, fixed ? GREEN : RED], szK = [1.15, 1.75, 1.55, 1.9];
      for (i = 0; i < N; i++) proj[i] = rotPoint(pts[i].x, pts[i].y, pts[i].z, rotY, tiltX);
      for (var pass = 0; pass < 2; pass++) for (i = 0; i < N; i++) {
        var rp = proj[i], kd = pts[i].kind, fr = rp.z >= 0;
        if (fr !== (pass === 1)) continue;
        var px2 = cx + rp.x * R, py2 = cy - rp.y * R;
        if (!fr) { c.globalAlpha = clamp(0.12 + (rp.z + 1) * 0.14, 0.08, 0.28) * (kd ? 1.2 : 1); c.fillStyle = kd ? colK[kd] : V.dim; c.fillRect(px2 - 0.6, py2 - 0.6, 1.2, 1.2); }
        else { var zz = szK[kd] * (compact ? 0.88 : 1); c.globalAlpha = clamp(0.45 + rp.z * 0.55, 0.4, 1) * (kd ? 1 : 0.85); c.fillStyle = colK[kd]; c.fillRect(px2 - zz / 2, py2 - zz / 2, zz, zz); }
      }
      c.globalAlpha = 1;
      orbits(true);
      c.restore();
      tx(c, "DAY " + day + "/124 · " + (N * 4).toLocaleString("en-US") + " PTS", is.x + 4, S.y + S.h - f * 0.7 - 3, f, V.dim, "left", "600");
      /* 特徵數值條 → 貝茲扇入球體（桌面）：線寬∝值；作用列 auth err 語意紅→綠＋熱封包 */
      if (!compact) {
        var FT = [["latency", 0.72], ["retries", 0.41], ["tickets", 0.86], ["churn", 0.28], ["auth err", fixed ? 0.08 : 0.64], ["nps", 0.55]];
        var fx0 = is.x + 6, fw = Math.max(Math.round(is.w * 0.2), Math.round(f * 8.4)), fy0 = is.y + is.h * 0.30, fy1 = S.y + S.h - f * 1.6 - 6, frh = (fy1 - fy0) / FT.length;
        tx(c, "FEATURES", fx0, fy0 - f * 0.6, f, V.dim, "left", "700");
        for (var fi = 0; fi < FT.length; fi++) {
          var fv = clamp(FT[fi][1] * (0.35 + 0.65 * Math.min(1, u * 2)) + 0.03 * Math.sin(t * 0.3 + fi), 0.02, 1), fA = fi === 4;
          var fcol = fA ? (fixed ? GREEN : RED) : V.acc, ly0 = fy0 + fi * frh, bhh = Math.max(3, Math.round(frh * 0.26)), byy = Math.round(ly0 + f + 3);
          tx(c, FT[fi][0], fx0, ly0 + f * 0.5 + 1, f, fA ? fcol : V.txt, "left", "600");
          tx(c, fv.toFixed(2), fx0 + fw, ly0 + f * 0.5 + 1, f, fA ? fcol : V.dim, "right", "700");
          c.fillStyle = V.track; c.fillRect(fx0, byy, fw, bhh);
          c.fillStyle = fA ? fcol : K.rgba(V.acc, 0.45 + 0.5 * fv); c.fillRect(fx0, byy, Math.max(2, fw * fv), bhh);
          var ba = Math.PI * (0.84 + 0.32 * fi / (FT.length - 1)), sx0 = fx0 + fw + 3, sy0 = byy + bhh / 2;
          var ex = cx + Math.cos(ba) * R * 0.96, ey2 = cy + Math.sin(ba) * R * 0.96, mx0 = sx0 + (ex - sx0) * 0.5, bz = [];
          for (var bs = 0; bs <= 12; bs++) {
            var q = bs / 12, q1 = 1 - q;
            bz.push([q1 * q1 * q1 * sx0 + 3 * q1 * q1 * q * mx0 + 3 * q1 * q * q * mx0 + q * q * q * ex, q1 * q1 * q1 * sy0 + 3 * q1 * q1 * q * sy0 + 3 * q1 * q * q * ey2 + q * q * q * ey2]);
          }
          c.strokeStyle = fA ? fcol : K.rgba(V.acc, 0.18 + 0.45 * fv); c.lineWidth = 0.6 + fv * 2;
          c.beginPath(); c.moveTo(sx0, sy0); c.bezierCurveTo(mx0, sy0, mx0, ey2, ex, ey2); c.stroke();
          K.kvPort(c, sx0, sy0, fA);
          if (fA) K.hotPacket(c, bz, (u * 3 + 0.4) % 1, fcol, 2.4);
        }
      }
      /* 錨點註解：大字膠囊＋直角引線＋埠點；唯一作用錨點光暈＋熱封包 */
      var act = fixed ? 2 : 1;
      for (var ai = 0; ai < AN.length; ai++) {
        var an = AN[ai];
        if (ai === 2 && !fixed) continue;
        var xyz = sphereXYZ(an.lat, an.lon), ap = rotPoint(xyz.x, xyz.y, xyz.z, rotY, tiltX), ax = cx + ap.x * R, ay = cy - ap.y * R;
        var lab = ai === 1 && fixed ? an.t2 : (compact && an.tc ? an.tc : an.t), two = !!an.sub && !compact, isA = ai === act;
        c.font = "700 " + fl + "px " + K.MONO;
        var cw = Math.min(is.w * 0.62, c.measureText(lab).width + 14), chH = two ? fl + f + 12 : fl + 8;
        var chX = an.side < 0 ? is.x + 6 : is.x + is.w - cw - 6, chY = clamp(is.y + is.h * an.slot - chH / 2, is.y + 4, is.y + is.h - chH - 4);
        var edge = an.side < 0 ? chX + cw : chX, ey = chY + chH / 2, mx = (ax + edge) / 2;
        var col = ai === 1 ? (fixed ? V.line2 : RED) : (ai === 2 ? GREEN : V.line2), path = [[ax, ay], [mx, ay], [mx, ey], [edge, ey]];
        c.strokeStyle = isA ? col : V.lead; c.lineWidth = isA ? 1.2 : 1;
        if (!isA) c.setLineDash([2, 2]);
        K.orthPath(c, path, 4); c.setLineDash([]);
        c.fillStyle = ap.z >= 0 ? (isA ? col : V.acc2) : V.mute; c.beginPath(); c.arc(ax, ay, isA ? 3.2 : 2.6, 0, Math.PI * 2); c.fill();
        if (isA) { K.activeHalo(c, chX, chY, cw, chH, compact ? 6 : 12); K.hotPacket(c, path, (u * 3) % 1, col, compact ? 2 : 2.6); }
        c.fillStyle = V.card; K.roundRect(c, chX, chY, cw, chH, 3); c.fill();
        c.strokeStyle = isA ? col : V.line2; c.lineWidth = 1; K.roundRect(c, chX + 0.5, chY + 0.5, cw - 1, chH - 1, 3); c.stroke();
        K.specEdge(c, chX + 3, chY + 1, cw - 6);
        K.kvPort(c, edge, ey, isA);
        tx(c, K.fitM(c, lab, cw - 12, fl, "700"), chX + 7, two ? chY + fl / 2 + 5 : ey, fl, isA ? col : V.ink, "left", "700");
        if (two) tx(c, K.fitM(c, an.sub, cw - 12, f, "600"), chX + 7, chY + fl + f / 2 + 8, f, V.txt, "left", "600");
      }
      /* 02 SIGNALS：6 列鍵值；作用列＝bugs open（修前）／state（修後），語意側條 */
      var i2 = K.pane(c, P2, "02 SIGNALS", fixed ? "VERIFIED" : "LIVE"), litR = fixed ? 5 : 3;
      K.kvBlock(c, { x: i2.x + 2, y: i2.y, w: i2.w - 4, h: i2.h }, [["points", (N * 4).toLocaleString("en-US")], ["paying", String(paying)],
        ["events", String(nEvt * 4)], ["bugs open", String(fixed ? 0 : nBug), !fixed], ["day", day + "/124"], ["state", fixed ? "VERIFIED" : "SCANNING", fixed]], f, P2.x);
      var ly = Math.round(i2.y + rowKV * (litR + 0.6));
      c.fillStyle = fixed ? GREEN : RED; c.fillRect(P2.x + 3, ly - f / 2 - 1, 2, f + 2);
      /* 03 BAND SCAN：緯帶事件直方顯影；bug 段語意紅→綠；當前掃描帶框 */
      var i3 = K.pane(c, P3, "03 BAND SCAN", "EVT / LAT"), foot = rowKV + 4;
      var bb = { x: i3.x + 3, y: i3.y + 2, w: i3.w - 6, h: i3.h - foot - 6 };
      if (bb.h > 14) {
        K.pane(c, bb);
        var g3 = { x: bb.x + 4, y: bb.y + 4, w: bb.w - 8, h: bb.h - 8 }, rh = g3.h / NBD, cur = Math.min(NBD - 1, Math.floor(u * NBD));
        K.develop(c, g3, compact ? 1 : clamp(0.2 + u * 1.3, 0, 1), function (cc, cl) {
          for (var jj = 0; jj < NBD; jj++) { cc.fillStyle = cl; cc.fillRect(g3.x, g3.y + jj * rh + rh * 0.2, Math.max(2, band[jj] / bMax * g3.w), Math.max(1.5, rh * 0.6)); }
        });
        for (j = 0; j < NBD; j++) if (bandBug[j]) { c.fillStyle = fixed ? GREEN : RED; c.fillRect(g3.x, g3.y + j * rh + rh * 0.2, Math.max(2, bandBug[j] / bMax * g3.w), Math.max(1.5, rh * 0.6)); }
        c.strokeStyle = V.acc3; c.lineWidth = 1; c.strokeRect(g3.x - 1.5, g3.y + cur * rh + 0.5, g3.w + 3, Math.max(1, rh - 1));
      }
      c.strokeStyle = V.line; K.ln(c, i3.x + 4, i3.y + i3.h - foot - 1.5, i3.x + i3.w - 4, i3.y + i3.h - foot - 1.5);
      K.kvBlock(c, { x: i3.x + 2, y: i3.y + i3.h - foot, w: i3.w - 4, h: foot }, [["peak band", "B" + (pk < 9 ? "0" : "") + (pk + 1) + " · " + band[pk] * 4]], f, P3.x);
      return "Day " + day + "/124";
    }, o);
  }

  /* #53 legacy（A23Tex 缺席時用） loopSphere — 點雲球＋軌道環＋引線註解 (driver n=60) */
  function loopSphereLegacy(cv, _data, opt) {
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

  /* #55 §6.7 版（LOP 橘單色）：三欄 pane＋列埠點；收件匣（標籤 chip···狀態／訊息）；決策日誌虛點引導列（rule＝語意紅框）；
     產品差異 BEFORE→AFTER 程式碼插畫顯影＋紅綠語意差異列；欄間虛點因果走線＋熱封包；A23Tex 缺席退回 legacy */
  function signalDecisionDiff(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return signalDecisionDiffLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme(ORANGE)), V = K.V, tx = K.tx;
    var o = opt || {}, nFrames = 60;
    var INBOX = [
      { tag: "support", txt: "auth callback 401 on mobile", st: "done" },
      { tag: "bug", txt: "token refresh race in Safari", st: "done" },
      { tag: "search", txt: "query: cli gateway webhook", st: "live" },
      { tag: "stripe", txt: "checkout +1 paying seat", st: "done" },
      { tag: "support", txt: "webhook timeout on retry", st: "live" },
      { tag: "bug", txt: "trial day counter off by 1", st: "live" }
    ];
    var DECISIONS = [
      { txt: "cluster 14 support hits -> auth", rule: false },
      { txt: "prioritize PKCE state fix (P0)", rule: false },
      { txt: "launch $50 ad test · cli devs", rule: false },
      { txt: "rule: stop at 3 qualified signups", rule: true },
      { txt: "patch auth/callback.ts + test", rule: false },
      { txt: "reply customer + measure MRR", rule: false }
    ];
    var DIFFS = [
      { op: "-", txt: "sid = req.cookies.get('sid')", sel: false },
      { op: "+", txt: "sid = verifyPkceState(req)", sel: false },
      { op: "-", txt: "retries = 0 // silent 401", sel: false },
      { op: "+", txt: "retries = 3 // exp backoff", sel: true },
      { op: "-", txt: "return status(401, 'expired')", sel: false },
      { op: "+", txt: "return refreshSession(uid)", sel: false },
      { op: "+", txt: "notifyCustomer(tid, 'fixed')", sel: false },
      { op: "+", txt: "emitMetric('bug_measured', 1)", sel: false }
    ];
    var TAGC = { support: V.acc, bug: RED, search: V.acc3, stripe: V.acc2 };
    /* 程式碼插畫：縮排行條；變更行顯影後上語意紅（before）／綠（after）底與 gutter */
    function codeArt(c, b, after, col, lit) {
      var n = Math.max(3, Math.min(8, Math.floor(b.h / 6))), lh = b.h / n;
      for (var i = 0; i < n; i++) {
        var y = Math.round(b.y + lh * (i + 0.5)) + 0.5, ind = K.hh(i, 41) < 0.35 ? 6 : 0, ch = K.hh(i, 51) < 0.4;
        var lw = Math.max(4, (b.w - 10 - ind) * (0.35 + 0.6 * K.hh(i, after ? 43 : 47))), sc = after ? GREEN : RED, cc = lit && ch ? sc : col;
        if (lit && ch) { c.fillStyle = K.rgba(sc, 0.12); c.fillRect(b.x, y - lh * 0.42, b.w, lh * 0.84); }
        c.fillStyle = cc;
        if (ch) { c.fillRect(b.x + 1, y - 0.5, 3, 1); if (after) c.fillRect(b.x + 2, y - 1.5, 1, 3); }
        c.fillRect(b.x + 7 + ind, y - (ch ? 1 : 0.5), lw, ch ? 2 : 1.5);
      }
    }
    function win(c, b) {
      c.fillStyle = V.bg; c.fillRect(b.x, b.y, b.w, b.h);
      c.strokeStyle = V.line2; c.lineWidth = 1; c.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      K.dotGrid(c, b.x, b.y, b.w, b.h, 7, V.dot2);
    }
    /* 雙色引導列：key 左、value 右、中間虛點 */
    function lead2(c, k, v, xk, xv, y, fz, kc, vc) {
      tx(c, k, xk, y, fz, kc, "left", "600"); c.font = "600 " + fz + "px " + K.MONO; var kw = c.measureText(k).width;
      tx(c, v, xv, y, fz, vc, "right", "700"); c.font = "700 " + fz + "px " + K.MONO; var vw = c.measureText(v).width;
      if (xv - vw - 3 > xk + kw + 3) { c.setLineDash([1, 2]); c.strokeStyle = V.lead; c.lineWidth = 1; K.ln(c, xk + kw + 3, Math.round(y) + 0.5, xv - vw - 3, Math.round(y) + 0.5); c.setLineDash([]); }
    }
    function actBar(c, ib, ry, rh) { c.fillStyle = V.track; c.fillRect(ib.x + 2, ry - rh * 0.42, ib.w - 4, rh * 0.84); c.fillStyle = V.acc; c.fillRect(ib.x + 2, ry - rh * 0.42, 2, rh * 0.84); }
    function ghost(c, ib, ry, k) { c.fillStyle = V.track; c.fillRect(ib.x + 10, ry - 1, (ib.w - 24) * (0.3 + 0.4 * K.hh(k, 17)), 2); }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      var u = clamp(t / (nFrames - 1), 0, 1), f = K.infoFont(w), fs = compact ? f : Math.max(9, f - 1);
      var pad = compact ? 8 : 10, gap = compact ? 6 : 8;
      var visInbox = Math.min(INBOX.length, 1 + Math.floor(u * 9.5));
      var visDec = clamp(Math.floor((u - 0.08) * 10.0), 0, DECISIONS.length);
      var visDiff = clamp(Math.floor((u - 0.16) * 11.8), 0, DIFFS.length);
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, compact ? "SIGNAL → DECISION → DIFF" : "CAUSAL LOGS · SIGNAL → DECISION → PRODUCT DIFF", w * (compact ? 0.56 : 0.66), f + 1, "700"), pad, 11, f + 1, V.ink, "left", "700");
      tx(c, "INBOX " + visInbox + "/6 · DIFF " + visDiff + "/8", w - pad, 11, f - 1, V.acc2, "right", "700");
      var bodyY = 20, bodyH = h - bodyY - 8, P = [], k;
      if (!compact) { var pw = Math.floor((w - pad * 2 - gap * 2) / 3); for (k = 0; k < 3; k++) P.push({ x: pad + k * (pw + gap), y: bodyY, w: pw, h: bodyH }); }
      else { var phh = Math.floor((bodyH - gap * 2) / 3); for (k = 0; k < 3; k++) P.push({ x: pad, y: bodyY + k * (phh + gap), w: w - pad * 2, h: phh }); }

      /* 01 SIGNAL INBOX */
      var p1 = P[0], i1 = K.pane(c, p1, "01 SIGNAL INBOX", visInbox + "/6");
      K.specEdge(c, p1.x + 3, p1.y + 1, p1.w - 6);
      var sl1 = compact ? 3 : 6, s1 = compact ? Math.max(0, visInbox - 3) : 0, rh1 = i1.h / sl1, y1 = i1.y + i1.h / 2;
      for (k = 0; k < sl1; k++) {
        var x1 = s1 + k, r1 = Math.round(i1.y + rh1 * (k + 0.5));
        if (x1 >= visInbox) { ghost(c, i1, r1, x1); K.kvPort(c, p1.x, r1, false); continue; }
        var it1 = INBOX[x1], a1 = x1 === visInbox - 1, tc = TAGC[it1.tag] || V.acc, stc = it1.st === "done" ? GREEN : V.acc2;
        if (a1) { y1 = r1; actBar(c, i1, r1, rh1); }
        c.font = "700 " + (fs - 1) + "px " + K.MONO;
        var cw = c.measureText(it1.tag).width + 10, chH = Math.min(rh1 * (compact ? 0.78 : 0.4), fs + 5), cx = i1.x + 8, cy = compact ? r1 : r1 - rh1 * 0.2;
        c.fillStyle = K.rgba(tc, 0.12); K.roundRect(c, cx, cy - chH / 2, cw, chH, 3); c.fill();
        c.strokeStyle = K.rgba(tc, 0.6); c.lineWidth = 1; K.roundRect(c, cx + 0.5, cy - chH / 2 + 0.5, cw - 1, chH - 1, 3); c.stroke();
        tx(c, it1.tag, cx + 5, cy, fs - 1, tc, "left", "700");
        if (compact) lead2(c, K.fitM(c, it1.txt, i1.w - cw - 48, fs, "600"), it1.st, cx + cw + 6, i1.x + i1.w - 5, r1, fs, a1 ? V.ink : V.txt, stc);
        else {
          lead2(c, "", it1.st, cx + cw + 1, i1.x + i1.w - 5, cy, fs, V.dim, stc);
          tx(c, K.fitM(c, it1.txt, i1.w - 18, fs, "600"), cx + 2, r1 + rh1 * 0.2, fs, a1 ? V.ink : V.txt, "left", "600");
        }
        K.kvPort(c, p1.x, r1, a1);
      }

      /* 02 DECISION LOG：虛點引導列（桌面兩行：決策／來源···編號） */
      var p2 = P[1], i2 = K.pane(c, p2, "02 DECISION LOG", visDec + "/6");
      K.specEdge(c, p2.x + 3, p2.y + 1, p2.w - 6);
      var sl2 = compact ? 3 : 6, s2 = compact ? Math.max(0, visDec - 3) : 0, rh2 = i2.h / sl2, y2 = i2.y + i2.h / 2;
      for (k = 0; k < sl2; k++) {
        var x2 = s2 + k, r2 = Math.round(i2.y + rh2 * (k + 0.5));
        if (x2 >= visDec) { ghost(c, i2, r2, x2 + 9); K.kvPort(c, p2.x, r2, false); continue; }
        var it2 = DECISIONS[x2], a2 = x2 === visDec - 1, id = it2.rule ? "RULE" : "d" + ("0" + (x2 + 1)).slice(-2);
        if (a2) { y2 = r2; actBar(c, i2, r2, rh2); }
        if (it2.rule) {
          c.fillStyle = K.rgba(RED, 0.08); K.roundRect(c, i2.x + 4, r2 - rh2 * 0.38, i2.w - 8, rh2 * 0.76, 3); c.fill();
          c.strokeStyle = K.rgba(RED, 0.7); c.lineWidth = 1; K.roundRect(c, i2.x + 4.5, r2 - rh2 * 0.38 + 0.5, i2.w - 9, rh2 * 0.76 - 1, 3); c.stroke();
        }
        if (compact) lead2(c, K.fitM(c, it2.txt, i2.w - 48, fs, "600"), id, i2.x + 9, i2.x + i2.w - 7, r2, fs, a2 ? V.ink : V.txt, it2.rule ? RED : (a2 ? V.ink : V.dim));
        else {
          tx(c, K.fitM(c, it2.txt, i2.w - 20, fs, "600"), i2.x + 9, r2 - rh2 * 0.17, fs, it2.rule ? V.ink : (a2 ? V.ink : V.txt), "left", "600");
          lead2(c, "← s" + ("0" + (x2 + 1)).slice(-2), id, i2.x + 9, i2.x + i2.w - 7, r2 + rh2 * 0.2, fs, V.dim, it2.rule ? RED : (a2 ? V.ink : V.dim));
        }
        K.kvPort(c, p2.x, r2, a2);
      }

      /* 03 PRODUCT DIFF：BEFORE→AFTER 插畫預覽＋差異列 */
      var p3 = P[2], shipped = visDiff >= DIFFS.length, i3 = K.pane(c, p3, "03 PRODUCT DIFF", shipped ? "shipped" : "patching");
      K.specEdge(c, p3.x + 3, p3.y + 1, p3.w - 6);
      var pv, lb;
      if (!compact) { var pvH = Math.round(i3.h * 0.3); pv = { x: i3.x + 2, y: i3.y + 1, w: i3.w - 4, h: pvH }; lb = { x: i3.x, y: i3.y + pvH + 6, w: i3.w, h: i3.h - pvH - 6 }; }
      else { var pvW = Math.round(i3.w * 0.36); pv = { x: i3.x + i3.w - pvW - 1, y: i3.y + 1, w: pvW, h: i3.h - 2 }; lb = { x: i3.x, y: i3.y, w: i3.w - pvW - 6, h: i3.h }; }
      var half = Math.floor((pv.w - 14) / 2), bb = { x: pv.x, y: pv.y, w: half, h: pv.h }, ab = { x: pv.x + pv.w - half, y: pv.y, w: half, h: pv.h };
      win(c, bb); win(c, ab);
      var ibb = { x: bb.x + 3, y: bb.y + 3, w: bb.w - 6, h: bb.h - 6 }, iab = { x: ab.x + 3, y: ab.y + 3, w: ab.w - 6, h: ab.h - 6 };
      codeArt(c, ibb, false, V.dim, true);
      K.develop(c, iab, clamp((u - 0.16) * 11.8 / DIFFS.length, 0, 1), function (cc, col, lit) { codeArt(cc, iab, true, col, lit); });
      var amy = Math.round(pv.y + pv.h / 2) + 0.5, ax0 = bb.x + bb.w + 3, ax1 = ab.x - 3;
      c.strokeStyle = V.acc2; c.lineWidth = 1; K.ln(c, ax0, amy, ax1, amy);
      c.beginPath(); c.moveTo(ax1 - 3, amy - 2.5); c.lineTo(ax1, amy); c.lineTo(ax1 - 3, amy + 2.5); c.stroke();
      if (shipped) K.activeHalo(c, ab.x, ab.y, ab.w, ab.h, compact ? 4 : 8);
      var sl3 = compact ? 3 : 8, s3 = compact ? Math.max(0, visDiff - 3) : 0, rh3 = lb.h / sl3, y3 = lb.y + lb.h / 2;
      for (k = 0; k < sl3; k++) {
        var x3 = s3 + k, r3 = Math.round(lb.y + rh3 * (k + 0.5));
        if (x3 >= visDiff) { ghost(c, lb, r3, x3 + 21); K.kvPort(c, p3.x, r3, false); continue; }
        var it3 = DIFFS[x3], a3 = x3 === visDiff - 1, sc3 = it3.op === "+" ? GREEN : RED;
        if (a3) y3 = r3;
        c.fillStyle = K.rgba(sc3, it3.sel ? 0.14 : 0.06); K.roundRect(c, lb.x + 2, r3 - rh3 * 0.42, lb.w - 4, rh3 * 0.84, 3); c.fill();
        if (it3.sel) { c.strokeStyle = K.rgba(GREEN, 0.65); c.lineWidth = 1; K.roundRect(c, lb.x + 2.5, r3 - rh3 * 0.42 + 0.5, lb.w - 5, rh3 * 0.84 - 1, 3); c.stroke(); }
        if (a3) { c.fillStyle = V.acc; c.fillRect(lb.x + 2, r3 - rh3 * 0.42, 2, rh3 * 0.84); }
        tx(c, it3.op === "-" ? "−" : "+", lb.x + 8, r3, fs, sc3, "left", "700");
        tx(c, K.fitM(c, it3.txt, lb.w - 24, fs, "600"), lb.x + 17, r3, fs, a3 || it3.sel ? V.ink : V.txt, "left", it3.sel ? "700" : "600");
        K.kvPort(c, p3.x, r3, a3);
      }

      /* 欄間虛點因果走線：最新收件 → 最新決策 → 最新差異 */
      function link(a, ya, b, yb, on, fr) {
        var pts;
        if (!compact) { var mx = a.x + a.w + gap / 2; ya = Math.round(ya) + 0.5; yb = Math.round(yb) + 0.5; pts = [[a.x + a.w, ya], [mx, ya], [mx, yb], [b.x, yb]]; }
        else { var X = Math.round(a.x + a.w - 14) + 0.5; pts = [[X, a.y + a.h], [X, b.y]]; }
        c.setLineDash([1, 2]); c.strokeStyle = on ? V.acc2 : V.line2; c.lineWidth = 1; K.orthPath(c, pts, 2); c.setLineDash([]);
        if (!compact) { K.kvPort(c, a.x + a.w, ya, on); K.kvPort(c, b.x, yb, on); }
        if (on && u < 0.98) K.hotPacket(c, pts, fr, V.acc2, compact ? 1.8 : 2.4);
      }
      link(p1, y1, p2, y2, visDec > 0, (t % 5) / 5);
      link(p2, y2, p3, y3, visDiff > 0, ((t + 2.5) % 5) / 5);

      return "Inbox " + visInbox + "/6 · Diff " + visDiff + "/8";
    }, o);
  }

  /* #55 legacy（A23Tex 缺席時用） signalDecisionDiff — 收件匣／決策日誌／產品差異三欄 (driver n=60) */
  function signalDecisionDiffLegacy(cv, _data, opt) {
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
    var TX = g.A23Tex;
    if (!TX) return guardrailFunnelLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme(ORANGE)), V = K.V, tx = K.tx;
    if (_data && Array.isArray(_data.funnels)) {
      var funnels = _data.funnels;
      var maxRetry = Number(_data.max_retry != null ? _data.max_retry : 2);
      var passCnt = 0, retryCnt = 0, stoppedCnt = 0;
      for (var fi = 0; fi < funnels.length; fi++) {
        var ff = funnels[fi];
        if (ff.outcome === "PASS") passCnt++;
        if (ff.stopped) stoppedCnt++;
        for (var ri = 0; ri < (ff.rounds || []).length; ri++) {
          if (ff.rounds[ri].verdict === "RETRY") retryCnt++;
        }
      }
      return driver(48, function (t) {
        var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 480;
        var u = clamp(t / 47, 0, 1), f = K.infoFont(w), pad = compact ? 6 : 10, gap = compact ? 5 : 8;
        var pulse = 0.55 + 0.45 * Math.sin(u * Math.PI * 2);
        c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
        K.dotGrid(c, 0, 0, w, h, 8, V.dot);
        var narrow = w < 900, rHdr = (stoppedCnt > 0 ? "STOPPED " + stoppedCnt : "OK") + " · MAX RETRY " + maxRetry;
        tx(c, K.fitM(c, compact ? "GUARDRAIL FUNNEL" : (_data.title || "LOP 04 · TRI-ROLE GUARDRAIL FUNNEL"), w * (narrow ? 0.54 : 0.62), f + 1, "700"), pad, 11, f + 1, V.ink, "left", "700");
        tx(c, narrow ? K.fitM(c, rHdr, w * 0.42, f - 1, "700") : rHdr, w - pad - (narrow ? 6 : 0), 11, f - 1, stoppedCnt > 0 ? RED : GREEN, "right", "700");
        var KP = [
          ["TASKS", String(funnels.length), false, V.ink],
          ["PASS", String(passCnt), false, GREEN],
          ["RETRY", String(retryCnt), false, ORANGE],
          ["STOPPED", String(stoppedCnt), stoppedCnt > 0, stoppedCnt > 0 ? RED : V.dim]
        ];
        var kCols = compact ? 2 : 4, kRows = compact ? 2 : 1, kH = f * 2 + (compact ? 7 : 10), kTop = 20;
        var kW = (w - pad * 2 - gap * (kCols - 1)) / kCols;
        for (var ki = 0; ki < KP.length; ki++) {
          var kx = pad + (ki % kCols) * (kW + gap), ky = kTop + Math.floor(ki / kCols) * (kH + gap * 0.6);
          K.pane(c, { x: kx, y: ky, w: kW, h: kH }); K.specEdge(c, kx + 3, ky + 1, kW - 6);
          if (KP[ki][2]) { c.fillStyle = RED; c.fillRect(kx + 1, ky + 3, 2, kH - 6); }
          tx(c, KP[ki][0], kx + 6, ky + kH * 0.32, f - 1, V.dim, "left", "600");
          tx(c, KP[ki][1], kx + 6, ky + kH * 0.72, f + 1, KP[ki][3], "left", "700");
        }
        var bTop = kTop + kRows * kH + (kRows - 1) * gap * 0.6 + gap;
        var B = { x: pad, y: bTop, w: w - pad * 2, h: Math.max(40, h - bTop - pad) };
        var ib = K.pane(c, B, "VERDICT FUNNEL", "MAX RETRY " + maxRetry);
        if (!funnels.length) {
          tx(c, "尚無審查紀錄", ib.x + ib.w / 2, ib.y + ib.h / 2, f + 1, V.dim, "center", "600");
          return "EMPTY";
        }
        var rowH = ib.h / funnels.length;
        c.font = "700 " + f + "px " + K.MONO;
        var idW = Math.min(72, Math.max(46, c.measureText("TR-000").width + 12));
        for (var i = 0; i < funnels.length; i++) {
          var row = funnels[i], ry = ib.y + i * rowH, my = ry + rowH / 2, isSel = _data.selectedId && row.task_id === _data.selectedId;
          if (i > 0) { c.strokeStyle = V.line; K.ln(c, ib.x + 2, ry, ib.x + ib.w - 2, ry); }
          if (isSel) K.activeHalo(c, ib.x + 2, ry + 2, ib.w - 4, rowH - 4, 6);
          var idCol = isSel ? V.acc3 : (row.stopped ? RED : (row.outcome === "PASS" ? GREEN : ORANGE));
          tx(c, row.task_id, ib.x + 6, my, f, idCol, "left", "700");
          var cx = ib.x + 6 + idW, maxX = ib.x + ib.w - 6;
          var rds = row.rounds || [];
          if (!rds.length) {
            tx(c, "尚無審查紀錄", cx, my, f, V.dim, "left", "600");
            continue;
          }
          var steps = [];
          for (var j = 0; j < rds.length; j++) {
            var vd = String(rds[j].verdict || "").toUpperCase();
            var col = vd === "PASS" ? GREEN : (vd === "ESCALATE" ? RED : ORANGE);
            steps.push({ label: "r" + rds[j].round + " " + vd, col: col, fill: vd === "ESCALATE" ? 0.2 : 0.12 });
          }
          if (row.stopped) {
            steps.push({ label: "熔斷 STOPPED", col: RED, fill: 0.24 + 0.1 * pulse, bold: true });
            steps.push({ label: "轉人工", col: RED, fill: 0.14 });
          } else if (row.outcome === "ESCALATE") {
            steps.push({ label: "轉人工", col: RED, fill: 0.16 });
          } else if (row.outcome === "PASS") {
            steps.push({ label: "PASS 出口", col: GREEN, fill: 0.22 });
          } else {
            steps.push({ label: "尚無出口", col: V.dim, fill: 0.06, muted: true });
          }
          var pillH = Math.min(rowH - 6, f + 10), arrW = compact ? 10 : 14;
          c.font = "700 " + (f - 0.5) + "px " + K.MONO;
          var totalNeed = 0;
          for (var si = 0; si < steps.length; si++) {
            steps[si].w = Math.ceil(c.measureText(steps[si].label).width) + (compact ? 10 : 14);
            totalNeed += steps[si].w + (si > 0 ? arrW : 0);
          }
          var avail = Math.max(40, maxX - cx), scale = totalNeed > avail ? avail / totalNeed : 1;
          for (var sk = 0; sk < steps.length; sk++) {
            if (sk > 0) {
              var ax1 = cx + 2, ax2 = cx + arrW * scale - 2;
              c.strokeStyle = steps[sk].muted ? V.mute : steps[sk].col; c.lineWidth = 1.2;
              K.ln(c, ax1, my, ax2, my);
              cx += arrW * scale;
            }
            var stp = steps[sk], pw = Math.max(24, stp.w * scale);
            c.fillStyle = stp.muted ? V.track : K.rgba(stp.col, stp.fill);
            K.roundRect(c, cx, my - pillH / 2, pw, pillH, 4); c.fill();
            c.strokeStyle = stp.muted ? V.line : K.rgba(stp.col, stp.bold ? 0.9 : 0.6); c.lineWidth = stp.bold ? 1.4 : 1;
            K.roundRect(c, cx, my - pillH / 2, pw, pillH, 4); c.stroke();
            tx(c, K.fitM(c, stp.label, pw - 6, f - 0.5, "700"), cx + pw / 2, my, f - 0.5, stp.col, "center", "700");
            cx += pw;
          }
        }
        return stoppedCnt > 0 ? "STOPPED " + stoppedCnt : "PASS " + passCnt + "/" + funnels.length;
      }, opt);
    }
    var o = opt || {}, nFrames = 48, NB = 14;
    var STEPS = [["visit site", 100], ["test message", 62], ["sign up", 14], ["verify", 9], ["first message", 4]];
    var drop = 1, maxD = -1, di;
    for (di = 1; di < STEPS.length; di++) { var dd = STEPS[di - 1][1] - STEPS[di][1]; if (dd > maxD) { maxD = dd; drop = di; } }
    var adBars = []; for (di = 0; di < NB; di++) adBars.push(0.25 + 0.7 * K.hh(di, 1031));
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      var u = clamp(t / (nFrames - 1), 0, 1), f = K.infoFont(w), pad = compact ? 6 : 10, gap = compact ? 5 : 8;
      var adProg = clamp(u / 0.7, 0, 1), stopped = u >= 0.7;
      var spend = Math.round(lerp(18, 150, adProg)), clicks = Math.round(lerp(12, 184, adProg)), qual = 0;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, compact ? "GUARDRAIL FUNNEL" : "LOP 04 · AD GUARDRAIL × SIGNUP FUNNEL", w * 0.6, f + 1, "700"), pad, 11, f + 1, V.ink, "left", "700");
      tx(c, stopped ? "STOPPED · DAY 124" : "RUN " + Math.round(u * 100) + "%", w - pad, 11, f - 1, stopped ? RED : V.acc2, "right", "700");
      /* KPI 8 格（桌面 8×1；compact 4×2）：子窗＋鏡面邊；警示格只值上語意紅 */
      var KP = [["MRR", "$" + Math.round(lerp(1840, 4820, u)).toLocaleString("en-US")], ["PAYING", String(Math.round(lerp(112, 257, u)))],
        ["DAY", String(Math.round(lerp(1, 124, u)))], ["SIGNALS", Math.round(lerp(840, 12256, u)).toLocaleString("en-US")],
        ["SHIPPED", String(Math.round(lerp(14, 148, u)))], ["CLICKS", String(clicks)], ["AD SPEND", "$" + spend, 1], ["QUALIFIED", String(qual), 1]];
      var cols = compact ? 4 : 8, rowsK = compact ? 2 : 1, kH = compact ? f * 2 + 7 : f * 2 + 12, kTop = 20;
      var kW = (w - pad * 2 - gap * (cols - 1)) / cols, i;
      for (i = 0; i < 8; i++) {
        var kx = pad + (i % cols) * (kW + gap), ky = kTop + Math.floor(i / cols) * (kH + gap * 0.6), al = !!KP[i][2];
        K.pane(c, { x: kx, y: ky, w: kW, h: kH }); K.specEdge(c, kx + 3, ky + 1, kW - 6);
        if (al) { c.fillStyle = RED; c.fillRect(kx + 1, ky + 3, 2, kH - 6); }
        tx(c, K.fitM(c, KP[i][0], kW - 8, f - 1, "600"), kx + 5, ky + kH * 0.3, f - 1, V.dim, "left", "600");
        tx(c, K.fitM(c, KP[i][1], kW - 8, f + 1, "700"), kx + 5, ky + kH * 0.7, f + 1, al ? RED : V.ink, "left", "700");
      }
      var bTop = kTop + rowsK * kH + (rowsK - 1) * gap * 0.6 + gap, bH = h - bTop - pad;
      var lw = Math.round((w - pad * 2 - gap) * (compact ? 0.47 : 0.45));
      var A = { x: pad, y: bTop, w: lw, h: bH }, F = { x: pad + lw + gap, y: bTop, w: w - pad * 2 - lw - gap, h: bH };
      var rowKV = f + Math.max(5, Math.round(f * 0.8));
      /* 06 AD TEST：鍵值列 → 插畫預覽（花費柱顯影）→ 狀態列（版面內一列，不再浮框） */
      var ia = K.pane(c, A, "06 AD TEST", stopped ? "TRIPPED" : "LIVE");
      if (stopped) { c.strokeStyle = K.rgba(RED, 0.6); c.lineWidth = 1; K.roundRect(c, A.x + 0.5, A.y + 0.5, A.w - 1, A.h - 1, 3); c.stroke(); }
      var kvA = { x: ia.x + 2, y: ia.y, w: ia.w - 4, h: rowKV * 3 + 2 };
      K.kvBlock(c, kvA, [["spend", "$" + spend + "/$150"], ["clicks", String(clicks)], ["qualified", qual + " · stop@3", 1]], f, A.x);
      var stH = f + 8, stY = ia.y + ia.h - stH - 1;
      var ill = { x: ia.x + 3, y: kvA.y + kvA.h + 3, w: ia.w - 6, h: stY - (kvA.y + kvA.h + 3) - 4 };
      if (ill.h > 12) {
        K.pane(c, ill);
        var bb = { x: ill.x + 4, y: ill.y + 4, w: ill.w - 8, h: ill.h - 8 }, st = bb.w / NB;
        K.develop(c, bb, compact ? 1 : adProg, function (cc, col) {
          for (var j = 0; j < NB; j++) { var bh = Math.max(2, adBars[j] * bb.h); cc.fillStyle = col; cc.fillRect(bb.x + j * st + st * 0.18, bb.y + bb.h - bh, Math.max(2, st * 0.64), bh); }
        });
        if (stopped) for (var r = NB - 2; r < NB; r++) { var rh = Math.max(2, adBars[r] * bb.h); c.fillStyle = RED; c.fillRect(bb.x + r * st + st * 0.18, bb.y + bb.h - rh, Math.max(2, st * 0.64), rh); }
        if (!compact) { c.strokeStyle = V.lead; c.setLineDash([2, 2]); K.ln(c, bb.x, bb.y + 0.5, bb.x + bb.w, bb.y + 0.5); c.setLineDash([]); tx(c, "CAP $150", bb.x + bb.w, bb.y + f * 0.6 + 1, f - 1, V.mute, "right"); }
      }
      c.fillStyle = stopped ? K.rgba(RED, 0.16) : V.track; K.roundRect(c, ia.x + 3, stY, ia.w - 6, stH, 3); c.fill();
      tx(c, K.fitM(c, stopped ? "STOPPED BY AGENT · 0/3 QUAL" : "WATCHING · $" + spend + " / $150", ia.w - 12, f, "700"), ia.x + ia.w / 2, stY + stH / 2, f, stopped ? RED : V.dim, "center", "700");
      /* 07 SIGNUP FUNNEL：5 步列；最大流失列＝唯一作用列（光暈＋語意紅）；底部鍵值區 */
      var iff = K.pane(c, F, "07 SIGNUP FUNNEL", "5 STEPS");
      var kvH = rowKV * 3 + 2, fl = { x: iff.x, y: iff.y + 2, w: iff.w, h: iff.h - kvH - 8 };
      var rH = fl.h / STEPS.length, ease = 0.25 + 0.75 * clamp(u * 1.25, 0, 1);
      c.font = "600 " + f + "px " + K.MONO;
      var lblW = Math.min(fl.w * 0.42, c.measureText("first message").width + 6), pctW = c.measureText("100%").width + 6;
      var bx0 = fl.x + 6 + lblW, bMax = Math.max(16, fl.x + fl.w - 6 - pctW - bx0);
      for (i = 0; i < STEPS.length; i++) {
        var ry = fl.y + i * rH, my = ry + rH / 2, isD = i === drop, pc = STEPS[i][1] * ease;
        if (isD) K.activeHalo(c, fl.x + 6, ry + 3, fl.w - 12, rH - 6, compact ? 6 : 12);
        tx(c, K.fitM(c, STEPS[i][0], lblW - 4, f, "600"), fl.x + 6, my, f, isD ? RED : V.txt, "left", isD ? "700" : "600");
        var bh2 = Math.max(3, Math.min(10, rH * 0.38));
        c.fillStyle = V.track; c.fillRect(bx0, my - bh2 / 2, bMax, bh2);
        c.fillStyle = isD ? RED : (i === 0 ? V.line2 : K.mix(V.deep, V.acc2, 1 - i / STEPS.length)); c.fillRect(bx0, my - bh2 / 2, Math.max(2, pc / 100 * bMax), bh2);
        K.kvPort(c, F.x + F.w, my, isD);
        tx(c, Math.round(pc) + "%", fl.x + fl.w - 6, my, f, isD ? RED : V.ink, "right", "700");
      }
      var kvF = { x: iff.x + 2, y: iff.y + iff.h - kvH, w: iff.w - 4, h: kvH };
      c.strokeStyle = V.line; K.ln(c, iff.x + 4, kvF.y - 3.5, iff.x + iff.w - 4, kvF.y - 3.5);
      K.kvBlock(c, kvF, [["7-day trial", Math.round((0.35 + 0.65 * u) * 100) + "%"], ["clicks", "+3 in 2d"],
        ["max drop", STEPS[drop - 1][1] - STEPS[drop][1] + "pt", 1]], f, F.x);
      return stopped ? "STOPPED · Day 124" : "Running · " + Math.round(u * 100) + "%";
    }, o);
  }

  function guardrailFunnelLegacy(cv, _data, opt) {
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
