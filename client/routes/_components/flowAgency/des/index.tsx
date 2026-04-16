import { state } from "client";
import VideoCanvasBorder from "../../hero/video-canvas-border";

export default function FlowAgencyDes() {
  const logo = state(false);
  const logoPlay = state(false);
  return (
    <>
      <div
        s={{
          base: "layers",
          animate: [
            {
              to: "-ml-44vw -mt-9vh",
              duration: 720,
              delay: 1020,
              ease: "cubic-bezier(0.22, 1, 0.88, 1)",
            },
          ],
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
    </>
  );
}
