import { go, mob } from "client";

export default function Menu() {
  return (
    <>
      <div
        s={{
          base: "row center gap-10vw weight-600 w-100% fixed top-0 left-0 z-50 h-6vh bg-background text-#fff font-5 text-3",
          mob: "gap-10vw",
          des: "gap-10vw",
        }}
      >
        <t>APP</t>
        <t>
          SITO<t show={!mob()}> WEB</t>
        </t>
        <t>EMAIL <t show={!mob()}> PROFESSIONALE</t></t>
        <t click={() => go("/contacts")}>CONTATTI</t>
      </div>

      {/* BOTTOM SHADOW */}
      <div s="fixed mt-6vh  w-100% h-1vh z-40 bg-gradient(180deg, var(--background), transparent) " />
    </>
  );
}
