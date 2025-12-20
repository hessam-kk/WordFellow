/* WordFellow frontend */
"use strict";

const $ = (sel) => document.querySelector(sel);
const els = {
  tabs: document.querySelectorAll(".tab"),
  onboard: $("#onboard"),
  searchInput: $("#searchInput"),
  clearInput: $("#clearInput"),
  suggestBox: $("#suggestBox"),
  results: $("#results"),
  emptyState: $("#emptyState"),
  historyList: $("#historyList"),
  historyEmpty: $("#historyEmpty"),
  sourcesList: $("#sourcesList"),
  statusText: $("#statusText"),
  toast: $("#toast"),
  themeBtn: $("#themeBtn"),
};

/* ------------------------------------------------------------------
   Live pywebview bridge access.
   The bridge (window.pywebview.api.*) is injected by pywebview AFTER
   the page scripts run, so we must never cache it at load time.
------------------------------------------------------------------ */
function getApi() {
  const a = window.pywebview && window.pywebview.api;
  return a && typeof a === "object" ? a : null;
}
function isApiReady() {
  const a = getApi();
  return !!(a && typeof a.search === "function" && typeof a.sources === "function");
}
async function call(method, ...args) {
  const a = getApi();
  if (!a || typeof a[method] !== "function") {
    throw new Error("pywebview bridge is not ready yet");
  }
  const out = await a[method](...args);
  return out;
}

/* ------------------------------- icons ------------------------------ */

