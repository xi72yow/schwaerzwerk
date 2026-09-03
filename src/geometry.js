// same as pdfjs Util.transform, inlined to keep this module free of the pdfjs
// entry point, which pulls in browser globals
const transform = (a, b) => [
  a[0] * b[0] + a[2] * b[1],
  a[1] * b[0] + a[3] * b[1],
  a[0] * b[2] + a[2] * b[3],
  a[1] * b[2] + a[3] * b[3],
  a[0] * b[4] + a[2] * b[5] + a[4],
  a[1] * b[4] + a[3] * b[5] + a[5],
];

/**
 * Text items in pdf points with the origin in the top left corner, which keeps
 * the geometry in blocks.js identical to the pdftotext -bbox-layout output the
 * heuristics were written against. Free of dom and worker setup so the analysis
 * can be checked in plain node (tools/check.mjs).
 */
export function textItems(content, viewport) {
  const items = [];
  for (const item of content.items) {
    if (item.type || !item.str) continue;
    const m = transform(viewport.transform, item.transform);
    if (Math.abs(m[1]) > 0.01 || Math.abs(m[2]) > 0.01) continue; // rotated margin note
    const height = item.height || Math.abs(m[3]) || 10;
    const base = m[5];
    items.push({
      text: item.str.trim(),
      x0: m[4],
      x1: m[4] + item.width,
      y0: base - height,
      y1: base + height * 0.25,
      base,
    });
  }
  return items;
}
