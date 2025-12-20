/* content_script.js - KeySight: Shortcuts + Settings Overlay (MV3 Compatible) */

const ext = (typeof browser !== "undefined") ? browser : chrome;

// --- STATE VARIABLES ---
let isRecordingState = false;
let isMouseMode = false;
let capturedElement = null; // Element waiting for shortcut assignment
let currentHighlightedElement = null; // Element currently hovered in mouse mode
let storedMappings = [];
let quickCaptureParts = [];

// --- GUARD: Prevent double-injection ---
if (window.hasKeySightRun) {
  // throw new Error("KeySight content script already exists"); 
} else {
  window.hasKeySightRun = true;
  console.log("[KeySight] Content script loaded.");
}

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
   2. KEYBOARD LISTENERS
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
  // Handle finalizing the shortcut recording
  if (isRecordingState && quickCaptureParts.length > 0) {
    isRecordingState = false;
    const currentCombo = quickCaptureParts.join("+").toLowerCase();

    // Save to the last entry
    if (storedMappings.length > 0) {
      const lastIndex = storedMappings.length - 1;
      if (storedMappings[lastIndex].entryType === 'quick-capture') {
        storedMappings[lastIndex].shortcut = currentCombo;
        saveMappings(storedMappings);
      }
    }

    quickCaptureParts = [];

    // Clean up visual cues
    if (capturedElement) {
      capturedElement.style.border = "";
      capturedElement.style.outline = "";
      capturedElement = null;
    }
    
    // Clean up mouse mode cursor if it was left on
    if (isMouseMode) {
        disableMouseMode();
    }

    showStatusDialog(`Saved: ${currentCombo}`, 2000);
    return;
  }
});

window.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "");
  // Ignore typing in text inputs unless we are specifically recording a shortcut
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

  // --- RECORDING STATE ---
  if (isRecordingState) {
    e.preventDefault();
    e.stopPropagation();

    // Check for duplicates
    for (let i = 0; i < storedMappings.length; i++) {
      const map = storedMappings[i];
      if (!map || map.shortcut === '') continue;
      // Skip the item currently being edited (last one)
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

  // --- SHORTCUT COMMANDS ---
  
  // Alt + C : Keyboard Quick Capture
  if (e.altKey && mainKey === "C" && !isMouseMode) {
    e.preventDefault();
    performQuickCapture();
    return;
  }

  // Alt + M : Mouse Capture Mode
  if (e.altKey && mainKey === "M") {
    e.preventDefault();
    performMouseCapture();
    return;
  }

  // Escape : Cancel Mouse Mode
  if (isMouseMode && e.key === "Escape") {
    disableMouseMode();
    showStatusDialog("Mouse Capture Cancelled", 2000);
    return;
  }

  // --- TRIGGER MODE ---
  if (isMouseMode) return; // Don't trigger while selecting

  const currentComboLower = combo.toLowerCase();
  for (let i = 0; i < storedMappings.length; i++) {
    const map = storedMappings[i];
    if (!map || !map.shortcut) continue;

    if (currentComboLower === map.shortcut.toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      triggerFromPayload({ ...map, index: i });
      return;
    }
  }
}, true);

/* ==========================================================================
   3. MOUSE LISTENERS (For Mouse Capture Mode)
   ========================================================================== */
document.addEventListener("mouseover", (e) => {
  if (!isMouseMode) return;
  e.stopPropagation();

  // Don't re-apply if it's the same element
  if (currentHighlightedElement === e.target) return;
  if (e.target === document.body || e.target === document.documentElement) return;

  // Clear previous
  if (currentHighlightedElement) {
    currentHighlightedElement.style.outline = "";
  }

  // Highlight new
  e.target.style.outline = "4px solid #fc0303";
  currentHighlightedElement = e.target;
});

document.addEventListener("mouseout", (e) => {
  if (!isMouseMode) return;
  if (e.target) {
    e.target.style.outline = "";
  }
});

document.addEventListener("click", (e) => {
  if (!isMouseMode) return;
  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();

  const target = e.target;
  
  // Clean up visual highlight immediately
  if(currentHighlightedElement) {
      currentHighlightedElement.style.outline = "";
      currentHighlightedElement = null;
  }

  // Handle the capture
  mouseCaptureHandler(target);
}, true);

