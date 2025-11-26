// background.js (MV2 event page) - patched for Firefox + Chrome
// Includes robust storage getter (handles promise-style and callback-style) and
// auto-inject fallback: if content script isn't present in the active tab, inject it then resend.

// Reference screenshot (local file URL): /mnt/data/3e254837-3328-4c88-a001-fcc36c6a4c0f.png

const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[BG] background loaded (MV2 event page) - patched");

// ---- Helpers ----
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

// Robust settings getter: returns a Promise that resolves to mappings array
function getSettings() {
  try {
    // Call storage.get — might return a Promise (Firefox) or undefined (Chrome)
    const maybe = ext.storage && ext.storage.sync && ext.storage.sync.get({ mappings: null });
    if (maybe && typeof maybe.then === 'function') {
      return maybe.then(res => {
        return (res && res.mappings) ? res.mappings : defaultMappings();
      }).catch(() => defaultMappings());
    }

    // Callback-style (Chrome)
    return new Promise((resolve) => {
      try {
        ext.storage.sync.get({ mappings: null }, (res) => {
          resolve((res && res.mappings) ? res.mappings : defaultMappings());
        });
      } catch (e) {
        resolve(defaultMappings());
      }
    });
  } catch (e) {
    return Promise.resolve(defaultMappings());
  }
}

function commandToIndex(command) {
  const m = command && command.match ? command.match(/^trigger-(\d+)$/) : null;
  if (!m) return -1;
  const n = parseInt(m[1], 10);
  return (n >= 1 && n <= 10) ? n - 1 : -1;
}

// Try sending a message; if content script is missing, inject it then resend (MV2)
function ensureContentScriptAndSend(tabId, payload) {
  try {
    ext.tabs.sendMessage(tabId, payload, (res) => {
      if (!(ext.runtime && ext.runtime.lastError)) {
        // delivered
        return;
      }
      const err = ext.runtime.lastError && ext.runtime.lastError.message;
      console.warn('[BG] initial sendMessage error:', err);

      // Attempt to inject content_script.js (may fail on some pages)
      try {
        ext.tabs.executeScript(tabId, { file: 'content_script.js' }, () => {
          if (ext.runtime && ext.runtime.lastError) {
            console.warn('[BG] executeScript injection failed:', ext.runtime.lastError.message);
            return;
          }
          // After injection, retry send
          try {
            ext.tabs.sendMessage(tabId, payload, (res2) => {
              if (ext.runtime && ext.runtime.lastError) {
                console.warn('[BG] message failed after injection:', ext.runtime.lastError.message);
              }
            });
          } catch (e2) {
            console.warn('[BG] resend threw:', e2 && e2.message);
          }
        });
      } catch (iex) {
        console.warn('[BG] executeScript threw:', iex && iex.message);
      }
    });
  } catch (e) {
    console.warn('[BG] sendMessage threw:', e && e.message);
  }
}

function sendMessageToActiveTab(payload) {
  ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    ensureContentScriptAndSend(tabId, payload);
  });
}
// in background.js: send toggle to active tab
function openSettingsOverlayOnPage() {
  try {
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tabId = tabs[0].id;
      // send a message; handle both callback and promise styles
      try {
        const maybe = ext.tabs.sendMessage(tabId, { action: "toggle_overlay" });
        if (maybe && typeof maybe.then === "function") {
          maybe.catch(() => { /* no-op */ });
        }
      } catch (e) {
        // fallback: try promise form (rare)
        try {
          ext.tabs.sendMessage(tabId, { action: "toggle_overlay" }).catch(()=>{});
        } catch (_) { /* ignore */ }
      }
    });
  } catch (err) {
    console.warn('[BG] openSettingsOverlayOnPage error:', err && err.message);
  }
}




// ---- Main command listener ----
ext.commands && ext.commands.onCommand.addListener((command) => {
  console.log("[BG] command:", command);

if (command === "open-settings") {
  console.log("[BG] open-settings triggered; asking active tab to toggle overlay");
  openSettingsOverlayOnPage();
  return;
}



  // existing trigger logic...

  console.log("[BG] command:", command);

  const idx = commandToIndex(command);
  if (idx === -1) return;

  // getSettings returns a Promise
  getSettings().then((mappings) => {
    const map = mappings[idx] || {};
    const payload = {
      action: "trigger",
      index: idx,
      colorName: map.colorName || "",
      selector: map.selector || null,
      from: "background"
    };

    console.log('[BG] sending payload:', payload);
    sendMessageToActiveTab(payload);
  }).catch((err) => {
    console.error('[BG] error reading settings:', err && err.message);
  });
});

ext.runtime && ext.runtime.onInstalled && ext.runtime.onInstalled.addListener(() => {
  console.log('[BG] Extension installed or updated.');
});
