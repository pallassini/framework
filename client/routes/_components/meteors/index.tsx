export type MeteorsConfig = {
  height?: string;
  fill?: boolean;
  /** Solo con `fill`: spawn verticale in % del parent (`min` negativo = più sopra). */
  fillSpawnTop?: { min: number; max: number };
  density?: number;
  count?: number;
  spawnTop?: { min: number; max: number };
  size?: number;
  sizeLarge?: number;
  sizeLargeRate?: number;
  tailLength?: number;
  duration?: { min: number; max: number };
  distance?: { min: number; max: number };
  angle?: { min: number; max: number };
  delayMax?: number;
  opacity?: { min: number; max: number };
  color?: string;
};

const DEFAULT_FILL_SPAWN = { min: -55, max: 88 };

const DEFAULT_CONFIG: Required<
  Omit<MeteorsConfig, "color" | "fill" | "density" | "sizeLarge" | "sizeLargeRate" | "distance" | "angle" | "opacity" | "fillSpawnTop">
> & {
  color: string;
  fill: boolean;
  density: number;
  sizeLarge: number;
  sizeLargeRate: number;
  distance: { min: number; max: number };
  angle: { min: number; max: number };
  opacity: { min: number; max: number };
} = {
  height: "100vh",
  fill: false,
  density: 1,
  count: 12,
  spawnTop: { min: -80, max: -20 },
  size: 1.5,
  sizeLarge: 2.2,
  sizeLargeRate: 0.12,
  tailLength: 22,
  duration: { min: 4, max: 10 },
  distance: { min: 55, max: 130 },
  angle: { min: 198, max: 228 },
  delayMax: 16,
  opacity: { min: 0.55, max: 0.92 },
  color: "rgb(100, 116, 139)",
};

function random(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export default function Meteors(config: MeteorsConfig = {}) {
  const c = { ...DEFAULT_CONFIG, ...config };
  const spawnTop = c.spawnTop ?? DEFAULT_CONFIG.spawnTop;
  const duration = c.duration ?? DEFAULT_CONFIG.duration;
  const distance = c.distance ?? DEFAULT_CONFIG.distance;
  const angle = c.angle ?? DEFAULT_CONFIG.angle;
  const opacityRange = c.opacity ?? DEFAULT_CONFIG.opacity;
  const delayMax = c.delayMax ?? 16;

  const effectiveCount = Math.max(
    1,
    Math.round((c.count ?? DEFAULT_CONFIG.count) * (c.density ?? 1) * random(0.85, 1.15)),
  );

  const fillSpawn = c.fillSpawnTop ?? DEFAULT_FILL_SPAWN;

  const meteors = Array.from({ length: effectiveCount }, (_, i) => {
    const isLarge = Math.random() < (c.sizeLargeRate ?? DEFAULT_CONFIG.sizeLargeRate);
    const size = isLarge ? (c.sizeLarge ?? c.size! * 1.4) : c.size!;
    const sizeRatio = Math.min(size / c.size!, 1.4);
    const tailLen = Math.round(c.tailLength! * (0.85 + 0.25 * sizeRatio));
    return {
      id: i,
      left: c.fill ? `${random(-30, -5)}%` : `${Math.random() * 100}%`,
      top: c.fill ? `${random(fillSpawn.min, fillSpawn.max)}%` : `${random(spawnTop!.min, spawnTop!.max)}px`,
      size,
      tailLength: tailLen,
      duration: random(duration.min, duration.max),
      delay: random(0, delayMax),
      distance: random(distance.min, distance.max),
      angle: random(angle.min, angle.max),
      opacity: random(opacityRange.min, opacityRange.max),
    };
  });

  const inner = document.createElement("div");
  inner.style.pointerEvents = "none";
  inner.style.position = "absolute";
  inner.style.inset = "0";
  inner.style.overflow = "visible";
  inner.style.width = "100%";
  inner.style.height = "100%";

  for (const m of meteors) {
    const head = document.createElement("div");
    head.style.position = "absolute";
    head.style.borderRadius = "9999px";
    head.style.top = m.top;
    head.style.left = m.left;
    head.style.width = `${m.size}px`;
    head.style.height = `${m.size}px`;
    head.style.backgroundColor = c.color!;
    head.style.setProperty("--meteor-dist", `${m.distance}vmax`);
    head.style.setProperty("--meteor-angle", `${m.angle}deg`);
    head.style.setProperty("--meteor-opacity", String(m.opacity));
    head.style.animation = `meteor-fall ${m.duration}s linear ${m.delay}s infinite`;

    const tail = document.createElement("div");
    tail.style.position = "absolute";
    tail.style.top = "50%";
    tail.style.left = "100%";
    tail.style.width = `${m.tailLength}px`;
    tail.style.height = "1px";
    tail.style.transform = "translateY(-50%)";
    tail.style.background = `linear-gradient(to right, ${c.color}, transparent)`;

    head.appendChild(tail);
    inner.appendChild(head);
  }

  if (c.fill) {
    const wrap = document.createElement("div");
    wrap.style.position = "absolute";
    wrap.style.inset = "0";
    wrap.style.overflow = "hidden";
    wrap.style.zIndex = "-1";
    wrap.appendChild(inner);
    return wrap;
  }

  const outer = document.createElement("div");
  outer.style.position = "relative";
  outer.style.width = "100%";
  outer.style.overflow = "hidden";
  outer.style.height = c.height!;
  outer.appendChild(inner);
  return outer;
}
