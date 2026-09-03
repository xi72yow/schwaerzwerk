/**
 * Runs the analysis against real statements without a browser and prints what
 * would be covered. Usage inside the container:
 *
 *   podman run --rm -v $PWD:/app:Z -v ~/Downloads:/pdf:ro,Z -w /app \
 *     docker.io/library/node:24-bookworm-slim node tools/check.mjs /pdf/*.pdf
 */
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { textItems } from "../src/geometry.js";
import { buildRegions, applyKeywords } from "../src/blocks.js";
import { detectProfile, byId } from "../src/profiles/index.js";

const keywords = (process.env.KEEP || "").split(",").filter(Boolean);
const files = process.argv.slice(2);
if (!files.length) throw new Error("usage: node tools/check.mjs <pdf...>");

for (const file of files) {
  const data = new Uint8Array(await readFile(file));
  const doc = await getDocument({ data, isEvalSupported: false }).promise;
  const name = basename(file);
  let profile = null;

  for (let number = 1; number <= doc.numPages; number++) {
    const proxy = await doc.getPage(number);
    const viewport = proxy.getViewport({ scale: 1 });
    const items = textItems(await proxy.getTextContent(), viewport);
    const page = { id: `${name}#${number}`, width: viewport.width, height: viewport.height };

    if (!profile) {
      profile = process.env.PROFILE
        ? byId(process.env.PROFILE)
        : detectProfile(items.map((it) => it.text).join(" "));
      console.log(`${name}: profile ${profile.id}, ${doc.numPages} pages, ${page.width}x${page.height}`);
    }

    const regions = applyKeywords(buildRegions(items, page, profile), keywords);
    const bookings = regions.filter((r) => r.kind === "booking");
    const visible = bookings.filter((r) => !r.redact);
    console.log(
      `  page ${number}: ${bookings.length} bookings, ${regions.length - bookings.length} header, ` +
        `${visible.length} visible`,
    );
    for (const region of visible) console.log(`    keep: ${region.text.slice(0, 110)}`);
    if (process.env.VERBOSE) {
      for (const region of bookings) console.log(`    ${region.redact ? "cover" : "keep "}: ${region.text.slice(0, 110)}`);
    }
  }
}
