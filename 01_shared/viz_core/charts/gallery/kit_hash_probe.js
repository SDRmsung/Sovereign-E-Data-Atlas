/* A23 像素回歸探針：window.A23HashProbe(keys?) → {key:{w x h:[h1,h2,h3]}}；用於 §6.7 擴散每步比對未改卡 */
(function (g) {
  async function sha(s) { var b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return Array.from(new Uint8Array(b)).slice(0, 8).map(function (x) { return x.toString(16).padStart(2, "0"); }).join(""); }
  g.A23HashProbe = async function (keys, sizes) {
    var R = g.A23_REGISTRY, out = {}, box = document.createElement("div");
    box.style.cssText = "position:fixed;left:-5000px;top:0;width:700px";
    document.body.appendChild(box);
    keys = keys || Object.keys(R.LIVE); sizes = sizes || [[640, 420], [320, 240]];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i]; out[k] = {};
      for (var s = 0; s < sizes.length; s++) {
        var W = sizes[s][0], H = sizes[s][1], cv = document.createElement("canvas");
        cv.dataset.w = W; cv.dataset.h = H; cv.width = W; cv.height = H; box.appendChild(cv);
        var hs = [];
        try {
          var c = R.LIVE[k](cv);
          if (c && c.pause) c.pause();
          var n = (c && c.n) || 1;
          var fr = [0.15, 0.5, 0.85].map(function (p) { return Math.round(p * (n - 1)); });
          for (var f = 0; f < 3; f++) { if (c && c.seek) c.seek(fr[f]); hs.push(await sha(cv.toDataURL())); }
          if (c && c.stop) c.stop(); else if (c && c.pause) c.pause();
        } catch (e) { hs = ["ERR:" + e.message]; }
        out[k][W + "x" + H] = hs; cv.remove();
      }
    }
    box.remove(); return out;
  };
  g.A23HashDiff = function (a, b) {
    var d = []; Object.keys(a).forEach(function (k) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) d.push(k); }); return d;
  };
})(window);
