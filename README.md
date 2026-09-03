# Schwärzwerk

Browser-based tool for redacting bank statements. A PDF is opened locally, every detected booking
is rendered as a clickable block, the result is exported as a new PDF. Processing runs entirely
client-side, there is no upload and no telemetry.

## Usage

1. drop a PDF, multiple files at once are supported
2. all bookings start out redacted, as do balance and overdraft figures in the page header
3. enter keywords and click `Vorauswahl anwenden` to reveal matching bookings
4. toggle individual blocks by clicking them
5. click `Geschwärztes PDF laden`

The address line stays readable. Pages without a visible booking can optionally be dropped, the
first page is always kept.

## How redaction works

The selected pages are rasterised, then the bars are drawn onto the resulting image. The covered
text is physically removed rather than just overlaid with a rectangle. The result contains no
fonts and no text objects, verifiable by loading the exported file back into the app: it reports
no blocks.

The trade-off is a larger file size and a document that is no longer searchable.

## Profiles

A profile describes how bookings are recognised in a statement: at which column the amount sits,
which terms in the page header indicate balances. Shipped profiles are `ing` and a generic
fallback that offers every text line individually. The profile is guessed from the first page's
text and can be overridden in the panel.

Adding another institute means adding a file under `src/profiles/` and registering it in
`src/profiles/index.js`. Column positions are defined as fractions of the page width, not as
absolute point values.

## Development

All processes run in Podman.

```
npm run app          # build plus static server on :3000
npm run app:build
npm run app:serve
npm run app:stop
npm run dev           # vite on :5173, for UI changes
```

Analysis against real statements without a browser. Prints per page how many bookings were
detected and which stayed visible:

```
PDF_DIR=~/Downloads KEEP="e.on energie,telekom" npm run check
```

End-to-end run in a headless browser including export. Screenshots land in `/tmp/sw-shots`:

```
PDF=~/Downloads/auszug.pdf npm run shot
```

The `zenika/alpine-chrome` image does not support `Promise.try`, which pdf.js 5 requires. Used
instead is `ghcr.io/puppeteer/puppeteer`.
