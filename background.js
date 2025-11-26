// background.js (MV2 event page) - Shortcut Trigger
// Handles keyboard commands and storage retrieval.

const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[Shortcut Trigger BG] Background loaded.");

// ---- Helpers ----
// Note: colorName is preserved for internal accessibility labels in the popup
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
        // delivered successfully
        return;
      }
      // If failed, content script might not be there. Inject it.
      // console.warn('[BG] Content script missing, injecting...');

      try {
        ext.tabs.executeScript(tabId, { file: 'content_script.js' }, () => {
          if (ext.runtime && ext.runtime.lastError) {
            console.warn('[BG] Injection failed:', ext.runtime.lastError.message);
            return;
          }
          // Retry sending after injection
          try {
            ext.tabs.sendMessage(tabId, payload, (res2) => {
              /* ignore secondary errors */
            });
          } catch (e2) { /* ignore */ }
        });
      } catch (iex) { /* ignore */ }
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

function openSettingsOverlayOnPage() {
  try {
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return;
      const tabId = tabs[0].id;
      
      // Send toggle message
      try {
        const maybe = ext.tabs.sendMessage(tabId, { action: "toggle_overlay" });
        if (maybe && typeof maybe.then === "function") {
          maybe.catch(() => {});
        }
      } catch (e) {
        try {
          ext.tabs.sendMessage(tabId, { action: "toggle_overlay" }).catch(()=>{});
        } catch (_) {}
      }
    });
  } catch (err) {
    console.warn('[BG] openSettingsOverlayOnPage error:', err && err.message);
  }
}


// ---- Main command listener ----
ext.commands && ext.commands.onCommand.addListener((command) => {
  
  if (command === "open-settings") {
    console.log("[BG] Opening settings overlay");
    openSettingsOverlayOnPage();
    return;
  }

  const idx = commandToIndex(command);
  if (idx === -1) return;

  console.log("[BG] Command Trigger:", idx + 1);

  getSettings().then((mappings) => {
    const map = mappings[idx] || {};
    const payload = {
      action: "trigger",
      index: idx, // Content script uses this for "First/Second" announcement
      colorName: map.colorName || "",
      selector: map.selector || null,
      from: "background"
    };

    sendMessageToActiveTab(payload);
  }).catch((err) => {
    console.error('[BG] Error reading settings:', err && err.message);
  });
});

ext.runtime && ext.runtime.onInstalled && ext.runtime.onInstalled.addListener(() => {
  console.log('[Shortcut Trigger BG] Extension installed/updated.');
});