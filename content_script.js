/* content_script.js - KeySight: Shortcuts + Settings Overlay */
const ext = (typeof browser !== "undefined") ? browser : chrome;
let isRecordingState=false; //quick capture mode

// --- GUARD: Prevent double-injection ---
if (window.hasKeySightRun) {
  throw new Error("KeySight content script already exists"); 
}
window.hasKeySightRun = true;

console.log("[KeySight] Content script loaded.");

let storedMappings = [];
let quickCaptureParts = [];


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

window.addEventListener('keyup', (e)=>{
  if(isRecordingState && quickCaptureParts.length>0){
  isRecordingState=false; 
  const currentCombo = quickCaptureParts.join("+").toLowerCase();
  storedMappings[(storedMappings.length)-1].shortcut = currentCombo;
  saveMappings(storedMappings);
  quickCaptureParts=[];
  return;
  }
  if(storedMappings.length>0){
  if (!isRecordingState && storedMappings[(storedMappings.length)-1].shortcut==='' && storedMappings[(storedMappings.length)-1].entryType === 'quick-capture'){
    console.log("Recording Again");
    isRecordingState = true;
  }
}
})

window.addEventListener("keydown", (e) => {
  // Ignore typing in text boxes
  const tag = (e.target.tagName || "");
  if (["INPUT","TEXTAREA","SELECT"].includes(tag) || e.target.isContentEditable) return;
  console.log(isRecordingState);
  if(isRecordingState){
    const mainKey = getKeyName(e);
    if (!mainKey) return;
    let parts=[];
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
    if (!map || map.shortcut === '') continue;

    if (currentCombo === map.shortcut.toLowerCase()) {
      e.preventDefault();
      e.stopPropagation();
      // Pass index for ordinal announcement
      announceAction("Shortcut Already Exist! Try Again");
      console.log("Shortcut Exists.");
      isRecordingState=false;
      quickCaptureParts=[];
      return;
    }
  }
  joinParts(parts);

  // storedMappings[(storedMappings.length)-1].shortcut = currentCombo;
  //   saveMappings(storedMappings);
  //   isRecordingState=false;
  //   return;

  }

  const mainKey = getKeyName(e);
  if (!mainKey) return;
  let parts=[];
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
        // const ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];
        // let name = "Shortcut";

        // if (typeof payload.index === 'number' && payload.index >= 0 && payload.index < ordinals.length) {
        //    name = `${ordinals[payload.index]} shortcut`;
        // } else if (payload.colorName) {
        //    name = payload.colorName; 
        // }

        announceAction(`Shortcut triggered`);
        return;
      }
    } catch (e) {}
  }
}

let lastAnnouncedMessage = "";

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
  
  if (window.announcerSetupTimeout) clearTimeout(window.announcerSetupTimeout);
  if (window.announcerCleanupTimeout) clearTimeout(window.announcerCleanupTimeout);

  if (msg === lastAnnouncedMessage) {
    msg = msg + "\u00A0"; 
  }
  
  // Update the tracker
  lastAnnouncedMessage = msg;

  annDiv.textContent = "";
  window.announcerSetupTimeout = setTimeout(() => { 
    annDiv.textContent = msg; 
    
    // 5. Schedule the cleanup
    window.announcerCleanupTimeout = setTimeout(() => { 
      annDiv.textContent = ""; 
    }, 1000); // Increased to 1s to ensure it's finished reading before clearing
  }, 100);

}

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.action) return;

  if (message.action === "trigger") {
    triggerFromPayload(message);
  }
  if (message.action === "toggle_overlay") {
    console.log("toggle overlay intercept");
    toggleOverlay();
  }
  if (message.action === "quick_capture") {
    console.log("Quick Capture intercept");
    performQuickCapture()
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
  console.log("Entered toggleOverlay function");
  const c = document.getElementById(OVERLAY_ID);
  if (c && c.style.display === 'block') hideOverlay();
  else showOverlay();
}

