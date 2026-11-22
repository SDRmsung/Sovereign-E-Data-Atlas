/**
 * A23 Scroll Narrative FX — S1 + S2 ES Module (Zero-Dependency)
 * S1 Exports: observeReveal, countUp, readingProgress, scrollspy, drawLine, pinScrub, scrollyStep
 * S2 Exports: canvasSequence, textFill, bgTransition, horizontalScroll, clipReveal
 */

const REDUCE_MQ =
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)")
    : { matches: false };

/** Return whether user prefers reduced motion. */
export function isReducedMotion() {
  return Boolean(REDUCE_MQ && REDUCE_MQ.matches);
}

/** Clamp a number between 0 and 1. */
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * 01 / 03 Reveal Observer (.fx-fade & .fx-stagger > *)
 * Triggers once at threshold 0.15, rootMargin "0px 0px -10% 0px", then unobserves.
 */
export function observeReveal(root = document, opts = {}) {
  if (typeof document === "undefined") return { destroy() {} };
  document.documentElement.classList.add("fx-js");

  const scope = root instanceof Element ? root : document;
  const targets = [];

  scope.querySelectorAll(".fx-fade").forEach((el) => targets.push(el));
  scope.querySelectorAll(".fx-stagger").forEach((group) => {
    Array.from(group.children).forEach((child, idx) => {
      if (!child.style.getPropertyValue("--i")) {
        child.style.setProperty("--i", String(idx));
      }
      targets.push(child);
    });
  });

  if (isReducedMotion() || typeof IntersectionObserver === "undefined") {
    targets.forEach((el) => el.classList.add("is-in"));
    return { destroy() {} };
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    {
      threshold: opts.threshold ?? 0.15,
      rootMargin: opts.rootMargin ?? "0px 0px -10% 0px",
    }
  );

  targets.forEach((el) => io.observe(el));
  return {
    destroy() {
      io.disconnect();
    },
  };
}

/**
 * 08 Count-up Number Animation
 * Starts only when entering viewport; shows final value immediately under reduced motion.
 */
export function countUp(el, { to, dur = 1200, locale = "zh-TW", suffix = "" } = {}) {
  if (!el || typeof to !== "number") return { replay() {}, destroy() {} };

  const decimals = Number.isInteger(to)
    ? 0
    : Math.min(2, (String(to).split(".")[1] || "").length);
  const fmt = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  let rafId = 0;
  let io = null;

  const renderFinal = () => {
    el.textContent = `${fmt.format(to)}${suffix}`;
  };

  const run = () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (isReducedMotion() || dur <= 0) {
      renderFinal();
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = clamp01((now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = to * eased;
      el.textContent = `${fmt.format(decimals ? Number(val.toFixed(decimals)) : Math.round(val))}${suffix}`;
      if (t < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        renderFinal();
        rafId = 0;
      }
    };
    rafId = requestAnimationFrame(tick);
  };

  if (isReducedMotion() || typeof IntersectionObserver === "undefined") {
    renderFinal();
  } else {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(el);
          run();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
  }

  return {
    replay: run,
    destroy() {
      if (rafId) cancelAnimationFrame(rafId);
      if (io) io.disconnect();
    },
  };
}

/**
 * 09 Reading Progress Bar
 * Throttled via rAF + passive scroll; updates transform: scaleX(p).
 */
export function readingProgress(bar, onUpdate) {
  if (typeof window === "undefined") return { update() {}, destroy() {} };

  let ticking = false;

  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
    const p = clamp01(window.scrollY / maxScroll);
    if (bar) bar.style.transform = `scaleX(${p.toFixed(4)})`;
    if (typeof onUpdate === "function") onUpdate(p);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();

  return {
    update,
    destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}

/**
 * 24 Scrollspy
 * Observes sections and marks matching nav link with aria-current="true".
 */
export function scrollspy(nav, sections, opts = {}) {
  if (!nav || !sections || typeof IntersectionObserver === "undefined") {
    return { destroy() {} };
  }

  const secList = Array.from(sections);
  const linkMap = new Map();
  nav.querySelectorAll('a[href^="#"]').forEach((a) => {
    const id = a.getAttribute("href").slice(1);
    if (id) linkMap.set(id, a);
  });

  const setActive = (id) => {
    linkMap.forEach((a, key) => {
      if (key === id) {
        a.setAttribute("aria-current", "true");
        a.classList.add("is-active");
      } else {
        a.removeAttribute("aria-current");
        a.classList.remove("is-active");
      }
    });
    if (typeof opts.onChange === "function") opts.onChange(id);
  };

  const visible = new Set();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      }
      const activeSec = secList.find((s) => visible.has(s.id));
      if (activeSec) setActive(activeSec.id);
    },
    {
      rootMargin: opts.rootMargin ?? "-20% 0px -65% 0px",
      threshold: opts.threshold ?? 0,
    }
  );

  secList.forEach((s) => io.observe(s));
  if (secList[0]) setActive(secList[0].id);

  return {
    destroy() {
      io.disconnect();
    },
  };
}

