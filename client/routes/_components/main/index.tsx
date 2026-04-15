export default function Main() {
  return (
    <>
      <img
        src="./logo.webp"
        s={{
          base: { "center mt-55vh w-10vw opacity-0": true },
          animate: [
            {
              to: "mt-0vh w-15vw opacity-100",
              duration: 700,
              ease: "ease-in-out",
            },
            {
              to: " w-18vw -ml-20vw -mt-10vh",
              duration: 400,
              ease: "ease-in-out",
            },
            {
              to: "",
              duration: 0,
              ease: "ease-in-out",
            },
          ],
        }}
      />
    </>
  );
}
