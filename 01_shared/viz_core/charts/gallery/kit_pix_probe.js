/* A23 像素差探針（2026-11-16 Claude）：改卡前後逐通道比對，補 kit_hash_probe 只給「變/沒變」的不足。
 * 用法：await A23Pix.save('pre', ['64'], [[640,420],[320,240]]) → 改檔重載 → await A23Pix.diff('pre', ['64'], 同尺寸)
 * 回傳 {key@WxH@frame: 0 | "n通道 max d"}；資料存 IndexedDB a23_pix（不佔 localStorage） */
(function (g) {
  function db() { return new Promise(function (ok, no) { var r = indexedDB.open("a23_pix", 1); r.onupgradeneeded = function () { r.result.createObjectStore("s"); }; r.onsuccess = function () { ok(r.result); }; r.onerror = no; }); }
  async function put(k, v) { var d = await db(); return new Promise(function (ok) { var t = d.transaction("s", "readwrite"); t.objectStore("s").put(v, k); t.oncomplete = ok; }); }
  async function get(k) { var d = await db(); return new Promise(function (ok) { var q = d.transaction("s").objectStore("s").get(k); q.onsuccess = function () { ok(q.result); }; }); }
  async function grab(keys, sizes) {
    var R = g.A23_REGISTRY, out = {}, box = document.createElement("div");
    box.style.cssText = "position:fixed;left:-5000px;top:0;width:700px"; document.body.appendChild(box);
    for (var i = 0; i < keys.length; i++) for (var s = 0; s < sizes.length; s++) {
      var k = keys[i], W = sizes[s][0], H = sizes[s][1], cv = document.createElement("canvas");
      cv.dataset.w = W; cv.dataset.h = H; cv.width = W; cv.height = H; box.appendChild(cv);
      var c = R.LIVE[k](cv); if (c && c.pause) c.pause(); var n = (c && c.n) || 1;
      [0.15, 0.5, 0.85].forEach(function (p) { var fr = Math.round(p * (n - 1)); if (c && c.seek) c.seek(fr);
        out[k + "@" + W + "x" + H + "@" + fr] = cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data.slice(); });
      if (c && c.stop) c.stop(); else if (c && c.pause) c.pause(); cv.remove();
    }
    box.remove(); return out;
  }
  function cmp(a, b) { var res = {}; Object.keys(a).forEach(function (k) { var x = a[k], y = b[k];
    if (!y || x.length !== y.length) { res[k] = "size"; return; } var n = 0, m = 0;
    for (var i = 0; i < x.length; i++) { var d = Math.abs(x[i] - y[i]); if (d) { n++; if (d > m) m = d; } }
    res[k] = n ? (n + "ch max" + m) : 0; }); return res; }
  g.A23Pix = { grab: grab, put: put, get: get, cmp: cmp,
    save: async function (tag, keys, sizes) { var o = await grab(keys, sizes); await put(tag, o); return Object.keys(o).length; },
    diff: async function (tag, keys, sizes) { var a = await get(tag); var b = await grab(keys, sizes); var r = cmp(a, b);
      Object.keys(r).forEach(function (k) { if (keys.indexOf(k.split("@")[0]) < 0) delete r[k]; }); return r; } };
})(window);
