(function (global) {
  "use strict";
  global.A23Hud = {
    formatNumber: function (n) {
      return Number(n || 0).toLocaleString("en-US");
    },
    bindFeedBanner: function (elId, feed) {
      var el = document.getElementById(elId);
      if (!el || !feed) return;
      el.textContent = (feed.source_mode || "BASELINE") + " · " + String(feed.captured_at || "").slice(0, 19);
    }
  };
})(window);
