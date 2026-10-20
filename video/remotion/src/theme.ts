import { loadFont as loadArchivo } from "@remotion/google-fonts/Archivo";
import { loadFont as loadFigtree } from "@remotion/google-fonts/Figtree";

// Same palette and type as the product site (product-site/styles.css).
export const C = {
  cream: "#f4efe6",
  cream2: "#efe7d9",
  ink: "#14110f",
  inkSoft: "#4a443d",
  cobalt: "#3e6be0",
  marigold: "#f4b024",
  tangerine: "#ee6c34",
  grass: "#3fa85b",
  violet: "#8a5cf6",
  sky: "#62c6e8",
  pink: "#f38ab0",
  rule: "#ded6c8",
  red: "#d93a1f",
};

const archivo = loadArchivo("normal", { weights: ["600", "800", "900"], subsets: ["latin"] });
const figtree = loadFigtree("normal", { weights: ["400", "500", "600", "700"], subsets: ["latin"] });

// Archivo and Figtree carry no Chinese glyphs; PingFang TC is on every Mac,
// which is where this renders.
export const F = {
  display: `${archivo.fontFamily}, "PingFang TC", sans-serif`,
  body: `${figtree.fontFamily}, "PingFang TC", sans-serif`,
  zh: `"PingFang TC", "Noto Sans TC", sans-serif`,
};

export const FPS = 30;
export const s = (seconds: number) => Math.round(seconds * FPS);
