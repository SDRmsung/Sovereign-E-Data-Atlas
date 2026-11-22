/* A23 Charts — MNL 玻璃魔方套組 (#71 glassMonolith)
 * 來源：vault 內 Monolith 筆記（Monolith 首屏逆向：3×3×3 導角立方、單層轉動、四材質、邊緣流光、底座光盤）
 * Canvas 2D 程序化渲染（零模型、零貼圖；原文 WebGL/PBR 以 2D 近似：Lambert＋Fresnel 邊光＋條紋折射偽影）。
 * 保證 seek(t) 100% 決定性重繪（零 Math.random、零 Date.now；亂數一律 K.hh）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};

  function fit(cv, bg) {
    var d = g.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    var w = +cv.dataset.w || Math.max(1, Math.round(r.width));
    var h = +cv.dataset.h || Math.max(1, Math.round(r.height));
    if (cv.__w !== w || cv.__h !== h || cv.__d !== d) {
      cv.width = w * d; cv.height = h * d; cv.__w = w; cv.__h = h; cv.__d = d;
    }
    var c = cv.getContext("2d");
    c.setTransform(d, 0, 0, d, 0, 0);
    c.clearRect(0, 0, w, h);
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
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

  /* ── 3D 小工具（純函式） ── */
  function rot(p, ax, a) {
    var cs = Math.cos(a), sn = Math.sin(a), x = p[0], y = p[1], z = p[2];
    if (ax === 0) return [x, y * cs - z * sn, y * sn + z * cs];
    if (ax === 1) return [x * cs + z * sn, y, -x * sn + z * cs];
    return [x * cs - y * sn, x * sn + y * cs, z];
  }
  function smooth(e) { return e * e * (3 - 2 * e); }
  function roundQuad(c, P, rad) {
    var m0 = [(P[0][0] + P[1][0]) / 2, (P[0][1] + P[1][1]) / 2];
    c.beginPath(); c.moveTo(m0[0], m0[1]);
    for (var i = 1; i <= 4; i++) {
      var a = P[i % 4], b = P[(i + 1) % 4], pv = P[(i + 3) % 4];
      var ux = pv[0] - a[0], uy = pv[1] - a[1], vx = b[0] - a[0], vy = b[1] - a[1], l1 = Math.hypot(ux, uy), l2 = Math.hypot(vx, vy);
      var cs = (l1 && l2) ? (ux * vx + uy * vy) / (l1 * l2) : 1, th = Math.acos(Math.max(-1, Math.min(1, cs)));
      /* 銳角防爆：切點距離 r/tan(θ/2) 不得超過鄰邊 45% */
      var rr = Math.max(0, Math.min(rad, 0.45 * Math.min(l1, l2) * Math.tan(th / 2)));
      c.arcTo(a[0], a[1], b[0], b[1], rr);
    }
    c.closePath();
  }

  function glassMonolith(cv, _data, opt) {
    var TX = g.A23Tex; if (!TX) throw new Error("A23Tex missing");
    var K = TX.kit(TX.theme("#38bdf8")), V = K.V, AUR = "#c084fc";
    var o = opt || {}, nFrames = 60;
    var MATS = [
      { id: "OBSIDIAN", spec: "T.15 · IOR 1.60", ior: 1.60 },
      { id: "GLASS", spec: "T.98 · IOR 1.52", ior: 1.52 },
      { id: "AURORA", spec: "T.92 · IRID 1.0", ior: 1.30 },
      { id: "CHROME", spec: "M1.0 · R.03", ior: 0 }
    ];
    var AX = [1, 0, 2, 1], LAY = [1, 1, -1, -1], AXN = ["X", "Y", "Z"];
    var HS = 0.43, LIT = [-0.35, 0.65, 0.68];
    var ll = Math.hypot(LIT[0], LIT[1], LIT[2]); LIT = [LIT[0] / ll, LIT[1] / ll, LIT[2] / ll];
    var CUB = [];
    for (var cx0 = -1; cx0 <= 1; cx0++) for (var cy0 = -1; cy0 <= 1; cy0++) for (var cz0 = -1; cz0 <= 1; cz0++) CUB.push([cx0, cy0, cz0]);
    var DIRS = [[0, 1], [0, -1], [1, 1], [1, -1], [2, 1], [2, -1]];
    var LOOP = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1], [-1, -1, 1], [-1, -1, -1]];
    var NF = 26;

    return driver(nFrames, function (t) {
      var s = fit(cv, V.bg), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var f = K.infoFont(w), F = compact ? f + 2 : f, pad = compact ? 6 : 10, gap = compact ? 5 : 8, topH = compact ? 16 : 22;
      var u = K.clamp(t / (nFrames - 1), 0, 1), q = Math.min(3, Math.floor(u * 4)), qu = u * 4 - q, M = MATS[q];
      var tw = smooth(K.clamp((qu - 0.3) / 0.4, 0, 1)) * Math.PI / 2 * LAY[q], twDeg = Math.round(Math.abs(tw) * 180 / Math.PI);
      var twisting = qu > 0.3 && qu < 0.7;
      var yaw = u * Math.PI * 2 + 0.62, pitch = 0.44 + 0.07 * Math.sin(u * Math.PI * 2), roll = -0.2;

      K.dotGrid(c, 0, 0, w, h, compact ? 6 : 8, V.dot);
      K.tx(c, K.fitM(c, compact ? "MONOLITH · 3×3×3" : "MONOLITH · GLASS CUBE · 3×3×3 · ZERO ASSET", w * 0.62, F, "700"), pad, topH * 0.5, F, V.dim, "left", "700");
      K.tx(c, "MAT " + (q + 1) + "/4 · " + M.id, w - pad, topH * 0.5, F, V.acc2, "right", "700");

      function head(b, l, r) {
        K.pane(c, b); K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
        var hy = b.y + 4 + F * 0.5;
        K.tx(c, K.fitM(c, l, b.w * (r ? 0.58 : 0.9), F, "700"), b.x + 6, hy, F, V.dim, "left", "700");
        if (r) K.tx(c, K.fitM(c, r, b.w * 0.4, F, "700"), b.x + b.w - 6, hy, F, V.acc2, "right", "700");
        return b.y + F + 8;
      }

      /* ── 版面：桌面 [RENDER | MATERIAL／SHADER／PIPELINE]；小卡 RENDER 上＋[MAT|SHADER] 下 ── */
      var y0 = topH, availH = h - pad - y0, bR, bM, bS, bK = null;
      if (!compact) {
        var rW = Math.round((w - pad * 2 - gap) * 0.6), rx = pad + rW + gap, cW = w - pad - rx;
        var mH = Math.round(F + 12 + 4 * (F + 8)), sH = Math.round((availH - mH - gap * 2) * 0.5);
        bR = { x: pad, y: y0, w: rW, h: availH };
        bM = { x: rx, y: y0, w: cW, h: mH };
        bS = { x: rx, y: y0 + mH + gap, w: cW, h: sH };
        bK = { x: rx, y: bS.y + sH + gap, w: cW, h: availH - mH - sH - gap * 2 };
      } else {
        var rH = Math.round((availH - gap) * 0.6), hw = (w - pad * 2 - gap) / 2;
        bR = { x: pad, y: y0, w: w - pad * 2, h: rH };
        bM = { x: pad, y: y0 + rH + gap, w: hw, h: availH - rH - gap };
        bS = { x: pad + hw + gap, y: bM.y, w: hw, h: bM.h };
      }

      /* ── 01 RENDER：底座光盤＋神經垂絲＋魔方本體＋邊緣流光 ── */
      var rTop = head(bR, "01 RENDER · PROCEDURAL", "PMREM · ACES");
      var ri = { x: bR.x + 2, y: rTop, w: bR.w - 4, h: bR.y + bR.h - rTop - 2 };
      c.save(); c.beginPath(); c.rect(ri.x, ri.y, ri.w, ri.h); c.clip();
      var ccx = ri.x + ri.w * 0.5, ccy = ri.y + ri.h * 0.46, S = Math.min(ri.w, ri.h) * 0.165;
      var baseY = ccy + S * 2.25, prx = S * 1.9;
      function proj(p) { var k = 1 / (1 - p[2] * 0.06); return [ccx + p[0] * S * k, ccy - p[1] * S * k]; }
      function view(p) { return rot(rot(rot(p, 1, yaw), 0, pitch), 2, roll); }

      /* 背光暈 */
      var ag = c.createRadialGradient(ccx, ccy, 0, ccx, ccy, S * 3.2);
      ag.addColorStop(0, K.rgba(q === 2 ? AUR : V.acc, 0.16)); ag.addColorStop(1, K.rgba(V.acc, 0));
      c.fillStyle = ag; c.fillRect(ri.x, ri.y, ri.w, ri.h);
      /* 神經垂絲（底座下彎曲貝茲） */
      for (var fi = 0; fi < NF; fi++) {
        var sx = ccx + (K.hh(fi, 11) - 0.5) * 2 * prx * 0.92, ex = sx + (sx - ccx) * (0.4 + K.hh(fi, 12) * 0.9), ey = ri.y + ri.h + 2;
        var c1y = baseY + (ey - baseY) * (0.35 + K.hh(fi, 13) * 0.3);
        c.strokeStyle = K.rgba(V.acc2, 0.08 + 0.18 * K.hh(fi, 14)); c.lineWidth = 0.8;
        c.beginPath(); c.moveTo(sx, baseY); c.bezierCurveTo(sx, c1y, ex, c1y, ex, ey); c.stroke();
        if (fi % 5 === 0) {
          var pf = (u * 5 + K.hh(fi, 15)) % 1, it = 1 - pf;
          var bx = it * it * it * sx + 3 * it * it * pf * sx + 3 * it * pf * pf * ex + pf * pf * pf * ex;
          var by = it * it * it * baseY + 3 * it * it * pf * c1y + 3 * it * pf * pf * c1y + pf * pf * pf * ey;
          c.fillStyle = V.acc3; c.beginPath(); c.arc(bx, by, 1.3, 0, Math.PI * 2); c.fill();
        }
      }
      /* 底座光盤與水平光束 */
      var bl = c.createLinearGradient(ri.x, 0, ri.x + ri.w, 0);
      bl.addColorStop(0, K.rgba(V.acc, 0)); bl.addColorStop(0.5, K.rgba(V.acc3, 0.85)); bl.addColorStop(1, K.rgba(V.acc, 0));
      c.strokeStyle = bl; c.lineWidth = 1; K.ln(c, ri.x, Math.round(baseY) + 0.5, ri.x + ri.w, Math.round(baseY) + 0.5);
      c.save(); c.translate(ccx, baseY); c.scale(1, 0.11);
      var pg = c.createRadialGradient(0, 0, 0, 0, 0, prx);
      pg.addColorStop(0, "rgba(255,255,255,0.95)"); pg.addColorStop(0.22, K.rgba(V.acc3, 0.7));
      pg.addColorStop(0.6, K.rgba(V.acc, 0.2)); pg.addColorStop(1, K.rgba(V.acc, 0));
      c.fillStyle = pg; c.beginPath(); c.arc(0, 0, prx, 0, Math.PI * 2); c.fill(); c.restore();

      /* 收集面：單層轉動 → 視角旋轉 → 背面剔除 → 畫家排序 */
      var faces = [];
      for (var ci = 0; ci < CUB.length; ci++) {
        var cb = CUB[ci], inL = cb[AX[q]] === LAY[q];
        for (var di = 0; di < 6; di++) {
          var a = DIRS[di][0], sg = DIRS[di][1], b1 = (a + 1) % 3, b2 = (a + 2) % 3;
          var nrm = [0, 0, 0]; nrm[a] = sg;
          if (inL) nrm = rot(nrm, AX[q], tw);
          nrm = view(nrm);
          if (nrm[2] <= 0.06) continue;
          var P = [], W = [], zs = 0, ss = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
          for (var k = 0; k < 4; k++) {
            var p = [cb[0], cb[1], cb[2]];
            p[a] += sg * HS; p[b1] += ss[k][0] * HS; p[b2] += ss[k][1] * HS;
            if (inL) p = rot(p, AX[q], tw);
            W.push(p); var vp = view(p); zs += vp[2]; P.push(proj(vp));
          }
          faces.push({ P: P, W: W, n: nrm, z: zs / 4, outer: cb[a] === sg, ci: ci });
        }
      }
      faces.sort(function (A, B) { return A.z - B.z; });

      function styleFace(fc, m) {
        var P = fc.P, n = fc.n, lam = Math.max(0, n[0] * LIT[0] + n[1] * LIT[1] + n[2] * LIT[2]), fres = Math.pow(1 - n[2], 2);
        var e = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), rad = Math.max(1, e * 0.2);
        var gr = c.createLinearGradient(P[0][0], P[0][1], P[2][0], P[2][1]);
        if (m === 0) { gr.addColorStop(0, K.mix(V.bg, V.acc, 0.06 + 0.2 * lam)); gr.addColorStop(1, V.bg); }
        else if (m === 1) { gr.addColorStop(0, "rgba(255,255,255," + (0.06 + 0.17 * lam).toFixed(3) + ")"); gr.addColorStop(1, K.rgba(V.acc3, 0.04)); }
        else if (m === 2) { gr.addColorStop(0, K.rgba(AUR, 0.1 + 0.2 * lam)); gr.addColorStop(1, K.rgba(V.acc, 0.05 + 0.12 * fres)); }
        else { gr.addColorStop(0, "rgba(255,255,255," + (0.3 + 0.62 * lam).toFixed(3) + ")"); gr.addColorStop(0.46, V.mute); gr.addColorStop(0.54, V.bg); gr.addColorStop(1, V.txt); }
        roundQuad(c, P, rad); c.fillStyle = gr; c.fill();
        if (m === 1 || m === 2) {
          c.strokeStyle = m === 1 ? "rgba(255,255,255,0.08)" : K.rgba(AUR, 0.12); c.lineWidth = 0.7;
          for (var bi = 1; bi <= 5; bi++) {
            var ft = bi / 6;
            K.ln(c, K.lerp(P[0][0], P[1][0], ft), K.lerp(P[0][1], P[1][1], ft), K.lerp(P[3][0], P[2][0], ft), K.lerp(P[3][1], P[2][1], ft));
          }
        }
        roundQuad(c, P, rad);
        c.strokeStyle = m === 3 ? "rgba(255,255,255,0.4)" : K.rgba(m === 2 ? AUR : V.acc2, 0.18 + 0.45 * fres + (m === 0 ? 0.1 : 0));
        c.lineWidth = 0.8; c.stroke();
      }
      for (var fj = 0; fj < faces.length; fj++) styleFace(faces[fj], q);

      /* 邊緣流光：外表面每條邊依世界座標行進波點亮（雙層描邊代替 shadowBlur，省效能） */
      var ph = u * 8;
      c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round";
      for (var fk = 0; fk < faces.length; fk++) {
        var fc = faces[fk]; if (!fc.outer) continue;
        for (var ek = 0; ek < 4; ek++) {
          var wa = fc.W[ek], wb = fc.W[(ek + 1) % 4];
          var wc = (wa[0] + wb[0]) * 0.5 * 0.9 + (wa[1] + wb[1]) * 0.5 * 1.1 + (wa[2] + wb[2]) * 0.5 * 0.7;
          var br = Math.pow(0.5 + 0.5 * Math.sin((ph - wc * 0.32) * Math.PI * 2), 6) * (q === 3 ? 0.6 : 1);
          if (br < 0.06) continue;
          var pa = fc.P[ek], pb = fc.P[(ek + 1) % 4];
          c.strokeStyle = K.rgba(V.acc, 0.22 * br); c.lineWidth = 3.2; K.ln(c, pa[0], pa[1], pb[0], pb[1]);
          c.strokeStyle = K.rgba(V.acc3, 0.85 * br); c.lineWidth = 0.9; K.ln(c, pa[0], pa[1], pb[0], pb[1]);
        }
      }
      c.restore();
      /* 熱封包：沿大立方斜六角環行（光軌） */
      var ring = LOOP.map(function (v) { return proj(view([v[0] * 1.45, v[1] * 1.45, v[2] * 1.45])); });
      K.hotPacket(c, ring, (u * 3) % 1, V.acc2, compact ? 2.2 : 2.6);
      K.hotPacket(c, ring, (u * 3 + 0.5) % 1, V.acc2, compact ? 2.2 : 2.6);

      /* 轉動層註解：中心方塊埠點 → 曼哈頓引線 → 右上標籤 */
      var cc = [0, 0, 0]; cc[AX[q]] = LAY[q] * 1.45;
      var cp = proj(view(rot(cc, AX[q], tw)));
      var lbl = "TWIST " + AXN[AX[q]] + (LAY[q] > 0 ? "+1" : "-1") + " · " + twDeg + "°";
      c.font = "700 " + F + "px " + K.MONO;
      var lw = c.measureText(lbl).width, ly = ri.y + F * 0.5 + 4, lx = ri.x + ri.w - 6, lx0 = lx - lw - 5;
      c.strokeStyle = twisting ? V.acc2 : V.line2; c.lineWidth = 1; c.setLineDash([2, 2]);
      K.orthPath(c, [[cp[0], cp[1]], [cp[0], ly], [lx0, ly]], 3); c.setLineDash([]);
      K.kvPort(c, cp[0], cp[1], twisting);
      K.tx(c, lbl, lx, ly, F, twisting ? V.ink : V.dim, "right", "700");
      /* 材質切換掃描線 */
      if (qu < 0.1) {
        var sy = Math.round(ri.y + ri.h * (qu / 0.1)) + 0.5;
        c.strokeStyle = "rgba(255,255,255,0.85)"; c.lineWidth = 1; K.ln(c, ri.x, sy, ri.x + ri.w, sy);
      }
      c.restore();
      var bf = compact ? 10 : F + 6;
      K.tx(c, M.id, bR.x + 8, bR.y + bR.h - bf * 0.5 - 6, bf, V.ink, "left", "700");

      /* ── 02 MATERIAL：四材質列＋色票＋唯一作用列光暈 ── */
      var mTop = head(bM, compact ? "02 MAT" : "02 MATERIAL STATE", (q + 1) + "/4");
      var rowH = compact ? Math.max(F + 4, (bM.y + bM.h - mTop - 4) / 4) : F + 8;
      for (var mi = 0; mi < 4; mi++) {
        var ry = Math.round(mTop + rowH * (mi + 0.5)), act = mi === q, sw = Math.round(F + 1);
        if (act) K.activeHalo(c, bM.x + 5, ry - rowH * 0.5 + 2, bM.w - 10, rowH - 4, 10);
        var sx0 = bM.x + 6, sy0 = ry - sw * 0.5, sg2 = c.createLinearGradient(sx0, sy0, sx0 + sw, sy0 + sw);
        if (mi === 0) { sg2.addColorStop(0, V.line2); sg2.addColorStop(1, V.bg); }
        else if (mi === 1) { sg2.addColorStop(0, "rgba(255,255,255,0.55)"); sg2.addColorStop(1, K.rgba(V.acc, 0.2)); }
        else if (mi === 2) { sg2.addColorStop(0, AUR); sg2.addColorStop(1, V.acc); }
        else { sg2.addColorStop(0, "rgba(255,255,255,0.95)"); sg2.addColorStop(0.5, V.mute); sg2.addColorStop(1, V.txt); }
        K.roundRect(c, sx0, sy0, sw, sw, 2); c.fillStyle = sg2; c.fill();
        c.strokeStyle = act ? V.acc2 : V.line2; c.lineWidth = 1; K.roundRect(c, sx0 + 0.5, sy0 + 0.5, sw - 1, sw - 1, 2); c.stroke();
        K.leader(c, MATS[mi].id, compact ? MATS[mi].spec.split(" · ")[0] : MATS[mi].spec, sx0 + sw + 5, bM.x + bM.w - 6, ry, F, act);
        K.kvPort(c, bM.x + 0.5, ry, act);
      }

      /* ── 03 SHADER：Fresnel 曲線＋邊緣流光遮罩顯影（每材質重顯影） ── */
      var sTop = head(bS, compact ? "03 FRESNEL" : "03 SHADER · FRESNEL × EDGE", compact ? null : "F0 " + (M.ior ? Math.pow((M.ior - 1) / (M.ior + 1), 2).toFixed(3) : "0.900"));
      var si = { x: bS.x + 8, y: sTop + 2, w: bS.w - 16, h: bS.y + bS.h - sTop - 8 };
      var F0 = M.ior ? Math.pow((M.ior - 1) / (M.ior + 1), 2) : 0.9;
      K.develop(c, si, K.clamp(qu / 0.85, 0, 1), function (cx, col, lit) {
        cx.strokeStyle = V.line; cx.lineWidth = 1;
        K.ln(cx, si.x, si.y + si.h - 0.5, si.x + si.w, si.y + si.h - 0.5); K.ln(cx, si.x + 0.5, si.y, si.x + 0.5, si.y + si.h);
        cx.strokeStyle = col; cx.lineWidth = lit ? 1.6 : 1; cx.beginPath();
        for (var xi = 0; xi <= 40; xi++) {
          var th = xi / 40 * Math.PI / 2, fr = F0 + (1 - F0) * Math.pow(1 - Math.cos(th), 5);
          var px = si.x + si.w * xi / 40, py = si.y + si.h - Math.pow(fr, 0.45) * (si.h - 2);
          if (xi) cx.lineTo(px, py); else cx.moveTo(px, py);
        }
        cx.stroke();
        cx.strokeStyle = lit ? K.rgba(V.acc3, 0.55) : col; cx.lineWidth = 0.8; cx.setLineDash([2, 2]); cx.beginPath();
        for (var xj = 0; xj <= 40; xj++) {
          var mv = Math.pow(0.5 + 0.5 * Math.sin((ph - xj / 40 * 2) * Math.PI * 2), 4);
          var qx = si.x + si.w * xj / 40, qy = si.y + si.h - mv * si.h * 0.45 - 1;
          if (xj) cx.lineTo(qx, qy); else cx.moveTo(qx, qy);
        }
        cx.stroke(); cx.setLineDash([]);
      });
      if (!compact) {
        K.tx(c, "θ 0→90°", si.x + si.w, si.y + si.h - F * 0.6, F, V.mute, "right", "600");
        K.tx(c, "F(θ)", si.x + 4, si.y + F * 0.6, F, V.dim, "left", "600");
      }

      /* ── 04 PIPELINE：鍵值區塊（桌面） ── */
      if (bK && bK.h > F * 3) {
        var kTop = head(bK, "04 PIPELINE · NO ASSET", null);
        K.kvBlock(c, { x: bK.x + 3, y: kTop, w: bK.w - 6, h: bK.y + bK.h - kTop - 2 }, [
          ["TWIST", AXN[AX[q]] + (LAY[q] > 0 ? "+1" : "-1") + " " + twDeg + "°", twisting],
          ["GEOM", "27 × RoundedBox", false],
          ["ENV", "PMREM procedural", false],
          ["BLOOM", ".85 / .80 / .60", false],
          ["TONE", "ACES Filmic", false],
          ["BUDGET", "60fps · DPR≤2", false]
        ], F, bK.x + 0.5);
      }
      return "Frame " + (Math.round(t) + 1) + "/" + nFrames;
    }, o);
  }

  A23.glassMonolith = glassMonolith;
  g.A23Charts = A23;
})(window);
