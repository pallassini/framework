import { state } from "client";

export default function Main() {
  const logo = state(false)
  return (
    <>
    <div s={{base:"center round-50px w-70vw h-80vh mt-15vh bg-fff b-#fff"}}>
    <show when={true}>
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
                to: " w-16vw -ml-35vw mt-10vh",
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
        <video src="./agency.webm" s={{ base: " w-15vw opacity-100" }} autoplay loop muted blend />
      </show>
    </div>
      <div s="row w-100% center mt-30vh">
     

      </div>
    </>
  );
}
