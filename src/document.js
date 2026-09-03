import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { textItems } from "./geometry.js";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

export async function openPdf(data, name) {
  const doc = await pdfjs.getDocument({
    data,
    isEvalSupported: false,
    cMapUrl: "pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "pdfjs/standard_fonts/",
  }).promise;
  const pages = [];

  for (let number = 1; number <= doc.numPages; number++) {
    const proxy = await doc.getPage(number);
    const viewport = proxy.getViewport({ scale: 1 });
    const items = textItems(await proxy.getTextContent(), viewport);
    pages.push({
      id: `${name}#${number}`,
      source: name,
      number,
      width: viewport.width,
      height: viewport.height,
      items,
      text: items.map((it) => it.text).join(" "),
      proxy,
    });
  }
  return { name, pages };
}

export async function renderPage(page, scale) {
  const viewport = page.proxy.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.proxy.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

/**
 * Draws the bars onto the rasterised page, so the covered text is physically
 * gone instead of hidden behind a rectangle in the pdf.
 */
export function coverAreas(canvas, regions, scale) {
  const context = canvas.getContext("2d");
  context.fillStyle = "#000";
  for (const region of regions) {
    if (!region.redact) continue;
    for (const rect of region.rects) {
      context.fillRect(
        Math.round(rect.x0 * scale) - 2,
        Math.round(rect.y0 * scale) - 2,
        Math.round((rect.x1 - rect.x0) * scale) + 4,
        Math.round((rect.y1 - rect.y0) * scale) + 4,
      );
    }
  }
  return canvas;
}
