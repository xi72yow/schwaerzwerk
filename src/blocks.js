/**
 * Turns positioned text items into clickable regions. Words are grouped into
 * visual bands, a band carrying an amount in the right hand column starts a
 * new booking block, everything from there until the next amount belongs to
 * that block. Coordinates are pdf points with the origin in the top left
 * corner, which is what document.js hands over.
 */

const AMOUNT = /^-?[\d.]*\d,\d{2}$/;
const BAND_TOLERANCE = 4;
const MAX_GLYPH_HEIGHT = 18;

function bands(items, page, profile) {
  const leftMargin = profile.leftMargin * page.width;
  const line = (it) => (it.base === undefined ? it.y0 : it.base);
  const usable = items
    .filter((it) => it.text !== "")
    .filter((it) => it.y1 - it.y0 <= MAX_GLYPH_HEIGHT && it.x0 >= leftMargin)
    .sort((a, b) => line(a) - line(b) || a.x0 - b.x0);

  const out = [];
  for (const item of usable) {
    const last = out[out.length - 1];
    // grouped by baseline: mixed font sizes in one row share it, top edges do not
    if (last && Math.abs(line(item) - last.base) < BAND_TOLERANCE) {
      last.items.push(item);
      last.y0 = Math.min(last.y0, item.y0);
      last.y1 = Math.max(last.y1, item.y1);
    } else {
      out.push({ base: line(item), y0: item.y0, y1: item.y1, items: [item] });
    }
  }

  for (const band of out) {
    band.items.sort((a, b) => a.x0 - b.x0);
    band.text = band.items.map((it) => it.text).join(" ");
    band.x0 = Math.min(...band.items.map((it) => it.x0));
    band.x1 = Math.max(...band.items.map((it) => it.x1));
  }
  return out;
}

/**
 * pdf.js hands out text runs rather than single words, so an amount can sit at
 * the end of a longer run instead of in an item of its own.
 */
function carriesAmount(band, amountX, headerTerms) {
  return band.items.some((item) => {
    if (item.x1 <= amountX) return false;
    const tokens = item.text.split(/\s+/);
    if (!AMOUNT.test(tokens[tokens.length - 1])) return false;
    const lower = item.text.toLowerCase();
    return !headerTerms.some((term) => lower.includes(term));
  });
}

function rectOf(band) {
  return { x0: band.x0, y0: band.y0, x1: band.x1, y1: band.y1 };
}

function boxOf(rects) {
  return {
    x0: Math.min(...rects.map((r) => r.x0)),
    y0: Math.min(...rects.map((r) => r.y0)),
    x1: Math.max(...rects.map((r) => r.x1)),
    y1: Math.max(...rects.map((r) => r.y1)),
  };
}

function region(id, kind, rects, text) {
  return { id, kind, rects, box: boxOf(rects), text, redact: true, touched: false };
}

/**
 * Header bands mentioning a balance keep their address half readable, only the
 * figures to the right of the address column are offered for redaction.
 */
function headerRegions(head, page, profile, seq) {
  const addressX = profile.addressColumn * page.width;
  const regions = [];
  for (const band of head) {
    const lower = band.text.toLowerCase();
    if (!profile.headerTerms.some((term) => lower.includes(term))) continue;
    const right = band.items.filter((it) => it.x0 > addressX);
    if (!right.length) continue;
    regions.push(
      region(
        `${page.id}-h${seq()}`,
        "header",
        [
          {
            x0: Math.min(...right.map((it) => it.x0)),
            y0: band.y0,
            x1: Math.max(...right.map((it) => it.x1)),
            y1: band.y1,
          },
        ],
        right.map((it) => it.text).join(" "),
      ),
    );
  }
  return regions;
}

export function buildRegions(items, page, profile) {
  const all = bands(items, page, profile);
  let n = 0;
  const seq = () => ++n;

  if (!profile.groupBookings) {
    return all.map((band) => region(`${page.id}-l${seq()}`, "line", [rectOf(band)], band.text));
  }

  const amountX = profile.amountColumn * page.width;
  const marks = all.map((band) => carriesAmount(band, amountX, profile.headerTerms));
  const first = marks.indexOf(true) === -1 ? all.length : marks.indexOf(true);

  const regions = headerRegions(all.slice(0, first), page, profile, seq);

  let current = null;
  for (let i = first; i < all.length; i++) {
    if (marks[i] || current === null) {
      current = region(`${page.id}-b${seq()}`, "booking", [], "");
      regions.push(current);
    }
    current.rects.push(rectOf(all[i]));
    current.text = current.text ? `${current.text} ${all[i].text}` : all[i].text;
    current.box = boxOf(current.rects);
  }
  return regions;
}

export function applyKeywords(regions, keywords) {
  const terms = keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
  for (const region of regions) {
    region.touched = false;
    // header figures stay covered, they are balances rather than bookings
    region.redact =
      region.kind === "header" || !terms.some((term) => region.text.toLowerCase().includes(term));
  }
  return regions;
}

export const pageHasVisibleBooking = (regions) =>
  regions.some((r) => r.kind !== "header" && !r.redact);
