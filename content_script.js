/* content_script.js - KeySight: Native Popup Edition */

const ext = (typeof browser !== "undefined") ? browser : chrome;

// --- STATE VARIABLES ---
let isRecordingState = false; 
let capturedElement = null; 
let currentHighlightedElement = null;
let isMouseMode = false;
let storedMappings = [];
let quickCaptureParts = [];

// --- GUARD ---
if (window.hasKeySightRun) {
} else {
  window.hasKeySightRun = true;
  console.log("[KeySight] Content script loaded.");
}

/* ==========================================================================
   1. STORAGE HANDLING
   ========================================================================== */
function getStorageKey() {
  return "keysight_" + window.location.hostname;
}

function refreshMappings() {
  const key = getStorageKey();
  ext.storage.sync.get(key, (res) => {
    storedMappings = res[key] || [];
  });
}
refreshMappings();

ext.storage.onChanged.addListener((changes) => {
  const key = getStorageKey();
  if (changes[key]) {
    storedMappings = changes[key].newValue || [];
  }
});

/* ==========================================================================
   2. ROBUST ENGINE (Fingerprinting & Healing)
   ========================================================================== */

function generateFingerprint(el) {
    return {
        id: (el.id && !el.id.match(/[0-9a-f]{8}-[0-9a-f]{4}/)) ? el.id : null,
        ariaLabel: el.getAttribute('aria-label') || 
                   (el.parentElement ? el.parentElement.getAttribute('aria-label') : null) || 
                   el.innerText?.substring(0, 30).trim(), 
        className: (typeof el.className === 'string') ? el.className.trim() : null,
        structural: getNthChildSelector(el),
        tagName: el.tagName.toLowerCase()
    };
}

function getNthChildSelector(el) {
    if (!el || !el.parentNode) return null;
    let count = 1;
    let sib = el;
    while ((sib = sib.previousElementSibling)) count++;
    return `${el.tagName.toLowerCase()}:nth-child(${count})`;
}

// SELF-HEALING: Updates storage if fallback was used
function healFingerprint(foundElement, map, index) {
    const newFingerprint = generateFingerprint(foundElement);
    const oldFingerprint = map.fingerprint || {};

    if (oldFingerprint.id !== newFingerprint.id || oldFingerprint.structural !== newFingerprint.structural) {
        console.log("KeySight: Healing broken link...", map.selector);
        
        storedMappings[index].fingerprint = newFingerprint;
        storedMappings[index].selector = newFingerprint.ariaLabel 
            ? `[aria-label="${newFingerprint.ariaLabel}"]` 
            : (newFingerprint.id ? `#${newFingerprint.id}` : newFingerprint.structural);

        saveMappings(storedMappings);
    }
}

function getElementByFingerprint(fp) {
    if (!fp) return null;

    // 1. PRIMARY: Check ARIA Label
    if (fp.ariaLabel) {
        try {
            const el = document.querySelector(`[aria-label="${CSS.escape(fp.ariaLabel)}"]`);
            if (el && isVisible(el)) return el;
        } catch(e) {}
        try {
            const candidates = document.querySelectorAll(`[aria-label*="${CSS.escape(fp.ariaLabel)}"]`);
            for (let el of candidates) { if(isVisible(el)) return el; }
        } catch (e) {}
    }

    // 2. SECONDARY: Check ID
    if (fp.id) {
        const el = document.getElementById(fp.id);
        if (el && isVisible(el)) return el;
    }

    // 3. TERTIARY: Structural
    if (fp.structural) {
        try {
            const candidates = document.querySelectorAll(fp.structural);
            for(let el of candidates) {
                if (fp.className && !el.classList.contains(fp.className.split(' ')[0])) continue;
                if (isVisible(el)) return el;
            }
        } catch (e) {}
    }
    return null;
}

