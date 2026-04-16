import { state } from "client";

export default function Main() {
  const logo = state(false)
  return (
    <>
      <div s="row w-100% center mt-30vh">
      <show when={!logo}>
        <img
          src="./logo.webp"
          s={{
            base: { "mt-75vh w-5vw opacity-0": true },
            animate: [
              {
                to: "mt-10vh w-10vw opacity-100",
                duration: 900,
                ease: "cubic-bezier(0.22, 1, 0.88, 1)",
              },
              {
                to: " w-16vw -ml-30vw -mt-0vh",
                duration: 400,
                ease: "ease-in-out",
                delay: 100,
                onEnd: () => logo(true),
              },

            ],
          }}
        />
      </show>
      <show when={logo}>
        <video src="./logo.webm" s={{ base: "w-10vw opacity-100  -ml-30vw" }} />
      </show>
      </div>
    </>
  );
}
