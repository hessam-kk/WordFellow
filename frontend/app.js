/* PersoDict frontend */
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

const SOURCE_META = {
  wn: { label: "WordNet (English)", badge: "English", cls: "en", color: "#1d5fa8" },
  enfa: { label: "English ↔ Persian", badge: "Bilingual", cls: "", color: "#0f7a4d" },
  dehkhoda: { label: "Dehkhoda (Persian)", badge: "Persian", cls: "fa", color: "#b45309" },
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
  els.themeBtn.textContent = t === "dark" ? "☀️" : "🌙";
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
    html.push(`<div class="card">
      <div class="card-head">
        <span class="dot" style="background:${meta.color}"></span>
        <h3>${meta.label}</h3>
        <span class="badge ${meta.cls}">${meta.badge}</span>
        <span class="badge">${fmt(counts[sid] || rows.length)} results</span>
      </div>
      ${items}
    </div>`);
  }

  if (rev.length) {
    html.push(`<div class="card">
      <div class="card-head">
        <span class="dot" style="background:#b45309"></span>
        <h3>Persian → English</h3>
        <span class="badge rev">Translation</span>
      </div>
      <div class="word-row">
        <div class="chips">
          ${rev.map((w) => `<button class="chip" dir="ltr" data-word="${esc(w)}">${esc(w)}</button>`).join("")}
        </div>
      </div>
    </div>`);
  }

  if (suggest.length) {
    html.push(`<div class="card">
      <div class="card-head">
        <span class="dot" style="background:#8b93a7"></span>
        <h3>Similar words</h3>
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
    <div class="big">🔎</div>
    <p>No results for “${esc(q)}”.</p>
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
    `<div class="suggest-item hl" data-w="${esc(q)}">Search exactly: <b ${dirAttr(q)}>${esc(q)}</b></div>` +
    words
      .map(
        (w) =>
          `<div class="suggest-item" data-w="${esc(w)}"><span ${dirAttr(w)}>${esc(w)}</span>
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
      (h) => `
      <div class="hist-row" data-word="${esc(h.word)}">
        <span class="hist-word" ${dirAttr(h.word)}>${esc(h.word)}</span>
        <span class="hist-count">×${h.count}</span>
        <span class="hist-time">${timeAgo(h.last_seen)}</span>
        <button class="hist-del" title="Delete">🗑</button>
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

  const palettes = {
    wn: { bg: "#2563eb", label: "WordNet" },
    enfa: { bg: "#0f7a4d", label: "EN⇄FA" },
    dehkhoda: { bg: "#b45309", label: "Dehkhoda" },
  };

  els.sourcesList.innerHTML = list
    .map((s) => {
      const pal = palettes[s.id] || { bg: "#666", label: s.short_name };
      const actions = s.installed
        ? `<span class="src-count">✔ ${fmt(s.count || 0)} entries installed</span>
           <button class="btn danger outlined" data-act="remove" data-id="${s.id}">Remove</button>`
        : `<button class="btn primary" data-act="install" data-id="${s.id}">Download &amp; install (${esc(s.size)})</button>`;
      return `
      <div class="src-card" data-id="${s.id}">
        <div class="src-head">
          <div class="src-icon" style="background:${pal.bg}">${esc(pal.label)}</div>
          <div class="src-title">
            <h3>${esc(s.name)}</h3>
            <p>${esc(s.description)}</p>
          </div>
        </div>
        <div class="src-meta">
          <span>📦 Size: ${esc(s.size)}</span>
          <span>🔗 <a href="${esc(s.url)}" target="_blank" style="color:var(--accent)">Source</a></span>
          <span>📜 ${esc(s.license)}</span>
        </div>
        <div class="src-actions" data-zone="actions">${actions}</div>
        <div class="src-actions hidden" data-zone="progress">
          <span>${s.id === "dehkhoda" ? "Downloading 33 parts…" : "Downloading…"}</span>
          <div class="progress"><div class="progress-bar"></div></div>
        </div>
        <div class="src-actions" data-zone="error"></div>
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
        err.innerHTML = `<span class="src-error">Install failed: ${esc(dl.msg || "network error")}</span>`;
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
      <b>⚠️ The pywebview bridge is not available.</b><br>
      The app must be launched with <code>python main.py</code>.<br>
      <button class="btn primary" id="retryBridge">Try again</button>`;
    const retry = document.getElementById("retryBridge");
    if (retry) retry.addEventListener("click", () => { bootRan = false; boot(); });
    return;
  }
  els.statusText.textContent = "Loading…";
  try {
    const list = await call("sources");
    if (!Array.isArray(list)) list = [];
    const installedIds = list.filter((s) => s.installed).map((s) => s.id);
    const none = installedIds.length === 0;
    if (none) {
      els.onboard.classList.remove("hidden");
      els.onboard.innerHTML = `
        <b>👋 Welcome!</b><br>
        No dictionaries are installed yet. Download one to get started
        (only once — afterwards all searches work fully offline).
        <br><button class="btn primary" id="goDicts">Go to Dictionaries →</button>`;
      const go = document.getElementById("goDicts");
      if (go) go.addEventListener("click", () => switchView("dictionaries"));
    }
    els.statusText.textContent =
      none
        ? "No dictionaries installed"
        : `${installedIds.length} ${installedIds.length === 1 ? "dictionary" : "dictionaries"} installed — offline search active`;
  } catch (e) {
    els.statusText.textContent = "Error: " + e.message;
  }
}

window.addEventListener("pywebviewready", boot);
boot();