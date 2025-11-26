/* content_script.js - KeySight: Shortcuts + Settings Overlay */
const ext = (typeof browser !== "undefined") ? browser : chrome;

// --- GUARD: Prevent double-injection ---
if (window.hasKeySightRun) {
  throw new Error("KeySight content script already exists"); 
}
window.hasKeySightRun = true;

console.log("[KeySight] Content script loaded.");

let storedMappings = [];

/* ==========================================================================
   1. STORAGE HANDLING
   ========================================================================== */
function refreshMappings() {
  ext.storage.sync.get({ mappings: null }, (res) => {
    storedMappings = res.mappings || [];
  });
}
refreshMappings();

ext.storage.onChanged.addListener((changes) => {
  if (changes.mappings) storedMappings = changes.mappings.newValue || [];
});


/* ==========================================================================
   2. KEYBOARD LISTENER
   ========================================================================== */
function getKeyName(e) {
  if (e.code) {
    if (/^Digit\d$/i.test(e.code)) return e.code.slice(-1);
    if (/^Numpad\d$/i.test(e.code)) return e.code.slice(-1);
    if (/^Key[A-Z]$/i.test(e.code)) return e.code.slice(-1).toUpperCase();
    if (/^F\d{1,2}$/i.test(e.code)) return e.code.toUpperCase();
  }
  return e.key ? e.key.toUpperCase() : "";
}

window.addEventListener("keydown", (e) => {
  // Ignore typing in text boxes
  const tag = (e.target.tagName || "");
  if (["INPUT","TEXTAREA","SELECT"].includes(tag) || e.target.isContentEditable) return;

  const mainKey = getKeyName(e);
  if (!mainKey) return;

  const parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");
  
  if (!["CTRL","ALT","SHIFT","META"].includes(mainKey.toUpperCase())) {
    parts.push(mainKey);
  }

  const currentCombo = parts.join("+").toLowerCase();

  for (let i = 0; i < storedMappings.length; i++) {
    const map = storedMappings[i];
    if (!map || !map.shortcut) continue;

    if (currentCombo === map.shortcut.toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      // Pass index for ordinal announcement
      triggerFromPayload({ ...map, index: i });
      return;
    }
  }
}, true);


/* ==========================================================================
   3. TRIGGER LOGIC (With Ordinal Announcement)
   ========================================================================== */
function triggerFromPayload(payload) {
  if (payload.selector) {
    try {
      const el = document.querySelector(payload.selector);
      if (el) {
        el.click();
        
        // Announce "First shortcut triggered", "Second shortcut triggered", etc.
        const ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
        let name = "Shortcut";

        if (typeof payload.index === 'number' && payload.index >= 0 && payload.index < ordinals.length) {
           name = `${ordinals[payload.index]} shortcut`;
        } else if (payload.colorName) {
           name = payload.colorName; 
        }

        announceAction(`${name} triggered`);
        return;
      }
    } catch (e) {}
  }
}

function announceAction(msg) {
  let annDiv = document.getElementById('ks-action-announcer');
  if (!annDiv) {
    annDiv = document.createElement('div');
    annDiv.id = 'ks-action-announcer';
    annDiv.setAttribute('aria-live', 'assertive');
    annDiv.setAttribute('role', 'status');
    Object.assign(annDiv.style, {
      position: 'fixed', left: '-9999px', top: '-9999px',
      width: '1px', height: '1px', overflow: 'hidden'
    });
    document.body.appendChild(annDiv);
  }
  
  annDiv.textContent = "";
  setTimeout(() => { annDiv.textContent = msg; }, 50);
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;

  if (message.action === "trigger") {
    triggerFromPayload(message);
  }
  if (message.action === "toggle_overlay") {
    toggleOverlay();
  }
});


/* ==========================================================================
   4. PAGE LOAD FOCUS RESET
   ========================================================================== */
window.addEventListener("load", () => {
  // Blur button focus on load to prevent screen reader skipping the header
  if (document.activeElement && document.activeElement.tagName === "BUTTON") {
    document.activeElement.blur();
  }
});


/* ==========================================================================
   5. KEYSIGHT SETTINGS OVERLAY UI
   ========================================================================== */
const OVERLAY_ID = 'keysight-overlay';
const IFRAME_ID = 'keysight-iframe';

function createOverlay() {
  if (document.getElementById(OVERLAY_ID)) {
    showOverlay();
    return;
  }

  const style = document.createElement('style');
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed; left: 50%; top: 10%; transform: translateX(-50%);
      width: 700px; max-width: 95%; height: 560px;
      z-index: 2147483647; box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      border-radius: 8px; overflow: hidden; background: white; display: none;
    }
    .ks-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.5);
      z-index: 2147483646; display: none;
    }
    .ks-frame { width: 100%; height: 100%; border: 0; }
    .ks-close {
      position: absolute; right: 10px; top: 10px;
      background: #000000; color: #ffffff;
      border: 1px solid #ccc;
      padding: 5px 10px; border-radius: 4px; cursor: pointer;
      font-family: sans-serif; font-size: 13px; font-weight: bold;
      z-index: 2147483648;
    }
  `;
  document.head.appendChild(style);

  const backdrop = document.createElement('div');
  backdrop.className = 'ks-backdrop';
  backdrop.onclick = hideOverlay;

  const container = document.createElement('div');
  container.id = OVERLAY_ID;
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  container.setAttribute('aria-label', 'KeySight Settings');

  const closeBtn = document.createElement('button');
  closeBtn.className = 'ks-close';
  closeBtn.innerText = 'Close';
  closeBtn.setAttribute('aria-label', 'Close KeySight settings');
  closeBtn.onclick = hideOverlay;

  const iframe = document.createElement('iframe');
  iframe.className = 'ks-frame';
  iframe.id = IFRAME_ID;
  iframe.src = ext.runtime.getURL('popup.html');

  container.appendChild(closeBtn);
  container.appendChild(iframe);
  document.body.appendChild(backdrop);
  document.body.appendChild(container);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && container.style.display !== 'none') {
      hideOverlay();
    }
  });

  showOverlay();
}

function showOverlay() {
  const c = document.getElementById(OVERLAY_ID);
  const b = document.querySelector('.ks-backdrop');
  if (c && b) {
    c.style.display = 'block';
    b.style.display = 'block';
    
    setTimeout(() => {
        const iframe = document.getElementById(IFRAME_ID);
        if (iframe) {
            iframe.focus();
            try { iframe.contentWindow.focus(); } catch(e){}
        }
    }, 150);
  } else {
    createOverlay();
  }
}

function hideOverlay() {
  const c = document.getElementById(OVERLAY_ID);
  const b = document.querySelector('.ks-backdrop');
  if (c) c.style.display = 'none';
  if (b) b.style.display = 'none';
  if (document.activeElement) document.activeElement.blur();
}

function toggleOverlay() {
  const c = document.getElementById(OVERLAY_ID);
  if (c && c.style.display === 'block') hideOverlay();
  else showOverlay();
}