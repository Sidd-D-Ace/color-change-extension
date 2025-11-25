// background.js (MV3 service worker) - fixed and robust
const ext = (typeof browser !== "undefined") ? browser : chrome;

console.log('[SW] background service worker loaded');

// helper: safe storage.get that returns a Promise (works with chrome or browser)
function storageGet(keyObj) {
  return new Promise((resolve) => {
    try {
      ext.storage.sync.get(keyObj, (res) => {
        // callback-style API; res may be undefined in some envs
        resolve(res || {});
      });
    } catch (e) {
      // fallback / defensive
      resolve({});
    }
  });
}

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

// get settings mappings (returns Promise resolving to array)
function getSettings() {
  return storageGet({ mappings: null }).then((res) => {
    return (res && res.mappings) ? res.mappings : defaultMappings();
  });
}

// helper to send message to active tab using callback-style API
function sendMessageToActiveTab(message) {
  try {
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) {
        console.warn('[SW] No active tab found to send message to.');
        return;
      }
      const tabId = tabs[0].id;
      // sendMessage may accept a callback or return a Promise; handle both
      try {
        const res = ext.tabs.sendMessage(tabId, message, (cbRes) => {
          // If callback-based, errors surface as runtime.lastError
          if (ext.runtime && ext.runtime.lastError) {
            console.warn('[SW] sendMessage callback reported error:', ext.runtime.lastError.message);
          } else {
            console.log('[SW] sendMessage callback done:', cbRes);
          }
        });
        // If it returned a Promise (browser.*), attach catch
        if (res && typeof res.then === 'function') {
          res.then(() => console.log('[SW] sendMessage promise resolved')).catch((err) => {
            console.warn('[SW] sendMessage promise rejected:', err && err.message);
          });
        }
      } catch (err) {
        console.warn('[SW] sendMessage threw:', err && err.message);
      }
    });
  } catch (err) {
    console.warn('[SW] tabs.query threw:', err && err.message);
  }
}

// Map command name to index (0..9)
function commandToIndex(command) {
  const m = command && command.match ? command.match(/^trigger-(\d+)$/) : null;
  if (!m) return -1;
  const n = parseInt(m[1], 10);
  return n >= 1 && n <= 10 ? n - 1 : -1;
}

ext.commands && ext.commands.onCommand.addListener((command) => {
  try {
    console.log('[SW] onCommand received:', command);
    const idx = commandToIndex(command);
    if (idx === -1) {
      console.warn('[SW] unknown command:', command);
      return;
    }

    // fetch mappings and send payload to active tab
    getSettings().then((mappings) => {
      const map = mappings[idx] || {};
      const payload = {
        action: "trigger",
        index: idx,
        colorName: map.colorName || "",
        selector: map.selector || null,
        from: "background"
      };
      console.log('[SW] sending payload to active tab:', payload);
      sendMessageToActiveTab(payload);
    }).catch((err) => {
      console.error('[SW] error reading settings:', err && err.message);
    });
  } catch (err) {
    console.error('[SW] onCommand handler threw:', err && err.message);
  }
});

// optional: log onInstalled to help debugging
ext.runtime && ext.runtime.onInstalled && ext.runtime.onInstalled.addListener(() => {
  console.log('[SW] runtime.onInstalled fired');
});
