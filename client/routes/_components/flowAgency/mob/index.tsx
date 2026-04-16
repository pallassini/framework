import { state, watch } from "client";
import VideoMobile from "./video-mobile";

/** Ritardo fade-in agency (ms); allineato al `delay` dell’animate sul video. */
const agencyEnterDelayMs = 280;

/** URL assoluti risolti da Vite. */
const MOB_LOGO_WEBP = new URL("../assets/logo.webp", import.meta.url).href;
const MOB_FLOW_WEBP = new URL("./_assets/flow.webp", import.meta.url).href;
const MOB_AGENCY_WEBM = new URL("./_assets/agency.webm", import.meta.url).href;

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`preloadImage: ${url}`));
    img.src = url;
  });
}

function preloadVideo(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.muted = true;
    v.preload = "auto";
    v.playsInline = true;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      try {
        v.pause();
      } catch {
        /* ok */
      }
      v.removeAttribute("src");
      v.load();
      resolve();
    };
    const fail = () => {
      if (settled) return;
      settled = true;
      reject(new Error(`preloadVideo: ${url}`));
    };
    v.addEventListener("canplaythrough", finish, { once: true });
    v.addEventListener("loadeddata", finish, { once: true });
    v.addEventListener("error", fail, { once: true });
    v.src = url;
    v.load();
  });
}

function preloadFlowAgencyMobAssets(): Promise<void> {
  return Promise.all([
    preloadImage(MOB_LOGO_WEBP),
    preloadImage(MOB_FLOW_WEBP),
    preloadVideo(MOB_AGENCY_WEBM),
  ]).then(() => undefined);
}

/**
 * Mobile / tablet: logo `logo.webp`; agency in video + blend.
 */
export default function FlowAgencyMob() {
  const logo = state(false);
  const assetsReady = state(false);
  const preloadStarted = state(false);

  watch(() => {
    if (assetsReady() || preloadStarted()) return;
    preloadStarted(true);
    void preloadFlowAgencyMobAssets()
      .then(() => assetsReady(true))
      .catch(() => assetsReady(true));
  });

  return (
    <div
      show={assetsReady}
      s={{
        base: "relative col top centerX w-100% mt-12vh gap-3vh",
      }}
    >
      <div
        style={{ placeItems: "start center", alignContent: "start" }}
        s={{ base: "layers w-100% minw-0" }}
      >
        <div
          show={logo}
          s={{
            base:
              "z-0 opacity-0 round-circle blur-30px bg-gradient(circle, #fff 40%, rgba(255,255,255,0.4) 55%, rgba(255,255,255,0.15) 70%) maxw-30rem maxh-30rem w-88vw h-50vw",
            animate: [
              {
                to: "opacity-100",
                duration: 1400,
                ease: "ease-out",
                fill: "both",
              },
              {
                keyframes: {
                  0: { opacity: 1, scale: 1 },
                  25: { opacity: 0.88, scale: 1.025 },
                  50: { opacity: 0.72, scale: 1.05 },
                  75: { opacity: 0.88, scale: 1.025 },
                  100: { opacity: 1, scale: 1 },
                },
                duration: 5200,
                ease: "inout",
                iterations: "infinite",
              },
            ],
          }}
        />
        <img
          alt=""
          decoding="async"
          s={{
            base: "z-1 maxw-30rem mt-175vh opacity-0 w-12vw",
            animate: [
              {
                to: "mt-40vh w-20vw opacity-100",
                duration: 920,
                ease: "cubic-bezier(0.22, 1, 0.88, 1)",
              },
              {
                to: "w-60vw mt-2vh",
                duration: 720,
                delay: 100,
                ease: "cubic-bezier(0.22, 1, 0.88, 1)",
                onEnd: () => logo(true),
              },
            ],
          }}
          src={MOB_LOGO_WEBP}
        />
      </div>

      <div
        show={logo}
        s={{ base: "col centerX w-100% mt-8vh gap-0" }}
      >
        <div
          s={{
            base: "relative z-2",
            animate: [
              {
                opacity: [0, 1],
                x: ["1.25rem", "0"],
                duration: 1000,
                ease: "cubic-bezier(0.22, 1, 0.88, 1)",
                fill: "both",
              },
            ],
          }}
        >
          <img
            s={{ base: "z-1 maxw-30rem w-60vw mx-5vw" }}
            src={MOB_FLOW_WEBP}
          />
        </div>
        <VideoMobile
          s={{
            base: "relative z-1 maxw-30rem w-98vw -mt-5vh opacity-0",
            animate: [
              {
                to: "opacity-100",
                duration: 960,
                delay: agencyEnterDelayMs,
                ease: "cubic-bezier(0.22, 1, 0.88, 1)",
                fill: "both",
              },
            ],
          }}
          src={MOB_AGENCY_WEBM}
          loop
          muted
          playWhen={logo}
          playEnterDelayMs={agencyEnterDelayMs}
          playLeadMs={100}
        />
      </div>
    </div>
  );
}
