import { defineConfig } from "vite-plus";
import basicSsl from "@vitejs/plugin-basic-ssl";

const clientRoot = import.meta.dir;
export default defineConfig({
  root: clientRoot,
  base: "./",
  plugins: [basicSsl()],
});
