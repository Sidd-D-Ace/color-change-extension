// popup.js
const ext = (typeof browser !== "undefined") ? browser : chrome;
const rowsContainer = document.getElementById("rows");
const saveBtn = document.getElementById("saveBtn");
const resetBtn = document.getElementById("resetBtn");
const helpBtn = document.getElementById("helpShortcuts");
const announce = document.getElementById("announce");
const error = document.getElementById("error");

// ----- defaults -----
function defaultMappings() {
  return [
    { colorName: "Red", selector: ".redBtn", shortcut: "Ctrl+Shift+1" },
    { colorName: "Green", selector: ".greenBtn", shortcut: "Ctrl+Shift+2" },
    { colorName: "Blue", selector: ".blueBtn", shortcut: "Ctrl+Shift+3" },
    { colorName: "Yellow", selector: ".yellowBtn", shortcut: "Ctrl+Shift+4" },
    { colorName: "Magenta", selector: ".magentaBtn", shortcut: "Ctrl+Shift+5" },
    { colorName: "Cyan", selector: ".cyanBtn", shortcut: "Ctrl+Shift+6" },
    { colorName: "Orange", selector: ".orangeBtn", shortcut: "Ctrl+Shift+7" },
    { colorName: "Purple", selector: ".purpleBtn", shortcut: "Ctrl+Shift+8" },
    { colorName: "Brown", selector: ".brownBtn", shortcut: "Ctrl+Shift+9" },
    { colorName: "Black", selector: ".blackBtn", shortcut: "Ctrl+Shift+0" }
  ];
}

// ----- UI row builder -----
function buildRow(index, mapping) {
  const tr = document.createElement("tr");
  tr.dataset.index = index;

  const idxTd = document.createElement("td");
  idxTd.textContent = (index + 1);
  tr.appendChild(idxTd);

  const colorTd = document.createElement("td");
  const colorInput = document.createElement("input");
  colorInput.type = "text";
  colorInput.value = mapping.colorName || "";
  colorInput.setAttribute("aria-label", `Color name ${index+1}`);
  colorInput.className = "colorName";
  colorTd.appendChild(colorInput);
  tr.appendChild(colorTd);

  const selectorTd = document.createElement("td");
  const selectorInput = document.createElement("input");
  selectorInput.type = "text";
  selectorInput.value = mapping.selector || "";
  selectorInput.setAttribute("aria-label", `Selector ${index+1}`);
  selectorInput.className = "selector";
  selectorTd.appendChild(selectorInput);
  tr.appendChild(selectorTd);

  const shortcutTd = document.createElement("td");
  const shortcutInput = document.createElement("input");
  shortcutInput.type = "text";
  shortcutInput.value = mapping.shortcut || "";
  shortcutInput.setAttribute("aria-label", `Shortcut ${index+1}`);
  shortcutInput.className = "shortcut";
  // Make recording-friendly (we manage value via key capture)
  shortcutInput.readOnly = true;
  shortcutTd.appendChild(shortcutInput);
  tr.appendChild(shortcutTd);

  const testTd = document.createElement("td");
  const testBtn = document.createElement("button");
  testBtn.type = "button";
  testBtn.textContent = "Test";
  testBtn.setAttribute("aria-label", `Test mapping ${index+1}`);
  testBtn.addEventListener("click", () => testRow(index));
  testTd.appendChild(testBtn);
  tr.appendChild(testTd);

  return tr;
}

function renderRows(mappings) {
  rowsContainer.innerHTML = "";
  for (let i = 0; i < 10; i++) {
    const map = mappings[i] || { colorName: "", selector: "", shortcut: "" };
    rowsContainer.appendChild(buildRow(i, map));
  }
  // after DOM created, attach recorders
  attachRecordersToAllShortcuts();
}

// ----- load / save -----
function loadAndRender() {
  ext.storage.sync.get({ mappings: null }, (res) => {
    const mappings = res.mappings || defaultMappings();
    renderRows(mappings);
    announceMessage("Settings loaded.");
  });
}

