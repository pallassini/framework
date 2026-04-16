import { applyStyle, type StyleInput } from "../../../../core/client/style";
import { onNodeDispose } from "../../../../core/client/runtime/logic/lifecycle";
import type { Node } from "../../../../core/client/runtime/logic/jsx-runtime";
import { watch, type Signal } from "../../../../core/client/state";

/** Colore “nero” da rimuovere se connesso ai bordi (RGB). */
const TARGET = [3, 3, 3] as const;
const TOLERANCE = 100;
/** >0 limita la profondità del flood dal bordo (0 = illimitato). */
const MAX_DIST = 0;
const MAX_SIZE = 480;
/** Sotto i ~24fps il costo di `getImageData` + flood fill al secondo scende sensibilmente (CPU + sincronizzazione GPU). */
const FPS = 16;

function matches(r: number, g: number, b: number): boolean {
	return (
		Math.abs(r - TARGET[0]) <= TOLERANCE &&
		Math.abs(g - TARGET[1]) <= TOLERANCE &&
		Math.abs(b - TARGET[2]) <= TOLERANCE
	);
}

function distToEdge(x: number, y: number, w: number, h: number): number {
	return Math.min(x, y, w - 1 - x, h - 1 - y);
}

function processFrame(
	ctx: CanvasRenderingContext2D,
	maskCanvas: HTMLCanvasElement,
	maskCtx: CanvasRenderingContext2D,
	w: number,
	h: number,
	imgData: ImageData,
	queue: Uint32Array,
	visited: Uint8Array,
	maskData: ImageData,
): void {
	const { data } = imgData;
	visited.fill(0);
	let tail = 0;
	const idx = (x: number, y: number) => y * w + x;

	const tryPush = (x: number, y: number) => {
		const i = idx(x, y);
		if (visited[i]) return;
		const p = (y * w + x) * 4;
		if (!matches(data[p], data[p + 1], data[p + 2])) return;
		visited[i] = 1;
		queue[tail++] = i;
	};

	for (let x = 0; x < w; x++) {
		tryPush(x, 0);
		tryPush(x, h - 1);
	}
	for (let y = 0; y < h; y++) {
		tryPush(0, y);
		tryPush(w - 1, y);
	}

	const dirs: [number, number][] = [
		[0, 1],
		[0, -1],
		[1, 0],
		[-1, 0],
	];
	let head = 0;
	while (head < tail) {
		const flat = queue[head++];
		const x = flat % w;
		const y = (flat / w) | 0;
		for (const [dx, dy] of dirs) {
			const nx = x + dx;
			const ny = y + dy;
			if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
			const ni = idx(nx, ny);
			if (visited[ni]) continue;
			const i = (ny * w + nx) * 4;
			if (!matches(data[i], data[i + 1], data[i + 2])) continue;
			if (MAX_DIST > 0 && distToEdge(nx, ny, w, h) > MAX_DIST) continue;
			visited[ni] = 1;
			queue[tail++] = ni;
		}
	}

	const md = maskData.data;
	for (let i = 0; i < visited.length; i++) {
		const j = i * 4;
		md[j] = md[j + 1] = md[j + 2] = 255;
		md[j + 3] = visited[i] ? 0 : 255;
	}
	maskCtx.putImageData(maskData, 0, 0);
	ctx.globalCompositeOperation = "destination-in";
	ctx.drawImage(maskCanvas, 0, 0);
	ctx.globalCompositeOperation = "source-over";
}

export type VideoCanvasBorderProps = {
	/** Path relativo sotto `client/routes` (riscritto dal plugin) o URL assoluto. */
	src: string;
	s?: StyleInput;
	/**
	 * Se impostato, il video non parte da solo al `loadedmetadata`: mostra il primo frame
	 * finché il segnale non diventa `true`, poi chiama `play()`.
	 */
	playWhen?: Signal<boolean>;
	/**
	 * Chiamato una volta che il canvas è pronto: ricevi `play` da invocare quando vuoi avviare
	 * la riproduzione (es. dopo un’animazione o al tap). Implica lo stesso comportamento di
	 * attesa del primo frame di `playWhen` (nessun autoplay finché non chiami `play()`).
	 */
	getPlay?: (play: () => void) => void;
};

/**
 * Video disegnato su canvas: flood fill dai bordi rimuove solo il nero connesso al contorno.
 * Il video è nascosto: lo stacking e gli `s` applicati al canvas non interferiscono con il blend del tag `<video>`.
 */
