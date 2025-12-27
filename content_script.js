/* content_script.js - KeySight: Pro UI + Multi-Language */

const ext = (typeof browser !== "undefined") ? browser : chrome;

// --- STATE VARIABLES ---
let isRecordingState = false; 
let capturedElement = null; 
let currentHighlightedElement = null;
let isMouseMode = false;
let storedMappings = [];
let quickCaptureParts = [];
let bannerEl = null;
let removeHoverHighlight = null;
let currentLang = "en"; // Default Language

// --- TRANSLATION DICTIONARY (Content Script Specific) ---
const TRANSLATIONS = {
  en: {
    mouse_on: "Mouse Capture ON • Click an element",
    quick_on: "Quick Capture ON • Tab to button",
    recording: "Recording • Press Shortcut Keys Now...",
    saved: "Saved",
    error: "Error",
    exists: "Shortcut Exists!",
    el_not_found: "Element not found",
    trigger_exists: "Trigger Exists",
    no_el: "No element selected",
    mouse_cancel: "Mouse Capture Cancelled",
    tab_hint: "Tab to a button first",
    press_keys: "Press shortcut keys"
  },
  hi: {
    mouse_on: "माउस कैप्चर चालू • तत्व पर क्लिक करें",
    quick_on: "क्विक कैप्चर चालू • बटन पर टैब करें",
    recording: "रिकॉर्डिंग • अब शॉर्टकट बटन दबाएं...",
    saved: "सुरक्षित किया गया",
    error: "त्रुटि",
    exists: "शॉर्टकट पहले से मौजूद है!",
    el_not_found: "तत्व नहीं मिला",
    trigger_exists: "ट्रिगर पहले से मौजूद है",
    no_el: "कोई तत्व नहीं चुना गया",
    mouse_cancel: "माउस कैप्चर रद्द कर दिया गया",
    tab_hint: "पहले बटन पर टैब करें",
    press_keys: "शॉर्टकट बटन दबाएं"
  },
  mr: {
    mouse_on: "माउस कॅप्चर चालू • घटकावर क्लिक करा",
    quick_on: "क्विक कॅप्चर चालू • बटणावर टॅब करा",
    recording: "रेकॉर्डिंग • आता शॉर्टकट की दाबा...",
    saved: "जतन केले",
    error: "त्रुटी",
    exists: "शॉर्टकट आधीच अस्तित्वात आहे!",
    el_not_found: "घटक सापडला नाही",
    trigger_exists: "ट्रिगर आधीच अस्तित्वात आहे",
    no_el: "कोणताही घटक निवडलेला नाही",
    mouse_cancel: "माउस कॅप्चर रद्द केले",
    tab_hint: "प्रथम बटणावर टॅब करा",
    press_keys: "शॉर्टकट की दाबा"
  },
  ml: {
    mouse_on: "മൗസ് ക്യാപ്‌ചർ ഓൺ • എലമെന്റിൽ ക്ലിക്ക് ചെയ്യുക",
    quick_on: "ക്വിക്ക് ക്യാപ്‌ചർ ഓൺ • ബട്ടണിലേക്ക് ടാബ് ചെയ്യുക",
    recording: "റെക്കോർഡിംഗ് • ഷോർട്ട്കട്ട് കീകൾ അമർത്തുക...",
    saved: "സേവ് ചെയ്തു",
    error: "പിശക്",
    exists: "ഷോർട്ട്കട്ട് നിലവിലുണ്ട്!",
    el_not_found: "എലമെന്റ് കണ്ടെത്തിയില്ല",
    trigger_exists: "ട്രിഗർ നിലവിലുണ്ട്",
    no_el: "എലമെന്റ് തിരഞ്ഞെടുത്തിട്ടില്ല",
    mouse_cancel: "മൗസ് ക്യാപ്‌ചർ റദ്ദാക്കി",
    tab_hint: "ആദ്യം ബട്ടണിലേക്ക് ടാബ് ചെയ്യുക",
    press_keys: "ഷോർട്ട്കട്ട് കീകൾ അമർത്തുക"
  }
};

