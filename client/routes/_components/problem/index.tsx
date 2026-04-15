import { des, mob } from "client";

const muted = "text-#8f8f8f des:(text-9) mob:(text-6)";
const hot = "text-#ff0000 des:(text-10) mob:(text-8)";

export default function Stop() {
  return (
    <div s="col font-6 center">
      {/* 1st */}
      <div
        s={{
          base: "row center",
          mob: "text-5.5vw",
          tab: "text-2vw",
          des: "text-2vw ",
        }}
      >
        <t>SMETTI DI</t>
        <video
          s={{
            mob: "w-60vw  -mt-1.2rem -ml-3vw",
            tab: "w-12vw",
            des: "w-30vw -mt-3.5rem -ml-2vw maxw-50rem",
          }}
          src="./bruciare.webm"
          blend
          autoplay
          loop
          muted
        />
        <t s={{ mob: "-ml-3vw ", des: "-ml-2vw" }}>SOLDI {des() ? "IN SOFTWARE MEDIOCRI" : ""}</t>
      </div>
      <t show={mob()} s="-mt-2rem text-5.5vw">
        IN SOFTWARE MEDIOCRI
      </t>

      {/* 2nd+3rd: mob = 3 righe centrate; tab/des = una row bottom + riga 20k */}
      <div
        s={{
          base: "font-5 w-100% col",
          mob: "mt-3vh gapy-2 centerx",
          tab: "-mt-5vh gapy-2",
          des: "-mt-5vh gapy-2",
        }}
      >
        <div
          s={{
            mob: "w-100% col gapy-1 centerx",
            tab: "row wrap centerx bottom",
            des: "row wrap centerx bottom",
          }}
        >
          <div s={{ mob: "w-100% centerx", tab: "contents", des: "contents" }}>
            <t s={{ base: muted, mob: "mr-1.5vw", des: "mr-0.5vw" }}>Ti vendono app</t>{" "}
            <t s={hot}>non personalizzate</t>
            <t s={muted} show={() => !mob()}>
              ,
            </t>
          </div>
          <div s={{ mob: "w-100% centerx", tab: "contents", des: "contents" }}>
            <t s={{ base: hot, mob: "mr-0.5vw", des: "mr-0.5vw ml-0.5vw" }}>poco performanti</t>{" "}
            <t s={{ base: muted, mob: "mr-0.5vw", des: "mr-0.5vw" }}> e </t>{" "}
            <t s={hot}> impossibili da scalare</t>
          </div>
        </div>
        <div
          s={{
            base: "row centerx bottom font-5 gapx-2",
          }}
        >
          <t s={muted}>e te le fanno pagare</t>
          <t s={hot}>20k</t>
        </div>
      </div>
    </div>
  );
}
