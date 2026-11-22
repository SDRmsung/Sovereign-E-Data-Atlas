/* A23 Charts v4（19 型：+#6 waterfall #9 scatter；v3：#24 gauge #4 donut #5 histogram #18 boxPlot） — 零依賴 Canvas 動態圖表（n05 型錄 #1 #8 #10 #12 #20）
 * 用法：A23Charts.barRace(canvas, frames, opt) → 控制器 {play,pause,seek,t,n,playing}
 * 資料契約見 00_notes/n05_dynamic_chart_catalog.md；離線可用，不需 CDN／CORS。 */
(function (g) {
  "use strict";
  var PAL = ["#10b981","#38bdf8","#f59e0b","#f43f5e","#a78bfa","#14b8a6","#eab308","#fb7185","#60a5fa","#34d399","#f97316","#c084fc"];
  var BG = "#0b1220", FG = "#e2e8f0", DIM = "#64748b";
  var RAMP = ["#0b1220","#1e3a8a","#0ea5e9","#10b981","#facc15","#f43f5e"];
  function col(i) { return PAL[i % PAL.length]; }
  function lerp(a, b, u) { return a + (b - a) * u; }
  function ease(u) { return u * u * (3 - 2 * u); }
  function fit(cv) {
    var d = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    var w = +cv.dataset.w || Math.max(1, Math.round(r.width)), h = +cv.dataset.h || Math.max(1, Math.round(r.height)); /* data-w/h：固定邏輯尺寸，縮圖用 */
    if (cv.__w !== w || cv.__h !== h || cv.__d !== d) { cv.width = w * d; cv.height = h * d; cv.__w = w; cv.__h = h; cv.__d = d; }
    var c = cv.getContext("2d"); c.setTransform(d, 0, 0, d, 0, 0);
    c.fillStyle = BG; c.fillRect(0, 0, w, h);
    return { c: c, w: w, h: h };
  }
  function hex2rgb(h) { return [1, 3, 5].map(function (k) { return parseInt(h.substr(k, 2), 16); }); }
  function mix(a, b, f) { var A = hex2rgb(a), B = hex2rgb(b); return "rgb(" + A.map(function (x, i) { return Math.round(lerp(x, B[i], f)); }).join(",") + ")"; }
  function ramp(u) { u = Math.max(0, Math.min(1, u)); var n = RAMP.length - 1, p = u * n, i = Math.min(n - 1, Math.floor(p)); return mix(RAMP[i], RAMP[i + 1], p - i); }
  function driver(n, draw, o) {
    o = o || {};
    var fps = o.fps || 1.5, t = 0, playing = false, last = 0, raf = 0;
    function tick(ts) {
      if (!playing) return;
      if (last) t += (ts - last) / 1000 * fps;
      last = ts;
      if (t > n - 1) { if (o.loop === false) { t = n - 1; playing = false; } else t = 0; }
      draw(t); if (o.onTick) o.onTick(t);
      raf = requestAnimationFrame(tick);
    }
    var ctl = {
      n: n,
      play: function () { if (playing) return; playing = true; last = 0; raf = requestAnimationFrame(tick); },
      pause: function () { playing = false; cancelAnimationFrame(raf); },
      seek: function (x) { t = Math.max(0, Math.min(n - 1, x)); draw(t); },
      redraw: function () { draw(t); }
    };
    Object.defineProperty(ctl, "t", { get: function () { return t; } });
    Object.defineProperty(ctl, "playing", { get: function () { return playing; } });
    ctl.seek(0);
    return ctl;
  }
  function text(c, s, x, y, size, color, align) {
    c.font = size + "px 'Microsoft JhengHei',system-ui,sans-serif"; c.fillStyle = color || FG; c.textAlign = align || "left"; c.textBaseline = "middle"; c.fillText(s, x, y);
  }

  /* #1 Bar Chart Race — frames: [{label, values:{名稱:數值}}] */
  function barRace(cv, frames, opt) {
    var o = opt || {}, topN = o.topN || 10, keys = [];
    frames.forEach(function (f) { Object.keys(f.values).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
    var ranks = frames.map(function (f) {
      var arr = keys.slice().sort(function (a, b) { return (f.values[b] || 0) - (f.values[a] || 0); }), r = {};
      arr.forEach(function (k, i) { r[k] = i; }); return r;
    });
    var maxV = 0; frames.forEach(function (f) { keys.forEach(function (k) { maxV = Math.max(maxV, f.values[k] || 0); }); });
    return driver(frames.length, function (t) {
      var s = fit(cv), c = s.c, i = Math.min(Math.max(frames.length - 2, 0), Math.floor(t)), j = Math.min(frames.length - 1, i + 1);
      var u = ease(Math.min(1, t - i)), L = 92, R = 64, T = 30, rowH = (s.h - T - 10) / topN;
      var cur = keys.map(function (k, ki) {
        return { k: k, ci: ki, v: lerp(frames[i].values[k] || 0, frames[j].values[k] || 0, u), p: lerp(ranks[i][k], ranks[j][k], u) };
      }).filter(function (d) { return d.p < topN; });
      text(c, o.title || "", 12, 16, 13, DIM);
      text(c, (u < 0.5 ? frames[i] : frames[j]).label, s.w - 12, s.h - 28, 38, "rgba(226,232,240,.18)", "right");
      cur.forEach(function (d) {
        var y = T + d.p * rowH, bw = Math.max(1, d.v / maxV * (s.w - L - R));
        c.fillStyle = col(d.ci); c.globalAlpha = 0.9; c.fillRect(L, y + 2, bw, rowH - 5); c.globalAlpha = 1;
        text(c, d.k, L - 8, y + rowH / 2, 12, FG, "right");
        text(c, Math.round(d.v).toLocaleString("en-US"), L + bw + 6, y + rowH / 2, 11, DIM, "left");
      });
    }, o);
  }

  /* #8 Animated Bubble — frames: [{label, points:[{id,x,y,r,g}]}] */
  function bubble(cv, frames, opt) {
    var o = opt || {}, ids = [], X = [1e18, -1e18], Y = [1e18, -1e18], RM = 0;
    frames.forEach(function (f) { f.points.forEach(function (p) {
      if (ids.indexOf(p.id) < 0) ids.push(p.id);
      X[0] = Math.min(X[0], p.x); X[1] = Math.max(X[1], p.x); Y[0] = Math.min(Y[0], p.y); Y[1] = Math.max(Y[1], p.y); RM = Math.max(RM, p.r);
    }); });
    var px = (X[1] - X[0]) * 0.08 || 1, py = (Y[1] - Y[0]) * 0.08 || 1;
    X = [X[0] - px, X[1] + px]; Y = [Y[0] - py, Y[1] + py];
    var maps = frames.map(function (f) { var m = {}; f.points.forEach(function (p) { m[p.id] = p; }); return m; });
    return driver(frames.length, function (t) {
      var s = fit(cv), c = s.c, i = Math.min(Math.max(frames.length - 2, 0), Math.floor(t)), j = Math.min(frames.length - 1, i + 1), u = ease(Math.min(1, t - i));
      var ML = 46, MB = 30, MT = 24, MR = 14, W = s.w - ML - MR, H = s.h - MT - MB;
      function sx(v) { return ML + (v - X[0]) / (X[1] - X[0]) * W; }
      function sy(v) { return MT + H - (v - Y[0]) / (Y[1] - Y[0]) * H; }
      c.strokeStyle = "#1e293b"; c.lineWidth = 1;
      for (var k = 0; k <= 4; k++) {
        var gx = ML + W * k / 4, gy = MT + H * k / 4;
        c.beginPath(); c.moveTo(gx, MT); c.lineTo(gx, MT + H); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke();
        text(c, (lerp(X[0], X[1], k / 4)).toFixed(1), gx, MT + H + 12, 10, DIM, "center");
        text(c, (lerp(Y[1], Y[0], k / 4)).toFixed(1), ML - 6, gy, 10, DIM, "right");
      }
      text(c, o.xLabel || "x", ML + W / 2, s.h - 6, 11, DIM, "center");
      text(c, o.yLabel || "y", 4, 10, 11, DIM, "left");
      text(c, (u < 0.5 ? frames[i] : frames[j]).label, s.w - 12, MT + 24, 34, "rgba(226,232,240,.18)", "right");
      var pts = ids.map(function (id, ci) {
        var a = maps[i][id] || maps[j][id], b = maps[j][id] || a; if (!a) return null;
        return { id: id, ci: ci, x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u), r: lerp(a.r, b.r, u) };
      }).filter(Boolean).sort(function (a, b) { return b.r - a.r; });
      pts.forEach(function (p, idx) {
        var rad = 4 + Math.sqrt(p.r / RM) * (o.rMax || 30);
        c.beginPath(); c.arc(sx(p.x), sy(p.y), rad, 0, 6.2832); c.fillStyle = col(p.ci); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1;
        c.strokeStyle = col(p.ci); c.stroke();
        if (idx < (o.labelTop || 6)) text(c, p.id, sx(p.x), sy(p.y) - rad - 7, 10, FG, "center");
      });
    }, o);
  }

  /* #10 Animated Heatmap — m:{rows:[], cols:[], z:[[rows×cols]]}；逐欄揭示＋游標 */
  function heatmap(cv, m, opt) {
    var o = opt || {}, lo = 1e18, hi = -1e18;
    m.z.forEach(function (r) { r.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); });
    if (o.min != null) lo = o.min; if (o.max != null) hi = o.max;
    return driver(m.cols.length, function (t) {
      var s = fit(cv), c = s.c, ML = o.labelW || 70, MT = 26, MB = 6, MR = 10, nR = m.rows.length, nC = m.cols.length;
      var cw = (s.w - ML - MR) / nC, rh = (s.h - MT - MB) / nR, cur = Math.floor(t);
      text(c, o.title || "", 12, 12, 12, DIM);
      for (var j = 0; j < nC; j++) {
        if (j % 3 === 0) text(c, m.cols[j], ML + j * cw + cw / 2, MT - 8, 9, DIM, "center");
        if (j > cur) continue;
        c.globalAlpha = j === cur ? Math.min(1, t - cur + 0.25) : 1;
        for (var i = 0; i < nR; i++) { c.fillStyle = ramp((m.z[i][j] - lo) / (hi - lo || 1)); c.fillRect(ML + j * cw, MT + i * rh, cw - 1, rh - 1); }
        c.globalAlpha = 1;
      }
      for (var r = 0; r < nR; r++) text(c, m.rows[r], ML - 6, MT + r * rh + rh / 2, 11, FG, "right");
      c.strokeStyle = "#f8fafc"; c.lineWidth = 1.5; c.strokeRect(ML + cur * cw, MT, cw - 1, s.h - MT - MB);
    }, o);
  }

  /* #12 Sankey — d:{nodes:[{id,layer}], links:[{s,t,v}]}；連續流動粒子 */
  function sankey(cv, d, opt) {
    var o = opt || {}, nodeW = 12, byId = {}, layers = 0;
    d.nodes.forEach(function (n) { byId[n.id] = n; n.in = 0; n.out = 0; layers = Math.max(layers, n.layer + 1); });
    d.links.forEach(function (l) { byId[l.s].out += l.v; byId[l.t].in += l.v; });
    d.nodes.forEach(function (n) { n.val = Math.max(n.in, n.out); n.oo = 0; n.io = 0; });
    function layout(s) {
      var pad = 12, gap = 8, k = 1e18, cols = [];
      for (var L = 0; L < layers; L++) {
        var ns = d.nodes.filter(function (n) { return n.layer === L; }), sum = ns.reduce(function (a, n) { return a + n.val; }, 0);
        cols.push(ns); k = Math.min(k, (s.h - 2 * pad - gap * (ns.length - 1)) / (sum || 1));
      }
      cols.forEach(function (ns, L) {
        var rPad = (typeof o.rightPad === "number") ? o.rightPad : 90;
        var y = pad, x = pad + L * ((s.w - 2 * pad - nodeW - rPad) / Math.max(1, layers - 1));
        ns.forEach(function (n) { n.x = x; n.y = y; n.h = Math.max(2, n.val * k); y += n.h + gap; n.oo = 0; n.io = 0; });
      });
      return k;
    }
    function pt(l, u) {
      var x0 = l.x0, x1 = l.x1, mx = (x0 + x1) / 2, a = 1 - u;
      return [a*a*a*x0 + 3*a*a*u*mx + 3*a*u*u*mx + u*u*u*x1, a*a*a*l.y0 + 3*a*a*u*l.y0 + 3*a*u*u*l.y1 + u*u*u*l.y1];
    }
    return driver(120, function (t) {
      var s = fit(cv), c = s.c, k = layout(s), ph = t / 120;
      d.links.forEach(function (l, li) {
        var a = byId[l.s], b = byId[l.t], th = l.v * k;
        l.x0 = a.x + nodeW; l.x1 = b.x; l.y0 = a.y + a.oo + th / 2; l.y1 = b.y + b.io + th / 2; a.oo += th; b.io += th;
        var mx = (l.x0 + l.x1) / 2;
        c.beginPath(); c.moveTo(l.x0, l.y0 - th / 2); c.bezierCurveTo(mx, l.y0 - th / 2, mx, l.y1 - th / 2, l.x1, l.y1 - th / 2);
        c.lineTo(l.x1, l.y1 + th / 2); c.bezierCurveTo(mx, l.y1 + th / 2, mx, l.y0 + th / 2, l.x0, l.y0 + th / 2); c.closePath();
        c.fillStyle = col(d.nodes.indexOf(a)); c.globalAlpha = 0.28; c.fill(); c.globalAlpha = 1;
        var np = Math.max(1, Math.min(6, Math.round(th / 5)));
        for (var q = 0; q < np; q++) {
          var p = pt(l, (ph * 2 + q / np + li * 0.13) % 1);
          c.beginPath(); c.arc(p[0], p[1] + (q % 3 - 1) * th / 4, 1.8, 0, 6.2832); c.fillStyle = "#f8fafc"; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
        }
      });
      var colX = [];
      d.nodes.forEach(function (n, i) {
        colX[n.layer] = n.x;
        c.fillStyle = col(i); c.fillRect(n.x, n.y, nodeW, n.h);
      });
      d.nodes.forEach(function (n) {
        var lbl = (typeof o.labelMap === "function") ? o.labelMap(n.id) : (o.labelMap && o.labelMap[n.id]) || n.id;
        var txt = lbl + " " + Math.round(n.val).toLocaleString("en-US");
        var isLast = n.layer >= layers - 1;
        var align = (o.rightLabelLeft && isLast) ? "right" : "left";
        var lx = (align === "right") ? n.x - 4 : n.x + nodeW + 4;
        var ly = n.y + n.h / 2;
        var lines = [txt];
        var fSize = 11;
        var fontFam = window.A23_FONT || "'Microsoft JhengHei',sans-serif";
        if (o.labelFit && !isLast && align === "left" && typeof colX[n.layer + 1] === "number") {
          c.save();
          c.font = fSize + "px " + fontFam;
          var availFit = colX[n.layer + 1] - lx - 6;
          if (availFit > 0 && c.measureText(txt).width > availFit) {
            var ci = txt.indexOf(":");
            if (ci > 0 && ci < txt.length - 1) {
              lines = [txt.slice(0, ci + 1), txt.slice(ci + 1).replace(/^\s+/, "")];
            } else {
              var spF = txt.indexOf(" ");
              if (spF > 0) lines = [txt.slice(0, spF), txt.slice(spF + 1)];
            }
            var maxW = 0;
            lines.forEach(function (ln) { maxW = Math.max(maxW, c.measureText(ln).width); });
            while (fSize > 9 && maxW > availFit) {
              fSize -= 1;
              c.font = fSize + "px " + fontFam;
              maxW = 0;
              lines.forEach(function (ln) { maxW = Math.max(maxW, c.measureText(ln).width); });
            }
          }
          c.restore();
        } else if (o.labelWrap && isLast && align === "left") {
          c.save();
          c.font = fSize + "px " + fontFam;
          var avail = s.w - 4 - lx;
          if (c.measureText(txt).width > avail) {
            var sp = txt.indexOf(" ");
            if (sp > 0) lines = [txt.slice(0, sp), txt.slice(sp + 1)];
          }
          c.restore();
        }
        var lh = fSize + 3;
        if (o.labelBg) {
          c.save();
          c.font = fSize + "px " + fontFam;
          var tw = 0;
          lines.forEach(function (ln) { tw = Math.max(tw, c.measureText(ln).width); });
          if (align === "left" && lx + tw > s.w - 4) lx = Math.max(4, s.w - 4 - tw);
          if (align === "right" && lx - tw < 4) lx = Math.min(s.w - 4, 4 + tw);
          var bx = (align === "right") ? lx - tw - 3 : lx - 3;
          var bh = lines.length * lh + 2;
          c.fillStyle = "rgba(11, 18, 32, 0.78)";
          c.fillRect(bx, ly - bh / 2, tw + 6, bh);
          c.restore();
        }
        if (lines.length === 1) {
          text(c, lines[0], lx, ly, fSize, FG, align);
        } else {
          lines.forEach(function (ln, idx) {
            text(c, ln, lx, ly + (idx - (lines.length - 1) / 2) * lh, fSize, FG, align);
          });
        }
      });
    }, { fps: 30 });
  }

  /* #20 Flow Map — d:{nodes:[{name,lon,lat}], arcs:[{from,to,v}]}；opt.drawBase(ctx,proj,w,h) 可掛底圖 */
  function flowMap(cv, d, opt) {
    var o = opt || {}, byN = {}, b = [1e18, -1e18, 1e18, -1e18], vmax = 0;
    d.nodes.forEach(function (n) { byN[n.name] = n; b[0] = Math.min(b[0], n.lon); b[1] = Math.max(b[1], n.lon); b[2] = Math.min(b[2], n.lat); b[3] = Math.max(b[3], n.lat); });
    d.arcs.forEach(function (a) { vmax = Math.max(vmax, a.v); });
    return driver(120, function (t) {
      var s = fit(cv), c = s.c, pad = 36, k0 = Math.cos((b[2] + b[3]) / 2 * Math.PI / 180);
      var dx = (b[1] - b[0]) * k0 || 1, dy = (b[3] - b[2]) || 1, sc = Math.min((s.w - 2 * pad) / dx, (s.h - 2 * pad) / dy);
      var ox = (s.w - dx * sc) / 2, oy = (s.h - dy * sc) / 2;
      function proj(n) { return [ox + (n.lon - b[0]) * k0 * sc, s.h - oy - (n.lat - b[2]) * sc]; }
      if (o.drawBase) o.drawBase(c, proj, s.w, s.h);
      var ph = t / 120;
      d.arcs.forEach(function (a, ai) {
        var p0 = proj(byN[a.from]), p1 = proj(byN[a.to]), mx = (p0[0] + p1[0]) / 2, my = (p0[1] + p1[1]) / 2;
        var dxl = p1[0] - p0[0], dyl = p1[1] - p0[1], cx = mx - dyl * 0.25, cy = my + dxl * 0.25, wd = 0.8 + 3.2 * a.v / vmax;
        c.beginPath(); c.moveTo(p0[0], p0[1]); c.quadraticCurveTo(cx, cy, p1[0], p1[1]);
        c.strokeStyle = "#38bdf8"; c.globalAlpha = 0.22; c.lineWidth = wd; c.stroke(); c.globalAlpha = 1;
        for (var q = 0; q < 10; q++) {
          var u = ((ph * 2 + ai * 0.17) % 1) - q * 0.012; if (u < 0 || u > 1) continue; var w = 1 - u;
          c.beginPath(); c.arc(w*w*p0[0] + 2*w*u*cx + u*u*p1[0], w*w*p0[1] + 2*w*u*cy + u*u*p1[1], wd * (1 - q / 12) + 0.6, 0, 6.2832);
          c.fillStyle = "#f8fafc"; c.globalAlpha = 1 - q / 10; c.fill(); c.globalAlpha = 1;
        }
      });
      d.nodes.forEach(function (n, i) {
        var p = proj(n); c.beginPath(); c.arc(p[0], p[1], 4, 0, 6.2832); c.fillStyle = col(i); c.fill();
        text(c, n.name, p[0] + 7, p[1], 10, FG, "left");
      });
      if (o.note) text(c, o.note, 12, 14, 11, DIM);
    }, { fps: 30 });
  }

  /* #2 Animated Line — d:{x:[標籤], series:[{name, values:[]}]}；逐點生長 */
  function line(cv, d, opt) {
    var o = opt || {}, n = d.x.length, lo = 1e18, hi = -1e18;
    d.series.forEach(function (s) { s.values.forEach(function (v) { lo = Math.min(lo, v); hi = Math.max(hi, v); }); });
    var pad = (hi - lo) * 0.08 || 1; lo -= pad; hi += pad;
    return driver(n, function (t) {
      var s = fit(cv), c = s.c, ML = 44, MR = 74, MT = 22, MB = 26, W = s.w - ML - MR, H = s.h - MT - MB, k = Math.min(n - 1, Math.floor(t));
      function sx(i) { return ML + W * i / Math.max(1, n - 1); }
      function sy(v) { return MT + H - (v - lo) / (hi - lo) * H; }
      text(c, o.title || "", 12, 11, 12, DIM);
      c.strokeStyle = "#1e293b"; c.lineWidth = 1;
      for (var g = 0; g <= 4; g++) {
        var gy = MT + H * g / 4; c.beginPath(); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke();
        text(c, lerp(hi, lo, g / 4).toFixed(o.dec == null ? 2 : o.dec), ML - 6, gy, 10, DIM, "right");
      }
      for (var i = 0; i < n; i += 3) text(c, d.x[i], sx(i), MT + H + 13, 10, DIM, "center");
      c.strokeStyle = "rgba(248,250,252,.5)"; c.beginPath(); c.moveTo(sx(t), MT); c.lineTo(sx(t), MT + H); c.stroke();
      d.series.forEach(function (se, si) {
        var v = se.values, f = t - k, hx = sx(k), hy = sy(v[k]);
        c.beginPath(); c.moveTo(sx(0), sy(v[0]));
        for (var q = 1; q <= k; q++) c.lineTo(sx(q), sy(v[q]));
        if (k < n - 1) { hx = lerp(sx(k), sx(k + 1), f); hy = lerp(sy(v[k]), sy(v[k + 1]), f); c.lineTo(hx, hy); }
        c.strokeStyle = col(si); c.lineWidth = 2; c.stroke();
        c.beginPath(); c.arc(hx, hy, 3.5, 0, 6.2832); c.fillStyle = col(si); c.fill();
        text(c, se.name, ML + W + 6, hy, 10, col(si), "left");
      });
    }, o);
  }

  /* #15 Treemap — frames:[{label, values:{名稱:數值}}]；矩形隨時間重排 */
  function squarify(items, x, y, w, h) {
    var total = items.reduce(function (a, i) { return a + i.v; }, 0), out = [];
    if (total <= 0) return out;
    var arr = items.map(function (i) { return { k: i.k, a: i.v * w * h / total }; });
    var rx = x, ry = y, rw = w, rh = h, row = [];
    function worst(r, side) { var s = 0, mx = 0, mn = 1e18; r.forEach(function (q) { s += q.a; mx = Math.max(mx, q.a); mn = Math.min(mn, q.a); }); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); }
    function flush() {
      var s = row.reduce(function (a, r) { return a + r.a; }, 0);
      if (rw >= rh) { var cw = s / rh, cy = ry; row.forEach(function (r) { var hh = r.a / cw; out.push({ k: r.k, x: rx, y: cy, w: cw, h: hh }); cy += hh; }); rx += cw; rw -= cw; }
      else { var ch = s / rw, cx = rx; row.forEach(function (r) { var ww = r.a / ch; out.push({ k: r.k, x: cx, y: ry, w: ww, h: ch }); cx += ww; }); ry += ch; rh -= ch; }
      row = [];
    }
    arr.forEach(function (it) { var side = Math.min(rw, rh); if (row.length && worst(row.concat([it]), side) > worst(row, side)) { flush(); side = Math.min(rw, rh); } row.push(it); });
    if (row.length) flush();
    return out;
  }
  function treemap(cv, frames, opt) {
    var o = opt || {}, keys = [];
    frames.forEach(function (f) { Object.keys(f.values).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
    var keyIdx = {}; keys.forEach(function (k, idx) { keyIdx[k] = idx; });
    return driver(frames.length, function (t) {
      var s = fit(cv), c = s.c, i = Math.min(Math.max(frames.length - 2, 0), Math.floor(t)), j = Math.min(frames.length - 1, i + 1), u = ease(Math.min(1, t - i));
      text(c, (o.title || "") + "　" + (u < 0.5 ? frames[i] : frames[j]).label, 12, 11, 12, DIM);
      var items = keys.map(function (k) {
        return { k: k, v: Math.max(0.5, lerp(frames[i].values[k] || 0, frames[j].values[k] || 0, u)) };
      }).sort(function (a, b) { return b.v - a.v; });
      squarify(items, 4, 24, s.w - 8, s.h - 30).forEach(function (r) {
        var ki = keyIdx[r.k];
        c.fillStyle = col(ki); c.globalAlpha = 0.85; c.fillRect(r.x, r.y, r.w - 2, r.h - 2); c.globalAlpha = 1;
        if (r.w > 44 && r.h > 28) {
          text(c, r.k, r.x + 6, r.y + 12, 12, "#0b1220", "left");
          text(c, Math.round(lerp(frames[i].values[r.k] || 0, frames[j].values[r.k] || 0, u)).toLocaleString("en-US"), r.x + 6, r.y + 27, 11, "#0b1220", "left");
        }
      });
    }, o);
  }

  /* #19 Animated Choropleth — d:{features:[{name, ring:[[lon,lat]..]} 或 {key, name, rings:[[...],...]}], frames:[{label,values:{key:v}}]}
   * v2：支援多環（真實行政區界，01_shared/geo/tw_towns_2021_rings.js）、key 對值、無資料區塗灰不標字（opt.empty）、opt.fitData 只以有值區定框 */
  function choropleth(cv, d, opt) {
    var o = opt || {}, b = [1e18, -1e18, 1e18, -1e18], lo = 1e18, hi = -1e18;
    function RS(f) { return f.rings || [f.ring]; }
    function KEY(f) { return f.key || f.name; }
    var keys = {}; d.frames.forEach(function (fr) { Object.keys(fr.values).forEach(function (k) { keys[k] = 1; }); });
    d.features.forEach(function (f) { if (o.fitData && !keys[KEY(f)]) return; RS(f).forEach(function (r) { r.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.max(b[1], p[0]); b[2] = Math.min(b[2], p[1]); b[3] = Math.max(b[3], p[1]); }); }); });
    d.frames.forEach(function (f) { Object.keys(f.values).forEach(function (k) { lo = Math.min(lo, f.values[k]); hi = Math.max(hi, f.values[k]); }); });
    if (o.min != null) lo = o.min; if (o.max != null) hi = o.max;
    return driver(d.frames.length, function (t) {
      var s = fit(cv), c = s.c, pad = 26, k0 = Math.cos((b[2] + b[3]) / 2 * Math.PI / 180), dx = (b[1] - b[0]) * k0, dy = b[3] - b[2];
      var sc = Math.min((s.w - 2 * pad - 60) / dx, (s.h - 2 * pad) / dy), ox = (s.w - 60 - dx * sc) / 2, oy = (s.h - dy * sc) / 2;
      function P(p) { return [ox + (p[0] - b[0]) * k0 * sc, s.h - oy - (p[1] - b[2]) * sc]; }
      var i = Math.min(Math.max(d.frames.length - 2, 0), Math.floor(t)), j = Math.min(d.frames.length - 1, i + 1), u = ease(Math.min(1, t - i));
      text(c, (o.title || "") + "　" + (u < 0.5 ? d.frames[i] : d.frames[j]).label, 12, 12, 12, DIM);
      var labels = []; c.save(); c.beginPath(); c.rect(0, 20, s.w - 52, s.h - 34); c.clip();
      d.features.forEach(function (f) {
        var a = d.frames[i].values[KEY(f)], a2 = d.frames[j].values[KEY(f)], has = a != null || a2 != null;
        var v = has ? lerp(a == null ? a2 : a, a2 == null ? a : a2, u) : 0, best = null, bn = -1;
        c.beginPath();
        RS(f).forEach(function (r) {
          var cx = 0, cy = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
          r.forEach(function (p, q) { var pp = P(p); q ? c.lineTo(pp[0], pp[1]) : c.moveTo(pp[0], pp[1]); cx += pp[0]; cy += pp[1]; x0 = Math.min(x0, pp[0]); x1 = Math.max(x1, pp[0]); y0 = Math.min(y0, pp[1]); y1 = Math.max(y1, pp[1]); });
          c.closePath(); var ar = (x1 - x0) * (y1 - y0); if (ar > bn) { bn = ar; best = [cx / r.length, cy / r.length]; }
        });
        c.fillStyle = has ? ramp((v - lo) / (hi - lo || 1)) : (o.empty || "#1e293b"); c.fill();
        c.strokeStyle = o.stroke || BG; c.lineWidth = o.lineWidth || 1.5; c.stroke();
        if (has && o.labels !== false && best) labels.push([f.label || f.name, v, best, bn]);
      });
      c.restore();
      /* v3 標籤避讓：面積大者先放原位；小區撞到就試 8 方向偏移＋引線；全撞只畫點（2026-11-03） */
      c.font = "10px sans-serif"; var placed = [], OFF = [[0, 0], [0, -22], [0, 22], [30, 0], [-30, 0], [26, -20], [-26, -20], [26, 20], [-26, 20], [0, -40], [0, 40], [48, 0], [-48, 0], [44, -36], [-44, -36], [44, 36], [-44, 36], [0, -58], [0, 58], [70, 0], [-70, 0], [64, -44], [-64, -44], [64, 44], [-64, 44]];
      function hit(r) { for (var q = 0; q < placed.length; q++) { var P2 = placed[q]; if (r[0] < P2[2] && r[2] > P2[0] && r[1] < P2[3] && r[3] > P2[1]) return true; } return r[0] < 0 || r[2] > s.w - 52 || r[1] < 20 || r[3] > s.h - 14; }
      labels.sort(function (A, B) { return B[3] - A[3]; }).forEach(function (L) {
        var vs = L[1].toFixed(o.dec == null ? 2 : o.dec), bw = Math.max(c.measureText(L[0]).width, c.measureText(vs).width) + 4, bh = 24, x = L[2][0], y = L[2][1], ok = null;
        for (var q = 0; q < OFF.length && !ok; q++) { var X = x + OFF[q][0], Y = y + OFF[q][1], r = [X - bw / 2, Y - bh / 2, X + bw / 2, Y + bh / 2]; if (!hit(r)) ok = [X, Y, r, q]; }
        if (!ok) { c.fillStyle = "#f8fafc"; c.beginPath(); c.arc(x, y, 2, 0, 7); c.fill(); return; }
        placed.push(ok[2]);
        if (ok[3]) { c.strokeStyle = "rgba(248,250,252,.55)"; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(ok[0], ok[1] + (ok[1] > y ? -bh / 2 : bh / 2)); c.stroke(); c.fillStyle = "#f8fafc"; c.beginPath(); c.arc(x, y, 1.8, 0, 7); c.fill(); c.fillStyle = "rgba(15,23,42,.72)"; c.fillRect(ok[2][0], ok[2][1], bw, bh); }
        text(c, L[0], ok[0], ok[1] - 6, 10, "#f8fafc", "center"); text(c, vs, ok[0], ok[1] + 7, 10, "#f8fafc", "center");
      });
      for (var g = 0; g < 80; g++) { c.fillStyle = ramp(1 - g / 79); c.fillRect(s.w - 40, 30 + g * 2.5, 14, 2.6); }
      text(c, hi.toFixed(2), s.w - 22, 24, 10, DIM, "center"); text(c, lo.toFixed(2), s.w - 22, 238, 10, DIM, "center");
      if (o.note) text(c, o.note, 12, s.h - 10, 10, DIM, "left");
    }, o);
  }

  /* #14 Network / Force-Directed — d:{nodes:[{id,w}], edges:[{s,t,w,neg}]}；力導向收斂＋邊上脈衝 */
  function network(cv, d, opt) {
    var o = opt || {}, N = d.nodes.length, pos = {}, vel = {}, alpha = 1, idx = {};
    d.nodes.forEach(function (n, i) { var a = i / N * 6.2832; pos[n.id] = [Math.cos(a) * 0.3, Math.sin(a) * 0.3]; vel[n.id] = [0, 0]; idx[n.id] = i; });
    var wmax = Math.max.apply(null, d.nodes.map(function (n) { return n.w; }));
    function step() {
      var ids = d.nodes.map(function (n) { return n.id; });
      ids.forEach(function (a) { ids.forEach(function (b) {
        if (a === b) return; var dx = pos[a][0] - pos[b][0], dy = pos[a][1] - pos[b][1], r2 = dx * dx + dy * dy + 0.001, f = 0.014 / r2;
        vel[a][0] += dx * f * alpha; vel[a][1] += dy * f * alpha; }); });
      d.edges.forEach(function (e) {
        var dx = pos[e.t][0] - pos[e.s][0], dy = pos[e.t][1] - pos[e.s][1], l = Math.sqrt(dx * dx + dy * dy) || 0.01, f = (l - 0.7 * (1.15 - e.w)) * 0.06 * alpha;
        vel[e.s][0] += dx / l * f; vel[e.s][1] += dy / l * f; vel[e.t][0] -= dx / l * f; vel[e.t][1] -= dy / l * f; });
      ids.forEach(function (a) { vel[a][0] -= pos[a][0] * 0.02 * alpha; vel[a][1] -= pos[a][1] * 0.02 * alpha; pos[a][0] += vel[a][0]; pos[a][1] += vel[a][1]; vel[a][0] *= 0.82; vel[a][1] *= 0.82; });
      alpha = Math.max(0.03, alpha * 0.985);
    }
    function cloneMap(m) {
      var out = {};
      for (var id in m) if (Object.prototype.hasOwnProperty.call(m, id)) out[id] = [m[id][0], m[id][1]];
      return out;
    }
    function saveSnap() { return { pos: cloneMap(pos), vel: cloneMap(vel), alpha: alpha }; }
    function loadSnap(sp) { pos = cloneMap(sp.pos); vel = cloneMap(sp.vel); alpha = sp.alpha; }
    var snaps = [saveSnap()];
    function seekTo(k) {
      if (k < snaps.length) { loadSnap(snaps[k]); return; }
      loadSnap(snaps[snaps.length - 1]);
      while (snaps.length <= k) { step(); snaps.push(saveSnap()); }
    }
    return driver(240, function (t) {
      var s = fit(cv), c = s.c; seekTo(Math.min(480, Math.max(0, 2 * Math.floor(t) + 2)));
      var sc0 = Math.min(s.w, s.h) * 0.42, sc = sc0, cx = s.w / 2, cy = s.h / 2, ph = t / 240;
      if (N) {
        var pad = 24, aw = Math.max(1, s.w - 2 * pad), ah = Math.max(1, s.h - 2 * pad);
        for (var it = 0; it < 3; it++) {
          var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          d.nodes.forEach(function (n) {
            var p = pos[n.id], r = 6 + Math.sqrt(n.w / wmax) * 14;
            minX = Math.min(minX, p[0] - r / sc); maxX = Math.max(maxX, p[0] + r / sc);
            minY = Math.min(minY, p[1] - (r + 20) / sc); maxY = Math.max(maxY, p[1] + r / sc);
          });
          var sc1 = Math.min(sc0, aw / Math.max(1e-6, maxX - minX), ah / Math.max(1e-6, maxY - minY));
          if (Math.abs(sc1 - sc) < 1e-4) { sc = sc1; break; }
          sc = sc1;
        }
        var bL = Infinity, bR = -Infinity, bT = Infinity, bB = -Infinity;
        d.nodes.forEach(function (n) {
          var p = pos[n.id], r = 6 + Math.sqrt(n.w / wmax) * 14;
          bL = Math.min(bL, p[0] * sc - r); bR = Math.max(bR, p[0] * sc + r);
          bT = Math.min(bT, p[1] * sc - r - 20); bB = Math.max(bB, p[1] * sc + r);
        });
        cx = s.w / 2 - (bL + bR) * 0.5;
        cy = s.h / 2 - (bT + bB) * 0.5;
      }
      function X(id) { return cx + pos[id][0] * sc; } function Y(id) { return cy + pos[id][1] * sc; }
      text(c, o.title || "", 12, 12, 12, DIM);
      d.edges.forEach(function (e, ei) {
        c.beginPath(); c.moveTo(X(e.s), Y(e.s)); c.lineTo(X(e.t), Y(e.t));
        c.strokeStyle = e.neg ? "#f43f5e" : "#38bdf8"; c.globalAlpha = 0.15 + 0.5 * e.w; c.lineWidth = 0.6 + 3 * e.w; c.stroke(); c.globalAlpha = 1;
        var u = (ph * 3 + ei * 0.21) % 1; c.beginPath(); c.arc(lerp(X(e.s), X(e.t), u), lerp(Y(e.s), Y(e.t), u), 2, 0, 6.2832); c.fillStyle = "#f8fafc"; c.fill();
      });
      d.nodes.forEach(function (n) {
        var r = 6 + Math.sqrt(n.w / wmax) * 14; c.beginPath(); c.arc(X(n.id), Y(n.id), r, 0, 6.2832); c.fillStyle = col(idx[n.id]); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
        text(c, n.id, X(n.id), Y(n.id) - r - 7, 10, FG, "center");
      });
      if (o.note) text(c, o.note, 12, s.h - 10, 10, DIM, "left");
    }, { fps: 30 });
  }


  /* ===== 第三批（v2-2026-11-03）：#3 Streamgraph、#11 Radar、#13 Chord、#16 Sunburst ===== */
  function fmtv(v, dec) { return (+v).toFixed(dec == null ? 1 : dec); }

  /* #3 Animated Area / Streamgraph — d:{x:[標籤], series:[{name, values:[n]}]}；opt.mode:"stream"(預設置中)|"stack" */
  function streamgraph(cv, d, opt) {
    var o = opt || {}, n = d.x.length, m = d.series.length, tot = [], mx = 0;
    for (var i = 0; i < n; i++) { var s0 = 0; for (var j = 0; j < m; j++) s0 += Math.max(0, d.series[j].values[i] || 0); tot.push(s0); mx = Math.max(mx, s0); }
    mx = mx || 1;
    return driver(n, function (t) {
      var s = fit(cv), c = s.c, ML = 14, MR = 96, MT = 24, MB = 24, W = s.w - ML - MR, H = s.h - MT - MB, stream = o.mode !== "stack";
      function sx(i) { return ML + W * i / Math.max(1, n - 1); }
      function base(i) { return stream ? MT + (H - tot[i] / mx * H) / 2 : MT + H - tot[i] / mx * H; }
      text(c, o.title || "", 12, 11, 12, DIM);
      for (var g2 = 0; g2 < n; g2 += Math.max(1, Math.round(n / 8))) text(c, d.x[g2], sx(g2), MT + H + 13, 10, DIM, "center");
      var k = Math.min(n - 1, Math.floor(t)), f = t - k, xe = k < n - 1 ? lerp(sx(k), sx(k + 1), f) : sx(k);
      c.save(); c.beginPath(); c.rect(ML - 1, 0, xe - ML + 2, s.h); c.clip();
      var acc = []; for (var a = 0; a < n; a++) acc.push(base(a));
      d.series.forEach(function (se, si) {
        var top = acc.slice(), bot = acc.map(function (y, q) { return y + Math.max(0, se.values[q] || 0) / mx * H; });
        c.beginPath(); c.moveTo(sx(0), top[0]);
        for (var q = 1; q < n; q++) { var xm = (sx(q - 1) + sx(q)) / 2; c.bezierCurveTo(xm, top[q - 1], xm, top[q], sx(q), top[q]); }
        c.lineTo(sx(n - 1), bot[n - 1]);
        for (var r = n - 2; r >= 0; r--) { var xm2 = (sx(r + 1) + sx(r)) / 2; c.bezierCurveTo(xm2, bot[r + 1], xm2, bot[r], sx(r), bot[r]); }
        c.closePath(); c.fillStyle = col(si); c.globalAlpha = 0.78; c.fill(); c.globalAlpha = 1;
        acc = bot;
      });
      c.restore();
      c.strokeStyle = "rgba(248,250,252,.5)"; c.beginPath(); c.moveTo(xe, MT); c.lineTo(xe, MT + H); c.stroke();
      var y0 = base(k);
      d.series.forEach(function (se, si) {
        var v0 = se.values[k] || 0, v1 = k < n - 1 ? se.values[k + 1] || 0 : v0, v = lerp(v0, v1, f), h = Math.max(0, v) / mx * H;
        text(c, se.name + " " + fmtv(v, o.dec), ML + W + 6, MT + 8 + si * 15, 10, col(si), "left");
        y0 += h;
      });
      text(c, d.x[k], xe, MT - 8, 10, FG, "center");
      if (o.note) text(c, o.note, 12, s.h - 6, 10, DIM, "left");
    }, o);
  }

  /* #11 Animated Radar — d:{axes:[軸名], max:數值或[每軸上限], frames:[{label, series:[{name, values:[同 axes 長度]}]}]} */
  function radar(cv, d, opt) {
    var o = opt || {}, A = d.axes.length, F = d.frames;
    function mxOf(i) { return Array.isArray(d.max) ? d.max[i] : (d.max || 1); }
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, cx = s.w / 2, cy = s.h / 2 + 10, R = Math.max(30, Math.min(s.w / 2 - 70, s.h / 2 - 36));
      var k = Math.min(F.length - 1, Math.floor(t)), f = ease(t - k), F0 = F[k], F1 = F[Math.min(F.length - 1, k + 1)];
      text(c, (o.title || "") + "　" + F0.label, 12, 11, 12, DIM);
      function P(i, u) { var ang = -Math.PI / 2 + i * 2 * Math.PI / A; return [cx + Math.cos(ang) * R * u, cy + Math.sin(ang) * R * u]; }
      c.strokeStyle = "#1e293b"; c.lineWidth = 1;
      for (var ring = 1; ring <= 4; ring++) { c.beginPath(); for (var i = 0; i <= A; i++) { var p = P(i % A, ring / 4); i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); } c.stroke(); }
      for (var i2 = 0; i2 < A; i2++) { var e = P(i2, 1), l = P(i2, 1.13); c.beginPath(); c.moveTo(cx, cy); c.lineTo(e[0], e[1]); c.stroke(); text(c, d.axes[i2], l[0], l[1], 10, FG, l[0] < cx - 4 ? "right" : l[0] > cx + 4 ? "left" : "center"); }
      F0.series.forEach(function (se, si) {
        var se1 = (F1.series[si] || se);
        c.beginPath();
        for (var q = 0; q <= A; q++) { var ax = q % A, v = lerp(se.values[ax], se1.values[ax], f), p2 = P(ax, Math.max(0, Math.min(1.05, v / mxOf(ax)))); q ? c.lineTo(p2[0], p2[1]) : c.moveTo(p2[0], p2[1]); }
        c.closePath(); c.fillStyle = col(si); c.globalAlpha = 0.22; c.fill(); c.globalAlpha = 1; c.strokeStyle = col(si); c.lineWidth = 2; c.stroke();
        text(c, "■ " + se.name, s.w - 12, 30 + si * 15, 10, col(si), "right");
      });
      if (o.note) text(c, o.note, 12, s.h - 10, 10, DIM, "left");
    }, o);
  }

  /* #13 Chord — d:{names:[N], frames:[{label, matrix:N×N（m[i][j]＝i→j）}]}；弧長＝流出＋流入，帶流向粒子 */
  function chord(cv, d, opt) {
    var o = opt || {}, N = d.names.length, F = d.frames, nf = F.length;
    return driver(nf, function (t) {
      var s = fit(cv), c = s.c, cx = s.w / 2, cy = s.h / 2 + 8, R = Math.max(30, Math.min(s.w, s.h) / 2 - 52), k = Math.min(nf - 1, Math.floor(t)), f = ease(t - k);
      var M0 = F[k].matrix, M1 = F[Math.min(nf - 1, k + 1)].matrix, M = [], gs = [], tot = 0, i, j;
      for (i = 0; i < N; i++) { M.push([]); for (j = 0; j < N; j++) M[i].push(i === j ? 0 : Math.max(0, lerp(M0[i][j], M1[i][j], f))); }
      for (i = 0; i < N; i++) { var g0 = 0; for (j = 0; j < N; j++) g0 += M[i][j] + M[j][i]; gs.push(g0); tot += g0; }
      tot = tot || 1;
      var gap = 0.05, span = 2 * Math.PI - gap * N, st = [], cur = -Math.PI / 2, outS = {}, inS = {};
      for (i = 0; i < N; i++) {
        st.push(cur); var a = cur;
        for (j = 0; j < N; j++) { var w = M[i][j] / tot * span; outS[i + "_" + j] = [a, a + w]; a += w; }
        for (j = 0; j < N; j++) { var w2 = M[j][i] / tot * span; inS[j + "_" + i] = [a, a + w2]; a += w2; }
        cur = a + gap;
      }
      text(c, (o.title || "") + "　" + F[k].label, 12, 11, 12, DIM);
      var ph = t / (o.fps || 1.5);
      function p(an, rr) { return [cx + Math.cos(an) * (rr || R), cy + Math.sin(an) * (rr || R)]; }
      for (i = 0; i < N; i++) for (j = 0; j < N; j++) {
        if (M[i][j] <= 0) continue;
        var A = outS[i + "_" + j], B = inS[i + "_" + j], A0 = p(A[0]), B0 = p(B[0]);
        c.beginPath(); c.moveTo(A0[0], A0[1]); c.arc(cx, cy, R, A[0], A[1]);
        c.quadraticCurveTo(cx, cy, B0[0], B0[1]); c.arc(cx, cy, R, B[0], B[1]); c.quadraticCurveTo(cx, cy, A0[0], A0[1]);
        c.fillStyle = col(i); c.globalAlpha = 0.32; c.fill(); c.globalAlpha = 1;
        var S = p((A[0] + A[1]) / 2), E = p((B[0] + B[1]) / 2), u = (ph * 0.45 + i * 0.13 + j * 0.07) % 1;
        var x = (1 - u) * (1 - u) * S[0] + 2 * (1 - u) * u * cx + u * u * E[0], y = (1 - u) * (1 - u) * S[1] + 2 * (1 - u) * u * cy + u * u * E[1];
        c.beginPath(); c.arc(x, y, 2.2, 0, 6.2832); c.fillStyle = "#f8fafc"; c.fill();
      }
      for (i = 0; i < N; i++) {
        var a0 = st[i], a1 = st[i] + gs[i] / tot * span; if (a1 - a0 <= 0) continue;
        c.beginPath(); c.arc(cx, cy, R + 10, a0, a1); c.arc(cx, cy, R + 2, a1, a0, true); c.closePath(); c.fillStyle = col(i); c.fill();
        var am = (a0 + a1) / 2, L = p(am, R + 18), ca = Math.cos(am);
        text(c, d.names[i], L[0], L[1], 10, FG, ca > 0.25 ? "left" : ca < -0.25 ? "right" : "center");
      }
      if (o.note) text(c, o.note, 12, s.h - 10, 10, DIM, "left");
    }, { fps: o.fps || 0.6, loop: o.loop, onTick: o.onTick });
  }

  /* #16 Sunburst — d:{x:[時間標籤], tree:{name, children:[{name, values:[n]} 或 {name, children}]}}；角度隨時間補間 */
  function sunburst(cv, d, opt) {
    var o = opt || {}, n = d.x.length;
    function val(nd, t) { if (nd.children) return nd.children.reduce(function (a, ch) { return a + val(ch, t); }, 0); var k = Math.min(n - 1, Math.floor(t)), f = t - k; return lerp(nd.values[k], nd.values[Math.min(n - 1, k + 1)], f); }
    function depth(nd) { return nd.children ? 1 + Math.max.apply(null, nd.children.map(depth)) : 0; }
    var D = depth(d.tree);
    return driver(n, function (t) {
      var s = fit(cv), c = s.c, cx = s.w / 2, cy = s.h / 2 + 8, R = Math.min(s.w, s.h) / 2 - 22, r0 = R * 0.22, ring = (R - r0) / Math.max(1, D), k = Math.min(n - 1, Math.floor(t));
      text(c, (o.title || "") + "　" + d.x[k], 12, 11, 12, DIM);
      var total = val(d.tree, t) || 1;
      c.beginPath(); c.arc(cx, cy, r0 - 2, 0, 6.2832); c.fillStyle = "#111a2e"; c.fill();
      text(c, d.tree.name, cx, cy - 7, 11, FG, "center"); text(c, fmtv(total, o.dec), cx, cy + 9, 11, DIM, "center");
      function draw(nd, a0, a1, lv, ci) {
        if (!nd.children) return;
        var cur = a0, sum = val(nd, t) || 1;
        nd.children.forEach(function (ch, idx) {
          var v = val(ch, t), a = (a1 - a0) * v / sum, cc = lv === 0 ? col(idx) : mix(col(ci), "#f8fafc", Math.min(0.55, 0.12 + idx * 0.1));
          var ri = r0 + lv * ring, ro = ri + ring - 2;
          if (a > 0.002) {
            c.beginPath(); c.arc(cx, cy, ro, cur, cur + a); c.arc(cx, cy, ri, cur + a, cur, true); c.closePath(); c.fillStyle = cc; c.globalAlpha = 0.9 - lv * 0.12; c.fill(); c.globalAlpha = 1;
            c.strokeStyle = BG; c.lineWidth = 1; c.stroke();
            if (a * (ri + ro) / 2 > 34) { var am = cur + a / 2, rm = (ri + ro) / 2; text(c, ch.name, cx + Math.cos(am) * rm, cy + Math.sin(am) * rm, 10, "#0b1220", "center"); }
          }
          draw(ch, cur, cur + a, lv + 1, lv === 0 ? idx : ci);
          cur += a;
        });
      }
      draw(d.tree, -Math.PI / 2, Math.PI * 1.5, 0, 0);
      if (o.note) text(c, o.note, 12, s.h - 10, 10, DIM, "left");
    }, o);
  }

  /* ===== v3 第 1 批台灣資料（2026-11-03）：#24 Gauge／#4 Donut／#5 Histogram／#18 Box ===== */
  function fr(frames, t) { var n = frames.length, k = Math.min(n - 1, Math.floor(t)), u = ease(t - k); return { k: k, k2: Math.min(n - 1, k + 1), u: k < n - 1 ? u : 0 }; }
  /* #24 Gauge — d:{frames:[{label,value,low?,high?,n?}]}；opt:{min,max,bands:[[到值,色]],unit,pct} */
  function gauge(cv, d, opt) {
    var o = opt || {}, F = d.frames, mn = o.min == null ? 0 : o.min, mx = o.max == null ? 1 : o.max;
    var bands = o.bands || [[0.2, "#f43f5e"], [0.8, "#10b981"], [1, "#f59e0b"]];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2], v = lerp(A.value, B.value, p.u);
      var cx = s.w / 2, cy = s.h * 0.56, R = Math.min(s.w * 0.36, s.h * 0.4), a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
      function ang(x) { return a0 + (a1 - a0) * Math.max(0, Math.min(1, (x - mn) / (mx - mn))); }
      text(c, (o.title || "") + "　" + A.label, 12, 11, 12, DIM);
      var prev = mn; bands.forEach(function (b) {
        c.beginPath(); c.arc(cx, cy, R, ang(prev), ang(b[0])); c.strokeStyle = b[1]; c.globalAlpha = 0.28; c.lineWidth = R * 0.16; c.stroke(); c.globalAlpha = 1; prev = b[0];
      });
      var bc = bands[bands.length - 1][1]; for (var i = 0; i < bands.length; i++) if (v <= bands[i][0]) { bc = bands[i][1]; break; }
      c.beginPath(); c.arc(cx, cy, R, a0, ang(v)); c.strokeStyle = bc; c.lineWidth = R * 0.16; c.lineCap = "round"; c.stroke(); c.lineCap = "butt";
      for (var g2 = 0; g2 <= 10; g2++) { var ag = a0 + (a1 - a0) * g2 / 10, r1 = R - R * 0.14, r2 = R - R * (g2 % 5 ? 0.2 : 0.26);
        c.beginPath(); c.moveTo(cx + Math.cos(ag) * r1, cy + Math.sin(ag) * r1); c.lineTo(cx + Math.cos(ag) * r2, cy + Math.sin(ag) * r2); c.strokeStyle = DIM; c.lineWidth = 1; c.stroke(); }
      var an = ang(v); c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(an) * R * 0.78, cy + Math.sin(an) * R * 0.78); c.strokeStyle = FG; c.lineWidth = 2.5; c.stroke();
      c.beginPath(); c.arc(cx, cy, 5, 0, 6.2832); c.fillStyle = FG; c.fill();
      var big = o.pct === false ? fmtv(v, o.dec) : (v * 100).toFixed(o.dec == null ? 1 : o.dec) + "%";
      text(c, big, cx, cy + R * 0.42, Math.max(16, Math.round(R * 0.3)), bc, "center");
      if (o.unit) text(c, o.unit, cx, cy + R * 0.42 + Math.max(14, R * 0.24), 11, DIM, "center");
      if (A.low != null) text(c, "缺車站 " + A.low + "／滿位站 " + A.high + "（共 " + A.n + "）", cx, s.h - 12, 10, DIM, "center");
      text(c, o.pct === false ? fmtv(mn, 0) : Math.round(mn * 100) + "%", cx + Math.cos(a0) * R, cy + Math.sin(a0) * R + 16, 10, DIM, "center");
      text(c, o.pct === false ? fmtv(mx, 0) : Math.round(mx * 100) + "%", cx + Math.cos(a1) * R, cy + Math.sin(a1) * R + 16, 10, DIM, "center");
    }, o);
  }
  /* #4 Pie / Donut — d:{frames:[{label,values:{類別:數值}}]}；扇區角度隨時間補間 */
  function donut(cv, d, opt) {
    var o = opt || {}, F = d.frames, keys = [];
    F.forEach(function (f) { Object.keys(f.values).forEach(function (k) { if (keys.indexOf(k) < 0) keys.push(k); }); });
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var vs = keys.map(function (k) { return lerp(A.values[k] || 0, B.values[k] || 0, p.u); }), tot = vs.reduce(function (a, b) { return a + b; }, 0) || 1;
      var leg = s.w > 360, cx = leg ? s.w * 0.36 : s.w / 2, cy = s.h / 2 + 8, R = Math.min(leg ? s.w * 0.3 : s.w / 2, s.h / 2) - 22, r0 = R * (o.hole == null ? 0.58 : o.hole);
      text(c, (o.title || "") + "　" + A.label, 12, 11, 12, DIM);
      var cur = -Math.PI / 2;
      vs.forEach(function (v, i) {
        var a = 6.2832 * v / tot; if (a <= 0) return;
        c.beginPath(); c.arc(cx, cy, R, cur, cur + a); c.arc(cx, cy, r0, cur + a, cur, true); c.closePath(); c.fillStyle = col(i); c.fill(); c.strokeStyle = BG; c.lineWidth = 1.5; c.stroke();
        if (a > 0.32) { var am = cur + a / 2, rm = (R + r0) / 2; text(c, Math.round(100 * v / tot) + "%", cx + Math.cos(am) * rm, cy + Math.sin(am) * rm, 10, "#0b1220", "center"); }
        cur += a;
      });
      text(c, fmtv(tot, 0), cx, cy - 6, 15, FG, "center"); text(c, o.unit || "合計", cx, cy + 11, 10, DIM, "center");
      if (leg) keys.forEach(function (k, i) {
        var y = cy - keys.length * 9 + i * 18; c.fillStyle = col(i); c.fillRect(s.w * 0.7, y - 5, 10, 10);
        text(c, (o.short ? o.short(k) : k) + " " + Math.round(vs[i]), s.w * 0.7 + 15, y, 10, FG, "left");
      });
      if (o.note) text(c, o.note, 12, s.h - 10, 10, DIM, "left");
    }, o);
  }
  /* #5 Histogram — d:{frames:[{label,values:[原始數值]}]}；opt:{min,max,bins,unit,mark:[閾值]} */
  function histogram(cv, d, opt) {
    var o = opt || {}, F = d.frames, lo = o.min, hi = o.max;
    if (lo == null || hi == null) { var a = 1e18, b = -1e18; F.forEach(function (f) { f.values.forEach(function (v) { a = Math.min(a, v); b = Math.max(b, v); }); }); if (lo == null) lo = Math.floor(a); if (hi == null) hi = Math.ceil(b); }
    var nb = o.bins || 18, w = (hi - lo) / nb;
    var H = F.map(function (f) { var h = []; for (var i = 0; i < nb; i++) h.push(0); f.values.forEach(function (v) { h[Math.max(0, Math.min(nb - 1, Math.floor((v - lo) / w)))]++; }); return h; });
    var ymax = 0; H.forEach(function (h) { h.forEach(function (v) { ymax = Math.max(ymax, v); }); });
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), ML = 36, MR = 12, MT = 26, MB = 36, W = s.w - ML - MR, Hh = s.h - MT - MB, A = F[p.k];
      text(c, (o.title || "") + "　" + A.label, 12, 11, 12, DIM);
      c.strokeStyle = "#1e293b"; c.lineWidth = 1;
      for (var g = 0; g <= 4; g++) { var gy = MT + Hh * g / 4; c.beginPath(); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke(); text(c, Math.round(ymax * (1 - g / 4)), ML - 5, gy, 9, DIM, "right"); }
      var sum = 0, cnt = 0, bw = W / nb;
      for (var i = 0; i < nb; i++) {
        var v = lerp(H[p.k][i], H[p.k2][i], p.u), bh = Hh * v / (ymax || 1), mid = lo + w * (i + 0.5);
        c.fillStyle = ramp(0.25 + 0.75 * i / (nb - 1)); c.fillRect(ML + i * bw + 1, MT + Hh - bh, bw - 2, bh);
        sum += mid * v; cnt += v;
        if (i % Math.ceil(nb / 6) === 0 && i < nb - 2) text(c, fmtv(lo + w * i, 0), ML + i * bw, MT + Hh + 12, 9, DIM, "center");
      }
      text(c, fmtv(hi, 0) + (o.unit || ""), ML + W, MT + Hh + 12, 9, DIM, "right");
      var mu = sum / (cnt || 1), mx = ML + (mu - lo) / (hi - lo) * W;
      c.setLineDash([4, 3]); c.strokeStyle = "#f8fafc"; c.beginPath(); c.moveTo(mx, MT); c.lineTo(mx, MT + Hh); c.stroke(); c.setLineDash([]);
      text(c, "平均 " + fmtv(mu, 1) + (o.unit || "") + "　n=" + Math.round(cnt), Math.min(mx + 5, ML + W - 110), MT + 6, 10, FG, "left");
      (o.mark || []).forEach(function (m) { var x = ML + (m - lo) / (hi - lo) * W; c.strokeStyle = "rgba(244,63,94,.6)"; c.beginPath(); c.moveTo(x, MT + 12); c.lineTo(x, MT + Hh); c.stroke(); });
      if (o.note) text(c, o.note, 12, s.h - 7, 9, DIM, "left");
    }, o);
  }
  /* #18 Box Plot — d:{groups:[名], frames:[{label, stats:[{lo,q1,med,q3,hi,n}|null]}]}；五數隨時間補間 */
  function boxPlot(cv, d, opt) {
    var o = opt || {}, F = d.frames, G = d.groups, lo = 1e18, hi = -1e18;
    F.forEach(function (f) { f.stats.forEach(function (q) { if (q) { lo = Math.min(lo, q.lo); hi = Math.max(hi, q.hi); } }); });
    if (o.min != null) lo = o.min; if (o.max != null) hi = o.max;
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), ML = 34, MR = 10, MT = 26, MB = 34, W = s.w - ML - MR, H = s.h - MT - MB, A = F[p.k], B = F[p.k2];
      function sy(v) { return MT + H - (v - lo) / (hi - lo) * H; }
      text(c, (o.title || "") + "　" + A.label, 12, 11, 12, DIM);
      c.strokeStyle = "#1e293b"; c.lineWidth = 1;
      for (var g = 0; g <= 4; g++) { var v = lerp(hi, lo, g / 4), gy = sy(v); c.beginPath(); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke(); text(c, fmtv(v, 0), ML - 5, gy, 9, DIM, "right"); }
      var bw = W / G.length;
      G.forEach(function (gname, i) {
        var a = A.stats[i], b = B.stats[i] || a; if (!a) return;
        function L(k) { return lerp(a[k], b[k], p.u); }
        var x = ML + bw * (i + 0.5), hw = Math.max(3, bw * 0.32), cc = ramp(0.3 + 0.7 * (L("med") - lo) / (hi - lo));
        c.strokeStyle = DIM; c.beginPath(); c.moveTo(x, sy(L("lo"))); c.lineTo(x, sy(L("q1"))); c.moveTo(x, sy(L("q3"))); c.lineTo(x, sy(L("hi")));
        c.moveTo(x - hw / 2, sy(L("lo"))); c.lineTo(x + hw / 2, sy(L("lo"))); c.moveTo(x - hw / 2, sy(L("hi"))); c.lineTo(x + hw / 2, sy(L("hi"))); c.stroke();
        c.fillStyle = cc; c.globalAlpha = 0.85; c.fillRect(x - hw, sy(L("q3")), hw * 2, Math.max(1, sy(L("q1")) - sy(L("q3")))); c.globalAlpha = 1;
        c.strokeStyle = "#f8fafc"; c.lineWidth = 2; c.beginPath(); c.moveTo(x - hw, sy(L("med"))); c.lineTo(x + hw, sy(L("med"))); c.stroke(); c.lineWidth = 1;
        var nm = o.short ? o.short(gname) : gname;
        c.save(); c.translate(x, MT + H + 6); c.rotate(G.length > 8 ? -0.9 : 0); text(c, nm, 0, 4, 9, DIM, G.length > 8 ? "right" : "center"); c.restore();
      });
      if (o.note) text(c, o.note, s.w - 10, 11, 9, DIM, "right");
    }, o);
  }

    /* ===== v4 第 5 批（待實作 12 型全部上線）：2026-11-03 ===== */

  /* #6 Waterfall — d:{frames:[{label, base, items:[{name, delta}], end}]}；各區增減項目 */
  function waterfall(cv, d, opt) {
    var o = opt || {}, F = d.frames, lo = 1e18, hi = -1e18;
    F.forEach(function (f) {
      var b = f.base != null ? f.base : (f.start || 0), e = f.end != null ? f.end : b;
      lo = Math.min(lo, b, e); hi = Math.max(hi, b, e);
      var cur = b;
      (f.items || f.steps || []).forEach(function (it) {
        var dv = it.delta != null ? it.delta : (it.v || 0);
        cur += dv; lo = Math.min(lo, cur); hi = Math.max(hi, cur);
      });
    });
    var pad = Math.max(1, (hi - lo) * 0.12); lo -= pad; hi += pad;
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var ML = 42, MR = 14, MT = 28, MB = 36, W = s.w - ML - MR, H = s.h - MT - MB;
      function sy(v) { return MT + H - (v - lo) / (hi - lo) * H; }
      text(c, (o.title || "全市可借車起訖與行政區增減") + "　" + A.label, 12, 12, 12, DIM);
      c.strokeStyle = "#1e293b"; c.lineWidth = 1;
      for (var g = 0; g <= 4; g++) {
        var v = lerp(hi, lo, g / 4), gy = sy(v);
        c.beginPath(); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke();
        text(c, fmtv(v, 0), ML - 6, gy, 9, DIM, "right");
      }
      var aItems = A.items || A.steps || [], bItems = B.items || B.steps || [];
      var n = aItems.length + 2, bw = W / n;
      var curStart = lerp(A.base != null ? A.base : A.start, B.base != null ? B.base : B.start, p.u);
      var bars = [{ name: "起點", a: lo, b: curStart, c: "#38bdf8", dv: null }];
      var prev = curStart;
      aItems.forEach(function (it, i) {
        var b_it = bItems[i] || it;
        var dv = lerp(it.delta != null ? it.delta : it.v, b_it.delta != null ? b_it.delta : b_it.v, p.u);
        bars.push({ name: it.name, a: prev, b: prev + dv, c: dv >= 0 ? "#10b981" : "#f43f5e", dv: dv });
        prev += dv;
      });
      var curEnd = lerp(A.end != null ? A.end : prev, B.end != null ? B.end : prev, p.u);
      bars.push({ name: "終點", a: lo, b: curEnd, c: "#a78bfa", dv: null });

      bars.forEach(function (bar, i) {
        var bx = ML + bw * i + bw * 0.12, bw_act = bw * 0.76;
        var y1 = sy(Math.max(bar.a, bar.b)), y2 = sy(Math.min(bar.a, bar.b));
        var bh = Math.max(2, y2 - y1);
        c.fillStyle = bar.c; c.globalAlpha = 0.88;
        c.fillRect(bx, y1, bw_act, bh); c.globalAlpha = 1;
        if (i < bars.length - 1) {
          var connY = sy(bar.b);
          c.strokeStyle = DIM; c.setLineDash([2, 2]);
          c.beginPath(); c.moveTo(bx + bw_act, connY); c.lineTo(bx + bw, connY); c.stroke();
          c.setLineDash([]);
        }
        var valStr = bar.dv != null ? (bar.dv > 0 ? "+" : "") + fmtv(bar.dv, 0) : fmtv(bar.b, 0);
        text(c, valStr, bx + bw_act / 2, y1 - 6, 9, FG, "center");
        c.save(); c.translate(bx + bw_act / 2, MT + H + 8);
        c.rotate(n > 7 ? -0.65 : 0);
        text(c, bar.name, 0, 4, 9, DIM, n > 7 ? "right" : "center");
        c.restore();
      });
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #7 Funnel — d:{stages:[階段名], frames:[{label, countries:[{name, values:[v]}]}]}；漏斗各階段轉換 */
  function funnel(cv, d, opt) {
    var o = opt || {}, F = d.frames, stages = d.stages || ["上網族群", "商品查詢", "線上購物", "跨境網購"];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var ML = 16, MR = 16, MT = 28, MB = 20, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "數位經濟使用漏斗") + "　" + A.label, 12, 12, 12, DIM);
      var countriesA = A.countries || [], countriesB = B.countries || countriesA;
      var c0A = countriesA[0] || { values: [90, 75, 60, 30] }, c0B = countriesB[0] || c0A;
      var vals = stages.map(function (_, si) {
        return lerp(c0A.values[si] || 0, c0B.values[si] || 0, p.u);
      });
      var maxV = 100, sh = (H - (stages.length - 1) * 6) / stages.length;
      var cx = ML + W * 0.42;
      stages.forEach(function (stName, i) {
        var curV = vals[i], nextV = i < stages.length - 1 ? vals[i + 1] : curV * 0.75;
        var wTop = (curV / maxV) * (W * 0.65);
        var wBot = (nextV / maxV) * (W * 0.65);
        var yTop = MT + i * (sh + 6);
        var yBot = yTop + sh;
        c.beginPath();
        c.moveTo(cx - wTop / 2, yTop); c.lineTo(cx + wTop / 2, yTop);
        c.lineTo(cx + wBot / 2, yBot); c.lineTo(cx - wBot / 2, yBot);
        c.closePath();
        c.fillStyle = col(i); c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
        c.strokeStyle = BG; c.lineWidth = 1.5; c.stroke();
        text(c, stName + " " + fmtv(curV, 0) + "%", cx, yTop + sh / 2, Math.min(12, Math.max(9, s.w / 40)), "#0b1220", "center");
        if (i > 0) {
          var conv = curV / (vals[i - 1] || 1) * 100;
          text(c, "轉換 " + fmtv(conv, 0) + "%", cx + wTop / 2 + 10, yTop, 9, DIM, "left");
        }
      });
      // Right side country comparisons if space allows
      if (s.w > 380 && countriesA.length > 1) {
        var rx = ML + W * 0.76;
        text(c, "主要經濟體對比", rx, MT + 4, 10, FG, "left");
        countriesA.slice(0, 5).forEach(function (ct, ci) {
          var ctB = countriesB[ci] || ct;
          var endVal = lerp(ct.values[ct.values.length - 1] || 0, ctB.values[ctB.values.length - 1] || 0, p.u);
          var cy_pos = MT + 24 + ci * 20;
          c.fillStyle = col(ci + 2);
          c.fillRect(rx, cy_pos - 4, 8, 8);
          text(c, ct.name.split(" ")[0] + " " + fmtv(endVal, 0) + "%", rx + 14, cy_pos, 9, FG, "left");
        });
      }
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #9 Animated Scatter — d:{categories:[類別], frames:[{label, points:[{x, y, cat, name}]}]} */
  function scatter(cv, d, opt) {
    var o = opt || {}, F = d.frames, mx = 0, my = 0;
    F.forEach(function (f) {
      var pts = f.points || f.pts || [];
      pts.forEach(function (q) { mx = Math.max(mx, q.x); my = Math.max(my, q.y); });
    });
    mx = Math.max(10, Math.ceil(mx * 1.08)); my = Math.max(1, my > 1 ? Math.ceil(my * 1.08) : 1);
    var cats = d.categories || [];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var ML = 42, MR = 14, MT = 28, MB = 32, W = s.w - ML - MR, H = s.h - MT - MB;
      function sx(v) { return ML + v / mx * W; }
      function sy(v) { return MT + H - v / my * H; }
      text(c, (o.title || "站點容量 × 滿載率") + "　" + A.label, 12, 12, 12, DIM);
      c.strokeStyle = "#1e293b"; c.lineWidth = 1;
      for (var g = 0; g <= 4; g++) {
        var gy = MT + H * g / 4, gx = ML + W * g / 4;
        c.beginPath(); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke();
        c.beginPath(); c.moveTo(gx, MT); c.lineTo(gx, MT + H); c.stroke();
        text(c, my <= 1 ? (my * (1 - g / 4) * 100).toFixed(0) + "%" : fmtv(my * (1 - g / 4), 0), ML - 6, gy, 9, DIM, "right");
        text(c, fmtv(mx * g / 4, 0), gx, MT + H + 12, 9, DIM, "center");
      }
      text(c, o.xlab || "車柱容量 (x)", ML + W, MT + H + 22, 9, DIM, "right");
      text(c, o.ylab || "滿載率 (y)", ML + 4, MT + 6, 9, DIM, "left");

      var aPts = A.points || A.pts || [], bPts = B.points || B.pts || aPts;
      for (var i = 0; i < aPts.length; i++) {
        var a = aPts[i], b = bPts[i] || a;
        var px = lerp(a.x, b.x, p.u), py = lerp(a.y, b.y, p.u);
        var ci = cats.indexOf(a.cat);
        var pcol = ci >= 0 ? col(ci) : (a.r != null ? ramp(0.3 + 0.7 * a.r) : "#38bdf8");
        c.beginPath(); c.arc(sx(px), sy(py), s.w > 500 ? 4.5 : 3.2, 0, 6.2832);
        c.fillStyle = pcol; c.globalAlpha = 0.85; c.fill();
        c.strokeStyle = BG; c.lineWidth = 1; c.stroke();
        c.globalAlpha = 1;
      }
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #17 Parallel Coordinates — d:{dimensions:[{key,name,min,max}], items:[{name,values:[]}], frames:[{label,highlight}]} */
  function parallel(cv, d, opt) {
    var o = opt || {}, dims = d.dimensions || [], items = d.items || [], F = d.frames || [];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k];
      var ML = 38, MR = 24, MT = 34, MB = 30, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "OECD 國家多維福祉指標") + "　焦點：" + (A.highlight || A.label || ""), 12, 12, 12, DIM);
      var dx = W / Math.max(1, dims.length - 1);
      // Draw vertical dimension axes
      dims.forEach(function (dm, di) {
        var x = ML + di * dx;
        c.strokeStyle = "#334155"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(x, MT); c.lineTo(x, MT + H); c.stroke();
        text(c, dm.name, x, MT - 10, 9, FG, "center");
        text(c, fmtv(dm.max, 0), x, MT + 4, 8, DIM, "center");
        text(c, fmtv(dm.min, 0), x, MT + H - 4, 8, DIM, "center");
      });
      function getY(dm, val) {
        var span = Math.max(1e-4, dm.max - dm.min);
        return MT + H - Math.max(0, Math.min(1, (val - dm.min) / span)) * H;
      }
      // Draw background items (thin)
      items.forEach(function (it) {
        var isHl = it.name === A.highlight;
        if (isHl) return;
        c.beginPath();
        dims.forEach(function (dm, di) {
          var x = ML + di * dx, y = getY(dm, it.values[di]);
          if (di === 0) c.moveTo(x, y); else c.lineTo(x, y);
        });
        c.strokeStyle = "#475569"; c.globalAlpha = 0.35; c.lineWidth = 1; c.stroke();
      });
      c.globalAlpha = 1;
      // Draw highlighted item
      items.forEach(function (it, idx) {
        var isHl = it.name === A.highlight;
        if (!isHl) return;
        c.beginPath();
        dims.forEach(function (dm, di) {
          var x = ML + di * dx, y = getY(dm, it.values[di]);
          if (di === 0) c.moveTo(x, y); else c.lineTo(x, y);
        });
        c.strokeStyle = "#38bdf8"; c.lineWidth = 2.5; c.stroke();
        // Markers and labels
        dims.forEach(function (dm, di) {
          var x = ML + di * dx, y = getY(dm, it.values[di]);
          c.beginPath(); c.arc(x, y, 4, 0, 6.2832);
          c.fillStyle = "#38bdf8"; c.fill();
          c.strokeStyle = BG; c.lineWidth = 1.5; c.stroke();
          text(c, fmtv(it.values[di], 1), x + 6, y - 6, 9, FG, "left");
        });
        text(c, "● " + it.name, ML + W - 4, MT + 12, 11, "#38bdf8", "right");
      });
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #21 Trajectory — d:{bbox:[minX,minY,maxX,maxY], frames:[{label, ships:[{id,name,x,y,sog,cog,trail:[[x,y]]}]}]} */
  function trajectory(cv, d, opt) {
    var o = opt || {}, F = d.frames, bb = d.bbox || [-75, 40, -65, 45];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var ML = 24, MR = 14, MT = 28, MB = 24, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "NOAA AIS 船舶港區航跡") + "　" + A.label, 12, 12, 12, DIM);
      function sx(lon) { return ML + (lon - bb[0]) / Math.max(1e-4, bb[2] - bb[0]) * W; }
      function sy(lat) { return MT + H - (lat - bb[1]) / Math.max(1e-4, bb[3] - bb[1]) * H; }
      // Nautical grid lines
      c.strokeStyle = "#162032"; c.lineWidth = 1;
      for (var gi = 0; gi <= 4; gi++) {
        var gy = MT + H * gi / 4, gx = ML + W * gi / 4;
        c.beginPath(); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke();
        c.beginPath(); c.moveTo(gx, MT); c.lineTo(gx, MT + H); c.stroke();
      }
      var shipsA = A.ships || [], shipsB = B.ships || shipsA;
      shipsA.forEach(function (sh, si) {
        var shB = shipsB[si] || sh;
        var cx = lerp(sh.x, shB.x, p.u), cy = lerp(sh.y, shB.y, p.u);
        var px = sx(cx), py = sy(cy);
        var scol = col(si);
        // Draw trailing path
        if (sh.trail && sh.trail.length > 1) {
          c.beginPath();
          sh.trail.forEach(function (tp, ti) {
            var tx = sx(tp[0]), ty = sy(tp[1]);
            if (ti === 0) c.moveTo(tx, ty); else c.lineTo(tx, ty);
          });
          c.lineTo(px, py);
          c.strokeStyle = scol; c.globalAlpha = 0.45; c.lineWidth = 1.5; c.stroke();
          c.globalAlpha = 1;
        }
        // Draw vessel triangle pointing cog
        var rad = (sh.cog || 0) * Math.PI / 180;
        c.save(); c.translate(px, py); c.rotate(rad);
        c.beginPath(); c.moveTo(0, -6); c.lineTo(4, 5); c.lineTo(-4, 5); c.closePath();
        c.fillStyle = scol; c.fill();
        c.strokeStyle = "#ffffff"; c.lineWidth = 1; c.stroke();
        c.restore();
        if (s.w > 420 && si % 3 === 0) {
          text(c, sh.name.slice(0, 10), px + 7, py - 4, 8, DIM, "left");
        }
      });
      text(c, "⚓ 活動船舶: " + shipsA.length + " 艘", ML + 8, MT + H - 8, 9, "#38bdf8", "left");
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #22 3D Globe Arcs — d:{routes:[{from,to,fromName,toName,fromCoord:[lon,lat],toCoord:[lon,lat],vol}], frames:[{label,angle}]} */
  function globeArcs(cv, d, opt) {
    var o = opt || {}, routes = d.routes || [], F = d.frames || [{ label: "00:00", angle: 0 }];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var baseAng = lerp(A.angle != null ? A.angle : p.k * 15, B.angle != null ? B.angle : p.k2 * 15, p.u);
      var rot = (baseAng + t * 4) * Math.PI / 180;
      var R = Math.min(s.w, s.h) * 0.38;
      var cx = s.w / 2, cy = s.h / 2 + 6;
      text(c, (o.title || "全球前 20 大樞紐航線客運量") + "　" + A.label, 12, 12, 12, DIM);

      // Globe sphere ocean background
      var grad = c.createRadialGradient(cx - R * 0.3, cy - R * 0.3, R * 0.1, cx, cy, R);
      grad.addColorStop(0, "#1e3a8a"); grad.addColorStop(0.7, "#0f172a"); grad.addColorStop(1, "#020617");
      c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fillStyle = grad; c.fill();
      c.strokeStyle = "#38bdf8"; c.lineWidth = 1.2; c.stroke();

      // 3D Orthographic projection helper
      function project(lon, lat, alt) {
        var radLat = lat * Math.PI / 180, radLon = lon * Math.PI / 180 + rot;
        var rEff = R * (1 + (alt || 0));
        var x3 = Math.cos(radLat) * Math.sin(radLon);
        var y3 = -Math.sin(radLat);
        var z3 = Math.cos(radLat) * Math.cos(radLon);
        return { x: cx + x3 * rEff, y: cy + y3 * rEff, z: z3, vis: z3 > -0.05 };
      }

      // Graticule parallels & meridians
      c.strokeStyle = "#1e293b"; c.lineWidth = 0.8;
      for (var latG = -60; latG <= 60; latG += 30) {
        c.beginPath();
        for (var lonG = 0; lonG <= 360; lonG += 10) {
          var pt = project(lonG, latG, 0);
          if (pt.vis) {
            if (lonG === 0) c.moveTo(pt.x, pt.y); else c.lineTo(pt.x, pt.y);
          } else c.moveTo(pt.x, pt.y);
        }
        c.stroke();
      }

      // Draw Great Circle Arcs
      routes.forEach(function (rt, ri) {
        var p1 = project(rt.fromCoord[0], rt.fromCoord[1], 0);
        var p2 = project(rt.toCoord[0], rt.toCoord[1], 0);
        var rcol = col(ri);
        c.beginPath();
        var steps = 24, allVis = false;
        for (var st = 0; st <= steps; st++) {
          var frac = st / steps;
          // Interpolate lon lat
          var curLon = lerp(rt.fromCoord[0], rt.toCoord[0], frac);
          var curLat = lerp(rt.fromCoord[1], rt.toCoord[1], frac);
          // Parabolic altitude
          var alt = Math.sin(frac * Math.PI) * 0.22;
          var pt = project(curLon, curLat, alt);
          if (pt.vis) allVis = true;
          if (st === 0) c.moveTo(pt.x, pt.y); else c.lineTo(pt.x, pt.y);
        }
        if (allVis) {
          c.strokeStyle = rcol; c.globalAlpha = 0.65; c.lineWidth = 1.6; c.stroke();
          // Animated traveling flight dot
          var fpos = (t * 0.25 + ri * 0.15) % 1.0;
          var dLon = lerp(rt.fromCoord[0], rt.toCoord[0], fpos);
          var dLat = lerp(rt.fromCoord[1], rt.toCoord[1], fpos);
          var dPt = project(dLon, dLat, Math.sin(fpos * Math.PI) * 0.22);
          if (dPt.vis) {
            c.beginPath(); c.arc(dPt.x, dPt.y, 3, 0, 6.2832);
            c.fillStyle = "#ffffff"; c.globalAlpha = 0.95; c.fill();
          }
        }
        c.globalAlpha = 1;
        // Draw airport dots if visible
        if (p1.vis) {
          c.beginPath(); c.arc(p1.x, p1.y, 3, 0, 6.2832);
          c.fillStyle = "#10b981"; c.fill();
        }
        if (p2.vis) {
          c.beginPath(); c.arc(p2.x, p2.y, 3, 0, 6.2832);
          c.fillStyle = "#f43f5e"; c.fill();
        }
      });
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #23 Dot Density — d:{frames:[{label, events:[{lon,lat,mag,depth,place}]}]}；地震點事件波紋淡出 */
  function dotDensity(cv, d, opt) {
    var o = opt || {}, F = d.frames;
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var ML = 20, MR = 14, MT = 28, MB = 20, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "USGS 全球規模 4.0+ 地震分佈") + "　" + A.label, 12, 12, 12, DIM);
      function sx(lon) { return ML + (lon + 180) / 360 * W; }
      function sy(lat) { return MT + (90 - lat) / 180 * H; }
      // World grid
      c.strokeStyle = "#162032"; c.lineWidth = 0.8;
      for (var latG = -60; latG <= 60; latG += 30) {
        var gy = sy(latG); c.beginPath(); c.moveTo(ML, gy); c.lineTo(ML + W, gy); c.stroke();
      }
      for (var lonG = -120; lonG <= 120; lonG += 60) {
        var gx = sx(lonG); c.beginPath(); c.moveTo(gx, MT); c.lineTo(gx, MT + H); c.stroke();
      }
      // Draw previous frames dots faded
      var k0 = Math.max(0, p.k - 3);
      for (var kx = k0; kx < p.k; kx++) {
        var histEv = F[kx].events || [];
        var alpha = 0.15 * (1 - (p.k - kx) / 4);
        histEv.forEach(function (ev) {
          c.beginPath(); c.arc(sx(ev.lon), sy(ev.lat), Math.max(1.5, ev.mag * 0.7), 0, 6.2832);
          c.fillStyle = "#64748b"; c.globalAlpha = alpha; c.fill();
        });
      }
      c.globalAlpha = 1;
      // Current frame events
      var curEv = A.events || [];
      curEv.forEach(function (ev, ei) {
        var px = sx(ev.lon), py = sy(ev.lat);
        var r = Math.max(2.5, (ev.mag - 3.5) * 3);
        var ecol = ramp(Math.min(1, Math.max(0, (ev.mag - 4.0) / 3.0)));
        // Pulsing shockwave ring
        var pulse = (p.u * 3 + ei * 0.4) % 1.0;
        c.beginPath(); c.arc(px, py, r * (1 + pulse * 1.8), 0, 6.2832);
        c.strokeStyle = ecol; c.globalAlpha = (1 - pulse) * 0.7; c.lineWidth = 1; c.stroke();
        // Center dot
        c.beginPath(); c.arc(px, py, r, 0, 6.2832);
        c.fillStyle = ecol; c.globalAlpha = 0.9; c.fill();
        c.globalAlpha = 1;
      });
      text(c, "● 本日震度 ≥4.0: " + curEv.length + " 起", ML + 8, MT + H - 6, 9, "#f59e0b", "left");
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #25 Word Cloud — d:{frames:[{label, words:[{text,count}]}]}；政策關鍵詞雲 */
  function wordCloud(cv, d, opt) {
    var o = opt || {}, F = d.frames;
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      text(c, (o.title || "美國聯邦公報政策關鍵詞雲") + "　" + A.label, 12, 12, 12, DIM);
      var wList = (A.words || []).slice().sort(function (a, b) { return b.count - a.count; }), maxC = 1;
      wList.forEach(function (w) { maxC = Math.max(maxC, w.count); });
      var cx = s.w / 2, cy = (s.h + 22) / 2;
      var golden = 2.39996, placed = [];
      wList.forEach(function (w, wi) {
        var sz = Math.max(9, Math.round(11 + (w.count / maxC) * (s.w > 500 ? 22 : 13)));
        c.font = sz + "px sans-serif";
        var tw = c.measureText(w.text).width, th = sz * 1.15;
        var wx = cx, wy = cy, found = false;
        var aspect = (s.w / Math.max(1, s.h)) * 0.75;
        for (var step = 0; step < 180; step++) {
          var dist = step * 3.8;
          var ang = wi * golden + step * 0.35;
          var tx = cx + Math.cos(ang) * dist * aspect;
          var ty = cy + Math.sin(ang) * dist;
          var x0 = tx - tw * 0.5 - 3, x1 = tx + tw * 0.5 + 3;
          var y0 = ty - th * 0.5 - 2, y1 = ty + th * 0.5 + 2;
          if (x0 < 8 || x1 > s.w - 8 || y0 < 28 || y1 > s.h - 10) continue;
          var hit = placed.some(function (q) { return !(x1 < q[0] || x0 > q[2] || y1 < q[1] || y0 > q[3]); });
          if (!hit) { wx = tx; wy = ty; placed.push([x0, y0, x1, y1]); found = true; break; }
        }
        if (!found) return;
        text(c, w.text, wx, wy, sz, col(wi), "center");
      });
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #26 Timeline — d:{events:[{date,title,cat}], frames:[{label,count,active:[]}]}；專案里程碑軸 */
  function timeline(cv, d, opt) {
    var o = opt || {}, F = d.frames, allEv = d.events || [];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k];
      var ML = 24, MR = 24, MT = 32, MB = 24, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "A23 專案里程碑演進時間軸") + "　" + A.label, 12, 12, 12, DIM);
      var curN = Math.min(allEv.length, A.count || Math.floor(t) + 1);
      var cy = MT + H * 0.52;
      // Central timeline spine
      c.strokeStyle = "#334155"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(ML, cy); c.lineTo(ML + W, cy); c.stroke();
      var dx = W / Math.max(1, allEv.length);
      for (var i = 0; i < allEv.length; i++) {
        var ev = allEv[i];
        var ex = ML + (i + 0.5) * dx;
        var isAct = i < curN;
        c.beginPath(); c.arc(ex, cy, isAct ? 5 : 3, 0, 6.2832);
        c.fillStyle = isAct ? "#38bdf8" : "#475569"; c.fill();
        if (isAct) {
          c.strokeStyle = "#ffffff"; c.lineWidth = 1.5; c.stroke();
          // Alternate stems up and down
          var up = i % 2 === 0;
          var ty = up ? cy - (s.h > 400 ? 55 : 36) : cy + (s.h > 400 ? 55 : 36);
          c.strokeStyle = "#38bdf8"; c.lineWidth = 1; c.setLineDash([2, 2]);
          c.beginPath(); c.moveTo(ex, cy + (up ? -5 : 5)); c.lineTo(ex, ty); c.stroke();
          c.setLineDash([]);
          // Card text
          var tagCol = ev.cat === "視覺" ? "#38bdf8" : (ev.cat === "架構" ? "#a78bfa" : "#10b981");
          text(c, ev.date.split(" ")[0], ex, up ? ty - 12 : ty + 12, 8, DIM, "center");
          text(c, ev.title.slice(0, s.w > 500 ? 14 : 9), ex, ty, 9, tagCol, "center");
        }
      }
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #27 Gantt — d:{tasks:[{id,name,cat,start,end,prog}], dates:[d...], frames:[{label,cursor}]} */
  function gantt(cv, d, opt) {
    var o = opt || {}, F = d.frames, tasks = d.tasks || [], dates = d.dates || [];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var ML = s.w > 480 ? 110 : 80, MR = 16, MT = 30, MB = 26, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "A23 場景開發甘特圖排程") + "　" + A.label, 12, 12, 12, DIM);
      var th = H / tasks.length;
      var curFrac = lerp(A.cursor != null ? A.cursor : p.k / (F.length - 1), B.cursor != null ? B.cursor : p.k2 / (F.length - 1), p.u);
      // Date grid columns
      var colW = W / (dates.length - 1);
      dates.forEach(function (dt, di) {
        var gx = ML + di * colW;
        c.strokeStyle = "#1e293b"; c.lineWidth = 1;
        c.beginPath(); c.moveTo(gx, MT); c.lineTo(gx, MT + H); c.stroke();
        text(c, dt, gx, MT + H + 12, 9, DIM, "center");
      });
      function dateFrac(dstr) {
        var idx = dates.indexOf(dstr);
        if (idx >= 0) return idx / (dates.length - 1);
        return 0;
      }
      // Task bars
      tasks.forEach(function (tk, ti) {
        var ty = MT + ti * th + th * 0.18, tbh = th * 0.64;
        text(c, tk.name, ML - 8, ty + tbh / 2, 9, FG, "right");
        var x0 = ML + dateFrac(tk.start) * W;
        var x1 = ML + Math.max(dateFrac(tk.start) + 0.15, dateFrac(tk.end)) * W;
        var barW = x1 - x0;
        // Background track
        c.fillStyle = "#1e293b"; c.fillRect(x0, ty, barW, tbh);
        // Active progress
        var pWidth = barW * (tk.prog || 0);
        c.fillStyle = tk.prog >= 1.0 ? "#10b981" : col(ti);
        c.fillRect(x0, ty, pWidth, tbh);
        c.strokeStyle = BG; c.lineWidth = 1; c.strokeRect(x0, ty, barW, tbh);
      });
      // Time cursor line
      var sweepX = ML + curFrac * W;
      c.strokeStyle = "#f43f5e"; c.lineWidth = 2;
      c.beginPath(); c.moveTo(sweepX, MT); c.lineTo(sweepX, MT + H); c.stroke();
      text(c, "▼ 當前進度", sweepX, MT - 6, 8, "#f43f5e", "center");
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #28 Correlation Matrix — d:{vars:[變數], frames:[{label, matrix:[[r]]}]}；皮爾森相關矩陣 */
  function corrMatrix(cv, d, opt) {
    var o = opt || {}, F = d.frames, vars = d.vars || [];
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k], B = F[p.k2];
      var ML = s.w > 450 ? 56 : 42, MR = 14, MT = 32, MB = 20, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "氣象要素皮爾森相關矩陣") + "　" + A.label, 12, 12, 12, DIM);
      var nv = vars.length, side = Math.min(W, H) / nv;
      var ox = ML + (W - nv * side) / 2, oy = MT + (H - nv * side) / 2;
      // Headers
      vars.forEach(function (vName, vi) {
        text(c, vName, ox + vi * side + side / 2, oy - 8, 9, FG, "center");
        text(c, vName, ox - 6, oy + vi * side + side / 2, 9, FG, "right");
      });
      var matA = A.matrix || [], matB = B.matrix || matA;
      for (var r = 0; r < nv; r++) {
        for (var col_i = 0; col_i < nv; col_i++) {
          var rA = matA[r] ? matA[r][col_i] : 0, rB = matB[r] ? matB[r][col_i] : rA;
          var rVal = lerp(rA, rB, p.u);
          var cellColor = rVal >= 0 ? "#10b981" : "#f43f5e";
          var cellAlpha = Math.min(1, Math.abs(rVal) * 0.85 + 0.1);
          var cx = ox + col_i * side, cy = oy + r * side;
          c.fillStyle = cellColor; c.globalAlpha = cellAlpha;
          c.fillRect(cx + 1, cy + 1, side - 2, side - 2);
          c.globalAlpha = 1;
          c.strokeStyle = BG; c.lineWidth = 1; c.strokeRect(cx, cy, side, side);
          // Label inside cell
          if (side > 28) {
            text(c, (rVal > 0 ? "+" : "") + fmtv(rVal, 2), cx + side / 2, cy + side / 2, 8, "#ffffff", "center");
          }
        }
      }
      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #29 3D Surface / Contour — d:{tenors:[期限], frames:[{label, values:[殖利率]}]}；2.5D 曲面 */
  function surface(cv, d, opt) {
    var o = opt || {}, F = d.frames, tenors = d.tenors || ["1M","3M","6M","1Y","2Y","5Y","10Y","30Y"];
    var minZ = 1e18, maxZ = -1e18;
    F.forEach(function (f) {
      (f.values || []).forEach(function (v) { minZ = Math.min(minZ, v); maxZ = Math.max(maxZ, v); });
    });
    minZ = Math.floor(minZ); maxZ = Math.ceil(maxZ);
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c, p = fr(F, t), A = F[p.k];
      var ML = 28, MR = 28, MT = 32, MB = 28, W = s.w - ML - MR, H = s.h - MT - MB;
      text(c, (o.title || "美國公債殖利率曲線 2.5D 網格") + "　" + A.label, 12, 12, 12, DIM);

      // Oblique 2.5D projection:
      // Depth axis (recent 10 frames), Width axis (tenors), Height axis (Yield)
      var depthCount = Math.min(10, F.length);
      var startK = Math.max(0, p.k - depthCount + 1);
      function iso(ti, di, zVal) {
        var fracT = ti / (tenors.length - 1);
        var fracD = di / Math.max(1, depthCount - 1);
        var fracZ = (zVal - minZ) / Math.max(1, maxZ - minZ);
        var ix = ML + W * 0.15 + fracT * (W * 0.7) + fracD * (W * 0.18);
        var iy = MT + H * 0.78 - fracD * (H * 0.42) - fracZ * (H * 0.38);
        return { x: ix, y: iy };
      }

      // Draw surface ribbons back-to-front
      for (var di = 0; di < depthCount - 1; di++) {
        var k1 = startK + di, k2 = startK + di + 1;
        if (k2 > p.k) break;
        var f1 = F[k1], f2 = F[k2];
        for (var ti = 0; ti < tenors.length - 1; ti++) {
          var z11 = f1.values[ti], z12 = f1.values[ti + 1];
          var z21 = f2.values[ti], z22 = f2.values[ti + 1];
          var pt11 = iso(ti, di, z11), pt12 = iso(ti + 1, di, z12);
          var pt21 = iso(ti, di + 1, z21), pt22 = iso(ti + 1, di + 1, z22);
          var avgZ = (z11 + z12 + z21 + z22) / 4;
          var zCol = ramp((avgZ - minZ) / Math.max(1, maxZ - minZ));
          c.beginPath();
          c.moveTo(pt11.x, pt11.y); c.lineTo(pt12.x, pt12.y);
          c.lineTo(pt22.x, pt22.y); c.lineTo(pt21.x, pt21.y);
          c.closePath();
          c.fillStyle = zCol; c.globalAlpha = 0.82; c.fill();
          c.strokeStyle = BG; c.lineWidth = 1; c.stroke();
          c.globalAlpha = 1;
        }
      }

      // Highlight current front curve
      var curF = A;
      c.beginPath();
      tenors.forEach(function (tn, ti) {
        var pt = iso(ti, 0, curF.values[ti]);
        if (ti === 0) c.moveTo(pt.x, pt.y); else c.lineTo(pt.x, pt.y);
      });
      c.strokeStyle = "#f8fafc"; c.lineWidth = 2.2; c.stroke();

      // Front tenor ticks
      tenors.forEach(function (tn, ti) {
        var pt = iso(ti, 0, curF.values[ti]);
        c.beginPath(); c.arc(pt.x, pt.y, 3, 0, 6.2832);
        c.fillStyle = "#38bdf8"; c.fill();
        text(c, tn, pt.x, pt.y + 14, 8, DIM, "center");
        text(c, fmtv(curF.values[ti], 1) + "%", pt.x, pt.y - 8, 8, FG, "center");
      });

      if (o.note) text(c, o.note, s.w - 12, 12, 9, DIM, "right");
    }, o);
  }

  /* #30 CODEX // PLUGINS 3D 測地線星系球 — d:{clusters:[{id,label,lat,lon,color,count,kind}], arcs:[{from,to}], particles:[{lat,lon,color,r}], frames:[{label}]} */
  function codexGlobe(cv, d, opt) {
    var o = opt || {}, clusters = d.clusters || [], arcs = d.arcs || [];
    var F = d.frames || [];
    if (!F.length) { for (var fi = 0; fi < 120; fi++) F.push({ label: "T+" + fi }); }
    var N_FIB = o.meshPoints || 96;
    var fibPts = [], fibEdges = [];
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < N_FIB; i++) {
      var y = 1 - (i / (N_FIB - 1)) * 2;
      var rad = Math.sqrt(Math.max(0, 1 - y * y));
      var th = golden * i;
      fibPts.push([Math.cos(th) * rad, y, Math.sin(th) * rad]);
    }
    for (var a = 0; a < N_FIB; a++) {
      var dists = [];
      for (var b = a + 1; b < N_FIB; b++) {
        var dx = fibPts[a][0] - fibPts[b][0], dy = fibPts[a][1] - fibPts[b][1], dz = fibPts[a][2] - fibPts[b][2];
        var d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < 0.34) fibEdges.push([a, b]);
      }
    }
    var particles = d.particles || [];
    if (!particles.length && clusters.length) {
      clusters.forEach(function (cl, ci) {
        var cnt = Math.min(28, Math.max(8, cl.count || 14));
        for (var pi = 0; pi < cnt; pi++) {
          var ang = (pi / cnt) * 6.2832 + ci * 0.7;
          var spr = 6 + ((pi * 17) % 15);
          particles.push({
            lat: cl.lat + Math.sin(ang) * spr,
            lon: cl.lon + Math.cos(ang) * spr * 1.2,
            color: cl.color || col(ci),
            r: 1.2 + ((pi * 7) % 10) * 0.14
          });
        }
      });
    }
    var clMap = {};
    clusters.forEach(function (cl) { clMap[cl.id] = cl; });
    var state = { yaw: o.yaw || 0, pitch: o.pitch != null ? o.pitch : 0.28, drag: false, lx: 0, ly: 0 };
    if (o.interactive !== false && !cv.__codexBound) {
      cv.__codexBound = true;
      cv.style.cursor = "grab";
      cv.addEventListener("pointerdown", function (e) {
        state.drag = true; state.lx = e.clientX; state.ly = e.clientY;
        cv.style.cursor = "grabbing";
      });
      window.addEventListener("pointermove", function (e) {
        if (!state.drag) return;
        state.yaw += (e.clientX - state.lx) * 0.008;
        state.pitch = Math.max(-1.1, Math.min(1.1, state.pitch + (e.clientY - state.ly) * 0.006));
        state.lx = e.clientX; state.ly = e.clientY;
      });
      window.addEventListener("pointerup", function () {
        if (state.drag) { state.drag = false; cv.style.cursor = "grab"; }
      });
    }
    function rotVec(vx, vy, vz, yaw, pitch) {
      var cy = Math.cos(yaw), sy = Math.sin(yaw);
      var x1 = vx * cy + vz * sy, z1 = -vx * sy + vz * cy;
      var cp = Math.cos(pitch), sp = Math.sin(pitch);
      var y2 = vy * cp - z1 * sp, z2 = vy * sp + z1 * cp;
      return [x1, y2, z2];
    }
    function ll2v(lon, lat) {
      var la = lat * Math.PI / 180, lo = lon * Math.PI / 180;
      return [Math.cos(la) * Math.sin(lo), -Math.sin(la), Math.cos(la) * Math.cos(lo)];
    }
    return driver(F.length, function (t) {
      var s = fit(cv), c = s.c;
      var yaw = state.yaw + (state.drag ? 0 : t * (o.spinSpeed != null ? o.spinSpeed : 0.045));
      var pitch = state.pitch;
      var cx = s.w * 0.5, cy = s.h * 0.52;
      var R = Math.min(s.w, s.h) * (o.radiusScale || 0.37);

      var halo = c.createRadialGradient(cx, cy, R * 0.25, cx, cy, R * 1.32);
      halo.addColorStop(0, "rgba(56,189,248,0.12)");
      halo.addColorStop(0.65, "rgba(15,23,42,0.28)");
      halo.addColorStop(1, "rgba(5,9,18,0)");
      c.fillStyle = halo; c.beginPath(); c.arc(cx, cy, R * 1.32, 0, 6.2832); c.fill();

      var orb = c.createRadialGradient(cx - R * 0.28, cy - R * 0.28, R * 0.08, cx, cy, R);
      orb.addColorStop(0, "#10203d"); orb.addColorStop(0.7, "#091122"); orb.addColorStop(1, "#040812");
      c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fillStyle = orb; c.fill();
      c.strokeStyle = "rgba(56,189,248,0.35)"; c.lineWidth = 1.2; c.stroke();

      var projFib = fibPts.map(function (v) {
        var r = rotVec(v[0], v[1], v[2], yaw, pitch);
        return { x: cx + r[0] * R, y: cy + r[1] * R, z: r[2] };
      });
      c.lineWidth = 0.7;
      fibEdges.forEach(function (e) {
        var p1 = projFib[e[0]], p2 = projFib[e[1]];
        var zAvg = (p1.z + p2.z) * 0.5;
        if (zAvg < -0.1) return;
        c.strokeStyle = "rgba(56,189,248," + (0.06 + Math.max(0, zAvg) * 0.16).toFixed(3) + ")";
        c.beginPath(); c.moveTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.stroke();
      });

      particles.forEach(function (pt) {
        var v = ll2v(pt.lon, pt.lat), r = rotVec(v[0], v[1], v[2], yaw, pitch);
        if (r[2] < -0.08) return;
        var a = 0.25 + Math.max(0, r[2]) * 0.75;
        c.globalAlpha = a;
        c.fillStyle = pt.color || "#38bdf8";
        c.beginPath(); c.arc(cx + r[0] * R, cy + r[1] * R, pt.r || 1.6, 0, 6.2832); c.fill();
      });
      c.globalAlpha = 1;

      arcs.forEach(function (arc, ai) {
        var c1 = clMap[arc.from], c2 = clMap[arc.to];
        if (!c1 || !c2) return;
        var v1 = ll2v(c1.lon, c1.lat), v2 = ll2v(c2.lon, c2.lat);
        c.beginPath();
        var started = false, steps = 20;
        for (var si = 0; si <= steps; si++) {
          var u = si / steps;
          var mx = lerp(v1[0], v2[0], u), my = lerp(v1[1], v2[1], u), mz = lerp(v1[2], v2[2], u);
          var len = Math.sqrt(mx * mx + my * my + mz * mz) || 1;
          var alt = 1 + Math.sin(u * Math.PI) * 0.16;
          var r = rotVec(mx / len * alt, my / len * alt, mz / len * alt, yaw, pitch);
          if (r[2] > -0.1) {
            var px = cx + r[0] * R, py = cy + r[1] * R;
            if (!started) { c.moveTo(px, py); started = true; } else c.lineTo(px, py);
          } else started = false;
        }
        c.strokeStyle = c1.color || col(ai); c.globalAlpha = 0.52; c.lineWidth = 1.25; c.stroke();
        var pu = (t * 0.08 + ai * 0.23) % 1;
        var pmx = lerp(v1[0], v2[0], pu), pmy = lerp(v1[1], v2[1], pu), pmz = lerp(v1[2], v2[2], pu);
        var plen = Math.sqrt(pmx * pmx + pmy * pmy + pmz * pmz) || 1;
        var palt = 1 + Math.sin(pu * Math.PI) * 0.16;
        var pr = rotVec(pmx / plen * palt, pmy / plen * palt, pmz / plen * palt, yaw, pitch);
        if (pr[2] > 0) {
          c.globalAlpha = 0.95; c.fillStyle = "#f8fafc";
          c.beginPath(); c.arc(cx + pr[0] * R, cy + pr[1] * R, 2.2, 0, 6.2832); c.fill();
        }
      });
      c.globalAlpha = 1;

      var visLabels = [];
      clusters.forEach(function (cl, ci) {
        var v = ll2v(cl.lon, cl.lat), r = rotVec(v[0], v[1], v[2], yaw, pitch);
        var px = cx + r[0] * R, py = cy + r[1] * R;
        var cCol = cl.color || col(ci);
        if (r[2] > -0.05) {
          c.fillStyle = cCol; c.globalAlpha = 0.35 + Math.max(0, r[2]) * 0.65;
          c.beginPath(); c.arc(px, py, 4.5, 0, 6.2832); c.fill();
          c.strokeStyle = "#f8fafc"; c.lineWidth = 1; c.stroke();
          c.globalAlpha = 1;
          if (r[2] > 0.12) visLabels.push({ cl: cl, px: px, py: py, z: r[2], col: cCol, lx: px + (r[0] >= 0 ? 16 : -16), ly: py - 10 });
        }
      });
      visLabels.sort(function (a, b) { return b.z - a.z; });
      var placed = [];
      c.font = "10px sans-serif";
      visLabels.forEach(function (lb) {
        var txt = lb.cl.label + " (" + (lb.cl.count || 0) + ")";
        var tw = c.measureText(txt).width + 16, th = 18;
        var bx = Math.max(8, Math.min(s.w - tw - 8, lb.lx >= cx ? lb.lx : lb.lx - tw));
        var by = Math.max(8, Math.min(s.h - th - 8, lb.ly - th * 0.5));
        for (var tries = 0; tries < 6; tries++) {
          var hit = placed.some(function (p) { return !(bx + tw + 4 < p.x || bx > p.x + p.w + 4 || by + th + 4 < p.y || by > p.y + p.h + 4); });
          if (!hit) break;
          by = Math.max(8, Math.min(s.h - th - 8, by + (tries % 2 === 0 ? 1 : -1) * (th + 4)));
        }
        placed.push({ x: bx, y: by, w: tw, h: th });
        c.strokeStyle = lb.col; c.lineWidth = 0.9; c.globalAlpha = 0.7;
        c.beginPath(); c.moveTo(lb.px, lb.py); c.lineTo(bx + (bx >= cx ? 0 : tw), by + th * 0.5); c.stroke();
        c.globalAlpha = 0.92; c.fillStyle = "#070d1a";
        c.beginPath(); c.roundRect ? c.roundRect(bx, by, tw, th, 9) : c.rect(bx, by, tw, th); c.fill();
        c.strokeStyle = lb.col; c.lineWidth = 1; c.stroke();
        c.globalAlpha = 1;
        text(c, txt, bx + tw * 0.5, by + th * 0.5, 10, "#e2e8f0", "center");
      });
      if (o.note) text(c, o.note, s.w - 12, s.h - 12, 9, DIM, "right");
    }, o);
  }

  function resolveD(d) { return typeof d === "function" ? d() : (d || {}); }

  /* #31 §6.7（2026-11-16 S12）：星團環佈局（phyllotaxis 不重疊）＋階層式邊捆綁（Holten β=0.85）＋密度透明度 α=1-(1-A)^(1/n)＋標籤徑向避讓；
     CLUSTER SPEC 鍵值＋SOURCE 子窗（取代浮窗）＋BUNDLE MATRIX 插畫顯影；保留 dd.cats/callouts/activeCallout/alert 注入介面 */
  function ycGraph(cv, d, opt) {
    var TX = g.A23Tex;
    if (!TX) return ycGraphLegacy(cv, d, opt);
    var o = opt || {};
    var K = TX.kit(TX.theme(YC_ACC)), V = K.V, tx = K.tx, hh = K.hh;
    var defCats = [
      { id: "Claude Code", count: 142 }, { id: "codex", count: 118 }, { id: "telegram voice", count: 108 },
      { id: "people", count: 102 }, { id: "companies", count: 96 }, { id: "meetings", count: 112 }, { id: "sources", count: 82 }
    ];
    var defCallouts = [
      { title: "SaaS rev growth at 51m", sub: "source · call notes · 11/10", cat: 2 },
      { title: "churn FAST to 2.1%", sub: "source · dashboard · 11/04", cat: 0 },
      { title: "Joe prefers async", sub: "source · team notes · 11/09", cat: 3 },
      { title: "pricing: $69 / seat", sub: "source · pricing.pdf p.3", cat: 6 },
      { title: "Acme raised Series A", sub: "source · email · 11/12", cat: 4 }
    ];
    var M = 26, GA = 2.39996, BETA = 0.85;
    /* 控制多邊形 → 二次樣條取樣折線（描線與 hotPacket 共用同一組點） */
    function smooth(P) {
      var out = [P[0]], L = P.length;
      for (var i = 1; i < L - 1; i++) {
        var a = i === 1 ? P[0] : [(P[i - 1][0] + P[i][0]) / 2, (P[i - 1][1] + P[i][1]) / 2];
        var b = i === L - 2 ? P[L - 1] : [(P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2];
        for (var s = 1; s <= 6; s++) { var u = s / 6, v = 1 - u; out.push([v * v * a[0] + 2 * v * u * P[i][0] + u * u * b[0], v * v * a[1] + 2 * v * u * P[i][1] + u * u * b[1]]); }
      }
      return out;
    }
    function poly(c, pts) { c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); c.stroke(); }
    function hit(r, list, skip) {
      for (var i = 0; i < list.length; i++) { if (i === skip) continue; var q = list[i]; if (r.x < q.x + q.w && r.x + r.w > q.x && r.y < q.y + q.h && r.y + r.h > q.y) return true; }
      return false;
    }
    return driver(150, function (t) {
      var dd = resolveD(d), cats = dd.cats || defCats, callouts = dd.callouts || defCallouts, n = cats.length;
      var s = fit(cv), c = s.c, w = s.w, h = s.h, compact = w < 420, ph = t / 150;
      var f = K.infoFont(w), sc = K.clamp(w / 640, 0.55, 1.3), rowH = f + Math.max(5, Math.round(f * 0.8));
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      var hy = compact ? 8 : 12;
      tx(c, dd.title || "01 GRAPH · the YC CEO's second brain", 7, hy, compact ? 7.5 : 11, V.acc2, "left", "600");
      tx(c, dd.subtitle || "760 NODES · 2,400 LINKS", w - 7, hy, compact ? 6 : 9, V.dim, "right");

      /* 作用星團：浮窗所屬類別（或依 t 輪替） */
      var ciIdx = callouts.length ? ((typeof dd.activeCallout === "number") ? dd.activeCallout % callouts.length : Math.floor(t / 30) % callouts.length) : -1;
      var co = ciIdx >= 0 ? callouts[ciIdx] : null;
      var act = co && co.cat != null ? co.cat % n : Math.floor(t / 30) % n;

      /* 跨星團邊（決定性）：相鄰星團加權，依星團對成束 */
      var ie = [], bc = {}, maxB = 1;
      for (var a = 0; a < n; a++) for (var b = a + 1; b < n; b++) {
        var k = 1 + Math.floor(hh(a * 13 + b, 5) * 4) + ((b - a === 1 || b - a === n - 1) ? 3 : 0);
        bc[a + "_" + b] = k; if (k > maxB) maxB = k;
        for (var e = 0; e < k; e++) ie.push({ a: a, b: b, k: k, ia: Math.floor(hh(a * 31 + b * 7 + e, 1) * M), ib: Math.floor(hh(a * 17 + b * 29 + e, 2) * M) });
      }

      /* 左欄子窗 */
      var top = compact ? 16 : 22, sx = 6, sw = compact ? Math.round(w * 0.3) : Math.round(K.clamp(w * 0.24, 130, 190));
      var specH = Math.min((h - top - 6) * 0.62, 13 + rowH * n + 4);
      var pb1 = K.pane(c, { x: sx, y: top, w: sw, h: specH }, "CLUSTER SPEC", n + " × " + M);
      K.specEdge(c, sx + 3, top + 1, sw - 6);
      K.kvBlock(c, pb1, cats.map(function (ct, i) { return [ct.id, ct.count != null ? ct.count : "", i === act]; }), f, sx + sw - 0.5);
      cats.forEach(function (ct, i) {
        if (!ct.alert) return;
        var ry = Math.round(pb1.y + rowH * (i + 0.6)); if (ry > pb1.y + pb1.h) return;
        c.fillStyle = SEM_RED; c.fillRect(pb1.x, ry - f * 0.5, 2, f);
      });
      var my = top + specH + 6;
      if (!compact && co) {
        var chH = 13 + rowH * 2 + 4, sevC = co.sev === "crit" ? SEM_RED : (co.sev === "warn" ? SEM_AMB : null);
        var pc = K.pane(c, { x: sx, y: my, w: sw, h: chH }, "SOURCE", co.sev ? String(co.sev).toUpperCase() : "LIVE");
        tx(c, K.fitM(c, co.title, pc.w - 10, f, "600"), pc.x + 5, Math.round(pc.y + rowH * 0.6), f, V.ink, "left", "600");
        tx(c, K.fitM(c, co.sub, pc.w - 10, f - 1, "400"), pc.x + 5, Math.round(pc.y + rowH * 1.6), f - 1, sevC || V.dim, "left");
        c.fillStyle = sevC || V.acc; c.fillRect(sx + 1, my + 12, 2, chH - 15);
        K.kvPort(c, sx + sw - 0.5, my + chH * 0.5, true);
        my += chH + 6;
      }
      var mh = h - my - 6;
      if (mh > 40) {
        var pb2 = K.pane(c, { x: sx, y: my, w: sw, h: mh }, "BUNDLE MATRIX", "β " + BETA);
        var cs = Math.max(2, Math.floor(Math.min((pb2.w - 6) / n, (pb2.h - 4) / n)));
        var mx0 = pb2.x + Math.round((pb2.w - cs * n) / 2), my0 = pb2.y + Math.round((pb2.h - cs * n) / 2);
        K.develop(c, pb2, (t % 75) / 60, function (cc, col) {
          for (var r = 0; r < n; r++) for (var q = 0; q < n; q++) {
            var cnt = r === q ? 0 : bc[Math.min(r, q) + "_" + Math.max(r, q)];
            cc.fillStyle = K.mix(V.pane, col, r === q ? 0.1 : 0.3 + 0.7 * Math.sqrt(cnt / maxB));
            cc.fillRect(mx0 + q * cs, my0 + r * cs, cs - 1, cs - 1);
          }
        });
        c.strokeStyle = V.acc2; c.lineWidth = 1;
        c.strokeRect(mx0 - 0.5, my0 + act * cs - 0.5, cs * n, cs); c.strokeRect(mx0 + act * cs - 0.5, my0 - 0.5, cs, cs * n);
      }

      /* 圖譜子窗：星團環佈局 */
      var G = { x: sx + sw + 6, y: top, w: w - sx - sw - 12, h: h - top - 6 };
      var gp = K.pane(c, G, "KNOWLEDGE LATTICE", compact ? "" : "edge-bundled · α=1-(1-A)^(1/n)");
      K.dotGrid(c, gp.x, gp.y, gp.w, gp.h, compact ? 10 : 14, V.dot2);
      var maxC = 1; cats.forEach(function (ct) { if ((ct.count || 1) > maxC) maxC = ct.count || 1; });
      var cx0 = gp.x + gp.w / 2, cy0 = gp.y + gp.h / 2 + 2, RX = gp.w * 0.33, RY = gp.h * 0.32, base = Math.min(gp.w, gp.h) * 0.11;
      var C = cats.map(function (ct, i) {
        var an = -Math.PI / 2 + i * 2 * Math.PI / n, x = cx0 + Math.cos(an) * RX, y = cy0 + Math.sin(an) * RY;
        var r = Math.max(8, base * Math.sqrt((ct.count || maxC) / maxC)), nd = [];
        for (var k = 0; k < M; k++) {
          var rr = r * Math.sqrt((k + 0.5) / M) + Math.sin(ph * 6.2832 + k * 0.7 + i) * 0.6 * sc, th = k * GA + i;
          nd.push([x + Math.cos(th) * rr, y + Math.sin(th) * rr * 0.92]);
        }
        return { x: x, y: y, r: r, an: an, nd: nd, tone: ct.alert ? SEM_RED : K.mix(V.deep, V.acc3, 0.15 + 0.85 * (n > 1 ? i / (n - 1) : 0.5)) };
      });

      /* 星團內邊：phyllotaxis 鄰接 k-5 / k-8，淡線 */
      c.lineWidth = 0.5;
      C.forEach(function (q, i) {
        c.strokeStyle = q.tone; c.globalAlpha = i === act ? 0.4 : 0.2;
        c.beginPath();
        for (var k = 5; k < M; k++) { c.moveTo(q.nd[k][0], q.nd[k][1]); c.lineTo(q.nd[k - 5][0], q.nd[k - 5][1]); if (k >= 8) { c.moveTo(q.nd[k][0], q.nd[k][1]); c.lineTo(q.nd[k - 8][0], q.nd[k - 8][1]); } }
        c.stroke();
      });

      /* 跨星團邊：階層式捆綁（節點→星團核→內環→樞紐側中點→…）＋Holten 拉直 β；同束 n 條合成不透明度恆為 A */
      function bundlePath(e2) {
        var A = C[e2.a], B = C[e2.b], p = A.nd[e2.ia], q = B.nd[e2.ib];
        var a1 = [K.lerp(A.x, cx0, 0.42), K.lerp(A.y, cy0, 0.42)], b1 = [K.lerp(B.x, cx0, 0.42), K.lerp(B.y, cy0, 0.42)];
        var mid = [K.lerp((a1[0] + b1[0]) / 2, cx0, 0.55), K.lerp((a1[1] + b1[1]) / 2, cy0, 0.55)];
        var P = [p, [A.x, A.y], a1, mid, b1, [B.x, B.y], q], N = P.length - 1;
        for (var i = 1; i < N; i++) { var u = i / N; P[i] = [BETA * P[i][0] + (1 - BETA) * (p[0] + (q[0] - p[0]) * u), BETA * P[i][1] + (1 - BETA) * (p[1] + (q[1] - p[1]) * u)]; }
        return smooth(P);
      }
      c.lineWidth = Math.max(0.6, 0.8 * sc);
      var hot = null;
      [false, true].forEach(function (pass) {
        ie.forEach(function (e2) {
          var on = e2.a === act || e2.b === act; if (on !== pass) return;
          e2.pts = bundlePath(e2);
          c.globalAlpha = 1 - Math.pow(1 - (on ? 0.85 : 0.45), 1 / e2.k);
          c.strokeStyle = on ? V.acc2 : K.mix(C[e2.a].tone, C[e2.b].tone, 0.5);
          poly(c, e2.pts);
          if (on && (!hot || e2.k > hot.k)) hot = e2;
        });
      });
      c.globalAlpha = 1;

      /* 節點 */
      C.forEach(function (q, i) {
        var on = i === act;
        c.globalAlpha = on ? 1 : 0.72;
        q.nd.forEach(function (p, k) {
          var big = k % 7 === 0;
          c.fillStyle = on ? (big ? V.acc3 : V.acc2) : q.tone;
          c.beginPath(); c.arc(p[0], p[1], (big ? 2.2 : 1.3) * sc, 0, 6.2832); c.fill();
        });
      });
      c.globalAlpha = 1;

      /* 樞紐 */
      var hr = 6 + 3 * sc;
      c.fillStyle = V.pane; c.strokeStyle = V.acc; c.lineWidth = 1.2;
      c.beginPath(); c.arc(cx0, cy0, hr, 0, 6.2832); c.fill(); c.stroke();
      tx(c, dd.hubLabel || "G", cx0, cy0 + 0.5, f, V.acc2, "center", "700");

      /* 熱封包：作用星團最粗束 */
      if (hot) K.hotPacket(c, hot.pts, (ph * 5) % 1, V.acc2, 2.2 * sc);

      /* 標籤：徑向外推＋碰撞避讓（避其他標籤、其他星團外框、樞紐） */
      var obs = C.map(function (q) { return { x: q.x - q.r, y: q.y - q.r, w: q.r * 2, h: q.r * 2 }; });
      var hubBox = { x: cx0 - hr - 2, y: cy0 - hr - 2, w: hr * 2 + 4, h: hr * 2 + 4 }, placed = [];
      C.forEach(function (q, i) {
        var ct = cats[i], lbl = String(ct.id);
        c.font = "600 " + f + "px " + K.MONO;
        var tw = c.measureText(lbl).width + 10, bh = f + 6, ux = Math.cos(q.an), uy = Math.sin(q.an), dist = q.r + 5, box = null;
        for (var it = 0; it < 28; it++) {
          var ax = q.x + ux * dist, ay = q.y + uy * dist;
          var bx = Math.abs(ux) < 0.35 ? ax - tw / 2 : (ux > 0 ? ax : ax - tw);
          var by = Math.abs(uy) < 0.35 ? ay - bh / 2 : (uy > 0 ? ay : ay - bh);
          box = { x: K.clamp(bx, gp.x + 2, gp.x + gp.w - tw - 2), y: K.clamp(by, gp.y + 2, gp.y + gp.h - bh - 2), w: tw, h: bh };
          if (!hit(box, placed, -1) && !hit(box, obs, i) && !hit(box, [hubBox], -1)) break;
          dist += 4;
        }
        placed.push(box);
        var on = i === act, px = K.clamp(q.x, box.x, box.x + box.w), py = K.clamp(q.y, box.y, box.y + box.h);
        var dl = Math.hypot(px - q.x, py - q.y) || 1;
        c.setLineDash([1, 2]); c.strokeStyle = on ? V.acc2 : V.lead; c.lineWidth = 1;
        K.ln(c, q.x + (px - q.x) / dl * q.r, q.y + (py - q.y) / dl * q.r, px, py); c.setLineDash([]);
        if (on) K.activeHalo(c, box.x, box.y, box.w, box.h, 10);
        c.fillStyle = V.pane; K.roundRect(c, box.x, box.y, box.w, box.h, 2); c.fill();
        c.strokeStyle = ct.alert ? SEM_RED : (on ? V.acc2 : V.line2); c.lineWidth = 1; K.roundRect(c, box.x + 0.5, box.y + 0.5, box.w - 1, box.h - 1, 2); c.stroke();
        tx(c, lbl, box.x + 5, box.y + bh / 2 + 0.5, f, ct.alert ? SEM_RED : (on ? V.ink : V.txt), "left", "600");
        K.kvPort(c, px, py, on);
      });
    }, { fps: o.fps || 24 });
  }

  /* #31 YC Second Brain Graph (01 GRAPH) — 760 NODES · 2,400 LINKS 多色星團知識圖譜＋動態浮窗（支援動態 state 注入） */
  function ycGraphLegacy(cv, d, opt) {
    var o = opt || {};
    var defCats = [
      { id: "Claude Code", col: "#f97316", count: 142, cx: 0.28, cy: 0.45 },
      { id: "codex", col: "#38bdf8", count: 118, cx: 0.68, cy: 0.28 },
      { id: "telegram voice", col: "#14b8a6", count: 108, cx: 0.56, cy: 0.55 },
      { id: "people", col: "#facc15", count: 102, cx: 0.65, cy: 0.46 },
      { id: "companies", col: "#a78bfa", count: 96, cx: 0.45, cy: 0.78 },
      { id: "meetings", col: "#f43f5e", count: 112, cx: 0.60, cy: 0.22 },
      { id: "sources", col: "#10b981", count: 82, cx: 0.78, cy: 0.56 }
    ];
    var defCallouts = [
      { title: "SaaS rev growth at 51m", sub: "source · call notes · 11/10", cat: 2, nx: 0.49, ny: 0.40 },
      { title: "churn FAST to 2.1%", sub: "source · dashboard · 11/04", cat: 0, nx: 0.34, ny: 0.42 },
      { title: "Joe prefers async", sub: "source · team notes · 11/09", cat: 3, nx: 0.64, ny: 0.44 },
      { title: "pricing: $69 / seat", sub: "source · pricing.pdf p.3", cat: 6, nx: 0.74, ny: 0.52 },
      { title: "Acme raised Series A", sub: "source · email · 11/12", cat: 4, nx: 0.46, ny: 0.72 }
    ];
    var baseCats = resolveD(d).cats || defCats;
    var nodes = [], edges = [];
    baseCats.forEach(function (ct, ci) {
      for (var i = 0; i < 26; i++) {
        var ang = (i / 26) * 6.2832 + ci * 1.1;
        var rad = 0.03 + ((i * 19 + ci * 7) % 100) / 100 * 0.16;
        nodes.push({
          ci: ci,
          col: ct.col,
          x: ct.cx + Math.cos(ang) * rad * 1.25,
          y: ct.cy + Math.sin(ang) * rad * 0.85,
          r: (i % 7 === 0) ? 3.5 : (1.5 + (i % 3) * 0.6),
          ph: (i * 0.37) + ci
        });
      }
    });
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x, dy = nodes[i].y - nodes[j].y;
        var dist2 = dx * dx + dy * dy;
        if ((nodes[i].ci === nodes[j].ci && dist2 < 0.012) || (dist2 < 0.0055 && (i + j) % 3 === 0)) {
          edges.push([i, j]);
        }
      }
    }
    return driver(150, function (t) {
      var dd = resolveD(d);
      var cats = dd.cats || defCats;
      var callouts = dd.callouts || defCallouts;
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420;
      var ph = t / 150;
      text(c, dd.title || "01 GRAPH · the YC CEO's second brain", 10, 12, compact ? 9 : 11, dd.titleCol || "#f97316", "left");
      text(c, dd.subtitle || "760 NODES · 2,400 LINKS", w - 10, 12, compact ? 8 : 10, dd.subCol || "#f97316", "right");

      var gx = compact ? 0 : 108, gw = w - gx;
      var cxG = gx + gw * 0.52, cyG = h * 0.54;

      edges.forEach(function (e, ei) {
        var a = nodes[e[0]], b = nodes[e[1]];
        var ctA = cats[a.ci] || a;
        var ax = gx + a.x * gw, ay = a.y * h, bx = gx + b.x * gw, by = b.y * h;
        c.strokeStyle = ctA.col;
        c.globalAlpha = ctA.alert ? 0.28 : 0.14;
        c.lineWidth = 0.7;
        c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        if (ei % 14 === Math.floor(t) % 14) {
          var u = (ph * 6 + ei * 0.13) % 1;
          c.globalAlpha = 0.85;
          c.fillStyle = ctA.alert ? "#f43f5e" : "#f8fafc";
          c.beginPath(); c.arc(lerp(ax, bx, u), lerp(ay, by, u), 1.4, 0, 6.2832); c.fill();
        }
      });

      nodes.forEach(function (n, ni) {
        var ctN = cats[n.ci] || n;
        var nx = gx + n.x * gw + Math.sin(ph * 6.2832 + n.ph) * 1.8;
        var ny = n.y * h + Math.cos(ph * 6.2832 + n.ph) * 1.8;
        if (ni % 15 === 0) {
          c.strokeStyle = ctN.alert ? "rgba(244,63,94,0.38)" : "rgba(249,115,22,0.18)";
          c.lineWidth = 0.6;
          c.beginPath(); c.moveTo(cxG, cyG); c.lineTo(nx, ny); c.stroke();
        }
        c.globalAlpha = 0.88;
        c.fillStyle = ctN.col;
        c.beginPath(); c.arc(nx, ny, n.r * (compact ? 0.75 : 1), 0, 6.2832); c.fill();
      });
      c.globalAlpha = 1;

      cats.forEach(function (ct) {
        var lx = gx + ct.cx * gw, ly = ct.cy * h - (compact ? 10 : 16);
        var tw = Math.max(48, ct.id.length * (compact ? 5.2 : 6.4) + 14), th = compact ? 13 : 16;
        c.fillStyle = ct.alert ? "rgba(244,63,94,0.22)" : "rgba(7,13,26,0.88)";
        c.strokeStyle = ct.alert ? "#f43f5e" : ct.col; c.lineWidth = ct.alert ? 1.6 : 1;
        c.beginPath(); c.rect(lx - tw / 2, ly - th / 2, tw, th); c.fill(); c.stroke();
        text(c, ct.id, lx, ly, compact ? 7.5 : 9.5, ct.alert ? "#fecdd3" : ct.col, "center");
      });

      c.fillStyle = dd.hubCol || "#f97316";
      c.beginPath(); c.arc(cxG, cyG, compact ? 8 : 12, 0, 6.2832); c.fill();
      c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.stroke();
      text(c, dd.hubLabel || "G", cxG, cyG, compact ? 7.5 : 10, "#050912", "center");

      if (!compact) {
        c.fillStyle = "rgba(7,13,26,0.9)";
        c.strokeStyle = "#1e293b";
        c.lineWidth = 1;
        c.fillRect(8, 24, 106, 148);
        c.strokeRect(8, 24, 106, 148);
        cats.forEach(function (ct, i) {
          var ry = 36 + i * 18;
          c.fillStyle = ct.alert ? "#f43f5e" : ct.col;
          c.beginPath(); c.arc(16, ry, 3, 0, 6.2832); c.fill();
          text(c, ct.id, 24, ry, 8.5, ct.alert ? "#fecdd3" : FG, "left");
          text(c, String(ct.count), 108, ry, 8.5, ct.alert ? "#f43f5e" : ct.col, "right");
        });
      }

      if (callouts.length) {
        var ciIdx = (typeof dd.activeCallout === "number") ? (dd.activeCallout % callouts.length) : (Math.floor(t / 30) % callouts.length);
        var co = callouts[ciIdx];
        var boxW = compact ? 148 : 225, boxH = compact ? 30 : 40;
        var bx = gx + co.nx * gw - boxW * 0.5, by = co.ny * h - boxH - 12;
        bx = Math.max(gx + 6, Math.min(w - boxW - 6, bx));
        by = Math.max(22, Math.min(h - boxH - 8, by));
        var coCol = co.sev === "crit" ? "#f43f5e" : (co.sev === "warn" ? "#f59e0b" : "#14b8a6");
        c.strokeStyle = coCol; c.lineWidth = co.sev === "crit" ? 1.6 : 1.2;
        c.beginPath(); c.moveTo(cxG, cyG); c.lineTo(bx + boxW * 0.5, by + boxH); c.stroke();
        c.fillStyle = "rgba(5,9,18,0.94)";
        c.fillRect(bx, by, boxW, boxH);
        c.strokeRect(bx, by, boxW, boxH);
        text(c, co.title, bx + 8, by + (compact ? 10 : 13), compact ? 8.5 : 10, "#f8fafc", "left");
        text(c, co.sub, bx + 8, by + (compact ? 21 : 28), compact ? 7.5 : 8.5, coCol, "left");
      }
    }, { fps: o.fps || 24 });
  }

  /* #32 YC LLM-WIKI (02 LLM-WIKI) — 核心 G 節點放射貝茲曲線樹＋軌道光點粒子＋膠囊節點 */
  function ycWikiTree(cv, d, opt) {
    var defRepos = [
      { name: "gh-org", col: "#f97316" },
      { name: "ai-memory", col: "#38bdf8" },
      { name: "agent-second-brain", col: "#14b8a6" },
      { name: "CEO-second-brain", col: "#a78bfa" },
      { name: "oper-second-brain", col: "#f43f5e" },
      { name: "claude-second-brain", col: "#10b981" },
      { name: "vaults", col: "#eab308" }
    ];
    var defRules = [
      "01 schema · ~/.second-brain",
      "02 raw sources stay as-is",
      "03 the LLM writes the wiki",
      "04 every page links back",
      "05 ops: ingest · query · lint",
      "06 markdown native git",
      "07 2,400+ cross-linked pages"
    ];
    return driver(120, function (t) {
      var dd = resolveD(d);
      var repos = dd.repos || defRepos;
      var rules = dd.rules || defRules;
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420;
      var ph = t / 120;
      var actIdx = (typeof dd.activeIdx === "number") ? (dd.activeIdx % repos.length) : (Math.floor(t / 17) % repos.length);
      text(c, dd.title || "02 LLM-WIKI · the code/file behind all of it", 10, 12, compact ? 9 : 11, dd.titleCol || "#eab308", "left");
      text(c, dd.rightTag || "originally · post", w - 10, 12, compact ? 8 : 9.5, dd.titleCol || "#eab308", "right");

      var treeLeft = compact ? 16 : w * 0.36;
      if (!compact) {
        var lw = w * 0.32, lh = h - 34;
        c.fillStyle = "rgba(7,13,26,0.9)";
        c.strokeStyle = "#1e293b"; c.lineWidth = 1;
        c.fillRect(10, 24, lw, lh); c.strokeRect(10, 24, lw, lh);
        text(c, dd.leftTitle || "architecture", 18, 36, 9.5, "#94a3b8", "left");
        rules.forEach(function (rl, ri) {
          var ry = 54 + ri * ((lh - 38) / Math.max(1, rules.length));
          if (ri === actIdx) {
            c.fillStyle = "rgba(234,179,8,0.16)";
            c.fillRect(14, ry - 8, lw - 8, 16);
          }
          text(c, rl, 18, ry, 8.5, ri === actIdx ? "#facc15" : "#cbd5e1", "left");
        });
      }

      var gx = treeLeft + (compact ? 18 : 28), gy = h * 0.54;
      var rx = w - (compact ? 110 : 162);
      var topY = 32, botY = h - 18;

      repos.forEach(function (rp, i) {
        var ry = lerp(topY, botY, repos.length > 1 ? i / (repos.length - 1) : 0.5);
        var cx1 = lerp(gx, rx, 0.45), cy1 = gy;
        var cx2 = lerp(gx, rx, 0.55), cy2 = ry;
        c.strokeStyle = rp.blocked ? "#f43f5e" : rp.col;
        c.globalAlpha = (i === actIdx || rp.blocked) ? 0.95 : 0.42;
        c.lineWidth = (i === actIdx || rp.blocked) ? 1.8 : 1.1;
        if (rp.blocked && c.setLineDash) c.setLineDash([4, 4]);
        c.beginPath(); c.moveTo(gx, gy); c.bezierCurveTo(cx1, cy1, cx2, cy2, rx, ry); c.stroke();
        if (c.setLineDash) c.setLineDash([]);

        var u = rp.blocked ? 0.52 : ((ph * (rp.speed || 3) + i * 0.14) % 1), iu = 1 - u;
        var px = iu*iu*iu*gx + 3*iu*iu*u*cx1 + 3*iu*u*u*cx2 + u*u*u*rx;
        var py = iu*iu*iu*gy + 3*iu*iu*u*cy1 + 3*iu*u*u*cy2 + u*u*u*ry;
        c.globalAlpha = 0.95;
        c.fillStyle = rp.blocked ? "#f43f5e" : "#fff";
        c.beginPath(); c.arc(px, py, compact ? 1.8 : (rp.blocked ? 3.2 : 2.4), 0, 6.2832); c.fill();

        var pw = compact ? 98 : 148, phBox = compact ? 15 : 20;
        c.fillStyle = rp.blocked ? "rgba(244,63,94,0.2)" : ((i === actIdx) ? "rgba(234,179,8,0.15)" : "rgba(7,13,26,0.9)");
        c.strokeStyle = rp.blocked ? "#f43f5e" : rp.col;
        c.lineWidth = (i === actIdx || rp.blocked) ? 1.6 : 1;
        c.beginPath();
        if (c.roundRect) c.roundRect(rx, ry - phBox / 2, pw, phBox, 9);
        else c.rect(rx, ry - phBox / 2, pw, phBox);
        c.fill(); c.stroke();
        text(c, rp.name, rx + pw / 2, ry, compact ? 8 : 9, rp.blocked ? "#fecdd3" : "#e2e8f0", "center");
      });
      c.globalAlpha = 1;

      c.fillStyle = dd.hubCol || "#eab308";
      c.beginPath(); c.arc(gx, gy, compact ? 7 : 11, 0, 6.2832); c.fill();
      c.strokeStyle = "#fff"; c.lineWidth = 1.5; c.stroke();
      text(c, dd.hubLabel || "G", gx, gy, compact ? 7 : 9, "#050912", "center");
    }, { fps: 24 });
  }

  /* #33 §6.7 版（A23Tex 主題化：YC 橘單色 6 階）：Agent 子窗＋虛點鍵值列＋同步匯流排熱封包；4 槽記憶庫＝插畫預覽（md 片段顯影掃描）＋鍵值列。A23Tex 缺席時退回 legacy */
  var YC_ACC = "#f97316", SEM_RED = "#f43f5e", SEM_AMB = "#f59e0b";
  function ycAiMemory(cv, d, opt) {
    var TX = g.A23Tex;
    if (!TX) return ycAiMemoryLegacy(cv, d, opt);
    var K = TX.kit(TX.theme(YC_ACC)), V = K.V, tx = K.tx;
    var defVaults = ["decisions.md", "progress.md", "open-questions.md", "context-rules.md"];
    function splitLn(s) { s = String(s); var i = s.indexOf(" "); return i > 0 ? [s.slice(0, i), s.slice(i + 1)] : [s, ""]; }
    /* 記憶片段縮圖：標題條＋條列（槽別記號：勾選框／實點／空心點／短劃），長度由 hh 決定（決定性） */
    function memDoc(c, b, vi, col) {
      var lh = Math.max(4, Math.round(b.h / 6.5)), y = b.y + 3, kind = vi % 4;
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1;
      c.fillRect(b.x + 3, y, Math.round((b.w - 6) * (0.38 + 0.3 * K.hh(vi, 1))), Math.max(2, Math.round(lh * 0.5)));
      y += lh * 1.35;
      for (var r = 0; y + 2 < b.y + b.h - 1; r++, y += lh) {
        var ind = (r % 3 === 2) ? 5 : 0, mx = b.x + 4 + ind, my = Math.round(y) + 0.5;
        if (kind === 0) { c.strokeRect(mx - 0.5, my - 1.5, 3, 3); if (K.hh(r, 7) > 0.4) c.fillRect(mx, my - 1, 2, 2); }
        else if (kind === 1) { c.beginPath(); c.arc(mx + 1, my, 1.1, 0, 6.2832); c.fill(); }
        else if (kind === 2) { c.beginPath(); c.arc(mx + 1, my, 1.3, 0, 6.2832); c.stroke(); }
        else c.fillRect(mx - 0.5, my - 0.5, 3, 1);
        c.fillRect(mx + 5, my - 0.5, Math.max(4, (b.x + b.w - mx - 9) * (0.35 + 0.6 * K.hh(vi * 13 + r, 2))), 1.5);
      }
    }
    function agentPane(c, b, ag, f, side, t, compact) {
      var num = typeof ag.ctxPct === "number", over = num && ag.ctxPct >= 75;
      var ib = K.pane(c, b, "AGENT · " + side, compact ? "" : "context");
      K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
      if (over) { c.strokeStyle = SEM_RED; c.lineWidth = 1; K.roundRect(c, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 3); c.stroke(); }
      var y = ib.y + f * 0.8;
      c.fillStyle = ag.col || V.acc; c.beginPath(); c.arc(ib.x + 5, y, compact ? 1.8 : 2.4, 0, 6.2832); c.fill();
      c.font = "600 " + (f - 1) + "px " + K.MONO; var sw = c.measureText(String(ag.status || "")).width;
      tx(c, String(ag.status || ""), ib.x + ib.w - 4, y, f - 1, over ? SEM_RED : V.acc2, "right", "600");
      tx(c, K.fitM(c, ag.name, ib.w - 18 - sw, f + 1, "700"), ib.x + 11, y, f + 1, V.ink, "left", "700");
      y += f * 1.55;
      tx(c, K.fitM(c, ag.task || "", ib.w - 8, f, "600"), ib.x + 4, y, f, V.txt, "left", "600");
      var pct = num ? K.clamp(ag.ctxPct / 100, 0.04, 1) : (ag.strictNull ? 0 : (0.65 + 0.18 * (side === "R" ? Math.cos(t / 120 * 6.2832) : Math.sin(t / 120 * 6.2832))));
      var hot = Math.floor(t / 15) % 2, vMax = ib.w * 0.6;
      var rows = (ag.lines || []).slice(0, 2).map(function (s, i) { var p = splitLn(s); return [p[0], K.fitM(c, p[1], vMax, f, "600"), i === hot]; });
      rows.push(["ctx", (ag.strictNull && !num) ? "無資料" : (Math.round(pct * 100) + "%"), over]);
      var barY = ib.y + ib.h - 4, kTop = y + f * 0.75;
      K.kvBlock(c, { x: ib.x, y: kTop, w: ib.w, h: barY - 3 - kTop }, rows, f, side === "L" ? b.x + b.w : b.x);
      var bw = ib.w - 8, bc = num ? (ag.ctxPct >= 75 ? SEM_RED : (ag.ctxPct >= 55 ? SEM_AMB : V.acc)) : V.acc;
      c.fillStyle = V.track; c.fillRect(ib.x + 4, barY, bw, 2);
      if (pct > 0) { c.fillStyle = bc; c.fillRect(ib.x + 4, barY, bw * pct, 2); }
      c.fillStyle = V.line2; c.fillRect(Math.round(ib.x + 4 + bw * 0.55), barY - 1, 1, 4); c.fillRect(Math.round(ib.x + 4 + bw * 0.75), barY - 1, 1, 4);
      return { y: Math.round(kTop + (f + Math.max(5, Math.round(f * 0.8))) * (hot + 0.6)) };
    }
    return driver(120, function (t) {
      var dd = resolveD(d);
      var vaults = dd.vaults || defVaults;
      var L = dd.leftAgent || { name: "Claude Code", status: "writing", task: "> refactor billing", lines: ["read decisions.md", "write progress.md"], col: "#f97316" };
      var R = dd.rightAgent || { name: "Codex", status: "sync", task: "> verify billing.ts", lines: ["load context-rules.md", "zero cold-start"], col: "#38bdf8" };
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420, f = K.infoFont(w);
      var activeSlot = (typeof dd.activeSlot === "number") ? (dd.activeSlot % 4) : (Math.floor(t / 30) % 4);
      var prog = (typeof dd.activeSlot === "number") ? 1 : (t % 30) / 30;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, dd.title || "03 AI-MEMORY · Claude Code + Codex", w * (compact ? 0.95 : 0.66), f + 1, "700"), 10, 11, f + 1, V.ink, "left", "700");
      if (!compact) tx(c, dd.rightTag || "shared memory", w - 10, 11, f - 1, dd.lockConflict ? SEM_RED : V.dim, "right", "600");

      var topY = 22, topH = Math.round((h - 34) * (compact ? 0.44 : 0.36)), gap = compact ? 16 : 30;
      var boxW = (w - 20 - gap) / 2, x1 = 10, x2 = 10 + boxW + gap;
      var la = agentPane(c, { x: x1, y: topY, w: boxW, h: topH }, L, f, "L", t, compact);
      agentPane(c, { x: x2, y: topY, w: boxW, h: topH }, R, f, "R", t, compact);

      /* 同步匯流排：左右埠點之間的雙線＋熱封包（方向隨相位交替）；衝突時紅色 LOCK 徽章 */
      var mx = w * 0.5, by = la.y, gx0 = x1 + boxW + 3, gx1 = x2 - 3;
      c.strokeStyle = V.line2; c.lineWidth = 1; K.ln(c, gx0, by - 1.5, gx1, by - 1.5); K.ln(c, gx0, by + 1.5, gx1, by + 1.5);
      var dir = Math.floor(t / 60) % 2, fr = (t % 60) / 60;
      if (!dd.lockConflict) K.hotPacket(c, dir ? [[gx1, by], [gx0, by]] : [[gx0, by], [gx1, by]], fr, V.acc2, compact ? 1.8 : 2.4);
      else {
        var on = Math.floor(t / 10) % 2 === 0, lw = compact ? 14 : 24;
        c.fillStyle = on ? SEM_RED : V.pane; c.strokeStyle = SEM_RED; K.roundRect(c, mx - lw / 2, by - 6, lw, 12, 2); c.fill(); c.stroke();
        tx(c, "LOCK", mx, by + 0.5, compact ? 5 : 6.5, on ? "#ffffff" : SEM_RED, "center", "700");
      }

      /* 寫入走線：匯流排中點 → 作用槽頂端 */
      var botY = topY + topH + (compact ? 14 : 22), botH = h - botY - 8;
      var cw = (w - 20 - 18) / 4, sx = 10 + activeSlot * (cw + 6) + cw / 2;
      var wp = [[mx, by + 6], [mx, botY - (compact ? 7 : 11)], [sx, botY - (compact ? 7 : 11)], [sx, botY - 1]];
      c.strokeStyle = V.lead; c.lineWidth = 1; c.setLineDash([2, 2]); K.orthPath(c, wp, 4); c.setLineDash([]);
      K.hotPacket(c, wp, Math.min(1, prog * 1.6), V.acc, compact ? 1.6 : 2.2);

      vaults.forEach(function (vf, vi) {
        var obj = (typeof vf === "string") ? { name: vf, alert: false, detail: null } : vf;
        var b = { x: 10 + vi * (cw + 6), y: botY, w: cw, h: botH }, isAct = vi === activeSlot;
        if (isAct && !obj.alert) K.activeHalo(c, b.x, b.y, b.w, b.h, compact ? 6 : 12);
        var ib = K.pane(c, b, "SLOT " + (vi + 1), obj.alert ? "!" : (isAct ? "W" : ""));
        K.specEdge(c, b.x + 3, b.y + 1, b.w - 6);
        if (obj.alert) { c.strokeStyle = SEM_RED; c.lineWidth = 1; K.roundRect(c, b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1, 3); c.stroke(); }
        var nm = compact ? String(obj.name).replace(".md", "") : obj.name, ny = ib.y + f * 0.7;
        tx(c, K.fitM(c, nm, ib.w - 6, f, "700"), ib.x + 3, ny, f, obj.alert ? SEM_RED : (isAct ? V.acc2 : V.txt), "left", "700");
        var rowH = f + Math.max(5, Math.round(f * 0.8)), kvH = rowH * 2 + 2;
        var pb = { x: ib.x + 2, y: Math.round(ny + f * 0.9), w: ib.w - 4, h: 0 };
        pb.h = Math.max(10, Math.round(ib.y + ib.h - kvH - 3 - pb.y));
        c.fillStyle = V.bg; c.fillRect(pb.x, pb.y, pb.w, pb.h);
        c.strokeStyle = isAct ? V.line2 : V.line; c.lineWidth = 1; c.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1);
        K.dotGrid(c, pb.x, pb.y, pb.w, pb.h, compact ? 5 : 7, V.dot2);
        var inner = { x: pb.x + 2, y: pb.y + 2, w: pb.w - 4, h: pb.h - 4 };
        if (obj.alert) memDoc(c, inner, vi, SEM_RED);
        else if (isAct) K.develop(c, inner, prog, function (cc, col) { memDoc(cc, inner, vi, col); });
        else memDoc(c, inner, vi, V.mute);
        var rows = obj.detail
          ? [["state", K.fitM(c, obj.detail, ib.w * 0.62, f, "600"), !!obj.alert], ["note", K.fitM(c, obj.sub || "-", ib.w * 0.62, f, "600"), false]]
          : [["lines", String(12 + Math.floor(K.hh(vi, 3) * 40)), false], ["upd", isAct ? "now" : ((vi + 1) * 3 + "m"), isAct]];
        if (obj.ctxPct !== undefined || obj.strictNull) {
          var vNum = typeof obj.ctxPct === "number";
          var vPct = vNum ? K.clamp(obj.ctxPct / 100, 0.03, 1) : 0;
          var vCol = vNum ? (obj.ctxPct >= 75 ? SEM_RED : (obj.ctxPct >= 55 ? SEM_AMB : V.acc)) : V.dim;
          var vBarY = ib.y + ib.h - kvH - 4, vBw = ib.w - 8;
          c.fillStyle = V.track; c.fillRect(ib.x + 4, vBarY, vBw, 3);
          if (vPct > 0) { c.fillStyle = vCol; c.fillRect(ib.x + 4, vBarY, vBw * vPct, 3); }
          c.fillStyle = V.line2;
          c.fillRect(Math.round(ib.x + 4 + vBw * 0.55), vBarY - 2, 1, 7);
          c.fillRect(Math.round(ib.x + 4 + vBw * 0.75), vBarY - 2, 1, 7);
        }
        K.kvBlock(c, { x: ib.x, y: ib.y + ib.h - kvH, w: ib.w, h: kvH }, rows, f, b.x);
      });
    }, { fps: 24 });
  }

  /* #33 legacy（A23Tex 缺席時用） YC AI-MEMORY (03 AI-MEMORY) — Claude Code + Codex 雙 Agent Context 同步與 4 槽記憶庫 */
  function ycAiMemoryLegacy(cv, d, opt) {
    var defVaults = ["decisions.md", "progress.md", "open-questions.md", "context-rules.md"];
    function drawAgentCard(c, x, y, bw, bh, ag, compact, ph, phaseShift) {
      var col = ag.col || "#f97316";
      var over = ag.ctxPct != null && ag.ctxPct >= 75;
      c.fillStyle = over ? "rgba(244,63,94,0.08)" : "rgba(7,13,26,0.92)";
      c.strokeStyle = over ? "#f43f5e" : col; c.lineWidth = over ? 1.6 : 1.2;
      c.fillRect(x, y, bw, bh); c.strokeRect(x, y, bw, bh);
      text(c, ag.name, x + 8, y + 12, compact ? 8.5 : 10, over ? "#fecdd3" : col, "left");
      text(c, ag.status, x + bw - 8, y + 12, compact ? 7.5 : 8.5, over ? "#f43f5e" : col, "right");
      text(c, ag.task, x + 8, y + (compact ? 25 : 30), compact ? 7.5 : 9, "#e2e8f0", "left");
      if (!compact && ag.lines) {
        ag.lines.slice(0, 2).forEach(function (ln, li) {
          text(c, ln, x + 8, y + 44 + li * 13, 8.5, "#94a3b8", "left");
        });
      }
      var barY = y + bh - (compact ? 14 : 18), barW = bw - 16;
      c.fillStyle = "#1e293b"; c.fillRect(x + 8, barY, barW, compact ? 5 : 7);
      var pct = (typeof ag.ctxPct === "number")
        ? Math.max(0.04, Math.min(1, ag.ctxPct / 100))
        : (0.65 + 0.18 * (phaseShift ? Math.cos(ph * 6.2832) : Math.sin(ph * 6.2832)));
      var barCol = (typeof ag.ctxPct === "number")
        ? (ag.ctxPct >= 75 ? "#f43f5e" : (ag.ctxPct >= 55 ? "#f59e0b" : "#10b981"))
        : col;
      c.fillStyle = barCol; c.fillRect(x + 8, barY, barW * pct, compact ? 5 : 7);
      if (typeof ag.ctxPct === "number") {
        text(c, "CTX " + Math.round(ag.ctxPct) + "%", x + bw - 8, barY - 7, 7.5, barCol, "right");
      }
    }
    return driver(120, function (t) {
      var dd = resolveD(d);
      var vaults = dd.vaults || defVaults;
      var L = dd.leftAgent || { name: "Claude Code", status: "writing", task: "> refactor billing", lines: ["read decisions.md", "write progress.md"], col: "#f97316" };
      var R = dd.rightAgent || { name: "Codex", status: "sync", task: "> verify billing.ts", lines: ["load context-rules.md", "zero cold-start"], col: "#38bdf8" };
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420;
      var ph = t / 120;
      var activeSlot = (typeof dd.activeSlot === "number") ? (dd.activeSlot % 4) : (Math.floor(t / 30) % 4);
      text(c, dd.title || "03 AI-MEMORY · Claude Code + Codex", 10, 12, compact ? 9 : 11, dd.titleCol || "#38bdf8", "left");
      if (!compact) text(c, dd.rightTag || "shared memory", w - 10, 12, 9.5, dd.lockConflict ? "#f43f5e" : "#38bdf8", "right");

      var topY = 24, topH = (h - 36) * 0.56;
      var boxW = (w - 32) * 0.5;
      var x1 = 10, x2 = 22 + boxW;

      drawAgentCard(c, x1, topY, boxW, topH, L, compact, ph, false);
      drawAgentCard(c, x2, topY, boxW, topH, R, compact, ph, true);

      var mx = w * 0.5, my = topY + topH * 0.5;
      var flash = dd.lockConflict && (Math.floor(t / 10) % 2 === 0);
      c.fillStyle = dd.lockConflict ? (flash ? "#f43f5e" : "#4c0519") : "#0b1220";
      c.strokeStyle = dd.lockConflict ? "#f43f5e" : "#94a3b8";
      var bw = dd.lockConflict ? 34 : 14;
      c.fillRect(mx - bw / 2, my - 8, bw, 16); c.strokeRect(mx - bw / 2, my - 8, bw, 16);
      text(c, dd.lockConflict ? "LOCK!" : "⇄", mx, my, dd.lockConflict ? 7.5 : 9, "#f8fafc", "center");

      var botY = topY + topH + 10, botH = h - botY - 8;
      var cw = (w - 20 - 18) / 4;
      vaults.forEach(function (vf, vi) {
        var obj = (typeof vf === "string") ? { name: vf, alert: false, detail: null } : vf;
        var cx = 10 + vi * (cw + 6);
        var isAct = obj.alert || vi === activeSlot;
        var stroke = obj.alert ? "#f43f5e" : (isAct ? "#f97316" : "#334155");
        c.fillStyle = obj.alert ? "rgba(244,63,94,0.16)" : (isAct ? "rgba(249,115,22,0.14)" : "rgba(7,13,26,0.9)");
        c.strokeStyle = stroke;
        c.lineWidth = isAct ? 1.4 : 1;
        c.fillRect(cx, botY, cw, botH); c.strokeRect(cx, botY, cw, botH);
        var label = compact ? obj.name.replace(".md", "") : obj.name;
        text(c, label, cx + 5, botY + 10, compact ? 7 : 8.5, obj.alert ? "#fecdd3" : (isAct ? "#f97316" : "#e2e8f0"), "left");
        if (obj.detail && !compact) {
          text(c, obj.detail, cx + 5, botY + 25, 8, obj.alert ? "#f43f5e" : "#94a3b8", "left");
          if (obj.sub) text(c, obj.sub, cx + 5, botY + 38, 7.5, "#64748b", "left");
        } else {
          for (var l = 0; l < 3; l++) {
            var ly = botY + 20 + l * (compact ? 6 : 8);
            if (ly < botY + botH - 4) {
              c.fillStyle = obj.alert ? "#f43f5e" : (isAct ? "#f97316" : "#475569");
              c.fillRect(cx + 5, ly, (cw - 12) * (0.85 - l * 0.18), 2.5);
            }
          }
        }
      });
    }, { fps: 24 });
  }

  /* #34 §6.7 版（YC 橘單色）：VOICE 子窗（錄製聲波＋發光播放頭＋dur 鍵值列）→虛點引導→NOTE PREVIEW（結構化筆記插畫顯影＋dur/chars/items/sync）＋TRANSCRIPT（逐行顯影＋時間戳虛點引導列＋埠點）；A23Tex 缺席退回 legacy */
  function ycVoiceNote(cv, d, opt) {
    var TX = g.A23Tex;
    if (!TX) return ycVoiceNoteLegacy(cv, d, opt);
    var K = TX.kit(TX.theme(YC_ACC)), V = K.V, tx = K.tx, SEM_GRN = "#10b981";
    var defLines = [
      { txt: "decisions 11/14", col: "#a78bfa" },
      { txt: "• call with YC founder", col: "#e2e8f0" },
      { txt: "• ask about pricing tier", col: "#e2e8f0" },
      { txt: "• sync to vault/notes.md", col: "#10b981" }
    ];
    function mmss(v) { v = Math.max(0, Math.round(v)); return Math.floor(v / 60) + ":" + ("0" + v % 60).slice(-2); }
    /* 結構化筆記插畫：標題條＋日期 chip＋勾選列＋標籤 chip（決定性） */
    function noteArt(c, b, col, lit) {
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 1;
      var u = Math.max(3, Math.round(b.h / 11));
      c.fillRect(b.x + 2, b.y + 2, b.w * 0.5, Math.max(2, u * 0.7));
      c.strokeRect(b.x + b.w - u * 4 - 2.5, b.y + 1.5, u * 4, u);
      var n = 4, top = b.y + u * 2.4, lh = (b.h - u * 2.4 - u * 2.2) / n;
      for (var i = 0; i < n; i++) {
        var y = Math.round(top + lh * (i + 0.5)), bx = b.x + 3, sq = Math.max(3, Math.min(u, lh * 0.6));
        c.strokeRect(bx + 0.5, Math.round(y - sq / 2) + 0.5, sq, sq);
        if (lit && i < 2) c.fillRect(bx + 1.5, Math.round(y - sq / 2) + 1.5, sq - 2, sq - 2);
        c.fillRect(bx + sq + 5, y - 0.75, (b.w - sq - 12) * (0.4 + 0.55 * K.hh(i, 21)), 1.5);
      }
      var cx = b.x + 2, cy = b.y + b.h - u * 1.4;
      for (var j = 0; j < 3; j++) { var cw = b.w * (0.16 + 0.1 * K.hh(j, 33)); K.roundRect(c, cx + 0.5, cy + 0.5, cw, u, u / 2); c.stroke(); cx += cw + 4; }
    }
    return driver(120, function (t) {
      var dd = resolveD(d), live = !dd.lines, lines = (dd.lines || defLines).slice(0, 6), nL = Math.max(1, lines.length);
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420, f = K.infoFont(w), ph = t / 120, gp = compact ? 6 : 8, alert = !!dd.alert;
      var rowH = f + Math.max(5, Math.round(f * 0.8)), hot = alert ? SEM_RED : V.acc;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, dd.title || "04 AGENT-SECOND-BRAIN · voice -> note", w * (compact ? 0.95 : 0.66), f + 1, "700"), 10, 11, f + 1, V.ink, "left", "700");
      if (!compact) tx(c, K.fitM(c, dd.channel || "Telegram", w * 0.28, f - 1, "600"), w - 10, 11, f - 1, dd.channelCol || V.dim, "right", "600");
      var durS = String(dd.duration || "0:38"), dp = durS.split(":"), secs = (dp.length > 1 ? (+dp[0]) * 60 + (+dp[1]) : +dp[0]) || 0;
      var prog = Math.min(1, ph * 1.1), pS = mmss(prog * secs), done = ph >= 0.92;

      /* VOICE 子窗：錄製聲波（靜態包絡）＋發光播放頭 */
      var topY = 20, topH = Math.round((h - 28) * (compact ? 0.48 : 0.44)), lw = Math.round((w - 20 - gp) * 0.38);
      var vb = { x: 10, y: topY, w: lw, h: topH }, vi = K.pane(c, vb, "VOICE", compact ? K.fitM(c, dd.channel || "Telegram", lw * 0.5, 5.4, "400") : (done ? "saved" : "rec"));
      K.specEdge(c, vb.x + 3, vb.y + 1, vb.w - 6);
      if (alert) { c.strokeStyle = K.rgba(SEM_RED, 0.85); c.lineWidth = 1; K.roundRect(c, vb.x + 0.5, vb.y + 0.5, vb.w - 1, vb.h - 1, 3); c.stroke(); }
      var vy = vi.y + f * 0.8;
      c.fillStyle = hot; c.globalAlpha = Math.floor(t / 10) % 2 === 0 || done ? 1 : 0.35;
      c.beginPath(); c.arc(vi.x + 7, vy, compact ? 2 : 3, 0, 6.2832); c.fill(); c.globalAlpha = 1;
      tx(c, K.fitM(c, String(dd.voiceTag || "● voice note").replace(/^●\s*/, ""), vi.w - 20, f, "700"), vi.x + 14, vy, f, alert ? SEM_RED : V.ink, "left", "700");
      var cy0 = vy + f * 0.9;
      if (dd.sourceLines && !compact) {
        var srcN = Math.min(3, dd.sourceLines.length), sH = Math.min(rowH, (vi.h - f * 2 - rowH * 2 - 30) / Math.max(1, srcN));
        dd.sourceLines.slice(0, srcN).forEach(function (sl, si) {
          var yy = Math.round(cy0 + sH * (si + 0.5));
          c.fillStyle = V.line2; c.fillRect(vi.x + 5, yy - sH * 0.4, 1, sH * 0.8);
          tx(c, K.fitM(c, sl, vi.w - 16, f - 0.5, "400"), vi.x + 10, yy, f - 0.5, V.txt, "left");
        });
        cy0 += sH * srcN + 2;
      }
      var kvHV = rowH + 2, wb = { x: vi.x + 3, y: Math.round(cy0 + 2), w: vi.w - 6, h: Math.round(vi.y + vi.h - kvHV - 3 - (cy0 + 2)) };
      if (wb.h >= 10) {
        c.fillStyle = V.bg; c.fillRect(wb.x, wb.y, wb.w, wb.h);
        c.strokeStyle = V.line2; c.lineWidth = 1; c.strokeRect(wb.x + 0.5, wb.y + 0.5, wb.w - 1, wb.h - 1);
        K.dotGrid(c, wb.x, wb.y, wb.w, wb.h, 7, V.dot2);
        var mid = Math.round(wb.y + wb.h / 2) + 0.5, step = compact ? 3 : 4, nb = Math.floor((wb.w - 6) / step), headX = wb.x + 3 + (wb.w - 6) * prog;
        c.strokeStyle = V.line; K.ln(c, wb.x + 2, mid, wb.x + wb.w - 2, mid);
        for (var bi = 0; bi < nb; bi++) {
          var bx = wb.x + 3 + bi * step, env = (0.2 + 0.8 * Math.abs(Math.sin(bi * 0.21 + 0.6))) * (0.45 + 0.55 * K.hh(bi, 4));
          var amp = Math.max(1, env * wb.h * 0.42), past = bx <= headX, near = Math.abs(bx - headX) < step * 2.5;
          if (near && !done) amp = Math.min(wb.h * 0.46, amp * (1.1 + 0.25 * Math.sin(t * 0.9 + bi)));
          c.fillStyle = past ? (near ? V.acc3 : hot) : V.line2;
          c.fillRect(bx, mid - amp, Math.max(1, step - 1.5), amp * 2);
        }
        c.save(); c.shadowColor = K.rgba(hot, 0.75); c.shadowBlur = compact ? 3 : 6; c.fillStyle = "#ffffff"; c.fillRect(Math.round(headX), wb.y + 2, 1, wb.h - 4); c.restore();
      }
      K.kvBlock(c, { x: vi.x, y: vi.y + vi.h - kvHV, w: vi.w, h: kvHV }, [["dur", pS + " / " + durS, !done]], f, vb.x);

      /* NOTE PREVIEW 子窗：插畫顯影＋鍵值列 */
      var visCount = live ? Math.min(nL, Math.floor(ph * (nL + 1)) + 1) : nL, nChars = 0, nItems = 0;
      for (var q = 0; q < visCount; q++) { var ts = String(lines[q].txt); nChars += ts.replace(/\s/g, "").length; if (/^[•\-*]/.test(ts)) nItems++; }
      var syncOk = ph > 0.6;
      var nb2 = { x: vb.x + lw + gp, y: topY, w: w - 20 - lw - gp, h: topH };
      var ni = K.pane(c, nb2, "NOTE PREVIEW", K.fitM(c, dd.cardTitle || "/transcription", nb2.w * 0.5, 5.4, "400"));
      K.specEdge(c, nb2.x + 3, nb2.y + 1, nb2.w - 6);
      var pb = { x: ni.x + 2, y: ni.y + 1, w: Math.round(ni.w * (compact ? 0.52 : 0.5)), h: ni.h - 3 };
      c.fillStyle = V.bg; c.fillRect(pb.x, pb.y, pb.w, pb.h);
      c.strokeStyle = V.line2; c.lineWidth = 1; c.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1);
      K.dotGrid(c, pb.x, pb.y, pb.w, pb.h, 7, V.dot2);
      var ib = { x: pb.x + 4, y: pb.y + 4, w: pb.w - 8, h: pb.h - 8 };
      K.develop(c, ib, Math.min(1, ph * 1.25), function (cc, col, lit) { noteArt(cc, ib, col, lit); });
      var kvR = compact ? [["chars", nChars, false], ["items", nItems, false], ["sync", syncOk ? "ok" : "…", syncOk]]
        : [["dur", durS, false], ["chars", nChars, false], ["items", nItems, false], ["sync", syncOk ? "vault ok" : "pending", syncOk]];
      var kvH = rowH * kvR.length + 2, kx = pb.x + pb.w + 4;
      K.kvBlock(c, { x: kx, y: Math.round(ni.y + (ni.h - kvH) / 2), w: ni.x + ni.w - kx, h: kvH }, kvR, f, nb2.x + nb2.w);
      /* 虛點引導：聲波 → 筆記預覽，轉寫中跑熱封包 */
      var gyA = wb.h >= 10 ? Math.round(wb.y + wb.h / 2) + 0.5 : Math.round(vb.y + vb.h / 2) + 0.5, gyB = Math.round(pb.y + pb.h / 2) + 0.5, gmx = vb.x + vb.w + gp / 2;
      var gpts = [[vb.x + vb.w, gyA], [gmx, gyA], [gmx, gyB], [nb2.x, gyB]];
      c.setLineDash([1, 2]); c.strokeStyle = V.acc2; c.lineWidth = 1; K.orthPath(c, gpts, 2); c.setLineDash([]);
      K.kvPort(c, vb.x + vb.w, gyA, !done); K.kvPort(c, nb2.x, gyB, !done);
      if (!done) K.hotPacket(c, gpts, (t % 24) / 24, V.acc2, compact ? 1.8 : 2.4);

      /* TRANSCRIPT 子窗：逐行顯影＋時間戳虛點引導列 */
      var by = topY + topH + gp, tb = { x: 10, y: by, w: w - 20, h: h - by - 8 };
      var ti = K.pane(c, tb, "TRANSCRIPT", visCount + "/" + nL + " lines");
      K.specEdge(c, tb.x + 3, tb.y + 1, tb.w - 6);
      var bdgH = rowH + 2, avail = ti.h - bdgH - 2, rh = Math.min(rowH * 1.9, avail / Math.max(4, nL));
      var typing = live && !done, actL = typing ? visCount - 1 : Math.floor(t / 30) % nL, lp = (ph * (nL + 1)) % 1;
      lines.forEach(function (ln0, li) {
        var ry = Math.round(ti.y + 1 + rh * (li + 0.5)), x0 = ti.x + 12;
        if (li >= visCount) { c.fillStyle = V.track; c.fillRect(x0, ry - 1, (ti.w - 30) * (0.3 + 0.35 * K.hh(li, 17)), 2); K.kvPort(c, tb.x, ry, false); return; }
        var isA = li === actL, str = K.fitM(c, String(ln0.txt).replace(/^•\s*/, ""), ti.w * 0.78, f, li === 0 ? "700" : "600"), stamp = mmss(secs * (li + 1) / (nL + 1));
        if (isA) { c.fillStyle = V.track; c.fillRect(ti.x + 2, ry - rh * 0.42, ti.w - 4, rh * 0.84); c.fillStyle = hot; c.fillRect(ti.x + 2, ry - rh * 0.42, 2, rh * 0.84); }
        c.fillStyle = ln0.col || V.acc; c.beginPath(); c.arc(ti.x + 7.5, ry, compact ? 1.5 : 2, 0, 6.2832); c.fill();
        if (isA && typing) {
          var nc = Math.max(1, Math.ceil(str.length * Math.min(1, lp * 1.6))), sub = str.slice(0, nc);
          tx(c, sub, x0, ry, f, V.ink, "left", li === 0 ? "700" : "600");
          c.font = (li === 0 ? "700 " : "600 ") + f + "px " + K.MONO;
          if (nc < str.length && Math.floor(t / 4) % 2 === 0) { c.fillStyle = V.acc2; c.fillRect(x0 + 1 + c.measureText(sub).width, ry - f * 0.45, Math.max(1, f * 0.5), f * 0.9); }
          tx(c, stamp, ti.x + ti.w - 5, ry, f, V.ink, "right", "600");
        } else if (li === 0) {
          tx(c, str, x0, ry, f, V.ink, "left", "700");
          c.font = "700 " + f + "px " + K.MONO; var hw = c.measureText(str).width; c.font = "600 " + f + "px " + K.MONO;
          var sw = c.measureText(stamp).width; tx(c, stamp, ti.x + ti.w - 5, ry, f, isA ? V.ink : V.txt, "right", "600");
          c.setLineDash([1, 2]); c.strokeStyle = V.lead; c.lineWidth = 1; K.ln(c, x0 + hw + 3, ry + 0.5, ti.x + ti.w - 8 - sw, ry + 0.5); c.setLineDash([]);
        } else K.leader(c, str, stamp, x0, ti.x + ti.w - 5, ry, f, isA);
        K.kvPort(c, tb.x, ry, isA);
      });
      var btns = dd.badges || ["[Done]", "[Sync]"], bx2 = ti.x + 4, byy = ti.y + ti.h - bdgH / 2 - 1;
      btns.slice(0, 4).forEach(function (b, i) {
        var bt = typeof b === "string" ? b : b.txt, bc = typeof b === "string" ? (i === 1 && syncOk ? SEM_GRN : (i === 0 && done ? V.acc2 : V.dim)) : (b.col || V.dim);
        c.font = "600 " + f + "px " + K.MONO; var bw = c.measureText(bt).width + 10;
        if (bx2 + bw > ti.x + ti.w) return;
        c.fillStyle = K.rgba(bc, 0.1); K.roundRect(c, bx2, byy - bdgH * 0.4, bw, bdgH * 0.8, 3); c.fill();
        c.strokeStyle = K.rgba(bc, 0.55); c.lineWidth = 1; K.roundRect(c, bx2 + 0.5, byy - bdgH * 0.4 + 0.5, bw - 1, bdgH * 0.8 - 1, 3); c.stroke();
        tx(c, bt, bx2 + 5, byy, f, bc, "left", "600"); bx2 += bw + 6;
      });
    }, { fps: 24 });
  }

  /* #34 legacy（A23Tex 缺席時用） YC AGENT-SECOND-BRAIN — 手機語音聲波 (0:38) 轉結構化筆記 */
  function ycVoiceNoteLegacy(cv, d, opt) {
    var defLines = [
      { txt: "decisions 11/14", col: "#a78bfa" },
      { txt: "• call with YC founder", col: "#e2e8f0" },
      { txt: "• ask about pricing tier", col: "#e2e8f0" },
      { txt: "• sync to vault/notes.md", col: "#10b981" }
    ];
    return driver(120, function (t) {
      var dd = resolveD(d);
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420;
      var ph = t / 120;
      text(c, dd.title || "04 AGENT-SECOND-BRAIN · voice -> note", 10, 12, compact ? 9 : 11, dd.titleCol || "#38bdf8", "left");
      if (!compact) text(c, dd.channel || "Telegram", w - 10, 12, 9.5, dd.channelCol || "#38bdf8", "right");

      var topY = 24, boxH = h - 32;
      var pw = Math.min(w * 0.42, 175);
      var px = 10;

      // Phone / Ticket Inbox frame
      c.fillStyle = "rgba(7,13,26,0.95)";
      c.strokeStyle = dd.alert ? "#f43f5e" : "#334155"; c.lineWidth = dd.alert ? 1.6 : 1.4;
      c.beginPath();
      if (c.roundRect) c.roundRect(px, topY, pw, boxH, 12);
      else c.rect(px, topY, pw, boxH);
      c.fill(); c.stroke();
      c.fillStyle = "#334155";
      c.fillRect(px + pw * 0.35, topY + 4, pw * 0.3, 3);
      text(c, dd.voiceTag || "● voice note", px + 10, topY + 18, compact ? 7.5 : 9, dd.alert ? "#f43f5e" : "#38bdf8", "left");

      if (!compact && dd.sourceLines) {
        dd.sourceLines.slice(0, 3).forEach(function (sl, si) {
          text(c, sl, px + 10, topY + 34 + si * 14, 8.2, "#cbd5e1", "left");
        });
      }

      // Waveform pill inside phone
      var wy = topY + boxH - (compact ? 32 : 42), wh = compact ? 22 : 28;
      c.fillStyle = dd.alert ? "rgba(244,63,94,0.14)" : "rgba(14,165,233,0.16)";
      c.strokeStyle = dd.alert ? "#f43f5e" : "#38bdf8"; c.lineWidth = 1;
      c.fillRect(px + 8, wy, pw - 16, wh); c.strokeRect(px + 8, wy, pw - 16, wh);
      var bars = compact ? 14 : 20;
      for (var bi = 0; bi < bars; bi++) {
        var bx = px + 16 + bi * ((pw - 32) / bars);
        var amp = (0.25 + 0.75 * Math.abs(Math.sin(ph * 12 + bi * 0.65))) * (wh - 8);
        c.fillStyle = (bi / bars <= ph) ? (dd.alert ? "#f43f5e" : "#38bdf8") : "#475569";
        c.fillRect(bx, wy + (wh - amp) * 0.5, 2, amp);
      }
      text(c, dd.duration || "0:38", px + pw - 10, wy - 6, 7.5, "#94a3b8", "right");

      // Right transcription / ticket extraction card
      var rx = px + pw + 12, rw = w - rx - 10;
      text(c, dd.cardTitle || "/transcription", rx, topY + 10, compact ? 8 : 9.5, "#94a3b8", "left");
      c.fillStyle = "rgba(7,13,26,0.92)";
      c.strokeStyle = dd.alert ? "#f43f5e" : "#a78bfa"; c.lineWidth = 1.2;
      c.fillRect(rx, topY + 18, rw, boxH - 18); c.strokeRect(rx, topY + 18, rw, boxH - 18);

      var lines = dd.lines || defLines;
      var visCount = dd.lines ? lines.length : Math.min(lines.length, Math.floor(ph * (lines.length + 1)) + 1);
      for (var li = 0; li < visCount; li++) {
        text(c, lines[li].txt, rx + 8, topY + 34 + li * (compact ? 14 : 18), compact ? 7.5 : 9, lines[li].col || "#e2e8f0", "left");
      }

      var btns = dd.badges || ["[Done]", "[Sync]"];
      btns.forEach(function (b, i) {
        var by = topY + boxH - (compact ? 14 : 18);
        var txt = (typeof b === "string") ? b : b.txt;
        var bCol = (typeof b === "string") ? (i === 1 && ph > 0.6 ? "#10b981" : "#64748b") : b.col;
        text(c, txt, rx + 8 + i * 62, by, compact ? 7.5 : 8.5, bCol, "left");
      });
    }, { fps: 24 });
  }

  /* #35 §6.7 版（YC 橘單色）：排程圓盤子窗＋「本夜任務」子窗（修正→規則 插畫顯影＋虛點鍵值列）＋計數器作用光暈＋rules.md 虛點引導列；A23Tex 缺席退回 legacy */
  function ycNightlyPass(cv, d, opt) {
    var TX = g.A23Tex;
    if (!TX) return ycNightlyPassLegacy(cv, d, opt);
    var K = TX.kit(TX.theme(YC_ACC)), V = K.V, tx = K.tx;
    var defMetrics = [{ k: "corrections today", n: 4 }, { k: "new rules", n: 3 }, { k: "vaults synced", n: 5 }, { k: "stale pruned", n: 2 }];
    var defRules = ["+ always use metric units", "+ never run dropped queries", "+ cite the exact source", "+ short direct replies"];
    /* 插畫：左＝修正紀錄（刪除線），右＝收斂後規則（「+」前綴實線）；col 由 develop 傳入 */
    function sinterArt(c, b, col, lit) {
      /* 筆畫隨窗寬加粗（640 寬約 2px），修正 640 寬筆畫偏細淡（稽核 v3 #35 瑕疵①） */
      var n = 4, lh = b.h / (n + 0.6), half = b.w * 0.44, sw = Math.max(1, Math.min(2.2, b.w / 80));
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = sw; c.lineCap = "round";
      for (var i = 0; i < n; i++) {
        var y = Math.round(b.y + lh * (i + 0.8)) + 0.5, lw = half * (0.5 + 0.45 * K.hh(i, 5));
        c.fillRect(b.x + 3, y - sw * 0.6, lw - 3, sw * 1.3);
        c.beginPath(); c.moveTo(b.x + 2, y + 1.8 * sw); c.lineTo(b.x + lw + 1, y - 1.8 * sw); c.stroke();
      }
      var ax = b.x + half + 3, ay = b.y + b.h / 2, al = b.w * 0.08, ah = 2.5 * sw;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(ax + al, ay); c.stroke();
      c.beginPath(); c.moveTo(ax + al - ah, ay - ah); c.lineTo(ax + al, ay); c.lineTo(ax + al - ah, ay + ah); c.stroke();
      var rx = b.x + b.w * 0.58, pk = 2 * sw;
      for (var j = 0; j < 3; j++) {
        var ry = Math.round(b.y + (b.h / 3.4) * (j + 0.9)) + 0.5;
        c.fillRect(rx - sw / 2, ry - pk, sw, pk * 2); c.fillRect(rx - pk, ry - sw / 2, pk * 2, sw);
        c.fillRect(rx + pk + 4, ry - sw * 0.6, (b.x + b.w - rx - pk - 7) * (0.6 + 0.4 * K.hh(j, 9)), sw * 1.3);
      }
      c.lineCap = "butt";
    }
    return driver(120, function (t) {
      var dd = resolveD(d), live = !dd.metrics;
      var metrics = dd.metrics || defMetrics, rules = dd.rules || defRules;
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420, f = K.infoFont(w), ph = t / 120;
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, dd.title || "05 OMNI-SECOND-BRAIN · nightly pass", w * (compact ? 0.95 : 0.62), f + 1, "700"), 10, 11, f + 1, V.ink, "left", "700");
      if (!compact) tx(c, dd.rightTag || "corrections -> rules", w - 10, 11, f - 1, V.dim, "right", "600");
      var state = ph < 0.92 ? "running" : "done";

      var topY = 22, midY = Math.round(h * 0.56), th = midY - topY;
      var dW = Math.round(w * (compact ? 0.34 : 0.25)), tW = compact ? 0 : Math.round(w * 0.32), gp = compact ? 6 : 8;
      /* 圓盤子窗 */
      var db = { x: 10, y: topY, w: dW, h: th }, di = K.pane(c, db, "SCHEDULER", compact ? state : "cron");
      K.specEdge(c, db.x + 3, db.y + 1, db.w - 6);
      var cx = di.x + di.w / 2, cy = di.y + di.h / 2 + 1, R = Math.max(8, Math.min(di.w, di.h) * 0.4);
      c.strokeStyle = V.track; c.lineWidth = compact ? 3 : 5; c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke();
      for (var ti = 0; ti < 24; ti++) {
        var ang = (ti / 24) * 6.2832 - 1.5708, maj = ti % 6 === 0;
        c.strokeStyle = maj ? V.dim : V.line2; c.lineWidth = 1;
        K.ln(c, cx + Math.cos(ang) * (R - (maj ? 9 : 6)), cy + Math.sin(ang) * (R - (maj ? 9 : 6)), cx + Math.cos(ang) * (R - 4), cy + Math.sin(ang) * (R - 4));
      }
      var a0 = -1.5708 + (2 / 24) * 6.2832, a1 = a0 + (0.04 + ph * 0.1) * 6.2832;
      c.save(); c.shadowColor = K.rgba(V.acc, 0.6); c.shadowBlur = compact ? 4 : 8;
      c.strokeStyle = V.acc; c.lineWidth = compact ? 3 : 5; c.lineCap = "round"; c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke(); c.restore(); c.lineCap = "butt";
      var sweep = -1.5708 + ph * 6.2832;
      c.strokeStyle = V.ink; c.lineWidth = 1; K.ln(c, cx, cy, cx + Math.cos(sweep) * (R - 8), cy + Math.sin(sweep) * (R - 8));
      c.fillStyle = V.acc2; c.beginPath(); c.arc(cx, cy, 2, 0, 6.2832); c.fill();
      tx(c, dd.clockLabel || "02:00", cx, cy + R * 0.42, f, V.ink, "center", "700");

      /* 本夜任務子窗（桌面） */
      var tb = { x: db.x + dW + gp, y: topY, w: tW, h: th };
      if (!compact) {
        var tbi = K.pane(c, tb, "TONIGHT", state);
        K.specEdge(c, tb.x + 3, tb.y + 1, tb.w - 6);
        var rowH = f + Math.max(5, Math.round(f * 0.8)), kvH = rowH * 4 + 2;
        var pb = { x: tbi.x + 2, y: tbi.y + 1, w: tbi.w - 4, h: Math.max(14, tbi.h - kvH - 4) };
        c.fillStyle = V.bg; c.fillRect(pb.x, pb.y, pb.w, pb.h);
        c.strokeStyle = V.line2; c.lineWidth = 1; c.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1);
        K.dotGrid(c, pb.x, pb.y, pb.w, pb.h, 7, V.dot2);
        var ib = { x: pb.x + 3, y: pb.y + 3, w: pb.w - 6, h: pb.h - 6 };
        K.develop(c, ib, Math.min(1, ph * 1.15), function (cc, col) { sinterArt(cc, ib, col); });
        var secs = Math.round(ph * 14 * 60), dur = ("0" + Math.floor(secs / 60)).slice(-2) + ":" + ("0" + (secs % 60)).slice(-2);
        K.kvBlock(c, { x: tbi.x, y: tbi.y + tbi.h - kvH, w: tbi.w, h: kvH },
          [["job", "nightly-pass", false], ["next", dd.clockLabel || "02:00", false], ["dur", dur, state === "running"], ["state", state, state === "done"]], f, tb.x);
      }
      /* 計數器子窗：作用列光暈＋點陣逐步點亮 */
      var mbx = compact ? db.x + dW + gp : tb.x + tW + gp, mb = { x: mbx, y: topY, w: w - 10 - mbx, h: th };
      var mi0 = K.pane(c, mb, "COUNTERS", dd.showNums ? "live" : "tonight");
      K.specEdge(c, mb.x + 3, mb.y + 1, mb.w - 6);
      var actM = Math.floor(t / 30) % Math.max(1, metrics.length), mh = mi0.h / Math.max(1, metrics.length);
      var dotR = compact ? 1.9 : 2.6, dotS = compact ? 5.5 : 8, numW = (dd.showNums || metrics.some(function (m) { return m.n > 8; })) ? (compact ? 14 : 24) : 0;
      c.font = "600 " + f + "px " + K.MONO;
      var labW = Math.min(mi0.w * 0.5, metrics.reduce(function (mx, m) { return Math.max(mx, c.measureText(K.fitM(c, m.k, mi0.w * 0.5, f, "600")).width); }, 0));
      var dotR2 = Math.min(compact ? 2.4 : 3.4, Math.max(dotR, (mi0.w - 20 - labW - numW) / 8 * 0.3));
      metrics.forEach(function (m, mi) {
        var my = Math.round(mi0.y + mh * (mi + 0.5)), isA = mi === actM;
        if (isA) K.activeHalo(c, mi0.x + 3, my - mh * 0.32, mi0.w - 6, mh * 0.64, compact ? 5 : 9);
        K.kvPort(c, mb.x, my, isA);
        tx(c, K.fitM(c, m.k, mi0.w * 0.5, f, "600"), mi0.x + 6, my, f, isA ? V.ink : V.dim, "left", "600");
        var show = Math.min(8, m.n), lit = live ? Math.min(show, Math.floor(Math.min(1, ph * 1.25) * (show + 0.999))) : show;
        /* 點陣撐滿標籤右側到數字欄（修正點陣靠右、左側留白；稽核 v3 #35 瑕疵②） */
        var dx0 = mi0.x + 6 + labW + 8 + dotR2, dS = Math.max(dotS, (mi0.x + mi0.w - 6 - numW - (numW ? 4 : 0) - dotR2 - dx0) / 7);
        for (var k = 0; k < 8; k++) {
          var px = dx0 + k * dS, dotR = dotR2;
          if (k < show && k < lit) { c.fillStyle = isA ? V.acc2 : V.acc; c.beginPath(); c.arc(px, my, dotR, 0, 6.2832); c.fill(); }
          else if (k < show) { c.strokeStyle = V.line2; c.lineWidth = 1; c.beginPath(); c.arc(px, my, dotR - 0.5, 0, 6.2832); c.stroke(); }
          else { c.strokeStyle = V.lead; c.lineWidth = 1; c.beginPath(); c.arc(px, my, Math.max(1, dotR - 1.2), 0, 6.2832); c.stroke(); }
        }
        if (numW) tx(c, String(m.n), mi0.x + mi0.w - 5, my, f, isA ? V.ink : V.txt, "right", "700");
      });

      /* rules.md 子窗：虛點引導列＋作用列逐字顯影 */
      var by = midY + (compact ? 6 : 8), rb = { x: 10, y: by, w: w - 20, h: h - by - 8 };
      var ri0 = K.pane(c, rb, "RULES.MD", rules.length + " rules");
      K.specEdge(c, rb.x + 3, rb.y + 1, rb.w - 6);
      var hy = ri0.y + f * 0.7;
      tx(c, K.fitM(c, dd.rulesHeader || "rules.md · agent follows these", ri0.w - 10, f, "700"), ri0.x + 5, hy, f, V.txt, "left", "700");
      var showRules = rules.slice(-4), actR = Math.floor(t / 30) % Math.max(1, showRules.length), rp = (t % 30) / 30;
      var rTop = hy + f * 0.9, rh = (ri0.y + ri0.h - rTop) / Math.max(1, showRules.length);
      showRules.forEach(function (rl, ri) {
        var ry = Math.round(rTop + rh * (ri + 0.5)), isA = ri === actR, id = "r" + ("0" + (rules.length - showRules.length + ri + 1)).slice(-2);
        var str = K.fitM(c, rl, ri0.w * 0.78, f, "600");
        if (isA) {
          c.fillStyle = V.track; c.fillRect(ri0.x + 2, ry - rh * 0.42, ri0.w - 4, rh * 0.84);
          c.fillStyle = V.acc; c.fillRect(ri0.x + 2, ry - rh * 0.42, 2, rh * 0.84);
          var nc = Math.max(1, Math.ceil(str.length * Math.min(1, rp * 1.8))), sub = str.slice(0, nc);
          tx(c, sub, ri0.x + 9, ry, f, V.ink, "left", "600");
          c.font = "600 " + f + "px " + K.MONO; var cw2 = c.measureText(sub).width;
          if (nc < str.length && Math.floor(t / 4) % 2 === 0) { c.fillStyle = V.acc2; c.fillRect(ri0.x + 10 + cw2, ry - f * 0.45, Math.max(1, f * 0.5), f * 0.9); }
          tx(c, id, ri0.x + ri0.w - 5, ry, f, V.ink, "right", "600");
        } else K.leader(c, str, id, ri0.x + 9, ri0.x + ri0.w - 5, ry, f, false);
        K.kvPort(c, rb.x, ry, isA);
      });
    }, { fps: 24 });
  }

  /* #35 legacy（A23Tex 缺席時用） YC OMNI-SECOND-BRAIN (05 OMNI-SECOND-BRAIN) — 02:00 夜間排程圓盤＋圓點計數器＋規則收斂 */
  function ycNightlyPassLegacy(cv, d, opt) {
    var defMetrics = [
      { k: "corrections today", n: 4, col: "#f43f5e" },
      { k: "new rules", n: 3, col: "#f97316" },
      { k: "vaults synced", n: 5, col: "#a78bfa" },
      { k: "stale pruned", n: 2, col: "#10b981" }
    ];
    var defRules = [
      "+ always use metric units",
      "+ never run dropped queries",
      "+ cite the exact source",
      "+ short direct replies"
    ];
    return driver(120, function (t) {
      var dd = resolveD(d);
      var metrics = dd.metrics || defMetrics;
      var rules = dd.rules || defRules;
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420;
      var ph = t / 120;
      text(c, dd.title || "05 OMNI-SECOND-BRAIN · nightly pass", 10, 12, compact ? 9 : 11, dd.titleCol || "#f43f5e", "left");
      if (!compact) text(c, dd.rightTag || "corrections -> rules", w - 10, 12, 9.5, dd.titleCol || "#f43f5e", "right");

      var topY = 24, midY = h * 0.56;
      var cx = compact ? w * 0.24 : w * 0.22, cy = (topY + midY) * 0.5;
      var R = Math.min(w * 0.18, (midY - topY) * 0.44);

      c.strokeStyle = "#334155"; c.lineWidth = 1.2;
      c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.stroke();
      for (var ti = 0; ti < 24; ti++) {
        var ang = (ti / 24) * 6.2832 - 1.5708;
        c.strokeStyle = "#475569"; c.lineWidth = 1;
        c.beginPath();
        c.moveTo(cx + Math.cos(ang) * (R - 3), cy + Math.sin(ang) * (R - 3));
        c.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
        c.stroke();
      }
      var sweep = -1.5708 + ph * 6.2832;
      c.strokeStyle = dd.clockCol || "#f43f5e"; c.lineWidth = 3;
      c.beginPath(); c.arc(cx, cy, R, -1.2, -1.2 + (0.4 + ph * 1.4)); c.stroke();
      c.strokeStyle = "#f8fafc"; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(sweep) * (R - 5), cy + Math.sin(sweep) * (R - 5)); c.stroke();
      text(c, dd.clockLabel || "02:00", cx, cy + R * 0.45, compact ? 7.5 : 9, "#f8fafc", "center");

      var mx = cx + R + (compact ? 14 : 24);
      metrics.forEach(function (m, mi) {
        var my = topY + 10 + mi * ((midY - topY - 12) / Math.max(1, metrics.length));
        text(c, m.k, mx, my, compact ? 7.5 : 9, "#94a3b8", "left");
        var dx = w - (compact ? 42 : 76);
        var showDots = Math.min(8, m.n);
        for (var dIdx = 0; dIdx < showDots; dIdx++) {
          c.fillStyle = m.col;
          c.beginPath(); c.arc(dx + dIdx * (compact ? 6 : 8), my, compact ? 2.2 : 2.8, 0, 6.2832); c.fill();
        }
        if (m.n > 8 || dd.showNums) {
          text(c, String(m.n), w - 10, my, compact ? 7.5 : 9, m.col, "right");
        }
      });

      var by = midY + 4, bh = h - by - 8;
      c.fillStyle = "rgba(7,13,26,0.92)";
      c.strokeStyle = "#334155"; c.lineWidth = 1;
      c.fillRect(10, by, w - 20, bh); c.strokeRect(10, by, w - 20, bh);
      text(c, dd.rulesHeader || "rules.md · agent follows these", 18, by + 11, compact ? 7.5 : 9, "#94a3b8", "left");
      var showRules = rules.slice(-4);
      var actR = Math.floor(t / 30) % Math.max(1, showRules.length);
      showRules.forEach(function (rl, ri) {
        var ry = by + 24 + ri * ((bh - 28) / Math.max(1, showRules.length));
        text(c, rl, 18, ry, compact ? 7.5 : 9, ri === actR ? "#10b981" : "#cbd5e1", "left");
      });
    }, { fps: 24 });
  }

  /* #36 YC CLAUDE-SECOND-BRAIN (06 CDE - CLAUDE-SECOND-BRAIN · MKLINK) — CLI + 20格 Waffle 矩陣 + 12 Agent 燈號 + PR 樹 */
  /* #36 §6.7 版 YC CDE · MKLINK — TERMINAL 子窗＋SKILLS 矩陣＋AGENTS 燈號（leader 摘要）＋VAULTS 樹（kvPort＋虛點引導）＋DIFF 插畫預覽 */
  function ycCdeMklink(cv, d, opt) {
    var TX = g.A23Tex;
    if (!TX) return ycCdeMklinkLegacy(cv, d, opt);
    var K = TX.kit(TX.theme(YC_ACC)), V = K.V, tx = K.tx, SEM_GRN = "#10b981";
    var defPrs = [
      { txt: "├─ CEO-second-brain", tag: "agent", col: "#38bdf8" },
      { txt: "├─ claude-code-vault", tag: "sync", col: "#10b981" },
      { txt: "└─ nightly-rules", tag: "rule", col: "#f43f5e" }
    ];
    function dKind(i, seed) { var r = K.hh(i, seed); return r < 0.3 ? -1 : (r < 0.62 ? 1 : 0); }
    /* diff 插畫：gutter（+／−）＋行條；顯影後增刪列才上語意紅綠底（決定性） */
    function diffArt(c, b, seed, col, lit) {
      var n = Math.max(3, Math.min(9, Math.floor(b.h / 7))), lh = b.h / n;
      for (var i = 0; i < n; i++) {
        var kind = dKind(i, seed), y = Math.round(b.y + lh * (i + 0.5)) + 0.5, gx = b.x + 4;
        var sc = kind > 0 ? SEM_GRN : SEM_RED, gc = lit && kind !== 0 ? sc : col;
        if (lit && kind !== 0) { c.fillStyle = K.rgba(sc, 0.12); c.fillRect(b.x, y - lh * 0.42, b.w, lh * 0.84); }
        c.fillStyle = gc;
        if (kind !== 0) c.fillRect(gx - 2, y - 0.5, 5, 1);
        if (kind > 0) c.fillRect(gx, y - 2.5, 1, 5);
        var ind = K.hh(i, seed + 7) < 0.4 ? 8 : 0, lw = Math.max(4, (b.w - 18 - ind) * (0.35 + 0.6 * K.hh(i, seed + 3)));
        c.fillStyle = kind === 0 ? col : gc;
        c.fillRect(b.x + 12 + ind, y - (kind === 0 ? 0.5 : 1), lw, kind === 0 ? 1.5 : 2);
      }
      return n;
    }
    return driver(120, function (t) {
      var dd = resolveD(d), live = !dd.agents;
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420, f = K.infoFont(w), ph = t / 120, gp = compact ? 6 : 8;
      var rowH = f + Math.max(5, Math.round(f * 0.8));
      c.fillStyle = V.bg; c.fillRect(0, 0, w, h);
      K.dotGrid(c, 0, 0, w, h, compact ? 10 : 14, V.dot);
      tx(c, K.fitM(c, dd.title || "06 CDE · CLAUDE-SECOND-BRAIN · MKLINK", w * (compact ? 0.95 : 0.66), f + 1, "700"), 10, 11, f + 1, V.ink, "left", "700");
      if (!compact) tx(c, dd.rightTag || "vault symlinks", w - 10, 11, f - 1, V.dim, "right", "600");

      /* TERMINAL 子窗 */
      var cliY = 20, cliH = compact ? 30 : 46, cb = { x: 10, y: cliY, w: w - 20, h: cliH }, ci = K.pane(c, cb, "TERMINAL", "zsh");
      K.specEdge(c, cb.x + 3, cb.y + 1, cb.w - 6);
      var l1 = ci.y + ci.h * 0.3, l2 = ci.y + ci.h * 0.74, f2 = f - 0.5;
      tx(c, K.fitM(c, dd.cliCmd || "$ npx claude-second-brain", ci.w - 16, f, "600"), ci.x + 5, l1, f, V.ink, "left", "600");
      var stStr = dd.cliStatus || "✓ decision vault   ✓ claude code   ✓ tool vault";
      if (live) { var parts = stStr.split(/\s{2,}/), nShow = Math.min(parts.length, Math.floor(Math.min(1, ph * 1.6) * (parts.length + 0.999))); stStr = parts.slice(0, nShow).join("   "); }
      stStr = K.fitM(c, stStr, ci.w - 20, f2, "600");
      tx(c, stStr, ci.x + 5, l2, f2, dd.cliStatusCol || SEM_GRN, "left", "600");
      c.font = "600 " + f2 + "px " + K.MONO;
      if (Math.floor(t / 6) % 2 === 0) { c.fillStyle = V.acc2; c.fillRect(ci.x + 6 + c.measureText(stStr).width + (stStr ? 2 : 0), l2 - f2 * 0.45, Math.max(1, f2 * 0.5), f2 * 0.9); }

      /* SKILLS 矩陣子窗 */
      var midY = cliY + cliH + gp, midH = Math.round(h * (compact ? 0.3 : 0.29));
      var sW = Math.round((w - 20 - gp) * 0.58), sb = { x: 10, y: midY, w: sW, h: midH };
      var si = K.pane(c, sb, "SKILLS", K.fitM(c, dd.leftHeader || "CDE · 14 skills", sW * 0.62, 5.4, "400"));
      K.specEdge(c, sb.x + 3, sb.y + 1, sb.w - 6);
      var cols = 10, sg = compact ? 2 : 3, legH = compact ? 0 : rowH;
      var cell = Math.max(4, Math.floor(Math.min((si.w - 8 - (cols - 1) * sg) / cols, (si.h - legH - 4 - sg) / 2, compact ? 12 : 28)));
      var gw = cols * cell + (cols - 1) * sg, gx0 = si.x + Math.round((si.w - gw) / 2), gy0 = si.y + 2 + Math.round((si.h - legH - 4 - (2 * cell + sg)) / 2);
      var skillPal = [V.track, V.acc, SEM_RED, SEM_GRN], nOn = 0, nGate = 0, hl = (Math.floor(t / 12) * 7) % 20;
      for (var r = 0; r < 2; r++) for (var cl = 0; cl < cols; cl++) {
        var idx = r * cols + cl, st = (dd.skills && idx < dd.skills.length) ? (dd.skills[idx] | 0) : ((((idx * 7 + Math.floor(t / 6)) % 11) < 5) ? 1 : 0);
        var x = gx0 + cl * (cell + sg), y = gy0 + r * (cell + sg);
        if (st) nOn++; if (st === 2) nGate++;
        if (!st) { c.fillStyle = V.track; c.fillRect(x, y, cell, cell); c.strokeStyle = V.line; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1); }
        else { c.fillStyle = skillPal[st] || V.acc; c.fillRect(x, y, cell, cell); K.specEdge(c, x, y, cell, 0.22); }
        if (idx === hl && st) K.activeHalo(c, x, y, cell, cell, compact ? 4 : 7);
      }
      if (!compact) K.leader(c, "active / gate", nOn + " / " + nGate, si.x + 4, si.x + si.w - 4, Math.round(si.y + si.h - rowH * 0.5), f, nGate > 0);

      /* AGENTS 燈號子窗＋leader 摘要 */
      var ab = { x: 10 + sW + gp, y: midY, w: w - 20 - sW - gp, h: midH };
      var ai = K.pane(c, ab, "AGENTS", K.fitM(c, dd.rightHeader || "12 agents", ab.w * 0.6, 5.4, "400"));
      K.specEdge(c, ab.x + 3, ab.y + 1, ab.w - 6);
      var aCol = { ok: SEM_GRN, work: V.acc, warn: SEM_AMB, gate: SEM_RED, idle: V.track }, cnt = { ok: 0, work: 0, warn: 0, gate: 0, idle: 0 }, states = [];
      for (var ai2 = 0; ai2 < 12; ai2++) {
        var st2 = (dd.agents && ai2 < dd.agents.length) ? dd.agents[ai2] : (((ai2 + Math.floor(t / 8)) % 4) !== 0 ? (ai2 % 3 === 0 ? "ok" : "work") : "idle");
        if (!aCol[st2]) st2 = "idle"; states.push(st2); cnt[st2]++;
      }
      var kvRows = compact ? [["ok·work·gate", cnt.ok + "·" + cnt.work + "·" + (cnt.gate + cnt.warn), cnt.gate > 0]]
        : [["ok", cnt.ok, false], ["work", cnt.work, cnt.work > 0], ["gate / warn", cnt.gate + " / " + cnt.warn, cnt.gate > 0]];
      var kvH = rowH * kvRows.length + 2, dH = ai.h - kvH;
      var ar = Math.max(2, Math.min((ai.w - 8) / 12 - 1.5, dH / 4 - 1.5, compact ? 4 : 6.5)), sx = (ai.w - 8) / 6;
      states.forEach(function (st3, i) {
        var px = ai.x + 4 + sx * (i % 6 + 0.5), py = ai.y + dH * (Math.floor(i / 6) === 0 ? 0.3 : 0.72);
        if (st3 === "idle") { c.strokeStyle = V.line2; c.lineWidth = 1; c.beginPath(); c.arc(px, py, ar - 0.5, 0, 6.2832); c.stroke(); return; }
        if (st3 === "work") { c.strokeStyle = K.rgba(V.acc, 0.25 + 0.25 * Math.sin(t * 0.35 + i)); c.lineWidth = 1; c.beginPath(); c.arc(px, py, ar + 2.5, 0, 6.2832); c.stroke(); }
        c.fillStyle = aCol[st3]; c.beginPath(); c.arc(px, py, ar, 0, 6.2832); c.fill();
        c.fillStyle = "rgba(255,255,255,0.25)"; c.beginPath(); c.arc(px - ar * 0.3, py - ar * 0.3, ar * 0.35, 0, 6.2832); c.fill();
      });
      K.kvBlock(c, { x: ai.x, y: ai.y + ai.h - kvH, w: ai.w, h: kvH }, kvRows, f, ab.x);

      /* VAULTS 樹子窗：埠點＋虛點引導列，作用列光條 */
      var botY = midY + midH + gp, botH = h - botY - 8, dfW = Math.round((w - 20 - gp) * (compact ? 0.38 : 0.36));
      var tb = { x: 10, y: botY, w: w - 20 - gp - dfW, h: botH }, ti = K.pane(c, tb, "VAULTS", "mklink");
      K.specEdge(c, tb.x + 3, tb.y + 1, tb.w - 6);
      var hy = ti.y + f * 0.7;
      tx(c, K.fitM(c, dd.treeHeader || "vaults -> ~/.config/second-brain", ti.w - 10, f, "700"), ti.x + 5, hy, f, V.txt, "left", "700");
      var prs = (dd.prs || defPrs).slice(0, 3), seg = (ph * 6) % 1, actP = Math.floor(ph * 6) % Math.max(1, prs.length);
      var rTop = hy + f * 0.9, rh = (ti.y + ti.h - rTop) / Math.max(1, prs.length), aY = ti.y + ti.h / 2;
      prs.forEach(function (pr, pi) {
        var ry = Math.round(rTop + rh * (pi + 0.5)), isA = pi === actP;
        if (isA) { aY = ry; c.fillStyle = V.track; c.fillRect(ti.x + 2, ry - rh * 0.4, ti.w - 4, rh * 0.8); c.fillStyle = V.acc; c.fillRect(ti.x + 2, ry - rh * 0.4, 2, rh * 0.8); }
        K.leader(c, K.fitM(c, pr.txt, ti.w * 0.62, f, "600"), String(pr.tag), ti.x + 9, ti.x + ti.w - 13, ry, f, isA);
        c.fillStyle = pr.col || V.acc; c.beginPath(); c.arc(ti.x + ti.w - 6, ry, compact ? 1.8 : 2.4, 0, 6.2832); c.fill();
        K.kvPort(c, tb.x, ry, isA);
      });

      /* DIFF 插畫預覽子窗：作用 PR 的增刪行逐段顯影 */
      var fb = { x: tb.x + tb.w + gp, y: botY, w: dfW, h: botH }, pA = prs[actP] || {};
      var fi = K.pane(c, fb, "DIFF", K.fitM(c, String(pA.tag || ""), dfW * 0.5, 5.4, "400"));
      K.specEdge(c, fb.x + 3, fb.y + 1, fb.w - 6);
      var kv2 = compact ? 0 : rowH * 2 + 2, pb = { x: fi.x + 2, y: fi.y + 1, w: fi.w - 4, h: Math.max(14, fi.h - kv2 - 3) };
      c.fillStyle = V.bg; c.fillRect(pb.x, pb.y, pb.w, pb.h);
      c.strokeStyle = V.line2; c.lineWidth = 1; c.strokeRect(pb.x + 0.5, pb.y + 0.5, pb.w - 1, pb.h - 1);
      K.dotGrid(c, pb.x, pb.y, pb.w, pb.h, 7, V.dot2);
      var ib = { x: pb.x + 3, y: pb.y + 3, w: pb.w - 6, h: pb.h - 6 }, seed = actP * 13 + 5, prog = Math.min(1, seg * 1.4);
      K.develop(c, ib, prog, function (cc, col, lit) { diffArt(cc, ib, seed, col, lit); });
      if (!compact) {
        var nL = Math.max(3, Math.min(9, Math.floor(ib.h / 7))), nAdd = 0, nDel = 0;
        for (var q = 0; q < nL; q++) { var kd = dKind(q, seed); if (kd > 0) nAdd++; else if (kd < 0) nDel++; }
        K.kvBlock(c, { x: fi.x, y: fi.y + fi.h - kv2, w: fi.w, h: kv2 }, [["+ / −", "+" + nAdd * 3 + " / −" + nDel * 2, prog >= 1], ["link", prog >= 1 ? "ok" : "…", false]], f, fb.x + fb.w);
      }
      /* 虛點引導線：作用列 → DIFF 預覽，熱封包沿走線 */
      var mx = tb.x + tb.w + gp / 2, py2 = Math.round(pb.y + pb.h / 2) + 0.5, pts = [[tb.x + tb.w, aY + 0.5], [mx, aY + 0.5], [mx, py2], [fb.x, py2]];
      c.setLineDash([1, 2]); c.strokeStyle = V.acc2; c.lineWidth = 1; K.orthPath(c, pts, 2); c.setLineDash([]);
      K.kvPort(c, fb.x, py2, true);
      if (seg < 0.5) K.hotPacket(c, pts, seg / 0.5, V.acc2, compact ? 1.8 : 2.4);
    }, { fps: 24 });
  }

  /* #36 legacy（A23Tex 缺席時用） YC CDE · MKLINK */
  function ycCdeMklinkLegacy(cv, d, opt) {
    var defPrs = [
      { txt: "├─ CEO-second-brain", tag: "agent", col: "#38bdf8" },
      { txt: "├─ claude-code-vault", tag: "sync", col: "#10b981" },
      { txt: "└─ nightly-rules", tag: "rule", col: "#f43f5e" }
    ];
    return driver(120, function (t) {
      var dd = resolveD(d);
      var s = fit(cv), c = s.c, w = s.w, h = s.h;
      var compact = w < 420;
      var ph = t / 120;
      text(c, dd.title || "06 CDE · CLAUDE-SECOND-BRAIN · MKLINK", 10, 12, compact ? 8.5 : 10.5, dd.titleCol || "#a78bfa", "left");

      var cliY = 22, cliH = compact ? 24 : 32;
      c.fillStyle = "rgba(7,13,26,0.92)";
      c.strokeStyle = "#334155"; c.lineWidth = 1;
      c.fillRect(10, cliY, w - 20, cliH); c.strokeRect(10, cliY, w - 20, cliH);
      text(c, dd.cliCmd || "$ npx claude-second-brain", 16, cliY + (compact ? 8 : 11), compact ? 7.5 : 9.5, "#e2e8f0", "left");
      text(c, dd.cliStatus || "✓ decision vault   ✓ claude code   ✓ tool vault", 16, cliY + (compact ? 18 : 23), compact ? 6.8 : 8.5, dd.cliStatusCol || "#10b981", "left");

      var midY = cliY + cliH + 8;
      text(c, dd.leftHeader || "CDE · 14 skills", 10, midY + 4, compact ? 7.5 : 8.5, "#94a3b8", "left");
      text(c, dd.rightHeader || "12 agents", w - 10, midY + 4, compact ? 7.5 : 8.5, "#38bdf8", "right");

      var gridY = midY + 12, cellS = compact ? 9 : 13, gap = compact ? 2 : 3;
      var cols = 10;
      var skillPalette = ["#1e293b", "#a78bfa", "#f43f5e", "#10b981"];
      for (var r = 0; r < 2; r++) {
        for (var cl = 0; cl < cols; cl++) {
          var idx = r * cols + cl;
          if (dd.skills && idx < dd.skills.length) {
            c.fillStyle = skillPalette[dd.skills[idx]] || "#1e293b";
          } else {
            var hot = ((idx * 7 + Math.floor(t / 6)) % 11) < 5;
            c.fillStyle = hot ? "#a78bfa" : "#1e293b";
          }
          c.fillRect(10 + cl * (cellS + gap), gridY + r * (cellS + gap), cellS, cellS);
        }
      }

      var agStartX = w - (compact ? 72 : 104);
      var agentColors = { ok: "#10b981", work: "#38bdf8", warn: "#f59e0b", gate: "#f43f5e", idle: "#1e293b" };
      for (var ar = 0; ar < 2; ar++) {
        for (var ac = 0; ac < 6; ac++) {
          var aIdx = ar * 6 + ac;
          var ax = agStartX + ac * (compact ? 11 : 16), ay = gridY + 5 + ar * (compact ? 11 : 15);
          if (dd.agents && aIdx < dd.agents.length) {
            var st = dd.agents[aIdx];
            c.fillStyle = agentColors[st] || "#1e293b";
          } else {
            var on = ((aIdx + Math.floor(t / 8)) % 4) !== 0;
            c.fillStyle = on ? "#38bdf8" : "#1e293b";
          }
          c.beginPath(); c.arc(ax, ay, compact ? 3.5 : 5, 0, 6.2832); c.fill();
        }
      }

      var botY = gridY + 2 * (cellS + gap) + 8, botH = h - botY - 8;
      c.fillStyle = "rgba(7,13,26,0.92)";
      c.strokeStyle = "#334155"; c.lineWidth = 1;
      c.fillRect(10, botY, w - 20, botH); c.strokeRect(10, botY, w - 20, botH);
      text(c, dd.treeHeader || "vaults -> ~/.config/second-brain", 16, botY + 11, compact ? 7.5 : 8.5, "#eab308", "left");

      var prs = dd.prs || defPrs;
      var actP = Math.floor(ph * 6) % Math.max(1, prs.length);
      prs.slice(0, 3).forEach(function (pr, pi) {
        var py = botY + 24 + pi * ((botH - 28) / Math.max(1, Math.min(3, prs.length)));
        text(c, pr.txt, 18, py, compact ? 7.5 : 8.5, pi === actP ? "#f8fafc" : "#94a3b8", "left");
        var tx = w - (compact ? 48 : 58);
        c.fillStyle = pr.col;
        c.fillRect(tx, py - 5, compact ? 32 : 42, 10);
        text(c, pr.tag, tx + (compact ? 16 : 21), py, compact ? 6.5 : 7.5, "#050912", "center");
      });
    }, { fps: 24 });
  }

  g.A23Charts = {
    barRace: barRace, bubble: bubble, heatmap: heatmap, sankey: sankey, flowMap: flowMap,
    line: line, treemap: treemap, choropleth: choropleth, network: network, streamgraph: streamgraph,
    radar: radar, chord: chord, sunburst: sunburst, gauge: gauge, donut: donut, histogram: histogram,
    boxPlot: boxPlot, waterfall: waterfall, funnel: funnel, scatter: scatter, parallel: parallel,
    trajectory: trajectory, globeArcs: globeArcs, dotDensity: dotDensity, wordCloud: wordCloud,
    timeline: timeline, gantt: gantt, corrMatrix: corrMatrix, surface: surface, codexGlobe: codexGlobe,
    ycGraph: ycGraph, ycWikiTree: ycWikiTree, ycAiMemory: ycAiMemory, ycVoiceNote: ycVoiceNote,
    ycNightlyPass: ycNightlyPass, ycCdeMklink: ycCdeMklink,
    ramp: ramp, version: "v4.2-2026-11-14"
  };
})(window);
