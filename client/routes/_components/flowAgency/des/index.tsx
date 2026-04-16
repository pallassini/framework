import { state } from "client";
import VideoCanvasBorder from "../../hero/video-canvas-border";

export default function FlowAgencyDes() {
  const logo = state(false);
  return (
    <>
      {/* ================ LOGO ================ */}

      {/* === INTRO === */}
      <switch value={logo}>
        <case when={false}>
          {/* LOGO */}
          <div s="center">
            <img
              src="../assets/logo.webp"
              s={{
                base: { "mt-105vh w-5vw opacity-0": true },
                animate: [
                  {
                    to: "mt-35vh w-10vw opacity-100",
                    duration: 900,
                    ease: "cubic-bezier(0.22, 1, 0.88, 1)",
                  },
                  {
                    to: "w-21vw -ml-40vw mt-28vh",
                    duration: 400,
                    ease: "ease-in-out",
                    delay: 100,
                    onEnd: () => logo(true),
                  },
                ],
              }}
            />
          </div>
        </case>

        {/* === FINAL === */}
        <case when={true}>
         <div s='row'>
          <div s="">
            <VideoCanvasBorder
              s="maxw-30rem mt-28vh w-22vw"
              src="../assets/logo.webm"
            />
            {/* LIGHT */}
            <Ligth />
          </div>
         </div>
        </case>
      </switch>
    </>
  );
}

function Ligth() {
  return (
    <div
      s={{
        base: "z-0 round-circle blur-30px bg-gradient(circle, #fff 40%, rgba(255,255,255,0.4) 55%, rgba(255,255,255,0.15) 70%) maxw-30rem maxh-30rem",
        mob: "w-88vw h-50vw",
        tab: "w-48vw h-20vw",
        des: "w-28.5vw h-23vw",
        animate: {
          keyframes: {
            0: { opacity: 0.62, scale: 1 },
            25: { opacity: 0.88, scale: 1.025 },
            50: { opacity: 1, scale: 1.05 },
            75: { opacity: 0.88, scale: 1.025 },
            100: { opacity: 0.62, scale: 1 },
          },
          duration: 5200,
          ease: "inout",
          iterations: "infinite",
        },
      }}
    />
  );
}