const svg = (paths, size = 16) =>
  `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  link: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6"/><path d="M10 14 21 3"/>',
  package: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  check: '<path d="M21.5 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="m9 11 3 3 9.5-9.5"/>',
  sparkles: '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/>',
  arrows: '<path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/>',
  arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  book: '<path d="M2 3.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z"/><path d="M22 3.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z"/>',
  lang: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
};
const icon = (name, size = 16) => svg(ICONS[name] || "", size);

const SOURCE_META = {
  wn: {
    label: "WordNet", sub: "English monolingual", badge: "English",
    icon: "book", color: "#2563eb", color2: "#3b82f6",
  },
  enfa: {
    label: "English ↔ Persian", sub: "Bilingual glossary", badge: "Bilingual",
    icon: "lang", color: "#059669", color2: "#10b981",
  },
  dehkhoda: {
    label: "Dehkhoda", sub: "Persian monolingual", badge: "Persian",
    icon: "library", color: "#d97706", color2: "#f59e0b",
  },
};

let state = {
  view: "search",
  historyMode: "recent",
  installed: {}, // id -> bool
  dlTimer: null,
  lastSuggestReq: null,
};

/* ------------------------------ helpers ----------------------------- */

const isFa = (s) => /[\u0600-\u06ff]/.test(s || "");
const fmt = (n) => Number(n).toLocaleString("en-US");

function timeAgo(ts) {
  const sec = Math.floor((Date.now() / 1000 - ts) / 60);
  if (sec < 1) return "just now";
  if (sec < 60) return `${sec} min ago`;
  const hr = Math.floor(sec / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  return d < 30 ? `${d} days ago` : new Date(ts * 1000).toLocaleDateString("en-US");
}

function toast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => els.toast.classList.add("hidden"), 2600);
}

function dirAttr(text) {
  return isFa(text) ? 'dir="rtl"' : 'dir="ltr"';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function switchView(name) {
  state.view = name;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + name).classList.add("active");
  els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "history") renderHistory();
  if (name === "dictionaries") renderSources();
}

/* ------------------------------- theme ------------------------------ */

function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  els.themeBtn.innerHTML = t === "dark" ? icon("sun", 18) : icon("moon", 17);
}
els.themeBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  localStorage.setItem("pd-theme", next);
  applyTheme(next);
});
applyTheme(localStorage.getItem("pd-theme") || "light");

/* ------------------------------- search ----------------------------- */

async function doSearch(query, { fromHistory = false } = {}) {
  const q = (query ?? els.searchInput.value).trim();
  if (!q) return;
  els.searchInput.value = q;
  hideSuggest();
  $("#view-search").classList.add("searched");
  els.results.classList.remove("hidden");
  els.emptyState.classList.add("hidden");

  let res;
  try {
    res = await call("search", q);
  } catch (e) {
    toast("Search error: " + e.message);
    return;
  }

  const exact = res.exact || [];
  const rev = res.reverse || [];
  const suggest = res.suggestions || [];
  const hasAny = exact.length || rev.length || suggest.length;

  if (!hasAny) {
    showEmptyState(q);
    return;
  }

  const html = [];
  const counts = {};
  exact.forEach((r) => (counts[r.source] = (counts[r.source] || 0) + 1));

  /* group rows: source -> word -> senses */
  const bySource = {};
  exact.forEach((r) => (bySource[r.source] = bySource[r.source] || []).push(r));

  const order = ["wn", "enfa", "dehkhoda"];
  for (const sid of order) {
    const rows = bySource[sid];
    if (!rows) continue;
    const meta = SOURCE_META[sid] || SOURCE_META.wn;
    const byWord = {};
    rows.forEach((r) => (byWord[r.word] = byWord[r.word] || []).push(r));

    let items = "";
    for (const [word, senses] of Object.entries(byWord)) {
      const hasPos = senses.some((s) => s.pos && s.pos !== "None");
      const sensesHtml = senses
        .map((s, i) => {
          const def = esc(s.definition) || "—";
          const ex = s.examples
            ? `<div class="examples" ${dirAttr(s.examples)}>“ ${esc(s.examples)} ”</div>`
            : "";
          return `<div class="sense">
            <span class="sense-no">${i + 1}</span>
            <div class="sense-text">
              <div ${dirAttr(def)}>${def}</div>${ex}
            </div>
          </div>`;
        })
        .join("");
      items += `<div class="word-row">
        <div class="word-head">
          <span class="word" ${dirAttr(word)}>${esc(word)}</span>
          ${hasPos ? `<span class="pos-chip">${esc(senses[0].pos)}</span>` : ""}
        </div>
        <div class="senses">${sensesHtml}</div>
      </div>`;
    }
    html.push(`<div class="card" style="--src:${meta.color};--src2:${meta.color2}">
      <div class="card-head">
        <span class="src-tile">${icon(meta.icon, 17)}</span>
        <div class="card-title">
          <h3>${meta.label}</h3>
          <span>${meta.sub}</span>
        </div>
        <span class="badge">${meta.badge}</span>
        <span class="count-pill">${fmt(counts[sid] || rows.length)} results</span>
      </div>
      ${items}
    </div>`);
  }

  if (rev.length) {
    html.push(`<div class="card" style="--src:#0d9488;--src2:#14b8a6">
      <div class="card-head">
        <span class="src-tile">${icon("arrows", 17)}</span>
        <div class="card-title">
          <h3>Persian → English</h3>
          <span>Reverse translations</span>
        </div>
        <span class="badge">Translation</span>
      </div>
      <div class="word-row">
        <div class="chips">
          ${rev.map((w) => `<button class="chip" dir="ltr" data-word="${esc(w)}">${esc(w)}</button>`).join("")}
        </div>
      </div>
    </div>`);
  }

  if (suggest.length) {
    html.push(`<div class="card" style="--src:#64748b;--src2:#94a3b8">
      <div class="card-head">
        <span class="src-tile">${icon("sparkles", 16)}</span>
        <div class="card-title">
          <h3>Similar words</h3>
          <span>Closest matches in your dictionaries</span>
        </div>
      </div>
      <div class="word-row">
        <p class="did-mean">Did you mean?</p>
        <div class="chips">
          ${suggest.map((w) => `<button class="chip" ${dirAttr(w)} data-word="${esc(w)}">${esc(w)}</button>`).join("")}
        </div>
      </div>
    </div>`);
  }

  els.results.innerHTML = html.join("");
  els.results.querySelectorAll("button[data-word]").forEach((b) =>
    b.addEventListener("click", () => {
      els.searchInput.value = b.dataset.word;
      doSearch(b.dataset.word);
      els.searchInput.focus();
    })
  );
  els.statusText.textContent = `“${q}” — ${fmt(exact.length)} results`;
  if (fromHistory) switchView("search");
}

function showEmptyState(q) {
  els.emptyState.classList.remove("hidden");
  els.results.innerHTML = "";
  els.emptyState.innerHTML = `
    <div class="empty-art">${icon("search", 46)}</div>
    <p class="empty-title">No results for “${esc(q)}”</p>
    <p class="muted">Check the spelling, or install more dictionaries.</p>`;
}

/* --------------------------- autocomplete --------------------------- */

function hideSuggest() {
  els.suggestBox.classList.add("hidden");
  els.suggestBox.innerHTML = "";
}
let suggestIndex = -1;

async function runSuggest() {
  const q = els.searchInput.value.trim();
  if (!q) {
    hideSuggest();
    return;
  }
  const req = ++state.lastSuggestReq;
  let words;
  try {
    words = await call("suggest", q);
  } catch (e) {
    return;
  }
  if (req !== state.lastSuggestReq) return;
  if (!words || !words.length) {
    hideSuggest();
    return;
  }
  const fa = isFa(q);
  suggestIndex = -1;
  els.suggestBox.innerHTML =
    `<div class="suggest-item exact hl" data-w="${esc(q)}">${icon("search", 14)}<span class="s-word">Search for <b ${dirAttr(q)}>${esc(q)}</b></span></div>` +
    words
      .map(
        (w) =>
          `<div class="suggest-item" data-w="${esc(w)}"><span class="s-word" ${dirAttr(w)}>${esc(w)}</span>
             <span class="hint">${fa ? "Persian" : "English"}</span></div>`
      )
      .join("");
  els.suggestBox.classList.remove("hidden");

  els.suggestBox.querySelectorAll(".suggest-item").forEach((it) => {
    it.addEventListener("click", () => {
      els.searchInput.value = it.dataset.w;
      hideSuggest();
      doSearch(it.dataset.w);
    });
  });
}

let debounceT;
els.searchInput.addEventListener("input", () => {
  clearTimeout(debounceT);
  els.clearInput.classList.toggle("hidden", !els.searchInput.value);
  debounceT = setTimeout(runSuggest, 130);
});
els.searchInput.addEventListener("keydown", (e) => {
  const items = [...els.suggestBox.querySelectorAll(".suggest-item")];
  if (!items.length) {
    if (e.key === "Enter") doSearch();
    return;
  }
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    items.forEach((it) => it.classList.remove("hl"));
    suggestIndex =
      e.key === "ArrowDown"
        ? Math.min(suggestIndex + 1, items.length - 1)
        : Math.max(suggestIndex - 1, 0);
    items[suggestIndex].classList.add("hl");
  } else if (e.key === "Enter") {
    e.preventDefault();
    const w = suggestIndex >= 0 ? items[suggestIndex].dataset.w : els.searchInput.value;
    els.searchInput.value = w;
    hideSuggest();
    doSearch(w);
  } else if (e.key === "Escape") {
    hideSuggest();
  }
});
els.clearInput.addEventListener("click", () => {
  els.searchInput.value = "";
  els.clearInput.classList.add("hidden");
  hideSuggest();
  els.results.innerHTML = "";
  els.results.classList.add("hidden");
  els.emptyState.classList.add("hidden");
  $("#view-search").classList.remove("searched");
  els.searchInput.focus();
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrap")) hideSuggest();
});

/* ------------------------------ history ----------------------------- */

async function renderHistory(mode) {
  state.historyMode = mode || state.historyMode;
  let data;
  try {
    data = await call("history", 120);
  } catch (e) {
    toast("Error loading history");
    return;
  }
  const list = state.historyMode === "top" ? data.top : data.recent;
  $("#histRecent").classList.toggle("active", state.historyMode === "recent");
  $("#histTop").classList.toggle("active", state.historyMode === "top");
  els.historyEmpty.classList.toggle("hidden", list.length > 0);
  if (!list.length) {
    els.historyList.innerHTML = "";
    return;
  }
  els.historyList.innerHTML = list
    .map(
      (h, i) => `
      <div class="hist-row" data-word="${esc(h.word)}" style="animation-delay:${Math.min(i * 0.03, 0.3)}s">
        <span class="hist-word" ${dirAttr(h.word)}>${esc(h.word)}</span>
        <span class="hist-count">×${h.count}</span>
        <span class="hist-time">${timeAgo(h.last_seen)}</span>
        <button class="hist-del" title="Delete">${icon("trash", 14)}</button>
      </div>`
    )
    .join("");
  els.historyList.querySelectorAll(".hist-row").forEach((row) => {
    row.querySelector(".hist-del").addEventListener("click", async (e) => {
      e.stopPropagation();
      try {
        await call("delete_history", row.dataset.word);
      } catch (err) {
        toast(err.message);
      }
      renderHistory();
    });
    row.addEventListener("click", () => doSearch(row.dataset.word, { fromHistory: true }));
  });
}

$("#histRecent").addEventListener("click", () => renderHistory("recent"));
$("#histTop").addEventListener("click", () => renderHistory("top"));
$("#clearHistory").addEventListener("click", async () => {
  try {
    await call("clear_history");
  } catch (err) {
    toast(err.message);
  }
  renderHistory();
  toast("History cleared");
});

/* ---------------------------- dictionaries -------------------------- */

async function renderSources() {
  let list;
  try {
    list = await call("sources");
  } catch (e) {
    toast("Error loading dictionaries: " + e.message);
    if (els.sourcesList) els.sourcesList.innerHTML = "";
    return;
  }
  if (!Array.isArray(list)) list = [];
  if (!list.length) {
    els.sourcesList.innerHTML = `<div class="empty"><p>No dictionaries defined.</p></div>`;
    return;
  }
  state.installed = {};
  list.forEach((s) => (state.installed[s.id] = s.installed));

  els.sourcesList.innerHTML = list
    .map((s) => {
      const pal = SOURCE_META[s.id] || { icon: "book", color: "#64748b", color2: "#94a3b8" };
      const actions = s.installed
        ? `<span class="src-count">${icon("check", 15)} ${fmt(s.count || 0)} entries installed</span>
           <label class="switch" title="Enable or disable this dictionary">
             <input type="checkbox" data-act="toggle" data-id="${s.id}" ${s.enabled ? "checked" : ""}>
             <span class="slider"></span>
           </label>
           <span class="toggle-label">${s.enabled ? "Enabled" : "Disabled"}</span>
           <button class="btn danger outlined" data-act="remove" data-id="${s.id}">${icon("trash", 13)} Remove</button>`
        : `<button class="btn primary" data-act="install" data-id="${s.id}">${icon("download", 15)} Download &amp; install · ${esc(s.size)}</button>`;
      return `
      <div class="src-card" data-id="${s.id}" style="--src:${pal.color};--src2:${pal.color2}">
        <div class="src-head">
          <div class="src-icon">${icon(pal.icon, 21)}</div>
          <div class="src-title">
            <h3>${esc(s.name)}
              <span class="mini-badge ${s.installed ? "ok" : ""}">${s.installed ? "Installed" : "Not installed"}</span>
            </h3>
            <p>${esc(s.description)}</p>
          </div>
        </div>
        <div class="src-meta">
          <span>${icon("package", 13)} ${esc(s.size)}</span>
          <span>${icon("scale", 13)} ${esc(s.license)}</span>
          <a href="${esc(s.url)}" target="_blank">${icon("link", 13)} Source</a>
        </div>
        <div class="src-actions" data-zone="actions">${actions}</div>
        <div class="src-actions hidden" data-zone="progress">
          <span class="dl-label">${icon("download", 15)} ${s.id === "dehkhoda" ? "Downloading 33 parts…" : "Downloading…"}</span>
          <div class="progress"><div class="progress-bar"></div></div>
        </div>
        <div class="src-actions hidden" data-zone="error"></div>
      </div>`;
    })
    .join("");

  els.sourcesList.querySelectorAll("[data-act]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      if (btn.dataset.act === "install") {
        let r;
        try {
          r = await call("install", id);
        } catch (err) {
          toast(err.message);
          return;
        }
        if (!r || !r.ok) {
          toast((r && r.error) || "Another download is already running");
          return;
        }
        setSourceProgress(id, true);
        startPolling();
      } else if (btn.dataset.act === "remove") {
        try {
          await call("remove", id);
        } catch (err) {
          toast(err.message);
        }
        toast("Dictionary removed");
        renderSources();
      }
    })
  );

  els.sourcesList.querySelectorAll('input[data-act="toggle"]').forEach((cb) =>
    cb.addEventListener("change", async () => {
      const id = cb.dataset.id;
      try {
        const r = await call("set_enabled", id, cb.checked);
        if (!r || !r.ok) {
          cb.checked = !cb.checked;
          toast((r && r.error) || "Could not change dictionary");
          return;
        }
      } catch (err) {
        cb.checked = !cb.checked;
        toast(err.message);
        return;
      }
      toast(cb.checked ? "Dictionary enabled" : "Dictionary disabled");
      renderSources();
    })
  );

  try {
    const dl = await call("download_state");
    if (dl && (dl.active || dl.stage === "import")) {
      setSourceProgress(dl.source, true, dl.stage === "import");
      startPolling();
    }
  } catch (e) {
    /* ignore */
  }
}

function setSourceProgress(id, on, indet = false) {
  const card = els.sourcesList.querySelector(`.src-card[data-id="${id}"]`);
  if (!card) return;
  card.querySelector('[data-zone="actions"]').classList.toggle("hidden", on);
  card.querySelector('[data-zone="progress"]').classList.toggle("hidden", !on);
  card.querySelector('[data-zone="error"]').classList.add("hidden");
  const bar = card.querySelector(".progress");
  bar.classList.toggle("indet", indet);
  bar.querySelector(".progress-bar").style.width = "0%";
}

function startPolling() {
  if (state.dlTimer) return;
  state.dlTimer = setInterval(async () => {
    let dl;
    try {
      dl = await call("download_state");
    } catch (e) {
      return;
    }
    if (dl.stage === "error") {
      stopPolling();
      const card = els.sourcesList.querySelector(`.src-card[data-id="${dl.source}"]`);
      if (card) {
        card.querySelector('[data-zone="progress"]').classList.add("hidden");
        card.querySelector('[data-zone="actions"]').classList.remove("hidden");
        const err = card.querySelector('[data-zone="error"]');
        err.classList.remove("hidden");
        err.innerHTML = `<span class="src-error">${icon("alert", 14)} Install failed: ${esc(dl.msg || "network error")}</span>`;
      }
      toast("Install failed");
      renderSources();
      return;
    }
    if (dl.stage === "done") {
      stopPolling();
      toast("Dictionary installed successfully");
      renderSources();
      return;
    }
    const card = els.sourcesList.querySelector(`.src-card[data-id="${dl.source}"]`);
    if (card) setSourceProgress(dl.source, true, dl.stage === "import" || !dl.pct);
    if (card && dl.stage === "download" && dl.pct) {
      card.querySelector(".progress-bar").style.width = dl.pct + "%";
    }
  }, 600);
}

function stopPolling() {
  clearInterval(state.dlTimer);
  state.dlTimer = null;
}

/* ------------------------------- boot ------------------------------- */

els.tabs.forEach((t) => t.addEventListener("click", () => switchView(t.dataset.view)));

async function waitReady(timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (isApiReady()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return isApiReady();
}

let bootRan = false;
async function boot() {
  if (bootRan) return;
  bootRan = true;
  if (!(await waitReady(6000))) {
    els.statusText.textContent = "pywebview bridge not available (debug?)";
    els.onboard.classList.remove("hidden");
    els.onboard.innerHTML = `
      <div class="onboard-icon">${icon("alert", 19)}</div>
      <div class="onboard-body">
        <b>The pywebview bridge is not available.</b>
        <p>The app must be launched with <code>python main.py</code>.</p>
        <button class="btn primary" id="retryBridge">Try again</button>
      </div>`;
    const retry = document.getElementById("retryBridge");
    if (retry) retry.addEventListener("click", () => { bootRan = false; boot(); });
    return;
  }
  els.statusText.textContent = "Loading…";
  try {
    const list = await call("sources");
    if (!Array.isArray(list)) list = [];
    const installedIds = list.filter((s) => s.installed).map((s) => s.id);
    const enabledIds = list.filter((s) => s.installed && s.enabled).map((s) => s.id);
    const none = enabledIds.length === 0;
    if (none) {
      els.onboard.classList.remove("hidden");
      els.onboard.innerHTML = `
        <div class="onboard-icon">${icon("sparkles", 19)}</div>
        <div class="onboard-body">
          <b>Welcome to WordFellow!</b>
          <p>${installedIds.length === 0
            ? "No dictionaries are installed yet. Download one to get started (only once — afterwards all searches work fully offline)."
            : "All installed dictionaries are disabled. Enable one from the Dictionaries tab to start searching."}</p>
          <button class="btn primary" id="goDicts">Go to Dictionaries ${icon("arrowRight", 13)}</button>
        </div>`;
      const go = document.getElementById("goDicts");
      if (go) go.addEventListener("click", () => switchView("dictionaries"));
    }
    els.statusText.textContent =
      none
        ? (installedIds.length === 0 ? "No dictionaries installed" : "No dictionaries enabled")
        : `${enabledIds.length} ${enabledIds.length === 1 ? "dictionary" : "dictionaries"} enabled — offline search active`;
  } catch (e) {
    els.statusText.textContent = "Error: " + e.message;
  }
}

window.addEventListener("pywebviewready", boot);
boot();