/**
 * 13 SVG Draw Line
 * Uses getTotalLength() and drives stroke-dashoffset by container scroll progress.
 */
export function drawLine(svgPath, container) {
  if (!svgPath || !container || typeof svgPath.getTotalLength !== "function") {
    return { update() {}, destroy() {} };
  }

  const len = svgPath.getTotalLength();
  svgPath.style.strokeDasharray = `${len}`;

  if (isReducedMotion()) {
    svgPath.style.strokeDashoffset = "0";
    return { update() {}, destroy() {} };
  }

  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const start = vh * 0.82;
    const end = vh * 0.22;
    const span = Math.max(1, start - end + rect.height * 0.35);
    const p = clamp01((start - rect.top) / span);
    svgPath.style.strokeDashoffset = `${(len * (1 - p)).toFixed(2)}`;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();

  return {
    update,
    destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}

/**
 * 18 Pin + Scrub
 * Sets outer height = 100vh * steps, inner sticky top:0, calls onProgress(p, stepIndex).
 * Recalculates dimensions on resize.
 */
export function pinScrub(container, steps = 3, onProgress) {
  if (!container) return { update() {}, destroy() {} };

  const stepCount = Math.max(1, Number(steps) || 1);
  const stickyEl = container.querySelector(".fx-pin-sticky") || container.firstElementChild;
  if (stickyEl) {
    stickyEl.style.position = "sticky";
    stickyEl.style.top = "0";
  }

  let ticking = false;

  const measure = () => {
    container.style.height = `${Math.round(window.innerHeight * stepCount)}px`;
  };

  const update = () => {
    ticking = false;
    const rect = container.getBoundingClientRect();
    const scrollable = Math.max(1, container.offsetHeight - window.innerHeight);
    const p = clamp01(-rect.top / scrollable);
    const stepIndex = Math.min(stepCount - 1, Math.floor(p * stepCount));
    if (typeof onProgress === "function") onProgress(p, stepIndex);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  const onResize = () => {
    measure();
    onScroll();
  };

  measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  update();

  return {
    update,
    destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}

/**
 * 19 Scrollytelling Step Trigger
 * Fires onEnter(el, index) when a narrative step crosses viewport centerline.
 */
export function scrollyStep(stepsEls, onEnter) {
  const list = Array.from(stepsEls || []);
  if (!list.length || typeof IntersectionObserver === "undefined") {
    return { destroy() {} };
  }

  const activate = (el, idx) => {
    list.forEach((item, i) => item.classList.toggle("is-active", i === idx));
    if (typeof onEnter === "function") onEnter(el, idx);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const idx = list.indexOf(entry.target);
        if (idx >= 0) activate(entry.target, idx);
      }
    },
    {
      rootMargin: "-45% 0px -45% 0px",
      threshold: 0,
    }
  );

  list.forEach((el) => io.observe(el));
  activate(list[0], 0);

  return {
    destroy() {
      io.disconnect();
    },
  };
}

/**
 * 12 Canvas Frame Sequence
 * Supports procedural draw(ctx, i, n, cssW, cssH) or frames: string[] image URLs with Image.decode().
 * Scales canvas by devicePixelRatio, redraws only when frame index changes, rAF-throttled.
 */
export function canvasSequence(canvas, container, { frames, draw, count = 24, onFrame } = {}) {
  if (!canvas || !container) return { update() {}, destroy() {} };
  const ctx = canvas.getContext("2d");
  if (!ctx) return { update() {}, destroy() {} };

  const hasFrames = Array.isArray(frames) && frames.length > 0;
  const total = Math.max(1, hasFrames ? frames.length : Number(count) || 24);

  let cssW = 640;
  let cssH = 320;
  let lastIdx = -1;
  let ticking = false;
  let destroyed = false;

  const imgs = hasFrames
    ? frames.map((src) => {
        const img = new Image();
        img.decoding = "async";
        img.src = src;
        if (typeof img.decode === "function") {
          img.decode().then(() => {
            if (!destroyed && lastIdx >= 0) renderFrame(lastIdx, true);
          }).catch(() => {});
        }
        return img;
      })
    : null;

  const measureDPR = () => {
    const rect = canvas.getBoundingClientRect();
    cssW = Math.max(1, Math.round(rect.width || canvas.clientWidth || 640));
    cssH = Math.max(1, Math.round(rect.height || canvas.clientHeight || 320));
    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const renderFrame = (idx, force = false) => {
    const clamped = Math.min(total - 1, Math.max(0, idx));
    if (!force && clamped === lastIdx) return;
    lastIdx = clamped;

    ctx.clearRect(0, 0, cssW, cssH);
    if (imgs) {
      const img = imgs[clamped];
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, cssW, cssH);
      }
    } else if (typeof draw === "function") {
      draw(ctx, clamped, total, cssW, cssH);
    }

    if (typeof onFrame === "function") onFrame(clamped, total);
  };

  measureDPR();

  if (isReducedMotion()) {
    renderFrame(total - 1, true);
    const onResizeReduced = () => {
      measureDPR();
      renderFrame(total - 1, true);
    };
    window.addEventListener("resize", onResizeReduced, { passive: true });
    return {
      update() {
        renderFrame(total - 1, true);
      },
      destroy() {
        destroyed = true;
        window.removeEventListener("resize", onResizeReduced);
      },
    };
  }

  const update = (force = false) => {
    ticking = false;
    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    let p;
    if (rect.height > vh * 1.25) {
      const scrollable = Math.max(1, rect.height - vh);
      p = clamp01(-rect.top / scrollable);
    } else {
      const start = vh * 0.88;
      const end = vh * 0.16;
      const span = Math.max(1, start - end + rect.height * 0.35);
      p = clamp01((start - rect.top) / span);
    }
    const idx = Math.min(total - 1, Math.round(p * (total - 1)));
    renderFrame(idx, force);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => update(false));
  };

  const onResize = () => {
    measureDPR();
    update(true);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  update(true);

  return {
    update: () => update(true),
    destroy() {
      destroyed = true;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}

/**
 * 14 Text Fill
 * Updates CSS custom property --p (0%-100%) on scroll for background-clip: text gradient fill.
 * Never mutates DOM structure per frame.
 */
export function textFill(el, opts = {}) {
  if (!el) return { update() {}, destroy() {} };
  el.classList.add("fx-text-fill");
  const container = opts.container || el;

  if (isReducedMotion()) {
    el.style.setProperty("--p", "100%");
    return { update() {}, destroy() {} };
  }

  let ticking = false;

  const update = () => {
    ticking = false;
    const rect = container.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const start = vh * 0.85;
    const end = vh * 0.25;
    const span = Math.max(1, start - end + rect.height * 0.25);
    const p = clamp01((start - rect.top) / span);
    el.style.setProperty("--p", `${(p * 100).toFixed(1)}%`);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();

  return {
    update,
    destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}

/**
 * 15 Background Color Transition
 * Observes sections with [data-bg]; transitions target background when crossing viewport centerline.
 */
export function bgTransition(sections, target = typeof document !== "undefined" ? document.body : null, opts = {}) {
  const list = Array.from(sections || []);
  if (!list.length || !target || typeof IntersectionObserver === "undefined") {
    return { destroy() {} };
  }

  let useOverlay = false;
  const applyBg = (sec) => {
    const bg = sec.dataset.bg;
    if (!bg) return;
    if (target.classList.contains("fx-bg-stage")) {
      useOverlay = !useOverlay;
      if (useOverlay) {
        target.style.setProperty("--fx-bg-overlay", bg);
        target.style.setProperty("--fx-bg-alpha", "1");
      } else {
        target.style.setProperty("--fx-bg-cur", bg);
        target.style.setProperty("--fx-bg-alpha", "0");
      }
    } else {
      target.style.backgroundColor = bg;
    }
    list.forEach((s) => s.classList.toggle("is-active", s === sec));
    if (typeof opts.onChange === "function") opts.onChange(bg, sec);
  };

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        applyBg(entry.target);
      }
    },
    {
      rootMargin: opts.rootMargin ?? "-45% 0px -45% 0px",
      threshold: 0,
    }
  );

  list.forEach((s) => io.observe(s));
  applyBg(list[0]);

  return {
    destroy() {
      io.disconnect();
    },
  };
}

/**
 * 22 Horizontal Scroll
 * Maps vertical scroll to horizontal track translate3d; falls back to native scroll-snap below 720px or reduced-motion.
 */
export function horizontalScroll(wrap, track, opts = {}) {
  if (!wrap || !track) return { update() {}, destroy() {} };

  const sticky = wrap.querySelector(".fx-hscroll-sticky") || wrap.firstElementChild;
  let maxX = 0;
  let ticking = false;

  const isNativeMode = () => window.innerWidth < 720 || isReducedMotion();

  const measure = () => {
    if (isNativeMode()) {
      wrap.style.height = "";
      track.style.transform = "";
      maxX = 0;
      return;
    }
    const viewW = sticky ? sticky.clientWidth : window.innerWidth;
    maxX = Math.max(0, track.scrollWidth - viewW);
    wrap.style.height = `${Math.round(window.innerHeight + maxX)}px`;
  };

  const update = () => {
    ticking = false;
    if (isNativeMode() || maxX <= 0) {
      if (typeof opts.onProgress === "function") opts.onProgress(0);
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const scrollable = Math.max(1, wrap.offsetHeight - window.innerHeight);
    const p = clamp01(-rect.top / scrollable);
    const tx = -p * maxX;
    track.style.transform = `translate3d(${tx.toFixed(1)}px, 0, 0)`;
    if (typeof opts.onProgress === "function") opts.onProgress(p);
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  const onResize = () => {
    requestAnimationFrame(() => {
      measure();
      update();
    });
  };

  measure();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onResize, { passive: true });
  update();

  return {
    update: onResize,
    destroy() {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    },
  };
}

/**
 * 05 Clip-Path Reveal
 * Reveals element once on viewport entry using inset | circle | polygon clip-path.
 */
export function clipReveal(el, { shape = "inset", threshold = 0.15, rootMargin = "0px 0px -10% 0px", trigger = null } = {}) {
  if (!el) return { replay() {}, destroy() {} };
  el.classList.add("fx-clip");
  el.dataset.clip = shape;

  if (isReducedMotion() || typeof IntersectionObserver === "undefined") {
    el.classList.add("is-in");
    return { replay() {}, destroy() {} };
  }

  // Observe unclipped parent/trigger so Chromium doesn't report 0 intersection on zero-area clip-path
  const obsTarget =
    trigger || (el.parentElement && el.parentElement !== document.body ? el.parentElement : el);

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        el.classList.add("is-in");
        io.unobserve(obsTarget);
      }
    },
    { threshold, rootMargin }
  );

  io.observe(obsTarget);

  return {
    replay() {
      if (isReducedMotion()) return;
      el.classList.remove("is-in");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add("is-in"));
      });
    },
    destroy() {
      io.disconnect();
    },
  };
}