function collectRows() {
  const trs = Array.from(rowsContainer.querySelectorAll("tr"));
  return trs.map(tr => {
    return {
      colorName: tr.querySelector(".colorName").value.trim(),
      selector: tr.querySelector(".selector").value.trim(),
      shortcut: tr.querySelector(".shortcut").value.trim()
    };
  });
}

function findDuplicateShortcuts(mappings) {
  const map = {};
  const duplicates = [];
  mappings.forEach((m, i) => {
    const key = (m.shortcut || "").toLowerCase();
    if (!key) return;
    if (map[key] !== undefined) {
      duplicates.push(i, map[key]);
    } else {
      map[key] = i;
    }
  });
  return Array.from(new Set(duplicates));
}

saveBtn.addEventListener("click", () => {
  const mappings = collectRows();
  const dups = findDuplicateShortcuts(mappings);
  if (dups.length > 0) {
    const msg = `Repeated shortcut on rows: ${dups.map(i => i+1).join(", ")}`;
    error.textContent = msg;
    announceMessage(msg);
    return;
  }
  // clear errors
  error.textContent = "";
  ext.storage.sync.set({ mappings }, () => {
    announceMessage("Settings saved.");
  });
});

resetBtn.addEventListener("click", () => {
  const defs = defaultMappings();
  renderRows(defs);
  ext.storage.sync.set({ mappings: defs }, () => {
    announceMessage("Reset to defaults.");
    error.textContent = "";
  });
});

helpBtn.addEventListener("click", () => {
  const help = "To change the browser-level shortcuts globally, open your browser's Extensions → Keyboard Shortcuts and edit them. The shortcuts you enter in this popup are used by the page-focused fallback when the page has focus.";
  alert(help);
});

// ----- Test row messaging (works with chrome callback and browser promise) -----
function testRow(index) {
  const tr = rowsContainer.querySelector(`tr[data-index='${index}']`);
  if (!tr) return;
  const mapping = {
    colorName: tr.querySelector(".colorName").value.trim(),
    selector: tr.querySelector(".selector").value.trim()
  };
  ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) {
      announceMessage("No active tab to test.");
      return;
    }
    const msg = { action: "trigger", colorName: mapping.colorName, selector: mapping.selector };
    // Try callback-style first (chrome)
    try {
      ext.tabs.sendMessage(tabs[0].id, msg, (res) => {
        if (ext.runtime && ext.runtime.lastError) {
          // likely no content script or no response; try promise-style fallback
          // Try promise form if supported
          try {
            const p = ext.tabs.sendMessage(tabs[0].id, msg);
            if (p && typeof p.then === "function") {
              p.then(() => announceMessage(`Tested row ${index+1}.`)).catch(() => announceMessage("Content script not found on the current page."));
            } else {
              announceMessage("Test attempted.");
            }
          } catch (e) {
            announceMessage("Content script not found on the current page.");
          }
        } else {
          announceMessage(`Tested row ${index+1}.`);
        }
      });
    } catch (e) {
      // fallback: try promise style
      try {
        const p = ext.tabs.sendMessage(tabs[0].id, msg);
        if (p && typeof p.then === "function") {
          p.then(() => announceMessage(`Tested row ${index+1}.`)).catch(() => announceMessage("Content script not found on the current page."));
        } else {
          announceMessage("Test attempted.");
        }
      } catch (err) {
        announceMessage("Content script not found on the current page.");
      }
    }
  });
}

// ----- accessibility announce helper -----
function announceMessage(msg) {
  if (announce) announce.textContent = msg;
  // visible small message area for keyboard users
  if (error) error.textContent = "";
}

// ----- Shortcut recording helpers (fixed: single global handler) -----
function normalizeKeyName(key) {
  if (!key) return "";
  const k = key.toLowerCase();
  if (k === "control" || k === "ctrl") return "Ctrl";
  if (k === "meta" || k === "command" || k === "cmd") return "Meta";
  if (k === "alt") return "Alt";
  if (k === "shift") return "Shift";
  if (k.startsWith("arrow")) {
    return key[0].toUpperCase() + key.slice(1);
  }
  if (/^f\d{1,2}$/i.test(key)) return key.toUpperCase();
  if (key.length === 1) return key.toUpperCase();
  return key[0] ? (key[0].toUpperCase() + key.slice(1)) : key;
}

