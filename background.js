// background.js (MV2 event page) - KeySight
// Handles keyboard commands and storage retrieval.

const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[KeySight BG] Background loaded.");

// ---- Helpers ----
// UPDATED: Removed specific colors. Now uses generic "Trigger" names and empty selectors.
function defaultMappings() {
  const mappings = [];
  for (let i = 1; i <= 10; i++) {
    mappings.push({
      colorName: `Trigger ${i}`, // Generic name
      selector: "",              // Blank by default
      shortcut: ""               // Blank by default
    });
  }
  return mappings;
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
      try {
        ext.tabs.executeScript(tabId, { file: 'content_script.js' }, () => {
          if (ext.runtime && ext.runtime.lastError) {
            console.warn('[KeySight BG] Injection failed:', ext.runtime.lastError.message);
            return;
          }
          // Retry sending after injection
          try {
            ext.tabs.sendMessage(tabId, payload, (res2) => {});
          } catch (e2) { /* ignore */ }
        });
      } catch (iex) { /* ignore */ }
    });
  } catch (e) {
    console.warn('[KeySight BG] sendMessage threw:', e && e.message);
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
    console.warn('[KeySight BG] openSettingsOverlayOnPage error:', err && err.message);
  }
}


// ---- Main command listener ----
ext.commands && ext.commands.onCommand.addListener((command) => {
  
  if (command === "open-settings") {
    console.log("[KeySight BG] Opening settings overlay");
    openSettingsOverlayOnPage();
    return;
  }

  const idx = commandToIndex(command);
  if (idx === -1) return;

  console.log("[KeySight BG] Trigger:", idx + 1);

  getSettings().then((mappings) => {
    const map = mappings[idx] || {};
    const payload = {
      action: "trigger",
      index: idx, 
      colorName: map.colorName || "",
      selector: map.selector || null,
      from: "background"
    };

    sendMessageToActiveTab(payload);
  }).catch((err) => {
    console.error('[KeySight BG] Error reading settings:', err && err.message);
  });
});

ext.runtime && ext.runtime.onInstalled && ext.runtime.onInstalled.addListener(() => {
  console.log('[KeySight BG] Installed/Updated.');
});