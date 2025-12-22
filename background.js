// background.js (MV2 event page) - KeySight
const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log("[KeySight BG] Background loaded.");

// 1. HELPERS
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

function quickCaptureOnPage(){
  sendMessageToActiveTab({ action: "quick_capture" });
}

function mouseCaptureOnPage(){
  sendMessageToActiveTab({action: "mouse_capture"});
}

// 2. COMMAND LISTENER
ext.commands && ext.commands.onCommand.addListener((command) => {
  
  // NOTE: "open-settings" is handled natively via _execute_browser_action in manifest

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