function buildShortcutStringFromEvent(e) {
  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");

  let main = e.key || "";
  if (main === " ") main = "Space";
  if (main === "Esc") main = "Escape";
  const normalizedMain = normalizeKeyName(main);

  return { parts, normalizedMain };
}

// Start recording on an input (called when an input is focused/clicked)
function startRecordingOnInput(input) {
  input.dataset.recording = "1";
  input._prevValue = input.value;
  input.value = "Press keys...";
  input.classList.add("recording");
  input.focus();
  if (announce) announce.textContent = "Recording shortcut. Press desired key combination, Escape to cancel.";
}

// Stop recording; if save=true keep current value, otherwise restore previous
    stopRecordingOnInput(active, true);
    const tr = active.closest("tr");
    if (tr) {
      const next = tr.nextElementSibling;
      if (next) {
        const nextShortcut = next.querySelector(".shortcut");
        if (nextShortcut) {
          // avoid auto-starting recording on programmatic focus
          nextShortcut.dataset.skipFocus = "1";
          nextShortcut.focus();
        }
      }
    }


// Attach per-input handlers that only toggle recording state (no global key listeners here)
function enableShortcutRecording(input) {
  if (!input) return;
  input.setAttribute("autocomplete", "off");
  input.setAttribute("inputmode", "none");
  input.readOnly = true;

  input.addEventListener("focus", (ev) => {
    // If focus was set programmatically to skip auto-recording, consume the flag and do nothing
    if (input.dataset.skipFocus === "1") {
      delete input.dataset.skipFocus;
      return;
    }
    // Otherwise start recording (user-initiated focus)
    startRecordingOnInput(input);
  });

  input.addEventListener("click", (ev) => {
    // clicking should always start recording
    if (!input.dataset.recording) startRecordingOnInput(input);
  });

  input.addEventListener("blur", (ev) => {
    // if blur occurs while recording, commit the current value
    if (input.dataset.recording) stopRecordingOnInput(input, true);
  });

  input.addEventListener("paste", (e) => e.preventDefault());
}


// Attach recorders to all .shortcut inputs (call after rendering)
function attachRecordersToAllShortcuts() {
  const shortcuts = document.querySelectorAll("#rows .shortcut");
  shortcuts.forEach(input => {
    if (!input._recorderAttached) {
      enableShortcutRecording(input);
      input._recorderAttached = true;
    }
  });
}

// Single global keydown listener that only acts when an input is recording
window.addEventListener("keydown", function (e) {
  // find the currently active element if it is a .shortcut and recording
  const active = document.activeElement;
  if (!active || !active.classList || !active.classList.contains("shortcut")) return;
  if (!active.dataset || active.dataset.recording !== "1") return;

  // prevent the browser from handling the key while recording
  e.preventDefault();
  e.stopPropagation();

  // Cancel recording
  if (e.key === "Escape") {
    stopRecordingOnInput(active, false);
    return;
  }

  // Clear current value
  if (e.key === "Backspace" || e.key === "Delete") {
    active.value = "";
    return;
  }

  // Build parts and normalized main key
  const { parts, normalizedMain } = buildShortcutStringFromEvent(e);

  // If normalizedMain is a modifier (Ctrl/Alt/Shift/Meta), update the input value to show modifiers only
  if (["Ctrl", "Alt", "Shift", "Meta"].includes(normalizedMain)) {
    // show currently held modifiers (e.g., "Ctrl+Shift")
    active.value = parts.join("+");
    // keep recording — do not stop yet
    return;
  }

  // For normal keys, include it and finish recording
  if (normalizedMain) {
    // ensure main key is appended if not already in parts
    const combined = parts.slice();
    if (!combined.includes(normalizedMain)) combined.push(normalizedMain);
    active.value = combined.join("+");
    // finalize and move focus to next shortcut input for convenience
    stopRecordingOnInput(active, true);
    const tr = active.closest("tr");
    if (tr) {
      const next = tr.nextElementSibling;
      if (next) {
        const nextShortcut = next.querySelector(".shortcut");
        if (nextShortcut) nextShortcut.focus();
      }
    }
  }
}, true);

// ----- init -----
document.addEventListener("DOMContentLoaded", loadAndRender);
