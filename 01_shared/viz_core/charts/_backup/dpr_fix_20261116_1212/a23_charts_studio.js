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

  /* #64 stageCards — 3×3 角色工作站卡 (driver n=60) */
  function stageCards(cv, _data, opt) {
    var o = opt || {};
    var D = o.data || (_data && _data.stations ? _data : null);
    var nFrames = 60;
    /* 紫色單色系（參考：製片管線看板）：細線、密排等寬字、插畫預覽 */
    var V = { bg: "#09080f", card: "#0d0c15", pane: "#08070d", line: "#24203a", line2: "#3b3460",
      ink: "#ece8ff", txt: "#c4bde6", dim: "#857ea8", mute: "#544d73", acc: "#8b5cf6", acc2: "#a78bfa", acc3: "#c4b5fd", deep: "#5b21b6" };
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

    function hh(i, s) { var x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }
    function ln(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
    function tx(c, s, x, y, size, color, align, weight) {
      c.font = (weight ? weight + " " : "") + size + "px " + MONO;
      c.fillStyle = color; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y);
    }
    function dotGrid(c, x, y, w, h, step, col) {
      c.fillStyle = col;
      for (var gx = x + step * 0.5; gx < x + w; gx += step)
        for (var gy = y + step * 0.5; gy < y + h; gy += step) c.fillRect(Math.round(gx), Math.round(gy), 1, 1);
    }
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
        c.fillStyle = "#1a1530"; c.fillRect(x - hr * 0.45, hy + hr * 0.1, Math.max(1, hr * 0.18), Math.max(1, hr * 0.28)); c.fillRect(x + hr * 0.27, hy + hr * 0.1, Math.max(1, hr * 0.18), Math.max(1, hr * 0.28));
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
    function pane(c, b, label, right) {
      c.fillStyle = V.pane; roundRect(c, b.x, b.y, b.w, b.h, 3); c.fill();
      c.strokeStyle = V.line; c.lineWidth = 1; roundRect(c, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 3); c.stroke();
      if (label && b.h > 34) {
        tx(c, label, b.x + 5, b.y + 6, 5.4, V.mute);
        if (right) tx(c, right, b.x + b.w - 5, b.y + 6, 5.4, V.mute, "right");
        return { x: b.x + 2, y: b.y + 11, w: b.w - 4, h: b.h - 13 };
      }
      return { x: b.x + 2, y: b.y + 2, w: b.w - 4, h: b.h - 4 };
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
        dotGrid(c, inr.x, inr.y, inr.w, inr.h, 6, "#16132a");
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
        c.fillStyle = "#e9e6f5"; c.fillRect(t1.x + 2, t1.y + 1, t1.w - 4, t1.h - 2);
        fig(c, t1.x + t1.w / 2, t1.y + t1.h - 3, Math.min(t1.h * 0.8, t1.w * 1.1), 0.3, "outline", "#3b3460");
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
        var shades = ["#1b1630", "#2a2148", "#3b2e66", "#4c3a85", "#6d4fc0", "#8b5cf6"];
        for (var yy = 0; yy < ny; yy++) for (var xx = 0; xx < nx; xx++) {
          var hv = hh(xx + yy * 37, k + Math.floor(u * 6));
          var on = (xx + yy * nx) / (nx * ny) <= Math.max(pct, act ? 0 : 0.15);
          c.fillStyle = on ? shades[Math.floor(hv * shades.length)] : "#100e1b";
          c.fillRect(inr.x + xx * cs, inr.y + yy * cs, cs - 1, cs - 1);
        }
      } else if (kind === "title" || kind === "curve") {
        var isT = kind === "title";
        inr = pane(c, b, isT ? "titles.aep" : "gate curve", isT ? "comp 1" : Math.round(pct * 100) + "%");
        var fs = Math.max(7, Math.min(inr.h * 0.28, inr.w * 0.1));
        c.font = "800 " + fs + "px " + MONO; c.textBaseline = "middle"; c.textAlign = "left";
        if (isT) { var w1 = c.measureText("STUDIO ").width, w2 = c.measureText("REEL").width, x0 = inr.x + (inr.w - w1 - w2) / 2, yT = inr.y + inr.h * 0.4;
        c.fillStyle = "#9d97b8"; c.fillText("STUDIO ", x0, yT); c.fillStyle = ac; c.fillText("REEL", x0 + w1, yT); }
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
        c.strokeStyle = "#15122a"; c.lineWidth = 1;
        for (var la = 1; la < lanes; la++) ln(c, inr.x, Math.round(inr.y + la * lh) + 0.5, inr.x + inr.w, Math.round(inr.y + la * lh) + 0.5);
        for (var nt = 0; nt < 16; nt++) {
          var nx0 = inr.x + inr.w * nt / 16, lane = Math.floor(hh(nt, 7 + k) * lanes);
          c.fillStyle = nt / 16 < pct ? ac : "#2a2148";
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
            c.fillStyle = on3 ? (r === 0 ? ac : "#4c3a85") : "#1b1630";
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
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      dotGrid(c, 0, 0, w, h, 12, "#141224");
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 6 : (w < 540 ? 9 : 12);
      var topH = compact ? 16 : 20;
      var activeIdx = Math.min(STATIONS.length - 1, Math.floor(u * (STATIONS.length - 0.001)));
      var subU = clamp(u * (STATIONS.length - 0.001) - activeIdx, 0, 1);
      var aSt = STATIONS[activeIdx];
      var titleLeft = (D && D.title) ? D.title : (compact ? "STAGE CARDS · 3×3" : "STU 01 · STAGE WORKSTATION CARDS · 3×3 PIPELINE");
      tx(c, titleLeft, pad, topH * 0.55, compact ? 7 : 8.5, V.acc3, "left", "700");
      tx(c, "ACTIVE " + aSt.id + " " + String(aSt.role).toUpperCase() + " · " + Math.round(u * 100) + "%", w - pad, topH * 0.55, compact ? 6.5 : 7.5, V.dim, "right", "600");

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
      c.save(); c.shadowColor = "rgba(139,92,246,0.55)"; c.shadowBlur = compact ? 6 : 12;
      c.strokeStyle = "rgba(139,92,246,0.7)"; c.lineWidth = 1;
      roundRect(c, pad - 3.5, gy0 - 3.5, gridW + 7, cardH + 7, 7); c.stroke(); c.restore();
      c.strokeStyle = "rgba(196,181,253,0.25)"; roundRect(c, pad - 6.5, gy0 - 6.5, gridW + 13, cardH + 13, 9); c.stroke();

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
          c.fillStyle = "rgba(255,255,255,0.08)"; c.fillRect(cx + 1, cy + 1, cardW - 2, 1);
        } else { c.strokeStyle = V.line; ln(c, cx + 1, cy + hdrH + 1.5, cx + cardW - 1, cy + hdrH + 1.5); }
        var fT = compact ? 6.4 : (cardW < 150 ? 7 : 8);
        var roleTxt = st.full || (D ? st.id + " " + st.role : st.role);
        tx(c, fitTxt(roleTxt, iw * 0.66, fT), ix, cy + 1 + hdrH / 2, fT, isAct ? "#ffffff" : V.ink, "left", "700");
        var stLabel = isDone ? "done" : (isAct ? Math.round(pct * 100) + "%" : "queued");
        tx(c, stLabel, cx + cardW - (compact ? 5 : 7), cy + 1 + hdrH / 2, fT - 1, isDone ? V.acc3 : (isAct ? "#ffffff" : V.mute), "right", "700");

        var yCur = cy + hdrH + 3;
        var fK = compact ? 5.4 : (cardW < 150 ? 5.8 : 6.4);
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
          tx(c, kv[kk][0], ix + 4, ky, fK, V.dim);
          c.font = "600 " + fK + "px " + MONO; var vw = c.measureText(String(kv[kk][1])).width;
          tx(c, String(kv[kk][1]), cx + cardW - 7, ky, fK, isAct ? V.ink : V.txt, "right", "600");
          var kw = c.measureText(kv[kk][0]).width;
          c.setLineDash([1, 2]); c.strokeStyle = "#2c2746"; c.lineWidth = 1;
          ln(c, ix + 7 + kw, Math.round(ky) + 0.5, cx + cardW - 10 - vw, Math.round(ky) + 0.5); c.setLineDash([]);
          var lit = isDone || (isAct && kk / nKv <= pct + 0.01);
          c.fillStyle = V.bg; c.strokeStyle = lit ? V.acc2 : V.line2; c.lineWidth = 1;
          c.beginPath(); c.arc(cx + 0.5, ky, 1.9, 0, Math.PI * 2); c.fill(); c.stroke();
          if (lit) { c.fillStyle = V.acc3; c.beginPath(); c.arc(cx + 0.5, ky, 0.9, 0, Math.PI * 2); c.fill(); }
        }
        yCur += nKv * 8.5 + (nKv ? 4 : 2);

        var prevB = { x: ix, y: yCur, w: iw, h: cy + cardH - footH - yCur - 2 };
        if (prevB.h >= 14) drawPreview(c, st.kind, prevB, ac, pct, isAct, u, i);

        var barY = cy + cardH - footH + 1;
        c.fillStyle = "#1a1729"; c.fillRect(ix, Math.round(barY), iw, 2);
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

  /* #65 pcbBus — PCB 正交匯流排 (driver n=60) */
  function pcbBus(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;

    var GROUPS = [
      { name: "PRE-PROD",  col: CYAN,    nodes: ["INGEST", "SCRIPT", "POSE"] },
      { name: "SYNTHESIS", col: GOLD,    nodes: ["KEYFRAME", "MOTION", "RENDER"] },
      { name: "POST-MIX",  col: MAGENTA, nodes: ["VOICE", "FOLEY", "MASTER"] }
    ];

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
      var segs = [];
      var total = 0;
      for (var i = 0; i < pts.length - 1; i++) {
        var dx = pts[i + 1][0] - pts[i][0];
        var dy = pts[i + 1][1] - pts[i][1];
        var len = Math.hypot(dx, dy);
        segs.push({ x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], len: len });
        total += len;
      }
      var target = clamp(frac, 0, 1) * total;
      var acc = 0;
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

    function drawChip(c, x, y, label, col, compact) {
      var cw = compact ? 46 : 56;
      var ch = compact ? 13 : 15;
      // SMD pins top & bottom
      c.fillStyle = GOLD;
      for (var pi = -1; pi <= 1; pi++) {
        c.fillRect(x + pi * (cw * 0.26) - 1.5, y - ch * 0.5 - 2.5, 3, 2.5);
        c.fillRect(x + pi * (cw * 0.26) - 1.5, y + ch * 0.5, 3, 2.5);
      }
      c.fillStyle = "#0b0e17";
      roundRect(c, x - cw * 0.5, y - ch * 0.5, cw, ch, 2.5);
      c.fill();
      c.strokeStyle = col;
      c.lineWidth = 1;
      c.stroke();
      text(c, label, x, y + 0.5, compact ? 6.2 : 7, FG, "center", "700");
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 14;
      var topH = compact ? 20 : 24;

      // Subtle PCB via grid background
      c.fillStyle = "#121826";
      var gStep = compact ? 18 : 22;
      for (var gx = pad; gx < w - pad; gx += gStep) {
        for (var gy = topH + 6; gy < h - pad; gy += gStep) {
          c.fillRect(gx, gy, 1.2, 1.2);
        }
      }

      var activeGrp = Math.floor(u * 2.999) % 3;
      text(c, compact ? "PCB ORTHO BUS" : "STU 02 · PCB ORTHOGONAL AGENT BUS · MANHATTAN ROUTING", pad, topH * 0.5, compact ? 8 : 9.5, CYAN, "left", "700");
      text(c, "GRP: " + GROUPS[activeGrp].name, w - pad, topH * 0.5, compact ? 7.5 : 8.5, GROUPS[activeGrp].col, "right", "700");

      var areaTop = topH + 6;
      var areaH = h - areaTop - pad;
      var areaW = w - pad * 2;
      var traces = [];
      var nodeBoxes = [];

      if (compact) {
        // Vertical 3-group layout (stacked horizontally per group) for narrow/tall canvas
        var gGap = 24;
        var grpH = (areaH - gGap * 2) / 3;
        for (var gi = 0; gi < 3; gi++) {
          var grp = GROUPS[gi];
          var gy0 = areaTop + gi * (grpH + gGap);
          var isActG = gi === activeGrp;
          if (isActG) {
            c.strokeStyle = grp.col + "33";
            c.lineWidth = 6;
            roundRect(c, pad - 2, gy0 - 2, areaW + 4, grpH + 4, 7);
            c.stroke();
          }
          c.fillStyle = isActG ? "rgba(15, 23, 42, 0.72)" : "rgba(12, 15, 24, 0.68)";
          roundRect(c, pad, gy0, areaW, grpH, 6);
          c.fill();
          c.strokeStyle = isActG ? grp.col : LINE;
          c.lineWidth = isActG ? 1.5 : 1;
          c.stroke();

          text(c, grp.name, pad + 8, gy0 + 10, 7, grp.col, "left", "700");
          if (isActG) drawPill(c, "ACTIVE", w - pad - 44, gy0 + 4, 38, 11, grp.col, 5.8);

          var nGap = 8;
          var nW = (areaW - 16 - nGap * 2) / 3;
          var nH = Math.max(28, grpH - 26);
          var ny = gy0 + 19;
          var rowNodes = [];
          for (var ni = 0; ni < 3; ni++) {
            var nx = pad + 8 + ni * (nW + nGap);
            rowNodes.push({ x: nx, y: ny, w: nW, h: nH, col: grp.col, name: grp.nodes[ni], gi: gi, ni: ni });
          }
          nodeBoxes.push(rowNodes);
        }

        // Manhattan traces connecting Group 0 -> Group 1 -> Group 2 through inter-group channels
        for (var ri = 0; ri < 2; ri++) {
          var srcRow = nodeBoxes[ri];
          var dstRow = nodeBoxes[ri + 1];
          var chMidY = srcRow[0].y + srcRow[0].h + 7 + gGap * 0.5;
          for (var ci = 0; ci < 3; ci++) {
            var sn = srcRow[ci];
            var dn = dstRow[(ci + ri) % 3];
            var sx = sn.x + sn.w * 0.5;
            var sy = sn.y + sn.h;
            var dx = dn.x + dn.w * 0.5;
            var dy = dn.y;
            var jogY = chMidY + (ci - 1) * 4;
            traces.push({
              pts: [[sx, sy], [sx, jogY], [dx, jogY], [dx, dy]],
              col: GROUPS[ri].col,
              chip: ri === 0 ? (ci === 1 ? "POSE-12" : null) : (ci === 1 ? "SYNC-48" : null),
              chipPt: [dx * 0.5 + sx * 0.5, jogY],
              act: activeGrp === ri || activeGrp === ri + 1
            });
          }
        }
      } else {
        // Desktop / Thumbnail: 3 group columns separated by wide PCB routing channels
        var colGap = w < 540 ? 28 : 48;
        var grpW = (areaW - colGap * 2) / 3;
        for (var gdi = 0; gdi < 3; gdi++) {
          var gObj = GROUPS[gdi];
          var gx0 = pad + gdi * (grpW + colGap);
          var isActD = gdi === activeGrp;

          // Active group outer aura glow
          if (isActD) {
            c.strokeStyle = gObj.col + "28";
            c.lineWidth = 8;
            roundRect(c, gx0 - 3, areaTop - 3, grpW + 6, areaH + 6, 9);
            c.stroke();
            c.strokeStyle = gObj.col + "55";
            c.lineWidth = 3;
            roundRect(c, gx0 - 1, areaTop - 1, grpW + 2, areaH + 2, 7);
            c.stroke();
          }

          c.fillStyle = isActD ? "rgba(17, 24, 39, 0.72)" : "rgba(12, 15, 24, 0.68)";
          roundRect(c, gx0, areaTop, grpW, areaH, 6);
          c.fill();
          c.strokeStyle = isActD ? gObj.col : LINE;
          c.lineWidth = isActD ? 1.5 : 1;
          c.stroke();

          text(c, gObj.name, gx0 + 9, areaTop + 13, w < 540 ? 7.5 : 8.5, gObj.col, "left", "700");
          if (isActD) drawPill(c, "ACTIVE", gx0 + grpW - (w < 540 ? 44 : 52), areaTop + 6, w < 540 ? 38 : 44, 13, gObj.col, 6.5);

          var nTop = areaTop + 26;
          var nAreaH = areaH - 34;
          var nVGap = h < 390 ? 12 : 20;
          var nBH = (nAreaH - nVGap * 2) / 3;
          var nBW = grpW - 20;
          var colList = [];
          for (var ndi = 0; ndi < 3; ndi++) {
            var nbx = gx0 + 10;
            var nby = nTop + ndi * (nBH + nVGap);
            colList.push({ x: nbx, y: nby, w: nBW, h: nBH, col: gObj.col, name: gObj.nodes[ndi], gi: gdi, ni: ndi });
          }
          nodeBoxes.push(colList);
        }

        // Intra-group vertical bus + Inter-group orthogonal Manhattan traces with rounded corners
        for (var gti = 0; gti < 3; gti++) {
          var gn = nodeBoxes[gti];
          // Vertical internal spine inside group
          for (var vi = 0; vi < 2; vi++) {
            var vx = gn[vi].x + gn[vi].w * 0.5;
            traces.push({
              pts: [[vx, gn[vi].y + gn[vi].h], [vx, gn[vi + 1].y]],
              col: GROUPS[gti].col,
              chip: null,
              act: activeGrp === gti
            });
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
          var aN = nodeBoxes[sp.fromG][sp.fromN];
          var bN = nodeBoxes[sp.toG][sp.toN];
          var sx0 = aN.x + aN.w;
          var sy0 = aN.y + aN.h * (sp.fromN === sp.toN ? 0.5 : 0.65);
          var dx0 = bN.x;
          var dy0 = bN.y + bN.h * (sp.fromN === sp.toN ? 0.5 : 0.35);
          var midX = (sx0 + dx0) * 0.5 + sp.off * (w < 540 ? 0.55 : 1);
          var pts = (Math.abs(sy0 - dy0) < 1)
            ? [[sx0, sy0], [dx0, dy0]]
            : [[sx0, sy0], [midX, sy0], [midX, dy0], [dx0, dy0]];
          traces.push({
            pts: pts,
            col: GROUPS[sp.fromG].col,
            chip: sp.chip,
            chipPt: [midX, (sy0 + dy0) * 0.5],
            act: activeGrp === sp.fromG || activeGrp === sp.toG
          });
        }
      }

      // Draw orthogonal traces
      var rad = compact ? 5 : 8;
      for (var ti = 0; ti < traces.length; ti++) {
        var tr = traces[ti];
        c.strokeStyle = tr.act ? tr.col + "aa" : tr.col + "44";
        c.lineWidth = tr.act ? 1.8 : 1.2;
        drawRoundedOrth(c, tr.pts, rad);

        // Endpoints port dots
        var pStart = tr.pts[0], pEnd = tr.pts[tr.pts.length - 1];
        drawPortDot(c, pStart[0], pStart[1], compact ? 2 : 2.6, tr.col, tr.act);
        drawPortDot(c, pEnd[0], pEnd[1], compact ? 2 : 2.6, tr.col, tr.act);
      }

      // Moving packets along orthogonal traces
      for (var pi = 0; pi < traces.length; pi++) {
        var ptr = traces[pi];
        var speed = ptr.act ? 2.2 : 1.3;
        var frac = (u * speed + hashLcg(pi, 313)) % 1;
        // Trail
        for (var trk = 3; trk >= 1; trk--) {
          var tf = clamp(frac - trk * 0.035, 0, 1);
          var tp = evalOrth(ptr.pts, tf);
          c.fillStyle = ptr.col + (trk === 1 ? "88" : "33");
          c.beginPath(); c.arc(tp[0], tp[1], compact ? 2 : 2.6, 0, Math.PI * 2); c.fill();
        }
        var hp = evalOrth(ptr.pts, frac);
        c.fillStyle = FG;
        c.beginPath(); c.arc(hp[0], hp[1], compact ? 2.4 : 3.2, 0, Math.PI * 2); c.fill();
      }

      // Draw station node cards inside groups
      for (var gi2 = 0; gi2 < nodeBoxes.length; gi2++) {
        var list = nodeBoxes[gi2];
        for (var ni2 = 0; ni2 < list.length; ni2++) {
          var nb = list[ni2];
          var isActN = (nb.gi === activeGrp) && (ni2 === Math.floor((u * 9) % 3));
          c.fillStyle = isActN ? "#131b2e" : CARD;
          roundRect(c, nb.x, nb.y, nb.w, nb.h, 4);
          c.fill();
          c.strokeStyle = isActN ? nb.col : "#283146";
          c.lineWidth = isActN ? 1.4 : 0.9;
          c.stroke();

          var nf = compact ? 6.8 : (w < 540 ? 7.2 : 8.5);
          text(c, fitTxt(nb.name, nb.w - 10, nf), nb.x + nb.w * 0.5, nb.y + nb.h * 0.42, nf, FG, "center", "700");
          var rateTxt = (18 + Math.round(hashLcg(gi2 * 3 + ni2, 77) * 40)) + " MB/s";
          text(c, rateTxt, nb.x + nb.w * 0.5, nb.y + nb.h * 0.74, nf - 1.2, isActN ? nb.col : DIM, "center");
        }
      }

      // Draw SMD chip labels on traces last so they stay legible
      for (var chi = 0; chi < traces.length; chi++) {
        var ctr = traces[chi];
        if (ctr.chip && ctr.chipPt) {
          drawChip(c, ctr.chipPt[0], ctr.chipPt[1], ctr.chip, ctr.col, compact || w < 540);
        }
      }

      return "PCB BUS · " + GROUPS[activeGrp].name + " ACTIVE";
    }, o);
  }

  /* #66 nleTimeline — 非線性剪輯多軌時間軸 (driver n=60) */
  function nleTimeline(cv, _data, opt) {
    var o = opt || {};
    var D = o.data || (_data && _data.tracks ? _data : null);
    var nFrames = 60;

    var STAGES = (D && Array.isArray(D.stages) && D.stages.length) ? D.stages : ["INGEST", "POSE", "FRAMES", "AUDIO", "GRADE", "EXPORT"];
    var TRACKS = (D && Array.isArray(D.tracks) && D.tracks.length) ? D.tracks : [
      { id: "SUB",   full: "SUBTITLE",   col: CYAN,    kind: "sub" },
      { id: "BOARD", full: "STORYBOARD", col: GOLD,    kind: "shots" },
      { id: "BG",    full: "BACKDROP",   col: PURPLE,  kind: "bg" },
      { id: "MUSIC", full: "MUSIC WAVE", col: GREEN,   kind: "wave" },
      { id: "FOLEY", full: "FOLEY TICKS",col: ORANGE,  kind: "ticks" }
    ];

    var SUB_CLIPS = [
      { s: 0.02, e: 0.22, lbl: "HOOK" },
      { s: 0.24, e: 0.48, lbl: "BEAT 01" },
      { s: 0.51, e: 0.76, lbl: "BEAT 02" },
      { s: 0.79, e: 0.97, lbl: "CTA" }
    ];
    var SHOT_CLIPS = [
      { s: 0.00, e: 0.19, lbl: "SH-01" },
      { s: 0.20, e: 0.39, lbl: "SH-02" },
      { s: 0.40, e: 0.62, lbl: "SH-03" },
      { s: 0.63, e: 0.81, lbl: "SH-04" },
      { s: 0.82, e: 0.99, lbl: "SH-05" }
    ];
    var BG_CLIPS = [
      { s: 0.00, e: 0.35, lbl: "STAGE-DARK" },
      { s: 0.36, e: 0.78, lbl: "NEON-GRID" },
      { s: 0.79, e: 1.00, lbl: "OUTRO-CARD" }
    ];
    var FOLEY_PTS = [
      { f: 0.08, lbl: "STEP" }, { f: 0.20, lbl: "CUT" }, { f: 0.31, lbl: "CLAP" },
      { f: 0.40, lbl: "WHOOSH" }, { f: 0.54, lbl: "SNAP" }, { f: 0.63, lbl: "CUT" },
      { f: 0.74, lbl: "HIT" }, { f: 0.82, lbl: "RISER" }, { f: 0.92, lbl: "LOCK" }
    ];

    function fmtTimecode(u) {
      var totalFrames = Math.round(u * 20 * 30);
      var ff = totalFrames % 30;
      var ss = Math.floor(totalFrames / 30);
      return "00:00:" + (ss < 10 ? "0" + ss : ss) + ":" + (ff < 10 ? "0" + ff : ff);
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 14;
      var curStage = Math.min(STAGES.length - 1, Math.floor(u * (STAGES.length - 0.001)));

      // Top Breadcrumb Pipeline
      var bcY = compact ? 15 : 18;
      var bcX = pad;
      var stepW = (w - pad * 2) / STAGES.length;
      for (var si = 0; si < STAGES.length; si++) {
        var sx = bcX + si * stepW;
        var done = si < curStage;
        var act = si === curStage;
        var cxMid = sx + stepW * 0.5;
        if (act) {
          c.fillStyle = "rgba(245, 179, 1, 0.16)";
          roundRect(c, sx + 2, bcY - 9, stepW - 4, 18, 4);
          c.fill();
          c.strokeStyle = GOLD;
          c.lineWidth = 1;
          c.stroke();
        }
        var lblCol = act ? GOLD : (done ? FG : MUTED);
        text(c, (done ? "✓ " : "") + STAGES[si], cxMid, bcY, compact ? 6.3 : (w < 540 ? 7 : 8.5), lblCol, "center", (act || done) ? "700" : "400");
        if (si < STAGES.length - 1) {
          text(c, "›", sx + stepW, bcY, compact ? 7 : 9, MUTED, "center");
        }
      }

      // Transport Controls + Timecode Bar
      var tbTop = bcY + 14;
      var tbH = compact ? 22 : 26;
      c.fillStyle = CARD;
      roundRect(c, pad, tbTop, w - pad * 2, tbH, 4);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 0.9;
      c.stroke();

      // Transport buttons (vector icons)
      var btnX = pad + 10;
      var btnMidY = tbTop + tbH * 0.5;
      var bStep = compact ? 16 : 20;
      var btns = ["start", "rew", "play", "fwd", "end"];
      for (var bi = 0; bi < btns.length; bi++) {
        var bx = btnX + bi * bStep;
        var isPlay = btns[bi] === "play";
        if (isPlay) {
          c.fillStyle = "rgba(34, 211, 238, 0.2)";
          roundRect(c, bx - 7, btnMidY - 7, 14, 14, 3);
          c.fill();
          c.strokeStyle = CYAN;
          c.lineWidth = 0.9;
          c.stroke();
        }
        c.fillStyle = isPlay ? CYAN : DIM;
        if (btns[bi] === "play") {
          c.beginPath();
          c.moveTo(bx - 2.5, btnMidY - 3.8);
          c.lineTo(bx + 3.8, btnMidY);
          c.lineTo(bx - 2.5, btnMidY + 3.8);
          c.closePath();
          c.fill();
        } else if (btns[bi] === "start") {
          c.fillRect(bx - 4, btnMidY - 3.5, 1.5, 7);
          c.beginPath(); c.moveTo(bx + 3, btnMidY - 3.5); c.lineTo(bx - 2, btnMidY); c.lineTo(bx + 3, btnMidY + 3.5); c.closePath(); c.fill();
        } else if (btns[bi] === "end") {
          c.fillRect(bx + 2.5, btnMidY - 3.5, 1.5, 7);
          c.beginPath(); c.moveTo(bx - 3, btnMidY - 3.5); c.lineTo(bx + 2, btnMidY); c.lineTo(bx - 3, btnMidY + 3.5); c.closePath(); c.fill();
        } else if (btns[bi] === "rew") {
          c.beginPath(); c.moveTo(bx + 3, btnMidY - 3.2); c.lineTo(bx - 2.5, btnMidY); c.lineTo(bx + 3, btnMidY + 3.2); c.closePath(); c.fill();
        } else {
          c.beginPath(); c.moveTo(bx - 3, btnMidY - 3.2); c.lineTo(bx + 2.5, btnMidY); c.lineTo(bx - 3, btnMidY + 3.2); c.closePath(); c.fill();
        }
      }

      var tcStr = fmtTimecode(u) + (compact ? "" : " / 00:00:20:00");
      text(c, tcStr, w - pad - 10, btnMidY, compact ? 8 : 9.5, GOLD, "right", "700");
      if (!compact && w >= 540) {
        text(c, "30 FPS · 1080×1920", w - pad - 155, btnMidY, 7.8, MUTED, "right");
      }

      // Timeline Main Container
      var tlTop = tbTop + tbH + 6;
      var tlH = h - tlTop - pad;
      var hdrW = compact ? 48 : (w < 540 ? 64 : 88);
      var laneX = pad + hdrW;
      var laneW = w - pad - laneX;
      var rulerH = compact ? 16 : 20;

      c.fillStyle = CARD;
      roundRect(c, pad, tlTop, w - pad * 2, tlH, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      // Header column background
      c.fillStyle = "#090c14";
      c.fillRect(pad + 1, tlTop + 1, hdrW - 2, tlH - 2);
      c.strokeStyle = LINE;
      c.beginPath(); c.moveTo(laneX, tlTop); c.lineTo(laneX, tlTop + tlH); c.stroke();

      // Ruler ticks
      var nTicks = compact ? 40 : 60;
      for (var tk = 0; tk <= nTicks; tk++) {
        var tx = laneX + (tk / nTicks) * laneW;
        var major = tk % (nTicks / 5) === 0;
        var th = major ? rulerH * 0.55 : rulerH * 0.25;
        c.strokeStyle = major ? DIM : "#283044";
        c.lineWidth = major ? 1 : 0.7;
        c.beginPath(); c.moveTo(tx, tlTop + rulerH - th); c.lineTo(tx, tlTop + rulerH); c.stroke();
        if (major && tk < nTicks) {
          var secLbl = Math.round((tk / nTicks) * 20) + "s";
          text(c, secLbl, tx + 3, tlTop + 6, compact ? 6 : 7, MUTED, "left");
        }
      }
      c.strokeStyle = LINE;
      c.beginPath(); c.moveTo(pad, tlTop + rulerH); c.lineTo(w - pad, tlTop + rulerH); c.stroke();

      var tracksTop = tlTop + rulerH;
      var tracksH = tlH - rulerH - 2;
      var trH = tracksH / TRACKS.length;
      var playX = laneX + u * laneW;

      for (var ti = 0; ti < TRACKS.length; ti++) {
        var tr = TRACKS[ti];
        var ty = tracksTop + ti * trH;
        if (ti > 0) {
          c.strokeStyle = "#171c2b";
          c.lineWidth = 0.8;
          c.beginPath(); c.moveTo(pad, ty); c.lineTo(w - pad, ty); c.stroke();
        }

        // Track header
        c.fillStyle = tr.col;
        c.fillRect(pad + 2, ty + 4, 2.5, trH - 8);
        var trLbl = (compact || w < 540) ? tr.id : tr.full;
        text(c, trLbl, pad + 8, ty + trH * 0.5, compact ? 6.8 : 7.8, FG, "left", "700");

        var clipY = ty + Math.max(3, trH * 0.14);
        var clipH = Math.max(8, trH * 0.72);

        if (tr.kind === "clips") {
          var clList = tr.clips || [];
          for (var cli = 0; cli < clList.length; cli++) {
            var cl0 = clList[cli];
            var cx1 = laneX + cl0.s * laneW + 1;
            var cw1 = Math.max(6, (cl0.e - cl0.s) * laneW - 2);
            var hit1 = playX >= cx1 && playX <= cx1 + cw1;
            var cCol = cl0.fail ? RED : tr.col;
            c.fillStyle = hit1 ? cCol + "55" : cCol + "26";
            roundRect(c, cx1, clipY, cw1, clipH, 3);
            c.fill();
            c.strokeStyle = hit1 ? FG : cCol;
            c.lineWidth = hit1 ? 1.4 : 0.9;
            c.stroke();
            if (cw1 > 20) {
              text(c, fitTxt(cl0.lbl, cw1 - 6, compact ? 6 : 6.8), cx1 + 4, clipY + clipH * 0.5, compact ? 6 : 6.8, hit1 ? FG : TEXT, "left", "600");
            }
          }
        } else if (tr.kind === "sub" || tr.kind === "shots" || tr.kind === "bg") {
          var arr = tr.kind === "sub" ? SUB_CLIPS : (tr.kind === "shots" ? SHOT_CLIPS : BG_CLIPS);
          for (var ci = 0; ci < arr.length; ci++) {
            var cl = arr[ci];
            var cx0 = laneX + cl.s * laneW + 1;
            var cw0 = Math.max(6, (cl.e - cl.s) * laneW - 2);
            var hit = playX >= cx0 && playX <= cx0 + cw0;
            c.fillStyle = hit ? tr.col + "40" : tr.col + "22";
            roundRect(c, cx0, clipY, cw0, clipH, 3);
            c.fill();
            c.strokeStyle = hit ? FG : tr.col;
            c.lineWidth = hit ? 1.2 : 0.8;
            c.stroke();

            if (cw0 > 26) {
              text(c, fitTxt(cl.lbl, cw0 - 6, compact ? 6 : 7), cx0 + 4, clipY + clipH * 0.5, compact ? 6 : 7, hit ? FG : TEXT, "left", "600");
            }
          }
        } else if (tr.kind === "wave") {
          c.fillStyle = GREEN + "1c";
          roundRect(c, laneX + 2, clipY, laneW - 4, clipH, 3);
          c.fill();
          c.strokeStyle = GREEN + "77";
          c.lineWidth = 0.8;
          c.stroke();

          var nBars = compact ? 48 : 76;
          var bw = (laneW - 8) / nBars;
          var midW = clipY + clipH * 0.5;
          for (var wi = 0; wi < nBars; wi++) {
            var wx = laneX + 4 + wi * bw;
            var past = wx <= playX;
            var env = 0.35 + 0.65 * Math.abs(Math.sin(wi * 0.35));
            var amp = (0.2 + 0.75 * hashLcg(wi, 521)) * env * (clipH * 0.44);
            c.fillStyle = past ? GREEN : "rgba(34, 197, 94, 0.35)";
            c.fillRect(wx, midW - amp, Math.max(1, bw * 0.65), amp * 2);
          }
        } else {
          // Foley transient ticks
          var midT = clipY + clipH * 0.65;
          c.strokeStyle = "#262d40";
          c.lineWidth = 0.8;
          c.beginPath(); c.moveTo(laneX + 2, midT); c.lineTo(laneX + laneW - 2, midT); c.stroke();
          for (var fi = 0; fi < FOLEY_PTS.length; fi++) {
            var fp = FOLEY_PTS[fi];
            var fx = laneX + fp.f * laneW;
            var passed = fx <= playX;
            c.strokeStyle = passed ? ORANGE : "#52525b";
            c.lineWidth = 1.4;
            c.beginPath(); c.moveTo(fx, clipY + 3); c.lineTo(fx, clipY + clipH - 2); c.stroke();
            c.fillStyle = passed ? GOLD : ORANGE;
            c.beginPath();
            c.moveTo(fx, clipY);
            c.lineTo(fx + 3, clipY + 3.5);
            c.lineTo(fx, clipY + 7);
            c.lineTo(fx - 3, clipY + 3.5);
            c.closePath();
            c.fill();
            if (!compact && w >= 540) {
              text(c, fp.lbl, fx + 4, midT - 4, 6.2, passed ? FG : MUTED, "left");
            }
          }
        }
      }

      // Vertical Playhead across all tracks
      c.strokeStyle = "#ffffff";
      c.lineWidth = 1.8;
      c.beginPath();
      c.moveTo(playX, tlTop + 2);
      c.lineTo(playX, tlTop + tlH - 2);
      c.stroke();

      c.fillStyle = GOLD;
      c.beginPath();
      c.moveTo(playX - 4.5, tlTop + 1);
      c.lineTo(playX + 4.5, tlTop + 1);
      c.lineTo(playX, tlTop + 8);
      c.closePath();
      c.fill();

      return STAGES[curStage] + " · " + fmtTimecode(u);
    }, o);
  }

  /* #67 costDrop — 成本對照與匯出終端 (driver n=60) */
  function costDrop(cv, _data, opt) {
    var o = opt || {};
    var D = o.data || (_data && _data.customCost ? _data : null);
    var nFrames = 60;

    var OLD_COST = (D && D.oldCost != null) ? D.oldCost : 4800;
    var NEW_COST = (D && D.newCost != null) ? D.newCost : 96;
    var DRIVERS = (D && Array.isArray(D.drivers)) ? D.drivers : [
      { lbl: "TALENT",  pct: "-99%", frac: 0.99, col: CYAN },
      { lbl: "RENDER",  pct: "-94%", frac: 0.94, col: GOLD },
      { lbl: "AUDIO",   pct: "-96%", frac: 0.96, col: GREEN }
    ];
    var TERM_LOGS = (D && Array.isArray(D.logs)) ? D.logs : [
      { thr: 0.08, txt: "> mux 5 tracks (sub/sb/bg/bgm/foley) [ok]" },
      { thr: 0.25, txt: "> encode h264 1080x1920 @ 30fps crf=18" },
      { thr: 0.45, txt: "> audio normalize -14.0 LUFS · peak -1.0dB" },
      { thr: 0.68, txt: "> verify sha256: 9f3a81c4..d7e2 [PASS]" },
      { thr: 0.86, txt: "> export ready: out/reel_0829.mp4 (18.4 MB)" }
    ];

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 14;
      var topH = compact ? 20 : 24;
      var gap = compact ? 6 : 9;

      var dropProg = easeOut(clamp(u * 1.18, 0, 1));
      var curCost = Math.round(lerp(OLD_COST, NEW_COST, dropProg));
      var savedAmt = OLD_COST - curCost;
      var savedPct = ((savedAmt / OLD_COST) * 100).toFixed(1);

      text(c, (D && D.title) ? D.title : (compact ? "COST DROP & EXPORT" : "STU 04 · COST DROP COMPARISON & EXPORT TERMINAL"), pad, topH * 0.5, compact ? 8 : 9.5, GOLD, "left", "700");
      text(c, (D && D.badgeRight) ? D.badgeRight : ("-" + savedPct + "% COST"), w - pad, topH * 0.5, compact ? 7.8 : 8.8, GREEN, "right", "700");

      var curY = topH + 4;

      // Top Cost Comparison Card (Old strikethrough -> New countdown big number)
      var heroH = compact ? 92 : (h < 390 ? 84 : 118);
      c.fillStyle = CARD;
      roundRect(c, pad, curY, w - pad * 2, heroH, 6);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var midX = w * 0.5;
      var leftCx = pad + (w - pad * 2) * 0.24;
      var rightCx = pad + (w - pad * 2) * 0.75;

      // Left: Old price + animated strikethrough
      text(c, (D && D.oldLabel) ? D.oldLabel : "LEGACY STUDIO", leftCx, curY + (compact ? 16 : 20), compact ? 7 : 8.5, MUTED, "center", "700");
      var oldTxt = (D && D.oldText) ? fitTxt(D.oldText, (w - pad * 2) * 0.42, compact ? 10 : 12) : ("$" + fmtComma(OLD_COST));
      var oldSz = (D && D.oldText) ? (compact ? 9.5 : 11.5) : (compact ? 18 : (w < 540 ? 18 : 26));
      var oldY = curY + heroH * 0.52;
      text(c, oldTxt, leftCx, oldY, oldSz, (D && D.oldText) ? RED : DIM, "center", "700");

      var strikeFrac = clamp(u * 3.0, 0, 1);
      if (strikeFrac > 0) {
        var halfSW = Math.min((w - pad * 2) * 0.21, oldTxt.length * oldSz * 0.34);
        c.strokeStyle = RED;
        c.lineWidth = compact ? 2.2 : 3;
        c.beginPath();
        c.moveTo(leftCx - halfSW, oldY + 2);
        c.lineTo(lerp(leftCx - halfSW, leftCx + halfSW, strikeFrac), oldY - 2);
        c.stroke();
      }
      text(c, (D && D.oldSub) ? D.oldSub : "14 DAYS · 6 CREW", leftCx, curY + heroH - (compact ? 14 : 18), compact ? 6.5 : 7.8, RED, "center", "600");

      // Center arrow + multiplier badge
      drawPill(c, (D && D.midPill) ? D.midPill : "50×", midX - 22, curY + heroH * 0.42 - 9, 44, 18, GOLD, compact ? 7.2 : 8.2);
      text(c, "───▶", midX, curY + heroH * 0.68, compact ? 8 : 10, GOLD, "center", "700");

      // Right: New price big countdown
      text(c, (D && D.newLabel) ? D.newLabel : "PIPELINE COST", rightCx, curY + (compact ? 16 : 20), compact ? 7 : 8.5, CYAN, "center", "700");
      var newSz = compact ? 22 : (w < 540 ? 22 : 32);
      var rightBig = (D && D.newText) ? D.newText : ("$" + fmtComma(curCost));
      text(c, rightBig, rightCx, curY + heroH * 0.52, newSz, dropProg >= 0.98 ? GREEN : GOLD, "center", "700");
      text(c, (D && D.newSub) ? D.newSub : "12 MIN · AUTO", rightCx, curY + heroH - (compact ? 14 : 18), compact ? 6.5 : 7.8, GREEN, "center", "600");

      curY += heroH + gap;

      // Middle: Savings Bar + 3 driver pills
      var savH = compact ? 72 : (h < 390 ? 58 : 82);
      c.fillStyle = CARD;
      roundRect(c, pad, curY, w - pad * 2, savH, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      text(c, "SAVINGS BREAKDOWN", pad + 10, curY + 13, compact ? 7.2 : 8.5, TEXT, "left", "700");
      text(c, "SAVED $" + fmtComma(savedAmt) + " (" + savedPct + "%)", w - pad - 10, curY + 13, compact ? 7.2 : 8.5, GREEN, "right", "700");

      var sbX = pad + 10;
      var sbW = w - pad * 2 - 20;
      var sbY = curY + (h < 390 ? 24 : 27);
      var sbBarH = h < 390 ? 11 : 14;
      c.fillStyle = "#141926";
      roundRect(c, sbX, sbY, sbW, sbBarH, 4);
      c.fill();

      var fillW = Math.max(8, sbW * (savedAmt / OLD_COST));
      c.fillStyle = "rgba(34, 197, 94, 0.28)";
      roundRect(c, sbX, sbY, fillW, sbBarH, 4);
      c.fill();
      c.strokeStyle = GREEN;
      c.lineWidth = 1;
      c.stroke();
      // Remaining new cost sliver on right
      var remW = Math.max(4, sbW - fillW);
      c.fillStyle = GOLD;
      c.fillRect(sbX + sbW - remW, sbY + 2, remW, sbBarH - 4);

      // 3 driver sub-bars
      var dTop = sbY + sbBarH + (h < 390 ? 6 : 10);
      var dW = (sbW - 12) / 3;
      var dH = Math.max(14, curY + savH - dTop - 6);
      for (var di = 0; di < DRIVERS.length; di++) {
        var dr = DRIVERS[di];
        var dx = sbX + di * (dW + 6);
        c.fillStyle = "#080b12";
        roundRect(c, dx, dTop, dW, dH, 3);
        c.fill();
        c.strokeStyle = "#1e2536";
        c.lineWidth = 0.8;
        c.stroke();
        text(c, dr.lbl, dx + 6, dTop + dH * 0.5, compact ? 6.5 : 7.5, DIM, "left", "600");
        text(c, dr.pct, dx + dW - 6, dTop + dH * 0.5, compact ? 6.8 : 7.8, dr.col, "right", "700");
      }

      curY += savH + gap;

      // Bottom: Export Terminal + Progress Bar
      var termH = Math.max(70, h - curY - pad);
      c.fillStyle = CARD;
      roundRect(c, pad, curY, w - pad * 2, termH, 5);
      c.fill();
      c.strokeStyle = LINE;
      c.lineWidth = 1;
      c.stroke();

      var exportProg = clamp(u * 1.05, 0, 1);
      var expDone = exportProg >= 0.99;
      text(c, "EXPORT TERMINAL · reel_0829.mp4", pad + 10, curY + 13, compact ? 7 : 8.5, CYAN, "left", "700");
      drawPill(c, expDone ? "DONE" : "EXPORTING", w - pad - (compact ? 64 : 74), curY + 6, compact ? 54 : 64, 14, expDone ? GREEN : GOLD, compact ? 6.2 : 7);

      var progH = compact ? 14 : 18;
      var progY = curY + termH - progH - 8;
      var logTop = curY + 24;
      var logAreaH = Math.max(24, progY - logTop - 6);
      var rowStep = logAreaH / TERM_LOGS.length;
      var lf = compact ? 6.8 : (w < 540 ? 7.2 : 8.5);

      for (var li = 0; li < TERM_LOGS.length; li++) {
        var lg = TERM_LOGS[li];
        if (u < lg.thr) continue;
        var ly = logTop + (li + 0.5) * rowStep;
        var isLast = li === TERM_LOGS.length - 1;
        text(c, fitTxt(lg.txt, w - pad * 2 - 20, lf), pad + 10, ly, lf, isLast ? GREEN : TEXT, "left", isLast ? "700" : "400");
      }

      // Export Progress Bar
      c.fillStyle = "#141926";
      roundRect(c, pad + 10, progY, w - pad * 2 - 20, progH, 4);
      c.fill();
      c.strokeStyle = "#262e42";
      c.lineWidth = 0.8;
      c.stroke();

      var exW = Math.max(6, (w - pad * 2 - 24) * exportProg);
      c.fillStyle = expDone ? GREEN : CYAN;
      roundRect(c, pad + 12, progY + 2, exW, progH - 4, 3);
      c.fill();

      text(c, "EXPORT " + Math.round(exportProg * 100) + "%", pad + 18, progY + progH * 0.5, compact ? 7 : 8, FG, "left", "700");
      text(c, expDone ? "18.4 MB · READY" : "H.264 / 30FPS", w - pad - 18, progY + progH * 0.5, compact ? 6.8 : 7.8, expDone ? FG : DIM, "right", "600");

      return "$" + fmtComma(curCost) + " · EXPORT " + Math.round(exportProg * 100) + "%";
    }, o);
  }

  A23.stageCards = stageCards;
  A23.pcbBus = pcbBus;
  A23.nleTimeline = nleTimeline;
  A23.costDrop = costDrop;
  g.A23Charts = A23;
})(window);