/**
 * 04 / 06 P2 Reveal Observer (.fx-text-reveal & .fx-blur)
 * Assigns --i to .fx-line children and toggles .is-in once on viewport entry.
 */
export function observeP2Reveals(root = document, opts = {}) {
  if (typeof document === "undefined") return { destroy() {} };
  document.documentElement.classList.add("fx-js");

  const scope = root instanceof Element ? root : document;
  const targets = [];

  scope.querySelectorAll(".fx-text-reveal").forEach((el) => {
    el.querySelectorAll(".fx-line").forEach((line, idx) => {
      if (!line.style.getPropertyValue("--i")) {
        line.style.setProperty("--i", String(idx));
      }
    });
    targets.push(el);
  });
  scope.querySelectorAll(".fx-blur").forEach((el) => targets.push(el));

  if (isReducedMotion() || typeof IntersectionObserver === "undefined") {
    targets.forEach((el) => el.classList.add("is-in"));
    return { destroy() {} };
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-in");
        io.unobserve(entry.target);
      }
    },
    {
      threshold: opts.threshold ?? 0.15,
      rootMargin: opts.rootMargin ?? "0px 0px -10% 0px",
    }
  );

  targets.forEach((el) => io.observe(el));
  return {
    destroy() {
      io.disconnect();
    },
  };
}