export default function VideoCanvasBorder(props: VideoCanvasBorderProps): Node {
	const { src, s, playWhen, getPlay } = props;
	const deferPlayback = playWhen != null || getPlay != null;

	const wrap = document.createElement("div");
	wrap.style.position = "relative";
	wrap.style.display = "inline-block";

	const video = document.createElement("video");
	video.src = src;
	video.muted = true;
	video.loop = true;
	video.autoplay = false;
	video.playsInline = true;
	video.preload = "metadata";
	video.setAttribute("data-fw-skip-prefetch", "");
	video.setAttribute("playsinline", "");
	Object.assign(video.style, {
		position: "absolute",
		width: "0",
		height: "0",
		opacity: "0",
		pointerEvents: "none",
	});

	const canvas = document.createElement("canvas");
	canvas.style.display = "block";
	canvas.style.maxWidth = "100%";
	canvas.style.height = "auto";
	if (s != null) applyStyle(canvas, s);

	let rafId = 0;
	let timeoutId = 0;
	let lastFrame = 0;
	const interval = 1000 / FPS;
	let started = false;
	let metadataReady = false;
	let playbackStarted = false;
	let disposed = false;

	const stop = () => {
		if (rafId) cancelAnimationFrame(rafId);
		if (timeoutId) clearTimeout(timeoutId);
		rafId = 0;
		timeoutId = 0;
	};

	const cleanup = () => {
		if (disposed) return;
		disposed = true;
		stop();
		document.removeEventListener("visibilitychange", onVisibilityChange);
		video.removeEventListener("pause", stop);
		video.removeEventListener("ended", stop);
		video.removeEventListener("play", scheduleNext);
		video.removeEventListener("loadedmetadata", onLoadedMetadata);
		try {
			video.pause();
		} catch {}
		video.src = "";
	};

	const scheduleNext = () => {
		if (disposed || rafId || timeoutId) return;
		if (document.hidden || video.paused) return;
		const wait = Math.max(0, interval - (performance.now() - lastFrame));
		if (wait <= 4) {
			rafId = requestAnimationFrame(tick);
			return;
		}
		timeoutId = window.setTimeout(() => {
			timeoutId = 0;
			rafId = requestAnimationFrame(tick);
		}, wait);
	};

	const onVisibilityChange = () => {
		if (document.hidden) {
			stop();
			return;
		}
		scheduleNext();
	};

	const tick = (t: number) => {
		rafId = 0;
		if (disposed) return;
		/**
		 * Il wrap può non essere ancora `isConnected` nel frame in cui il parent finisce di montare
		 * (es. `<show>`). Non chiamare `cleanup()` qui: smontava il video e azzerava `src` prima dell’attach.
		 */
		if (!wrap.isConnected) {
			rafId = requestAnimationFrame(tick);
			return;
		}
		if (document.hidden || video.paused || video.readyState < 2) {
			scheduleNext();
			return;
		}
		if (t - lastFrame < interval) {
			scheduleNext();
			return;
		}
		lastFrame = t;
		drawFrame();
		scheduleNext();
	};

	let drawFrame = () => {};

	const paintStillFrame = () => {
		if (disposed) return;
		try {
			if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) drawFrame();
		} catch {
			/* primo frame opzionale */
		}
	};

	const startPlayback = () => {
		if (disposed || playbackStarted) return;
		playbackStarted = true;
		void video.play().catch(() => {});
		lastFrame = performance.now() - interval;
		scheduleNext();
		video.addEventListener("pause", stop);
		video.addEventListener("ended", stop);
		video.addEventListener("play", scheduleNext);
	};

	const onLoadedMetadata = () => {
		if (started) return;
		started = true;

		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (!vw || !vh) return;

		const scale = Math.min(1, MAX_SIZE / Math.max(vw, vh));
		const w = Math.round(vw * scale);
		const h = Math.round(vh * scale);

		canvas.width = w;
		canvas.height = h;

		const maskCanvas = document.createElement("canvas");
		maskCanvas.width = w;
		maskCanvas.height = h;
		const maskCtx = maskCanvas.getContext("2d", { alpha: true });
		if (!maskCtx) return;

		const ctx = canvas.getContext("2d", {
			alpha: true,
			willReadFrequently: true,
		});
		if (!ctx) return;

		const queue = new Uint32Array(w * h);
		const visited = new Uint8Array(w * h);
		const maskData = maskCtx.createImageData(w, h);

		drawFrame = () => {
			ctx.imageSmoothingEnabled = false;
			ctx.globalCompositeOperation = "source-over";
			ctx.drawImage(video, 0, 0, vw, vh, 0, 0, w, h);
			const imgData = ctx.getImageData(0, 0, w, h);
			processFrame(ctx, maskCanvas, maskCtx, w, h, imgData, queue, visited, maskData);
		};

		metadataReady = true;

		if (deferPlayback) {
			try {
				video.pause();
			} catch {
				/* */
			}
			video.currentTime = 0;
			video.addEventListener("seeked", paintStillFrame, { once: true });
			video.addEventListener("loadeddata", paintStillFrame, { once: true });
			queueMicrotask(() => {
				if (!playbackStarted) paintStillFrame();
			});
			if (playWhen?.()) startPlayback();
			if (getPlay) {
				queueMicrotask(() => {
					if (!disposed) getPlay(startPlayback);
				});
			}
		} else {
			startPlayback();
		}
	};

	video.addEventListener("loadedmetadata", onLoadedMetadata);
	document.addEventListener("visibilitychange", onVisibilityChange);

	const stopPlayWhenWatch =
		playWhen != null
			? watch(() => {
					const wantPlay = playWhen();
					if (metadataReady && wantPlay) startPlayback();
				})
			: null;

	onNodeDispose(wrap, () => {
		stopPlayWhenWatch?.();
		cleanup();
	});

	wrap.append(video, canvas);
	video.load();
	if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
		queueMicrotask(() => {
			if (!disposed) onLoadedMetadata();
		});
	}

	return wrap;
}
