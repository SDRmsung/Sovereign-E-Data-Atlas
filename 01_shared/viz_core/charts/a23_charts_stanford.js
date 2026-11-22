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
    if (cv.__w !== w || cv.__h !== h || cv.__d !== d) {
      cv.width = w * d; cv.height = h * d; cv.__w = w; cv.__h = h; cv.__d = d;
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

  /* #43 §6.7（2026-11-16 S12）：環面骨架捆綁（12 扇區核心環＝骨架，邊沿骨架走，Holten β=0.8）＋密度透明度 α=1-(1-A)^(1/n)＋深度單色 6 階；
     琥珀只留「熱區」語意；MANIFOLD SPEC 鍵值＋SECTOR LOAD 插畫顯影；標題 fitM 截斷＋熱區標籤徑向避讓（修標籤互疊） */
  function corticalTorus3D(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return corticalTorus3DLegacy(cv, _data, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme("#38bdf8")), V = K.V, tx = K.tx, AMB = "#f59e0b";
    var seed = 42;
    function rnd() { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; }
    var TH0 = -Math.PI * 0.78, THR = Math.PI * 1.66, S = 12, BETA = 0.8, N = 480, nFrames = 12;
    function core(th) { var R = 122 + 16 * Math.sin(th * 1.5); return [R * Math.sin(th) * 0.88, R * Math.cos(th) * 1.05, 0]; }
    function secOf(th) { return Math.max(0, Math.min(S - 1, Math.floor((th - TH0) / THR * S))); }
    function secTh(k) { return TH0 + (k + 0.5) / S * THR; }
    var nodes = [], edges = [], bc = {}, load = [], hotSec = secOf(0);
    for (var k0 = 0; k0 < S; k0++) load.push(0);
    for (var i = 0; i < N; i++) {
      var theta = TH0 + rnd() * THR, phi = rnd() * Math.PI * 2, R = 122 + 16 * Math.sin(theta * 1.5);
      var rTube = (42 + 14 * Math.cos(theta * 0.9)) * (0.45 + 0.55 * Math.sqrt(rnd()));
      var x = (R + rTube * Math.cos(phi)) * Math.sin(theta) * 0.88, y = (R + rTube * Math.cos(phi)) * Math.cos(theta) * 1.05, z = rTube * Math.sin(phi) * 1.15;
      var isHot = Math.abs(theta) < 0.42 && y > 58;
      nodes.push({ x: x, y: y, z: z, theta: theta, isHot: isHot, sec: secOf(theta), sz: isHot ? (1.7 + rnd() * 1.6) : (0.8 + rnd() * 1.1) });
    }
    for (var e = 0; e < 260; e++) {
      var a = Math.floor(rnd() * N), b = Math.floor(rnd() * N), na = nodes[a], nb = nodes[b];
      if (a === b || !(Math.abs(na.theta - nb.theta) < 0.75 || na.isHot || nb.isHot)) continue;
      var sa = na.sec, sb = nb.sec, key = Math.min(sa, sb) + "_" + Math.max(sa, sb), ctl = [[na.x, na.y, na.z]];
      var step = sb >= sa ? 1 : -1;
      for (var s1 = sa; ; s1 += step) { ctl.push(core(secTh(s1))); if (s1 === sb) break; }
      ctl.push([nb.x, nb.y, nb.z]);
      bc[key] = (bc[key] || 0) + 1; load[sa]++; load[sb]++;
      edges.push({ a: a, b: b, hot: na.isHot && nb.isHot, key: key, ctl: ctl });
    }
    var maxL = Math.max.apply(null, load), nPairs = Object.keys(bc).length;
    var hotList = edges.filter(function (ed) { return ed.hot; }).sort(function (p, q) { return bc[q.key] - bc[p.key]; });
    var coolList = edges.filter(function (ed) { return !ed.hot; }).sort(function (p, q) { return bc[q.key] - bc[p.key]; });
    function smooth(P) {
      var out = [P[0]], L = P.length;
      for (var i2 = 1; i2 < L - 1; i2++) {
        var a2 = i2 === 1 ? P[0] : [(P[i2 - 1][0] + P[i2][0]) / 2, (P[i2 - 1][1] + P[i2][1]) / 2];
        var b2 = i2 === L - 2 ? P[L - 1] : [(P[i2][0] + P[i2 + 1][0]) / 2, (P[i2][1] + P[i2 + 1][1]) / 2];
        for (var s2 = 1; s2 <= 5; s2++) { var u = s2 / 5, v = 1 - u; out.push([v * v * a2[0] + 2 * v * u * P[i2][0] + u * u * b2[0], v * v * a2[1] + 2 * v * u * P[i2][1] + u * u * b2[1]]); }
      }
      return out;
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380, f = K.infoFont(w), prog = t / (nFrames - 1);
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var hy = compact ? 8 : 12, rightT = compact ? "Q=0.842" : "Q=0.842 · " + nPairs + " BUNDLES";
      c.font = "400 " + (compact ? 6 : 9) + "px " + K.MONO; var rw0 = c.measureText(rightT).width;
      tx(c, rightT, w - 7, hy, compact ? 6 : 9, V.dim, "right");
      tx(c, K.fitM(c, compact ? "CORTICAL MANIFOLD · C-TORUS" : "14K-NODE CORTICAL MANIFOLD // EDGE-BUNDLED 3D TORUS", w - rw0 - 22, compact ? 7.5 : 11, "600"), 7, hy, compact ? 7.5 : 11, V.acc2, "left", "600");

      var top = compact ? 16 : 22, rw = compact ? Math.round(w * 0.3) : Math.round(K.clamp(w * 0.27, 140, 200));
      var G = { x: 6, y: top, w: w - rw - 18, h: h - top - 6 }, rx = G.x + G.w + 6;
      var gp = K.pane(c, G, "C-TORUS · SKELETON BUNDLING", compact ? "" : "β " + BETA + " · α=1-(1-A)^(1/n)");
      K.dotGrid(c, gp.x, gp.y, gp.w, gp.h, compact ? 10 : 14, V.dot2);

      /* 投影 */
      var cx = gp.x + gp.w * 0.5, cy = gp.y + gp.h * 0.47, scale = Math.min(gp.w * 0.92, gp.h) / 275;
      var phase = prog * Math.PI * 2, rotY = -0.38 + Math.sin(phase) * 0.42, rotX = 0.22;
      var cosY = Math.cos(rotY), sinY = Math.sin(rotY), cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      function proj(p) {
        var x1 = p[0] * cosY - p[2] * sinY, z1 = p[0] * sinY + p[2] * cosY;
        var y2 = p[1] * cosX - z1 * sinX, z2 = p[1] * sinX + z1 * cosX, ps = 520 / (520 + z2 + 260);
        return [cx + x1 * ps * scale, cy + y2 * ps * scale, ps];
      }
      c.save(); c.beginPath(); c.rect(gp.x, gp.y, gp.w, gp.h); c.clip();
      c.strokeStyle = V.line; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, 150 * scale, 0, Math.PI * 2); c.stroke();
      /* 骨架：核心環（扇區刻度＝埠點） */
      var spine = []; for (var k = 0; k <= 48; k++) spine.push(proj(core(TH0 + k / 48 * THR)));
      c.strokeStyle = V.line2; c.lineWidth = 1; c.setLineDash([1, 2]);
      c.beginPath(); spine.forEach(function (p, j) { if (j) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); c.setLineDash([]);

      /* 熱區光暈（琥珀＝語意） */
      var hotC = proj(core(0));
      var grad = c.createRadialGradient(hotC[0], hotC[1], 2, hotC[0], hotC[1], 60 * scale);
      grad.addColorStop(0, K.rgba(AMB, 0.26)); grad.addColorStop(1, K.rgba(AMB, 0));
      c.fillStyle = grad; c.beginPath(); c.arc(hotC[0], hotC[1], 60 * scale, 0, Math.PI * 2); c.fill();

      /* 邊：沿骨架捆綁＋Holten 拉直；同束 n 條合成不透明度恆為 A（冷 0.62／熱 0.75） */
      c.lineWidth = compact ? 0.7 : 1;
      [false, true].forEach(function (pass) {
        edges.forEach(function (ed) {
          if (ed.hot !== pass) return;
          var P = ed.ctl.map(proj), M = P.length - 1, p0 = P[0], q0 = P[M], dep = (p0[2] + q0[2]) * 0.5;
          for (var j = 1; j < M; j++) { var u = j / M; P[j] = [BETA * P[j][0] + (1 - BETA) * (p0[0] + (q0[0] - p0[0]) * u), BETA * P[j][1] + (1 - BETA) * (p0[1] + (q0[1] - p0[1]) * u)]; }
          ed.pts = smooth(P);
          var dt = K.clamp((dep - 0.62) / 0.3, 0, 1);
          c.globalAlpha = (1 - Math.pow(1 - (pass ? 0.75 : 0.62), 1 / bc[ed.key])) * (0.7 + 0.3 * dt);
          c.strokeStyle = pass ? AMB : K.mix(V.acc, V.acc3, dt * 0.6);
          c.beginPath(); c.moveTo(ed.pts[0][0], ed.pts[0][1]); for (var j2 = 1; j2 < ed.pts.length; j2++) c.lineTo(ed.pts[j2][0], ed.pts[j2][1]); c.stroke();
        });
      });
      c.globalAlpha = 1;

      /* 節點：深度單色 6 階（遠＝mute → 近＝acc3），熱區琥珀 */
      nodes.forEach(function (nd) {
        var p = proj([nd.x, nd.y, nd.z]), dt = K.clamp((p[2] - 0.6) / 0.35, 0, 1);
        c.globalAlpha = 0.3 + 0.65 * dt;
        c.fillStyle = nd.isHot ? AMB : K.mix(V.mute, V.acc3, dt);
        c.beginPath(); c.arc(p[0], p[1], nd.sz * p[2] * (compact ? 0.75 : 1), 0, Math.PI * 2); c.fill();
      });
      c.globalAlpha = 1;
      /* 扇區埠點 */
      for (var k2 = 0; k2 < S; k2++) { var sp = proj(core(secTh(k2))); K.kvPort(c, sp[0], sp[1], k2 === hotSec); }

      /* 熱封包：熱束 2 顆（琥珀）＋最粗冷束 1 顆（主色） */
      for (var hp = 0; hp < 2 && hp < hotList.length; hp++) K.hotPacket(c, hotList[hp * 3 % hotList.length].pts, (prog * 2 + hp * 0.5) % 1, AMB, compact ? 1.8 : 2.4);
      if (coolList.length) K.hotPacket(c, coolList[0].pts, (prog * 2 + 0.25) % 1, V.acc2, compact ? 1.8 : 2.4);
      c.restore();

      /* 熱區標籤：沿中心→熱區方向外推，避開骨架環與標題 */
      var lbl = "HOTSPOT · EXEC_VERIFY";
      c.font = "600 " + f + "px " + K.MONO;
      var tw = c.measureText(lbl).width + 10, bh = f + 6, ux = hotC[0] - cx, uy = hotC[1] - cy, ul = Math.hypot(ux, uy) || 1, dist = 22 * scale + 8, box = null;
      ux /= ul; uy /= ul;
      for (var it = 0; it < 30; it++) {
        var ax = hotC[0] + ux * dist, ay = hotC[1] + uy * dist;
        box = { x: K.clamp(ax - tw / 2, gp.x + 3, gp.x + gp.w - tw - 3), y: K.clamp(uy > 0 ? ay : ay - bh, gp.y + 3, gp.y + gp.h - bh - 3), w: tw, h: bh };
        var near = spine.some(function (p) { return p[0] > box.x - 4 && p[0] < box.x + box.w + 4 && p[1] > box.y - 4 && p[1] < box.y + box.h + 4; });
        if (!near) break;
        dist += 5;
      }
      var px = K.clamp(hotC[0], box.x, box.x + box.w), py = K.clamp(hotC[1], box.y, box.y + box.h);
      c.setLineDash([1, 2]); c.strokeStyle = AMB; c.lineWidth = 1; K.ln(c, hotC[0], hotC[1], px, py); c.setLineDash([]);
      K.activeHalo(c, box.x, box.y, box.w, box.h, 10);
      c.fillStyle = V.pane; K.roundRect(c, box.x, box.y, box.w, box.h, 2); c.fill();
      c.strokeStyle = AMB; K.roundRect(c, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, 2); c.stroke();
      tx(c, lbl, box.x + 5, box.y + bh / 2 + 0.5, f, AMB, "left", "600");
      K.kvPort(c, px, py, true);

      /* 右欄：MANIFOLD SPEC＋SECTOR LOAD */
      var rowH = f + Math.max(5, Math.round(f * 0.8)), rows = [
        ["nodes", N + " / 14K"], ["edges", edges.length], ["bundles", nPairs], ["sectors", S], ["β", BETA], ["Q", "0.842"], ["hot", "S" + hotSec + " · " + load[hotSec], true]
      ];
      var specH = Math.min((h - top - 6) * 0.6, 13 + rowH * rows.length + 4);
      var pb1 = K.pane(c, { x: rx, y: top, w: rw, h: specH }, "MANIFOLD SPEC", "");
      K.specEdge(c, rx + 3, top + 1, rw - 6);
      K.kvBlock(c, pb1, rows, f, rx + 0.5);
      var my = top + specH + 6, mh = h - my - 6;
      if (mh > 36) {
        var pb2 = K.pane(c, { x: rx, y: my, w: rw, h: mh }, "SECTOR LOAD", "θ →");
        var bw = (pb2.w - 4) / S, base = pb2.y + pb2.h - 3;
        K.develop(c, pb2, prog * 1.15, function (cc, col) {
          cc.fillStyle = col;
          for (var q = 0; q < S; q++) { var bh2 = Math.max(1, (pb2.h - 8) * load[q] / maxL); cc.fillRect(Math.round(pb2.x + 2 + q * bw), Math.round(base - bh2), Math.max(1, Math.floor(bw) - 1), Math.round(bh2)); }
        });
        var hb = Math.max(1, (pb2.h - 8) * load[hotSec] / maxL);
        c.strokeStyle = AMB; c.lineWidth = 1; c.strokeRect(Math.round(pb2.x + 2 + hotSec * bw) - 0.5, Math.round(base - hb) - 0.5, Math.max(1, Math.floor(bw) - 1) + 1, Math.round(hb) + 1);
      }
      return "相位 " + Math.round(prog * 100) + "%";
    }, o);
  }

  /* #43 3D 腦皮層／C 型環面邊捆綁網路 (3D Cortical C-Torus Edge-Bundled Graph) */
  function corticalTorus3DLegacy(cv, _data, opt) {
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

  function dagPipelineLive(cv, data, opt, TX) {
    var o = opt || {};
    var K = TX.kit(TX.theme("#38bdf8")), V = K.V, tx = K.tx;
    var row1 = data.stages;
    var row2 = data.owners;
    var n1 = row1.length, n2 = row2.length, nFrames = 12;
    var task = data.task || (data.tasks && data.tasks[0]) || {};
    var stageRaw = String(task.stage || "instruct").toLowerCase();
    var isDone = stageRaw === "done";
    var act = isDone ? n1 - 1 : Math.max(0, row1.indexOf(stageRaw));
    var ownerName = String(task.owner || "HEAD").toUpperCase();
    var actOwner = Math.max(0, row2.indexOf(ownerName));
    var isHumanBlock = String(task.blocked_by || "") === "human" || ownerName === "HUMAN";
    var isRetry = Number(task.retry || 0) > 0;
    var AMBER = "#f59e0b", RED = "#ef4444", GREEN = "#22c55e";
    var STAGE_ZH = { instruct: "instruct 指令", build: "build 執行", test: "test 測試", review: "review 評估", merge: "merge 合併" };
    var OWNER_MAP = { instruct: 0, build: 1, test: 1, review: 2, merge: 3 };
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, f = K.infoFont(w), wide = w >= 540;
      var phase = t / (nFrames - 1), pad = wide ? 10 : 6, top = wide ? Math.round(f * 2.4) : 4;
      if (wide) {
        tx(c, "TRI-ROLE DAG // " + (task.task_id || "PIPELINE") + (isDone ? " [DONE]" : " [" + stageRaw.toUpperCase() + "]"), pad + 2, Math.round(f * 1.2), f, V.dim, "left", "700");
        tx(c, (isDone ? "DONE " : "STAGE ") + (act + 1) + " / " + n1 + " · RETRY " + (task.retry ?? 0) + "/2", w - pad - 2, Math.round(f * 1.2), f, isHumanBlock ? RED : (isRetry ? AMBER : V.acc2), "right", "600");
      }
      var side = wide ? Math.round(w * 0.28) : 0;
      var dag = { x: pad, y: top, w: w - pad * 2 - (side ? side + 6 : 0), h: wide ? h - top - pad : Math.round((h - top - pad) * 0.62) };
      var inr = K.pane(c, dag, "DAG · 5 STAGES × 4 OWNERS", isDone ? "MERGED" : ownerName);
      K.dotGrid(c, inr.x, inr.y, inr.w, inr.h, wide ? 10 : 8, V.dot);
      var stepX1 = inr.w / n1, boxW1 = Math.max(24, stepX1 - (wide ? 16 : 6));
      var stepX2 = inr.w / n2, boxW2 = Math.max(28, stepX2 - (wide ? 24 : 10));
      var boxH = Math.round(Math.max(f + 8, Math.min(wide ? 32 : 20, inr.h * 0.2)));
      var yA = Math.round(inr.y + inr.h * 0.34 - boxH / 2), yB = Math.round(inr.y + inr.h * 0.80 - boxH / 2), ym = (yA + boxH + yB) / 2;
      var rad = wide ? 6 : 3, i;
      function bx1(k) { return Math.round(inr.x + k * stepX1 + (stepX1 - boxW1) / 2); }
      function bx2(k) { return Math.round(inr.x + k * stepX2 + (stepX2 - boxW2) / 2); }

      /* 上層 stage 同層邊 */
      for (i = 0; i < n1 - 1; i++) {
        var y0 = yA + boxH / 2 + 0.5;
        c.strokeStyle = (isDone || i < act) ? V.acc2 : V.line2; c.lineWidth = 1.2;
        if (!isDone && i >= act) c.setLineDash([2, 2]);
        K.ln(c, bx1(i) + boxW1, y0, bx1(i + 1), y0); c.setLineDash([]);
      }

      /* review(3) → build(1) 退回邊（上繞弧線 + 箭頭） */
      var revIdx = row1.indexOf("review"), bldIdx = row1.indexOf("build");
      if (revIdx >= 0 && bldIdx >= 0) {
        var rx0 = bx1(revIdx) + boxW1 * 0.5, bx0 = bx1(bldIdx) + boxW1 * 0.5;
        var retY = Math.max(inr.y + 6, yA - Math.max(12, Math.round(inr.h * 0.16)));
        var retPts = [[rx0, yA], [rx0, retY], [bx0, retY], [bx0, yA]];
        c.strokeStyle = isRetry ? AMBER : V.line2;
        c.lineWidth = isRetry ? 1.5 : 1;
        c.setLineDash(isRetry ? [4, 2] : [2, 3]);
        K.orthPath(c, retPts, rad);
        c.setLineDash([]);
        /* 箭頭指回 build */
        c.fillStyle = isRetry ? AMBER : V.line2;
        c.beginPath(); c.moveTo(bx0, yA - 1); c.lineTo(bx0 - 3.5, yA - 7); c.lineTo(bx0 + 3.5, yA - 7); c.closePath(); c.fill();
        tx(c, "review→build (RETRY≤2)", (rx0 + bx0) / 2, retY - 6, Math.max(6.5, f * 0.78), isRetry ? AMBER : V.dim, "center", "600");
        if (isRetry) K.hotPacket(c, retPts, phase, AMBER, wide ? 2.6 : 1.8);
      }

      /* 跨層連接：stage → owner */
      var actPath = null;
      for (i = 0; i < n1; i++) {
        var oi = OWNER_MAP[row1[i]] ?? Math.min(n2 - 1, i);
        if (i === revIdx && isHumanBlock && row2.indexOf("HUMAN") >= 0) oi = row2.indexOf("HUMAN");
        var xa = bx1(i) + boxW1 * 0.5, xb = bx2(oi) + boxW2 * 0.5;
        var lane = Math.round(ym + (i % 2 ? 1 : -1) * (wide ? 3 : 2)) + 0.5;
        var pts = [[xa, yA + boxH], [xa, lane], [xb, lane], [xb, yB]];
        var isActEdge = i === act;
        c.strokeStyle = isActEdge ? (isHumanBlock ? RED : V.acc) : (isDone || i < act ? V.acc2 : V.line2);
        c.lineWidth = isActEdge ? 1.5 : 1;
        if (!isDone && i > act) c.setLineDash([2, 2]);
        K.orthPath(c, pts, rad); c.setLineDash([]);
        if (isActEdge) actPath = pts;
      }

      /* 畫上層 stage 節點 */
      row1.forEach(function (id, k) {
        var x = bx1(k), hot = !isDone && k === act, done = isDone || k < act;
        var hCol = hot && isHumanBlock ? RED : (hot && isRetry && id === "build" ? AMBER : (done ? GREEN : V.acc));
        c.fillStyle = hot ? K.mix(V.pane, hCol, 0.28) : (done ? K.mix(V.pane, V.acc, 0.12) : V.card);
        K.roundRect(c, x, yA, boxW1, boxH, 4); c.fill();
        c.strokeStyle = hot ? hCol : (done ? V.acc2 : V.line2); c.lineWidth = hot ? 1.4 : 1;
        K.roundRect(c, x + 0.5, yA + 0.5, boxW1 - 1, boxH - 1, 4); c.stroke();
        if (hot) K.activeHalo(c, x, yA, boxW1, boxH, wide ? 12 : 6);
        var lbl = wide ? (STAGE_ZH[id] || id) : id;
        tx(c, K.fitM(c, lbl, boxW1 - 6, f, "600"), x + boxW1 / 2, yA + boxH / 2 + 0.5, f, hot ? V.ink : (done ? V.txt : V.dim), "center", "600");
        K.kvPort(c, x, yA + boxH / 2, done || hot); K.kvPort(c, x + boxW1, yA + boxH / 2, done);
      });

      /* 畫下層 owner 節點 */
      row2.forEach(function (id, k) {
        var x = bx2(k), hot = k === actOwner;
        var hCol = hot && isHumanBlock ? RED : (hot && isRetry ? AMBER : V.acc);
        c.fillStyle = hot ? K.mix(V.pane, hCol, 0.24) : V.card;
        K.roundRect(c, x, yB, boxW2, boxH, 4); c.fill();
        c.strokeStyle = hot ? hCol : V.line2; c.lineWidth = hot ? 1.4 : 1;
        K.roundRect(c, x + 0.5, yB + 0.5, boxW2 - 1, boxH - 1, 4); c.stroke();
        if (hot) K.activeHalo(c, x, yB, boxW2, boxH, wide ? 10 : 5);
        tx(c, K.fitM(c, id, boxW2 - 6, f, hot ? "700" : "500"), x + boxW2 / 2, yB + boxH / 2 + 0.5, f, hot ? V.ink : V.dim, "center", hot ? "700" : "500");
        K.kvPort(c, x + boxW2 / 2, yB, hot);
      });

      if (actPath) K.hotPacket(c, actPath, phase, isHumanBlock ? RED : V.acc3, wide ? 2.6 : 1.8);

      /* 右側（窄版下方）：STAGE SPEC + PROGRESS */
      var rest = wide ? { x: dag.x + dag.w + 6, y: top, w: side, h: h - top - pad } : { x: pad, y: dag.y + dag.h + 4, w: w - pad * 2, h: h - dag.y - dag.h - 4 - pad };
      var specB = wide ? { x: rest.x, y: rest.y, w: rest.w, h: Math.round(rest.h * 0.62) } : { x: rest.x, y: rest.y, w: Math.round(rest.w * 0.6), h: rest.h };
      var devB = wide ? { x: rest.x, y: specB.y + specB.h + 6, w: rest.w, h: rest.h - specB.h - 6 } : { x: specB.x + specB.w + 4, y: rest.y, w: rest.w - specB.w - 4, h: rest.h };
      var si = K.pane(c, specB, "TASK SPEC", task.task_id || "—");
      K.kvBlock(c, si, [
        ["stage", stageRaw, true],
        ["owner", ownerName, true],
        ["blocked", String(task.blocked_by || "none"), isHumanBlock],
        ["retry", (task.retry ?? 0) + " / 2", isRetry],
        ["wait", data.wait_label || "—"],
        ["mode", isHumanBlock ? "ESCALATE" : (isDone ? "DONE" : "ACTIVE"), isHumanBlock]
      ], f, specB.x);
      var pct = isDone ? 1 : (act + 1) / n1;
      var di = K.pane(c, devB, "STAGE PROGRESS", Math.round(pct * 100) + "%");
      K.develop(c, di, pct, function (cc, col) {
        var rh = Math.max(4, Math.floor((di.h - 4) / n1));
        for (var q = 0; q < n1; q++) {
          var by = Math.round(di.y + 2 + q * rh + rh / 2), bh = Math.max(3, Math.min(7, Math.round(rh * 0.45)));
          var fillW = q <= act ? (di.w - 10) : Math.round((di.w - 10) * 0.18);
          cc.fillStyle = q === act && isHumanBlock ? RED : col;
          K.roundRect(cc, di.x + 5, by - bh / 2, fillW, bh, 1.5); cc.fill();
        }
      });
      return (task.task_id || "DAG") + " · " + stageRaw + " → " + ownerName;
    }, o);
  }

  /* #44 §6.7（2026-11-16 S11）：雙層 DAG 子窗（曼哈頓 arcTo 跨層依賴＋埠點＋單一作用節點光暈＋熱封包）＋STAGE SPEC 鍵值＋TRACE 插畫顯影 */
  function dagPipeline(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return dagPipelineLegacy(cv, _data, opt);
    if (_data && Array.isArray(_data.stages) && Array.isArray(_data.owners)) {
      return dagPipelineLive(cv, _data, opt, TX);
    }
    var o = opt || {};
    var K = TX.kit(TX.theme("#38bdf8")), V = K.V, tx = K.tx;
    var row1 = ["system_query", "extract_pipe", "select_eval", "act_propose", "eval_metric", "act_verify"];
    var row2 = ["parse_ast", "cypher_hop", "hypo_rank", "sandbox_run", "reward_bp", "commit_node"];
    var n = row1.length, nFrames = 12;
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, f = K.infoFont(w), wide = w >= 540;
      var phase = t / (nFrames - 1), pos = phase * n, act = Math.floor(pos) % n, sub = pos - Math.floor(pos);
      var pad = wide ? 10 : 6, top = wide ? Math.round(f * 2.4) : 4;
      if (wide) {
        tx(c, "EXECUTION DAG // DUAL-TIER STATE PIPELINE", pad + 2, Math.round(f * 1.2), f, V.dim, "left", "700");
        tx(c, "STAGE " + (act + 1) + " / " + n, w - pad - 2, Math.round(f * 1.2), f, V.acc2, "right", "600");
      }
      var side = wide ? Math.round(w * 0.3) : 0;
      var dag = { x: pad, y: top, w: w - pad * 2 - (side ? side + 6 : 0), h: wide ? h - top - pad : Math.round((h - top - pad) * 0.6) };
      var inr = K.pane(c, dag, "DAG · 2 TIERS", n * 2 + " NODES");
      K.dotGrid(c, inr.x, inr.y, inr.w, inr.h, wide ? 10 : 8, V.dot);
      var stepX = inr.w / n, boxW = Math.max(18, stepX - (wide ? 14 : 6));
      var boxH = Math.round(Math.max(f + 6, Math.min(wide ? 30 : 18, inr.h * 0.2)));
      var yA = Math.round(inr.y + inr.h * 0.24 - boxH / 2), yB = Math.round(inr.y + inr.h * 0.76 - boxH / 2), ym = (yA + boxH + yB) / 2;
      var rad = wide ? 6 : 3, i;
      function bx(k) { return Math.round(inr.x + k * stepX + (stepX - boxW) / 2); }
      /* 同層邊：完成＝亮實線、未到＝虛線 */
      for (i = 0; i < n - 1; i++) {
        [yA, yB].forEach(function (yy, ri) {
          var y0 = yy + boxH / 2 + 0.5;
          c.strokeStyle = i < act ? V.acc2 : V.line2; c.lineWidth = 1;
          if (i >= act) c.setLineDash([2, 2]);
          K.ln(c, bx(i) + boxW, y0, bx(i + 1), y0); c.setLineDash([]);
        });
      }
      /* 跨層依賴：row1[i] → row2[i+1]（末節點直下），曼哈頓圓角走線，奇偶錯開兩條車道 */
      var paths = [];
      for (i = 0; i < n; i++) {
        var j = Math.min(i + 1, n - 1), xa = bx(i) + boxW * 0.35, xb = bx(j) + boxW * (j === i ? 0.35 : 0.65);
        var lane = Math.round(ym + (i % 2 ? 1 : -1) * (wide ? 3 : 2)) + 0.5;
        paths[i] = j === i ? [[xa, yA + boxH], [xa, yB]] : [[xa, yA + boxH], [xa, lane], [xb, lane], [xb, yB]];
        c.strokeStyle = i < act ? V.acc2 : (i === act ? V.acc : V.line2); c.lineWidth = 1;
        if (i > act) c.setLineDash([2, 2]);
        K.orthPath(c, paths[i], rad); c.setLineDash([]);
      }
      /* 節點 */
      [row1, row2].forEach(function (row, ri) {
        var yy = ri ? yB : yA;
        row.forEach(function (id, k) {
          var x = bx(k), hot = k === act, done = k < act, wt = ri ? "400" : "600";
          c.fillStyle = hot ? K.mix(V.pane, V.acc, 0.24) : (done ? K.mix(V.pane, V.acc, 0.1) : V.card);
          K.roundRect(c, x, yy, boxW, boxH, 4); c.fill();
          c.strokeStyle = hot ? V.acc3 : (done ? V.acc2 : V.line2); c.lineWidth = 1;
          K.roundRect(c, x + 0.5, yy + 0.5, boxW - 1, boxH - 1, 4); c.stroke();
          K.specEdge(c, x + 3, yy + 1, boxW - 6, hot ? 0.16 : 0.06);
          if (hot && !ri) K.activeHalo(c, x, yy, boxW, boxH, wide ? 12 : 6);
          var lc = hot ? V.ink : (done ? V.txt : V.dim), cx = x + boxW / 2, cy = yy + boxH / 2 + 0.5, parts = id.split("_");
          c.font = wt + " " + f + "px " + K.MONO;
          if (c.measureText(id).width > boxW - 6 && parts.length > 1 && boxH >= f * 2.2 + 4) {
            tx(c, K.fitM(c, parts[0], boxW - 6, f, wt), cx, cy - f * 0.55, f, lc, "center", wt);
            tx(c, K.fitM(c, parts.slice(1).join("_"), boxW - 6, f, wt), cx, cy + f * 0.55, f, lc, "center", wt);
          } else tx(c, K.fitM(c, id, boxW - 6, f, wt), cx, cy, f, lc, "center", wt);
          K.kvPort(c, x, yy + boxH / 2, done || hot); K.kvPort(c, x + boxW, yy + boxH / 2, done);
        });
      });
      K.hotPacket(c, paths[act], sub, V.acc3, wide ? 2.6 : 1.8);
      /* 右側（窄版下方）：STAGE SPEC 鍵值＋TRACE 顯影 */
      var rest = wide ? { x: dag.x + dag.w + 6, y: top, w: side, h: h - top - pad } : { x: pad, y: dag.y + dag.h + 4, w: w - pad * 2, h: h - dag.y - dag.h - 4 - pad };
      var specB = wide ? { x: rest.x, y: rest.y, w: rest.w, h: Math.round(rest.h * 0.56) } : { x: rest.x, y: rest.y, w: Math.round(rest.w * 0.56), h: rest.h };
      var devB = wide ? { x: rest.x, y: specB.y + specB.h + 6, w: rest.w, h: rest.h - specB.h - 6 } : { x: specB.x + specB.w + 4, y: rest.y, w: rest.w - specB.w - 4, h: rest.h };
      var si = K.pane(c, specB, "STAGE SPEC", "S" + (act + 1));
      var lat = Math.round(40 + K.hh(act, 4.4) * 160);
      K.kvBlock(c, si, [["node", row1[act], true], ["tier-2", row2[act]], ["deps", act ? row1[act - 1] : "—"],
        ["latency", lat + " ms"], ["done", act + "/" + n], ["retry", String(Math.floor(K.hh(act, 9.1) * 3))]], f, specB.x);
      var di = K.pane(c, devB, "TRACE PREVIEW", Math.round(phase * 100) + "%");
      K.develop(c, di, phase, function (cc, col) {
        var rh = Math.max(3, Math.floor((di.h - 4) / n));
        for (var q = 0; q < n; q++) {
          var x0 = di.x + 3 + (di.w - 6) * (q / n) * 0.82, ww = Math.max(4, (di.w - 6) * (0.12 + K.hh(q, 2.7) * 0.14));
          var by = Math.round(di.y + 2 + q * rh + rh / 2), bh = Math.max(2, Math.min(6, Math.round(rh * 0.4)));
          cc.strokeStyle = col; cc.globalAlpha *= 0.35; K.ln(cc, di.x + 3, by + 0.5, di.x + di.w - 3, by + 0.5); cc.globalAlpha /= 0.35;
          cc.fillStyle = col; K.roundRect(cc, Math.round(x0), by - bh / 2, Math.round(ww), bh, 1.5); cc.fill();
        }
      });
      return "Step " + (act + 1) + "/" + n;
    }, o);
  }

  /* #44 雙層有向狀態機膠囊管線圖 (2-Row DAG Capsule Pipeline) */
  function dagPipelineLegacy(cv, _data, opt) {
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

  /* #46 §6.7（2026-11-16 S11）：單色 6 階分類（依類別固定、不再輪色）＋作用層光暈＋LAYER SPEC 鍵值＋MIX 插畫顯影 */
  function marimekkoStrip(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return marimekkoStripLegacy(cv, _data, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme("#38bdf8")), V = K.V, tx = K.tx;
    var rows = [
      [0.24, 0.18, 0.28, 0.16, 0.14],
      [0.15, 0.32, 0.19, 0.22, 0.12],
      [0.30, 0.14, 0.24, 0.18, 0.14],
      [0.18, 0.26, 0.22, 0.20, 0.14],
      [0.21, 0.21, 0.18, 0.25, 0.15]
    ];
    var cats = ["QUERY", "EXEC", "MEMORY", "VERIFY", "GATE"], layers = ["L1 embed", "L2 route", "L3 recall", "L4 reason", "L5 emit"];
    var tone = [0.92, 0.72, 0.54, 0.38, 0.24].map(function (u) { return K.mix(V.deep, V.acc3, u); });
    var nFrames = 12;
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, f = K.infoFont(w), wide = w >= 540;
      var u = t / (nFrames - 1), phase = u * Math.PI * 2, act = Math.min(rows.length - 1, Math.floor(u * rows.length));
      var pad = wide ? 10 : 6, top = wide ? Math.round(f * 2.4) : 4;
      if (wide) {
        tx(c, "LAYER ATTENTION ALLOCATION // MARIMEKKO STATE BARCODE", pad + 2, Math.round(f * 1.2), f, V.dim, "left", "700");
        tx(c, "2.48 M TOK/SEC", w - pad - 2, Math.round(f * 1.2), f, V.acc2, "right", "600");
      }
      var side = wide ? Math.round(w * 0.28) : 0;
      var mb = { x: pad, y: top, w: w - pad * 2 - (side ? side + 6 : 0), h: wide ? h - top - pad : Math.round((h - top - pad) * 0.62) };
      var mi = K.pane(c, mb, "ATTENTION STRIP", "5 LAYERS × 5");
      var lblW = wide ? Math.round(f * 6.2) : Math.round(f * 3.4), lgH = wide ? Math.round(f * 1.8) : 0;
      var x0 = mi.x + lblW + 6, availW = mi.x + mi.w - 4 - x0, rowH = (mi.h - lgH - 4) / rows.length;
      var shares = [];
      for (var r = 0; r < rows.length; r++) {
        var y = Math.round(mi.y + 2 + r * rowH + 3), bh = Math.max(5, Math.round(rowH - 7)), wts = [], sum = 0, k;
        for (k = 0; k < 5; k++) { var wt = rows[r][k] * (1 + 0.18 * Math.sin(phase + r * 0.8 + k * 1.1)); wts.push(wt); sum += wt; }
        shares.push(wts.map(function (v) { return v / sum; }));
        tx(c, wide ? layers[r] : "L" + (r + 1), mi.x + 4, y + bh / 2, f, r === act ? V.ink : V.dim, "left", r === act ? "600" : "400");
        K.kvPort(c, x0 - 3, y + bh / 2, r === act);
        var x = x0;
        for (k = 0; k < 5; k++) {
          var sw = shares[r][k] * availW, bw = Math.max(2, sw - 2);
          c.fillStyle = r === act ? tone[k] : K.mix(V.pane, tone[k], 0.72);
          K.roundRect(c, Math.round(x), y, Math.round(bw), bh, 2); c.fill();
          K.specEdge(c, Math.round(x) + 1, y, Math.round(bw) - 2, r === act ? 0.18 : 0.06);
          if (sw > f * 3.6 && bh > f + 2) tx(c, Math.round(shares[r][k] * 100) + "%", x + bw / 2, y + bh / 2 + 0.5, f, k < 2 ? V.bg : V.ink, "center", "600");
          x += sw;
        }
        if (r === act) K.activeHalo(c, x0, y, availW - 2, bh, wide ? 10 : 5);
      }
      if (wide) {
        var lx = x0, ly = mi.y + mi.h - lgH / 2;
        cats.forEach(function (nm, k) {
          c.fillStyle = tone[k]; K.roundRect(c, lx, ly - f * 0.35, f * 0.7, f * 0.7, 1.5); c.fill();
          tx(c, nm, lx + f, ly, f, V.dim); c.font = f + "px " + K.MONO; lx += f * 2 + c.measureText(nm).width;
        });
      }
      var rest = wide ? { x: mb.x + mb.w + 6, y: top, w: side, h: h - top - pad } : { x: pad, y: mb.y + mb.h + 4, w: w - pad * 2, h: h - mb.y - mb.h - 4 - pad };
      var specB = wide ? { x: rest.x, y: rest.y, w: rest.w, h: Math.round(rest.h * 0.52) } : { x: rest.x, y: rest.y, w: Math.round(rest.w * 0.56), h: rest.h };
      var devB = wide ? { x: rest.x, y: specB.y + specB.h + 6, w: rest.w, h: rest.h - specB.h - 6 } : { x: specB.x + specB.w + 4, y: rest.y, w: rest.w - specB.w - 4, h: rest.h };
      var si = K.pane(c, specB, "LAYER SPEC", "L" + (act + 1));
      var sh = shares[act], top1 = sh.indexOf(Math.max.apply(null, sh));
      K.kvBlock(c, si, cats.map(function (nm, k) { return [nm.toLowerCase(), (sh[k] * 100).toFixed(1) + "%", k === top1]; }), f, specB.x);
      var di = K.pane(c, devB, "MIX PREVIEW", Math.round(u * 100) + "%");
      K.develop(c, di, u, function (cc, col) {
        var n = 10, cw = (di.w - 6) / n;
        for (var q = 0; q < n; q++) {
          var yy = di.y + di.h - 2, tot = di.h - 4;
          for (var k2 = 0; k2 < 5; k2++) {
            var hh2 = tot * rows[q % 5][k2] * (0.9 + 0.2 * K.hh(q * 5 + k2, 3.3)) / 1.02;
            cc.strokeStyle = col; cc.lineWidth = 1; cc.strokeRect(Math.round(di.x + 3 + q * cw) + 0.5, Math.round(yy - hh2) + 0.5, Math.max(2, Math.round(cw - 3)), Math.max(1, Math.round(hh2) - 1));
            yy -= hh2;
          }
        }
      });
      return "Frame " + (Math.round(t) + 1);
    }, o);
  }

  /* #46 多列不等寬分段狀態條碼 (Multi-Row Marimekko State Strip) */
  function marimekkoStripLegacy(cv, _data, opt) {
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