/**
 * 07 Typewriter
 * Sets full text on aria-label so screen readers never announce char-by-char.
 */
export function typewriter(el, { speed = 42 } = {}) {
  if (!el) return { replay() {}, destroy() {} };
  const fullText = (el.dataset.text || el.textContent || "").trim();
  el.setAttribute("aria-label", fullText);

  const textSpan = document.createElement("span");
  textSpan.setAttribute("aria-hidden", "true");
  const cursorSpan = document.createElement("span");
  cursorSpan.className = "fx-tw-cursor";
  cursorSpan.setAttribute("aria-hidden", "true");

  el.textContent = "";
  el.appendChild(textSpan);
  el.appendChild(cursorSpan);

  let timer = 0;
  let io = null;

  const showFull = () => {
    if (timer) clearTimeout(timer);
    timer = 0;
    textSpan.textContent = fullText;
  };

  const run = () => {
    if (timer) clearTimeout(timer);
    if (isReducedMotion()) {
      showFull();
      return;
    }
    let idx = 0;
    textSpan.textContent = "";
    const step = () => {
      idx += 1;
      textSpan.textContent = fullText.slice(0, idx);
      if (idx < fullText.length) {
        timer = setTimeout(step, speed);
      } else {
        timer = 0;
      }
    };
    timer = setTimeout(step, speed);
  };

  if (isReducedMotion() || typeof IntersectionObserver === "undefined") {
    showFull();
  } else {
    io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          io.unobserve(el);
          run();
        }
      },
      { threshold: 0.2 }
    );
    io.observe(el);
  }

  return {
    replay: run,
    destroy() {
      if (timer) clearTimeout(timer);
      if (io) io.disconnect();
    },
  };
}

