type PercentBase = "min" | "w" | "h";

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function rootFontSizePx(): number {
  if (typeof window === "undefined") return 16;
  const v = parseFloat(getComputedStyle(document.documentElement).fontSize || "16");
  return Number.isFinite(v) && v > 0 ? v : 16;
}

function parseLengthToPx(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.endsWith("px")) {
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : null;
  }
  if (s.endsWith("rem")) {
    const n = parseFloat(s);
    if (!Number.isFinite(n)) return null;
    return n * rootFontSizePx();
  }
  const n = Number(s);
  if (Number.isFinite(n)) return n;
  return null;
}

function parsePercent(raw: string): number | null {
  const s = raw.trim();
  if (!s.endsWith("%")) return null;
  const n = parseFloat(s.slice(0, -1));
  return Number.isFinite(n) ? n : null;
}

function supportsClipPathPath(): boolean {
  if (typeof CSS === "undefined" || typeof CSS.supports !== "function") return false;
  // Use double quotes inside path() for broader acceptance.
  return CSS.supports("clip-path", "path(\"M0 0 L1 0 L1 1 L0 1 Z\")");
}

let svgDefsHost: SVGSVGElement | null = null;
let svgIdCounter = 0;
let dbgIdCounter = 0;

function getSvgDefs(): SVGDefsElement | null {
  if (typeof document === "undefined") return null;
  if (!svgDefsHost || !document.body.contains(svgDefsHost)) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("data-fw", "g2-clipdefs");
    svg.setAttribute("width", "0");
    svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.style.width = "0";
    svg.style.height = "0";
    svg.style.overflow = "hidden";
    svg.style.pointerEvents = "none";
    svg.style.opacity = "0";
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);
    document.body.appendChild(svg);
    svgDefsHost = svg;
  }
  return svgDefsHost.querySelector("defs");
}

