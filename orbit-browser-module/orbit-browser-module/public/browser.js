"use strict";

const STORAGE_PREFIX = "orbit-browser-";
const state = {
  engine: localStorage.getItem(STORAGE_PREFIX + "engine") || "scramjet",
  transport: localStorage.getItem(STORAGE_PREFIX + "transport") || "epoxy",
  search: localStorage.getItem(STORAGE_PREFIX + "search") || "duckduckgo",
  currentUrl: "",
};

const SEARCH_ENGINES = {
  duckduckgo: "https://duckduckgo.com/?q=%s",
  google: "https://www.google.com/search?q=%s",
  bing: "https://www.bing.com/search?q=%s",
};

const els = {
  shell: document.querySelector(".browser-shell"),
  viewport: document.getElementById("viewport"),
  startPage: document.getElementById("start-page"),
  address: document.getElementById("address-input"),
  addressForm: document.getElementById("address-form"),
  startForm: document.getElementById("start-search"),
  startInput: document.getElementById("start-input"),
  status: document.getElementById("status-pill"),
  engine: document.getElementById("engine-select"),
  transport: document.getElementById("transport-select"),
  search: document.getElementById("search-select"),
  engineLabel: document.getElementById("engine-label"),
  transportLabel: document.getElementById("transport-label"),
  settings: document.getElementById("settings-panel"),
  fullscreen: document.getElementById("fullscreen-btn"),
};

let bareConnection;
let scramjetController;
let activeFrame;

function setStatus(text) {
  els.status.textContent = text;
}

function wispUrl() {
  return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/wisp/`;
}

function looksLikeUrl(value) {
  return /^(https?:\/\/)/i.test(value) || (/^[\w.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(value) && !value.includes(" "));
}

function resolveInput(value) {
  const input = String(value || "").trim();
  if (!input) return "";
  if (looksLikeUrl(input)) return /^https?:\/\//i.test(input) ? input : `https://${input}`;
  const searchTemplate = SEARCH_ENGINES[state.search] || SEARCH_ENGINES.duckduckgo;
  return searchTemplate.replace("%s", encodeURIComponent(input));
}

async function registerRootServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers are not supported in this browser.");
  if (location.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    throw new Error("HTTPS is required for service workers.");
  }
  await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
}

async function ensureBareConnection() {
  if (!bareConnection) bareConnection = new BareMux.BareMuxConnection("/baremux/worker.js");
  return bareConnection;
}

async function applyTransport() {
  const connection = await ensureBareConnection();
  const wisp = wispUrl();
  const target = state.transport === "libcurl" ? "/libcurl/index.mjs" : "/epoxy/index.mjs";
  const args = state.transport === "libcurl" ? [{ websocket: wisp }] : [{ wisp }];
  if ((await connection.getTransport()) !== target) await connection.setTransport(target, args);
}

async function ensureScramjet() {
  if (scramjetController) return scramjetController;
  const { ScramjetController } = $scramjetLoadController();
  scramjetController = new ScramjetController({
    files: {
      wasm: "/scram/scramjet.wasm.wasm",
      all: "/scram/scramjet.all.js",
      sync: "/scram/scramjet.sync.js",
    },
  });
  await scramjetController.init();
  return scramjetController;
}

function clearViewport() {
  els.viewport.innerHTML = "";
  activeFrame = null;
}

async function openWithScramjet(url) {
  const controller = await ensureScramjet();
  clearViewport();
  const frame = controller.createFrame();
  frame.frame.className = "proxy-frame";
  els.viewport.appendChild(frame.frame);
  activeFrame = frame.frame;
  frame.go(url);
}

async function openWithUltraviolet(url) {
  clearViewport();
  const frame = document.createElement("iframe");
  frame.className = "proxy-frame";
  frame.src = __uv$config.prefix + __uv$config.encodeUrl(url);
  els.viewport.appendChild(frame);
  activeFrame = frame;
}