/**
 * 10 Parallax
 * Uses rAF-throttled translate3d; defers to CSS scroll-timeline when supported on .fx-parallax-css.
 */
export function parallax(layers, { scroller = null, container = null } = {}) {
  if (typeof window === "undefined" || !layers || !layers.length) {
    return { update() {}, destroy() {} };
  }
  const list = Array.from(layers);
  if (isReducedMotion()) {
    list.forEach((el) => {
      el.style.transform = "";
    });
    return { update() {}, destroy() {} };
  }

  const supportsCssTimeline =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("animation-timeline", "scroll()");

  const jsLayers = list.filter(
    (el) => !(supportsCssTimeline && el.classList.contains("fx-parallax-css"))
  );
  if (!jsLayers.length) return { update() {}, destroy() {} };

  const target = scroller || window;
  let ticking = false;

  const update = () => {
    ticking = false;
    let p = 0;
    if (scroller) {
      const max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      p = clamp01(scroller.scrollTop / max) - 0.5;
    } else {
      const ref = container || jsLayers[0].parentElement || jsLayers[0];
      const rect = ref.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      p = clamp01((vh - rect.top) / (vh + rect.height)) - 0.5;
    }
    jsLayers.forEach((el) => {
      const speed = Number(el.dataset.speed ?? 24);
      const y = (-p * speed).toFixed(2);
      el.style.transform = `translate3d(0, ${y}px, 0)`;
    });
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  target.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();

  return {
    update,
    destroy() {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}

/**
 * 11 Scroll Zoom
 * Maps scroll progress to scale(min -> max) inside an overflow:clip wrapper.
 */
export function scrollZoom(el, { min = 1, max = 1.2, scroller = null, container = null } = {}) {
  if (!el || typeof window === "undefined") return { update() {}, setProgress() {}, destroy() {} };
  if (isReducedMotion()) {
    el.style.transform = "scale(1)";
    return { update() {}, setProgress() {}, destroy() {} };
  }

  const target = scroller || window;
  let ticking = false;

  const setProgress = (p) => {
    const s = min + (max - min) * clamp01(p);
    el.style.transform = `scale(${s.toFixed(4)})`;
  };

  const update = () => {
    ticking = false;
    if (scroller) {
      const maxS = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
      setProgress(scroller.scrollTop / maxS);
      return;
    }
    const ref = container || el.parentElement || el;
    const rect = ref.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    setProgress((vh - rect.top) / (vh + rect.height));
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  target.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  update();

  return {
    update,
    setProgress,
    destroy() {
      target.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    },
  };
}

/**
 * 16 Marquee
 * Duplicates track content once for seamless -50% loop; scroll velocity boosts speed; pauses on hover.
 */
export function marquee(wrap, { baseSpeed = 38 } = {}) {
  if (!wrap || typeof window === "undefined") return { destroy() {} };
  const track = wrap.querySelector(".fx-marquee-track");
  if (!track) return { destroy() {} };

  if (!track.dataset.cloned) {
    const clone = document.createDocumentFragment();
    Array.from(track.children).forEach((child) => {
      const copy = child.cloneNode(true);
      copy.setAttribute("aria-hidden", "true");
      clone.appendChild(copy);
    });
    track.appendChild(clone);
    track.dataset.cloned = "1";
  }

  if (isReducedMotion()) {
    track.style.transform = "";
    return { destroy() {} };
  }

  let paused = false;
  let offset = 0;
  let lastTime = performance.now();
  let lastScrollY = window.scrollY;
  let boost = 0;
  let rafId = 0;

  const onEnter = () => { paused = true; };
  const onLeave = () => { paused = false; lastTime = performance.now(); };
  wrap.addEventListener("mouseenter", onEnter);
  wrap.addEventListener("mouseleave", onLeave);
  wrap.addEventListener("focusin", onEnter);
  wrap.addEventListener("focusout", onLeave);

  const tick = (now) => {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const curY = window.scrollY;
    const dy = Math.abs(curY - lastScrollY);
    lastScrollY = curY;
    boost = Math.min(220, boost * 0.9 + dy * 4);

    if (!paused) {
      const halfW = track.scrollWidth / 2;
      if (halfW > 0) {
        offset -= (baseSpeed + boost) * dt;
        if (offset <= -halfW) offset += halfW;
        track.style.transform = `translate3d(${offset.toFixed(1)}px, 0, 0)`;
      }
    }
    rafId = requestAnimationFrame(tick);
  };

  rafId = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      wrap.removeEventListener("mouseenter", onEnter);
      wrap.removeEventListener("mouseleave", onLeave);
      wrap.removeEventListener("focusin", onEnter);
      wrap.removeEventListener("focusout", onLeave);
    },
  };
}

/**
 * 23 Auto-Hide Header
 * Hides header on downward scroll (> threshold) and reveals on upward scroll (< -threshold).
 */
export function autoHideHeader(headerEl, { scroller = null, threshold = 8 } = {}) {
  if (!headerEl || typeof window === "undefined") return { destroy() {} };
  if (isReducedMotion()) {
    headerEl.classList.remove("is-hidden");
    return { destroy() {} };
  }

  const target = scroller || window;
  const getY = () => (scroller ? scroller.scrollTop : window.scrollY);
  let lastY = getY();
  let ticking = false;

  const update = () => {
    ticking = false;
    const curY = getY();
    const delta = curY - lastY;
    if (Math.abs(delta) < threshold) return;
    if (delta > 0 && curY > 20) {
      headerEl.classList.add("is-hidden");
    } else if (delta < 0) {
      headerEl.classList.remove("is-hidden");
    }
    lastY = curY;
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  target.addEventListener("scroll", onScroll, { passive: true });
  return {
    destroy() {
      target.removeEventListener("scroll", onScroll);
    },
  };
}
