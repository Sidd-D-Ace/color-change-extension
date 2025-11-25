// content_script.js
const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log('[CS] content script loaded on', location.href);
ext.runtime.onMessage.addListener((message) => {
  console.log('[CS] message received:', message);
});

// Listen for background messages
ext.runtime.onMessage.addListener((message) => {
  if (!message || message.action !== "trigger") return;
  triggerFromPayload(message);
});

// The content script will also listen for page-focused keyboard events as a fallback
// for user-configured shortcuts (works only when page has focus).
let storedMappings = [];

// load mappings initially and whenever storage changes
function loadMappingsToMemory() {
  ext.storage.sync.get({ mappings: null }).then((res) => {
    storedMappings = res.mappings || [];
  });
}
loadMappingsToMemory();
ext.storage.onChanged.addListener((changes) => {
  if (changes.mappings) {
    storedMappings = changes.mappings.newValue || [];
  }
});

// function to trigger UI action
function triggerFromPayload(payload) {
  const selector = payload.selector;
  if (selector) {
    try {
      const el = document.querySelector(selector);
      if (el) {
        // Click the element to preserve existing handlers
        el.click();
        return;
      }
    } catch (e) {
      // invalid selector; fallback to color
    }
  }
  // fallback: set background color to the colorName (best-effort)
  if (payload.colorName) {
    try {
      document.body.style.backgroundColor = payload.colorName;
    } catch (e) {}
  }
}

// ---- page-focused keyboard fallback ----
// Helper to normalise a shortcut string like "Ctrl+Shift+1"
function parseShortcutString(s) {
  if (!s || typeof s !== "string") return null;
  const parts = s.split("+").map(p => p.trim().toLowerCase());
  const obj = {
    ctrl: parts.includes("ctrl") || parts.includes("control"),
    alt: parts.includes("alt"),
    shift: parts.includes("shift"),
    meta: parts.includes("meta") || parts.includes("cmd") || parts.includes("command"),
    key: parts.find(p => !["ctrl","control","alt","shift","meta","cmd","command"].includes(p))
  };
  if (!obj.key) return null;
  return obj;
}

function eventMatchesShortcut(e, shortcutObj) {
  if (!shortcutObj) return false;
  const code = e.code ? e.code.toLowerCase() : (e.key ? e.key.toLowerCase() : "");
  const keyMatch = (shortcutObj.key.length === 1) ?
    (shortcutObj.key === code.replace("digit","") || shortcutObj.key === e.key?.toLowerCase()) :
    (shortcutObj.key === e.code?.toLowerCase() || shortcutObj.key === e.key?.toLowerCase());

  // check modifiers
  if (!!e.ctrlKey !== !!shortcutObj.ctrl) return false;
  if (!!e.shiftKey !== !!shortcutObj.shift) return false;
  if (!!e.altKey !== !!shortcutObj.alt) return false;
  if (!!e.metaKey !== !!shortcutObj.meta) return false;

  // final key match (loose)
  return keyMatch;
}

window.addEventListener("keydown", (e) => {
  // ignore when typing in inputs or contenteditable
  const tag = (e.target && e.target.tagName) || "";
  if (["INPUT","TEXTAREA"].includes(tag) || e.target?.isContentEditable) return;

  for (let i = 0; i < storedMappings.length && i < 10; i++) {
    const m = storedMappings[i];
    if (!m || !m.shortcut) continue;
    const sObj = parseShortcutString(m.shortcut);
    if (!sObj) continue;
    if (eventMatchesShortcut(e, sObj)) {
      // trigger mapped selector/color
      triggerFromPayload({ selector: m.selector, colorName: m.colorName });
      e.preventDefault();
      e.stopPropagation();
      break;
    }
  }
}, true);
