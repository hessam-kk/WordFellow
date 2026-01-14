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
  studyBody: $("#studyBody"),
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
  arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  book: '<path d="M2 3.5h6a4 4 0 0 1 4 4V21a3 3 0 0 0-3-3H2z"/><path d="M22 3.5h-6a4 4 0 0 0-4 4V21a3 3 0 0 1 3-3h7z"/>',
  lang: '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  library: '<path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  volume: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>',
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
  autoPronounce: false,
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

function pronounceWord(word) {
  call("pronounce", word).catch(() => { /* ignore if bridge not ready */ });
}

function switchView(name) {
  state.view = name;
  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  $("#view-" + name).classList.add("active");
  els.tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === name));
  if (name === "history") renderHistory();
  if (name === "dictionaries") renderSources();
  if (name === "study") renderStudy();
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

/* ---------------------------- auto-pronounce ---------------------------- */

const pronounceToggle = $("#pronounceToggle");
function applyAutoPronounce(on) {
  state.autoPronounce = on;
  pronounceToggle.classList.toggle("active", on);
  localStorage.setItem("pd-auto-pronounce", on ? "1" : "0");
}
pronounceToggle.addEventListener("click", () => {
  const next = !state.autoPronounce;
  applyAutoPronounce(next);
  call("set_auto_pronounce", next).catch(() => { /* ignore */ });
  toast(next ? "Auto-pronounce on" : "Auto-pronounce off");
});
applyAutoPronounce(localStorage.getItem("pd-auto-pronounce") === "1");

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
          <button class="pronounce-btn" data-say="${esc(word)}" title="Pronounce">${icon("volume", 16)}</button>
        </div>
        <div class="senses">${sensesHtml}</div>
        <div class="word-notes" data-word="${esc(word)}"></div>
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
  /* wire pronounce buttons */
  els.results.querySelectorAll(".pronounce-btn").forEach((btn) => {
    btn.addEventListener("click", () => pronounceWord(btn.dataset.say));
  });
  /* load user notes for all displayed words */
  loadNotes();
  els.statusText.textContent = `”${q}” — ${fmt(exact.length)} results`;
  /* auto-pronounce first English word */
  if (state.autoPronounce && exact.length) {
    const first = exact.find((r) => !isFa(r.word));
    if (first) pronounceWord(first.word);
  }
  if (fromHistory) switchView("search");
}

/* --------------------------- user notes --------------------------- */

async function loadNotes() {
  const noteEls = els.results.querySelectorAll(".word-notes[data-word]");
  if (!noteEls.length) return;
  const words = [...new Set([...noteEls].map((el) => el.dataset.word))];
  try {
    const notes = await call("get_notes", words);
    for (const el of noteEls) {
      const word = el.dataset.word;
      const note = notes[word] || "";
      renderNote(el, word, note);
    }
  } catch (e) {
    /* silently ignore — notes are optional */
  }
}

function renderNote(container, word, note) {
  if (note) {
    container.innerHTML = `
      <div class="note-display">
        <div class="note-content" ${dirAttr(note)}>${esc(note)}</div>
        <div class="note-actions">
          <button class="note-act edit" title="Edit note">${icon("pencil", 14)}</button>
          <button class="note-act del" title="Delete note">${icon("trash", 14)}</button>
        </div>
      </div>`;
    container.querySelector(".note-act.edit").addEventListener("click", () => openEditor(container, word, note));
    container.querySelector(".note-act.del").addEventListener("click", async () => {
      try {
        await call("delete_note", word);
        renderNote(container, word, "");
        toast("Note deleted");
      } catch (e) {
        toast("Error deleting note");
      }
    });
  } else {
    container.innerHTML = `<button class="note-add-btn">${icon("pencil", 13)} Add note</button>`;
    container.querySelector(".note-add-btn").addEventListener("click", () => openEditor(container, word, ""));
  }
}

