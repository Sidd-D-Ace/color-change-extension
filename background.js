// background.js (MV2 event page) - KeySight
//# sourceURL=keysight_script.js;
const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[KeySight BG] Background loaded.");

// 1. HELPERS

// We simply send the message. If the page hasn't reloaded, we catch the error silently.
function sendMessageToActiveTab(payload) {
  ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0]) return;
    const tabId = tabs[0].id;
    
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

function mouseCaptureOnPage(){
  sendMessageToActiveTab({action: "mouse_capture"});
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

  if (command === "mouse-capture") {
    console.log("[KeySight BG] Mouse Capture Mode ON");
    mouseCaptureOnPage();
    return;
  }
});

ext.runtime && ext.runtime.onInstalled && ext.runtime.onInstalled.addListener(() => {
  console.log('[KeySight BG] Installed/Updated.');
});