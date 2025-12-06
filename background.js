// background.js (MV2 event page) - KeySight
//# sourceURL=keysight_script.js;
const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[KeySight BG] Background loaded.");

// 1. HELPERS
function defaultMappings() {
  const mappings = [];
  for (let i = 1; i <= 10; i++) {
    mappings.push({
      colorName: `Trigger ${i}`,
      selector: "",
      shortcut: ""
    });
  }
  return mappings;
}

function getSettings() {
  try {
    const maybe = ext.storage && ext.storage.sync && ext.storage.sync.get({ mappings: null });
    if (maybe && typeof maybe.then === 'function') {
      return maybe.then(res => {
        return (res && res.mappings) ? res.mappings : defaultMappings();
      }).catch(() => defaultMappings());
    }
    return new Promise((resolve) => {
      ext.storage.sync.get({ mappings: null }, (res) => {
        resolve((res && res.mappings) ? res.mappings : defaultMappings());
      });
    });
  } catch (e) {
    return Promise.resolve(defaultMappings());
  }
}

// ✅ FIXED: This function was commented out, causing a crash.
function commandToIndex(command) {
  const m = command && command.match ? command.match(/^trigger-(\d+)$/) : null;
  if (!m) return -1;
  const n = parseInt(m[1], 10);
  return (n >= 1 && n <= 10) ? n - 1 : -1;
}

// ✅ FIXED: Removed "executeScript" injection (The source of the Eval error).
// We now simply send the message. If the page hasn't reloaded, we catch the error silently.
function sendMessageToActiveTab(payload) {
  ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    
    // Attempt to send. If it fails (e.g., page not refreshed), we just log it.
    // We do NOT try to inject the script manually anymore.
    try {
      ext.tabs.sendMessage(tabId, payload, (response) => {
        if (ext.runtime.lastError) {
          console.log("[KeySight] Script not ready. User may need to refresh page.");
        }
      });
    } catch (e) {
      console.log("[KeySight] Send failed:", e);
    }
  });
}

function openSettingsOverlayOnPage() {
  sendMessageToActiveTab({ action: "toggle_overlay" });
}

function quickCaptureOnPage(){
  sendMessageToActiveTab({ action: "quick_capture" });
}


// 2. COMMAND LISTENER
ext.commands && ext.commands.onCommand.addListener((command) => {
  
  if (command === "open-settings") {
    console.log("[KeySight BG] Opening settings overlay");
    openSettingsOverlayOnPage();
    return;
  }

  if (command === "quick-capture") {
    console.log("[KeySight BG] Quick Capture Mode ON");
    quickCaptureOnPage();
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