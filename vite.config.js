import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    // cmaps and the fallback fonts ship locally, otherwise pdf.js reaches for a
    // cdn on documents with cid fonts and the privacy promise breaks
    viteStaticCopy({
      targets: [
        { src: "node_modules/pdfjs-dist/cmaps", dest: "pdfjs" },
        { src: "node_modules/pdfjs-dist/standard_fonts", dest: "pdfjs" },
      ],
    }),
  ],
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: "es2022",
    chunkSizeWarningLimit: 1500,
  },
  worker: {
    format: "es",
  },
});