function openEditor(container, word, existing) {
  container.innerHTML = `
    <div class="note-editor">
      <textarea placeholder="Write your note or meaning for this word…">${esc(existing)}</textarea>
      <div class="note-btns">
        <button class="btn cancel-note">Cancel</button>
        <button class="btn primary save-note">Save</button>
      </div>
    </div>`;
  const ta = container.querySelector("textarea");
  ta.focus();
  if (existing) ta.setSelectionRange(ta.value.length, ta.value.length);
  container.querySelector(".cancel-note").addEventListener("click", () => renderNote(container, word, existing));
  container.querySelector(".save-note").addEventListener("click", async () => {
    const text = ta.value.trim();
    if (!text) {
      renderNote(container, word, "");
      return;
    }
    try {
      await call("save_note", word, text);
      renderNote(container, word, text);
      toast("Note saved");
    } catch (e) {
      toast("Error saving note");
    }
  });
  /* save on Ctrl+Enter */
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      container.querySelector(".save-note").click();
    }
  });
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
  const exactFirst = words.length && words[0].toLowerCase() === q.toLowerCase();
  const head = exactFirst
    ? ""
    : `<div class="suggest-item exact hl" data-w="${esc(q)}">${icon("search", 14)}<span class="s-word">Search for <b ${dirAttr(q)}>${esc(q)}</b></span></div>`;
  els.suggestBox.innerHTML =
    head +
    words
      .map((w, i) => {
        if (i === 0 && exactFirst) {
          return `<div class="suggest-item exact hl" data-w="${esc(w)}">${icon("search", 14)}<span class="s-word"><b ${dirAttr(w)}>${esc(w)}</b></span><span class="hint">Exact match</span></div>`;
        }
        return `<div class="suggest-item" data-w="${esc(w)}"><span class="s-word" ${dirAttr(w)}>${esc(w)}</span>
             <span class="hint">${fa ? "Persian" : "English"}</span></div>`;
      })
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

/* ---------------------------- 1212 study ---------------------------- */

const study = {
  catId: null,
  catName: "",
  words: [],
  queue: [],
  idx: 0,
  flipped: false,
  correct: 0,
  mode: "home", // home | cards | browse | end
};

const BOX_LABEL = ["New", "Learning", "Review", "Mastered"];

/* Re-render whatever study sub-view was active — tab switches must not
   reset an in-progress session. */
function renderStudy() {
  if (study.mode === "cards" && study.idx < study.queue.length) renderStudyCard();
  else if (study.mode === "browse") renderStudyBrowse();
  else if (study.mode === "end") renderStudyEnd();
  else renderStudyHome();
}