// Quick Capture
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function performQuickCapture(){
  const target=document.activeElement;
  announceAction("Quick Capture Mode On.");
  
  await delay(1500);
  
  console.log(target);
  if (target) {
    if(!(target.id==="")){
      const newId = quickCaptureNormalize(target.id,type='id');
      if(quickCaptureCheck(newId)){
        alert("Trigger Already Exists.");
        return;
      }
      const newQuickCapture={selector : newId, shortcut : '', entryType: 'quick-capture'};
      refreshMappings();
      storedMappings.push(newQuickCapture)
      console.log(storedMappings);
      await saveMappings(storedMappings);
      announceAction("Triggered Selected, please press a shortcut combination.");
      isRecordingState=true;
      return;
    }
    if (!(target.className==="")) {
      const newClass = quickCaptureNormalize(target.className,type='class');
      console.log(newClass);
      if(await quickCaptureCheck(newClass)){
        alert("Trigger Already Exists.");
        return;
      }
      const newQuickCapture = {selector :  newClass,shortcut : '', entryType: 'quick-capture'};
      refreshMappings();
      storedMappings.push(newQuickCapture)

      await saveMappings(storedMappings);
      announceAction("Triggered Selected, please press a shortcut combination.");
      
      isRecordingState=true;
      return;
    }
    if (!(target.ariaLabel==="" || target.ariaLabel===null)) {
      // const newAriaLabel = quickCaptureNormalize(target.ariaLabel);
      const newAriaLabel = target.ariaLabel;
      if(quickCaptureCheck(newAriaLabel)){
        alert("Trigger Already Exists.");
        return;
      }
      const newQuickCapture = {selector : newAriaLabel, shortcut: '', entryType: 'quick-capture'};
      refreshMappings();
      storedMappings.push(newQuickCapture)
      console.log(storedMappings);
      announceAction("Triggered Selected, please press a shortcut combination.");
      isRecordingState=true;
      console.log(newQuickCapture);
      return;
    }
  }
}

function quickCaptureNormalize(input, type) {
  if (type === 'id') {
    return `[id="${input}"]`;
  }
  
  if (type === 'class') {
    const classes = input.trim().split(/\s+/);

    // 1. Exact matches (Generic)
    const exactIgnored = [
      'focus', 'focused', 'onfocused', 'active', 'selected', 'hover', 
      'is-focused', 'focus-visible', 'keyboard-focused', 'visibly-focused',
      'cdk-focused', 'cdk-program-focused', 'cdk-mouse-focused', 'cdk-keyboard-focused'
    ];

    // 2. Pattern Matching (The smart part)
    // This catches "anything-focused", "anything-active", "ng-touched", etc.
    const ignoredPatterns = [
      /[-_]focused$/i,      // Matches cdk-focused, mat-focused, program-focused
      /[-_]active$/i,       // Matches is-active, router-link-active
      /^ng-touched$/i,      // Angular form states
      /^ng-dirty$/i,
      /^ng-pristine$/i,
      /^ng-valid$/i,
      /^ng-invalid$/i
    ];

    const cleanClasses = classes.filter(cls => {
      // Check Exact List
      if (exactIgnored.includes(cls)) return false;
      
      // Check Regex Patterns
      // If ANY pattern matches the class, we filter it out (return false)
      if (ignoredPatterns.some(regex => regex.test(cls))) return false;

      return true;
    });

    // Fallback: If we accidentally filtered EVERYTHING (unlikely), revert to original
    if (cleanClasses.length === 0) {
       // Only return the original if it's not empty, otherwise return a universal fallback
       return '.' + input.trim().replace(/\s+/g, '.');
    }

    return '.' + cleanClasses.join('.');
  }
  
  return input;
}

async function quickCaptureCheck(input){
  refreshMappings();
  let newStoredMappings=[...storedMappings];
  for(let i=0; i<=storedMappings.length; i++){
    const map = storedMappings[i];
    if(!map || map.selector==='') continue;
    if(input === map.selector){
      if(map.shortcut !== ''){
        console.log('Returning true');
        return true;
      }

      else if(map.shortcut === ''){
      newStoredMappings = storedMappings.filter(item=>item.selector !== input);
      break;
    }
    }
    
  }
  console.log(newStoredMappings);
  await saveMappings(newStoredMappings);
  return false;
}

function quickCaptureRecord(){
  return 0;
}

function joinParts(parts,e){
  quickCaptureParts=[...parts];
}

function saveMappings(mappings) {
  return new Promise((resolve) => {
    try {
      ext.storage.sync.set({ mappings }, () => {
        const success = !ext.runtime.lastError;
        // if (success && Notification.permission === "granted") {
        //     // Only attempt to show notification if permission is already given
        //     const newNotification = new Notification("Saved Successfully."); 
        //     setTimeout(()=>{newNotification.close()},2000);
        // }
        if(success) announceAction('Saved successfully');
        resolve(success);
      });
    } catch(e) { resolve(false); }
});
}