/* ==========================================================================
   4. CAPTURE LOGIC (Shared)
   ========================================================================== */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function performMouseCapture() {
  if (isMouseMode) {
    disableMouseMode();
    return;
  }
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

// Handler for when Mouse Mode is used
async function mouseCaptureHandler(target) {
  // Turn off mouse mode logic
  isMouseMode = false;
  document.body.style.cursor = 'auto';
  
  // Hand over to the selector logic
  await selectorHandler(target);
}

// Handler for Keyboard (Alt+C)
async function performQuickCapture() {
  const target = document.activeElement;
  if (!target || target === document.body) {
    showStatusDialog("No element selected. Tab to a button first.", 3000);
    return;
  }

  // Visual feedback for keyboard users
  target.style.border = "thick solid #fc0303";
  showStatusDialog("Quick Capture ON: Analyzing...", 0);
  
  await delay(1000);
  await selectorHandler(target);
}

// Core Selector Processing
async function selectorHandler(target) {
  if (!target) return;

  // Track this element to clear styles later
  capturedElement = target;
  
  // Ensure it looks selected (useful for both mouse/keyboard paths)
  target.style.border = "thick solid #fc0303"; 

  // 1. ID Check
  if (target.id) {
    const newId = quickCaptureNormalize(target.id, 'id');
    if (await quickCaptureCheck(newId)) {
      showStatusDialog("Trigger Already Exists.", 3000);
      target.style.border = "";
      return;
    }
    await saveNewTrigger(newId);
    return;
  }

  // 2. Class Check
  if (target.className && typeof target.className === 'string' && target.className.trim() !== "") {
    const newClass = quickCaptureNormalize(target.className, 'class');
    if (await quickCaptureCheck(newClass)) {
      showStatusDialog("Trigger Already Exists.", 3000);
      target.style.border = "";
      return;
    }
    await saveNewTrigger(newClass);
    return;
  }

  // 3. Aria Label Check
  if (target.getAttribute('aria-label')) {
    const newSelector = `[aria-label="${target.getAttribute('aria-label')}"]`;
    if (await quickCaptureCheck(newSelector)) {
      showStatusDialog("Trigger Already Exists.", 3000);
      target.style.border = "";
      return;
    }
    await saveNewTrigger(newSelector);
    return;
  }

  // Fallback
  showStatusDialog("Could not capture element (No ID/Class).", 3000);
  target.style.border = "";
  target.style.outline = "";
}

async function saveNewTrigger(selector) {
  const newQuickCapture = { selector: selector, shortcut: '', entryType: 'quick-capture' };

  refreshMappings(); // Ensure local cache is somewhat fresh
  storedMappings.push(newQuickCapture);
  
  await saveMappings(storedMappings);
  
  showStatusDialog("Element Captured. Press shortcut keys now...", 0);
  isRecordingState = true;
}

/* ==========================================================================
   5. HELPERS & UTILS
   ========================================================================== */
function quickCaptureNormalize(input, type) {
  if (type === 'id') return `[id="${input}"]`;

  if (type === 'class') {
    const classes = input.trim().split(/\s+/);
    const exactIgnored = ['focus', 'focused', 'active', 'selected', 'hover', 'visibly-focused'];
    const ignoredPatterns = [/[-_]focused$/i, /[-_]active$/i, /^ng-/i];

    const cleanClasses = classes.filter(cls => {
      if (exactIgnored.includes(cls)) return false;
      if (ignoredPatterns.some(regex => regex.test(cls))) return false;
      return true;
    });

    if (cleanClasses.length === 0) return '.' + input.trim().replace(/\s+/g, '.');
    return '.' + cleanClasses.join('.');
  }
  return input;
}

async function quickCaptureCheck(input) {
  // Fetch fresh from storage to be safe
  const freshMappings = await new Promise((resolve) => {
    ext.storage.sync.get({ mappings: null }, (res) => {
      resolve(res.mappings || []);
    });
  });

  storedMappings = freshMappings;
  let newStoredMappings = [...storedMappings];
  let foundDuplicate = false;

  for (let i = 0; i < storedMappings.length; i++) {
    const map = storedMappings[i];
    if (!map || map.selector === '') continue;

    if (input === map.selector) {
      if (map.shortcut !== '') {
        foundDuplicate = true;
      } else {
        // If selector exists but NO shortcut (stale capture), remove it
        newStoredMappings = newStoredMappings.filter(item => item.selector !== input);
      }
    }
  }

  if (!foundDuplicate && newStoredMappings.length !== storedMappings.length) {
    await saveMappings(newStoredMappings);
    storedMappings = newStoredMappings;
  }

  return foundDuplicate;
}

function joinParts(parts) {
  quickCaptureParts = [...parts];
}

function saveMappings(mappings) {
  return new Promise((resolve) => {
    try {
      ext.storage.sync.set({ mappings }, () => {
        const success = !ext.runtime.lastError;
        resolve(success);
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
      fontSize: '20px', fontWeight: '600', textAlign: 'center',
      pointerEvents: 'none', transition: 'opacity 0.2s'
    });
    dialog.setAttribute('role', 'alert');
    dialog.setAttribute('aria-live', 'assertive');
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
  if (dialog) {
    dialog.style.opacity = '0';
    setTimeout(() => { dialog.style.display = 'none'; }, 200);
  }
}

/* ==========================================================================
   6. UI OVERLAY & MESSAGING
   ========================================================================== */
function triggerFromPayload(payload) {
  if (payload.selector) {
    try {
      const el = document.querySelector(payload.selector);
      if (el) {
        el.click();
        return;
      }
    } catch (e) {}
  }
}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;
  if (message.action === "trigger") triggerFromPayload(message);
  if (message.action === "toggle_overlay") toggleOverlay();
  if (message.action === "quick_capture") performQuickCapture();
});

// --- SETTINGS OVERLAY UI ---
const OVERLAY_ID = 'z-webkeybind-overlay';
const IFRAME_ID = 'z-webkeybind-iframe';

function createOverlay() {
  if (document.getElementById(OVERLAY_ID)) { showOverlay(); return; }
  const style = document.createElement('style');
  style.textContent = `#${OVERLAY_ID} { position: fixed; left: 50%; top: 10%; transform: translateX(-50%); width: 700px; max-width: 95%; height: 560px; z-index: 2147483647; box-shadow: 0 10px 40px rgba(0,0,0,0.5); border-radius: 8px; overflow: hidden; background: white; display: none; } .zwb-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2147483646; display: none; } .zwb-frame { width: 100%; height: 100%; border: 0; } .zwb-close { position: absolute; right: 10px; top: 10px; background: #000000; color: #ffffff; border: 1px solid #ccc; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-family: sans-serif; font-size: 13px; font-weight: bold; z-index: 2147483648; }`;
  document.head.appendChild(style);
  
  const backdrop = document.createElement('div');
  backdrop.className = 'zwb-backdrop';
  backdrop.onclick = hideOverlay;
  
  const container = document.createElement('div');
  container.id = OVERLAY_ID;
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  container.setAttribute('aria-label', 'z.WebKeyBind Settings');
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'zwb-close';
  closeBtn.innerText = 'Close';
  closeBtn.onclick = hideOverlay;
  
  const iframe = document.createElement('iframe');
  iframe.className = 'zwb-frame';
  iframe.id = IFRAME_ID;
  iframe.src = ext.runtime.getURL('popup.html');
  
  container.appendChild(closeBtn);
  container.appendChild(iframe);
  document.body.appendChild(backdrop);
  document.body.appendChild(container);
  
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && container.style.display !== 'none') hideOverlay();
  });
  
  showOverlay();
}

function showOverlay() {
  const c = document.getElementById(OVERLAY_ID);
  const b = document.querySelector('.zwb-backdrop');
  if (c && b) {
    c.style.display = 'block';
    b.style.display = 'block';
    setTimeout(() => {
        const iframe = document.getElementById(IFRAME_ID);
        if (iframe) { iframe.focus(); try { iframe.contentWindow.focus(); } catch(e){} }
    }, 150);
  } else { createOverlay(); }
}

function hideOverlay() {
  const c = document.getElementById(OVERLAY_ID);
  const b = document.querySelector('.zwb-backdrop');
  if (c) c.style.display = 'none';
  if (b) b.style.display = 'none';
  if (document.activeElement) document.activeElement.blur();
}

function toggleOverlay() {
  const c = document.getElementById(OVERLAY_ID);
  if (c && c.style.display === 'block') hideOverlay(); else showOverlay();
}

window.addEventListener("load", () => {
  // Prevent screen reader from reading the first button on load
  if (document.activeElement && document.activeElement.tagName === "BUTTON") {
    document.activeElement.blur();
  }
});