function isVisible(el) {
    return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

function getInteractiveTarget(target) {
    return target.closest('button, a, input, select, textarea, [role="button"], [tabindex]') || target;
}

/* ==========================================================================
   3. KEYBOARD LISTENER (Trigger & Recording)
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

window.addEventListener('keyup', (e) => {
  if (isRecordingState && quickCaptureParts.length > 0) {
    isRecordingState = false;
    const currentCombo = quickCaptureParts.join("+").toLowerCase();

    if (storedMappings.length > 0) {
      const lastIndex = storedMappings.length - 1;
      if (storedMappings[lastIndex].entryType === 'quick-capture') {
        storedMappings[lastIndex].shortcut = currentCombo;
        saveMappings(storedMappings);
      }
    }

    quickCaptureParts = [];
    if (capturedElement) {
      capturedElement.style.border = "";
      capturedElement.style.outline = "";
      capturedElement = null;
    }
    if (isMouseMode) disableMouseMode();

    showStatusDialog(`Saved: ${currentCombo}`, 2000);
    return;
  }
  
  if (storedMappings.length > 0) {
    const lastItem = storedMappings[storedMappings.length - 1];
    if (!isRecordingState && lastItem && lastItem.shortcut === '' && lastItem.entryType === 'quick-capture') {
      isRecordingState = true;
      showStatusDialog("Press keys to record shortcut...", 0); 
    }
  }
});

window.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "");
  if (!isRecordingState && (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || e.target.isContentEditable)) return;

  const mainKey = getKeyName(e);
  if (!mainKey) return;

  let parts = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  if (e.metaKey) parts.push("Meta");

  if (!["CTRL", "ALT", "SHIFT", "META"].includes(mainKey.toUpperCase())) {
    parts.push(mainKey);
  }
  const combo = parts.join("+");

  // RECORDING LOGIC
  if (isRecordingState) {
    e.preventDefault(); e.stopPropagation();
    for (let i = 0; i < storedMappings.length; i++) {
      const map = storedMappings[i];
      if (!map || map.shortcut === '') continue;
      if (i === storedMappings.length - 1 && map.entryType === 'quick-capture') continue;

      if (combo.toLowerCase() === map.shortcut.toLowerCase()) {
        showStatusDialog("Shortcut Already Exists! Try Again.", 2000);
        quickCaptureParts = [];
        return;
      }
    }
    joinParts(parts);
    return;
  }

  // HOTKEYS
  if (e.altKey && mainKey === "C" && !isMouseMode) {
    e.preventDefault(); performQuickCapture(); return;
  }
  if (e.altKey && mainKey === "M") {
    e.preventDefault(); performMouseCapture(); return;
  }
  if (isMouseMode && e.key === "Escape") {
    disableMouseMode(); showStatusDialog("Mouse Capture Cancelled", 2000); return;
  }
  if (isMouseMode) return; 

  // TRIGGER LOGIC
  const currentComboLower = combo.toLowerCase();
  for (let i = 0; i < storedMappings.length; i++) {
    const map = storedMappings[i];
    if (!map || !map.shortcut) continue;

    if (currentComboLower === map.shortcut.toLowerCase()) {
      e.preventDefault(); e.stopPropagation();
      
      const fp = map.fingerprint; 
      
      // 1. Legacy fallback
      if (!fp) {
         try {
             const el = document.querySelector(map.selector);
             if (el) { el.click(); return; }
         } catch(e){}
      }

      // 2. Robust Engine
      const btn = getElementByFingerprint(fp);
      if (btn) {
          btn.click();
          healFingerprint(btn, map, i); 
          return;
      }
      
      showStatusDialog("Element not found.", 2000);
      return;
    }
  }
}, true);

/* ==========================================================================
   4. CAPTURE MODES
   ========================================================================== */
document.addEventListener("mouseover", (e) => {
  if (!isMouseMode) return;
  e.stopPropagation();

  const target = getInteractiveTarget(e.target);

  if (currentHighlightedElement === target) return;
  if (target === document.body || target === document.documentElement) return;

  if (currentHighlightedElement) currentHighlightedElement.style.outline = "";
  
  target.style.outline = "4px solid #fc0303";
  currentHighlightedElement = target;
});

document.addEventListener("mouseout", (e) => {
  if (!isMouseMode) return;
  if (currentHighlightedElement) currentHighlightedElement.style.outline = "";
});

document.addEventListener("click", (e) => {
  if (!isMouseMode) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  
  const target = getInteractiveTarget(e.target);
  
  if(currentHighlightedElement) {
      currentHighlightedElement.style.outline = "";
      currentHighlightedElement = null;
  }
  captureHandler(target);
}, true);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function performMouseCapture() {
  if (isMouseMode) { disableMouseMode(); return; }
  isMouseMode = true;
  document.body.style.cursor = 'crosshair';
  showStatusDialog("Mouse Capture ON. Click an element.", 0);
}

function disableMouseMode() {
  isMouseMode = false;
  document.body.style.cursor = 'auto';
  if (currentHighlightedElement) {
    currentHighlightedElement.style.outline = '';
    currentHighlightedElement = null;
  }
  hideStatusDialog();
}

async function performQuickCapture() {
  const target = document.activeElement;
  if (!target || target === document.body) {
    showStatusDialog("No element selected. Tab to a button first.", 3000);
    return;
  }
  target.style.border = "thick solid #fc0303";
  capturedElement = target; 
  showStatusDialog("Quick Capture ON: Analyzing...", 0);
  await delay(500);
  await captureHandler(target);
}

/* ==========================================================================
   5. SAVING LOGIC
   ========================================================================== */
async function captureHandler(target) {
  if (!target) return;
  capturedElement = target;
  target.style.border = "thick solid #fc0303"; 

  const fingerprint = generateFingerprint(target);

  let displaySelector = target.tagName.toLowerCase();
  if (fingerprint.ariaLabel) displaySelector = `[aria-label="${fingerprint.ariaLabel}"]`;
  else if (fingerprint.id) displaySelector = `#${fingerprint.id}`;
  else if (fingerprint.structural) displaySelector = fingerprint.structural;

  if (await quickCaptureCheck(fingerprint)) {
    showStatusDialog("Trigger Already Exists.", 3000);
    target.style.border = "";
    return;
  }

  const newTrigger = { 
    selector: displaySelector, 
    shortcut: '', 
    entryType: 'quick-capture',
    fingerprint: fingerprint 
  };

  await saveNewTrigger(newTrigger);
}

async function saveNewTrigger(triggerObj) {
  await new Promise(r => {
      const key = getStorageKey();
      ext.storage.sync.get(key, (res) => {
          storedMappings = res[key] || [];
          r();
      });
  });

  storedMappings.push(triggerObj);
  await saveMappings(storedMappings);
  
  showStatusDialog("Element Captured. Press shortcut keys now...", 0);
  isRecordingState = true;
}

// --- UTILS ---
async function quickCaptureCheck(fp) {
  return storedMappings.some(m => {
    if (!m.fingerprint) return false;
    if (fp.id && m.fingerprint.id === fp.id) return true;
    if (fp.ariaLabel && m.fingerprint.ariaLabel === fp.ariaLabel) return true;
    return false;
  });
}

function joinParts(parts) { quickCaptureParts = [...parts]; }

function saveMappings(mappings) {
  return new Promise((resolve) => {
    try {
      const key = getStorageKey();
      const payload = {};
      payload[key] = mappings;
      ext.storage.sync.set(payload, () => {
        resolve(!ext.runtime.lastError);
      });
    } catch (e) { resolve(false); }
  });
}

function showStatusDialog(text, duration = 0) {
  let dialog = document.getElementById('ks-status-dialog');
  if (!dialog) {
    dialog = document.createElement('div');
    dialog.id = 'ks-status-dialog';
    Object.assign(dialog.style, {
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      backgroundColor: '#333', color: '#fff', padding: '12px 24px',
      borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: '2147483647', fontFamily: 'system-ui, sans-serif',
      fontSize: '16px', fontWeight: '600', textAlign: 'center',
      pointerEvents: 'none', transition: 'opacity 0.2s'
    });
    document.body.appendChild(dialog);
  }
  dialog.textContent = text;
  dialog.style.opacity = '1';
  dialog.style.display = 'block';
  if (dialog._timeoutId) clearTimeout(dialog._timeoutId);
  if (duration > 0) {
    dialog._timeoutId = setTimeout(() => {
      dialog.style.opacity = '0';
      setTimeout(() => { dialog.style.display = 'none'; }, 200);
    }, duration);
  }
}
function hideStatusDialog() {
  const dialog = document.getElementById('ks-status-dialog');
  if (dialog) { dialog.style.opacity = '0'; setTimeout(() => { dialog.style.display = 'none'; }, 200); }
}

// --- MESSAGING ---
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;
  // toggle_overlay REMOVED because browser handles it now
  if (message.action === "quick_capture") performQuickCapture();
  if (message.action === "mouse_capture") performMouseCapture();
});