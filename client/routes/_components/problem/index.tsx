import { des } from "client";

/** Full quality ~1836×792 — solo desktop. */
const BRUCIARE_DES = new URL("./BRUCIARE.webm", import.meta.url).href;
/** ~720×310, 24 fps, CRF 34 — mob/tab (~1 MB vs ~4.8 MB desktop). */
const BRUCIARE_MOB = new URL("./BRUCIARE_mob.webm", import.meta.url).href;

export default function Problem() {
  return (
  <div s='col center round-20px b-#fff bt-1px'>
    <video
      src={des() ? BRUCIARE_DES : BRUCIARE_MOB}
      s={{
        des: "w-40vw maxw-80rem",
        mob: "w-92vw",
      }}
      blend
      autoplay
      loop
      muted
    />
    <t s='font-7 text-10'>SOLDI PER SOFTWARE MEDIOCRI</t>
  </div>
  );
}
