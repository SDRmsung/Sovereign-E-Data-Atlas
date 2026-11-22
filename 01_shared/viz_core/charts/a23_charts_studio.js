/* A23 Charts — STU 製片管線套組 (#64 stageCards / #65 pcbBus / #66 nleTimeline / #67 costDrop)
 * 載入順序：在 a23_charts_orb.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（LCG seed=20261116、零 Math.random、零 Date.now、零閉包累加狀態）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var BG = "#06070c", CARD = "#0c0f18", LINE = "#1f2433";
  var GOLD = "#f5b301", CYAN = "#22d3ee", MAGENTA = "#ec4899";
  var GREEN = "#22c55e", RED = "#ef4444", PURPLE = "#a78bfa", ORANGE = "#f97316";
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

  function fitTxt(str, maxW, fSize) {
    var maxCh = Math.max(4, Math.floor(maxW / (fSize * 0.61)));
    return str.length > maxCh ? str.slice(0, maxCh - 1) + "…" : str;
  }
  /* 實測字寬截斷（CJK 安全）：以 measureText 逐字裁到 maxW 內 */
  function fitM(c, str, maxW, fSize, weight) {
    str = String(str);
    c.font = (weight || "700") + " " + fSize + "px " + MONO;
    if (c.measureText(str).width <= maxW) return str;
    var n = str.length;
    while (n > 1 && c.measureText(str.slice(0, n) + "…").width > maxW) n--;
    return str.slice(0, n) + "…";
  }

  function fmtComma(num) {
    return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

  function drawPortDot(c, x, y, r, color, lit) {
    c.fillStyle = BG;
    c.beginPath(); c.arc(x, y, r + 1.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = lit ? color : "#334155";
    c.lineWidth = lit ? 1.4 : 1;
    c.beginPath(); c.arc(x, y, r + 0.6, 0, Math.PI * 2); c.stroke();
    c.fillStyle = lit ? color : MUTED;
    c.beginPath(); c.arc(x, y, Math.max(1.4, r * 0.58), 0, Math.PI * 2); c.fill();
  }

  function drawRoundedOrth(c, pts, radius) {
    if (pts.length < 2) return;
    c.beginPath();
    c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) {
      c.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], radius);
    }
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    c.stroke();
  }

  function evalOrth(pts, frac) {
    var segs = [], total = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1];
      var len = Math.hypot(dx, dy);
      segs.push({ x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], len: len });
      total += len;
    }
    var target = clamp(frac, 0, 1) * total, acc = 0;
    for (var j = 0; j < segs.length; j++) {
      var sg = segs[j];
      if (acc + sg.len >= target || j === segs.length - 1) {
        var f = sg.len > 0 ? clamp((target - acc) / sg.len, 0, 1) : 0;
        return [lerp(sg.x0, sg.x1, f), lerp(sg.y0, sg.y1, f)];
      }
      acc += sg.len;
    }
    return pts[pts.length - 1];
  }

  /* ── §6.7 共用質感原語：由 a23_charts_tex.js（A23Tex）供應，STU 用 violet 主題（原 V 色票，像素一致）── */
  var TEX = g.A23Tex.kit(g.A23Tex.THEMES.violet);
  var V = TEX.V, hh = TEX.hh, ln = TEX.ln, tx = TEX.tx, dotGrid = TEX.dotGrid, pane = TEX.pane, leader = TEX.leader,
    kvPort = TEX.kvPort, activeHalo = TEX.activeHalo, specEdge = TEX.specEdge, hotPacket = TEX.hotPacket;
  /* STU 字級曲線（2026-11-16 程式債）：fI＝min(10, K.infoFont(w))，取 infoFont 三階為錨（6／7.5／≥10）線性內插；
   * a＝compact 字級、m＝mid（380–539）字級、b＝寬版字級 → 三階與改前逐像素一致，540–671 之間平滑過渡 */
  function fz(fI, a, m, b) {
    if (fI <= 6) return a; if (fI === 7.5) return m; if (fI >= 10) return b;
    return fI < 7.5 ? a + (m - a) * (fI - 6) / 1.5 : m + (b - m) * (fI - 7.5) / 2.5;
  }

  /* #64 stageCards — 3×3 角色工作站卡 (driver n=60) */
  function stageCards(cv, _data, opt) {
    var K = g.A23Tex.kit(g.A23Tex.THEMES.violet), V = K.V;
    function tint(t) { return K.mix(V.bg, V.acc, t); }   /* 單色階：bg→acc */
    var C_EYE = tint(0.14), C_OFF = tint(0.05), C_STAFF = tint(0.11), C_PAPER = K.mix(V.txt, "#ffffff", 0.61), C_GREY = K.mix(V.bg, V.txt, 0.79);
    var RAMP = [0.14, 0.26, 0.39, 0.53, 0.78, 1].map(tint);
    var o = opt || {};
    var D = o.data || (_data && _data.stations ? _data : null);
    var nFrames = 60;
    var DEMO = [
      { id: "01", role: "illustrator", sub: "the illustrator", kv: [["ado", "illustrator"], ["tools", "63"], ["output", "vectors"], ["wait", "4 stars"]], kind: "figure", out: "cast/hero_v4.svg" },
      { id: "02", role: "rigger", sub: "the rigger", kv: [["input", "layered"], ["bones", "21"], ["ik", "hands"], ["check", "pass"]], kind: "rig", out: "rig/hero.rig" },
      { id: "03", role: "animator", sub: "the animator", kv: [["clip", "dance"], ["style", "flat"], ["fps", "24"], ["loop", "jump"]], kind: "onion", out: "anim/take_03.mov" },
      { id: "04", role: "choreographer", sub: "the choreographer", kv: [["moves", "8 beats"], ["mirror", "1 call"], ["tempo", "120"], ["copy", "every move"]], kind: "pose", out: "chor/moves.json" },
      { id: "05", role: "bg-painter", sub: "the background painter", kv: [["lp", "flat"], ["type", "video wall"], ["canvas", "2k"], ["motion", "moving"]], kind: "mosaic", out: "bg/wall_loop.png" },
      { id: "06", role: "motion", sub: "the motion designer", kv: [["lib", "easing"], ["titles", "yes"], ["logo", "yes"], ["sync", "on beat"]], kind: "title", out: "mo/titles.aep" },
      { id: "07", role: "composer", sub: "the composer", kv: [["key", "A min"], ["bars", "32"], ["stems", "4"], ["lufs", "-14"]], kind: "score", out: "audio/score.wav" },
      { id: "08", role: "foley", sub: "the foley artist", kv: [["hits", "18"], ["steps", "every move"], ["sync", "±2ms"], ["room", "dry"]], kind: "foley", out: "audio/foley.wav" },
      { id: "09", role: "editor", sub: "the editor", kv: [["cuts", "12"], ["grade", "rec709"], ["codec", "h264"], ["ship", "queued"]], kind: "cut", out: "cut/final.mp4" }
    ];
    var KMAP = { grid: "mosaic", lines: "list", pose: "figure", frames: "onion", curve: "curve", eq: "score", spikes: "foley", layers: "cut", meter: "cut" };
    var STATIONS = (D && Array.isArray(D.stations) && D.stations.length) ? D.stations : DEMO;

    /* 人形：x=腳中心, y=地面, s=身高, a=手臂相位(-1..1), mode=fill|outline|bones */
    function fig(c, x, y, s, a, mode, col, alpha) {
      c.save(); c.globalAlpha = alpha == null ? 1 : alpha; c.lineCap = "round"; c.lineJoin = "round";
      var hr = s * 0.15, hy = y - s + hr, sh = hy + hr + s * 0.05, hip = y - s * 0.34;
      var lw = Math.max(1, s * 0.06);
      var limb = mode === "fill" ? V.acc3 : col;
      if (mode !== "bones") {
        c.fillStyle = "rgba(139,92,246,0.16)";
        c.beginPath(); c.ellipse(x, y + 1, s * 0.24, s * 0.035, 0, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = limb; c.lineWidth = lw;
      var lx = x - s * 0.13 - a * s * 0.04, rx = x + s * 0.13 + a * s * 0.04;
      ln(c, x - s * 0.05, hip, lx, y); ln(c, x + s * 0.05, hip, rx, y);
      var lhx = x - s * 0.27, lhy = sh + s * 0.1 - a * s * 0.32, rhx = x + s * 0.27, rhy = sh + s * 0.1 + a * s * 0.32;
      ln(c, x - s * 0.08, sh + s * 0.03, lhx, lhy); ln(c, x + s * 0.08, sh + s * 0.03, rhx, rhy);
      if (mode === "fill") {
        c.fillStyle = col;
        c.beginPath(); c.moveTo(x - s * 0.1, sh); c.lineTo(x + s * 0.1, sh); c.lineTo(x + s * 0.17, hip + s * 0.06); c.lineTo(x - s * 0.17, hip + s * 0.06); c.closePath(); c.fill();
        c.fillStyle = V.ink; c.beginPath(); c.arc(x, hy, hr, 0, Math.PI * 2); c.fill();
        c.fillStyle = V.deep; c.beginPath(); c.arc(x, hy - hr * 0.15, hr * 1.02, Math.PI * 1.02, Math.PI * 1.98); c.fill();
        c.fillStyle = C_EYE; c.fillRect(x - hr * 0.45, hy + hr * 0.1, Math.max(1, hr * 0.18), Math.max(1, hr * 0.28)); c.fillRect(x + hr * 0.27, hy + hr * 0.1, Math.max(1, hr * 0.18), Math.max(1, hr * 0.28));
      } else {
        c.strokeStyle = col; c.lineWidth = Math.max(0.8, lw * 0.7);
        if (mode === "bones") ln(c, x, sh, x, hip); else { c.beginPath(); c.moveTo(x - s * 0.1, sh); c.lineTo(x + s * 0.1, sh); c.lineTo(x + s * 0.15, hip + s * 0.05); c.lineTo(x - s * 0.15, hip + s * 0.05); c.closePath(); c.stroke(); }
        c.beginPath(); c.arc(x, hy, hr, 0, Math.PI * 2); c.stroke();
        if (mode === "bones") {
          c.fillStyle = V.acc3;
          [[x, sh], [x, hip], [lhx, lhy], [rhx, rhy], [lx, y], [rx, y], [x - s * 0.08, sh + s * 0.03], [x + s * 0.08, sh + s * 0.03]].forEach(function (p) {
            c.beginPath(); c.arc(p[0], p[1], Math.max(1, s * 0.03), 0, Math.PI * 2); c.fill();
          });
        }
      }
      c.restore();
    }
    function checklist(c, x, y, w, h, items, n, ac) {
      var fitN = Math.max(1, Math.min(items.length, Math.floor(h / 7.5)));
      if (fitN < items.length) { n = Math.round(n * fitN / items.length); items = items.slice(0, fitN); }
      var rh = Math.min(9, h / items.length);
      for (var k = 0; k < items.length; k++) {
        var yy = y + rh * (k + 0.5), on = k < n;
        c.strokeStyle = on ? ac : V.line2; c.lineWidth = 1;
        c.strokeRect(Math.round(x) + 0.5, Math.round(yy - 2.5) + 0.5, 5, 5);
        if (on) { c.fillStyle = ac; c.fillRect(Math.round(x) + 2, Math.round(yy - 1), 3, 3); }
        tx(c, items[k], x + 9, yy, 5.6, on ? V.txt : V.mute);
      }
    }

    function drawPreview(c, kind, b, ac, pct, act, u, k) {
      if (D) kind = KMAP[kind] || kind;
      var ph = Math.sin(u * Math.PI * 12 + k), inr, s;
      if (kind === "figure") {
        var lw = b.w * 0.58;
        inr = pane(c, { x: b.x, y: b.y, w: lw - 3, h: b.h }, "artboard 1", "100%");
        dotGrid(c, inr.x, inr.y, inr.w, inr.h, 6, V.dot2);
        s = Math.min(inr.h * 0.86, inr.w * 1.2);
        fig(c, inr.x + inr.w / 2, inr.y + inr.h - 3, s, act ? ph * 0.5 : 0.2, "fill", ac);
        var r2 = pane(c, { x: b.x + lw, y: b.y, w: b.w - lw, h: b.h }, "layers");
        checklist(c, r2.x + 3, r2.y, r2.w, r2.h, ["head", "hair", "body", "arms", "legs", "face"], Math.round(pct * 6), ac);
      } else if (kind === "rig") {
        var lw2 = b.w * 0.55;
        inr = pane(c, { x: b.x, y: b.y, w: lw2 - 3, h: b.h }, "skeleton");
        s = Math.min(inr.h * 0.86, inr.w * 1.2);
        fig(c, inr.x + inr.w / 2, inr.y + inr.h - 3, s, act ? ph * 0.6 : 0.1, "outline", V.dim, 0.9);
        fig(c, inr.x + inr.w / 2, inr.y + inr.h - 3, s, act ? ph * 0.6 : 0.1, "bones", ac);
        var r3 = pane(c, { x: b.x + lw2, y: b.y, w: b.w - lw2, h: b.h }, "bones");
        checklist(c, r3.x + 3, r3.y, r3.w, r3.h, ["spine", "neck", "arm.l", "arm.r", "leg.l", "leg.r", "ik.l", "ik.r"], Math.round(pct * 8), ac);
      } else if (kind === "onion") {
        var tw = b.w * 0.3;
        var t1 = pane(c, { x: b.x, y: b.y, w: tw, h: b.h }, "sketch");
        c.fillStyle = C_PAPER; c.fillRect(t1.x + 2, t1.y + 1, t1.w - 4, t1.h - 2);
        fig(c, t1.x + t1.w / 2, t1.y + t1.h - 3, Math.min(t1.h * 0.8, t1.w * 1.1), 0.3, "outline", V.line2);
        tx(c, "→", b.x + tw + 5, b.y + b.h / 2, 7, V.dim, "center");
        inr = pane(c, { x: b.x + tw + 10, y: b.y, w: b.w - tw - 10, h: b.h }, "onion skin", "f" + (12 + Math.round(pct * 36)));
        var cg = c.createLinearGradient(0, inr.y, 0, inr.y + inr.h);
        cg.addColorStop(0, "rgba(139,92,246,0.05)"); cg.addColorStop(1, "rgba(139,92,246,0.28)");
        c.fillStyle = cg; c.fillRect(inr.x, inr.y, inr.w, inr.h);
        s = Math.min(inr.h * 0.82, inr.w * 0.9);
        for (var g2 = 2; g2 >= 0; g2--) fig(c, inr.x + inr.w / 2 + (g2 - 1) * s * 0.06, inr.y + inr.h - 3 - g2 * s * 0.05, s, (act ? ph : 0.6) - g2 * 0.35, g2 ? "outline" : "fill", g2 ? V.acc2 : ac, g2 ? 0.25 : 1);
      } else if (kind === "pose") {
        var hw = (b.w - 3) / 2;
        inr = pane(c, { x: b.x, y: b.y, w: hw, h: b.h }, "ref", "1/8");
        s = Math.min(inr.h * 0.8, inr.w * 1.1);
        fig(c, inr.x + inr.w / 2, inr.y + inr.h - 3, s, act ? ph : 0.5, "bones", V.ink);
        c.setLineDash([2, 2]); c.strokeStyle = ac; c.lineWidth = 1;
        c.strokeRect(Math.round(inr.x + inr.w * 0.2) + 0.5, Math.round(inr.y + 2) + 0.5, Math.round(inr.w * 0.6), Math.round(inr.h - 4)); c.setLineDash([]);
        var r4 = pane(c, { x: b.x + hw + 3, y: b.y, w: hw, h: b.h }, "stage", "cam 2");
        var sp = c.createLinearGradient(0, r4.y, 0, r4.y + r4.h);
        sp.addColorStop(0, "rgba(236,232,255,0.22)"); sp.addColorStop(1, "rgba(139,92,246,0.04)");
        c.fillStyle = sp; c.beginPath(); c.moveTo(r4.x + r4.w * 0.42, r4.y); c.lineTo(r4.x + r4.w * 0.58, r4.y); c.lineTo(r4.x + r4.w * 0.9, r4.y + r4.h); c.lineTo(r4.x + r4.w * 0.1, r4.y + r4.h); c.closePath(); c.fill();
        fig(c, r4.x + r4.w / 2, r4.y + r4.h - 3, Math.min(r4.h * 0.8, r4.w * 1.1), act ? ph : 0.5, "fill", ac);
      } else if (kind === "mosaic") {
        inr = pane(c, b, "wall · 16×9", Math.round(pct * 100) + "%");
        var cs = Math.max(3, Math.floor(inr.w / 22)), nx = Math.floor(inr.w / cs), ny = Math.floor(inr.h / cs);
        var shades = RAMP;
        for (var yy = 0; yy < ny; yy++) for (var xx = 0; xx < nx; xx++) {
          var hv = hh(xx + yy * 37, k + Math.floor(u * 6));
          var on = (xx + yy * nx) / (nx * ny) <= Math.max(pct, act ? 0 : 0.15);
          c.fillStyle = on ? shades[Math.floor(hv * shades.length)] : C_OFF;
          c.fillRect(inr.x + xx * cs, inr.y + yy * cs, cs - 1, cs - 1);
        }
      } else if (kind === "title" || kind === "curve") {
        var isT = kind === "title";
        inr = pane(c, b, isT ? "titles.aep" : "gate curve", isT ? "comp 1" : Math.round(pct * 100) + "%");
        var fs = Math.max(7, Math.min(inr.h * 0.28, inr.w * 0.1));
        c.font = "800 " + fs + "px " + MONO; c.textBaseline = "middle"; c.textAlign = "left";
        if (isT) { var w1 = c.measureText("STUDIO ").width, w2 = c.measureText("REEL").width, x0 = inr.x + (inr.w - w1 - w2) / 2, yT = inr.y + inr.h * 0.4;
        c.fillStyle = C_GREY; c.fillText("STUDIO ", x0, yT); c.fillStyle = ac; c.fillText("REEL", x0 + w1, yT); }
        var cx0 = inr.x + inr.w * (isT ? 0.62 : 0.08), cy0 = inr.y + inr.h - 3, cw = inr.w * (isT ? 0.34 : 0.84), chh = inr.h * (isT ? 0.36 : 0.8);
        c.strokeStyle = V.line2; c.lineWidth = 1; ln(c, cx0, cy0, cx0 + cw, cy0); ln(c, cx0, cy0, cx0, cy0 - chh);
        c.strokeStyle = ac; c.beginPath();
        for (var q = 0; q <= 24; q++) { var e = easeOut(q / 24); if (q) c.lineTo(cx0 + cw * q / 24, cy0 - chh * e); else c.moveTo(cx0, cy0); }
        c.stroke();
        var pu = act ? (u * 9 + k) % 1 : pct;
        c.fillStyle = V.ink; c.beginPath(); c.arc(cx0 + cw * pu, cy0 - chh * easeOut(pu), 1.8, 0, Math.PI * 2); c.fill();
      } else if (kind === "score") {
        inr = pane(c, b, "piano roll", "A min");
        var lanes = 7, lh = inr.h / lanes;
        c.strokeStyle = C_STAFF; c.lineWidth = 1;
        for (var la = 1; la < lanes; la++) ln(c, inr.x, Math.round(inr.y + la * lh) + 0.5, inr.x + inr.w, Math.round(inr.y + la * lh) + 0.5);
        for (var nt = 0; nt < 16; nt++) {
          var nx0 = inr.x + inr.w * nt / 16, lane = Math.floor(hh(nt, 7 + k) * lanes);
          c.fillStyle = nt / 16 < pct ? ac : RAMP[1];
          c.fillRect(nx0 + 1, inr.y + lane * lh + 1, Math.max(1, Math.min(inr.w / 16 * (1 + Math.floor(hh(nt, 3) * 2)) - 2, inr.x + inr.w - nx0 - 2)), Math.max(1.5, lh - 2));
        }
        c.strokeStyle = V.ink; ln(c, Math.round(inr.x + inr.w * pct) + 0.5, inr.y, Math.round(inr.x + inr.w * pct) + 0.5, inr.y + inr.h);
      } else if (kind === "foley") {
        inr = pane(c, b, "hits", (Math.round(pct * 18)) + "/18");
        var nF = 5, fw = inr.w / nF;
        for (var f = 0; f < nF; f++) fig(c, inr.x + fw * (f + 0.5), inr.y + inr.h * 0.66, Math.min(inr.h * 0.55, fw * 0.9), Math.sin(f * 1.3 + u * 30), "fill", f / nF < pct ? ac : V.line2, f / nF < pct ? 1 : 0.6);
        var by = inr.y + inr.h - 2;
        c.strokeStyle = ac; c.lineWidth = 1;
        for (var hb = 0; hb < 18; hb++) { var hx = inr.x + inr.w * (hb + 0.5) / 18, on2 = hb / 18 < pct; c.strokeStyle = on2 ? V.acc3 : V.line2; ln(c, Math.round(hx) + 0.5, by, Math.round(hx) + 0.5, by - (on2 ? 2 + hh(hb, 9) * inr.h * 0.18 : 2)); }
      } else if (kind === "cut") {
        inr = pane(c, b, "timeline", "00:00:" + (10 + Math.round(pct * 9)) + ":00");
        var tr = 4, th = inr.h / tr;
        for (var r = 0; r < tr; r++) {
          var xx2 = inr.x;
          for (var cl = 0; cl < 5; cl++) {
            var wc = inr.w * (0.12 + hh(cl, r + 20) * 0.14), on3 = (xx2 - inr.x) / inr.w < pct;
            c.fillStyle = on3 ? (r === 0 ? ac : RAMP[3]) : RAMP[0];
            c.fillRect(xx2, inr.y + r * th + 1, Math.max(1, wc - 1.5), Math.max(1.5, th - 2.5));
            xx2 += wc; if (xx2 > inr.x + inr.w) break;
          }
        }
        c.strokeStyle = V.ink; c.lineWidth = 1; ln(c, Math.round(inr.x + inr.w * pct) + 0.5, inr.y, Math.round(inr.x + inr.w * pct) + 0.5, inr.y + inr.h);
      } else {
        inr = pane(c, b, "notes");
        for (var li = 0; li < 6; li++) {
          var lw3 = inr.w * (0.4 + hh(li, k) * 0.5);
          c.fillStyle = li / 6 < pct ? ac : V.line2;
          c.fillRect(inr.x + 3, inr.y + 2 + li * (inr.h / 6), lw3, Math.max(1, inr.h / 6 - 3));
        }
      }
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380, fI = Math.min(10, K.infoFont(w));
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      dotGrid(c, 0, 0, w, h, 12, V.dot);
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 6 : (w < 540 ? 9 : 12);
      var topH = compact ? 16 : 20;
      var activeIdx = Math.min(STATIONS.length - 1, Math.floor(u * (STATIONS.length - 0.001)));
      var subU = clamp(u * (STATIONS.length - 0.001) - activeIdx, 0, 1);
      var aSt = STATIONS[activeIdx];
      var titleLeft = (D && D.title) ? D.title : (compact ? "STAGE CARDS · 3×3" : "STU 01 · STAGE WORKSTATION CARDS · 3×3 PIPELINE");
      tx(c, titleLeft, pad, topH * 0.55, fz(fI, 7, 8.5, 8.5), V.acc3, "left", "700");
      tx(c, "ACTIVE " + aSt.id + " " + String(aSt.role).toUpperCase() + " · " + Math.round(u * 100) + "%", w - pad, topH * 0.55, fz(fI, 6.5, 7.5, 7.5), V.dim, "right", "600");

      var cols = (D && D.cols) ? D.cols : (STATIONS.length === 9 ? 3 : Math.min(4, Math.max(2, Math.ceil(STATIONS.length / 2))));
      var rows = Math.ceil(STATIONS.length / cols);
      var gridTop = topH + 4, gridW = w - pad * 2, gridH = h - gridTop - pad;
      var hasEdges = D && D.edges && D.edges.length;
      var gapX = hasEdges ? (compact ? 14 : 26) : (compact ? 5 : 8);
      var gapY = hasEdges ? (compact ? 12 : 20) : (compact ? 5 : 8);
      var cardW = (gridW - gapX * (cols - 1)) / cols, cardH = (gridH - gapY * (rows - 1)) / rows;
      var tiny = compact || cardH < 96;
      var cardRects = {};

      /* 作用列光暈框（參考圖外層雙線發光） */
      var aRow = Math.floor(activeIdx / cols), gy0 = gridTop + aRow * (cardH + gapY);
      activeHalo(c, pad, gy0, gridW, cardH, compact ? 6 : 12);

      for (var i = 0; i < STATIONS.length; i++) {
        var st = STATIONS[i];
        var ac = D ? (st.col || V.acc) : V.acc;
        var cx = pad + (i % cols) * (cardW + gapX), cy = gridTop + Math.floor(i / cols) * (cardH + gapY);
        cardRects[st.id] = { x: cx, y: cy, w: cardW, h: cardH, col: ac, idx: i };
        var isDone = i < activeIdx || (i === STATIONS.length - 1 && u >= 0.99);
        var isAct = i === activeIdx && !isDone;
        var pct = isDone ? 1 : (isAct ? subU : 0);

        c.fillStyle = V.card; roundRect(c, cx, cy, cardW, cardH, 4); c.fill();
        c.strokeStyle = st.borderCol || (isAct ? V.acc2 : (isDone ? V.line2 : V.line)); c.lineWidth = isAct ? 1.2 : 1;
        roundRect(c, cx + 0.5, cy + 0.5, cardW - 1, cardH - 1, 4); c.stroke();

        var hdrH = tiny ? 12 : 14, ix = cx + (compact ? 5 : 7), iw = cardW - (compact ? 10 : 14);
        if (isAct) {
          c.fillStyle = D ? ac : V.deep; roundRect(c, cx + 1, cy + 1, cardW - 2, hdrH, 3); c.fill();
          specEdge(c, cx + 1, cy + 1, cardW - 2);
        } else { c.strokeStyle = V.line; ln(c, cx + 1, cy + hdrH + 1.5, cx + cardW - 1, cy + hdrH + 1.5); }
        var fT = cardW < 150 ? fz(fI, 6.4, 7, 7) : fz(fI, 6.4, 8, 8);   /* 窄卡封頂 7 */
        var roleTxt = st.full || (D ? st.id + " " + st.role : st.role);
        tx(c, fitTxt(roleTxt, iw * 0.66, fT), ix, cy + 1 + hdrH / 2, fT, isAct ? "#ffffff" : V.ink, "left", "700");
        var stLabel = isDone ? "done" : (isAct ? Math.round(pct * 100) + "%" : "queued");
        tx(c, stLabel, cx + cardW - (compact ? 5 : 7), cy + 1 + hdrH / 2, fT - 1, isDone ? V.acc3 : (isAct ? "#ffffff" : V.mute), "right", "700");

        var yCur = cy + hdrH + 3;
        var fK = cardW < 150 ? fz(fI, 5.4, 5.8, 5.8) : fz(fI, 5.4, 6.4, 6.4);
        if (!compact) {
          tx(c, st.sub || ("kind/" + (st.kind || "step")), ix, yCur + 4, fK, V.dim);
          tx(c, "#" + st.id + " / " + (STATIONS.length < 10 ? "0" : "") + STATIONS.length, cx + cardW - 7, yCur + 4, fK, V.mute, "right");
          yCur += 9;
        }
        var kv = st.kv || [[st.k1, st.v1], [st.k2, st.v2]].filter(function (p) { return p[0] != null; });
        var footH = tiny ? 7 : 14;
        var room = cardH - (yCur - cy) - footH - (tiny ? 22 : 34);
        var nKv = Math.max(0, Math.min(kv.length, Math.floor(room / 8.5)));
        if (compact) nKv = 0;
        for (var kk = 0; kk < nKv; kk++) {
          var ky = yCur + 4 + kk * 8.5;
          leader(c, kv[kk][0], kv[kk][1], ix + 4, cx + cardW - 7, ky, fK, isAct);
          kvPort(c, cx + 0.5, ky, isDone || (isAct && kk / nKv <= pct + 0.01));
        }
        yCur += nKv * 8.5 + (nKv ? 4 : 2);

        var prevB = { x: ix, y: yCur, w: iw, h: cy + cardH - footH - yCur - 2 };
        if (prevB.h >= 14) drawPreview(c, st.kind, prevB, ac, pct, isAct, u, i);

        var barY = cy + cardH - footH + 1;
        c.fillStyle = V.track; c.fillRect(ix, Math.round(barY), iw, 2);
        if (pct > 0) { c.fillStyle = isAct ? (D ? ac : V.acc2) : V.acc; c.fillRect(ix, Math.round(barY), Math.max(2, iw * pct), 2); }
        if (!tiny) {
          tx(c, fitTxt(st.out || ("out/" + String(st.role).toLowerCase().replace(/\s+/g, "_")), iw * 0.7, 5.6), ix, barY + 8, 5.6, V.mute);
          tx(c, isDone ? "✓ handoff" : (isAct ? "rendering" : "—"), cx + cardW - 7, barY + 8, 5.6, isDone ? V.acc2 : V.mute, "right");
        }
      }

      if (hasEdges) {
        for (var ei = 0; ei < D.edges.length; ei++) {
          var ed = D.edges[ei], rA = cardRects[ed.from], rB = cardRects[ed.to];
          if (!rA || !rB) continue;
          var eCol = ed.when === "fail" ? RED : (ed.when === "pass" ? GREEN : V.acc2);
          var sx0 = rA.x + rA.w, sy0 = rA.y + rA.h * 0.5, ex0 = rB.x, ey0 = rB.y + rB.h * 0.5, pts;
          if (Math.abs(rA.y - rB.y) < 4 && rB.x > rA.x) {
            var midX = (sx0 + ex0) * 0.5; pts = [[sx0, sy0], [midX, sy0], [midX, ey0], [ex0, ey0]];
          } else {
            var busY = Math.min(rA.y + rA.h, rB.y + rB.h) + gapY * 0.48, stubA = sx0 + gapX * 0.35, stubB = ex0 - gapX * 0.35;
            pts = [[sx0, sy0], [stubA, sy0], [stubA, busY], [stubB, busY], [stubB, ey0], [ex0, ey0]];
          }
          c.strokeStyle = eCol + "88"; c.lineWidth = 1.2; drawRoundedOrth(c, pts, 4);
          var pkt = evalOrth(pts, (u * 2.4 + ei * 0.19) % 1);
          c.fillStyle = eCol; c.beginPath(); c.arc(pkt[0], pkt[1], 2.6, 0, Math.PI * 2); c.fill();
          c.fillStyle = FG; c.beginPath(); c.arc(pkt[0], pkt[1], 1.1, 0, Math.PI * 2); c.fill();
          drawPortDot(c, sx0, sy0, 2.3, eCol, true); drawPortDot(c, ex0, ey0, 2.3, eCol, true);
        }
      }
      return "STAGE " + aSt.id + " " + aSt.role + " · " + Math.round(subU * 100) + "%";
    }, o);
  }

  /* 三層破框埠點（V 色票版：knockout 用 V.bg，待機外環 V.line2） */
  function vPort(c, x, y, r, col, lit) {
    c.fillStyle = V.bg; c.beginPath(); c.arc(x, y, r + 1.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = lit ? col : V.line2; c.lineWidth = lit ? 1.4 : 1;
    c.beginPath(); c.arc(x, y, r + 0.6, 0, Math.PI * 2); c.stroke();
    c.fillStyle = lit ? col : V.mute; c.beginPath(); c.arc(x, y, Math.max(1.4, r * 0.58), 0, Math.PI * 2); c.fill();
  }
  function sn(v) { return Math.round(v) + 0.5; }

  /* #65 pcbBus — PCB 正交匯流排 (driver n=60)
   * S1 比照 #64：V 單色 6 階、群組鏡面頂邊、作用群組雙層光暈、節點虛點鍵值列＋壓框微埠點、三層破框端子、熱核彗尾封包 */
  function pcbBus(cv, _data, opt) {
    var K = g.A23Tex.kit(g.A23Tex.THEMES.violet), V = K.V, fI = 10;   /* fI 由 draw 依寬度更新，drawChip 共用 */
    var o = opt || {};
    var nFrames = 60;
    var GROUPS = [
      { name: "PRE-PROD",  col: V.acc3, nodes: ["INGEST", "SCRIPT", "POSE"] },
      { name: "SYNTHESIS", col: V.acc2, nodes: ["KEYFRAME", "MOTION", "RENDER"] },
      { name: "POST-MIX",  col: V.acc,  nodes: ["VOICE", "FOLEY", "MASTER"] }
    ];

    function drawChip(c, x, y, label, col, act, small) {
      var f = small ? fz(fI, 6.6, 6.6, 6.6) : fz(fI, 6.6, 6.6, 8);
      c.font = "700 " + f + "px " + MONO;
      var cw = Math.round(c.measureText(label).width + (small ? 12 : 16)), ch = small ? 12 : 15;
      var x0 = Math.round(x - cw / 2), y0 = Math.round(y - ch / 2);
      c.fillStyle = act ? V.acc2 : V.line2;
      for (var pi = -1; pi <= 1; pi++) {
        var px = Math.round(x + pi * cw * 0.28) - 1;
        c.fillRect(px, y0 - 2, 2, 2); c.fillRect(px, y0 + ch, 2, 2);
      }
      c.fillStyle = V.pane; roundRect(c, x0, y0, cw, ch, 2); c.fill();
      c.strokeStyle = act ? col : V.line2; c.lineWidth = 1; roundRect(c, x0 + 0.5, y0 + 0.5, cw - 1, ch - 1, 2); c.stroke();
      specEdge(c, x0 + 1, y0 + 1, cw - 2, 0.06);
      c.fillStyle = act ? col : V.mute; c.fillRect(x0 + 2, y0 + 3, 1, 1); /* pin-1 標記 */
      tx(c, label, x0 + cw / 2, y0 + ch / 2 + 0.5, f, act ? V.ink : V.txt, "center", "700");
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380, mid = w < 540;
      var u = clamp(t / (nFrames - 1), 0, 1);
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      dotGrid(c, 0, 0, w, h, 12, V.dot);
      var pad = compact ? 8 : 14;
      var topH = compact ? 20 : 24;
      var gIdx = Math.min(8, Math.floor(u * 8.999)), activeGrp = Math.floor(gIdx / 3), activeNi = gIdx % 3;
      var subU = clamp(u * 8.999 - gIdx, 0, 1), allDone = u >= 0.995;
      var aG = GROUPS[activeGrp];

      fI = Math.min(10, K.infoFont(w));
      tx(c, compact ? "PCB ORTHO BUS" : "STU 02 · PCB ORTHOGONAL AGENT BUS · MANHATTAN ROUTING", pad, topH * 0.5, fz(fI, 7, 8.5, 8.5), V.acc3, "left", "700");
      tx(c, (compact ? aG.name : "GRP " + aG.name + " · " + aG.nodes[activeNi]) + " · " + Math.round(u * 100) + "%", w - pad, topH * 0.5, fz(fI, 6.5, 7.5, 7.5), V.dim, "right", "600");

      var areaTop = topH + 6;
      var areaH = h - areaTop - pad;
      var areaW = w - pad * 2;
      var traces = [];
      var nodeBoxes = [];
      var frames = [];

      {
        var colGap = compact ? 14 : (mid ? 28 : 48), gHd = compact ? 13 : 16;
        var grpW = (areaW - colGap * 2) / 3;
        for (var gdi = 0; gdi < 3; gdi++) {
          var gx0 = pad + gdi * (grpW + colGap);
          frames.push({ x: gx0, y: areaTop, w: grpW, h: areaH, gi: gdi });
          var nTop = areaTop + gHd + (compact ? 5 : 10);
          var nAreaH = areaH - (nTop - areaTop) - (compact ? 5 : 8);
          var nVGap = compact ? 6 : (h < 390 ? 12 : 20), nIn = compact ? 4 : 10;
          var nBH = (nAreaH - nVGap * 2) / 3;
          var colList = [];
          for (var ndi = 0; ndi < 3; ndi++) {
            colList.push({ x: gx0 + nIn, y: nTop + ndi * (nBH + nVGap), w: grpW - nIn * 2, h: nBH, name: GROUPS[gdi].nodes[ndi], gi: gdi, ni: ndi, inY: [] });
          }
          nodeBoxes.push(colList);
        }
        for (var gti = 0; gti < 3; gti++) {
          var gn = nodeBoxes[gti];
          for (var vi = 0; vi < 2; vi++) {
            var vx = sn(gn[vi].x + gn[vi].w * 0.5);
            traces.push({ pts: [[vx, sn(gn[vi].y + gn[vi].h)], [vx, sn(gn[vi + 1].y)]], gi: gti, chip: null, act: activeGrp === gti });
          }
        }
        var chSpecs = [
          { fromG: 0, fromN: 0, toG: 1, toN: 0, off: -10, chip: "BUS-A" },
          { fromG: 0, fromN: 1, toG: 1, toN: 1, off: 0,   chip: "POSE-12" },
          { fromG: 0, fromN: 2, toG: 1, toN: 1, off: 10,  chip: null },
          { fromG: 0, fromN: 2, toG: 1, toN: 2, off: -6,  chip: "MUX-02" },
          { fromG: 1, fromN: 0, toG: 2, toN: 0, off: -8,  chip: "LUT-3D" },
          { fromG: 1, fromN: 1, toG: 2, toN: 1, off: 4,   chip: "SYNC-48" },
          { fromG: 1, fromN: 2, toG: 2, toN: 2, off: -8,  chip: "DMA-OUT" },
          { fromG: 1, fromN: 1, toG: 2, toN: 2, off: 10,  chip: null }
        ];
        for (var cs = 0; cs < chSpecs.length; cs++) {
          var sp = chSpecs[cs];
          var aN = nodeBoxes[sp.fromG][sp.fromN], bN = nodeBoxes[sp.toG][sp.toN];
          var sx0 = sn(aN.x + aN.w), dx0 = sn(bN.x) - 1;
          var sy0 = sn(aN.y + aN.h * (sp.fromN === sp.toN ? 0.5 : 0.65));
          var dy0 = sn(bN.y + bN.h * (sp.fromN === sp.toN ? 0.5 : 0.35));
          var midX = sn((sx0 + dx0) * 0.5 + sp.off * colGap / 48);
          bN.inY.push(dy0);
          traces.push({
            pts: (Math.abs(sy0 - dy0) < 1) ? [[sx0, sy0], [dx0, dy0]] : [[sx0, sy0], [midX, sy0], [midX, dy0], [dx0, dy0]],
            gi: sp.fromG, chip: compact ? null : sp.chip, chipPt: [midX, (sy0 + dy0) * 0.5],
            act: activeGrp === sp.fromG || activeGrp === sp.toG
          });
        }
      }

      /* 1) 群組外框：作用群組＝雙層光暈＋深紫頂欄；其餘細框＋鏡面頂邊 */
      var fG = fz(fI, 6.6, 7.5, 8.5), hH = compact ? 13 : 16;
      for (var fi = 0; fi < frames.length; fi++) {
        var fr = frames[fi], isActG = fr.gi === activeGrp && !allDone, gDone = allDone || gIdx >= (fr.gi + 1) * 3;
        if (isActG) activeHalo(c, fr.x, fr.y, fr.w, fr.h, compact ? 6 : 12);
        c.fillStyle = V.card; roundRect(c, fr.x, fr.y, fr.w, fr.h, 5); c.fill();
        c.strokeStyle = isActG ? V.acc2 : (gDone ? V.line2 : V.line); c.lineWidth = 1;
        roundRect(c, sn(fr.x), sn(fr.y), Math.round(fr.w) - 1, Math.round(fr.h) - 1, 5); c.stroke();
        if (isActG) { c.fillStyle = V.deep; roundRect(c, fr.x + 1, fr.y + 1, fr.w - 2, hH, 4); c.fill(); }
        else { c.strokeStyle = V.line; ln(c, fr.x + 1, Math.round(fr.y + hH + 1) + 0.5, fr.x + fr.w - 1, Math.round(fr.y + hH + 1) + 0.5); }
        specEdge(c, fr.x + 2, fr.y + 1, fr.w - 4, isActG ? 0.1 : 0.05);
        tx(c, compact ? fitTxt(GROUPS[fr.gi].name, fr.w - 18, fG) : GROUPS[fr.gi].name, fr.x + (compact ? 5 : 8), fr.y + 1 + hH / 2, fG, isActG ? "#ffffff" : GROUPS[fr.gi].col, "left", "700");
        tx(c, compact ? (isActG ? "●" : (gDone ? "✓" : "")) : (isActG ? "● live" : (gDone ? "✓ done" : "idle")), fr.x + fr.w - (compact ? 5 : 8), fr.y + 1 + hH / 2, fG - 1, isActG ? "#ffffff" : (gDone ? V.acc3 : V.mute), "right", "700");
      }

      /* 2) 正交走線（arcTo 導角）：作用通道＝群組色、待機＝暗紫 */
      var rad = compact ? 5 : 8;
      for (var ti = 0; ti < traces.length; ti++) {
        var tr = traces[ti];
        c.strokeStyle = tr.act ? GROUPS[tr.gi].col + "99" : V.line2;
        c.lineWidth = 1;
        drawRoundedOrth(c, tr.pts, rad);
      }

      /* 3) 節點晶片卡：頂欄＋虛點鍵值列＋壓框微埠點（依進度由上而下點亮）＋底部細進度條 */
      var fN = fz(fI, 6.4, 7.5, 9);
      var fK = fz(fI, 5.8, 6.6, 8);
      for (var gi2 = 0; gi2 < nodeBoxes.length; gi2++) {
        for (var ni2 = 0; ni2 < nodeBoxes[gi2].length; ni2++) {
          var nb = nodeBoxes[gi2][ni2], gidx = gi2 * 3 + ni2;
          var isDone = allDone || gidx < gIdx, isActN = !isDone && gidx === gIdx;
          var pct = isDone ? 1 : (isActN ? subU : 0);
          var bx = Math.round(nb.x), by = Math.round(nb.y), bw = Math.round(nb.w), bh = Math.round(nb.h);
          c.fillStyle = isActN ? K.mix(V.bg, V.acc, 0.07) : V.pane; roundRect(c, bx, by, bw, bh, 3); c.fill();
          c.strokeStyle = isActN ? V.acc2 : (isDone ? V.line2 : V.line); c.lineWidth = 1;
          roundRect(c, bx + 0.5, by + 0.5, bw - 1, bh - 1, 3); c.stroke();
          var nhH = Math.min(compact ? 11 : 15, bh - 2);
          if (isActN) { c.fillStyle = V.deep; roundRect(c, bx + 1, by + 1, bw - 2, nhH, 2); c.fill(); }
          else { c.strokeStyle = V.line; ln(c, bx + 1, by + nhH + 1.5, bx + bw - 1, by + nhH + 1.5); }
          specEdge(c, bx + 1, by + 1, bw - 2, isActN ? 0.1 : 0.05);
          var ix = bx + (compact ? 5 : 7), xr = bx + bw - (compact ? 5 : 7), hy = by + 1 + nhH / 2;
          tx(c, fitTxt(nb.name, bw * 0.62, fN), ix, hy, fN, isActN ? "#ffffff" : V.ink, "left", "700");
          tx(c, isDone ? "done" : (isActN ? Math.round(pct * 100) + "%" : "queued"), xr, hy, fN - 1.5, isDone ? V.acc3 : (isActN ? "#ffffff" : V.mute), "right", "700");
          var kv = [
            ["rate", (18 + Math.round(hashLcg(gidx, 77) * 40)) + " MB/s"],
            ["lat", (2 + Math.round(hashLcg(gidx, 91) * 14)) + " ms"],
            ["queue", String(Math.round(hashLcg(gidx, 53) * 6))],
            ["lane", "B" + (gi2 + 1) + "." + (ni2 + 1)]
          ];
          var rowH = fK + (compact ? 3 : 4.5);
          var ky0 = by + nhH + 2 + rowH * 0.6;
          var nKv = Math.max(0, Math.min(kv.length, Math.floor((by + bh - 8 - ky0 + rowH * 0.5) / rowH)));
          for (var k = 0; k < nKv; k++) {
            var ky = Math.round(ky0 + k * rowH);
            leader(c, kv[k][0], kv[k][1], ix + 2, xr, ky, fK, isActN);
            var clash = false;
            for (var q = 0; q < nb.inY.length; q++) if (Math.abs(nb.inY[q] - ky) < 6) clash = true;
            if (!clash) kvPort(c, bx + 0.5, ky, isDone || (isActN && k / nKv <= pct + 0.01));
          }
          var pby = by + bh - (compact ? 4 : 5), pbw = xr - ix;
          if (bh < nhH + 9) continue;
          c.fillStyle = V.track; c.fillRect(ix, pby, pbw, 2);
          if (pct > 0) { c.fillStyle = isActN ? V.acc2 : V.acc; c.fillRect(ix, pby, Math.max(2, pbw * pct), 2); }
        }
      }

      /* 4) 端子：三層破框埠點（咬出卡框缺口） */
      var pr = compact ? 2 : 2.4;
      for (var pi2 = 0; pi2 < traces.length; pi2++) {
        var tp = traces[pi2], col = GROUPS[tp.gi].col;
        vPort(c, tp.pts[0][0], tp.pts[0][1], pr, col, tp.act);
        vPort(c, tp.pts[tp.pts.length - 1][0], tp.pts[tp.pts.length - 1][1], pr, col, tp.act);
      }

      /* 5) 封包：作用通道＝外圈群組色＋白熱核＋3 點彗尾；待機通道＝暗點 */
      for (var pk = 0; pk < traces.length; pk++) {
        var ptr = traces[pk];
        var frac = (u * (ptr.act ? 2.2 : 1.3) + hashLcg(pk, 313)) % 1;
        if (ptr.act) hotPacket(c, ptr.pts, frac, GROUPS[ptr.gi].col, compact ? 2.2 : 2.6);
        else { var dp = evalOrth(ptr.pts, frac); c.fillStyle = V.mute; c.beginPath(); c.arc(dp[0], dp[1], 1.3, 0, Math.PI * 2); c.fill(); }
      }

      /* 6) SMD 晶片標記最後畫，確保可讀 */
      for (var chi = 0; chi < traces.length; chi++) {
        var ctr = traces[chi];
        if (ctr.chip && ctr.chipPt) drawChip(c, ctr.chipPt[0], ctr.chipPt[1], ctr.chip, GROUPS[ctr.gi].col, ctr.act, compact || mid);
      }

      return "PCB BUS · " + aG.name + " · " + aG.nodes[activeNi] + " · " + Math.round(subU * 100) + "%";
    }, o);
  }

  /* #66 nleTimeline — 非線性剪輯多軌時間軸 (driver n=60)
   * S2 比照 #64：V 單色 6 階、軌道標頭 pane＋點陣底、片段 1px 鏡面高光＋作用片段光暈、
   * 麵包屑／SMPTE 時間碼字級統一、播放頭 1px 白線 +0.5 對齊、波形單色 6 階 */
  function nleTimeline(cv, _data, opt) {
    var K = g.A23Tex.kit(g.A23Tex.THEMES.violet), V = K.V;
    var C_RUN_F = K.mix(V.bg, RED, 0.14), C_RUN = K.mix(V.bg, V.acc, 0.17), C_HIT_F = K.mix(V.bg, RED, 0.08), C_HIT = K.mix(V.bg, V.acc, 0.11);
    var o = opt || {};
    var D = o.data || (_data && _data.tracks ? _data : null);
    var nFrames = 60;

    var STAGES = (D && Array.isArray(D.stages) && D.stages.length) ? D.stages : ["INGEST", "POSE", "FRAMES", "AUDIO", "GRADE", "EXPORT"];
    var TRACKS = (D && Array.isArray(D.tracks) && D.tracks.length) ? D.tracks : [
      { id: "SUB",   full: "SUBTITLE",   col: V.acc3, kind: "sub",   code: "V3" },
      { id: "BOARD", full: "STORYBOARD", col: V.acc2, kind: "shots", code: "V2" },
      { id: "BG",    full: "BACKDROP",   col: V.acc,  kind: "bg",    code: "V1" },
      { id: "MUSIC", full: "MUSIC WAVE", col: V.acc2, kind: "wave",  code: "A1" },
      { id: "FOLEY", full: "FOLEY TICKS",col: V.acc3, kind: "ticks", code: "A2" }
    ];
    var SUB_CLIPS = [
      { s: 0.02, e: 0.22, lbl: "HOOK" }, { s: 0.24, e: 0.48, lbl: "BEAT 01" },
      { s: 0.51, e: 0.76, lbl: "BEAT 02" }, { s: 0.79, e: 0.97, lbl: "CTA" }
    ];
    var SHOT_CLIPS = [
      { s: 0.00, e: 0.19, lbl: "SH-01" }, { s: 0.20, e: 0.39, lbl: "SH-02" }, { s: 0.40, e: 0.62, lbl: "SH-03" },
      { s: 0.63, e: 0.81, lbl: "SH-04" }, { s: 0.82, e: 0.99, lbl: "SH-05" }
    ];
    var BG_CLIPS = [
      { s: 0.00, e: 0.35, lbl: "STAGE-DARK" }, { s: 0.36, e: 0.78, lbl: "NEON-GRID" }, { s: 0.79, e: 1.00, lbl: "OUTRO-CARD" }
    ];
    var FOLEY_PTS = [
      { f: 0.08, lbl: "STEP" }, { f: 0.20, lbl: "CUT" }, { f: 0.31, lbl: "CLAP" },
      { f: 0.40, lbl: "WHOOSH" }, { f: 0.54, lbl: "SNAP" }, { f: 0.63, lbl: "CUT" },
      { f: 0.74, lbl: "HIT" }, { f: 0.82, lbl: "RISER" }, { f: 0.92, lbl: "LOCK" }
    ];
    var RAMP = [V.line2, V.deep, V.acc, V.acc2, V.acc3, V.ink]; /* 單色 6 階明度 */

    function fmtTimecode(u) {
      var totalFrames = Math.round(u * 20 * 30);
      var ff = totalFrames % 30;
      var ss = Math.floor(totalFrames / 30);
      return "00:00:" + (ss < 10 ? "0" + ss : ss) + ":" + (ff < 10 ? "0" + ff : ff);
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380, mid = w < 540;
      var u = clamp(t / (nFrames - 1), 0, 1);
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      dotGrid(c, 0, 0, w, h, 12, V.dot);
      var pad = compact ? 8 : 14;
      var fI = Math.min(10, K.infoFont(w));
      var fB = fz(fI, 6.4, 7.5, 8.5);           /* 統一字級：麵包屑＝時間碼－1 */
      var curStage = Math.min(STAGES.length - 1, Math.floor(u * (STAGES.length - 0.001)));

      /* 1) 工序麵包屑 */
      var bcY = compact ? 12 : 15;
      var stepW = (w - pad * 2) / STAGES.length;
      for (var si = 0; si < STAGES.length; si++) {
        var sx = pad + si * stepW, done = si < curStage, act = si === curStage, cxMid = sx + stepW * 0.5;
        if (act) {
          c.fillStyle = V.deep; roundRect(c, Math.round(sx + 2), Math.round(bcY - 7), Math.round(stepW - 4), 14, 3); c.fill();
          specEdge(c, Math.round(sx + 3), Math.round(bcY - 7), Math.round(stepW - 6), 0.1);
        }
        tx(c, fitTxt((done ? "✓ " : "") + STAGES[si], stepW - 8, fB), cxMid, bcY, fB, act ? "#ffffff" : (done ? V.acc3 : V.mute), "center", (act || done) ? "700" : "400");
        if (si < STAGES.length - 1) tx(c, "›", sx + stepW, bcY, fB, V.line2, "center");
      }

      /* 2) 走帶列（pane 樣式）＋ SMPTE 時間碼 */
      var tbTop = bcY + (compact ? 10 : 12), tbH = compact ? 20 : 24;
      K.pane(c, { x: pad, y: tbTop, w: w - pad * 2, h: tbH });   /* 工具列子窗（無標籤＝原手繪 pane，像素一致） */
      specEdge(c, pad + 2, tbTop + 1, w - pad * 2 - 4, 0.06);
      var btnMidY = Math.round(tbTop + tbH * 0.5), bStep = compact ? 15 : 19, btns = ["start", "rew", "play", "fwd", "end"];
      for (var bi = 0; bi < btns.length; bi++) {
        var bx = pad + 11 + bi * bStep, kind = btns[bi];
        if (kind === "play") {
          c.fillStyle = V.deep; roundRect(c, bx - 7, btnMidY - 7, 14, 14, 3); c.fill();
          specEdge(c, bx - 6, btnMidY - 7, 12, 0.1);
        }
        c.fillStyle = kind === "play" ? "#ffffff" : V.dim;
        c.beginPath();
        if (kind === "play") { c.moveTo(bx - 2.5, btnMidY - 3.8); c.lineTo(bx + 3.8, btnMidY); c.lineTo(bx - 2.5, btnMidY + 3.8); }
        else if (kind === "start") { c.fillRect(bx - 4, btnMidY - 3.5, 1.5, 7); c.moveTo(bx + 3, btnMidY - 3.5); c.lineTo(bx - 2, btnMidY); c.lineTo(bx + 3, btnMidY + 3.5); }
        else if (kind === "end") { c.fillRect(bx + 2.5, btnMidY - 3.5, 1.5, 7); c.moveTo(bx - 3, btnMidY - 3.5); c.lineTo(bx + 2, btnMidY); c.lineTo(bx - 3, btnMidY + 3.5); }
        else if (kind === "rew") { c.moveTo(bx + 3, btnMidY - 3.2); c.lineTo(bx - 2.5, btnMidY); c.lineTo(bx + 3, btnMidY + 3.2); }
        else { c.moveTo(bx - 3, btnMidY - 3.2); c.lineTo(bx + 2.5, btnMidY); c.lineTo(bx - 3, btnMidY + 3.2); }
        c.closePath(); c.fill();
      }
      var tcX = w - pad - 8;
      if (!compact) {
        tx(c, " / 00:00:20:00", tcX, btnMidY, fB, V.mute, "right", "600");
        c.font = "600 " + fB + "px " + MONO; tcX -= c.measureText(" / 00:00:20:00").width;
      }
      tx(c, fmtTimecode(u), tcX, btnMidY, fB + 1, V.ink, "right", "700");
      if (!mid) {
        c.font = "700 " + (fB + 1) + "px " + MONO;
        tx(c, "30 FPS · 1080×1920 · REC709", tcX - c.measureText("00:00:00:00").width - 14, btnMidY, fB - 1, V.mute, "right");
      }
      if (!compact) tx(c, STAGES[curStage].toUpperCase(), pad + 11 + 5 * bStep + 4, btnMidY, fB - 1, V.dim, "left", "600");

      /* 3) 時間軸主容器 */
      var tlTop = tbTop + tbH + (compact ? 5 : 7), tlH = h - tlTop - pad;
      var hdrW = compact ? 46 : (mid ? 64 : 92);
      var laneX = Math.round(pad + hdrW), laneW = w - pad - laneX;
      var rulerH = compact ? 14 : 18;
      c.fillStyle = V.card; roundRect(c, pad, tlTop, w - pad * 2, tlH, 4); c.fill();
      c.strokeStyle = V.line; c.lineWidth = 1; roundRect(c, pad + 0.5, tlTop + 0.5, w - pad * 2 - 1, tlH - 1, 4); c.stroke();
      specEdge(c, pad + 2, tlTop + 1, w - pad * 2 - 4, 0.07);
      /* 軌道標頭欄：pane 底＋6px 點陣 */
      c.fillStyle = V.pane; c.fillRect(pad + 1, tlTop + 1, hdrW - 1, tlH - 2);
      dotGrid(c, pad + 1, tlTop + rulerH, hdrW - 1, tlH - rulerH - 1, 6, V.dot2);
      c.strokeStyle = V.line; ln(c, laneX + 0.5, tlTop + 1, laneX + 0.5, tlTop + tlH - 1);
      tx(c, compact ? "TRK" : "TRACKS · " + TRACKS.length, pad + 6, tlTop + rulerH * 0.5, 5.4, V.mute);

      /* 尺規：+0.5 亞像素刻度 */
      var nTicks = compact ? 40 : 60;
      for (var tk = 0; tk <= nTicks; tk++) {
        var tkx = Math.round(laneX + (tk / nTicks) * laneW) + 0.5;
        var major = tk % (nTicks / 5) === 0;
        c.strokeStyle = major ? V.dim : V.line2; c.lineWidth = 1;
        ln(c, tkx, Math.round(tlTop + rulerH - (major ? rulerH * 0.5 : rulerH * 0.22)), tkx, tlTop + rulerH);
        if (major && tk < nTicks) tx(c, Math.round((tk / nTicks) * 20) + "s", tkx + 3, tlTop + 6, Math.max(6, fB - 2), V.mute, "left");
      }
      c.strokeStyle = V.line; ln(c, pad + 1, Math.round(tlTop + rulerH) + 0.5, w - pad - 1, Math.round(tlTop + rulerH) + 0.5);

      var tracksTop = tlTop + rulerH, tracksH = tlH - rulerH - 2, trH = tracksH / TRACKS.length;
      var playX = Math.round(laneX + u * laneW) + 0.5;
      var fC = fz(fI, 6, 6.8, 7.5);

      function clip(x, y, cw, ch, col, lbl, state, fail) {
        /* state: 0=未到, 1=已過, 2=播放頭命中 */
        var bc = fail ? RED : col;
        x = Math.round(x); y = Math.round(y); cw = Math.round(cw); ch = Math.round(ch);
        if (state === 2) {
          c.save(); c.shadowColor = fail ? "rgba(239,68,68,0.5)" : "rgba(139,92,246,0.55)"; c.shadowBlur = compact ? 5 : 9;
          c.strokeStyle = fail ? "rgba(239,68,68,0.7)" : "rgba(139,92,246,0.7)"; c.lineWidth = 1;
          roundRect(c, x - 2.5, y - 2.5, cw + 5, ch + 5, 4); c.stroke(); c.restore();
        }
        c.fillStyle = state === 2 ? (fail ? C_RUN_F : C_RUN) : (state === 1 ? (fail ? C_HIT_F : C_HIT) : V.pane);
        roundRect(c, x, y, cw, ch, 2); c.fill();
        c.strokeStyle = state === 2 ? (fail ? RED : V.acc3) : (state === 1 ? bc + "aa" : (fail ? RED + "77" : V.line2));
        c.lineWidth = 1; roundRect(c, x + 0.5, y + 0.5, cw - 1, ch - 1, 2); c.stroke();
        specEdge(c, x + 1, y + 1, cw - 2, state === 2 ? 0.12 : 0.05);
        if (state > 0 || fail) { c.fillStyle = bc; c.fillRect(x + 1, y + 2, 2, ch - 4); } /* 片段色標 */
        if (cw > 22 && lbl) tx(c, fitTxt(lbl, cw - 9, fC), x + 6, y + ch * 0.5 + 0.5, fC, state === 2 ? V.ink : (state === 1 ? V.txt : V.dim), "left", "600");
      }

      for (var ti = 0; ti < TRACKS.length; ti++) {
        var tr = TRACKS[ti];
        var ty = tracksTop + ti * trH;
        var tcol = tr.col || V.acc2;
        if (ti > 0) { c.strokeStyle = V.line; ln(c, pad + 1, Math.round(ty) + 0.5, w - pad - 1, Math.round(ty) + 0.5); }
        /* 軌道標頭：色標＋名稱（fitTxt 防壓到首片段）＋軌碼 */
        c.fillStyle = tcol; c.fillRect(pad + 3, Math.round(ty + 4), 2, Math.max(2, Math.round(trH - 8)));
        var code = tr.code || ("T" + (ti + 1));
        var showCode = hdrW >= 64 && trH >= 14;
        var lblMax = hdrW - 14 - (showCode ? 16 : 0);
        tx(c, fitTxt((compact || mid) ? (tr.id || tr.full) : (tr.full || tr.id), lblMax, fB - 0.5), pad + 9, ty + trH * 0.5, fB - 0.5, V.ink, "left", "700");
        if (showCode) tx(c, code, laneX - 5, ty + trH * 0.5, 5.4, V.mute, "right");

        var clipY = ty + Math.max(3, trH * 0.16), clipH = Math.max(8, trH * 0.68);
        if (tr.kind === "clips" || tr.kind === "sub" || tr.kind === "shots" || tr.kind === "bg") {
          var arr = tr.kind === "clips" ? (tr.clips || []) : (tr.kind === "sub" ? SUB_CLIPS : (tr.kind === "shots" ? SHOT_CLIPS : BG_CLIPS));
          for (var ci = 0; ci < arr.length; ci++) {
            var cl = arr[ci];
            var cx0 = laneX + cl.s * laneW + 1, cw0 = Math.max(6, (cl.e - cl.s) * laneW - 2);
            var st = (playX >= cx0 && playX <= cx0 + cw0) ? 2 : (cx0 + cw0 < playX ? 1 : 0);
            clip(cx0, clipY, cw0, clipH, tcol, cl.lbl, st, !!cl.fail);
          }
        } else if (tr.kind === "wave") {
          var wy = Math.round(clipY), wh = Math.round(clipH);
          c.fillStyle = V.pane; roundRect(c, laneX + 2, wy, laneW - 4, wh, 2); c.fill();
          c.strokeStyle = V.line2; roundRect(c, laneX + 2.5, wy + 0.5, laneW - 5, wh - 1, 2); c.stroke();
          specEdge(c, laneX + 3, wy + 1, laneW - 6, 0.05);
          var nBars = compact ? 48 : 76, bwd = (laneW - 8) / nBars, midW = wy + wh * 0.5;
          c.strokeStyle = V.line; ln(c, laneX + 4, Math.round(midW) + 0.5, laneX + laneW - 4, Math.round(midW) + 0.5);
          for (var wi = 0; wi < nBars; wi++) {
            var wx = laneX + 4 + wi * bwd;
            var env = 0.35 + 0.65 * Math.abs(Math.sin(wi * 0.35));
            var lv = (0.2 + 0.75 * hashLcg(wi, 521)) * env;
            var amp = lv * (wh * 0.42);
            var lvl = Math.min(playX - wx < laneW * 0.04 ? 5 : 4, 1 + Math.floor(lv * 5));
            c.fillStyle = wx <= playX ? RAMP[lvl] : RAMP[0];
            c.fillRect(Math.round(wx), Math.round(midW - amp), Math.max(1, Math.round(bwd * 0.6)), Math.max(1, Math.round(amp * 2)));
          }
        } else {
          /* Foley 瞬態菱形：已過＝亮紫、剛觸發＝白熱核、未到＝暗 */
          var midT = Math.round(clipY + clipH * 0.62) + 0.5;
          c.strokeStyle = V.line; ln(c, laneX + 2, midT, laneX + laneW - 2, midT);
          for (var fi = 0; fi < FOLEY_PTS.length; fi++) {
            var fp = FOLEY_PTS[fi];
            var fx = Math.round(laneX + fp.f * laneW) + 0.5;
            var passed = fx <= playX, hot = passed && playX - fx < laneW * 0.05;
            c.strokeStyle = passed ? V.acc2 : V.line2; c.lineWidth = 1;
            ln(c, fx, Math.round(clipY + 4), fx, Math.round(clipY + clipH - 1));
            if (hot) { c.save(); c.shadowColor = "rgba(196,181,253,0.8)"; c.shadowBlur = 6; }
            c.fillStyle = hot ? "#ffffff" : (passed ? V.acc3 : V.mute);
            c.beginPath(); c.moveTo(fx, clipY); c.lineTo(fx + 3, clipY + 3.5); c.lineTo(fx, clipY + 7); c.lineTo(fx - 3, clipY + 3.5); c.closePath(); c.fill();
            if (hot) c.restore();
            if (!mid) tx(c, fp.lbl, fx + 4, midT - 4, Math.max(6, fC - 1), passed ? V.txt : V.mute, "left");
          }
        }
      }

      /* 4) 播放頭：1px 白線 +0.5 對齊＋淡光帶＋尺規內紫色標頭 */
      c.fillStyle = "rgba(255,255,255,0.06)"; c.fillRect(playX - 1.5, tlTop + rulerH, 3, tlH - rulerH - 1);
      c.strokeStyle = "#ffffff"; c.lineWidth = 1; ln(c, playX, tlTop + 2, playX, tlTop + tlH - 1);
      c.fillStyle = V.acc3;
      c.beginPath(); c.moveTo(playX - 4, tlTop + 2); c.lineTo(playX + 4, tlTop + 2); c.lineTo(playX + 4, tlTop + 6); c.lineTo(playX, tlTop + 10); c.lineTo(playX - 4, tlTop + 6); c.closePath(); c.fill();

      return STAGES[curStage] + " · " + fmtTimecode(u);
    }, o);
  }

  /* #67 costDrop — 成本對照與匯出終端 (driver n=60)
   * S3 比照 #64：V 單色 6 階；中段補「插畫預覽窗」（匯出幀縮圖底片條）＋成本明細虛點鍵值列；
   * export 終端與進度條套 pane；語意綠只留「節省」，紅只留刪除線／攔截語意 */
  function costDrop(cv, _data, opt) {
    var K = g.A23Tex.kit(g.A23Tex.THEMES.violet), V = K.V;
    var o = opt || {};
    var D = o.data || (_data && _data.customCost ? _data : null);
    var nFrames = 60;

    var OLD_COST = (D && D.oldCost != null) ? D.oldCost : 4800;
    var NEW_COST = (D && D.newCost != null) ? D.newCost : 96;
    var DRIVERS = (D && Array.isArray(D.drivers)) ? D.drivers : [
      { lbl: "talent", pct: "-99%", frac: 0.99 },
      { lbl: "render", pct: "-94%", frac: 0.94 },
      { lbl: "audio",  pct: "-96%", frac: 0.96 }
    ];
    var TERM_LOGS = (D && Array.isArray(D.logs)) ? D.logs : [
      { thr: 0.08, txt: "> mux 5 tracks (sub/sb/bg/bgm/foley) [ok]" },
      { thr: 0.25, txt: "> encode h264 1080x1920 @ 30fps crf=18" },
      { thr: 0.45, txt: "> audio normalize -14.0 LUFS · peak -1.0dB" },
      { thr: 0.68, txt: "> verify sha256: 9f3a81c4..d7e2 [PASS]" },
      { thr: 0.86, txt: "> export ready: out/reel_0829.mp4 (18.4 MB)" }
    ];

    /* 微型舞者剪影：x=腳中心, gy=地面, s=身高, a=手臂相位 */
    function dancer(c, x, gy, s, a, col) {
      var hr = s * 0.15, hy = gy - s + hr, sh = hy + hr + s * 0.06, hip = gy - s * 0.36;
      c.save(); c.lineCap = "round"; c.strokeStyle = col; c.lineWidth = Math.max(1, s * 0.07);
      c.fillStyle = "rgba(139,92,246,0.18)"; c.beginPath(); c.ellipse(x, gy + 1, s * 0.22, s * 0.04, 0, 0, Math.PI * 2); c.fill();
      ln(c, x, sh, x, hip);
      ln(c, x, hip, x - s * 0.13 - a * s * 0.05, gy); ln(c, x, hip, x + s * 0.13 + a * s * 0.05, gy);
      ln(c, x, sh + s * 0.03, x - s * 0.27, sh + s * 0.08 - a * s * 0.3); ln(c, x, sh + s * 0.03, x + s * 0.27, sh + s * 0.08 + a * s * 0.3);
      c.fillStyle = col; c.beginPath(); c.arc(x, hy, hr, 0, Math.PI * 2); c.fill();
      c.restore();
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380, mid = w < 540;
      var u = clamp(t / (nFrames - 1), 0, 1);
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      dotGrid(c, 0, 0, w, h, 12, V.dot);
      var pad = compact ? 8 : 14, topH = compact ? 18 : 22, gap = compact ? 5 : 8;
      var fI = Math.min(10, K.infoFont(w));
      var fB = fz(fI, 6.4, 7.5, 8.5);
      var iw = w - pad * 2;

      var dropProg = easeOut(clamp(u * 1.18, 0, 1));
      var curCost = Math.round(lerp(OLD_COST, NEW_COST, dropProg));
      var savedAmt = OLD_COST - curCost;
      var savedPct = ((savedAmt / OLD_COST) * 100).toFixed(1);
      var exportProg = clamp(u * 1.05, 0, 1), expDone = exportProg >= 0.99;

      tx(c, (D && D.title) ? fitM(c, D.title, iw * 0.66, fz(fI, 7, 8.5, 8.5)) : (compact ? "COST DROP & EXPORT" : "STU 04 · COST DROP COMPARISON & EXPORT TERMINAL"), pad, topH * 0.55, fz(fI, 7, 8.5, 8.5), V.acc3, "left", "700");
      tx(c, (D && D.badgeRight) ? D.badgeRight : ("-" + savedPct + "% COST"), w - pad, topH * 0.55, fz(fI, 6.5, 7.5, 7.5), (D && D.badgeRight) ? V.dim : GREEN, "right", "700");

      var avail = h - topH - pad - gap * 2;
      var heroH = Math.round(clamp(avail * 0.31, compact ? 56 : 66, 118));
      var termH = Math.round(clamp(avail * 0.33, compact ? 52 : 70, 132));
      var midH = avail - heroH - termH;
      if (midH < 40) { termH += midH; midH = 0; }
      var curY = topH + 2;

      /* 1) 主比較卡：舊價刪除線 → 熱核封包虛點箭頭 → 新價倒數 */
      c.fillStyle = V.card; roundRect(c, pad, curY, iw, heroH, 4); c.fill();
      c.strokeStyle = V.line; c.lineWidth = 1; roundRect(c, pad + 0.5, curY + 0.5, iw - 1, heroH - 1, 4); c.stroke();
      specEdge(c, pad + 2, curY + 1, iw - 4, 0.07);
      var colW = iw * 0.38, leftCx = pad + iw * 0.2, rightCx = pad + iw * 0.8, midX = Math.round(pad + iw * 0.5);
      var fL = fz(fI, 6, 6.8, 7.5);
      tx(c, fitM(c, (D && D.oldLabel) ? D.oldLabel : "LEGACY STUDIO", colW, fL), leftCx, curY + 10, fL, V.mute, "center", "700");
      tx(c, fitM(c, (D && D.newLabel) ? D.newLabel : "PIPELINE COST", colW, fL), rightCx, curY + 10, fL, V.acc3, "center", "700");
      var oldSz = (D && D.oldText) ? fz(fI, 8.5, 10.5, 10.5) : fz(fI, 15, 18, 24);
      var oldTxt = (D && D.oldText) ? fitM(c, D.oldText, colW - 6, oldSz) : ("$" + fmtComma(OLD_COST));
      var oldY = Math.round(curY + heroH * 0.5);
      tx(c, oldTxt, leftCx, oldY, oldSz, V.dim, "center", "700");
      c.font = "700 " + oldSz + "px " + MONO;
      var halfSW = Math.min(colW / 2, c.measureText(oldTxt).width / 2 + 3), strikeFrac = clamp(u * 3.0, 0, 1);
      if (strikeFrac > 0) {
        c.strokeStyle = RED; c.lineWidth = compact ? 1.4 : 2;
        ln(c, leftCx - halfSW, oldY + 1, lerp(leftCx - halfSW, leftCx + halfSW, strikeFrac), oldY - 1);
      }
      var newSz = fz(fI, 18, 22, 30);
      tx(c, (D && D.newText) ? fitM(c, D.newText, colW, newSz) : ("$" + fmtComma(curCost)), rightCx, oldY, newSz, dropProg >= 0.98 ? "#ffffff" : V.ink, "center", "700");
      var fS = fz(fI, 5.8, 6.6, 7.5);
      tx(c, fitM(c, (D && D.oldSub) ? D.oldSub : "14 DAYS · 6 CREW", colW, fS), leftCx, curY + heroH - 9, fS, V.mute, "center", "600");
      tx(c, fitM(c, (D && D.newSub) ? D.newSub : "12 MIN · AUTO", colW, fS), rightCx, curY + heroH - 9, fS, V.txt, "center", "600");
      /* 中央：倍率晶片＋虛點導線＋熱核封包 */
      var pill = (D && D.midPill) ? D.midPill : "50×", pW = compact ? 30 : 40, pH = compact ? 13 : 16;
      var arY = Math.round(oldY + (compact ? 9 : 12)) + 0.5, ax0 = Math.round(midX - iw * 0.09), ax1 = Math.round(midX + iw * 0.09);
      c.setLineDash([1, 2]); c.strokeStyle = V.line2; c.lineWidth = 1; ln(c, ax0, arY, ax1, arY); c.setLineDash([]);
      c.fillStyle = V.acc2; c.beginPath(); c.moveTo(ax1 + 4, arY); c.lineTo(ax1 - 1, arY - 3); c.lineTo(ax1 - 1, arY + 3); c.closePath(); c.fill();
      vPort(c, ax0, arY, 1.6, V.acc2, true);
      if (dropProg < 0.98) hotPacket(c, [[ax0, arY], [ax1, arY]], (u * 3) % 1, V.acc2, compact ? 1.8 : 2.2);
      c.fillStyle = V.deep; roundRect(c, midX - pW / 2, Math.round(oldY - pH - (compact ? 2 : 4)), pW, pH, 3); c.fill();
      specEdge(c, midX - pW / 2 + 1, Math.round(oldY - pH - (compact ? 2 : 4)), pW - 2, 0.12);
      tx(c, fitM(c, pill, pW - 4, fz(fI, 6.6, 8, 8)), midX, Math.round(oldY - pH / 2 - (compact ? 2 : 4)) + 0.5, fz(fI, 6.6, 8, 8), "#ffffff", "center", "700");
      curY += heroH + gap;

      /* 2) 中段：插畫預覽窗（匯出幀底片條）＋成本明細虛點鍵值列 */
      if (midH > 0) {
        var lw = Math.round(iw * (compact ? 0.5 : 0.56)), rw = iw - lw - gap;
        var pv = pane(c, { x: pad, y: curY, w: lw, h: midH }, "preview · export frames", "f" + ("000" + Math.round(exportProg * 600)).slice(-4));
        dotGrid(c, pv.x, pv.y, pv.w, pv.h, 6, V.dot2);
        var nF = compact ? 4 : 6, fgap = compact ? 3 : 4;
        var fw = (pv.w - 6 - fgap * (nF - 1)) / nF, fh = Math.min(pv.h - 8, fw * 1.45), fy = Math.round(pv.y + (pv.h - fh) / 2);
        for (var k = 0; k < nF; k++) {
          var fx = Math.round(pv.x + 3 + k * (fw + fgap)), fwR = Math.round(fw), fhR = Math.round(fh);
          var rendered = (k + 1) / nF <= exportProg + 0.001, cur = !rendered && k / nF <= exportProg;
          if (cur) { c.save(); c.shadowColor = "rgba(139,92,246,0.55)"; c.shadowBlur = 8; c.strokeStyle = "rgba(139,92,246,0.7)"; roundRect(c, fx - 2.5, fy - 2.5, fwR + 5, fhR + 5, 3); c.stroke(); c.restore(); }
          c.fillStyle = rendered ? K.mix(V.bg, V.acc, 0.07) : V.pane; roundRect(c, fx, fy, fwR, fhR, 2); c.fill();
          c.strokeStyle = cur ? V.acc3 : (rendered ? V.line2 : V.line); c.lineWidth = 1; roundRect(c, fx + 0.5, fy + 0.5, fwR - 1, fhR - 1, 2); c.stroke();
          specEdge(c, fx + 1, fy + 1, fwR - 2, rendered || cur ? 0.1 : 0.04);
          if (rendered || cur) {
            if (rendered) { c.fillStyle = "rgba(139,92,246,0.16)"; c.beginPath(); c.arc(fx + fwR / 2, fy + fhR * 0.42, fwR * 0.42, 0, Math.PI * 2); c.fill(); }
            var a = Math.sin(u * 12 * Math.PI + k * 1.3);
            if (cur) dancer(c, fx + fwR / 2, fy + fhR * 0.86, fhR * 0.66, a, V.line2);
            if (cur) { c.save(); c.beginPath(); c.rect(fx, fy, fwR, fhR * clamp((exportProg * nF - k), 0.05, 1)); c.clip(); }
            dancer(c, fx + fwR / 2, fy + fhR * 0.86, fhR * 0.66, a, rendered ? V.acc3 : V.acc2);
            if (cur) { c.restore(); var scanY = Math.round(fy + fhR * clamp((exportProg * nF - k), 0.05, 1)) + 0.5; c.strokeStyle = "#ffffff"; ln(c, fx + 1, scanY, fx + fwR - 1, scanY); }
          } else {
            c.strokeStyle = V.line; c.setLineDash([1, 2]); ln(c, fx + 3, fy + fhR / 2 + 0.5, fx + fwR - 3, fy + fhR / 2 + 0.5); c.setLineDash([]);
          }
          if (fhR > 34) tx(c, "0" + (k + 1), fx + 3, fy + fhR - 5, 5.4, rendered ? V.dim : V.mute);
        }

        var bd = pane(c, { x: pad + lw + gap, y: curY, w: rw, h: midH }, "cost breakdown", (D ? "" : "USD"));
        var fK = fz(fI, 5.8, 6.8, 8), rowH = fK + (compact ? 6 : 8);
        var bx = bd.x + 6, bxr = bd.x + bd.w - 4, by0 = bd.y + rowH * 0.55;
        var nRows = Math.max(0, Math.min(DRIVERS.length, Math.floor((bd.h - rowH * 1.2) / rowH)));
        for (var di = 0; di < nRows; di++) {
          var dr = DRIVERS[di], ky = Math.round(by0 + di * rowH);
          var litD = dropProg >= (di + 1) / (DRIVERS.length + 1);
          leader(c, String(dr.lbl), String(dr.pct), bx + 2, bxr, ky, fK, litD);
          kvPort(c, bd.x - 1.5, ky, litD);
          var barW = bxr - bx - 2, fr = clamp(dr.frac == null ? 0 : dr.frac, 0, 1) * clamp(dropProg * 1.1, 0, 1);
          c.fillStyle = V.track; c.fillRect(bx + 2, ky + Math.round(fK * 0.6) + 1, barW, 1);
          c.fillStyle = D && dr.col ? dr.col : V.acc2; c.fillRect(bx + 2, ky + Math.round(fK * 0.6) + 1, Math.max(1, Math.round(barW * fr)), 1);
        }
        /* 合計列：唯一語意綠＝節省 */
        if (!D && bd.h >= rowH * (nRows + 1)) {
          var tyS = Math.round(bd.y + bd.h - rowH * 0.6);
          c.strokeStyle = V.line; ln(c, bx, tyS - Math.round(rowH * 0.5) + 0.5, bxr, tyS - Math.round(rowH * 0.5) + 0.5);
          tx(c, "saved", bx + 2, tyS, fK, V.dim, "left", "600");
          tx(c, "$" + fmtComma(savedAmt) + " · " + savedPct + "%", bxr, tyS, fK, GREEN, "right", "700");
        }
        curY += midH + gap;
      }

      /* 3) 匯出終端（pane）＋細進度條 */
      var tm = pane(c, { x: pad, y: curY, w: iw, h: termH }, "export · " + ((D && D.title) ? "pipeline" : "reel_0829.mp4"), expDone ? "✓ done" : "exporting");
      var lf = fz(fI, 6.4, 7, 8);
      var progH = compact ? 3 : 4, progY = Math.round(tm.y + tm.h - progH - (compact ? 9 : 12));
      var logTop = tm.y + 2, logAreaH = Math.max(12, progY - logTop - 6);
      var rowStep = lf + 4, maxRows = Math.max(1, Math.floor(logAreaH / rowStep));
      var shown = TERM_LOGS.filter(function (lg) { return u >= lg.thr; });
      var cursorRow = !expDone && Math.floor(u * 40) % 2 === 0;
      var keep = Math.max(1, maxRows - (cursorRow && shown.length < TERM_LOGS.length ? 1 : 0));
      if (shown.length > keep) shown = shown.slice(shown.length - keep); /* 終端捲動：只留最新幾列 */
      for (var li = 0; li < shown.length; li++) {
        var ly = Math.round(logTop + (li + 0.5) * rowStep);
        var isLast = shown[li] === TERM_LOGS[TERM_LOGS.length - 1];
        tx(c, fitM(c, shown[li].txt, tm.w - 16, lf), tm.x + 6, ly, lf, isLast ? V.ink : V.txt, "left", isLast ? "700" : "400");
      }
      if (cursorRow && shown.length < maxRows) {
        var cy2 = Math.round(logTop + (shown.length + 0.5) * rowStep);
        c.fillStyle = V.acc2; c.fillRect(tm.x + 6, cy2 - Math.round(lf * 0.45), Math.round(lf * 0.55), Math.round(lf * 0.9));
      }
      var pbx = tm.x + 6, pbw = tm.w - 12;
      c.fillStyle = V.track; c.fillRect(pbx, progY, pbw, progH);
      c.fillStyle = expDone ? V.acc3 : V.acc2; c.fillRect(pbx, progY, Math.max(2, Math.round(pbw * exportProg)), progH);
      if (!expDone) { c.fillStyle = "#ffffff"; c.fillRect(pbx + Math.max(2, Math.round(pbw * exportProg)) - 1, progY - 1, 1, progH + 2); }
      var pty = progY + progH + (compact ? 4 : 6);
      tx(c, "EXPORT " + Math.round(exportProg * 100) + "%", pbx, pty, Math.max(5.8, lf - 1), V.ink, "left", "700");
      tx(c, expDone ? "18.4 MB · READY" : "H.264 / 30FPS", pbx + pbw, pty, Math.max(5.8, lf - 1), V.dim, "right", "600");

      return "$" + fmtComma(curCost) + " · EXPORT " + Math.round(exportProg * 100) + "%";
    }, o);
  }

  A23.stageCards = stageCards;
  A23.pcbBus = pcbBus;
  A23.nleTimeline = nleTimeline;
  A23.costDrop = costDrop;
  g.A23Charts = A23;
})(window);
