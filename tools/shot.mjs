/**
 * Drives the built app headless: loads a statement, applies keywords, toggles a
 * block by hand and exports. Screenshots land in /shots. Steps that find
 * nothing to act on are skipped, so the script also works on an already
 * redacted pdf (no text left, no regions).
 *
 *   podman run --rm --network host -v $PWD/tools/shot.mjs:/home/pptruser/shot.mjs:ro,Z \
 *     -v <statement>:/in.pdf:ro,Z -v /tmp/sw-shots:/shots:Z -e PDF=/in.pdf \
 *     -w /home/pptruser ghcr.io/puppeteer/puppeteer:latest node shot.mjs
 */
import puppeteer from "puppeteer";

const URL = process.env.URL || "http://localhost:3000/";
const PDF = process.env.PDF;
const KEEP = process.env.KEEP ?? "e.on energie\ntelekom";
const TAG = process.env.TAG || "run";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  ...(process.env.CHROME ? { executablePath: process.env.CHROME } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 980 });

const errors = [];
const note = (text) => {
  errors.push(text);
  console.log(`[browser] ${text}`);
};
page.on("console", (m) => m.type() === "error" && note(m.text()));
page.on("pageerror", (e) => note(String(e)));

const client = await page.createCDPSession();
await client.send("Browser.setDownloadBehavior", {
  behavior: "allow",
  downloadPath: "/shots",
  eventsEnabled: true,
});

const status = () => page.$eval("#status", (n) => n.textContent.trim());
const shot = (name) => page.screenshot({ path: `/shots/${TAG}-${name}.png` });

await page.goto(URL, { waitUntil: "networkidle0" });
await shot("01-empty");

await (await page.$("#file")).uploadFile(PDF);
await page.waitForFunction("document.querySelectorAll('.page canvas').length > 0", {
  timeout: 90000,
});
await wait(2000);
console.log("geladen:", await status());
console.log("profil: ", await page.$eval("#profileNote", (n) => n.textContent.trim()));
await shot("02-loaded");

if (KEEP) {
  await page.type("#keywords", KEEP);
  await page.click("#applyKeywords");
  await wait(400);
  console.log("stichworte:", await status());
}

const covered = await page.$(".bar.booking.on");
if (covered) {
  await covered.click();
  await wait(200);
  console.log("nach klick:", await status());
}

// second page carries the bookings, the first one only the address block
const second = await page.$$(".page");
if (second[1]) {
  await second[1].scrollIntoView();
  await wait(600);
  await shot("03-bookings");
}

await page.click("#download");
await page.waitForFunction("!document.getElementById('download').disabled", { timeout: 180000 });
await wait(3000);
console.log("export:   ", await status());

console.log(errors.length ? `FEHLER:\n${errors.join("\n")}` : "keine konsolenfehler");
await browser.close();
