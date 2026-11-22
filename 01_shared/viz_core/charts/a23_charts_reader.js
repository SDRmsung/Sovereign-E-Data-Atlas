/* A23 Charts — RDR 引證閱讀套組 (#57 spanPointer / #58 orbitRace / #59 modelCostBoard)
 * 載入順序：在 a23_charts_loop.js 之後，掛載新函式至 window.A23Charts。
 * 保證 seek(t) 100% 決定性重繪（LCG seed=20261116、零 Math.random、零 Date.now、零閉包累加狀態）。
 */
(function (g) {
  "use strict";
  var A23 = g.A23Charts || {};
  var BG = "#07090c", CARD = "#0d1117", LINE = "#27272a";
  var GOLD = "#f5b301", CYAN = "#22d3ee", PURPLE = "#a78bfa", GREEN = "#22c55e", RED = "#ef4444";
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

  function fitTxt(str, maxW, fSize) {
    var maxCh = Math.max(6, Math.floor(maxW / (fSize * 0.61)));
    return str.length > maxCh ? str.slice(0, maxCh - 1) + "…" : str;
  }

  function fmtComma(num) {
    return String(Math.round(num)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  function drawPill(c, label, x, y, w, h, color, fSize) {
    c.fillStyle = color + "22";
    roundRect(c, x, y, w, h, 3);
    c.fill();
    c.strokeStyle = color;
    c.lineWidth = 0.9;
    c.stroke();
    text(c, label, x + w * 0.5, y + h * 0.5, fSize, color, "center", "700");
  }

  /* #57 spanPointer — 答案出處指標 (driver n=60) */
  function spanPointer(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return spanPointerLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme(GOLD)), V = K.V, tx = K.tx;
    var o = opt || {}, nFrames = 60, ANS = 6;
    var DOC = ["From: a.lin@metro-claims.example", "To: intake@shield-insure.example", "Subject: Claim #CLM-8841 - Roof",
      "Date: Tue, 05 Nov 2026 09:14:22", "----------------------------------", "Policyholder reported storm water.",
      "On the night of 4 November, gusts", "tore the north roof flashing loose,", "causing ceiling leak in Unit 4B.",
      "Repair estimate: $4,250.00 total.", "Policy #POL-99201 · Deduct $500.", "Photos: roof_01.jpg, leak_02.jpg",
      "Adjuster visit set for 07 Nov.", "Regards, Alex Lin (Claimant)"];
    var QUEUE = [["Q2", "Coverage limit?"], ["Q3", "Deductible amount?"], ["Q4", "Adjuster date?"]];
    var CHECKS = [["span found", "L7:C1..C33", 0.42], ["quote matches", "exact 100%", 0.56], ["date parsed", "2026-11-04", 0.7], ["no hallucination", "grounded 1.0", 0.84]];
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420, i;
      var u = clamp(t / (nFrames - 1), 0, 1), f = K.infoFont(w), pad = compact ? 6 : 10, gap = compact ? 5 : 8;
      var rowKV = f + Math.max(5, Math.round(f * 0.8));
      var st = u < 0.25 ? "WAITING" : (u < 0.55 ? "READING" : "ANSWERED"), hasHL = u >= 0.45, hasAns = u >= 0.55;
      var scan = clamp(u * 1.28, 0, 1) * (DOC.length - 1), cur = Math.min(DOC.length - 1, Math.floor(scan));
      var pass = 0; for (i = 0; i < 4; i++) if (u >= CHECKS[i][2]) pass++;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, compact ? "SPAN POINTER" : "RDR 01 · SPAN POINTER · ANSWERS YOU CAN POINT TO", w * 0.68, f + 1, "700"), pad, 11, f + 1, V.ink, "left", "700");
      tx(c, st, w - pad, 11, f - 1, hasAns ? GREEN : V.acc2, "right", "700");
      var chkH = 13 + rowKV * 4 + 4, bY = 20, bH = h - bY - pad - gap - chkH, inner = w - pad * 2;
      var D, A, Lq = null;
      if (compact) { var dw = Math.round((inner - gap) * 0.62); D = { x: pad, y: bY, w: dw, h: bH }; A = { x: pad + dw + gap, y: bY, w: inner - dw - gap, h: bH }; }
      else {
        var wL = Math.round((inner - gap * 2) * 0.27), wC = Math.round((inner - gap * 2) * 0.47), wR = inner - gap * 2 - wL - wC;
        Lq = { x: pad, y: bY, w: wL, h: bH }; D = { x: pad + wL + gap, y: bY, w: wC, h: bH }; A = { x: D.x + wC + gap, y: bY, w: wR, h: bH };
      }
      /* 02 QUESTION＋QUEUE（桌面） */
      if (Lq) {
        var qh = Math.round((Lq.h - gap) * 0.42), Qb = { x: Lq.x, y: Lq.y, w: Lq.w, h: qh }, Ub = { x: Lq.x, y: Lq.y + qh + gap, w: Lq.w, h: Lq.h - qh - gap };
        var iq = K.pane(c, Qb, "02 QUESTION", "1/4"); K.specEdge(c, Qb.x + 3, Qb.y + 1, Qb.w - 6);
        tx(c, K.fitM(c, "When did the", iq.w - 8, f + 1, "700"), iq.x + 4, iq.y + iq.h * 0.3, f + 1, V.ink, "left", "700");
        tx(c, K.fitM(c, "damage happen?", iq.w - 8, f + 1, "700"), iq.x + 4, iq.y + iq.h * 0.3 + f + 6, f + 1, V.ink, "left", "700");
        tx(c, K.fitM(c, st.toLowerCase(), iq.w - 8, f, "600"), iq.x + 4, iq.y + iq.h - f * 0.8, f, hasAns ? GREEN : V.dim, "left", "600");
        var iu = K.pane(c, Ub, "QUEUE", "3 NEXT");
        K.kvBlock(c, { x: iu.x, y: iu.y + 2, w: iu.w, h: iu.h - 2 }, QUEUE, f, Ub.x);
      }
      /* 01 FILE：行號≥infoFont；掃描＝列底光暈＋左槽亮條（不壓字）；答案列＝唯一作用列 */
      var id = K.pane(c, D, compact ? "claim_email.md" : "01 FILE · claim_email.md", "L" + (cur + 1) + "/14");
      var dF = compact ? f : Math.max(9, f - 1), rH = (id.h - 4) / DOC.length;
      c.font = dF + "px " + K.MONO;
      var gut = c.measureText("14").width + 8, tx0 = id.x + gut + 4, sy = id.y + 2 + (scan + 0.5) * rH, hl = null;
      c.fillStyle = V.track; c.fillRect(id.x + 1, sy - rH * 0.5, id.w - 2, rH);
      c.fillStyle = V.acc; c.fillRect(id.x + 1, sy - rH * 0.5, 2, rH);
      for (i = 0; i < DOC.length; i++) {
        var ry = id.y + 2 + (i + 0.5) * rH, isA = i === ANS && hasHL;
        if (isA) { hl = { x: tx0 - 3, y: ry - rH * 0.45, w: id.x + id.w - 3 - (tx0 - 3), h: rH * 0.9 }; if (compact) { c.fillStyle = K.rgba(V.acc, 0.14); K.roundRect(c, hl.x, hl.y, hl.w, hl.h, 2); c.fill(); c.strokeStyle = V.acc2; c.lineWidth = 1; c.stroke(); } else K.activeHalo(c, hl.x, hl.y, hl.w, hl.h, 10); }
        tx(c, String(i + 1), id.x + gut, ry, dF, i === cur ? V.acc2 : V.mute, "right", "600");
        tx(c, K.fitM(c, DOC[i], id.x + id.w - 4 - tx0, dF, isA ? "700" : "400"), tx0, ry, dF, isA ? V.acc3 : (i <= cur ? V.txt : V.dim), "left", isA ? "700" : "400");
      }
      /* 03 ANSWER：答案＋插畫預覽（文件縮圖顯影）＋鍵值列 */
      var ia = K.pane(c, A, "03 ANSWER", hasAns ? "LOCKED" : "IDLE"), ay = ia.y + f * 0.7 + 1;
      tx(c, K.fitM(c, hasAns ? "night of 4 Nov" : (hasHL ? "extracting…" : "scanning…"), ia.w - 8, f + (compact ? 1 : 3), "700"), ia.x + 4, ay, f + (compact ? 1 : 3), hasAns ? V.acc3 : V.dim, "left", "700");
      var nKv = compact ? 2 : 3, kvH = rowKV * nKv + 2, pv = { x: ia.x + 3, y: ay + f + 3, w: ia.w - 6, h: ia.y + ia.h - kvH - 4 - (ay + f + 3) };
      if (pv.h > 16) {
        K.pane(c, pv);
        var pb = { x: pv.x + 4, y: pv.y + 4, w: pv.w - 8, h: pv.h - 8 }, prh = pb.h / DOC.length;
        K.develop(c, pb, scan / (DOC.length - 1), function (cc, col) {
          for (var j = 0; j < DOC.length; j++) { cc.fillStyle = (j === ANS && hasHL) ? V.acc : col; cc.fillRect(pb.x, pb.y + j * prh + prh * 0.3, pb.w * (0.25 + 0.75 * DOC[j].length / 36), Math.max(1, prh * 0.4)); }
        });
      }
      var kvRows = [["src", hasAns ? "L7" : "—", hasAns], ["conf", hasAns ? "0.99" : "—"]];
      if (!compact) kvRows.push(["state", hasAns ? "grounded" : "pending"]);
      K.kvBlock(c, { x: ia.x, y: ia.y + ia.h - kvH, w: ia.w, h: kvH }, kvRows, f, A.x + A.w);
      /* 答案↔出處：曼哈頓圓角引線＋熱封包；鎖定後兩端埠點亮 */
      if (hl) {
        var ax = A.x, ayy = ay, mx = A.x - gap / 2, ex = hl.x + hl.w, ey = hl.y + hl.h / 2;
        var pts = [[ax, ayy], [mx, ayy], [mx, ey], [ex, ey]];
        c.strokeStyle = hasAns ? V.acc : V.line2; c.lineWidth = hasAns ? 1.3 : 1;
        if (!hasAns) c.setLineDash([2, 2]); K.orthPath(c, pts, 4); c.setLineDash([]);
        if (hasAns) { var lp = clamp((u - 0.55) / 0.14, 0, 1); if (lp < 1) K.hotPacket(c, pts, lp, V.acc3, compact ? 2 : 2.6); K.kvPort(c, ax, ayy, true); K.kvPort(c, ex, ey, lp >= 1); }
      }
      /* 05 SPAN CHECK：鍵值列；通過值上語意綠 */
      var C = { x: pad, y: h - pad - chkH, w: inner, h: chkH };
      var ic = K.pane(c, C, "05 SPAN CHECK", pass + "/4 VERIFIED");
      var rows = CHECKS.map(function (r) { var ok = u >= r[2]; return [r[0], ok ? r[1] : "pending", ok]; });
      var nr = K.kvBlock(c, { x: ic.x, y: ic.y + 1, w: ic.w, h: ic.h - 1 }, rows, f, C.x);
      for (i = 0; i < nr; i++) if (rows[i][2]) { c.fillStyle = GREEN; c.fillRect(C.x + C.w - 3, Math.round(ic.y + 1 + rowKV * (i + 0.6)) - f * 0.4, 2, f * 0.8); }
      return st.toLowerCase() + " · " + pass + "/4 checks";
    }, o);
  }

  function spanPointerLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;

    var DOC_LINES = [
      "From: a.lin@metro-claims.example",
      "To: intake@shield-insure.example",
      "Subject: Claim #CLM-8841 - Roof",
      "Date: Tue, 05 Nov 2026 09:14:22",
      "----------------------------------",
      "Policyholder reported storm water.",
      "On the night of 4 November, gusts",
      "tore the north roof flashing loose,",
      "causing ceiling leak in Unit 4B.",
      "Repair estimate: $4,250.00 total.",
      "Policy #POL-99201 · Deduct $500.",
      "Photos: roof_01.jpg, leak_02.jpg",
      "Adjuster visit set for 07 Nov.",
      "Regards, Alex Lin (Claimant)"
    ];
    var ANS_LINE = 6; // "On the night of 4 November, gusts"

    var QUEUE = [
      { q: "Q 2/4 · Coverage limit?", st: "queued" },
      { q: "Q 3/4 · Deductible amount?", st: "queued" },
      { q: "Q 4/4 · Adjuster date?", st: "queued" }
    ];

    var CHECKS = [
      { key: "span found",       detail: "L7:C1..C33",   thr: 0.42 },
      { key: "quote matches",    detail: "exact 100%",   thr: 0.56 },
      { key: "date parsed",      detail: "2026-11-04",   thr: 0.70 },
      { key: "no hallucination", detail: "grounded 1.0", thr: 0.84 }
    ];

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 12;
      var topH = compact ? 22 : 26;
      var gap = compact ? 6 : 8;

      var qStatus = u < 0.25 ? "waiting" : (u < 0.55 ? "reading" : "answered");
      var qColor = qStatus === "waiting" ? MUTED : (qStatus === "reading" ? GOLD : GREEN);
      var hasHighlight = u >= 0.45;
      var hasAnswer = u >= 0.55;

      // Header
      text(c, compact ? "SPAN POINTER · claim_email.md" : "RDR 01 · SPAN POINTER · ANSWERS YOU CAN POINT TO", pad, topH * 0.5, compact ? 8.5 : 9.5, DIM, "left", "700");
      var stBadgeW = compact ? 58 : 70;
      drawPill(c, qStatus.toUpperCase(), w - pad - stBadgeW, 4, stBadgeW, topH - 8, qColor, compact ? 7.5 : 8);

      var scanLine = clamp(u * 1.28, 0, 1) * (DOC_LINES.length - 1);
      var curLineIdx = Math.min(DOC_LINES.length - 1, Math.floor(scanLine));

      if (compact) {
        // compact：只留文件＋高亮＋答案卡
        var ansH = Math.max(66, Math.round((h - topH - pad - gap) * 0.28));
        var docBox = { x: pad, y: topH + 4, w: w - pad * 2, h: h - topH - pad - gap - ansH };
        var ansBox = { x: pad, y: docBox.y + docBox.h + gap, w: w - pad * 2, h: ansH };

        // Doc Viewer
        c.fillStyle = CARD; roundRect(c, docBox.x, docBox.y, docBox.w, docBox.h, 5); c.fill();
        c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
        text(c, "claim_email.md", docBox.x + 8, docBox.y + 11, 8.5, CYAN, "left", "700");
        text(c, "L" + (curLineIdx + 1) + "/14", docBox.x + docBox.w - 8, docBox.y + 11, 7.5, MUTED, "right", "600");

        var dTop = docBox.y + 22;
        var dRowH = (docBox.h - 28) / DOC_LINES.length;
        var hlBox = null;

        // Scan cursor bar
        var scanY = dTop + (scanLine + 0.5) * dRowH;
        c.fillStyle = "rgba(34, 211, 238, 0.14)";
        c.fillRect(docBox.x + 4, scanY - dRowH * 0.48, docBox.w - 8, dRowH * 0.96);
        c.fillStyle = CYAN;
        c.fillRect(docBox.x + 4, scanY - 0.8, docBox.w - 8, 1.6);

        for (var li = 0; li < DOC_LINES.length; li++) {
          var ry = dTop + (li + 0.5) * dRowH;
          var isAns = li === ANS_LINE;
          if (isAns && hasHighlight) {
            hlBox = { x: docBox.x + 22, y: ry - dRowH * 0.48, w: docBox.w - 28, h: dRowH * 0.96 };
            c.fillStyle = "rgba(245, 179, 1, 0.18)";
            roundRect(c, hlBox.x, hlBox.y, hlBox.w, hlBox.h, 3);
            c.fill();
            c.strokeStyle = GOLD;
            c.lineWidth = 1.2;
            c.stroke();
          }
          text(c, String(li + 1), docBox.x + 17, ry, 7, MUTED, "right");
          text(c, fitTxt(DOC_LINES[li], docBox.w - 30, 7.5), docBox.x + 24, ry, 7.5, (isAns && hasHighlight) ? GOLD : TEXT, "left", (isAns && hasHighlight) ? "700" : "400");
        }

        // Answer Card
        c.fillStyle = CARD; roundRect(c, ansBox.x, ansBox.y, ansBox.w, ansBox.h, 5); c.fill();
        c.strokeStyle = hasAnswer ? GOLD : LINE; c.lineWidth = hasAnswer ? 1.3 : 1; c.stroke();
        text(c, "ANSWER", ansBox.x + 8, ansBox.y + 12, 8, GOLD, "left", "700");
        text(c, hasAnswer ? "night of 4 Nov" : (hasHighlight ? "extracting..." : "scanning..."), ansBox.x + 8, ansBox.y + ansBox.h * 0.54, 11, hasAnswer ? FG : DIM, "left", "700");
        text(c, hasAnswer ? "src: claim_email.md · L7" : "awaiting span lock", ansBox.x + 8, ansBox.y + ansBox.h - 11, 7.5, hasAnswer ? GREEN : MUTED, "left", "600");

        if (hasAnswer && hlBox) {
          var lp = clamp((u - 0.55) / 0.12, 0, 1);
          var ax = ansBox.x + ansBox.w * 0.80, ay = ansBox.y;
          var hx = hlBox.x + hlBox.w - 6, hy = hlBox.y + hlBox.h * 0.5;
          var mx = ax;
          c.strokeStyle = GOLD;
          c.lineWidth = 1.3;
          c.beginPath();
          c.moveTo(ax, ay);
          c.lineTo(mx, lerp(ay, hy, lp));
          if (lp > 0.5) {
            c.lineTo(lerp(mx, hx, (lp - 0.5) * 2), hy);
          }
          c.stroke();
          c.fillStyle = GOLD;
          c.beginPath(); c.arc(ax, ay, 2.5, 0, Math.PI * 2); c.fill();
          if (lp > 0.9) { c.beginPath(); c.arc(hx, hy, 2.5, 0, Math.PI * 2); c.fill(); }
        }

        return qStatus + " · " + Math.round(u * 100) + "%";
      }

      // Full layout: Left 30%, Center 45%, Right 25% + Bottom SPAN CHECK
      var botH = h < 390 ? 74 : 92;
      var bodyY = topH + 4;
      var bodyH = h - bodyY - pad - gap - botH;
      var innerW = w - pad * 2 - gap * 2;
      var wL = Math.round(innerW * 0.30);
      var wC = Math.round(innerW * 0.45);
      var wR = innerW - wL - wC;

      var leftCol = { x: pad, y: bodyY, w: wL, h: bodyH };
      var midCol = { x: pad + wL + gap, y: bodyY, w: wC, h: bodyH };
      var rightCol = { x: pad + wL + gap + wC + gap, y: bodyY, w: wR, h: bodyH };
      var botBox = { x: pad, y: bodyY + bodyH + gap, w: w - pad * 2, h: botH };

      var hdrF = w < 540 ? 7.5 : 9;
      var bodyF = w < 540 ? 7.2 : 9.2;

      // Left Top: Question Card
      var qCardH = Math.round((leftCol.h - gap) * 0.46);
      var qBox = { x: leftCol.x, y: leftCol.y, w: leftCol.w, h: qCardH };
      var queueBox = { x: leftCol.x, y: leftCol.y + qCardH + gap, w: leftCol.w, h: leftCol.h - qCardH - gap };

      c.fillStyle = CARD; roundRect(c, qBox.x, qBox.y, qBox.w, qBox.h, 5); c.fill();
      c.strokeStyle = u >= 0.25 ? "rgba(245,179,1,0.45)" : LINE; c.lineWidth = 1; c.stroke();
      text(c, "02 QUESTION", qBox.x + 8, qBox.y + 12, hdrF, GOLD, "left", "700");
      var qTagW = w < 540 ? 48 : 58;
      drawPill(c, qStatus, qBox.x + qBox.w - qTagW - 6, qBox.y + 5, qTagW, 14, qColor, w < 540 ? 6.5 : 7.5);

      var qLine1 = fitTxt("Q 1/4 · When did the", qBox.w - 16, bodyF);
      var qLine2 = fitTxt("damage happen?", qBox.w - 16, bodyF);
      text(c, qLine1, qBox.x + 8, qBox.y + qBox.h * 0.48, bodyF, FG, "left", "700");
      text(c, qLine2, qBox.x + 8, qBox.y + qBox.h * 0.72, bodyF, FG, "left", "700");

      // Left Bottom: QUEUE (3 items)
      c.fillStyle = CARD; roundRect(c, queueBox.x, queueBox.y, queueBox.w, queueBox.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "QUEUE", queueBox.x + 8, queueBox.y + 12, hdrF, DIM, "left", "700");
      text(c, "3 NEXT", queueBox.x + queueBox.w - 8, queueBox.y + 12, hdrF - 1, MUTED, "right", "600");

      var qRowH = (queueBox.h - 24) / QUEUE.length;
      for (var qi = 0; qi < QUEUE.length; qi++) {
        var qry = queueBox.y + 22 + (qi + 0.5) * qRowH;
        text(c, fitTxt(QUEUE[qi].q, queueBox.w - 16, bodyF - 0.8), queueBox.x + 8, qry, bodyF - 0.8, DIM, "left");
      }

      // Center: Document Viewer (claim_email.md)
      c.fillStyle = CARD; roundRect(c, midCol.x, midCol.y, midCol.w, midCol.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "01 FILE · claim_email.md", midCol.x + 8, midCol.y + 12, hdrF, CYAN, "left", "700");
      text(c, "L" + (curLineIdx + 1) + "/14", midCol.x + midCol.w - 8, midCol.y + 12, hdrF - 1, MUTED, "right", "600");

      var docTop = midCol.y + 22;
      var docRowH = (midCol.h - 26) / DOC_LINES.length;
      var scanMidY = docTop + (scanLine + 0.5) * docRowH;

      // Scan cursor band
      c.fillStyle = "rgba(34, 211, 238, 0.13)";
      c.fillRect(midCol.x + 4, scanMidY - docRowH * 0.48, midCol.w - 8, docRowH * 0.96);
      c.fillStyle = CYAN;
      c.fillRect(midCol.x + 4, scanMidY - 0.8, midCol.w - 8, 1.6);

      var hlAnchor = null;
      var docF = w < 540 ? 6.8 : 8.8;
      for (var di = 0; di < DOC_LINES.length; di++) {
        var dry = docTop + (di + 0.5) * docRowH;
        var isAnsLine = di === ANS_LINE;
        if (isAnsLine && hasHighlight) {
          var hx0 = midCol.x + (w < 540 ? 18 : 24);
          var hw0 = midCol.x + midCol.w - 6 - hx0;
          var hy0 = dry - docRowH * 0.48;
          var hh0 = docRowH * 0.96;
          c.fillStyle = "rgba(245, 179, 1, 0.20)";
          roundRect(c, hx0, hy0, hw0, hh0, 3);
          c.fill();
          c.strokeStyle = GOLD;
          c.lineWidth = 1.25;
          c.stroke();
          hlAnchor = { x: hx0 + hw0, y: dry };
        }
        text(c, String(di + 1), midCol.x + (w < 540 ? 15 : 20), dry, docF - 0.5, MUTED, "right");
        text(c, fitTxt(DOC_LINES[di], midCol.w - (w < 540 ? 24 : 32), docF), midCol.x + (w < 540 ? 20 : 27), dry, docF, (isAnsLine && hasHighlight) ? GOLD : TEXT, "left", (isAnsLine && hasHighlight) ? "700" : "400");
      }

      // Right: Answer Card
      c.fillStyle = CARD; roundRect(c, rightCol.x, rightCol.y, rightCol.w, rightCol.h, 5); c.fill();
      c.strokeStyle = hasAnswer ? GOLD : LINE; c.lineWidth = hasAnswer ? 1.4 : 1; c.stroke();
      text(c, "03 ANSWER", rightCol.x + 8, rightCol.y + 12, hdrF, hasAnswer ? GOLD : DIM, "left", "700");

      var ansMidY = rightCol.y + rightCol.h * 0.42;
      if (hasAnswer) {
        text(c, "Answer:", rightCol.x + 8, ansMidY - (w < 540 ? 12 : 16), bodyF, DIM, "left", "600");
        text(c, fitTxt("night of 4 Nov", rightCol.w - 14, w < 540 ? 9 : 11.5), rightCol.x + 8, ansMidY + 2, w < 540 ? 9 : 11.5, GOLD, "left", "700");
        drawPill(c, "GROUNDED", rightCol.x + 8, ansMidY + (w < 540 ? 18 : 24), Math.min(rightCol.w - 16, 68), 14, GREEN, w < 540 ? 6.5 : 7.5);
        text(c, fitTxt("L7 · conf 0.99", rightCol.w - 14, bodyF - 1), rightCol.x + 8, rightCol.y + rightCol.h - 14, bodyF - 1, GREEN, "left", "600");
      } else {
        text(c, hasHighlight ? "extracting..." : "waiting...", rightCol.x + 8, ansMidY, bodyF, hasHighlight ? GOLD : MUTED, "left", "600");
        text(c, fitTxt("pointer idle", rightCol.w - 14, bodyF - 1), rightCol.x + 8, rightCol.y + rightCol.h - 14, bodyF - 1, MUTED, "left");
      }

      // Polyline leader from Answer Card to Highlight Box (t >= 0.55)
      if (hasAnswer && hlAnchor) {
        var lineProg = clamp((u - 0.55) / 0.14, 0, 1);
        var sx = rightCol.x;
        var sy = ansMidY + 2;
        var midX = rightCol.x - gap * 0.5;
        var ex = hlAnchor.x;
        var ey = hlAnchor.y;

        // Compute 3-segment polyline progress
        var seg1 = Math.abs(sx - midX);
        var seg2 = Math.abs(ey - sy);
        var seg3 = Math.abs(midX - ex);
        var totalLen = Math.max(1, seg1 + seg2 + seg3);
        var drawLen = totalLen * lineProg;

        c.strokeStyle = GOLD;
        c.lineWidth = 1.5;
        c.beginPath();
        c.moveTo(sx, sy);
        if (drawLen <= seg1) {
          c.lineTo(lerp(sx, midX, drawLen / Math.max(1, seg1)), sy);
        } else if (drawLen <= seg1 + seg2) {
          c.lineTo(midX, sy);
          c.lineTo(midX, lerp(sy, ey, (drawLen - seg1) / Math.max(1, seg2)));
        } else {
          c.lineTo(midX, sy);
          c.lineTo(midX, ey);
          c.lineTo(lerp(midX, ex, (drawLen - seg1 - seg2) / Math.max(1, seg3)), ey);
        }
        c.stroke();

        c.fillStyle = GOLD;
        c.beginPath(); c.arc(sx, sy, 3, 0, Math.PI * 2); c.fill();
        if (lineProg > 0.92) {
          c.beginPath(); c.arc(ex, ey, 3, 0, Math.PI * 2); c.fill();
        }
      }

      // Bottom: SPAN CHECK (4 rows)
      c.fillStyle = CARD; roundRect(c, botBox.x, botBox.y, botBox.w, botBox.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "05 SPAN CHECK", botBox.x + 10, botBox.y + 10, hdrF, PURPLE, "left", "700");
      var passCnt = 0;
      for (var ci = 0; ci < CHECKS.length; ci++) if (u >= CHECKS[ci].thr) passCnt++;
      text(c, passCnt + "/4 VERIFIED", botBox.x + botBox.w - 10, botBox.y + 10, hdrF - 1, passCnt === 4 ? GREEN : DIM, "right", "700");

      var chkTop = botBox.y + 18;
      var chkRowH = (botBox.h - 22) / CHECKS.length;
      var chkF = w < 540 ? 7.2 : 8.8;
      for (var k = 0; k < CHECKS.length; k++) {
        var ch = CHECKS[k];
        var cy = chkTop + (k + 0.5) * chkRowH;
        var ok = u >= ch.thr;
        text(c, ok ? "[✓]" : "[·]", botBox.x + 10, cy, chkF, ok ? GREEN : MUTED, "left", "700");
        text(c, ch.key, botBox.x + 34, cy, chkF, ok ? FG : MUTED, "left", ok ? "700" : "400");
        text(c, ok ? ch.detail : "pending", botBox.x + botBox.w - 10, cy, chkF - 0.5, ok ? GREEN : MUTED, "right", ok ? "600" : "400");
      }

      return qStatus + " · " + passCnt + "/4 checks";
    }, o);
  }

  /* #58 orbitRace — 軌道競速 (driver n=60) */
  function orbitRace(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 60;
    var N_RAYS = 360;

    var MODELS = [
      { name: "Reader",  latency: 80,  col: GOLD,   rScale: 0.64, trail: 0.45 },
      { name: "Model-H", latency: 210, col: CYAN,   rScale: 0.80, trail: 0.34 },
      { name: "Model-O", latency: 300, col: PURPLE, rScale: 0.96, trail: 0.26 }
    ];
    // Speed inversely proportional to latency; Reader completes 1 lap at u = 0.24
    var BASE_SPEED = (1 / 0.24) * MODELS[0].latency;
    var TILT = -0.32;
    var RY_SCALE = 0.38;
    var TARGET_ANG = 0.22;

    function orbitPos(cx, cy, rx, ang) {
      var ry = rx * RY_SCALE;
      var lx = Math.cos(ang) * rx;
      var ly = Math.sin(ang) * ry;
      var ct = Math.cos(TILT), st = Math.sin(TILT);
      return {
        x: cx + lx * ct - ly * st,
        y: cy + lx * st + ly * ct
      };
    }

    function drawSatIcon(c, x, y, sz, col) {
      c.save();
      c.translate(x, y);
      c.strokeStyle = col;
      c.fillStyle = col;
      c.lineWidth = 1.2;
      c.fillRect(-sz * 0.35, -sz * 0.35, sz * 0.7, sz * 0.7);
      c.strokeRect(-sz * 1.15, -sz * 0.25, sz * 0.65, sz * 0.5);
      c.strokeRect(sz * 0.50, -sz * 0.25, sz * 0.65, sz * 0.5);
      c.restore();
    }

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 12;
      var topH = compact ? 22 : 26;

      var statusText = u < 0.24 ? "loading claim_email.md"
        : (u < 0.63 ? "Reader first token ~80ms"
        : (u < 0.90 ? "Model-H arrived · ~210ms"
        : "all 3 models complete"));
      var statusCol = u < 0.24 ? CYAN : (u < 0.90 ? GOLD : GREEN);

      // Top-left & Top-right headers
      text(c, "POINTER CORE", pad, topH * 0.5, compact ? 9.5 : 11, GOLD, "left", "700");
      text(c, statusText, w - pad, topH * 0.5, compact ? 7.5 : 9, statusCol, "right", "700");

      var cx = w * 0.5;
      var cy = topH + (h - topH) * 0.52;
      var diskR = Math.min(w * (compact ? 0.38 : 0.35), (h - topH) * 0.44);

      // [v2] star-field cross markers (deterministic)
      for (var si = 0; si < (compact ? 22 : 42); si++) {
        var sx = pad + hashLcg(si, 811) * (w - pad * 2);
        var sy = topH + 6 + hashLcg(si, 823) * (h - topH - 12);
        var sl = 2 + hashLcg(si, 829) * (compact ? 2.5 : 4);
        var sa = 0.10 + 0.30 * hashLcg(si, 839) * (0.7 + 0.3 * Math.sin(u * 6.28 * 2 + si));
        c.strokeStyle = "rgba(148, 163, 184, " + sa.toFixed(3) + ")";
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(sx - sl, sy); c.lineTo(sx + sl, sy);
        c.moveTo(sx, sy - sl); c.lineTo(sx, sy + sl);
        c.stroke();
      }

      // [v2] perspective floor disk (tilted solid plate + rim + radial grid)
      var floorRx = Math.min(w * 0.44 - pad, diskR * 1.75);
      var floorRy = floorRx * RY_SCALE;
      var rimH = compact ? 3 : 5;
      c.save();
      c.translate(cx, cy);
      c.rotate(TILT);
      c.fillStyle = "rgba(20, 24, 32, 0.95)";
      c.beginPath(); c.ellipse(0, rimH, floorRx, floorRy, 0, 0, Math.PI * 2); c.fill();
      var fg = c.createRadialGradient(0, 0, floorRx * 0.05, 0, 0, floorRx);
      fg.addColorStop(0, "rgba(245, 179, 1, 0.16)");
      fg.addColorStop(0.5, "rgba(30, 36, 48, 0.85)");
      fg.addColorStop(1, "rgba(14, 17, 23, 0.95)");
      c.save(); c.scale(1, RY_SCALE);
      c.fillStyle = fg;
      c.beginPath(); c.arc(0, 0, floorRx, 0, Math.PI * 2); c.fill();
      c.strokeStyle = "rgba(148, 163, 184, 0.10)";
      c.lineWidth = 0.8 / RY_SCALE * 0.5;
      for (var gi = 0; gi < 36; gi++) {
        var ga = gi / 36 * Math.PI * 2;
        c.beginPath();
        c.moveTo(Math.cos(ga) * floorRx * 0.22, Math.sin(ga) * floorRx * 0.22);
        c.lineTo(Math.cos(ga) * floorRx * 0.99, Math.sin(ga) * floorRx * 0.99);
        c.stroke();
      }
      [0.40, 0.62, 0.84].forEach(function (rr) {
        c.beginPath(); c.arc(0, 0, floorRx * rr, 0, Math.PI * 2); c.stroke();
      });
      c.restore();
      c.strokeStyle = "rgba(148, 163, 184, 0.35)";
      c.lineWidth = 1;
      c.beginPath(); c.ellipse(0, 0, floorRx, floorRy, 0, 0, Math.PI * 2); c.stroke();
      c.restore();

      // [v2] landmark satellites on floor ends: left = skyline (Model-H), right = ringed planet (Model-O)
      var lmL = orbitPos(cx, cy, floorRx * 0.86, Math.PI);
      var lmR = orbitPos(cx, cy, floorRx * 0.86, 0);
      var bw = Math.max(3, diskR * (compact ? 0.05 : 0.045));
      for (var bi = 0; bi < 9; bi++) {
        var bh = diskR * (0.10 + 0.30 * hashLcg(bi, 857)) * (1 - Math.abs(bi - 4) * 0.08);
        var bx = lmL.x + (bi - 4.5) * bw * 1.15;
        c.fillStyle = "#0b1220";
        c.fillRect(bx, lmL.y - bh, bw, bh);
        c.strokeStyle = CYAN + "aa";
        c.lineWidth = 0.8;
        c.strokeRect(bx, lmL.y - bh, bw, bh);
        for (var wy = lmL.y - bh + 3; wy < lmL.y - 2; wy += 4) {
          if (hashLcg(bi * 31 + Math.round(wy), 863) > 0.55) {
            c.fillStyle = CYAN + (hashLcg(bi + Math.round(wy), 877) > 0.5 ? "cc" : "55");
            c.fillRect(bx + bw * 0.3, wy, Math.max(1, bw * 0.4), 1.2);
          }
        }
      }
      var plR = Math.max(7, diskR * 0.13);
      var plY = lmR.y - plR * 1.1;
      c.save(); c.translate(lmR.x, plY); c.rotate(-0.35);
      c.strokeStyle = PURPLE + "bb"; c.lineWidth = compact ? 1.2 : 1.8;
      c.beginPath(); c.ellipse(0, 0, plR * 1.9, plR * 0.45, 0, Math.PI, Math.PI * 2); c.stroke();
      c.restore();
      var pg = c.createRadialGradient(lmR.x - plR * 0.35, plY - plR * 0.35, plR * 0.1, lmR.x, plY, plR);
      pg.addColorStop(0, "#e9d5ff"); pg.addColorStop(0.45, PURPLE); pg.addColorStop(1, "#2e1065");
      c.fillStyle = pg;
      c.beginPath(); c.arc(lmR.x, plY, plR, 0, Math.PI * 2); c.fill();
      c.save(); c.translate(lmR.x, plY); c.rotate(-0.35);
      c.strokeStyle = PURPLE + "dd"; c.lineWidth = compact ? 1.2 : 1.8;
      c.beginPath(); c.ellipse(0, 0, plR * 1.9, plR * 0.45, 0, 0, Math.PI); c.stroke();
      c.restore();

      // 360 radial rays (length = noise * pulse)
      var rayInner = diskR * 0.22;
      var rayMaxLen = diskR * 0.62;
      c.lineWidth = compact ? 0.8 : 1.05;
      for (var ri = 0; ri < N_RAYS; ri++) {
        var rAng = (ri / N_RAYS) * Math.PI * 2;
        var noise = 0.28 + 0.72 * hashLcg(ri, 701);
        var pulse = 0.68 + 0.32 * Math.sin(u * Math.PI * 6 + ri * 0.23 + hashLcg(ri, 709) * 6.28);
        var rLen = rayMaxLen * noise * pulse;
        var alpha = clamp(0.14 + 0.48 * noise * pulse, 0.08, 0.68);
        c.strokeStyle = "rgba(245, 179, 1, " + alpha.toFixed(3) + ")";
        c.beginPath();
        c.moveTo(cx + Math.cos(rAng) * rayInner, cy + Math.sin(rAng) * rayInner);
        c.lineTo(cx + Math.cos(rAng) * (rayInner + rLen), cy + Math.sin(rAng) * (rayInner + rLen));
        c.stroke();
      }

      // Tilted elliptical orbit rings (draw back half, core, front half)
      for (var oi = 0; oi < MODELS.length; oi++) {
        var mod = MODELS[oi];
        var rx = diskR * mod.rScale;
        c.save();
        c.translate(cx, cy);
        c.rotate(TILT);
        c.strokeStyle = mod.col + "55";
        c.lineWidth = 1.05;
        c.beginPath();
        c.ellipse(0, 0, rx, rx * RY_SCALE, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();

        // Finish marker tick
        var fp = orbitPos(cx, cy, rx, TARGET_ANG);
        c.fillStyle = FG;
        c.beginPath(); c.arc(fp.x, fp.y, 2.2, 0, Math.PI * 2); c.fill();
      }

      // Central glowing core (black hole + golden halo)
      var coreR = Math.max(11, diskR * 0.20);
      var halo = c.createRadialGradient(cx, cy, coreR * 0.6, cx, cy, coreR * 2.5);
      halo.addColorStop(0, "rgba(245, 179, 1, 0.65)");
      halo.addColorStop(0.45, "rgba(245, 179, 1, 0.20)");
      halo.addColorStop(1, "rgba(245, 179, 1, 0)");
      c.fillStyle = halo;
      c.beginPath(); c.arc(cx, cy, coreR * 2.5, 0, Math.PI * 2); c.fill();

      c.fillStyle = "#030406";
      c.beginPath(); c.arc(cx, cy, coreR, 0, Math.PI * 2); c.fill();
      c.strokeStyle = GOLD;
      c.lineWidth = 1.8;
      c.stroke();

      // [v2] white-hot sparkle inside the black core
      var hot = c.createRadialGradient(cx, cy, 0, cx, cy, coreR * 0.55);
      hot.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      hot.addColorStop(0.35, "rgba(255, 244, 214, 0.55)");
      hot.addColorStop(1, "rgba(255, 244, 214, 0)");
      c.fillStyle = hot;
      c.beginPath(); c.arc(cx, cy, coreR * 0.55, 0, Math.PI * 2); c.fill();
      var fl = coreR * (0.62 + 0.12 * Math.sin(u * Math.PI * 8));
      c.strokeStyle = "rgba(255, 255, 255, 0.75)";
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(cx - fl, cy); c.lineTo(cx + fl, cy);
      c.moveTo(cx, cy - fl * 0.8); c.lineTo(cx, cy + fl * 0.8);
      c.stroke();

      // Model satellites racing along tilted orbits (angular speed proportional to 1/latency)
      var START_ANG = TARGET_ANG - Math.PI * 2;
      for (var mi = 0; mi < MODELS.length; mi++) {
        var m = MODELS[mi];
        var laps = (BASE_SPEED / m.latency) * u;
        var curAng = START_ANG + laps * Math.PI * 2;
        var rxm = diskR * m.rScale;

        // Orbital trail
        var TRAIL_STEPS = 12;
        for (var ts = TRAIL_STEPS; ts >= 1; ts--) {
          var tAng = curAng - (ts / TRAIL_STEPS) * m.trail;
          var tp = orbitPos(cx, cy, rxm, tAng);
          c.fillStyle = m.col;
          c.globalAlpha = (1 - ts / TRAIL_STEPS) * 0.45;
          c.beginPath();
          c.arc(tp.x, tp.y, compact ? 1.8 : 2.3, 0, Math.PI * 2);
          c.fill();
        }
        c.globalAlpha = 1;

        var pos = orbitPos(cx, cy, rxm, curAng);
        // Satellite glow + dot
        c.fillStyle = m.col + "44";
        c.beginPath(); c.arc(pos.x, pos.y, compact ? 6.5 : 8.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = m.col;
        c.beginPath(); c.arc(pos.x, pos.y, compact ? 3.5 : 4.5, 0, Math.PI * 2); c.fill();

        // When satellite reaches finish marker (laps >= 1), show "first token ~Xms" tag in fixed non-overlapping callout slots
        if (laps >= 1.0) {
          var tagStr = m.name + " · first token ~" + m.latency + "ms";
          var tagW = compact ? 124 : 148;
          var slotX, slotY;
          if (mi === 0) {
            slotX = compact ? pad : clamp(cx - diskR * 0.98, pad, w - pad - tagW);
            slotY = clamp(cy - diskR * 0.80, topH + 8, h - 56);
          } else if (mi === 1) {
            slotX = clamp(cx - diskR * 0.98, pad, w - pad - tagW);
            slotY = clamp(cy + diskR * 0.62, topH + 28, h - 56);
          } else {
            slotX = compact ? w - pad - tagW : clamp(cx + diskR * 0.22, pad, w - pad - tagW);
            slotY = clamp(cy - diskR * 0.80, topH + 8, h - 56);
          }
          var anchorX = pos.x < slotX + tagW * 0.5 ? slotX + tagW * 0.25 : slotX + tagW * 0.75;
          var anchorY = pos.y < slotY + 7 ? slotY : slotY + 15;
          c.strokeStyle = m.col + "99";
          c.lineWidth = 0.9;
          c.beginPath();
          c.moveTo(pos.x, pos.y);
          c.lineTo(anchorX, anchorY);
          c.stroke();

          c.fillStyle = "rgba(7, 9, 12, 0.92)";
          roundRect(c, slotX, slotY, tagW, 15, 3);
          c.fill();
          c.strokeStyle = m.col;
          c.lineWidth = 1;
          c.stroke();
          text(c, tagStr, slotX + tagW * 0.5, slotY + 7.5, compact ? 6.8 : 7.8, m.col, "center", "700");
        }
      }

      // Fixed left & right satellite icons + name labels (Left: Model-H, Right: Model-O)
      var sideY = h - (compact ? 24 : 30);
      var leftX = pad + (compact ? 14 : 20);
      var rightX = w - pad - (compact ? 14 : 20);

      // [v2] corner labels (reference style: big model name + first-token state)
      var lapsH = (BASE_SPEED / MODELS[1].latency) * u, lapsO = (BASE_SPEED / MODELS[2].latency) * u;
      var cTop = topH + (compact ? 10 : 14);
      var stH = lapsH >= 1 ? "first token ~210ms" : "racing…";
      var stO = lapsO >= 1 ? "first token ~300ms" : "racing…";
      if (compact) {
        text(c, "Model-H " + (lapsH >= 1 ? "~210ms" : "…"), pad, cTop, 8, CYAN, "left", "700");
        text(c, (lapsO >= 1 ? "~300ms" : "…") + " Model-O", w - pad, cTop, 8, PURPLE, "right", "700");
      } else {
        text(c, "Model-H", pad, cTop, 13, CYAN, "left", "700");
        text(c, stH, pad, cTop + 15, 8.5, lapsH >= 1 ? GREEN : DIM, "left", "700");
        text(c, "Model-O", w - pad, cTop, 13, PURPLE, "right", "700");
        text(c, stO, w - pad, cTop + 15, 8.5, lapsO >= 1 ? GREEN : DIM, "right", "700");
      }

      // Bottom-center Reader pill
      var rPillW = compact ? 92 : 114;
      drawPill(c, "Reader · 80ms", cx - rPillW * 0.5, sideY - 8, rPillW, 16, GOLD, compact ? 7 : 8);

      return statusText;
    }, o);
  }

  /* #59 modelCostBoard — 模型成本板 (driver n=48) */
  function modelCostBoard(cv, _data, opt) {
    var TX = g.A23Tex;
    if (!TX) return modelCostBoardLegacy(cv, _data, opt);
    var K = TX.kit(TX.theme(GOLD)), V = K.V, tx = K.tx;
    var o = opt || {}, nFrames = 48, TARGET = 136250;
    if (_data && Array.isArray(_data.roles) && _data.roles.length) {
      var sorted = _data.roles.slice().sort(function (a, b) { return (b.tokens || 0) - (a.tokens || 0); });
      var totalTok = sorted.reduce(function (s, r) { return s + (r.tokens || 0); }, 0);
      var totalCalls = sorted.reduce(function (s, r) { return s + (r.calls || 0); }, 0);
      var maxTok = Math.max(1, sorted[0].tokens || 0);
      var estCnt = sorted.filter(function (r) { return r.estimated; }).length;
      return driver(nFrames, function (t) {
        var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
        var u = clamp(t / (nFrames - 1), 0, 1), f = K.infoFont(w), pad = compact ? 6 : 10, gap = compact ? 5 : 8, i;
        var anim = 0.25 + 0.75 * clamp(u * 1.35, 0, 1), rowKV = f + Math.max(5, Math.round(f * 0.8));
        c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
        K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
        tx(c, K.fitM(c, compact ? "ROLE TOKENS" : (_data.title || "RDR 03 · TRI-ROLE TOKENS BOARD"), w * 0.65, f + 1, "700"), pad, 11, f + 1, V.ink, "left", "700");
        tx(c, fmtComma(totalTok) + " TOK", w - pad, 11, f - 1, V.acc2, "right", "700");
        var top3 = sorted.slice(0, 3);
        var y = 20, nR = compact ? 2 : 3, cH = 6 + (f + 6) + rowKV * nR, cW = (w - pad * 2 - gap * Math.max(0, top3.length - 1)) / Math.max(1, top3.length);
        for (i = 0; i < top3.length; i++) {
          var m = top3[i], b = { x: pad + i * (cW + gap), y: y, w: cW, h: cH };
          if (i === 0) K.activeHalo(c, b.x, b.y, b.w, b.h, compact ? 6 : 12);
          K.pane(c, b); K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
          var lbl = m.role + (m.estimated ? " 估算" : "");
          tx(c, K.fitM(c, lbl, b.w * 0.66, f + 1, "700"), b.x + 6, b.y + 4 + (f + 6) / 2, f + 1, i === 0 ? V.acc3 : V.ink, "left", "700");
          tx(c, m.estimated ? "估算" : "實測", b.x + b.w - 6, b.y + 4 + (f + 6) / 2, f - 1, m.estimated ? "#f59e0b" : GREEN, "right", "700");
          var pct = totalTok > 0 ? Math.round((m.tokens || 0) * 100 / totalTok) : 0;
          var rows = [["tokens", fmtComma(m.tokens || 0), i === 0], ["calls", String(m.calls || 0), false]];
          if (!compact) rows.splice(1, 0, ["share", pct + "%", false]);
          K.kvBlock(c, { x: b.x + 1, y: b.y + 4 + f + 6, w: b.w - 2, h: rowKV * nR + 2 }, rows, f, null);
        }
        y += cH + gap;
        var bH = h - y - pad, pW = Math.round((w - pad * 2 - gap) * 0.62);
        var P = { x: pad, y: y, w: pW, h: bH }, Q = { x: pad + pW + gap, y: y, w: w - pad * 2 - pW - gap, h: bH };
        var ip = K.pane(c, P, "04 TOKENS RANK", "LOG/REL");
        var pRH = (ip.h - 4) / Math.max(1, sorted.length);
        c.font = "600 " + f + "px " + K.MONO;
        var pLbl = Math.min(ip.w * 0.42, c.measureText("REVIEWER 估算").width + 8), pVal = c.measureText(fmtComma(maxTok)).width + 8;
        var px0 = ip.x + 4 + pLbl, pMax = Math.max(16, ip.x + ip.w - 4 - pVal - px0);
        var ill = { x: px0, y: ip.y + 2, w: pMax, h: ip.h - 4 };
        K.develop(c, ill, anim, function (cc, cl) {
          for (var j = 0; j < sorted.length; j++) {
            var rj = sorted[j], tok = rj.tokens || 0;
            var fr = tok > 0 ? clamp(Math.log10(tok + 1) / Math.log10(maxTok + 1), 0.08, 1) : 0.02;
            var yy = ill.y + pRH * (j + 0.5), bh = Math.max(3, Math.min(9, pRH * 0.5));
            cc.fillStyle = j === 0 ? V.acc : (rj.estimated ? "#f59e0b" : cl);
            cc.fillRect(px0, yy - bh / 2, pMax * fr, bh);
          }
        });
        for (i = 0; i < sorted.length; i++) {
          var ri = sorted[i], yy2 = ip.y + 2 + pRH * (i + 0.5), top1 = i === 0;
          if (top1) K.activeHalo(c, ip.x + 3, yy2 - pRH * 0.38, ip.w - 6, pRH * 0.76, compact ? 4 : 8);
          var rName = ri.role + (ri.estimated ? " (估算)" : "");
          tx(c, K.fitM(c, rName, pLbl - 4, f, "600"), ip.x + 4, yy2, f, top1 ? V.acc3 : (ri.estimated ? "#fbbf24" : V.txt), "left", top1 ? "700" : "600");
          tx(c, fmtComma(ri.tokens || 0), ip.x + ip.w - 4, yy2, f, top1 ? V.ink : V.dim, "right", top1 ? "700" : "600");
        }
        var iq = K.pane(c, Q, "05 TOTALS", estCnt + " 估算");
        var cy = iq.y + (f + 8) / 2 + 1;
        tx(c, "calls", iq.x + 4, cy, f, V.dim, "left", "600");
        tx(c, fmtComma(totalCalls), iq.x + iq.w - 4, cy, f + (compact ? 2 : 5), V.ink, "right", "700");
        var kvH = rowKV * 2 + 2;
        K.kvBlock(c, { x: iq.x, y: iq.y + iq.h - kvH, w: iq.w, h: kvH }, [
          ["top1", sorted[0].role, 1],
          ["est", estCnt + "/" + sorted.length, estCnt > 0]
        ], f, Q.x + Q.w);
        return fmtComma(totalTok) + " tok · " + totalCalls + " calls";
      }, o);
    }
    var TOP = [["Reader", 0.0004, 0.01, 10, 80, 0.28], ["Model-H", 0.0384, 0.96, 960, 420, 0.64], ["Model-O", 1.166, 29.15, 29150, 960, 0.92]];
    var PM = [["Model-O", 29150], ["Model-X", 14800], ["Model-P", 7200], ["Model-L", 3100], ["Model-H", 960], ["Model-M", 420], ["Model-S", 140], ["Model-Lite", 48], ["Reader", 10]];
    var mult = Math.round(PM[0][1] / PM[PM.length - 1][1]), savedPct = ((1 - PM[PM.length - 1][1] / PM[0][1]) * 100).toFixed(2);
    var lgMin = Math.log(4) / Math.LN10, lgMax = Math.log(PM[0][1] * 1.25) / Math.LN10;
    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420;
      var u = clamp(t / (nFrames - 1), 0, 1), f = K.infoFont(w), pad = compact ? 6 : 10, gap = compact ? 5 : 8, i;
      var anim = 0.25 + 0.75 * clamp(u * 1.35, 0, 1), rowKV = f + Math.max(5, Math.round(f * 0.8));
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, compact ? "MODEL COST BOARD" : "RDR 03 · MODEL COST BOARD · 1M QUESTIONS", w * 0.62, f + 1, "700"), pad, 11, f + 1, V.ink, "left", "700");
      tx(c, fmtComma(mult) + "× CHEAPER", w - pad, 11, f - 1, V.acc2, "right", "700");
      /* 01–03 模型卡：子窗＋鍵值列；Reader＝唯一作用卡（光暈） */
      var y = 20, nR = compact ? 2 : 3, cH = 6 + (f + 6) + rowKV * nR, cW = (w - pad * 2 - gap * 2) / 3;
      for (i = 0; i < 3; i++) {
        var m = TOP[i], pr = clamp(u / m[5], 0, 1), b = { x: pad + i * (cW + gap), y: y, w: cW, h: cH };
        if (i === 0) K.activeHalo(c, b.x, b.y, b.w, b.h, compact ? 6 : 12);
        K.pane(c, b); K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
        tx(c, K.fitM(c, m[0], b.w * 0.6, f + 1, "700"), b.x + 6, b.y + 4 + (f + 6) / 2, f + 1, i === 0 ? V.acc3 : V.ink, "left", "700");
        tx(c, pr >= 1 ? "DONE" : "RUN", b.x + b.w - 6, b.y + 4 + (f + 6) / 2, f - 1, pr >= 1 ? GREEN : V.dim, "right", "700");
        var rows = [["run", "$" + (m[1] * pr).toFixed(4)], ["per 1M", "$" + fmtComma(m[3]), i === 0]];
        if (!compact) rows.splice(1, 0, ["per 1k", "$" + m[2].toFixed(2)]);
        K.kvBlock(c, { x: b.x + 1, y: b.y + 4 + f + 6, w: b.w - 2, h: rowKV * nR + 2 }, rows, f, null);
      }
      y += cH + gap;
      /* 04 LANES：直線軌道＋熱封包 */
      var lRH = f + (compact ? 4 : 8), L = { x: pad, y: y, w: w - pad * 2, h: 13 + lRH * 3 + 2 };
      var il = K.pane(c, L, "04 LANES · RUNS", "LIVE RACE");
      c.font = "700 " + f + "px " + K.MONO;
      var lLbl = c.measureText("Model-H").width + 10, lSt = c.measureText("100% · 960ms").width + 10;
      var lx0 = il.x + lLbl, lx1 = il.x + il.w - lSt;
      for (i = 0; i < 3; i++) {
        var lm = TOP[i], lp = clamp(u / lm[5], 0, 1), ly = il.y + lRH * (i + 0.5), col = i === 0 ? V.acc : K.mix(V.deep, V.acc2, 0.55 - i * 0.15);
        tx(c, lm[0], il.x + 4, ly, f, i === 0 ? V.acc3 : V.txt, "left", "700");
        c.fillStyle = V.track; c.fillRect(lx0, ly - 1.5, lx1 - lx0, 3);
        c.fillStyle = col; c.fillRect(lx0, ly - 1.5, (lx1 - lx0) * lp, 3);
        if (lp < 1) K.hotPacket(c, [[lx0, ly], [lx1, ly]], lp, col, compact ? 2 : 2.6); else K.kvPort(c, lx1, ly, i === 0);
        tx(c, Math.round(lp * 100) + "% · " + lm[4] + "ms", il.x + il.w - 4, ly, f, lp >= 1 ? V.txt : V.dim, "right", "600");
      }
      y += L.h + gap;
      /* 08 PRICE：log 長條在插畫預覽窗內顯影；列高不足 f+4 時抽稀（首尾必留） */
      var bH = h - y - pad, pW = Math.round((w - pad * 2 - gap) * 0.58);
      var P = { x: pad, y: y, w: pW, h: bH }, Q = { x: pad + pW + gap, y: y, w: w - pad * 2 - pW - gap, h: bH };
      var ip = K.pane(c, P, "08 PRICE · 1M Q", "LOG");
      var nFit = Math.max(2, Math.min(PM.length, Math.floor((ip.h - 4) / (f + 4)))), idx = [];
      for (i = 0; i < nFit; i++) idx.push(Math.round(i * (PM.length - 1) / (nFit - 1)));
      var pRH = (ip.h - 4) / nFit;
      c.font = "600 " + f + "px " + K.MONO;
      var pLbl = Math.min(ip.w * 0.36, c.measureText("Model-Lite").width + 8), pVal = c.measureText("$29,150").width + 8;
      var px0 = ip.x + 4 + pLbl, pMax = Math.max(16, ip.x + ip.w - 4 - pVal - px0);
      var ill = { x: px0, y: ip.y + 2, w: pMax, h: ip.h - 4 };
      K.develop(c, ill, anim, function (cc, cl) {
        for (var j = 0; j < idx.length; j++) {
          var pm = PM[idx[j]], fr = clamp((Math.log(pm[1]) / Math.LN10 - lgMin) / (lgMax - lgMin), 0.06, 1), yy = ill.y + pRH * (j + 0.5), bh = Math.max(3, Math.min(9, pRH * 0.5));
          cc.fillStyle = pm[0] === "Reader" ? V.acc : cl; cc.fillRect(px0, yy - bh / 2, pMax * fr, bh);
        }
      });
      for (i = 0; i < idx.length; i++) {
        var pm2 = PM[idx[i]], yy2 = ip.y + 2 + pRH * (i + 0.5), rd = pm2[0] === "Reader";
        if (rd) K.activeHalo(c, ip.x + 3, yy2 - pRH * 0.38, ip.w - 6, pRH * 0.76, compact ? 4 : 8);
        tx(c, K.fitM(c, pm2[0], pLbl - 4, f, "600"), ip.x + 4, yy2, f, rd ? V.acc3 : V.txt, "left", rd ? "700" : "600");
        tx(c, "$" + fmtComma(pm2[1]), ip.x + ip.w - 4, yy2, f, rd ? V.ink : V.dim, "right", rd ? "700" : "600");
      }
      /* 10 LATENCY：題數計數＋延遲條＋鍵值區（倍率／省下） */
      var iq = K.pane(c, Q, "10 LATENCY", nFit < PM.length ? nFit + "/" + PM.length + " ROWS" : "");
      var cur = Math.round(TARGET * clamp(u * 1.12, 0, 1)), cy = iq.y + (f + 8) / 2 + 1;
      tx(c, "questions", iq.x + 4, cy, f, V.dim, "left", "600");
      tx(c, fmtComma(cur), iq.x + iq.w - 4, cy, f + (compact ? 2 : 6), V.ink, "right", "700");
      var kvH = rowKV * 2 + 2, lt = iq.y + f + 12, lh = Math.max(f * 3, iq.y + iq.h - kvH - 6 - lt), lr = lh / 3;
      c.font = "600 " + f + "px " + K.MONO;
      var qn = c.measureText("Model-H").width + 8, qm = c.measureText("960ms").width + 8, qx0 = iq.x + 4 + qn, qMax = Math.max(12, iq.x + iq.w - 4 - qm - qx0);
      for (i = 0; i < 3; i++) {
        var by = lt + lr * (i + 0.5), bmh = Math.max(3, Math.min(7, lr * 0.4));
        tx(c, TOP[i][0], iq.x + 4, by, f, i === 0 ? V.acc3 : V.txt, "left", "600");
        c.fillStyle = V.track; c.fillRect(qx0, by - bmh / 2, qMax, bmh);
        c.fillStyle = i === 0 ? V.acc : V.line2; c.fillRect(qx0, by - bmh / 2, qMax * TOP[i][4] / 960 * anim, bmh);
        tx(c, TOP[i][4] + "ms", iq.x + iq.w - 4, by, f, i === 0 ? V.ink : V.dim, "right", "600");
      }
      c.strokeStyle = V.line; c.lineWidth = 1; K.ln(c, iq.x + 4, iq.y + iq.h - kvH - 2.5, iq.x + iq.w - 4, iq.y + iq.h - kvH - 2.5);
      K.kvBlock(c, { x: iq.x, y: iq.y + iq.h - kvH, w: iq.w, h: kvH }, [["saved", savedPct + "%", 1], ["vs Model-O", fmtComma(mult) + "×"]], f, Q.x + Q.w);
      return fmtComma(cur) + " q · " + fmtComma(mult) + "× cheaper";
    }, o);
  }

  function modelCostBoardLegacy(cv, _data, opt) {
    var o = opt || {};
    var nFrames = 48;

    var TOP_CARDS = [
      { name: "Reader",  runCost: 0.0004, per1k: 0.01, per1M: 10,    ms: 80,  col: GOLD,   gold: true,  doneAt: 0.28 },
      { name: "Model-H", runCost: 0.0384, per1k: 0.96, per1M: 960,   ms: 420, col: CYAN,   gold: false, doneAt: 0.64 },
      { name: "Model-O", runCost: 1.1660, per1k: 29.15, per1M: 29150, ms: 960, col: PURPLE, gold: false, doneAt: 0.92 }
    ];

    // 9 fictional models sorted most expensive -> cheapest (log scale)
    var PRICE_MODELS = [
      { name: "Model-O",    cost1M: 29150, col: RED },
      { name: "Model-X",    cost1M: 14800, col: PURPLE },
      { name: "Model-P",    cost1M: 7200,  col: PURPLE },
      { name: "Model-L",    cost1M: 3100,  col: CYAN },
      { name: "Model-H",    cost1M: 960,   col: CYAN },
      { name: "Model-M",    cost1M: 420,   col: DIM },
      { name: "Model-S",    cost1M: 140,   col: DIM },
      { name: "Model-Lite", cost1M: 48,    col: DIM },
      { name: "Reader",     cost1M: 10,    col: GOLD }
    ];

    var TARGET_QUESTIONS = 136250;

    return driver(nFrames, function (t) {
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 380;
      var u = clamp(t / (nFrames - 1), 0, 1);
      var pad = compact ? 8 : 12;
      var topH = compact ? 20 : 24;
      var gap = compact ? 5 : 8;

      // Dynamic cheaper multiplier from data
      var maxCost1M = PRICE_MODELS[0].cost1M;
      var minCost1M = PRICE_MODELS[PRICE_MODELS.length - 1].cost1M;
      var cheaperMult = Math.round(maxCost1M / minCost1M);
      var savedPct = ((1 - minCost1M / maxCost1M) * 100).toFixed(2);
      var savedDollar = maxCost1M - minCost1M;

      text(c, compact ? "MODEL COST BOARD" : "RDR 03 · MODEL COST BOARD · 1M QUESTIONS", pad, topH * 0.5, compact ? 8.5 : 9.5, DIM, "left", "700");
      text(c, fmtComma(cheaperMult) + "× CHEAPER", w - pad, topH * 0.5, compact ? 8 : 9, GOLD, "right", "700");

      var curY = topH + 3;

      // Top section: 3 model cards (1 col if compact, 3 cols otherwise)
      if (compact) {
        var cH1 = 26;
        for (var ci = 0; ci < TOP_CARDS.length; ci++) {
          var cd = TOP_CARDS[ci];
          var cy = curY + ci * (cH1 + 3);
          var done = u >= cd.doneAt;
          c.fillStyle = cd.gold ? "rgba(245, 179, 1, 0.08)" : CARD;
          roundRect(c, pad, cy, w - pad * 2, cH1, 4);
          c.fill();
          c.strokeStyle = cd.gold ? GOLD : LINE;
          c.lineWidth = cd.gold ? 1.3 : 1;
          c.stroke();

          text(c, cd.name, pad + 7, cy + 8, 8, cd.col, "left", "700");
          text(c, done ? "DONE" : "RUN", pad + 62, cy + 8, 7, done ? GREEN : DIM, "left", "700");
          text(c, "1M: $" + fmtComma(cd.per1M), w - pad - 7, cy + 8, 8, FG, "right", "700");
          text(c, "run $" + cd.runCost.toFixed(4) + " · 1k $" + cd.per1k.toFixed(2), pad + 7, cy + 19, 7, DIM, "left");
        }
        curY += TOP_CARDS.length * (cH1 + 3) + gap;
      } else {
        var cardW = (w - pad * 2 - gap * 2) / 3;
        var cardH = h < 390 ? 66 : 86;
        var cf = w < 540 ? 7.2 : 8.8;
        for (var cj = 0; cj < TOP_CARDS.length; cj++) {
          var mcd = TOP_CARDS[cj];
          var cx0 = pad + cj * (cardW + gap);
          var progM = clamp(u / mcd.doneAt, 0, 1);
          var doneM = progM >= 1;
          c.fillStyle = mcd.gold ? "rgba(245, 179, 1, 0.08)" : CARD;
          roundRect(c, cx0, curY, cardW, cardH, 5);
          c.fill();
          c.strokeStyle = mcd.gold ? GOLD : LINE;
          c.lineWidth = mcd.gold ? 1.4 : 1;
          c.stroke();

          text(c, mcd.name, cx0 + 8, curY + 11, cf + 1, mcd.col, "left", "700");
          var stTxt = doneM ? "DONE" : "RUN";
          drawPill(c, stTxt, cx0 + cardW - 38, curY + 5, 32, 12, doneM ? GREEN : GOLD, 6.5);

          var r1 = curY + (h < 390 ? 26 : 33);
          var rStep = h < 390 ? 13 : 17;
          text(c, "run", cx0 + 8, r1, cf, MUTED, "left");
          text(c, "$" + (mcd.runCost * progM).toFixed(4), cx0 + cardW - 8, r1, cf, FG, "right", "700");
          text(c, "per 1k", cx0 + 8, r1 + rStep, cf, MUTED, "left");
          text(c, "$" + mcd.per1k.toFixed(2), cx0 + cardW - 8, r1 + rStep, cf, TEXT, "right", "600");
          text(c, "per 1M", cx0 + 8, r1 + rStep * 2, cf, MUTED, "left");
          text(c, "$" + fmtComma(mcd.per1M), cx0 + cardW - 8, r1 + rStep * 2, cf, mcd.gold ? GOLD : TEXT, "right", "700");
        }
        curY += cardH + gap;
      }

      // Middle: LANES · RUNS (3 lanes)
      var lanesH = compact ? 52 : (h < 390 ? 58 : 74);
      c.fillStyle = CARD; roundRect(c, pad, curY, w - pad * 2, lanesH, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      text(c, "04 LANES · RUNS", pad + 8, curY + 10, compact ? 7.5 : 8.5, CYAN, "left", "700");
      text(c, "LIVE RACE", w - pad - 8, curY + 10, compact ? 7 : 8, MUTED, "right", "600");

      var lTop = curY + 18;
      var lRowH = (lanesH - 22) / 3;
      var lLblW = compact ? 50 : 62;
      var lStatW = compact ? 58 : 74;
      var lBarX = pad + 8 + lLblW;
      var lBarW = Math.max(30, w - pad * 2 - 16 - lLblW - lStatW);
      for (var li = 0; li < TOP_CARDS.length; li++) {
        var lc = TOP_CARDS[li];
        var ly = lTop + (li + 0.5) * lRowH;
        var lProg = clamp(u / lc.doneAt, 0, 1);
        text(c, lc.name, pad + 8, ly, compact ? 7 : 8, lc.col, "left", "700");
        c.fillStyle = "#18181b";
        c.fillRect(lBarX, ly - 3.5, lBarW, 7);
        c.fillStyle = lc.col;
        c.fillRect(lBarX, ly - 3.5, Math.max(2, lBarW * lProg), 7);
        text(c, Math.round(lProg * 100) + "% · " + lc.ms + "ms", w - pad - 8, ly, compact ? 6.8 : 7.8, lProg >= 1 ? GREEN : DIM, "right", "600");
      }

      curY += lanesH + gap;

      // Bottom area
      var botH = Math.max(60, h - curY - pad);
      var logMin = Math.log(4) / Math.LN10;
      var logMax = Math.log(maxCost1M * 1.25) / Math.LN10;
      var barAnim = 0.25 + 0.75 * clamp(u * 1.35, 0, 1);

      function drawPricePanel(box) {
        c.fillStyle = CARD; roundRect(c, box.x, box.y, box.w, box.h, 5); c.fill();
        c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
        var pf = (compact || w < 540) ? 7 : 8.5;
        text(c, "08 PRICE · 1M QUESTIONS", box.x + 8, box.y + 11, pf, GOLD, "left", "700");
        text(c, "LOG SCALE", box.x + box.w - 8, box.y + 11, pf - 1, MUTED, "right", "600");

        var multW = compact ? 78 : (w < 540 ? 74 : 112);
        var listW = box.w - 16 - multW;
        var pTop = box.y + 20;
        var pRowH = (box.h - 24) / PRICE_MODELS.length;
        var pLblW = compact ? 54 : (w < 540 ? 52 : 70);
        var pValW = compact ? 36 : (w < 540 ? 38 : 48);
        var pBarX = box.x + 8 + pLblW;
        var pBarMax = Math.max(20, listW - pLblW - pValW - 4);

        for (var pi = 0; pi < PRICE_MODELS.length; pi++) {
          var pm = PRICE_MODELS[pi];
          var py = pTop + (pi + 0.5) * pRowH;
          var isReader = pm.name === "Reader";
          var logFrac = clamp((Math.log(pm.cost1M) / Math.LN10 - logMin) / (logMax - logMin), 0.06, 1);
          var bw = Math.max(4, pBarMax * logFrac * barAnim);
          var bh = Math.min(9, pRowH * 0.56);

          if (isReader) {
            c.fillStyle = "rgba(245, 179, 1, 0.14)";
            roundRect(c, box.x + 4, py - pRowH * 0.45, listW + 4, pRowH * 0.90, 3);
            c.fill();
            c.strokeStyle = GOLD;
            c.lineWidth = 0.9;
            c.stroke();
          }

          text(c, pm.name, box.x + 8, py, pf - 0.6, isReader ? GOLD : TEXT, "left", isReader ? "700" : "500");
          c.fillStyle = "#18181b";
          c.fillRect(pBarX, py - bh * 0.5, pBarMax, bh);
          c.fillStyle = pm.col;
          c.fillRect(pBarX, py - bh * 0.5, bw, bh);
          text(c, "$" + fmtComma(pm.cost1M), pBarX + pBarMax + pValW, py, pf - 0.8, isReader ? GOLD : DIM, "right", isReader ? "700" : "400");
        }

        // Right-side big multiplier callout: "N× cheaper"
        var mCx = box.x + box.w - multW * 0.5 - 4;
        var mCy = box.y + box.h * 0.52;
        text(c, fmtComma(cheaperMult) + "×", mCx, mCy - 10, compact ? 16 : (w < 540 ? 15 : 24), GOLD, "center", "700");
        text(c, "cheaper", mCx, mCy + 10, compact ? 8.5 : (w < 540 ? 8 : 11), FG, "center", "700");
        text(c, "vs " + PRICE_MODELS[0].name, mCx, mCy + 24, compact ? 7 : 8, DIM, "center");
      }

      if (compact) {
        // compact：隱藏 LATENCY
        drawPricePanel({ x: pad, y: curY, w: w - pad * 2, h: botH });
        return fmtComma(cheaperMult) + "× cheaper";
      }

      var priceW = Math.round((w - pad * 2 - gap) * 0.58);
      var latW = w - pad * 2 - gap - priceW;
      var priceBox = { x: pad, y: curY, w: priceW, h: botH };
      var latBox = { x: pad + priceW + gap, y: curY, w: latW, h: botH };

      drawPricePanel(priceBox);

      // Bottom-right: 10 LATENCY + big questions counter + green "saved vs Model-O" bar
      c.fillStyle = CARD; roundRect(c, latBox.x, latBox.y, latBox.w, latBox.h, 5); c.fill();
      c.strokeStyle = LINE; c.lineWidth = 1; c.stroke();
      var lf = w < 540 ? 7 : 8.5;
      text(c, "10 LATENCY", latBox.x + 8, latBox.y + 11, lf, CYAN, "left", "700");

      var curQuestions = Math.round(TARGET_QUESTIONS * clamp(u * 1.12, 0, 1));
      text(c, fmtComma(curQuestions), latBox.x + latBox.w - 8, latBox.y + (h < 390 ? 28 : 34), w < 540 ? 13 : 20, FG, "right", "700");
      text(c, "questions", latBox.x + 8, latBox.y + (h < 390 ? 28 : 34), lf, DIM, "left", "600");

      var savedBarH = h < 390 ? 20 : 24;
      var savedBarY = latBox.y + latBox.h - savedBarH - 6;
      var latBarsTop = latBox.y + (h < 390 ? 42 : 52);
      var latBarsH = Math.max(24, savedBarY - latBarsTop - 6);
      var latStep = latBarsH / 3;
      var maxMs = 960;
      var lNameW = w < 540 ? 44 : 56;
      var lMsW = w < 540 ? 32 : 40;
      var lbx = latBox.x + 8 + lNameW;
      var lbMax = Math.max(16, latBox.w - 16 - lNameW - lMsW);

      for (var bi = 0; bi < TOP_CARDS.length; bi++) {
        var bm = TOP_CARDS[bi];
        var by = latBarsTop + (bi + 0.5) * latStep;
        var frac = (bm.ms / maxMs) * barAnim;
        text(c, bm.name, latBox.x + 8, by, lf - 0.5, bm.col, "left", bm.gold ? "700" : "500");
        c.fillStyle = "#18181b";
        c.fillRect(lbx, by - 3.5, lbMax, 7);
        c.fillStyle = bm.col;
        c.fillRect(lbx, by - 3.5, Math.max(3, lbMax * frac), 7);
        text(c, bm.ms + "ms", latBox.x + latBox.w - 8, by, lf - 0.6, bm.gold ? GOLD : DIM, "right", "600");
      }

      // Green "saved vs Model-O" bar
      c.fillStyle = "rgba(34, 197, 94, 0.12)";
      roundRect(c, latBox.x + 6, savedBarY, latBox.w - 12, savedBarH, 4);
      c.fill();
      c.strokeStyle = "rgba(34, 197, 94, 0.55)";
      c.lineWidth = 1;
      c.stroke();

      var svFillW = (latBox.w - 16) * (0.2 + 0.8 * clamp(u * 1.15, 0, 1)) * (parseFloat(savedPct) / 100);
      c.fillStyle = "rgba(34, 197, 94, 0.25)";
      roundRect(c, latBox.x + 8, savedBarY + 2, Math.max(6, svFillW), savedBarH - 4, 3);
      c.fill();

      text(c, "saved vs Model-O", latBox.x + 12, savedBarY + savedBarH * 0.5, w < 540 ? 6.8 : 8, GREEN, "left", "700");
      var svRight = latBox.w < 220 ? (savedPct + "%") : ("$" + fmtComma(savedDollar) + " (" + savedPct + "%)");
      text(c, svRight, latBox.x + latBox.w - 12, savedBarY + savedBarH * 0.5, w < 540 ? 6.8 : 8, FG, "right", "700");

      return fmtComma(curQuestions) + " q · " + fmtComma(cheaperMult) + "× cheaper";
    }, o);
  }

  A23.spanPointer = spanPointer;
  A23.orbitRace = orbitRace;
  A23.modelCostBoard = modelCostBoard;
  g.A23Charts = A23;
})(window);
