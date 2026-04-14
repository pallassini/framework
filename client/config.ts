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
    text: {
      "1": {
        mob: "clamp(0.6875rem, 0.62rem + 0.45vw, 0.75rem)",
        tab: "clamp(0.75rem, 0.72rem + 0.3vw, 0.8125rem)",
        des: "clamp(0.8125rem, 0.78rem + 0.22vw, 0.875rem)",
      },
      "2": {
        mob: "clamp(0.75rem, 0.68rem + 0.5vw, 0.8125rem)",
        tab: "clamp(0.8125rem, 0.76rem + 0.32vw, 0.875rem)",
        des: "clamp(0.875rem, 0.82rem + 0.24vw, 0.9375rem)",
      },
      "3": {
        mob: "clamp(0.8125rem, 0.74rem + 0.55vw, 0.875rem)",
        tab: "clamp(0.875rem, 0.8rem + 0.34vw, 0.9375rem)",
        des: "clamp(0.9375rem, 0.86rem + 0.26vw, 1rem)",
      },
      "4": {
        mob: "clamp(0.875rem, 0.8rem + 0.6vw, 0.9375rem)",
        tab: "clamp(0.9375rem, 0.86rem + 0.36vw, 1rem)",
        des: "clamp(1rem, 0.92rem + 0.28vw, 1.0625rem)",
      },
      "5": {
        mob: "clamp(0.9375rem, 0.86rem + 0.65vw, 1rem)",
        tab: "clamp(1rem, 0.92rem + 0.38vw, 1.0625rem)",
        des: "clamp(1.0625rem, 0.98rem + 0.3vw, 1.125rem)",
      },
      "6": {
        mob: "clamp(1rem, 0.9rem + 0.7vw, 1.0625rem)",
        tab: "clamp(1.0625rem, 0.96rem + 0.4vw, 1.125rem)",
        des: "clamp(1.125rem, 1.02rem + 0.32vw, 1.1875rem)",
      },
      "7": {
        mob: "clamp(1.0625rem, 0.95rem + 0.75vw, 1.125rem)",
        tab: "clamp(1.125rem, 1.02rem + 0.42vw, 1.1875rem)",
        des: "clamp(1.1875rem, 1.08rem + 0.34vw, 1.25rem)",
      },
      "8": {
        mob: "clamp(1.125rem, 1rem + 0.85vw, 1.1875rem)",
        tab: "clamp(1.1875rem, 1.06rem + 0.45vw, 1.25rem)",
        des: "clamp(1.25rem, 1.12rem + 0.36vw, 1.375rem)",
      },
      "9": {
        mob: "clamp(1.1875rem, 1.05rem + 0.95vw, 1.25rem)",
        tab: "clamp(1.25rem, 1.1rem + 0.5vw, 1.375rem)",
        des: "clamp(1.375rem, 1.22rem + 0.38vw, 1.5rem)",
      },
      "10": {
        mob: "clamp(1.25rem, 1.1rem + 1.05vw, 1.375rem)",
        tab: "clamp(1.375rem, 1.18rem + 0.55vw, 1.5rem)",
        des: "clamp(1.5rem, 1.32rem + 0.42vw, 1.75rem)",
      },
    },
  },
};
