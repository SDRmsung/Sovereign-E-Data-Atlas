/* A23 Charts — HUD 戰術 HUD 套組 (#75 hudVitals / #76 hudLoadout / #77 hudSkillTree / #78 hudLockOn / #79 hudRadialMenu / #80 hudCompass / #81 hudFeedback)
 * 載入順序：在 a23_charts_monolith.js 之後，掛載新函式至 window.A23Charts。
 * §6.7 質感對齊：A23Tex.kit(A23Tex.theme("#14b8a6"))；零 Math.random、零 Date.now、100% seek(t) 決定性重繪。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var T = g.A23Tex.kit(g.A23Tex.theme("#14b8a6"));
  var V = T.V;
  var RED = "#ef4444", GREEN = "#22c55e", AMBER = "#f59e0b", WHITE = "#ffffff";

  function clamp(v, lo, hi) { return T.clamp(v, lo, hi); }
  function lerp(a, b, u) { return T.lerp(a, b, u); }
  function easeOut(u) { var x = 1 - clamp(u, 0, 1); return 1 - x * x * x; }

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
    c.fillStyle = V.bg;
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

  function bgGrid(c, w, h) {
    T.dotGrid(c, 0, 0, w, h, w >= 540 ? 16 : 12, V.dot);
  }

  function hdrBar(c, w, pad, leftTxt, rightTxt, f) {
    T.tx(c, leftTxt, pad, pad + f * 0.6, f, V.ink, "left", "700");
    if (rightTxt) T.tx(c, rightTxt, w - pad, pad + f * 0.6, Math.max(6, f * 0.85), V.acc2, "right", "600");
    c.strokeStyle = V.line; c.lineWidth = 1;
    T.ln(c, pad, pad + f * 1.45, w - pad, pad + f * 1.45);
    return pad + f * 1.9;
  }

  function fmtWaitSec(sec) {
    if (sec == null || !isFinite(sec) || sec < 0) return "—";
    if (sec < 60) return Math.round(sec) + "s";
    if (sec < 3600) return Math.round(sec / 60) + "m";
    var h = Math.floor(sec / 3600), m = Math.round((sec % 3600) / 60);
    return h + "h " + (m < 10 ? "0" : "") + m + "m";
  }

  function hudVitalsLive(cv, data, o) {
    var roles = data.roles;
    var nowMs = Number(data.now_ms || 0);
    var items = roles.map(function (r) {
      var st = String(r.status || "idle").toLowerCase();
      var ws = r.wait_sec != null ? Number(r.wait_sec) : (r.waiting_since && nowMs ? Math.max(0, (nowMs - Date.parse(r.waiting_since)) / 1000) : null);
      var lbl = r.wait_label || (st === "idle" ? "待機" : fmtWaitSec(ws));
      var zh = r.status_zh || (st === "stuck" ? "卡住" : (st === "busy" ? "忙" : "待機"));
      var ratio = st === "idle" ? 0.10 : clamp((ws || 0) / 14400, 0.22, 0.96);
      return { role: r.role || "ROLE", st: st, zh: zh, ws: ws, lbl: lbl, ratio: ratio, task: r.task_id || "—", retry: Number(r.retry || 0) };
    });
    return driver(16, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var stuckN = items.filter(function (x) { return x.st === "stuck"; }).length;
      var busyN = items.filter(function (x) { return x.st === "busy"; }).length;
      var idleN = items.filter(function (x) { return x.st === "idle"; }).length;
      var topY = hdrBar(c, w, pad, "HUD 01 // TRI-ROLE VITALS & WAIT", "STUCK " + stuckN + " · BUSY " + busyN + " · IDLE " + idleN, f);
      var bodyH = h - topY - pad;
      var wide = w >= 420;
      var leftW = wide ? Math.round((w - pad * 3) * 0.67) : (w - pad * 2);
      var rightW = wide ? (w - pad * 3 - leftW) : 0;

      var lp = T.pane(c, { x: pad, y: topY, w: leftW, h: bodyH }, "ROLE WAIT STRIPS", "4 ROLES");
      T.specEdge(c, pad + 3, topY + 1, leftW - 6, 0.12);

      var stripAreaH = lp.h * 0.58;
      var rowH = stripAreaH / Math.max(1, items.length);
      var maxWait = 0, maxRetry = 0;

      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        if (it.ws != null && it.ws > maxWait) maxWait = it.ws;
        if (it.retry > maxRetry) maxRetry = it.retry;
        var isAlert = it.st === "stuck";
        var isBusy = it.st === "busy";
        var col = isAlert ? RED : (isBusy ? (it.retry >= 2 ? AMBER : GREEN) : V.dim);
        var ry = lp.y + i * rowH + 2;
        var labelH = Math.max(9, f * 1.05);
        T.tx(c, it.role + " [" + it.zh + "]" + (it.task !== "—" ? " · " + it.task : ""), lp.x + 4, ry + labelH * 0.5, Math.max(6, f * 0.84), isAlert ? RED : (isBusy ? V.ink : V.dim), "left", "700");
        T.tx(c, it.lbl, lp.x + lp.w - 4, ry + labelH * 0.5, Math.max(6, f * 0.84), col, "right", "700");

        var bx = lp.x + 4, bw = lp.w - 8, by = ry + labelH + 1, bh = Math.max(5, Math.min(11, rowH - labelH - 4));
        var segs = 16, gap = bw > 180 ? 2 : 1.2, segW = (bw - gap * (segs - 1)) / segs;
        if (isAlert) T.activeHalo(c, bx, by, bw, bh, 6);
        var pulse = isAlert ? 0.04 * Math.sin(t * 0.9 + i) : 0;
        var val = clamp(it.ratio + pulse, 0.08, 1);
        for (var k = 0; k < segs; k++) {
          var sx = bx + k * (segW + gap), frac = (k + 1) / segs;
          c.fillStyle = V.track; T.roundRect(c, sx, by, segW, bh, 1.5); c.fill();
          if (frac <= val + 0.001) {
            c.fillStyle = col; T.roundRect(c, sx, by, segW, bh, 1.5); c.fill();
          }
        }
      }

      var cdY = lp.y + stripAreaH + 4, cdH = lp.h - stripAreaH - 6;
      var slotGap = Math.max(6, Math.round(lp.w * 0.025));
      var slotW = (lp.w - 8 - slotGap * (items.length - 1)) / Math.max(1, items.length);
      for (var a = 0; a < items.length; a++) {
        var r = items[a], ax = lp.x + 4 + a * (slotW + slotGap), boxH = Math.max(22, cdH - 2);
        var rCol = r.st === "stuck" ? RED : (r.st === "busy" ? (r.retry >= 2 ? AMBER : GREEN) : V.dim);
        c.fillStyle = V.card; T.roundRect(c, ax, cdY, slotW, boxH, 4); c.fill();
        c.strokeStyle = r.st === "idle" ? V.line : rCol; c.lineWidth = r.st === "stuck" ? 1.3 : 1;
        T.roundRect(c, ax + 0.5, cdY + 0.5, slotW - 1, boxH - 1, 4); c.stroke();
        if (r.st === "stuck") T.activeHalo(c, ax, cdY, slotW, boxH, 7);
        var cx = ax + slotW * 0.5, cy = cdY + boxH * 0.42, rad = Math.max(7, Math.min(slotW * 0.26, boxH * 0.28));
        c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2);
        c.fillStyle = V.bg; c.fill();
        c.strokeStyle = rCol; c.lineWidth = 1.4; c.stroke();
        T.tx(c, r.zh, cx, cy, Math.max(6, f * 0.85), rCol, "center", "700");
        if (boxH >= 32) {
          T.tx(c, r.role, cx, cdY + boxH - Math.max(6, f * 0.62), Math.max(5.5, f * 0.72), r.st === "idle" ? V.dim : V.ink, "center", "600");
        }
      }

      if (wide && rightW > 90) {
        var rx = pad * 2 + leftW;
        var rp = T.pane(c, { x: rx, y: topY, w: rightW, h: bodyH }, "QUEUE // TELEMETRY", stuckN ? "BLOCKED" : "FLOW");
        T.specEdge(c, rx + 3, topY + 1, rightW - 6, 0.1);
        var rows = [
          ["STUCK", String(stuckN), stuckN > 0],
          ["BUSY", String(busyN), busyN > 0],
          ["IDLE", String(idleN), false],
          ["MAX WAIT", fmtWaitSec(maxWait), maxWait >= 3600],
          ["MAX RETRY", maxRetry + "/2", maxRetry >= 2],
          ["SOURCE", "LIVE JSON", true]
        ];
        T.kvBlock(c, { x: rp.x + 4, y: rp.y + 4, w: rp.w - 8, h: rp.h * 0.72 }, rows, Math.max(6, f * 0.84), rx);
      }
      return "Roles · Stuck " + stuckN + " · MaxWait " + fmtWaitSec(maxWait);
    }, o);
  }

  /* =========================================================================
   * #75 hudVitals — HUD 01 · 多段資源條＋延遲扣損殘影＋扇形冷卻遮罩
   * ========================================================================= */
  function hudVitals(cv, _d, o) {
    if (_d && Array.isArray(_d.roles)) return hudVitalsLive(cv, _d, o);
    var BARS = [
      { id: "CTX BUDGET", segs: 20, thresh: 0.80, base: 0.56, amp: 0.30, ph: 0.0, unit: "%" },
      { id: "VRAM 8GB", segs: 16, thresh: 0.85, base: 0.64, amp: 0.22, ph: 1.7, unit: "%" },
      { id: "TOKEN / MIN", segs: 16, thresh: 0.75, base: 0.48, amp: 0.34, ph: 3.1, unit: "%" }
    ];
    var ABILS = [
      { key: "Q", name: "CACHE", cd: 6.0, off: 0.0 },
      { key: "W", name: "PRUNE", cd: 8.0, off: 2.4 },
      { key: "E", name: "BURST", cd: 5.0, off: 4.1 },
      { key: "R", name: "RESET", cd: 10.0, off: 6.5 }
    ];
    return driver(16, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var topY = hdrBar(c, w, pad, "HUD 01 // VITALS & COOLDOWNS", "FRAME " + ("0" + Math.floor(t + 1)).slice(-2) + "/16", f);
      var bodyH = h - topY - pad;
      var wide = w >= 420;
      var leftW = wide ? Math.round((w - pad * 3) * 0.67) : (w - pad * 2);
      var rightW = wide ? (w - pad * 3 - leftW) : 0;

      /* Left pane: multi-segment vital bars + cooldown slots */
      var lp = T.pane(c, { x: pad, y: topY, w: leftW, h: bodyH }, "RESOURCE STRIPS // DELAYED TRAIL", "80% GATE");
      T.specEdge(c, pad + 3, topY + 1, leftW - 6, 0.12);

      var stripAreaH = lp.h * 0.58;
      var rowH = stripAreaH / BARS.length;
      var alertCount = 0;
      var ctxVal = 0;

      for (var i = 0; i < BARS.length; i++) {
        var b = BARS[i];
        var val = clamp(b.base + b.amp * Math.sin(t * 0.55 + b.ph), 0.12, 0.96);
        var prev = clamp(b.base + b.amp * Math.sin((t - 0.85) * 0.55 + b.ph), 0.12, 0.96);
        var ghost = Math.max(val, prev);
        if (i === 0) ctxVal = val;
        var isAlert = val >= b.thresh;
        if (isAlert) alertCount++;

        var ry = lp.y + i * rowH + 2;
        var labelH = Math.max(10, f * 1.15);
        T.tx(c, b.id, lp.x + 4, ry + labelH * 0.5, Math.max(6, f * 0.88), isAlert ? RED : V.txt, "left", "700");
        T.tx(c, Math.round(val * 100) + b.unit, lp.x + lp.w - 4, ry + labelH * 0.5, Math.max(6, f * 0.88), isAlert ? RED : V.ink, "right", "700");

        var bx = lp.x + 4, bw = lp.w - 8, by = ry + labelH + 2, bh = Math.max(7, Math.min(14, rowH - labelH - 6));
        var gap = bw > 180 ? 2 : 1.2;
        var segW = (bw - gap * (b.segs - 1)) / b.segs;
        var fillCol = isAlert ? RED : (val >= b.thresh - 0.12 ? AMBER : V.acc);

        if (isAlert) T.activeHalo(c, bx, by, bw, bh, 8);

        for (var k = 0; k < b.segs; k++) {
          var sx = bx + k * (segW + gap);
          var frac = (k + 1) / b.segs;
          c.fillStyle = V.track;
          T.roundRect(c, sx, by, segW, bh, 1.5); c.fill();
          if (frac <= ghost + 0.001 && frac > val + 0.001) {
            c.fillStyle = T.rgba(AMBER, 0.45);
            T.roundRect(c, sx, by, segW, bh, 1.5); c.fill();
          }
          if (frac <= val + 0.001) {
            c.fillStyle = fillCol;
            T.roundRect(c, sx, by, segW, bh, 1.5); c.fill();
            c.fillStyle = T.rgba(WHITE, 0.22);
            c.fillRect(sx, by, segW, 1);
          }
        }
        /* Threshold tick */
        var txPos = bx + bw * b.thresh;
        c.strokeStyle = WHITE; c.lineWidth = 1;
        T.ln(c, txPos, by - 2, txPos, by + bh + 2);
      }

      /* Ability / Rate-Limit Cooldown Slots */
      var cdY = lp.y + stripAreaH + 4;
      var cdH = lp.h - stripAreaH - 6;
      var slotGap = Math.max(6, Math.round(lp.w * 0.025));
      var slotW = (lp.w - 8 - slotGap * (ABILS.length - 1)) / ABILS.length;
      var readyCount = 0;

      for (var a = 0; a < ABILS.length; a++) {
        var ab = ABILS[a];
        var cyc = ((t * 1.1 + ab.off) % ab.cd) / ab.cd;
        var isReady = cyc > 0.72;
        if (isReady) readyCount++;
        var rem = isReady ? 0 : (1 - cyc / 0.72) * ab.cd * 0.72;
        var ax = lp.x + 4 + a * (slotW + slotGap);
        var boxH = Math.max(22, cdH - 2);

        c.fillStyle = V.card;
        T.roundRect(c, ax, cdY, slotW, boxH, 4); c.fill();
        c.strokeStyle = isReady ? V.acc2 : V.line2; c.lineWidth = 1;
        T.roundRect(c, ax + 0.5, cdY + 0.5, slotW - 1, boxH - 1, 4); c.stroke();
        if (isReady) T.activeHalo(c, ax, cdY, slotW, boxH, 7);

        /* Radial cooldown sweep */
        var cx = ax + slotW * 0.5, cy = cdY + boxH * 0.44;
        var rad = Math.max(7, Math.min(slotW * 0.28, boxH * 0.30));
        c.beginPath(); c.arc(cx, cy, rad, 0, Math.PI * 2);
        c.fillStyle = V.bg; c.fill();
        c.strokeStyle = isReady ? GREEN : V.line2; c.lineWidth = 1.4; c.stroke();

        if (!isReady) {
          var sweep = (1 - cyc / 0.72) * Math.PI * 2;
          c.beginPath(); c.moveTo(cx, cy);
          c.arc(cx, cy, rad - 1, -Math.PI / 2, -Math.PI / 2 + sweep);
          c.closePath();
          c.fillStyle = T.rgba(AMBER, 0.38); c.fill();
          T.tx(c, rem.toFixed(1) + "s", cx, cy, Math.max(5.5, f * 0.78), AMBER, "center", "700");
        } else {
          T.tx(c, ab.key, cx, cy, Math.max(6, f * 0.85), GREEN, "center", "700");
        }
        if (boxH >= 32) {
          T.tx(c, ab.name, cx, cdY + boxH - Math.max(6, f * 0.65), Math.max(5.4, f * 0.72), isReady ? V.ink : V.dim, "center", "600");
        }
      }

      /* Right telemetry pane */
      if (wide && rightW > 90) {
        var rx = pad * 2 + leftW;
        var rp = T.pane(c, { x: rx, y: topY, w: rightW, h: bodyH }, "BREAKER // STATUS", alertCount ? "ALERT" : "NOMINAL");
        T.specEdge(c, rx + 3, topY + 1, rightW - 6, 0.1);
        var rows = [
          ["STATE", alertCount > 0 ? "THROTTLED" : "NOMINAL", alertCount > 0],
          ["CTX PEAK", Math.round(ctxVal * 100) + "%", ctxVal >= 0.8],
          ["READY", readyCount + "/" + ABILS.length, readyCount === ABILS.length],
          ["BREAKER", alertCount > 0 ? "ARMED" : "STANDBY", alertCount > 0],
          ["WINDOW", "80% CAP", false],
          ["SYNC", "DETERM", true]
        ];
        T.kvBlock(c, { x: rp.x + 4, y: rp.y + 4, w: rp.w - 8, h: rp.h * 0.65 }, rows, Math.max(6, f * 0.85), rx);

        /* Mini pulse waveform at bottom right */
        var wy = rp.y + rp.h * 0.72, wh = rp.h * 0.24;
        if (wh > 16) {
          c.strokeStyle = alertCount > 0 ? RED : V.acc2; c.lineWidth = 1.2;
          c.beginPath();
          for (var px = 0; px <= 24; px++) {
            var ux = rp.x + 6 + (rp.w - 12) * (px / 24);
            var uy = wy + wh * 0.5 - Math.sin(px * 0.6 + t * 0.9) * wh * 0.36;
            if (px === 0) c.moveTo(ux, uy); else c.lineTo(ux, uy);
          }
          c.stroke();
        }
      }
      return "Vitals · CTX " + Math.round(ctxVal * 100) + "% · Ready " + readyCount + "/4";
    }, o);
  }

  /* =========================================================================
   * #76 hudLoadout — HUD 02 · 配置槽位＋屬性 Δ 對比卡
   * ========================================================================= */
  function hudLoadout(cv, _d, o) {
    var SLOTS = [
      { slot: "CORE LLM", cur: "SONNET-4.6", cand: "MOE-35B-LOC", delta: [0.06, -0.34, -0.78, 0.12, 0.04], base: [0.84, 0.62, 0.88, 0.72, 0.86] },
      { slot: "RETRIEVER", cur: "BM25-FLAT", cand: "HYBRID-VEC", delta: [0.22, 0.08, 0.05, 0.18, 0.09], base: [0.64, 0.42, 0.30, 0.60, 0.75] },
      { slot: "SANDBOX", cur: "PROC-RAW", cand: "SQLITE-MEM", delta: [0.09, -0.18, -0.12, 0.05, 0.31], base: [0.76, 0.55, 0.40, 0.70, 0.61] },
      { slot: "GUARDRAIL", cur: "REGEX-V1", cand: "AST-GATE-V3", delta: [0.15, 0.06, -0.05, 0.04, 0.24], base: [0.72, 0.36, 0.25, 0.78, 0.68] }
    ];
    var STATS = [
      { name: "QUALITY", inv: false },
      { name: "LATENCY", inv: true },
      { name: "COST/1M", inv: true },
      { name: "CONTEXT", inv: false },
      { name: "SAFETY", inv: false }
    ];
    return driver(16, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var actIdx = Math.floor(t / 4) % SLOTS.length;
      var localU = easeOut((t % 4) / 1.4);
      var act = SLOTS[actIdx];
      var topY = hdrBar(c, w, pad, "HUD 02 // LOADOUT & STAT DELTA", "INSPECTING " + act.slot, f);
      var bodyH = h - topY - pad;
      var leftW = Math.round((w - pad * 3) * 0.46);
      var rightW = w - pad * 3 - leftW;

      /* Left: 2x2 Equipment Slots */
      var lp = T.pane(c, { x: pad, y: topY, w: leftW, h: bodyH }, "EQUIPPED SLOTS", "4/4 ACTIVE");
      T.specEdge(c, pad + 3, topY + 1, leftW - 6, 0.12);
      var cellGap = Math.max(5, Math.round(lp.w * 0.035));
      var cw = (lp.w - 8 - cellGap) * 0.5;
      var ch = (lp.h - 8 - cellGap) * 0.5;
      var actPt = [pad + leftW, topY + bodyH * 0.5];

      for (var i = 0; i < SLOTS.length; i++) {
        var sl = SLOTS[i];
        var col = i % 2, row = Math.floor(i / 2);
        var sx = lp.x + 4 + col * (cw + cellGap);
        var sy = lp.y + 4 + row * (ch + cellGap);
        var isAct = i === actIdx;

        c.fillStyle = isAct ? V.card : V.bg;
        T.roundRect(c, sx, sy, cw, ch, 4); c.fill();
        c.strokeStyle = isAct ? V.acc2 : V.line2; c.lineWidth = isAct ? 1.3 : 1;
        T.roundRect(c, sx + 0.5, sy + 0.5, cw - 1, ch - 1, 4); c.stroke();
        if (isAct) {
          T.activeHalo(c, sx, sy, cw, ch, 9);
          T.specEdge(c, sx + 3, sy + 1, cw - 6, 0.18);
          actPt = [sx + cw, sy + ch * 0.5];
        }
        T.kvPort(c, sx + cw, sy + ch * 0.5, isAct);
        T.tx(c, sl.slot, sx + 6, sy + Math.max(9, ch * 0.24), Math.max(5.5, f * 0.78), isAct ? V.acc3 : V.dim, "left", "700");
        T.tx(c, T.fitM(c, sl.cur, cw - 12, Math.max(6, f * 0.86), "700"), sx + 6, sy + ch * 0.56, Math.max(6, f * 0.86), isAct ? V.ink : V.txt, "left", "700");
        if (ch >= 46) {
          T.tx(c, isAct ? "⇄ " + T.fitM(c, sl.cand, cw - 18, Math.max(5.4, f * 0.72), "600") : "LOCKED", sx + 6, sy + ch * 0.82, Math.max(5.4, f * 0.72), isAct ? GREEN : V.mute, "left", "600");
        }
      }

      /* Right: Inspect & Stat Delta Card */
      var rx = pad * 2 + leftW;
      var rp = T.pane(c, { x: rx, y: topY, w: rightW, h: bodyH }, "STAT DELTA // " + act.cur + " → " + act.cand, "LIVE DIFF");
      T.specEdge(c, rx + 3, topY + 1, rightW - 6, 0.12);

      /* Orthogonal link + hotPacket from active slot to inspect panel */
      var midX = pad + leftW + pad * 0.5;
      var busPts = [actPt, [midX, actPt[1]], [midX, topY + bodyH * 0.45], [rx, topY + bodyH * 0.45]];
      c.strokeStyle = V.acc; c.lineWidth = 1.2;
      T.orthPath(c, busPts, 4);
      T.hotPacket(c, busPts, (t * 0.35) % 1, V.acc3, 2.4);
      T.kvPort(c, rx, topY + bodyH * 0.45, true);

      var barAreaH = rp.h * 0.68;
      var sRowH = barAreaH / STATS.length;
      var netGain = 0;

      for (var j = 0; j < STATS.length; j++) {
        var st = STATS[j];
        var base = act.base[j];
        var rawD = act.delta[j] * localU;
        var next = clamp(base + rawD, 0.04, 0.98);
        var good = st.inv ? (rawD < 0) : (rawD > 0);
        netGain += (st.inv ? -rawD : rawD);
        var y = rp.y + 4 + j * sRowH;

        T.tx(c, st.name, rp.x + 6, y + sRowH * 0.32, Math.max(5.8, f * 0.82), V.txt, "left", "600");
        var pct = Math.round(rawD * 100);
        var dStr = (pct >= 0 ? "+" : "") + pct + "%";
        T.tx(c, dStr, rp.x + rp.w - 6, y + sRowH * 0.32, Math.max(5.8, f * 0.82), good ? GREEN : RED, "right", "700");

        var bx = rp.x + 6, bw = rp.w - 12, by = y + sRowH * 0.58, bh = Math.max(5, Math.min(9, sRowH * 0.28));
        c.fillStyle = V.track; T.roundRect(c, bx, by, bw, bh, 2); c.fill();

        var minV = Math.min(base, next), maxV = Math.max(base, next);
        c.fillStyle = V.line2; T.roundRect(c, bx, by, bw * minV, bh, 2); c.fill();
        c.fillStyle = good ? GREEN : RED;
        T.roundRect(c, bx + bw * minV, by, Math.max(2, bw * (maxV - minV)), bh, 2); c.fill();
      }

      /* Bottom summary kvBlock */
      var sumY = rp.y + barAreaH + 4;
      var sumH = rp.h - barAreaH - 6;
      if (sumH >= 20) {
        T.kvBlock(c, { x: rp.x + 4, y: sumY, w: rp.w - 8, h: sumH }, [
          ["NET SCORE", (netGain >= 0 ? "+" : "") + Math.round(netGain * 100) + " PTS", netGain >= 0],
          ["VERDICT", netGain >= 0.05 ? "EQUIP RECOMMENDED" : "HOLD", netGain >= 0.05]
        ], Math.max(5.8, f * 0.82));
      }
      return "Loadout · " + act.slot + " → " + act.cand;
    }, o);
  }

  /* =========================================================================
   * #77 hudSkillTree — HUD 03 · 技能解鎖狀態機 DAG
   * ========================================================================= */
  function hudSkillTree(cv, _d, o) {
    var hasD = _d && _d.nodes && _d.nodes.length;
    /* 4-tier DAG: x in [0..1], y in [0..1] */
    var NODES = hasD ? _d.nodes : [
      { id: "CORE", lbl: "L0 CORE", x: 0.11, y: 0.50, cost: 0, req: [] },
      { id: "RAG", lbl: "RAG INDEX", x: 0.37, y: 0.22, cost: 2, req: [0] },
      { id: "SBOX", lbl: "SANDBOX", x: 0.37, y: 0.50, cost: 2, req: [0] },
      { id: "CACH", lbl: "KV CACHE", x: 0.37, y: 0.78, cost: 1, req: [0] },
      { id: "SWM", lbl: "SWARM", x: 0.65, y: 0.22, cost: 3, req: [1, 2] },
      { id: "GATE", lbl: "4C GATE", x: 0.65, y: 0.50, cost: 3, req: [2] },
      { id: "MOE", lbl: "EDGE MOE", x: 0.65, y: 0.78, cost: 4, req: [3] },
      { id: "SOV", lbl: "SOVEREIGN", x: 0.89, y: 0.36, cost: 5, req: [4, 5] },
      { id: "AUTO", lbl: "AUTO-OPS", x: 0.89, y: 0.68, cost: 5, req: [5, 6] }
    ];
    if (hasD) {
      var cols = Math.min(5, Math.max(3, Math.ceil(Math.sqrt(NODES.length * 1.5))));
      var rows = Math.max(1, Math.ceil(NODES.length / cols));
      NODES = NODES.map(function (n, idx) {
        var c0 = idx % cols, r0 = Math.floor(idx / cols);
        return {
          id: n.id || ("N" + idx),
          lbl: n.lbl || n.id || ("N" + idx),
          x: n.x != null ? n.x : (cols === 1 ? 0.5 : 0.1 + (0.8 * c0 / (cols - 1))),
          y: n.y != null ? n.y : (rows === 1 ? 0.5 : 0.18 + (0.64 * r0 / (rows - 1))),
          cost: n.cost || 0,
          req: n.req || [],
          state: n.state || null,
          sub: n.sub != null ? n.sub : null
        };
      });
    }
    /* Unlock progression timeline */
    var ORDER = [0, 1, 2, 3, 5, 4, 6, 7];
    return driver(16, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var step = Math.floor(t / 2); /* 0..7 */
      var unlocked = {};
      if (hasD) {
        for (var u0 = 0; u0 < NODES.length; u0++) if (NODES[u0].state === "ACTIVE") unlocked[u0] = true;
      } else {
        for (var u = 0; u <= Math.min(step + 2, ORDER.length - 1); u++) unlocked[ORDER[u]] = true;
      }
      var focusIdx = hasD ? (_d.focusIdx != null ? _d.focusIdx : 0) : ORDER[Math.min(step + 3, ORDER.length - 1)];
      var ptsLeft = 18;
      for (var k = 0; k < NODES.length; k++) if (unlocked[k]) ptsLeft -= NODES[k].cost;

      var hdrTitle = hasD ? (_d.title || "HUD 03 // QUEST STAGE MAP") : "HUD 03 // SKILL UNLOCK DAG";
      var hdrSub = hasD && _d.subtitle != null ? _d.subtitle : ("TECH PT: " + Math.max(0, ptsLeft) + "  ·  " + Object.keys(unlocked).length + "/" + NODES.length);
      var topY = hdrBar(c, w, pad, hdrTitle, hdrSub, f);
      var bodyH = h - topY - pad;
      var footH = h >= 220 ? Math.max(24, f * 2.4) : 0;
      var dagH = bodyH - (footH ? footH + 6 : 0);

      var dp = T.pane(c, { x: pad, y: topY, w: w - pad * 2, h: dagH }, (hasD && _d.paneTitle) ? _d.paneTitle : "CAPABILITY TREE // 4-STATE MACHINE", (hasD && _d.paneSub) ? _d.paneSub : "ACTIVE · AVAIL · LOCK · BLOCK");
      T.specEdge(c, pad + 3, topY + 1, w - pad * 2 - 6, 0.12);

      var nw = clamp(dp.w * 0.17, 42, 108);
      var nh = clamp(dp.h * 0.19, 18, 36);

      function nodePos(n) {
        return [dp.x + nw * 0.55 + n.x * (dp.w - nw * 1.1), dp.y + nh * 0.65 + n.y * (dp.h - nh * 1.3)];
      }
      function nodeState(idx) {
        if (hasD && NODES[idx].state) return NODES[idx].state;
        if (unlocked[idx]) return "ACTIVE";
        if (idx === 8 && !unlocked[6]) return "BLOCKED";
        var reqs = NODES[idx].req;
        var ok = true;
        for (var r = 0; r < reqs.length; r++) if (!unlocked[reqs[r]]) ok = false;
        return ok ? "AVAIL" : "LOCKED";
      }

      /* Draw prerequisite orthogonal edges + hotPackets */
      for (var i = 0; i < NODES.length; i++) {
        var nd = NODES[i], p2 = nodePos(nd);
        var st = nodeState(i);
        for (var r = 0; r < nd.req.length; r++) {
          var p1 = nodePos(NODES[nd.req[r]]);
          var mx = (p1[0] + p2[0]) * 0.5;
          var pts = [[p1[0] + nw * 0.5, p1[1]], [mx, p1[1]], [mx, p2[1]], [p2[0] - nw * 0.5, p2[1]]];
          var isLit = unlocked[nd.req[r]] && (st === "ACTIVE" || i === focusIdx);
          c.strokeStyle = st === "ACTIVE" ? GREEN : (isLit ? V.acc2 : V.line);
          c.lineWidth = isLit ? 1.5 : 1;
          T.orthPath(c, pts, 4);
          if (isLit) {
            var frac = (t * 0.35 + i * 0.19 + r * 0.31) % 1;
            T.hotPacket(c, pts, frac, st === "ACTIVE" ? GREEN : V.acc3, 2.2);
          }
        }
      }

      /* Draw nodes */
      var hitBoxes = [];
      for (var j = 0; j < NODES.length; j++) {
        var n2 = NODES[j], pos = nodePos(n2), st2 = nodeState(j);
        var nx = pos[0] - nw * 0.5, ny = pos[1] - nh * 0.5;
        hitBoxes.push({ idx: j, id: n2.id, x: nx, y: ny, w: nw, h: nh, cw: w, ch: h });
        var col = st2 === "ACTIVE" ? GREEN : (st2 === "AVAIL" ? V.acc2 : (st2 === "BLOCKED" ? RED : V.mute));

        c.fillStyle = st2 === "ACTIVE" ? V.card : V.bg;
        T.roundRect(c, nx, ny, nw, nh, 4); c.fill();
        c.strokeStyle = col; c.lineWidth = (j === focusIdx || st2 === "ACTIVE") ? 1.4 : 1;
        T.roundRect(c, nx + 0.5, ny + 0.5, nw - 1, nh - 1, 4); c.stroke();

        if (j === focusIdx) T.activeHalo(c, nx, ny, nw, nh, 10);
        if (st2 === "ACTIVE") T.specEdge(c, nx + 3, ny + 1, nw - 6, 0.18);

        /* Left & right ports */
        if (n2.req.length) T.kvPort(c, nx, pos[1], st2 === "ACTIVE" || j === focusIdx);
        T.kvPort(c, nx + nw, pos[1], st2 === "ACTIVE");

        T.tx(c, T.fitM(c, n2.lbl, nw - 10, Math.max(5.5, f * 0.8), "700"), pos[0], pos[1] - (nh >= 26 ? nh * 0.16 : 0), Math.max(5.5, f * 0.8), st2 === "LOCKED" ? V.dim : V.ink, "center", "700");
        if (nh >= 26) {
          var sub = (hasD && n2.sub != null) ? n2.sub : (st2 === "ACTIVE" ? "✓ ON" : (st2 === "BLOCKED" ? "✕ BLK" : n2.cost + " PT"));
          T.tx(c, sub, pos[0], pos[1] + nh * 0.24, Math.max(5.2, f * 0.68), col, "center", "600");
        }
      }
      cv._hudNodes = hitBoxes;

      /* Footer leader strip */
      if (footH > 0 && NODES.length) {
        var fy = topY + dagH + 6;
        var fp = T.pane(c, { x: pad, y: fy, w: w - pad * 2, h: footH });
        var fn = NODES[Math.min(focusIdx, NODES.length - 1)];
        var fL = (hasD && _d.footerLeft) ? _d.footerLeft : ("FOCUS: " + fn.lbl + " (" + nodeState(Math.min(focusIdx, NODES.length - 1)) + ")");
        var fR = (hasD && _d.footerRight) ? _d.footerRight : ("COST " + fn.cost + " PT  ·  UNLOCK " + Math.round(Object.keys(unlocked).length / NODES.length * 100) + "%");
        T.leader(c, fL, fR, fp.x + 6, fp.x + fp.w - 6, fp.y + fp.h * 0.5, Math.max(6, f * 0.85), true);
      }
      return "Skill DAG · Focus " + (NODES[Math.min(focusIdx, NODES.length - 1)] || { lbl: "—" }).lbl + " (" + Object.keys(unlocked).length + "/" + NODES.length + ")";
    }, o);
  }

  /* =========================================================================
   * #78 hudLockOn — HUD 04 · 空間鎖定準星＋動態浮卡
   * ========================================================================= */
  function hudLockOn(cv, _d, o) {
    var TARGETS = [
      { id: "ANOM-04", risk: "HIGH", drift: "+0.84σ", dist: "142m", ox: 0.34, oy: 0.36, vx: 0.08, vy: 0.05 },
      { id: "NODE-19", risk: "WARN", drift: "+0.41σ", dist: "218m", ox: 0.62, oy: 0.58, vx: -0.06, vy: 0.07 },
      { id: "GATE-07", risk: "CRIT", drift: "+1.12σ", dist: "089m", ox: 0.48, oy: 0.42, vx: 0.05, vy: -0.06 }
    ];
    return driver(16, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var lockIdx = Math.floor(t / 5.34) % TARGETS.length;
      var lockProg = easeOut((t % 5.34) / 1.4);
      var tgt = TARGETS[lockIdx];
      var isLocked = lockProg > 0.85;

      var topY = hdrBar(c, w, pad, "HUD 04 // SPATIAL LOCK-ON RETICLE", isLocked ? "LOCKED: " + tgt.id : "ACQUIRING…", f);
      var bodyH = h - topY - pad;
      var vp = T.pane(c, { x: pad, y: topY, w: w - pad * 2, h: bodyH }, "TACTICAL FIELD // DIEGETIC CALLOUT", "DRIFT TRACKER");
      T.specEdge(c, pad + 3, topY + 1, w - pad * 2 - 6, 0.12);

      var cx = vp.x + vp.w * 0.42, cy = vp.y + vp.h * 0.52;
      var maxR = Math.min(vp.w * 0.36, vp.h * 0.42);

      /* Concentric range rings & crosshair */
      c.strokeStyle = V.line; c.lineWidth = 1;
      for (var rg = 1; rg <= 3; rg++) {
        c.beginPath(); c.arc(cx, cy, maxR * (rg / 3), 0, Math.PI * 2); c.stroke();
      }
      c.setLineDash([2, 4]);
      T.ln(c, cx - maxR, cy, cx + maxR, cy);
      T.ln(c, cx, cy - maxR, cx, cy + maxR);
      c.setLineDash([]);

      /* Ambient field nodes */
      for (var m = 0; m < 12; m++) {
        var ang = T.hh(m, 11) * Math.PI * 2 + t * 0.06 * (m % 2 ? 1 : -1);
        var rad = maxR * (0.25 + T.hh(m, 23) * 0.72);
        var mx = cx + Math.cos(ang) * rad, my = cy + Math.sin(ang) * rad;
        c.fillStyle = V.line2;
        c.beginPath(); c.arc(mx, my, 2.2, 0, Math.PI * 2); c.fill();
      }

      /* Anomaly targets */
      var lockX = cx, lockY = cy;
      for (var k = 0; k < TARGETS.length; k++) {
        var tk = TARGETS[k];
        var txp = vp.x + clamp(tk.ox + Math.sin(t * 0.35 + k * 2.1) * tk.vx, 0.14, 0.62) * vp.w;
        var typ = vp.y + clamp(tk.oy + Math.cos(t * 0.3 + k * 1.7) * tk.vy, 0.22, 0.78) * vp.h;
        var isCur = k === lockIdx;
        if (isCur) { lockX = txp; lockY = typ; }
        c.fillStyle = isCur ? RED : AMBER;
        c.beginPath(); c.arc(txp, typ, isCur ? 4 : 2.8, 0, Math.PI * 2); c.fill();
        if (isCur) {
          c.strokeStyle = T.rgba(RED, 0.45); c.lineWidth = 1;
          c.beginPath(); c.arc(txp, typ, 8 + (1 - lockProg) * 14, 0, Math.PI * 2); c.stroke();
        }
      }

      /* 4-corner shrinking tactical lock-on reticle */
      var boxR = lerp(34, 15, lockProg);
      var brk = 6;
      c.strokeStyle = isLocked ? RED : V.acc2; c.lineWidth = 1.6;
      var corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (var q = 0; q < 4; q++) {
        var sx = corners[q][0], sy = corners[q][1];
        var bx = lockX + sx * boxR, by = lockY + sy * boxR;
        c.beginPath();
        c.moveTo(bx - sx * brk, by); c.lineTo(bx, by); c.lineTo(bx, by - sy * brk);
        c.stroke();
      }
      /* Rotating dashed outer lock ring */
      c.save(); c.translate(lockX, lockY); c.rotate(t * 0.45);
      c.setLineDash([4, 4]); c.strokeStyle = isLocked ? T.rgba(RED, 0.7) : V.acc; c.lineWidth = 1;
      c.beginPath(); c.arc(0, 0, boxR + 5, 0, Math.PI * 2); c.stroke();
      c.setLineDash([]); c.restore();

      /* Diegetic floating callout card linked by orthPath + hotPacket */
      var cardW = clamp(vp.w * 0.34, 92, 185);
      var cardH = clamp(vp.h * 0.56, 62, 128);
      var cardX = vp.x + vp.w - cardW - 8;
      var cardY = vp.y + (vp.h - cardH) * 0.48;
      var leadPts = [[lockX + boxR, lockY], [cardX - 14, lockY], [cardX - 14, cardY + 18], [cardX, cardY + 18]];
      c.strokeStyle = isLocked ? RED : V.acc2; c.lineWidth = 1.2;
      T.orthPath(c, leadPts, 4);
      T.hotPacket(c, leadPts, (t * 0.42) % 1, isLocked ? RED : V.acc3, 2.2);

      var cp = T.pane(c, { x: cardX, y: cardY, w: cardW, h: cardH }, "TARGET // " + tgt.id, isLocked ? "LOCK" : "SCAN");
      if (isLocked) T.activeHalo(c, cardX, cardY, cardW, cardH, 8);
      T.specEdge(c, cardX + 3, cardY + 1, cardW - 6, 0.16);
      T.kvBlock(c, { x: cp.x + 3, y: cp.y + 2, w: cp.w - 6, h: cp.h - 4 }, [
        ["RISK", tgt.risk, isLocked],
        ["DRIFT", tgt.drift, true],
        ["DIST", tgt.dist, false],
        ["CONF", Math.round(lerp(62, 99, lockProg)) + "%", isLocked]
      ], Math.max(5.8, f * 0.82), cardX);

      return "Lock-On · " + tgt.id + " (" + tgt.drift + ")";
    }, o);
  }

  /* =========================================================================
   * #79 hudRadialMenu — HUD 05 · 放射環形快選輪盤 (Weapon/Command Wheel)
   * ========================================================================= */
  function hudRadialMenu(cv, _d, o) {
    var SECTORS = [
      { key: "1", name: "LIVE", desc: "即時遙測串流", lat: "12ms" },
      { key: "2", name: "DIFF", desc: "基準差異對照", lat: "18ms" },
      { key: "3", name: "WHAT-IF", desc: "反事實壓力模擬", lat: "44ms" },
      { key: "4", name: "TRACE", desc: "因果鏈回溯", lat: "21ms" },
      { key: "5", name: "FREEZE", desc: "快照凍結鎖定", lat: "04ms" },
      { key: "6", name: "EXPORT", desc: "靜態報告匯出", lat: "65ms" }
    ];
    return driver(12, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var actIdx = Math.floor(t / 2) % SECTORS.length;
      var subU = easeOut((t % 2) / 0.8);
      var act = SECTORS[actIdx];

      var topY = hdrBar(c, w, pad, "HUD 05 // RADIAL COMMAND WHEEL", "HOTKEY [" + act.key + "] " + act.name, f);
      var bodyH = h - topY - pad;
      var wide = w >= 420;
      var wheelW = wide ? Math.round((w - pad * 3) * 0.62) : (w - pad * 2);
      var wp = T.pane(c, { x: pad, y: topY, w: wheelW, h: bodyH }, "RADIAL SELECTOR // 6 SECTORS", "ZERO-DRIFT");
      T.specEdge(c, pad + 3, topY + 1, wheelW - 6, 0.12);

      var cx = wp.x + wp.w * 0.5, cy = wp.y + wp.h * 0.52;
      var rOut = Math.min(wp.w, wp.h) * 0.42;
      var rIn = rOut * 0.44;
      var stepA = (Math.PI * 2) / SECTORS.length;
      var gapA = 0.055;

      for (var i = 0; i < SECTORS.length; i++) {
        var sec = SECTORS[i];
        var a0 = -Math.PI / 2 + i * stepA - stepA * 0.5 + gapA;
        var a1 = -Math.PI / 2 + (i + 1) * stepA - stepA * 0.5 - gapA;
        var mid = (a0 + a1) * 0.5;
        var isAct = i === actIdx;
        var pop = isAct ? 6 * subU : 0;
        var ox = Math.cos(mid) * pop, oy = Math.sin(mid) * pop;

        c.beginPath();
        c.arc(cx + ox, cy + oy, rOut, a0, a1);
        c.arc(cx + ox, cy + oy, rIn, a1, a0, true);
        c.closePath();
        c.fillStyle = isAct ? T.rgba(V.acc, 0.28) : V.card;
        c.fill();
        c.strokeStyle = isAct ? V.acc3 : V.line2;
        c.lineWidth = isAct ? 1.6 : 1;
        c.stroke();

        if (isAct) {
          c.beginPath();
          c.arc(cx + ox, cy + oy, rOut + 3, a0, a1);
          c.strokeStyle = V.acc2; c.lineWidth = 2.2; c.stroke();
        }

        var lr = (rIn + rOut) * 0.52;
        var lx = cx + ox + Math.cos(mid) * lr, ly = cy + oy + Math.sin(mid) * lr;
        T.tx(c, sec.name, lx, ly, Math.max(5.5, f * 0.82), isAct ? V.ink : V.dim, "center", "700");
      }

      /* Center hub */
      c.beginPath(); c.arc(cx, cy, rIn - 4, 0, Math.PI * 2);
      c.fillStyle = V.bg; c.fill();
      c.strokeStyle = V.acc2; c.lineWidth = 1.4; c.stroke();
      T.tx(c, act.name, cx, cy - f * 0.35, Math.max(6.5, f * 0.95), V.ink, "center", "700");
      T.tx(c, "[" + act.key + "]", cx, cy + f * 0.72, Math.max(5.5, f * 0.78), V.acc3, "center", "600");

      /* Right info pane */
      if (wide) {
        var rx = pad * 2 + wheelW, rw = w - pad * 3 - wheelW;
        var rp = T.pane(c, { x: rx, y: topY, w: rw, h: bodyH }, "ACTIVE PRESET", "READY");
        T.activeHalo(c, rx, topY, rw, bodyH, 7);
        T.specEdge(c, rx + 3, topY + 1, rw - 6, 0.12);
        T.kvBlock(c, { x: rp.x + 4, y: rp.y + 6, w: rp.w - 8, h: rp.h - 12 }, [
          ["MODE", act.name, true],
          ["KEY", "ALT+" + act.key, false],
          ["DESC", T.fitM(c, act.desc, rp.w * 0.56, Math.max(5.8, f * 0.82), "600"), false],
          ["LATENCY", act.lat, true],
          ["SECTORS", "6 RADIAL", false]
        ], Math.max(6, f * 0.84), rx);
      }
      return "Radial Wheel · [" + act.key + "] " + act.name;
    }, o);
  }

  /* =========================================================================
   * #80 hudCompass — HUD 06 · 1D 線性羅盤＋視窗外越界指標
   * ========================================================================= */
  function hudCompass(cv, _d, o) {
    var PINS = [
      { id: "ALERT-A", deg: 35, crit: true, dist: 180 },
      { id: "HUB-02", deg: 128, crit: false, dist: 420 },
      { id: "GATE-X", deg: 245, crit: true, dist: 310 },
      { id: "SYNC-9", deg: 312, crit: false, dist: 690 }
    ];
    var CARDINALS = { 0: "N", 45: "NE", 90: "E", 135: "SE", 180: "S", 225: "SW", 270: "W", 315: "NW" };
    return driver(16, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var heading = (t * 22.5) % 360;
      var topY = hdrBar(c, w, pad, "HUD 06 // COMPASS & OFF-SCREEN POINTERS", "HDG " + ("00" + Math.round(heading)).slice(-3) + "°", f);
      var bodyH = h - topY - pad;

      /* Top 1D Linear Compass Ribbon */
      var compH = clamp(bodyH * 0.22, 26, 44);
      var cp = T.pane(c, { x: pad, y: topY, w: w - pad * 2, h: compH });
      T.specEdge(c, pad + 3, topY + 1, w - pad * 2 - 6, 0.12);

      var cx = cp.x + cp.w * 0.5;
      var pxPerDeg = cp.w / 140;
      c.save(); c.beginPath(); c.rect(cp.x + 2, cp.y, cp.w - 4, cp.h); c.clip();
      for (var deg = -75; deg <= 75; deg += 5) {
        var absDeg = ((Math.round(heading / 5) * 5 + deg) % 360 + 360) % 360;
        var diff = ((absDeg - heading + 540) % 360) - 180;
        var txp = cx + diff * pxPerDeg;
        var isMajor = absDeg % 15 === 0;
        c.strokeStyle = isMajor ? V.txt : V.line2; c.lineWidth = 1;
        T.ln(c, txp, cp.y + cp.h - (isMajor ? 9 : 5), txp, cp.y + cp.h - 1);
        if (absDeg % 45 === 0) {
          T.tx(c, CARDINALS[absDeg] || String(absDeg), txp, cp.y + cp.h * 0.36, Math.max(6, f * 0.85), absDeg === 0 ? RED : V.ink, "center", "700");
        } else if (absDeg % 15 === 0 && cp.w > 260) {
          T.tx(c, String(absDeg), txp, cp.y + cp.h * 0.36, Math.max(5.4, f * 0.7), V.dim, "center", "500");
        }
      }
      /* Waypoint pins on compass */
      for (var p = 0; p < PINS.length; p++) {
        var pin = PINS[p];
        var dPin = ((pin.deg - heading + 540) % 360) - 180;
        if (Math.abs(dPin) <= 70) {
          var px = cx + dPin * pxPerDeg;
          c.fillStyle = pin.crit ? RED : V.acc2;
          c.beginPath(); c.moveTo(px, cp.y + 3); c.lineTo(px + 4, cp.y + 9); c.lineTo(px - 4, cp.y + 9); c.closePath(); c.fill();
        }
      }
      c.restore();
      /* Center heading caret */
      c.fillStyle = WHITE;
      c.beginPath(); c.moveTo(cx, cp.y + cp.h - 1); c.lineTo(cx - 4, cp.y + cp.h + 5); c.lineTo(cx + 4, cp.y + cp.h + 5); c.closePath(); c.fill();

      /* Main Viewport + Off-Screen Edge Pointers */
      var vy = topY + compH + 8;
      var vh = bodyH - compH - 8;
      var vp = T.pane(c, { x: pad, y: vy, w: w - pad * 2, h: vh }, "ACTIVE VIEWPORT // EDGE TRACKERS", "4 OFF-SCREEN");
      var vcx = vp.x + vp.w * 0.5, vcy = vp.y + vp.h * 0.52;

      /* Subtle viewport inner frame */
      var ix = vp.x + 18, iy = vp.y + 14, iw = vp.w - 36, ih = vp.h - 28;
      c.strokeStyle = V.line; c.setLineDash([3, 3]); c.lineWidth = 1;
      T.roundRect(c, ix, iy, iw, ih, 3); c.stroke(); c.setLineDash([]);

      /* Visible local nodes inside viewport */
      for (var n = 0; n < 7; n++) {
        var nx = ix + iw * (0.15 + T.hh(n, 7) * 0.7);
        var ny = iy + ih * (0.18 + T.hh(n, 13) * 0.64);
        c.fillStyle = V.acc; c.beginPath(); c.arc(nx, ny, 2.6, 0, Math.PI * 2); c.fill();
      }
      /* Player/Camera center glyph */
      c.strokeStyle = V.acc2; c.lineWidth = 1.4;
      c.beginPath(); c.arc(vcx, vcy, 5, 0, Math.PI * 2); c.stroke();

      /* Project 4 off-screen targets onto viewport perimeter */
      for (var k = 0; k < PINS.length; k++) {
        var pk = PINS[k];
        var ang = ((pk.deg - heading) - 90) * Math.PI / 180;
        var dx = Math.cos(ang), dy = Math.sin(ang);
        var txScale = Math.abs(dx) > 0.001 ? ((iw * 0.5) / Math.abs(dx)) : 1e9;
        var tyScale = Math.abs(dy) > 0.001 ? ((ih * 0.5) / Math.abs(dy)) : 1e9;
        var sc = Math.min(txScale, tyScale);
        var ex = vcx + dx * sc, ey = vcy + dy * sc;
        var col = pk.crit ? RED : AMBER;

        if (pk.crit) T.activeHalo(c, ex - 6, ey - 6, 12, 12, 7);
        /* Directional chevron arrow */
        c.save(); c.translate(ex, ey); c.rotate(ang);
        c.fillStyle = col;
        c.beginPath(); c.moveTo(7, 0); c.lineTo(-4, -4.5); c.lineTo(-2, 0); c.lineTo(-4, 4.5); c.closePath(); c.fill();
        c.restore();

        var lblX = clamp(ex - dx * 22, ix + 24, ix + iw - 24);
        var lblY = clamp(ey - dy * 14, iy + 8, iy + ih - 8);
        T.tx(c, pk.id + " " + pk.dist + "m", lblX, lblY, Math.max(5.4, f * 0.74), col, "center", "700");
      }

      if (vh >= 90) {
        T.leader(c, "NEAREST THREAT: ALERT-A", "180m · BEARING 035°", ix + 4, ix + iw - 4, vp.y + vp.h - 6, Math.max(5.6, f * 0.76), true);
      }
      return "Compass · HDG " + Math.round(heading) + "° · 4 Edge Trackers";
    }, o);
  }

  /* =========================================================================
   * #81 hudFeedback — HUD 07 · 連擊微回饋＋分級通知堆疊與轉場
   * ========================================================================= */
  function hudFeedback(cv, _d, o) {
    var hasD = _d && typeof _d === "object";
    var TOASTS = (hasD && _d.toasts && _d.toasts.length) ? _d.toasts : [
      { sev: "PASS", col: GREEN, title: "GATE-R01 ZERO CYCLES", meta: "+120 PTS" },
      { sev: "SYNC", col: V.acc2, title: "ALAYA INDEX SNAPSHOT", meta: "14ms" },
      { sev: "WARN", col: AMBER, title: "CTX WATERMARK 76%", meta: "PRUNE" },
      { sev: "CRIT", col: RED, title: "RATE-LIMIT CIRCUIT TRIP", meta: "ARMED" }
    ];
    var STAGES = (hasD && _d.stages && _d.stages.length) ? _d.stages : ["PARSE", "AUDIT", "GATE", "COMMIT", "SYNC"];
    return driver(16, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      bgGrid(c, w, h);
      var f = T.infoFont(w), pad = Math.max(8, Math.round(w * 0.024));
      var streak = (hasD && _d.streak != null) ? _d.streak : (12 + Math.floor(t));
      var rank = (hasD && _d.rank) ? _d.rank : (hasD && _d.streak != null ? (streak >= 8 ? "S+" : (streak >= 5 ? "S" : (streak >= 3 ? "A" : "B"))) : (streak >= 22 ? "S+" : (streak >= 17 ? "S" : "A")));
      var topY = hdrBar(c, w, pad, (hasD && _d.title) ? _d.title : "HUD 07 // STREAK & TOAST CASCADE", (hasD && _d.subtitle != null) ? _d.subtitle : ("RANK " + rank + "  ·  " + streak + "×"), f);
      var bodyH = h - topY - pad;
      var leftW = Math.round((w - pad * 3) * 0.44);
      var rightW = w - pad * 3 - leftW;

      /* Left pane: Streak Ring + Develop Cascade Morph Bar */
      var lp = T.pane(c, { x: pad, y: topY, w: leftW, h: bodyH }, (hasD && _d.lpTitle) ? _d.lpTitle : "COMBO // GATE STREAK", (hasD && _d.lpSub) ? _d.lpSub : "DECAY TIMER");
      T.specEdge(c, pad + 3, topY + 1, leftW - 6, 0.12);

      var rcx = lp.x + lp.w * 0.5, rcy = lp.y + lp.h * 0.36;
      var rad = Math.max(18, Math.min(lp.w * 0.32, lp.h * 0.28));
      var decay = (hasD && _d.decay != null) ? _d.decay : (1 - (t % 2) / 2);
      var isHot = (hasD && _d.streak != null) ? (streak >= 5) : (streak >= 20);

      c.strokeStyle = V.track; c.lineWidth = 4;
      c.beginPath(); c.arc(rcx, rcy, rad, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = isHot ? GREEN : V.acc2; c.lineWidth = 4;
      c.beginPath(); c.arc(rcx, rcy, rad, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * decay); c.stroke();
      if (isHot) T.activeHalo(c, rcx - rad, rcy - rad, rad * 2, rad * 2, 10);

      T.tx(c, streak + "×", rcx, rcy - f * 0.25, Math.max(10, f * 1.55), V.ink, "center", "800");
      T.tx(c, "RANK " + rank, rcx, rcy + f * 0.95, Math.max(5.8, f * 0.8), GREEN, "center", "700");

      /* Cascade Morph Bar with A23Tex develop scanline */
      var cbY = lp.y + lp.h * 0.70, cbH = lp.h * 0.24;
      var cbBox = { x: lp.x + 6, y: cbY, w: lp.w - 12, h: Math.max(16, cbH) };
      var devProg = (hasD && _d.stageProg != null) ? _d.stageProg : ((t % 4) / 4);
      T.develop(c, cbBox, devProg, function (ctx, col) {
        var sw = (cbBox.w - 4 * 3) / STAGES.length;
        for (var st = 0; st < STAGES.length; st++) {
          var sx = cbBox.x + st * (sw + 3);
          ctx.fillStyle = col;
          T.roundRect(ctx, sx, cbBox.y + 2, sw, cbBox.h - 4, 2); ctx.fill();
          if (cbBox.h >= 22 && sw >= 24) {
            T.tx(ctx, STAGES[st], sx + sw * 0.5, cbBox.y + cbBox.h * 0.5, Math.max(5.2, f * 0.65), V.bg, "center", "700");
          }
        }
      });

      /* Right pane: Staggered Toast Notification Stack */
      var rx = pad * 2 + leftW;
      var rp = T.pane(c, { x: rx, y: topY, w: rightW, h: bodyH }, (hasD && _d.rpTitle) ? _d.rpTitle : "NOTIFICATION STACK // CASCADE", (hasD && _d.rpSub != null) ? _d.rpSub : "4 EVENTS");
      T.specEdge(c, rx + 3, topY + 1, rightW - 6, 0.12);

      var cardGap = Math.max(4, Math.round(rp.h * 0.035));
      var ch = (rp.h - 8 - cardGap * (TOASTS.length - 1)) / TOASTS.length;
      var activeToast = (hasD && _d.staticToasts) ? 0 : (Math.floor(t / 4) % TOASTS.length);

      for (var i = 0; i < TOASTS.length; i++) {
        var idx = (i + activeToast) % TOASTS.length;
        var item = TOASTS[idx];
        var slideU = (hasD && _d.staticToasts) ? 1 : easeOut(((t % 4) - i * 0.18) / 0.8);
        var slideX = (1 - slideU) * 18;
        var ty = rp.y + 4 + i * (ch + cardGap);
        var tx0 = rp.x + 5 + slideX, tw = rp.w - 10;

        c.save(); c.globalAlpha = clamp(slideU + 0.2, 0.2, 1);
        c.fillStyle = V.card;
        T.roundRect(c, tx0, ty, tw, ch, 3); c.fill();
        c.strokeStyle = i === 0 ? item.col : V.line2; c.lineWidth = i === 0 ? 1.2 : 1;
        T.roundRect(c, tx0 + 0.5, ty + 0.5, tw - 1, ch - 1, 3); c.stroke();
        /* Left severity bar */
        c.fillStyle = item.col;
        c.fillRect(tx0 + 1, ty + 2, 3, ch - 4);
        T.kvPort(c, rx, ty + ch * 0.5, i === 0);

        T.tx(c, item.sev, tx0 + 9, ty + ch * 0.34, Math.max(5.5, f * 0.76), item.col, "left", "700");
        T.tx(c, item.meta, tx0 + tw - 6, ty + ch * 0.34, Math.max(5.5, f * 0.76), V.ink, "right", "700");
        T.tx(c, T.fitM(c, item.title, tw - 16, Math.max(5.8, f * 0.8), "600"), tx0 + 9, ty + ch * 0.70, Math.max(5.8, f * 0.8), V.txt, "left", "600");
        c.restore();
      }
      return "Feedback · Streak " + streak + "× (" + rank + ")";
    }, o);
  }

  A23.hudVitals = hudVitals;
  A23.hudLoadout = hudLoadout;
  A23.hudSkillTree = hudSkillTree;
  A23.hudLockOn = hudLockOn;
  A23.hudRadialMenu = hudRadialMenu;
  A23.hudCompass = hudCompass;
  A23.hudFeedback = hudFeedback;
  g.A23Charts = A23;
})(typeof window !== "undefined" ? window : globalThis);
