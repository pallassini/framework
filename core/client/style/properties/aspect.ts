import type { StyleResolver } from "../properties";

export const aspect: StyleResolver = (suffix) => {
  const s = suffix.trim();
  if (!s) return undefined;
  if (s === "square") return { aspectRatio: "1 / 1" };
  if (/^\d+\/\d+$/.test(s)) return { aspectRatio: s.replace("/", " / ") };
  return { aspectRatio: s };
};
