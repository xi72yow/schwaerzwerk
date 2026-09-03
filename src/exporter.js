import { PDFDocument } from "pdf-lib";
import { renderPage, coverAreas } from "./document.js";

const JPEG_QUALITY = 0.88;

const toBytes = (canvas) =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? blob.arrayBuffer().then(resolve, reject) : reject(new Error("kein Bild"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });

/**
 * Rasterises every selected page at the export resolution, burns the bars in
 * and reassembles the result. No text layer survives this on purpose.
 */
export async function exportPdf(pages, { dpi, onProgress }) {
  const scale = dpi / 72;
  const out = await PDFDocument.create();

  for (const [index, page] of pages.entries()) {
    onProgress?.(index, pages.length);
    const canvas = await renderPage(page.page, scale);
    coverAreas(canvas, page.regions, scale);
    const image = await out.embedJpg(await toBytes(canvas));
    const sheet = out.addPage([page.page.width, page.page.height]);
    sheet.drawImage(image, { x: 0, y: 0, width: page.page.width, height: page.page.height });
    canvas.width = canvas.height = 0; // release the backing store, statements get large
  }

  onProgress?.(pages.length, pages.length);
  return new Blob([await out.save()], { type: "application/pdf" });
}
