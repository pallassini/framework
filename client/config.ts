import { v } from "../core/client/validator";

export const clientConfig = {
  // STATE
  state: {
    id: v.uuid(),
  },

  // SESSION STATE
  sessionState: {
    id: v.uuid(),
  },

  // PERSIST STATE
  persistState: {
    id: v.uuid(),
    
    devtools: {
      menu: "db" as "db" | "state",
    },
  },

  // STYLE
  style: {
    /** Stile tipo Lenis (Halo Lab): lerp unico, niente “strisciamento” solo in coda. */
    smoothScroll: true,
    /**
     * Canvas di design per `w-N` / `h-N` / `maxw-N` / `maxh-N` / `minw-N` (N intero 1–100).
     * Il valore è **% del canvas convertito in `rem`** → su schermi più grandi del canvas NON esplode.
     * Default 1920×1080 @ 16px/rem: `w-70` = 84rem (= 1344px @ 16px/rem).
     */
    canvas: {
      width: 1920,
      height: 1080,
      remPx: 16,
    },
    /**
     * Spacing (padding, margin, gap, inset, w/h/maxw via token): **rem** puri, costanti per viewport.
     * Progressione Tailwind-style:
     * - **1–20**: +0.25rem/step (UI fine) → `1`=0.25rem (4px), `20`=5rem (80px)
     * - **21–40**: +0.5rem/step (layout medio) → `30`=10rem, `40`=15rem
     * - **41–100**: +1rem/step (layout large/hero) → `50`=25rem, `100`=75rem
     * Ratio fisso viewport: `mob` = 75%, `tab` = 87.5%, `des` = 100% dei valori qui sotto.
     */
    base: {
      "1": { mob: "0.1875rem", tab: "0.2188rem", des: "0.25rem" },
      "2": { mob: "0.375rem", tab: "0.4375rem", des: "0.5rem" },
      "3": { mob: "0.5625rem", tab: "0.6563rem", des: "0.75rem" },
      "4": { mob: "0.75rem", tab: "0.875rem", des: "1rem" },
      "5": { mob: "0.9375rem", tab: "1.0938rem", des: "1.25rem" },
      "6": { mob: "1.125rem", tab: "1.3125rem", des: "1.5rem" },
      "7": { mob: "1.3125rem", tab: "1.5313rem", des: "1.75rem" },
      "8": { mob: "1.5rem", tab: "1.75rem", des: "2rem" },
      "9": { mob: "1.6875rem", tab: "1.9688rem", des: "2.25rem" },
      "10": { mob: "1.875rem", tab: "2.1875rem", des: "2.5rem" },
      "11": { mob: "2.0625rem", tab: "2.4063rem", des: "2.75rem" },
      "12": { mob: "2.25rem", tab: "2.625rem", des: "3rem" },
      "13": { mob: "2.4375rem", tab: "2.8438rem", des: "3.25rem" },
      "14": { mob: "2.625rem", tab: "3.0625rem", des: "3.5rem" },
      "15": { mob: "2.8125rem", tab: "3.2813rem", des: "3.75rem" },
      "16": { mob: "3rem", tab: "3.5rem", des: "4rem" },
      "17": { mob: "3.1875rem", tab: "3.7188rem", des: "4.25rem" },
      "18": { mob: "3.375rem", tab: "3.9375rem", des: "4.5rem" },
      "19": { mob: "3.5625rem", tab: "4.1563rem", des: "4.75rem" },
      "20": { mob: "3.75rem", tab: "4.375rem", des: "5rem" },
      "21": { mob: "4.125rem", tab: "4.8125rem", des: "5.5rem" },
      "22": { mob: "4.5rem", tab: "5.25rem", des: "6rem" },
      "23": { mob: "4.875rem", tab: "5.6875rem", des: "6.5rem" },
      "24": { mob: "5.25rem", tab: "6.125rem", des: "7rem" },
      "25": { mob: "5.625rem", tab: "6.5625rem", des: "7.5rem" },
      "26": { mob: "6rem", tab: "7rem", des: "8rem" },
      "27": { mob: "6.375rem", tab: "7.4375rem", des: "8.5rem" },
      "28": { mob: "6.75rem", tab: "7.875rem", des: "9rem" },
      "29": { mob: "7.125rem", tab: "8.3125rem", des: "9.5rem" },
      "30": { mob: "7.5rem", tab: "8.75rem", des: "10rem" },
      "31": { mob: "7.875rem", tab: "9.1875rem", des: "10.5rem" },
      "32": { mob: "8.25rem", tab: "9.625rem", des: "11rem" },
      "33": { mob: "8.625rem", tab: "10.0625rem", des: "11.5rem" },
      "34": { mob: "9rem", tab: "10.5rem", des: "12rem" },
      "35": { mob: "9.375rem", tab: "10.9375rem", des: "12.5rem" },
      "36": { mob: "9.75rem", tab: "11.375rem", des: "13rem" },
      "37": { mob: "10.125rem", tab: "11.8125rem", des: "13.5rem" },
      "38": { mob: "10.5rem", tab: "12.25rem", des: "14rem" },
      "39": { mob: "10.875rem", tab: "12.6875rem", des: "14.5rem" },
      "40": { mob: "11.25rem", tab: "13.125rem", des: "15rem" },
      "41": { mob: "12rem", tab: "14rem", des: "16rem" },
      "42": { mob: "12.75rem", tab: "14.875rem", des: "17rem" },
      "43": { mob: "13.5rem", tab: "15.75rem", des: "18rem" },
      "44": { mob: "14.25rem", tab: "16.625rem", des: "19rem" },
      "45": { mob: "15rem", tab: "17.5rem", des: "20rem" },
      "46": { mob: "15.75rem", tab: "18.375rem", des: "21rem" },
      "47": { mob: "16.5rem", tab: "19.25rem", des: "22rem" },
      "48": { mob: "17.25rem", tab: "20.125rem", des: "23rem" },
      "49": { mob: "18rem", tab: "21rem", des: "24rem" },
      "50": { mob: "18.75rem", tab: "21.875rem", des: "25rem" },
      "51": { mob: "19.5rem", tab: "22.75rem", des: "26rem" },
      "52": { mob: "20.25rem", tab: "23.625rem", des: "27rem" },
      "53": { mob: "21rem", tab: "24.5rem", des: "28rem" },
      "54": { mob: "21.75rem", tab: "25.375rem", des: "29rem" },
      "55": { mob: "22.5rem", tab: "26.25rem", des: "30rem" },
      "56": { mob: "23.25rem", tab: "27.125rem", des: "31rem" },
      "57": { mob: "24rem", tab: "28rem", des: "32rem" },
      "58": { mob: "24.75rem", tab: "28.875rem", des: "33rem" },
      "59": { mob: "25.5rem", tab: "29.75rem", des: "34rem" },
      "60": { mob: "26.25rem", tab: "30.625rem", des: "35rem" },
      "61": { mob: "27rem", tab: "31.5rem", des: "36rem" },
      "62": { mob: "27.75rem", tab: "32.375rem", des: "37rem" },
      "63": { mob: "28.5rem", tab: "33.25rem", des: "38rem" },
      "64": { mob: "29.25rem", tab: "34.125rem", des: "39rem" },
      "65": { mob: "30rem", tab: "35rem", des: "40rem" },
      "66": { mob: "30.75rem", tab: "35.875rem", des: "41rem" },
      "67": { mob: "31.5rem", tab: "36.75rem", des: "42rem" },
      "68": { mob: "32.25rem", tab: "37.625rem", des: "43rem" },
      "69": { mob: "33rem", tab: "38.5rem", des: "44rem" },
      "70": { mob: "33.75rem", tab: "39.375rem", des: "45rem" },
      "71": { mob: "34.5rem", tab: "40.25rem", des: "46rem" },
      "72": { mob: "35.25rem", tab: "41.125rem", des: "47rem" },
      "73": { mob: "36rem", tab: "42rem", des: "48rem" },
      "74": { mob: "36.75rem", tab: "42.875rem", des: "49rem" },
      "75": { mob: "37.5rem", tab: "43.75rem", des: "50rem" },
      "76": { mob: "38.25rem", tab: "44.625rem", des: "51rem" },
      "77": { mob: "39rem", tab: "45.5rem", des: "52rem" },
      "78": { mob: "39.75rem", tab: "46.375rem", des: "53rem" },
      "79": { mob: "40.5rem", tab: "47.25rem", des: "54rem" },
      "80": { mob: "41.25rem", tab: "48.125rem", des: "55rem" },
      "81": { mob: "42rem", tab: "49rem", des: "56rem" },
      "82": { mob: "42.75rem", tab: "49.875rem", des: "57rem" },
      "83": { mob: "43.5rem", tab: "50.75rem", des: "58rem" },
      "84": { mob: "44.25rem", tab: "51.625rem", des: "59rem" },
      "85": { mob: "45rem", tab: "52.5rem", des: "60rem" },
      "86": { mob: "45.75rem", tab: "53.375rem", des: "61rem" },
      "87": { mob: "46.5rem", tab: "54.25rem", des: "62rem" },
      "88": { mob: "47.25rem", tab: "55.125rem", des: "63rem" },
      "89": { mob: "48rem", tab: "56rem", des: "64rem" },
      "90": { mob: "48.75rem", tab: "56.875rem", des: "65rem" },
      "91": { mob: "49.5rem", tab: "57.75rem", des: "66rem" },
      "92": { mob: "50.25rem", tab: "58.625rem", des: "67rem" },
      "93": { mob: "51rem", tab: "59.5rem", des: "68rem" },
      "94": { mob: "51.75rem", tab: "60.375rem", des: "69rem" },
      "95": { mob: "52.5rem", tab: "61.25rem", des: "70rem" },
      "96": { mob: "53.25rem", tab: "62.125rem", des: "71rem" },
      "97": { mob: "54rem", tab: "63rem", des: "72rem" },
      "98": { mob: "54.75rem", tab: "63.875rem", des: "73rem" },
      "99": { mob: "55.5rem", tab: "64.75rem", des: "74rem" },
      "100": { mob: "56.25rem", tab: "65.625rem", des: "75rem" },
    },
    /** Scala tipografica in **rem puri** per viewport. 1–5 body/UI, 6–7 titoli, 8–10 display. */
    text: {
      "1": { mob: "0.8125rem", tab: "0.875rem", des: "0.9375rem" },
      "2": { mob: "0.875rem", tab: "0.9375rem", des: "1rem" },
      "3": { mob: "0.9375rem", tab: "1rem", des: "1.0625rem" },
      "4": { mob: "1rem", tab: "1.0625rem", des: "1.125rem" },
      "5": { mob: "1.0625rem", tab: "1.125rem", des: "1.25rem" },
      "6": { mob: "1.1875rem", tab: "1.3125rem", des: "1.5rem" },
      "7": { mob: "1.375rem", tab: "1.5rem", des: "1.75rem" },
      "8": { mob: "1.625rem", tab: "1.875rem", des: "2.125rem" },
      "9": { mob: "2rem", tab: "2.375rem", des: "2.75rem" },
      "10": { mob: "2.5rem", tab: "3rem", des: "3.5rem" },
    },
    /** Icone allineate al testo: **stessi valori di `text`** allo stesso step. */
    icon: {
      "1": { mob: "0.8125rem", tab: "0.875rem", des: "0.9375rem" },
      "2": { mob: "0.875rem", tab: "0.9375rem", des: "1rem" },
      "3": { mob: "0.9375rem", tab: "1rem", des: "1.0625rem" },
      "4": { mob: "1rem", tab: "1.0625rem", des: "1.125rem" },
      "5": { mob: "1.0625rem", tab: "1.125rem", des: "1.25rem" },
      "6": { mob: "1.1875rem", tab: "1.3125rem", des: "1.5rem" },
      "7": { mob: "1.375rem", tab: "1.5rem", des: "1.75rem" },
      "8": { mob: "1.625rem", tab: "1.875rem", des: "2.125rem" },
      "9": { mob: "2rem", tab: "2.375rem", des: "2.75rem" },
      "10": { mob: "2.5rem", tab: "3rem", des: "3.5rem" },
    },
    /** Spessore bordo (`b-1`, `bt-2`, …): `px` puri, costanti per viewport. */
    border: {
      "1": { mob: "1px", tab: "1px", des: "1px" },
      "2": { mob: "2px", tab: "2px", des: "2px" },
      "3": { mob: "3px", tab: "3px", des: "3px" },
      "4": { mob: "4px", tab: "4px", des: "4px" },
      "5": { mob: "5px", tab: "6px", des: "6px" },
    },
    round: {
      "1": {
        mob: "0.1875rem",
        tab: "0.1875rem",
        des: "0.1875rem",
      },
      "2": {
        mob: "0.3125rem",
        tab: "0.3125rem",
        des: "0.3125rem",
      },
      "3": {
        mob: "0.4375rem",
        tab: "0.4375rem",
        des: "0.4375rem",
      },
      "4": {
        mob: "0.5625rem",
        tab: "0.5625rem",
        des: "0.5625rem",
      },
      "5": {
        mob: "0.75rem",
        tab: "0.75rem",
        des: "0.75rem",
      },
      circle: {
        mob: "50%",
        tab: "50%",
        des: "50%",
      },
    },
  },
};
