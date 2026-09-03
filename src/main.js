import "./style.css";
import { openPdf, renderPage } from "./document.js";
import { buildRegions, applyKeywords, pageHasVisibleBooking } from "./blocks.js";
import { PROFILES, byId, detectProfile } from "./profiles/index.js";
import { exportPdf } from "./exporter.js";

const VIEW_SCALE = 1.5;

const el = (id) => document.getElementById(id);
const ui = {
  drop: el("drop"),
  file: el("file"),
  pages: el("pages"),
  stage: el("stage"),
  profile: el("profile"),
  profileNote: el("profileNote"),
  keywords: el("keywords"),
  applyKeywords: el("applyKeywords"),
  skipEmpty: el("skipEmpty"),
  dpi: el("dpi"),
  allOn: el("allOn"),
  allOff: el("allOff"),
  download: el("download"),
  status: el("status"),
  docinfo: el("docinfo"),
};

const state = {
  sheets: [], // { page, regions, drop, node }
  profile: null,
  autoProfile: true,
  dpi: 150,
  busy: false,
};

const keywords = () => ui.keywords.value.split("\n");

function status(text, tone = "") {
  ui.status.className = `status ${tone}`;
  ui.status.innerHTML = `<span class="dot">●</span> ${text}`;
}

function counts() {
  const booking = state.sheets.flatMap((s) => s.regions).filter((r) => r.kind !== "header");
  const visible = booking.filter((r) => !r.redact).length;
  const kept = state.sheets.filter((s) => !dropped(s)).length;
  status(
    `${visible} von ${booking.length} Blöcken sichtbar, ${kept} von ${state.sheets.length} Seiten im Export`,
  );
  for (const sheet of state.sheets) sheet.node.classList.toggle("dropped", dropped(sheet));
}

function dropped(sheet) {
  if (sheet.drop === true) return true;
  if (sheet.drop === false) return false;
  if (!ui.skipEmpty.checked) return false;
  return sheet.page.number !== 1 && !pageHasVisibleBooking(sheet.regions);
}

function paint(sheet) {
  for (const region of sheet.regions) {
    for (const node of sheet.node.querySelectorAll(`[data-region="${region.id}"]`)) {
      node.classList.toggle("on", region.redact);
    }
  }
}

function overlay(sheet) {
  const layer = sheet.node.querySelector(".overlay");
  layer.replaceChildren();
  const { width, height } = sheet.page;

  for (const region of sheet.regions) {
    for (const rect of region.rects) {
      const bar = document.createElement("button");
      bar.className = `bar ${region.kind}`;
      bar.dataset.region = region.id;
      bar.type = "button";
      bar.title = region.text.slice(0, 160);
      bar.style.left = `${(rect.x0 / width) * 100}%`;
      bar.style.top = `${(rect.y0 / height) * 100}%`;
      bar.style.width = `${((rect.x1 - rect.x0) / width) * 100}%`;
      bar.style.height = `${((rect.y1 - rect.y0) / height) * 100}%`;
      layer.append(bar);
    }
  }
  paint(sheet);
}

function analyse() {
  for (const sheet of state.sheets) {
    sheet.regions = applyKeywords(
      buildRegions(sheet.page.items, sheet.page, state.profile),
      keywords(),
    );
    overlay(sheet);
  }
  counts();
}

function sheetNode(sheet) {
  const node = document.createElement("figure");
  node.className = "page";
  node.innerHTML = `
    <figcaption>
      <span>${sheet.page.source} · Seite ${sheet.page.number}</span>
      <button type="button" class="drop-toggle">weglassen</button>
    </figcaption>
    <div class="sheet"><div class="overlay"></div></div>`;

  node.querySelector(".drop-toggle").addEventListener("click", () => {
    sheet.drop = !dropped(sheet);
    counts();
  });

  node.querySelector(".overlay").addEventListener("click", (event) => {
    const bar = event.target.closest(".bar");
    if (!bar) return;
    const region = sheet.regions.find((r) => r.id === bar.dataset.region);
    region.redact = !region.redact;
    region.touched = true;
    paint(sheet);
    counts();
  });

  return node;
}

async function load(files) {
  state.busy = true;
  ui.drop.hidden = true;
  status("lese PDF ...");

  for (const file of files) {
    const doc = await openPdf(await file.arrayBuffer(), file.name.replace(/\.pdf$/i, ""));
    // only the first document decides, a mixed drop keeps one profile for all
    if (state.autoProfile && !state.sheets.length) {
      state.profile = detectProfile(doc.pages[0]?.text ?? "");
      ui.profile.value = state.profile.id;
    }
    for (const page of doc.pages) {
      const sheet = { page, regions: [], drop: null };
      sheet.node = sheetNode(sheet);
      state.sheets.push(sheet);
      ui.pages.append(sheet.node);
      const canvas = await renderPage(page, VIEW_SCALE);
      sheet.node.querySelector(".sheet").prepend(canvas);
    }
  }

  ui.profileNote.textContent = state.autoProfile
    ? `automatisch erkannt: ${state.profile.label}`
    : "manuell gewählt";
  ui.docinfo.textContent = `${state.sheets.length} Seiten aus ${new Set(state.sheets.map((s) => s.page.source)).size} Datei(en)`;
  for (const button of [ui.allOn, ui.allOff, ui.download]) button.disabled = false;
  analyse();
  state.busy = false;
}

async function download() {
  const selected = state.sheets.filter((s) => !dropped(s));
  if (!selected.length) return status("keine Seite ausgewählt", "warn");

  ui.download.disabled = true;
  const blob = await exportPdf(selected, {
    dpi: state.dpi,
    onProgress: (done, total) => status(`rastere Seite ${Math.min(done + 1, total)} von ${total} ...`),
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "kontoauszuege-geschwaerzt.pdf";
  link.click();
  URL.revokeObjectURL(url);
  ui.download.disabled = false;
  counts();
}

for (const profile of PROFILES) {
  ui.profile.append(new Option(profile.label, profile.id));
}
state.profile = PROFILES[0];

ui.profile.addEventListener("change", () => {
  state.autoProfile = false;
  state.profile = byId(ui.profile.value);
  ui.profileNote.textContent = "manuell gewählt";
  if (state.sheets.length) analyse();
});

ui.applyKeywords.addEventListener("click", () => state.sheets.length && analyse());
ui.skipEmpty.addEventListener("change", counts);

ui.dpi.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  state.dpi = Number(button.dataset.dpi);
  for (const other of ui.dpi.children) other.classList.toggle("on", other === button);
});

for (const [button, redact] of [
  [ui.allOn, true],
  [ui.allOff, false],
]) {
  button.addEventListener("click", () => {
    for (const sheet of state.sheets) {
      for (const region of sheet.regions) region.redact = redact;
      paint(sheet);
    }
    counts();
  });
}

ui.download.addEventListener("click", download);
ui.file.addEventListener("change", () => ui.file.files.length && load([...ui.file.files]));

for (const event of ["dragover", "drop"]) {
  ui.stage.addEventListener(event, (e) => {
    e.preventDefault();
    ui.stage.classList.toggle("over", e.type === "dragover");
    if (e.type !== "drop") return;
    const files = [...e.dataTransfer.files].filter((f) => f.type === "application/pdf");
    if (files.length && !state.busy) load(files);
  });
}
ui.stage.addEventListener("dragleave", () => ui.stage.classList.remove("over"));