const shuffleArr = (a) => {
  const out = a.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

function studySegBar(c) {
  const pct = (n) => (c.total ? (n / c.total) * 100 : 0);
  return `<div class="study-bar" title="${c.mastered} mastered · ${c.learning} learning · ${c.new} new">
    <span class="sb mastered" style="width:${pct(c.mastered)}%"></span>
    <span class="sb learning" style="width:${pct(c.learning)}%"></span>
  </div>`;
}

async function renderStudyHome() {
  study.mode = "home";
  let cats;
  try {
    cats = await call("study_categories");
  } catch (e) {
    els.studyBody.innerHTML = `
      <div class="empty">
        <div class="empty-art">${icon("alert", 46)}</div>
        <p class="empty-title">Could not load the word list</p>
        <p class="muted">${esc(e.message)}</p>
      </div>`;
    return;
  }
  if (!cats || !cats.length) {
    els.studyBody.innerHTML = `
      <div class="empty">
        <div class="empty-art">${icon("book", 46)}</div>
        <p class="empty-title">No word list found</p>
        <p class="muted">Place the 1212_Category folder next to the app files.</p>
      </div>`;
    return;
  }
  const total = cats.reduce((s, c) => s + c.total, 0);
  const mastered = cats.reduce((s, c) => s + c.mastered, 0);
  const learning = cats.reduce((s, c) => s + c.learning, 0);
  const pct = total ? Math.round((mastered / total) * 100) : 0;

  els.studyBody.innerHTML = `
    <div class="panel-head">
      <div>
        <h2>1212 Words</h2>
        <p class="panel-note muted">The essential TOEFL vocabulary, grouped into ${cats.length} topics.
        Study with flashcards — words you miss come back until you master them.</p>
      </div>
      <div class="study-overall">
        <div class="so-num"><b>${fmt(mastered)}</b> / ${fmt(total)} mastered</div>
        <div class="study-bar big">
          <span class="sb mastered" style="width:${pct}%"></span>
          <span class="sb learning" style="width:${total ? (learning / total) * 100 : 0}%"></span>
        </div>
        <div class="so-sub">${pct}% complete · ${fmt(learning)} in progress</div>
      </div>
    </div>
    <div class="study-grid">
      ${cats
        .map(
          (c) => `
        <div class="cat-card" data-act="open" data-cat="${esc(c.id)}">
          <div class="cat-top">
            <span class="cat-num">${esc(c.id)}</span>
            <div class="cat-name">
              <h3>${esc(c.name)}</h3>
              <span>${fmt(c.total)} words</span>
            </div>
          </div>
          ${studySegBar(c)}
          <div class="cat-stats">
            <span class="cs mastered">${fmt(c.mastered)} mastered</span>
            <span class="cs learning">${fmt(c.learning)} learning</span>
            <span class="cs new">${fmt(c.new)} new</span>
          </div>
          <div class="cat-btns">
            <button class="btn primary sm" data-act="open" data-cat="${esc(c.id)}">Study</button>
            <button class="btn sm" data-act="browse" data-cat="${esc(c.id)}">Browse</button>
          </div>
        </div>`
        )
        .join("")}
    </div>`;
}

async function openCategory(catId, mode) {
  study.catId = catId;
  study.mode = mode;
  els.studyBody.innerHTML = `<div class="empty"><p class="muted">Loading words…</p></div>`;
  let words;
  try {
    words = await call("study_words", catId);
  } catch (e) {
    toast("Error loading words: " + e.message);
    renderStudyHome();
    return;
  }
  study.words = words;
  const catsInfo = await call("study_categories").catch(() => []);
  const info = (catsInfo || []).find((c) => c.id === catId);
  study.catName = info ? info.name : "Category " + catId;
  if (mode === "browse") renderStudyBrowse();
  else startSession();
}

function startSession() {
  study.mode = "cards";
  study.flipped = false;
  study.correct = 0;
  study.idx = 0;
  const pending = study.words
    .filter((w) => w.box < 3)
    .sort((a, b) => a.box - b.box);
  let queue = shuffleArr(pending).sort((a, b) => a.box - b.box).slice(0, 15);
  if (queue.length < 15) {
    const masteredPool = shuffleArr(study.words.filter((w) => w.box >= 3));
    queue = queue.concat(masteredPool.slice(0, 15 - queue.length));
  }
  study.queue = queue;
  if (!queue.length) {
    renderStudyBrowse();
    toast("No words in this category");
    return;
  }
  renderStudyCard();
}

function studyAnswerHtml(w) {
  const parts = [];
  if (w.gloss) {
    parts.push(`<div class="flash-def"><span class="def-src">Word list</span><div>${esc(w.gloss)}</div></div>`);
  }
  (w.defs || []).forEach((d) => {
    const label = d.src === "wn" ? "WordNet" : "English ↔ Persian";
    const cls = d.src === "enfa" ? ' class="flash-def fa" dir="rtl"' : ' class="flash-def"';
    parts.push(`<div ${cls}><span class="def-src">${label}</span><div>${esc(d.text)}</div></div>`);
  });
  if (!parts.length) {
    parts.push(`<div class="flash-def"><div class="muted">No definition available — look it up from the Search tab and add a note.</div></div>`);
  }
  return parts.join("");
}

function renderStudyCard() {
  const w = study.queue[study.idx];
  const pos = w.pos && w.pos !== "None" ? `<span class="pos-chip">${esc(w.pos)}</span>` : "";
  const body = study.flipped
    ? studyAnswerHtml(w)
    : `<p class="reveal-hint">${icon("search", 14)} Tap the card or press <kbd>Space</kbd> to reveal</p>`;
  const rates = study.flipped
    ? `<button class="rate again" data-act="again">${icon("x", 15)} Again<span class="k">1</span></button>
       <button class="rate got" data-act="got">${icon("check", 15)} Got it<span class="k">2</span></button>`
    : `<button class="rate reveal" data-act="flip">${icon("book", 15)} Reveal answer<span class="k">Space</span></button>`;
  const dictBtn = study.flipped
    ? `<div class="dict-row">
        <button class="dict-link" data-act="word" data-word="${esc(w.word)}" title="Open this word in the Search tab">
          ${icon("search", 13)} Look up in dictionary
        </button>
      </div>`
    : "";
  els.studyBody.innerHTML = `
    <div class="study-top">
      <button class="btn sm" data-act="home">${icon("arrowLeft", 13)} All categories</button>
      <div class="study-mid">
        <b>${esc(study.catName)}</b>
        <span>Card ${study.idx + 1} of ${study.queue.length}</span>
      </div>
      <span class="status-chip ${w.box >= 3 ? "mastered" : w.box >= 1 ? "learning" : "new"}">${BOX_LABEL[w.box]}</span>
    </div>
    <div class="study-progress"><span style="width:${((study.idx + 1) / study.queue.length) * 100}%"></span></div>
    <div class="flash-card ${study.flipped ? "flipped" : ""}" data-act="flip">
      <div class="flash-word-row">
        <span class="flash-word">${esc(w.word)}</span>
        ${pos}
        <button class="pronounce-btn" data-act="pronounce" data-word="${esc(w.word)}" title="Pronounce">${icon("volume", 18)}</button>
      </div>
      ${body}
    </div>
    <div class="rate-btns">${rates}</div>
    ${dictBtn}`;
  /* front side: pronounce the new word automatically */
  if (!study.flipped && state.autoPronounce) pronounceWord(w.word);
}

function flipStudyCard() {
  if (study.mode !== "cards" || study.flipped) return;
  study.flipped = true;
  renderStudyCard();
  if (state.autoPronounce) pronounceWord(study.queue[study.idx].word);
}

async function rateStudyCard(correct) {
  if (study.mode !== "cards" || !study.flipped) return;
  const w = study.queue[study.idx];
  if (correct) study.correct++;
  try {
    await call("study_rate", w.word, correct);
  } catch (e) {
    toast("Error saving progress");
  }
  w.box = correct ? Math.min(3, w.box + 1) : 0;
  study.idx++;
  study.flipped = false;
  if (study.idx >= study.queue.length) renderStudyEnd();
  else renderStudyCard();
}

function renderStudyEnd() {
  study.mode = "end";
  const studied = study.queue.length;
  const acc = studied ? Math.round((study.correct / studied) * 100) : 0;
  els.studyBody.innerHTML = `
    <div class="study-end">
      <div class="end-art">${icon("check", 34)}</div>
      <h3>Session complete!</h3>
      <p class="muted">${esc(study.catName)}</p>
      <div class="end-stats">
        <div class="end-stat"><b>${fmt(studied)}</b><span>cards studied</span></div>
        <div class="end-stat"><b>${fmt(study.correct)}</b><span>correct</span></div>
        <div class="end-stat"><b>${acc}%</b><span>accuracy</span></div>
      </div>
      <div class="end-btns">
        <button class="btn primary" data-act="restart">Study more</button>
        <button class="btn" data-act="browse" data-cat="${esc(study.catId)}">Browse words</button>
        <button class="btn" data-act="home">All categories</button>
      </div>
    </div>`;
}

function renderStudyBrowse() {
  study.mode = "browse";
  const rows = study.words
    .map((w) => {
      const def = (w.defs && w.defs.length ? w.defs.map((d) => d.text).join(" · ") : "") || w.gloss || "—";
      const short = def.length > 110 ? def.slice(0, 110) + "…" : def;
      const cls = w.box >= 3 ? "mastered" : w.box >= 1 ? "learning" : "new";
      return `
      <div class="brow-row" data-act="word" data-word="${esc(w.word)}" title="Search this word in the dictionary">
        <span class="status-chip ${cls}">${BOX_LABEL[w.box]}</span>
        <div class="brow-main">
          <b class="brow-word" dir="ltr">${esc(w.word)}</b>
          <span class="brow-def" ${dirAttr(short)}>${esc(short)}</span>
        </div>
        ${icon("arrowRight", 14)}
      </div>`;
    })
    .join("");
  els.studyBody.innerHTML = `
    <div class="study-top">
      <button class="btn sm" data-act="home">${icon("arrowLeft", 13)} All categories</button>
      <div class="study-mid">
        <b>${esc(study.catName)}</b>
        <span>${fmt(study.words.length)} words · click any word to look it up</span>
      </div>
      <div class="study-top-btns">
        <button class="btn primary sm" data-act="open" data-cat="${esc(study.catId)}">Flashcards</button>
        <button class="btn danger outlined sm" data-act="reset">Reset progress</button>
      </div>
    </div>
    <div class="browse-list">${rows}</div>`;
}

async function resetStudyCategory(btn) {
  if (btn.dataset.armed) {
    try {
      await call("study_reset", study.catId);
    } catch (e) {
      toast("Error resetting");
      return;
    }
    toast("Progress reset");
    openCategory(study.catId, "browse");
    return;
  }
  btn.dataset.armed = "1";
  const original = btn.innerHTML;
  btn.innerHTML = "Click again to confirm";
  setTimeout(() => {
    delete btn.dataset.armed;
    if (btn.isConnected) btn.innerHTML = original;
  }, 2500);
}

els.studyBody.addEventListener("click", (e) => {
  const t = e.target.closest("[data-act]");
  if (!t) return;
  const act = t.dataset.act;
  if (act === "open") openCategory(t.dataset.cat, "cards");
  else if (act === "browse") openCategory(t.dataset.cat, "browse");
  else if (act === "flip") flipStudyCard();
  else if (act === "again") rateStudyCard(false);
  else if (act === "got") rateStudyCard(true);
  else if (act === "home") renderStudyHome();
  else if (act === "restart") openCategory(study.catId, "cards");
  else if (act === "reset") resetStudyCategory(t);
  else if (act === "word") {
    els.searchInput.value = t.dataset.word;
    switchView("search");
    doSearch(t.dataset.word);
  }
  else if (act === "pronounce") {
    pronounceWord(t.dataset.word);
  }
});

document.addEventListener("keydown", (e) => {
  if (state.view !== "study" || study.mode !== "cards") return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === " ") {
    e.preventDefault();
    flipStudyCard();
  } else if (e.key === "1") {
    rateStudyCard(false);
  } else if (e.key === "2") {
    rateStudyCard(true);
  }
});

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
    /* sync auto-pronounce from backend */
    try {
      const ap = await call("get_auto_pronounce");
      applyAutoPronounce(ap);
    } catch (e) { /* ignore */ }
  } catch (e) {
    els.statusText.textContent = "Error: " + e.message;
  }
}

window.addEventListener("pywebviewready", boot);
boot();