async function navigate(rawValue) {
  const url = resolveInput(rawValue);
  if (!url) return;

  state.currentUrl = url;
  els.address.value = url;
  els.startPage.classList.add("hidden");
  els.viewport.classList.add("active");
  setStatus("Connecting…");

  try {
    await registerRootServiceWorker();
    await applyTransport();
    if (state.engine === "ultraviolet") await openWithUltraviolet(url);
    else await openWithScramjet(url);
    setStatus(`${state.engine === "scramjet" ? "Scramjet" : "Ultraviolet"} · ${state.transport === "epoxy" ? "Epoxy" : "libcurl"}`);
  } catch (error) {
    console.error(error);
    setStatus("Error");
    clearViewport();
    els.viewport.innerHTML = `<div style="padding:24px;background:#080e1f;color:#e8eaf6;height:100%"><h3>Orbit could not start this page</h3><pre style="white-space:pre-wrap;color:#9aa6c3">${String(error).replace(/[<>]/g, "")}</pre></div>`;
  }
}

function goHome() {
  clearViewport();
  els.viewport.classList.remove("active");
  els.startPage.classList.remove("hidden");
  els.address.value = "";
  els.startInput.value = "";
  state.currentUrl = "";
  setStatus("Ready");
  setTimeout(() => els.startInput.focus(), 30);
}

function syncSettingsUI() {
  els.engine.value = state.engine;
  els.transport.value = state.transport;
  els.search.value = state.search;
  els.engineLabel.textContent = state.engine === "scramjet" ? "Scramjet" : "Ultraviolet";
  els.transportLabel.textContent = state.transport === "epoxy" ? "Epoxy" : "libcurl";
}

function saveSetting(key, value) {
  state[key] = value;
  localStorage.setItem(STORAGE_PREFIX + key, value);
  syncSettingsUI();
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen();
  } catch (error) {
    // When Orbit is embedded later, the parent page can listen for this message
    // and fullscreen the module container if the browser blocks nested fullscreen.
    if (window.parent !== window) {
      window.parent.postMessage({ type: "orbit:request-fullscreen" }, "*");
    } else {
      console.warn("Fullscreen request failed:", error);
    }
  }
}

els.addressForm.addEventListener("submit", (e) => {
  e.preventDefault();
  navigate(els.address.value);
});

els.startForm.addEventListener("submit", (e) => {
  e.preventDefault();
  navigate(els.startInput.value);
});

document.querySelectorAll(".quick-link[data-url]").forEach((button) => {
  button.addEventListener("click", () => navigate(button.dataset.url));
});

document.getElementById("settings-btn").addEventListener("click", () => {
  els.settings.classList.add("open");
  els.settings.setAttribute("aria-hidden", "false");
});

document.getElementById("settings-close").addEventListener("click", () => {
  els.settings.classList.remove("open");
  els.settings.setAttribute("aria-hidden", "true");
});

els.engine.addEventListener("change", async (e) => {
  saveSetting("engine", e.target.value);
  if (state.currentUrl) await navigate(state.currentUrl);
});

els.transport.addEventListener("change", async (e) => {
  saveSetting("transport", e.target.value);
  await applyTransport().catch(console.error);
  if (state.currentUrl) await navigate(state.currentUrl);
});

els.search.addEventListener("change", (e) => saveSetting("search", e.target.value));

document.getElementById("home-btn").addEventListener("click", goHome);

document.getElementById("reload-btn").addEventListener("click", () => {
  if (!activeFrame) return;
  try {
    activeFrame.contentWindow.location.reload();
  } catch {
    if (state.currentUrl) navigate(state.currentUrl);
  }
});

document.getElementById("back-btn").addEventListener("click", () => {
  if (!activeFrame) return;
  try {
    activeFrame.contentWindow.history.back();
  } catch {
    // Navigation history may be hidden by a proxy frame implementation.
  }
});

document.getElementById("forward-btn").addEventListener("click", () => {
  if (!activeFrame) return;
  try {
    activeFrame.contentWindow.history.forward();
  } catch {
    // Navigation history may be hidden by a proxy frame implementation.
  }
});

els.fullscreen.addEventListener("click", toggleFullscreen);

document.addEventListener("fullscreenchange", () => {
  els.shell.classList.toggle("is-fullscreen", !!document.fullscreenElement);
  els.fullscreen.title = document.fullscreenElement ? "Exit fullscreen" : "Fullscreen Orbit";
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.settings.classList.contains("open")) {
    els.settings.classList.remove("open");
    els.settings.setAttribute("aria-hidden", "true");
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
    e.preventDefault();
    els.address.focus();
    els.address.select();
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "r") {
    e.preventDefault();
    document.getElementById("reload-btn").click();
  }
});

syncSettingsUI();
setTimeout(() => els.startInput.focus(), 50);
