import VideoMobile from "./video-mobile";
import VideoCanvasBorder from "./video-canvas-border";

/** Solo viewport mobile: layout colonna, logo e flow/agency centrati orizzontalmente. */
export default function Hero() {
  return (
    <>
      <div
        s={{
          base: "col centerX w-100% mt-13vh gap-3vh",
        }}
      >
        <div s={{ base: "layers w-100%" }}>
          {/* LIGHT */}
          <div
            s={{
              base:
                "z-0 round-circle blur-30px bg-gradient(circle, #fff 40%, rgba(255,255,255,0.4) 55%, rgba(255,255,255,0.15) 70%) maxw-30rem maxh-30rem w-88vw h-50vw",
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
          <VideoCanvasBorder
            s={{ base: "z-1 maxw-30rem w-60vw" }}
            src="./_assets/logo.webm"
          />
        </div>
        <div s={{ base: "col centerX w-100% mt-7vh gap-3vh" }}>
          <img
            s={{ base: "z-1 maxw-30rem w-60vw mx-5vw" }}
            src="./_assets/flow.webp"
          />
          <VideoMobile
            s={{
              base: "z-1 maxw-30rem w-98vw -mt-6vh",
            }}
            src="./_assets/agency.webm"
            autoplay
            loop
            muted
          />
        </div>
      </div>
    </>
  );
}
