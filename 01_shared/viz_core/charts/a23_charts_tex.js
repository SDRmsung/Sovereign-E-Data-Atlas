/* A23 Charts — §6.7 共用質感原語（唯一入口；2026-11-16 由 a23_charts_studio.js S0 抽出）
 * 載入順序：所有 a23_charts*.js 之前。window.A23Tex.kit(theme) → 整組原語（綁定主題色票）。
 * 主題：THEMES.violet＝STU 原 V 色票（逐字保留，像素一致）；其餘套組用 theme(accHex) 產生單色 6 階。
 * 守則（Visual_Pipeline_Design_Guide §6.7）：①插畫預覽 develop/pane ②虛點引導線 leader ③埠點 kvPort ④作用光暈 activeHalo；
 * 紅綠只留語意；承載資訊文字 w≥540 時 ≥9px，5.4px 僅裝飾標籤。零 Math.random／Date.now。
 */
(function (g) {
  "use strict";
  var MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Microsoft JhengHei', monospace";
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function rgb(h) { h = h.replace("#", ""); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function hex(a) { return "#" + a.map(function (v) { return ("0" + Math.round(clamp(v, 0, 255)).toString(16)).slice(-2); }).join(""); }
  function mix(a, b, t) { var p = rgb(a), q = rgb(b); return hex([lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)]); }
  function rgba(h, a) { var p = rgb(h); return "rgba(" + p[0] + "," + p[1] + "," + p[2] + "," + a + ")"; }

  var THEMES = {
    violet: { bg: "#09080f", card: "#0d0c15", pane: "#08070d", line: "#24203a", line2: "#3b3460",
      ink: "#ece8ff", txt: "#c4bde6", dim: "#857ea8", mute: "#544d73", acc: "#8b5cf6", acc2: "#a78bfa", acc3: "#c4b5fd", deep: "#5b21b6",
      dot: "#141224", dot2: "#16132a", lead: "#2c2746", track: "#1a1729" }
  };
  /* 由單一主色推單色 6 階（深底→細線→文字→主色→亮階），供非 STU 套組使用 */
  function theme(acc) {
    var B = "#07080c";
    return { bg: mix(B, acc, 0.03), card: mix(B, acc, 0.06), pane: mix("#050609", acc, 0.03), line: mix(B, acc, 0.17), line2: mix(B, acc, 0.3),
      ink: mix("#ffffff", acc, 0.08), txt: mix("#e6e8ef", acc, 0.2), dim: mix("#868aa0", acc, 0.25), mute: mix("#50546a", acc, 0.25),
      acc: acc, acc2: mix(acc, "#ffffff", 0.22), acc3: mix(acc, "#ffffff", 0.5), deep: mix(acc, "#000000", 0.45),
      dot: mix(B, acc, 0.08), dot2: mix(B, acc, 0.1), lead: mix(B, acc, 0.21), track: mix(B, acc, 0.1) };
  }

  function roundRect(c, x, y, w, h, r) {
    var rad = Math.min(r, w * 0.5, h * 0.5);
    c.beginPath(); c.moveTo(x + rad, y); c.lineTo(x + w - rad, y); c.quadraticCurveTo(x + w, y, x + w, y + rad);
    c.lineTo(x + w, y + h - rad); c.quadraticCurveTo(x + w, y + h, x + w - rad, y + h); c.lineTo(x + rad, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - rad); c.lineTo(x, y + rad); c.quadraticCurveTo(x, y, x + rad, y); c.closePath();
  }
  function evalOrth(pts, frac) {
    var segs = [], total = 0;
    for (var i = 0; i < pts.length - 1; i++) {
      var dx = pts[i + 1][0] - pts[i][0], dy = pts[i + 1][1] - pts[i][1], len = Math.hypot(dx, dy);
      segs.push({ x0: pts[i][0], y0: pts[i][1], x1: pts[i + 1][0], y1: pts[i + 1][1], len: len }); total += len;
    }
    var target = clamp(frac, 0, 1) * total, acc = 0;
    for (var j = 0; j < segs.length; j++) {
      var sg = segs[j];
      if (acc + sg.len >= target || j === segs.length - 1) { var f = sg.len > 0 ? clamp((target - acc) / sg.len, 0, 1) : 0; return [lerp(sg.x0, sg.x1, f), lerp(sg.y0, sg.y1, f)]; }
      acc += sg.len;
    }
    return pts[pts.length - 1];
  }
  /* 曼哈頓走線：直角折點以 arcTo 圓角 */
  function orthPath(c, pts, radius) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length - 1; i++) c.arcTo(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], radius);
    c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); c.stroke();
  }
  function hh(i, s) { var x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); }
  function ln(c, x1, y1, x2, y2) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); }
  function tx(c, s, x, y, size, color, align, weight) {
    c.font = (weight ? weight + " " : "") + size + "px " + MONO;
    c.fillStyle = color; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y);
  }
  /* measureText 截斷（中文長字不溢出） */
  function fitM(c, str, maxW, fSize, weight) {
    str = String(str); c.font = (weight || "700") + " " + fSize + "px " + MONO;
    if (c.measureText(str).width <= maxW) return str;
    var n = str.length; while (n > 1 && c.measureText(str.slice(0, n) + "…").width > maxW) n--;
    return str.slice(0, n) + "…";
  }
  function dotGrid(c, x, y, w, h, step, col) {
    c.fillStyle = col;
    for (var gx = x + step * 0.5; gx < x + w; gx += step)
      for (var gy = y + step * 0.5; gy < y + h; gy += step) c.fillRect(Math.round(gx), Math.round(gy), 1, 1);
  }
  /* 依寬度給資訊字級：w≥540 → ≥9px（§保留異議），縮圖可降 */
  function infoFont(w) { return w >= 540 ? Math.max(9, Math.round(w / 64)) : (w >= 380 ? 7.5 : 6); }

  function kit(V) {
    V = V || THEMES.violet;
    var GLOW = rgba(V.acc, 0.55), GLOW2 = rgba(V.acc, 0.7), ECHO = rgba(V.acc3, 0.25);
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
    function leader(c, k, v, xk, xv, y, f, isAct) {
      tx(c, k, xk, y, f, V.dim);
      c.font = "600 " + f + "px " + MONO; var vw = c.measureText(String(v)).width;
      tx(c, String(v), xv, y, f, isAct ? V.ink : V.txt, "right", "600");
      var kw = c.measureText(k).width;
      c.setLineDash([1, 2]); c.strokeStyle = V.lead; c.lineWidth = 1;
      ln(c, xk + 3 + kw, Math.round(y) + 0.5, xv - 3 - vw, Math.round(y) + 0.5); c.setLineDash([]);
    }
    function kvPort(c, x, y, lit) {
      c.fillStyle = V.bg; c.strokeStyle = lit ? V.acc2 : V.line2; c.lineWidth = 1;
      c.beginPath(); c.arc(x, y, 1.9, 0, Math.PI * 2); c.fill(); c.stroke();
      if (lit) { c.fillStyle = V.acc3; c.beginPath(); c.arc(x, y, 0.9, 0, Math.PI * 2); c.fill(); }
    }
    function activeHalo(c, x, y, w, h, blur) {
      c.save(); c.shadowColor = GLOW; c.shadowBlur = blur == null ? 12 : blur;
      c.strokeStyle = GLOW2; c.lineWidth = 1;
      roundRect(c, x - 3.5, y - 3.5, w + 7, h + 7, 7); c.stroke(); c.restore();
      c.strokeStyle = ECHO; roundRect(c, x - 6.5, y - 6.5, w + 13, h + 13, 9); c.stroke();
    }
    function specEdge(c, x, y, w, a) { c.fillStyle = "rgba(255,255,255," + (a == null ? 0.08 : a) + ")"; c.fillRect(x, y, w, 1); }
    function hotPacket(c, pts, frac, col, r) {
      r = r || 2.6;
      for (var k = 3; k >= 1; k--) {
        var f = frac - k * 0.035; if (f < 0) continue;
        var q = evalOrth(pts, f); c.globalAlpha = 0.5 * Math.pow(0.6, k - 1);
        c.fillStyle = col; c.beginPath(); c.arc(q[0], q[1], r * (1 - k * 0.18), 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
      var p = evalOrth(pts, frac);
      c.fillStyle = col; c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#ffffff"; c.beginPath(); c.arc(p[0], p[1], r * 0.42, 0, Math.PI * 2); c.fill();
      return p;
    }
    /* ① 插畫預覽顯影：先畫虛影（dim），再依 prog 由上而下 clip 顯影（亮），白色 1px 掃描線；draw(c, color) 由呼叫端畫內容 */
    function develop(c, b, prog, draw) {
      prog = clamp(prog, 0, 1);
      c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h); c.clip();
      c.globalAlpha = 0.35; draw(c, V.line2, false); c.globalAlpha = 1;
      if (prog > 0) {
        c.save(); c.beginPath(); c.rect(b.x, b.y, b.w, b.h * prog); c.clip(); draw(c, V.acc2, true); c.restore();
        if (prog < 1) { var sy = Math.round(b.y + b.h * prog) + 0.5; c.strokeStyle = "#ffffff"; c.lineWidth = 1; ln(c, b.x + 1, sy, b.x + b.w - 1, sy); }
      }
      c.restore();
    }
    /* ② 鍵值列區塊：rows=[[k,v,lit]]，左側壓框埠點、右齊值，回傳實際列數 */
    function kvBlock(c, b, rows, f, portX) {
      var rowH = f + Math.max(5, Math.round(f * 0.8)), n = Math.max(0, Math.min(rows.length, Math.floor((b.h - 2) / rowH)));
      for (var i = 0; i < n; i++) {
        var y = Math.round(b.y + rowH * (i + 0.6)), r = rows[i];
        leader(c, String(r[0]), String(r[1]), b.x + 4, b.x + b.w - 4, y, f, !!r[2]);
        if (portX != null) kvPort(c, portX, y, !!r[2]);
      }
      return n;
    }
    return { V: V, MONO: MONO, clamp: clamp, lerp: lerp, rgba: rgba, mix: mix, hh: hh, ln: ln, tx: tx, fitM: fitM, infoFont: infoFont,
      roundRect: roundRect, evalOrth: evalOrth, orthPath: orthPath, dotGrid: dotGrid,
      pane: pane, leader: leader, kvPort: kvPort, activeHalo: activeHalo, specEdge: specEdge, hotPacket: hotPacket, develop: develop, kvBlock: kvBlock };
  }

  g.A23Tex = { version: "2026-11-16", THEMES: THEMES, theme: theme, kit: kit, mix: mix, rgba: rgba };
})(typeof window !== "undefined" ? window : globalThis);