// Helper to get text
function t(key) {
    const dict = TRANSLATIONS[currentLang] || TRANSLATIONS['en'];
    return dict[key] || key;
}

// --- GUARD ---
if (window.hasKeySightRun) {
} else {
  window.hasKeySightRun = true;
  console.log("[KeySight] Content script loaded.");
}

/* ==========================================================================
   0. VISUALS: BANNER & HIGHLIGHT
   ========================================================================== */

function createBanner() {
    const b = document.createElement('div');
    b.setAttribute('role', 'alert');
    b.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%) translateY(-200%);
        padding: 12px 24px; border-radius: 50px; 
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        background: #333; color: white;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-weight: 600; font-size: 15px; letter-spacing: 0.5px;
        z-index: 2147483647; display: flex; align-items: center; gap: 10px;
        transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        pointer-events: none;
    `;
    document.body.appendChild(b);
    return b;
}

function setBannerState(type, textOverride = "") {
    if (!bannerEl) bannerEl = createBanner();
    
    if (type === 'OFF') {
        bannerEl.style.transform = "translateX(-50%) translateY(-200%)";
        return;
    }

    // Show Banner
    bannerEl.style.transform = "translateX(-50%) translateY(0)";

    if (type === 'MOUSE') {
        bannerEl.style.backgroundColor = "#2980b9"; // Blue
        bannerEl.innerHTML = `<span>🖱️</span><span>${t('mouse_on')}</span>`;
    } else if (type === 'QUICK') {
        bannerEl.style.backgroundColor = "#d93025"; // Red
        bannerEl.innerHTML = `<span>🔴</span><span>${t('quick_on')}</span>`;
    } else if (type === 'RECORDING') {
        bannerEl.style.backgroundColor = "#f39c12"; // Orange
        bannerEl.innerHTML = `<span>⌨️</span><span>${t('recording')}</span>`;
    } else if (type === 'SUCCESS') {
        bannerEl.style.backgroundColor = "#27ae60"; // Green
        bannerEl.innerHTML = `<span>✅</span><span>${textOverride || t('saved')}</span>`;
        setTimeout(() => setBannerState('OFF'), 2000);
    } else if (type === 'ERROR') {
        bannerEl.style.backgroundColor = "#c0392b"; // Dark Red
        bannerEl.innerHTML = `<span>⚠️</span><span>${textOverride || t('error')}</span>`;
        setTimeout(() => setBannerState('OFF'), 3000);
    }
}

function highlight(el, color, duration = 0) {
    if (!el) return null;
    const originalOutline = el.style.outline;
    const originalBoxShadow = el.style.boxShadow;
    const originalTransition = el.style.transition;

    el.style.setProperty('outline', `4px solid ${color}`, 'important');
    el.style.setProperty('box-shadow', `0 0 0 4px ${color}, 0 0 15px ${color}`, 'important');
    el.style.setProperty('transition', 'none', 'important');

    const clear = () => {
        el.style.outline = originalOutline;
        el.style.boxShadow = originalBoxShadow;
        el.style.transition = originalTransition;
    };

    if (duration > 0) {
        setTimeout(clear, duration);
        return null;
    } else {
        return clear;
    }
}

/* ==========================================================================
   1. ACCESSIBILITY ANNOUNCER
   ========================================================================== */
const announcer = document.createElement('div');
announcer.id = 'ks-announcer';
announcer.setAttribute('aria-live', 'assertive');
announcer.setAttribute('role', 'alert');
announcer.style.cssText = 'position:absolute; width:1px; height:1px; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0;';
document.body.appendChild(announcer);

function speak(text) {
    announcer.textContent = ''; 
    setTimeout(() => { announcer.textContent = text; }, 50);
}

/* ==========================================================================
   2. STORAGE HANDLING (UPDATED FOR LANGUAGE)
   ========================================================================== */
function getStorageKey() { return "keysight_" + window.location.hostname; }

function refreshMappings() {
  const key = getStorageKey();
  // Fetch both mappings AND Language preference
  ext.storage.sync.get([key, 'ks_lang'], (res) => { 
      storedMappings = res[key] || []; 
      currentLang = res.ks_lang || 'en'; // Set Global Language
  });
}
refreshMappings();

ext.storage.onChanged.addListener((changes) => {
  const key = getStorageKey();
  if (changes[key]) storedMappings = changes[key].newValue || [];
  
  // Watch for language changes from Popup
  if (changes.ks_lang) {
      currentLang = changes.ks_lang.newValue || 'en';
  }
});

/* ==========================================================================
   3. ROBUST ENGINE (Full Path Generator)
   ========================================================================== */
function generateFullPath(el) {
    if (!el) return "";
    const path = [];
    while (el && el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();
        if (el.id && !el.id.match(/[0-9a-f]{8}-[0-9a-f]{4}/) && !/\d/.test(el.id)) {
            selector += '#' + el.id;
            path.unshift(selector);
            break; 
        } else {
            let sib = el, nth = 1;
            while (sib = sib.previousElementSibling) {
                if (sib.nodeName.toLowerCase() === selector) nth++;
            }
            if (nth > 1) selector += ":nth-of-type("+nth+")";
        }
        path.unshift(selector);
        el = el.parentNode;
    }
    return path.join(" > ");
}

function generateFingerprint(el) {
    return {
        id: (el.id && !el.id.match(/[0-9a-f]{8}-[0-9a-f]{4}/)) ? el.id : null,
        ariaLabel: el.getAttribute('aria-label') || 
                   (el.parentElement ? el.parentElement.getAttribute('aria-label') : null) || 
                   el.innerText?.substring(0, 30).trim(), 
        className: (typeof el.className === 'string') ? el.className.trim() : null,
        structural: generateFullPath(el),
        tagName: el.tagName.toLowerCase()
    };
}

function healFingerprint(foundElement, map, index) {
    const newFingerprint = generateFingerprint(foundElement);
    const oldFingerprint = map.fingerprint || {};

    if (oldFingerprint.id !== newFingerprint.id || oldFingerprint.structural !== newFingerprint.structural) {
        console.log("KeySight: Healing broken link...", map.selector);
        storedMappings[index].fingerprint = newFingerprint;
        storedMappings[index].selector = generateFullPath(foundElement);
        saveMappings(storedMappings);
    }
}

function getElementByFingerprint(fp) {
    if (!fp) return null;
    if (fp.structural) {
        try {
            const el = document.querySelector(fp.structural);
            if (el && isVisible(el)) return el;
        } catch(e) {}
    }
    if (fp.ariaLabel) {
        try {
            const el = document.querySelector(`[aria-label="${CSS.escape(fp.ariaLabel)}"]`);
            if (el && isVisible(el)) return el;
        } catch(e) {}
    }
    if (fp.id) {
        const el = document.getElementById(fp.id);
        if (el && isVisible(el)) return el;
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
   4. KEYBOARD LISTENER
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

// Global KeyUp Listener (For Recording)
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
      if (removeHoverHighlight) removeHoverHighlight();
      removeHoverHighlight = null;
      capturedElement = null;
    }
    if (isMouseMode) disableMouseMode();

    setBannerState('SUCCESS', `${t('saved')}: ${currentCombo}`);
    speak(`${t('saved')} ${currentCombo}`);
    return;
  }
});

// Global KeyDown Listener
window.addEventListener("keydown", (e) => {
  const tag = (e.target.tagName || "");
  
  // Shortcuts
  if (e.altKey && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
     e.preventDefault(); performQuickCapture(); return;
  }
  if (e.altKey && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
     e.preventDefault(); performMouseCapture(); return;
  }
  if (isMouseMode && e.key === "Escape") {
    disableMouseMode(); 
    setBannerState('OFF');
    speak(t('mouse_cancel')); 
    return;
  }
  if (isMouseMode) return; 

  // Recording & Trigger
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

  // RECORDING
  if (isRecordingState) {
    e.preventDefault(); e.stopPropagation();
    for (let i = 0; i < storedMappings.length; i++) {
      const map = storedMappings[i];
      if (!map || map.shortcut === '') continue;
      if (i === storedMappings.length - 1 && map.entryType === 'quick-capture') continue;

      if (combo.toLowerCase() === map.shortcut.toLowerCase()) {
        setBannerState('ERROR', t('exists'));
        speak(t('exists'));
        quickCaptureParts = [];
        return;
      }
    }
    joinParts(parts);
    return;
  }

  // TRIGGER
  const currentComboLower = combo.toLowerCase();
  for (let i = 0; i < storedMappings.length; i++) {
    const map = storedMappings[i];
    if (!map || !map.shortcut) continue;

    if (currentComboLower === map.shortcut.toLowerCase()) {
      e.preventDefault(); e.stopPropagation();
      
      const fp = map.fingerprint; 
      
      try {
           const el = document.querySelector(map.selector);
           if (el && isVisible(el)) { 
               highlight(el, '#2ecc71', 400); 
               el.click(); 
               return; 
           }
      } catch(e){}

      const btn = getElementByFingerprint(fp);
      if (btn) {
          highlight(btn, '#2ecc71', 400); 
          btn.click();
          healFingerprint(btn, map, i); 
          return;
      }
      
      setBannerState('ERROR', t('el_not_found'));
      speak(t('el_not_found'));
      return;
    }
  }
}, true);

/* ==========================================================================
   5. CAPTURE MODES
   ========================================================================== */
document.addEventListener("mouseover", (e) => {
  if (!isMouseMode) return;
  e.stopPropagation();
  const target = getInteractiveTarget(e.target);
  if (currentHighlightedElement === target) return;
  if (target === document.body || target === document.documentElement) return;
  
  if (removeHoverHighlight) removeHoverHighlight();

  currentHighlightedElement = target;
  removeHoverHighlight = highlight(target, '#3498db');
});

document.addEventListener("mouseout", (e) => {
  if (!isMouseMode) return;
});

document.addEventListener("click", (e) => {
  if (!isMouseMode) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  const target = getInteractiveTarget(e.target);
  
  if (removeHoverHighlight) removeHoverHighlight();
  
  disableMouseMode();
  captureHandler(target);
}, true);

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function performMouseCapture() {
  if (isMouseMode) { disableMouseMode(); return; }
  isMouseMode = true;
  document.body.style.cursor = 'crosshair';
  setBannerState('MOUSE'); 
  speak(t('mouse_on'));
}

function disableMouseMode() {
  isMouseMode = false;
  document.body.style.cursor = 'auto';
  if (removeHoverHighlight) removeHoverHighlight();
  removeHoverHighlight = null;
  currentHighlightedElement = null;
  setBannerState('OFF');
}

async function performQuickCapture() {
  const target = document.activeElement;
  if (!target || target === document.body) {
    setBannerState('ERROR', t('no_el'));
    speak(t('tab_hint'));
    return;
  }
  
  removeHoverHighlight = highlight(target, '#f39c12'); 
  capturedElement = target; 
  
  setBannerState('QUICK'); 
  speak(t('quick_on'));
  
  await delay(500);
  await captureHandler(target);
}

/* ==========================================================================
   6. SAVING LOGIC
   ========================================================================== */
async function captureHandler(target) {
  if (!target) return;
  capturedElement = target;
  
  if (removeHoverHighlight) removeHoverHighlight();
  removeHoverHighlight = highlight(target, '#f39c12'); 

  const fingerprint = generateFingerprint(target);
  const fullPathSelector = generateFullPath(target);

  if (await quickCaptureCheck(fingerprint)) {
    setBannerState('ERROR', t('trigger_exists'));
    speak(t('trigger_exists'));
    if (removeHoverHighlight) removeHoverHighlight();
    return;
  }

  const newTrigger = { 
    selector: fullPathSelector, 
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
  
  isRecordingState = true; 
  setBannerState('RECORDING'); 
  speak(t('press_keys'));
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

// --- MESSAGING ---
ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;
  if (message.action === "quick_capture") performQuickCapture();
  if (message.action === "mouse_capture") performMouseCapture();
});