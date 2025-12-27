/* background.js - KeySight: Robust Messaging */
const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[KeySight BG] Background Service Started.");

// 1. ROBUST SEND MESSAGE
function sendMessageToActiveTab(payload) {
  // 'lastFocusedWindow' is more reliable than 'currentWindow' for background scripts
  ext.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    
    // Check if we can talk to the tab
    ext.tabs.sendMessage(tabId, payload, () => {
      // If error (e.g. restricted page like chrome://), suppress it to keep console clean
      if (ext.runtime.lastError) {
        console.log("[KeySight] Cannot run on this page (Restricted or Not Loaded).");
      }
    });
  });
}

// 2. COMMAND LISTENER
if (ext.commands) {
  ext.commands.onCommand.addListener((command) => {
    console.log("[KeySight BG] Command received:", command);

    if (command === "quick-capture") {
      sendMessageToActiveTab({ action: "quick_capture" });
    }
    if (command === "mouse-capture") {
      sendMessageToActiveTab({ action: "mouse_capture" });
    }
  });
}