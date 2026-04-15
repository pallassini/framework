import { des } from "client";
import VideoCanvasBorder from "./video-canvas-border";

export default function Hero() {
  return (
    <>
      <div
        s={{
          base: "row",
          mob: "mt-21vh -ml-5vw",
          tab: "mt-35vh ml-5vw",
          des: "mt-13vh ml-10vw ",
        }}
      >
         <show when={des()}>
        <div s={{ base: "layers" }}>
          {/* LIGHT */}
          <div
            s={{
              base: "z-0 round-circle blur-30px bg-gradient(circle, #fff 40%, rgba(255,255,255,0.4) 55%, rgba(255,255,255,0.15) 70%)",
              mob: "w-48vw h-20vw",
              tab: "w-48vw h-20vw",
              des: "w-39.5vw h-28vw",
              animate: {
                keyframes: {
                  0: { opacity: 0.62, scale: 1 },
                  25: { opacity: 0.88, scale: 1.015 },
                  50: { opacity: 1, scale: 1.03 },
                  75: { opacity: 0.88, scale: 1.015 },
                  100: { opacity: 0.62, scale: 1 },
                },
                duration: 5200,
                ease: "inout",
                iterations: "infinite",
              },
            }}
          />
          {/* LOGO */}
        
          <VideoCanvasBorder
            s={{ base: "z-1", mob: "w-37vw", tab: "w-33vw", des: "w-22vw" }}
            src="./_assets/logo.webm"
          />
       
        </div>
        </show>
        {/* FLOW AGENCY */}
        <div s={{ base: "col", mob: "mt-4vh ml-3vw", tab: "mt-14vh -ml-2.5vw", des: "mt-14vh -ml-2.5vw" }}>
          <img
            s={{ base: "z-1", mob: "w-40vw", tab: "w-33vw", des: "w-25vw" }}
            src="./_assets/flow.webp"
          />
          <video
            s={{
              base: "z-1",
              mob: "w-60vw -mt-3vh",
              tab: "w-33vw -mt-1vh",
              des: "w-40vw -mt-11vh -ml-0.5vw",
            }}
            src="./_assets/agency.webm"
            blend
            autoplay
            loop
            muted
          />
        </div>
      </div>

      <div s="col">
        <t s="mt-80vh">FLOW AGENCY</t>
        <t s="mt-80vh">FLOW AGENCY</t>
      </div>
    </>
  );
}