function readCssNumber(el: HTMLElement, name: string, fallback: number): number {
  const raw = getComputedStyle(el).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Figma / iOS-style smooth corners ("squircle") path.
 * Adapted from CornerKit (bejarcode/cornerKit) v1.2.0, math/figma-squircle.ts.
 * Credit: MartinRGB (reverse-engineering Figma's math).
 */
function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

function round2(v: number): number {
  // Higher precision reduces visible "stair steps" on clip-path edges.
  return Math.round(v * 1000) / 1000;
}

function getCornerParams(cornerRadius: number, cornerSmoothing: number, budget: number): {
  a: number; b: number; c: number; d: number; p: number; arcSectionLength: number; cornerRadius: number;
} {
  let p = (1 + cornerSmoothing) * cornerRadius;
  const arcMeasure = 90 * (1 - cornerSmoothing);
  const arcSectionLength = Math.sin(toRadians(arcMeasure / 2)) * cornerRadius * Math.sqrt(2);
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4Distance = cornerRadius * Math.tan(toRadians(angleAlpha / 2));
  const angleBeta = 45 * cornerSmoothing;
  const c = p3ToP4Distance * Math.cos(toRadians(angleBeta));
  const d = c * Math.tan(toRadians(angleBeta));
  const b = (p - arcSectionLength - c - d) / 3;
  const a = 2 * b;

  if (p > budget && budget !== Infinity) {
    const scale = budget / p;
    return {
      a: a * scale,
      b: b * scale,
      c: c * scale,
      d: d * scale,
      p: budget,
      arcSectionLength: arcSectionLength * scale,
      cornerRadius,
    };
  }

  return { a, b, c, d, p: Math.min(p, budget), arcSectionLength, cornerRadius };
}

function drawTopRightCorner(params: ReturnType<typeof getCornerParams>): string {
  const { cornerRadius, a, b, c, d, arcSectionLength, p } = params;
  if (cornerRadius === 0) return `l ${round2(p)} 0`;
  const arc = arcSectionLength > 0.01
    ? `a ${round2(cornerRadius)} ${round2(cornerRadius)} 0 0 1 ${round2(arcSectionLength)} ${round2(arcSectionLength)}`
    : "";
  return `c ${round2(a)} 0 ${round2(a + b)} 0 ${round2(a + b + c)} ${round2(d)} ${arc} c ${round2(d)} ${round2(c)} ${round2(d)} ${round2(b + c)} ${round2(d)} ${round2(a + b + c)}`.trim().replace(/\\s+/g, " ");
}

function drawBottomRightCorner(params: ReturnType<typeof getCornerParams>): string {
  const { cornerRadius, a, b, c, d, arcSectionLength, p } = params;
  if (cornerRadius === 0) return `l 0 ${round2(p)}`;
  const arc = arcSectionLength > 0.01
    ? `a ${round2(cornerRadius)} ${round2(cornerRadius)} 0 0 1 ${round2(-arcSectionLength)} ${round2(arcSectionLength)}`
    : "";
  return `c 0 ${round2(a)} 0 ${round2(a + b)} ${round2(-d)} ${round2(a + b + c)} ${arc} c ${round2(-c)} ${round2(d)} ${round2(-b - c)} ${round2(d)} ${round2(-a - b - c)} ${round2(d)}`.trim().replace(/\\s+/g, " ");
}

function drawBottomLeftCorner(params: ReturnType<typeof getCornerParams>): string {
  const { cornerRadius, a, b, c, d, arcSectionLength, p } = params;
  if (cornerRadius === 0) return `l ${round2(-p)} 0`;
  const arc = arcSectionLength > 0.01
    ? `a ${round2(cornerRadius)} ${round2(cornerRadius)} 0 0 1 ${round2(-arcSectionLength)} ${round2(-arcSectionLength)}`
    : "";
  return `c ${round2(-a)} 0 ${round2(-a - b)} 0 ${round2(-a - b - c)} ${round2(-d)} ${arc} c ${round2(-d)} ${round2(-c)} ${round2(-d)} ${round2(-b - c)} ${round2(-d)} ${round2(-a - b - c)}`.trim().replace(/\\s+/g, " ");
}

function drawTopLeftCorner(params: ReturnType<typeof getCornerParams>): string {
  const { cornerRadius, a, b, c, d, arcSectionLength, p } = params;
  if (cornerRadius === 0) return `l 0 ${round2(-p)}`;
  const arc = arcSectionLength > 0.01
    ? `a ${round2(cornerRadius)} ${round2(cornerRadius)} 0 0 1 ${round2(arcSectionLength)} ${round2(-arcSectionLength)}`
    : "";
  return `c 0 ${round2(-a)} 0 ${round2(-a - b)} ${round2(d)} ${round2(-a - b - c)} ${arc} c ${round2(c)} ${round2(-d)} ${round2(b + c)} ${round2(-d)} ${round2(a + b + c)} ${round2(-d)}`.trim().replace(/\\s+/g, " ");
}

function generateFigmaSquirclePath(width: number, height: number, radius: number, smoothing01: number): string {
  const r = Math.min(radius, width / 2, height / 2);
  const s = clamp(smoothing01, 0, 1);
  const budget = Math.min(width / 2, height / 2);
  const tl = getCornerParams(r, s, budget);
  const tr = getCornerParams(r, s, budget);
  const br = getCornerParams(r, s, budget);
  const bl = getCornerParams(r, s, budget);
  return `M ${round2(width - tr.p)} 0 ${drawTopRightCorner(tr)} L ${round2(width)} ${round2(height - br.p)} ${drawBottomRightCorner(br)} L ${round2(bl.p)} ${round2(height)} ${drawBottomLeftCorner(bl)} L 0 ${round2(tl.p)} ${drawTopLeftCorner(tl)} Z`.replace(/\\s+/g, " ").trim();
}

/**
 * Inset/outset variant.
 * - inset > 0 shrinks the shape inward
 * - inset < 0 expands outward (useful to avoid clipping borders)
 */
function generateFigmaSquirclePathWithInset(
  width: number,
  height: number,
  radius: number,
  smoothing01: number,
  inset: number,
): string {
  const w = width - inset * 2;
  const h = height - inset * 2;
  if (w <= 0 || h <= 0) {
    return `M ${round2(inset)} ${round2(inset)} Z`;
  }
  const r = Math.min(radius, w / 2, h / 2);
  const s = clamp(smoothing01, 0, 1);

  const p = (1 + s) * r;
  const arcMeasure = 90 * (1 - s);
  const arcLength = Math.sin(toRadians(arcMeasure / 2)) * r * Math.sqrt(2);
  const angleAlpha = (90 - arcMeasure) / 2;
  const p3ToP4 = r * Math.tan(toRadians(angleAlpha / 2));
  const angleBeta = 45 * s;
  const c = p3ToP4 * Math.cos(toRadians(angleBeta));
  const d = c * Math.tan(toRadians(angleBeta));
  const b = (p - arcLength - c - d) / 3;
  const a = 2 * b;

  const i = inset;
  return `
    M ${round2(w - p + i)} ${round2(i)}
    c ${round2(a)} 0 ${round2(a + b)} 0 ${round2(a + b + c)} ${round2(d)}
    a ${round2(r)} ${round2(r)} 0 0 1 ${round2(arcLength)} ${round2(arcLength)}
    c ${round2(d)} ${round2(c)} ${round2(d)} ${round2(b + c)} ${round2(d)} ${round2(a + b + c)}
    L ${round2(w + i)} ${round2(h - p + i)}
    c 0 ${round2(a)} 0 ${round2(a + b)} ${round2(-d)} ${round2(a + b + c)}
    a ${round2(r)} ${round2(r)} 0 0 1 ${round2(-arcLength)} ${round2(arcLength)}
    c ${round2(-c)} ${round2(d)} ${round2(-b - c)} ${round2(d)} ${round2(-a - b - c)} ${round2(d)}
    L ${round2(p + i)} ${round2(h + i)}
    c ${round2(-a)} 0 ${round2(-a - b)} 0 ${round2(-a - b - c)} ${round2(-d)}
    a ${round2(r)} ${round2(r)} 0 0 1 ${round2(-arcLength)} ${round2(-arcLength)}
    c ${round2(-d)} ${round2(-c)} ${round2(-d)} ${round2(-b - c)} ${round2(-d)} ${round2(-a - b - c)}
    L ${round2(i)} ${round2(p + i)}
    c 0 ${round2(-a)} 0 ${round2(-a - b)} ${round2(d)} ${round2(-a - b - c)}
    a ${round2(r)} ${round2(r)} 0 0 1 ${round2(arcLength)} ${round2(-arcLength)}
    c ${round2(c)} ${round2(-d)} ${round2(b + c)} ${round2(-d)} ${round2(a + b + c)} ${round2(-d)}
    Z
  `.replace(/\\s+/g, " ").trim();
}

function readRadiusPx(cs: CSSStyleDeclaration, outVar: string): number {
  // Prefer the computed px var we control (more reliable than parsing borderRadius).
  const fromVar = parseFloat(cs.getPropertyValue(outVar).trim());
  if (Number.isFinite(fromVar)) return fromVar;
  const raw = cs.borderRadius || "";
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

function attachRoundPx(el: HTMLElement, roundVar: string, outVar: string, base: PercentBase): () => void {
  let raf = 0;
  const compute = () => {
    raf = 0;
    if (!el.isConnected) return;
    const cs = getComputedStyle(el);
    const raw = cs.getPropertyValue(roundVar).trim();
    const bb = el.getBoundingClientRect();
    const w = Math.max(0, bb.width);
    const h = Math.max(0, bb.height);
    const b = base === "w" ? w : base === "h" ? h : Math.min(w, h);
    let px: number | null = null;
    if (raw) {
      const pct = parsePercent(raw);
      if (pct != null) px = (b * pct) / 100;
      else px = parseLengthToPx(raw);
    } else {
      // No `--round` provided on this element: fallback to its computed border-radius.
      px = parseLengthToPx(cs.borderRadius);
    }
    if (px == null || !Number.isFinite(px)) return;
    el.style.setProperty(outVar, `${Math.max(0, px)}px`);
  };
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(compute);
  };
  const ro = new ResizeObserver(() => schedule());
  ro.observe(el);
  // Run once synchronously to avoid "first paint" mismatch.
  compute();
  return () => {
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    el.style.removeProperty(outVar);
  };
}

function attachG2(el: HTMLElement, smoothing01: number, outVar: string): () => void {
  const smoothing = clamp(smoothing01, 0, 1);
  if (typeof window === "undefined") return () => {};
  // 0 = explicitly disabled (pure border-radius)
  if (smoothing <= 0) return () => {};
  const usePath = supportsClipPathPath();
  const defs = usePath ? null : getSvgDefs();
  const clipId = usePath ? "" : `fw-g2-${++svgIdCounter}`;
  let clipPathEl: SVGClipPathElement | null = null;
  let clipPathPathEl: SVGPathElement | null = null;
  if (!usePath) {
    if (!defs) return () => {};
    clipPathEl = document.createElementNS("http://www.w3.org/2000/svg", "clipPath");
    clipPathEl.setAttribute("id", clipId);
    clipPathEl.setAttribute("clipPathUnits", "userSpaceOnUse");
    clipPathPathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
    clipPathEl.appendChild(clipPathPathEl);
    defs.appendChild(clipPathEl);
    el.style.clipPath = `url(#${clipId})`;
    (el.style as any).webkitClipPath = `url(#${clipId})`;
  }

  let raf = 0;
  const dbgId = ++dbgIdCounter;
  let lastDbgKey = "";
  const compute = () => {
    raf = 0;
    if (!el.isConnected) return;
    const cs = getComputedStyle(el);
    const r = readRadiusPx(cs, outVar);
    const rawRound = cs.getPropertyValue("--round").trim();
    const rawRoundPx = cs.getPropertyValue("--roundPx").trim();
    const bb = el.getBoundingClientRect();
    const w = Math.max(0, bb.width);
    const h = Math.max(0, bb.height);
    if (w <= 1 || h <= 1) return;
    const borderW = parseFloat(cs.borderTopWidth || "0") || 0;
    const inset = borderW > 0 ? -borderW : 0;
    const dbgOn = readCssNumber(el, "--debugG2Log", 0) > 0;
    if (usePath) {
      const path = inset !== 0
        ? generateFigmaSquirclePathWithInset(w, h, r, smoothing, inset)
        : generateFigmaSquirclePath(w, h, r, smoothing);
      const v = `path('${path}')`;
      el.style.clipPath = v;
      (el.style as any).webkitClipPath = v;
      el.setAttribute("data-fw-g2", `path:${smoothing}`);
      if (dbgOn) {
        const key = `path|${Math.round(w)}|${Math.round(h)}|${r.toFixed(2)}|${smoothing}|${inset.toFixed(2)}`;
        if (key !== lastDbgKey) {
          lastDbgKey = key;
          console.log(`[G2]#${dbgId}`, {
            mode: "clip-path:path()",
            smoothing,
            w: Math.round(w),
            h: Math.round(h),
            borderRadiusPx: r,
            borderWidthPx: borderW,
            inset,
            rawRound,
            rawRoundPx,
            class: el.getAttribute("class") ?? "",
            clipPath: el.style.clipPath,
          });
        }
      }
    } else if (clipPathPathEl) {
      const p = inset !== 0
        ? generateFigmaSquirclePathWithInset(w, h, r, smoothing, inset)
        : generateFigmaSquirclePath(w, h, r, smoothing);
      clipPathPathEl.setAttribute("d", p);
      el.setAttribute("data-fw-g2", `svg:${smoothing}`);
      if (dbgOn) {
        const key = `svg|${Math.round(w)}|${Math.round(h)}|${r.toFixed(2)}|${smoothing}|${inset.toFixed(2)}`;
        if (key !== lastDbgKey) {
          lastDbgKey = key;
          console.log(`[G2]#${dbgId}`, {
            mode: "svg:clipPath",
            smoothing,
            w: Math.round(w),
            h: Math.round(h),
            borderRadiusPx: r,
            borderWidthPx: borderW,
            inset,
            rawRound,
            rawRoundPx,
            class: el.getAttribute("class") ?? "",
            clipPath: el.style.clipPath,
            clipId,
            dSample: p.slice(0, 80) + (p.length > 80 ? "…" : ""),
          });
        }
      }
    }
  };
  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(compute);
  };
  const ro = new ResizeObserver(() => schedule());
  ro.observe(el);
  // Run once synchronously to avoid "first paint" mismatch.
  compute();
  return () => {
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect();
    el.style.clipPath = "";
    (el.style as any).webkitClipPath = "";
    el.removeAttribute("data-fw-g2");
    if (clipPathEl && clipPathEl.parentNode) clipPathEl.parentNode.removeChild(clipPathEl);
  };
}

export function roundingRef(opts?: {
  /** Read from CSS var (default `--round`) */
  roundVar?: string;
  /** Write px value to CSS var (default `--roundPx`) */
  outVar?: string;
  /** Read smoothing from CSS var (default `--roundSmoothing`) */
  smoothingVar?: string;
  /** 0..1 fallback smoothing if var missing (default 0.6) */
  smoothingFallback?: number;
  /** Base used for % conversion (default "min") */
  percentBase?: PercentBase;
  /** Apply border-radius automatically (default true) */
  applyBorderRadius?: boolean;
  /** Extra CSS vars to set on the element */
  setVars?: Record<string, string>;
  /**
   * If true, hide element until rounding is ready (can delay first paint).
   * Default: false (immediate paint).
   */
  hideUntilReady?: boolean;
}) {
  const roundVar = opts?.roundVar ?? "--round";
  const outVar = opts?.outVar ?? "--roundPx";
  const smoothingVar = opts?.smoothingVar ?? "--roundSmoothing";
  const smoothingFallback = opts?.smoothingFallback ?? 0.6;
  const percentBase = opts?.percentBase ?? "min";
  const applyBorderRadius = opts?.applyBorderRadius !== false;
  const setVars = opts?.setVars;
  const hideUntilReady = opts?.hideUntilReady === true;

  return (el: HTMLElement | SVGElement | null) => {
    if (!(el instanceof HTMLElement)) return;

    if (hideUntilReady) el.setAttribute("data-rounding-pending", "");

    if (applyBorderRadius) {
      // Use fallback so round is correct on first paint before JS writes --roundPx.
      el.style.borderRadius = `var(${outVar}, var(${roundVar}, 0px))`;
    }
    if (setVars) for (const [k, v] of Object.entries(setVars)) el.style.setProperty(k, v);

    const detachRound = attachRoundPx(el, roundVar, outVar, percentBase);
    const smoothing = clamp(readCssNumber(el, smoothingVar, smoothingFallback), 0, 1);
    const detachG2 = attachG2(el, smoothing, outVar);

    let raf = 0;
    if (hideUntilReady) {
      // Unhide on next frame (cheap and deterministic)
      raf = requestAnimationFrame(() => {
        if (el.isConnected) el.removeAttribute("data-rounding-pending");
      });
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      detachG2();
      detachRound();
      if (applyBorderRadius) el.style.borderRadius = "";
      if (setVars) for (const k of Object.keys(setVars)) el.style.removeProperty(k);
      if (hideUntilReady) el.removeAttribute("data-rounding-pending");
    };
  };
}

