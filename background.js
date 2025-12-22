// background.js (MV3 Service Worker) - KeySight

// In MV3 Service Workers, 'window' is undefined, so we check for 'chrome' vs 'browser' directly.
const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[KeySight BG] Service Worker loaded.");

// 1. HELPERS
function sendMessageToActiveTab(payload) {
  ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    
    // In MV3, we don't need a callback for sendMessage if we don't use the response,
    // but handling the promise/callback prevents "Unchecked runtime.lastError" in logs.
    try {
      ext.tabs.sendMessage(tabId, payload, () => {
        if (ext.runtime.lastError) {
          // Tab probably hasn't loaded the content script yet (e.g. new tab page)
          // We suppress the error to keep the console clean.
        }
      });
    } catch (e) {
      console.log("[KeySight] Send failed:", e);
    }
  });
}

function quickCaptureOnPage(){
  sendMessageToActiveTab({ action: "quick_capture" });
}

function mouseCaptureOnPage(){
  sendMessageToActiveTab({ action: "mouse_capture" });
}

// 2. COMMAND LISTENER
if (ext.commands) {
  ext.commands.onCommand.addListener((command) => {
    
    // Note: "_execute_action" is handled natively by the browser.
    
    if (command === "quick-capture") {
      console.log("[KeySight BG] Quick Capture");
      quickCaptureOnPage();
    }

    if (command === "mouse-capture") {
      console.log("[KeySight BG] Mouse Capture");
      mouseCaptureOnPage();
    }
  });
}

// 3. INSTALL LISTENER
if (ext.runtime && ext.runtime.onInstalled) {
  ext.runtime.onInstalled.addListener(() => {
    console.log('[KeySight BG] Installed/Updated.');
  });
}