export default function Test() {
  return (
    <>
      <div data-booking-widget="" data-variant="button" />
      {/* Pagina su :3002 (ecc.); widget sempre da :3000 — origine fissa tipo CDN locale. */}
      <script src="https://localhost:3000/booker.js" defer crossorigin="" />
    </>
  );
}
