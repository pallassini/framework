import { state } from "client";
import VideoCanvasBorder from "../../hero/video-canvas-border";

/** Ritardo fade-in agency (ms); deve coincidere col `delay` dell’animate sotto. */
const agencyEnterDelayMs = 280;

export default function FlowAgencyDes() {
  const logo = state(false);
  const logoPlay = state(false);
  return (
    <>
      <div
        style={{ minHeight: "72vh", minWidth: "min(96vw, 1400px)" }}
        s={{
          base: "relative",
          animate: [
            {
              to: "-ml-32vw -mt-9vh",
              duration: 720,
              delay: 1020,
              ease: "cubic-bezier(0.22, 1, 0.88, 1)",
            },
          ],
        }}
      >
        <div
          s={{
            base: "layers minw-0 ",
            des: "pb-14vh",
          }}
        >
          {/* LIGHT */}
          <div
            show={logo}
            s={{
              base: "z-0 opacity-0 round-circle blur-30px bg-gradient(circle, #fff 40%, rgba(255,255,255,0.4) 55%, rgba(255,255,255,0.15) 70%) maxw-30rem maxh-30rem",
              mob: "w-88vw h-50vw",
              tab: "w-48vw h-20vw",
              des: "w-28.5vw h-23vw mt-35vh",
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

          {/* LOGO */}
          <VideoCanvasBorder
            s={{
              base: "z-1 mt-105vh maxw-30rem w-10vw",
              animate: [
                {
                  to: "mt-35vh opacity-100",
                  duration: 920,
                  ease: "cubic-bezier(0.22, 1, 0.88, 1)",
                  onEnd: () => logoPlay(true),
                },
                {
                  to: "w-22vw",
                  duration: 720,
                  delay: 100,
                  ease: "cubic-bezier(0.22, 1, 0.88, 1)",
                  onEnd: () => logo(true),
                },
              ],
            }}
            src="../assets/logo.webm"
            playWhen={logoPlay}
          />
        </div>

        {/* FLOW AGENCY: assoluto a destra del layers → il logo non viene ri-centrato; entrata morbida */}
        <div
          show={logo}
          style={{
            position: "absolute",
            left: "100%",
            marginLeft: "-52vw",
            top: "37vh",
          }}
          s={{ base: "col centerX" }}
        >
          {/* Fade solo sul titolo; agency: video normale + blend come hero (niente canvas) */}
          <div
            s={{
              base: "z-1",
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
              s={{ base: "z-1", mob: "w-60vw", tab: "w-33vw", des: "w-25vw" }}
              src="../assets/flow.webp"
            />
          </div>
          <video
            s={{
              base: "z-1 opacity-0",
              mob: "w-98vw -mt-6vh -ml-2vw",
              tab: "w-33vw -mt-1vh",
              des: "w-40vw -mt-10vh -ml-0.5vw",
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
            src="../assets/agency.webm"
            loop
            muted
            blend
            playWhen={logo}
            playEnterDelayMs={agencyEnterDelayMs}
            playLeadMs={100}
          />
        </div>
      </div>
    </>
  );
}
