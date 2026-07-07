import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  root: "apps/web",
  build: {
    outDir: "../../dist",
    emptyOutDir: true,
  },
  plugins: [react()],
});
