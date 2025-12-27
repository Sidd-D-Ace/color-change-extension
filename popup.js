/* popup.js - KeySight: Internationalization (I18N) */
const ext = (typeof chrome !== 'undefined') ? chrome : browser;

// DOM references
let rowsContainer, resetBtn, helpBtn, readAllBtn, error, addBtn, title, pickerBtn, langSelect;

let __ct_isClicking = false;
let isDeleting = false; 
let currentHostname = "Global"; 
let currentData = [];
let currentLang = "en"; // Default

/* --------------------------------------------------------------------------
   1. TRANSLATION DICTIONARY
   -------------------------------------------------------------------------- */
const TRANSLATIONS = {
  en: {
    desc: "Manage your triggers",
    btn_read: "🔊 Read All",
    btn_pick: "Pick Element on Page",
    lbl_quick: "Quick Capture",
    lbl_mouse: "Mouse Capture",
    lbl_open: "Open Settings",
    col_trigger: "Trigger",
    col_shortcut: "Shortcut",
    btn_add: "+ Add New",
    btn_reset: "Clear All",
    btn_help: "Help",
    ph_selector: "CSS Selector",
    ph_key: "Set Key",
    ph_name: "Name this trigger",
    msg_saved: "Saved",
    msg_deleted: "Trigger deleted",
    msg_cleared: "All settings cleared",
    msg_confirm_del: "Delete Trigger",
    msg_confirm_clear: "Delete all settings for"
  },
  hi: {
    desc: "अपने ट्रिगर प्रबंधित करें",
    btn_read: "🔊 सभी पढ़ें",
    btn_pick: "पेज पर एलिमेंट चुनें",
    lbl_quick: "क्विक कैप्चर",
    lbl_mouse: "माउस कैप्चर",
    lbl_open: "सेटिंग्स खोलें",
    col_trigger: "ट्रिगर",
    col_shortcut: "शॉर्टकट",
    btn_add: "+ नया जोड़ें",
    btn_reset: "सभी हटाएं",
    btn_help: "मदद",
    ph_selector: "CSS सेलेक्टर",
    ph_key: "बटन सेट करें",
    ph_name: "नाम दर्ज करें",
    msg_saved: "सुरक्षित किया गया",
    msg_deleted: "ट्रिगर हटाया गया",
    msg_cleared: "सभी सेटिंग्स हटा दी गईं",
    msg_confirm_del: "क्या आप इसे हटाना चाहते हैं",
    msg_confirm_clear: "इस साइट की सभी सेटिंग्स हटाएं"
  },
  mr: {
    desc: "आपले ट्रिगर्स व्यवस्थापित करा",
    btn_read: "🔊 सर्व वाचा",
    btn_pick: "घटक निवडा",
    lbl_quick: "क्विक कॅप्चर",
    lbl_mouse: "माउस कॅप्चर",
    lbl_open: "सेटिंग्ज उघडा",
    col_trigger: "ट्रिगर",
    col_shortcut: "शॉर्टकट",
    btn_add: "+ नवीन जोडा",
    btn_reset: "सर्व साफ करा",
    btn_help: "मदत",
    ph_selector: "CSS निवडक",
    ph_key: "बटण सेट करा",
    ph_name: "या ट्रिगरला नाव द्या",
    msg_saved: "जतन केले",
    msg_deleted: "ट्रिगर हटवला",
    msg_cleared: "सर्व सेटिंग्ज साफ केल्या",
    msg_confirm_del: "ट्रिगर हटवायचा का",
    msg_confirm_clear: "या साइटवरील सर्व सेटिंग्ज हटवा"
  },
  ml: {
    desc: "ട്രിഗറുകൾ നിയന്ത്രിക്കുക",
    btn_read: "🔊 എല്ലാം വായിക്കുക",
    btn_pick: "പേജിൽ നിന്ന് തിരഞ്ഞെടുക്കുക",
    lbl_quick: "ക്വിക്ക് ക്യാപ്‌ചർ",
    lbl_mouse: "മൗസ് ക്യാപ്‌ചർ",
    lbl_open: "ക്രമീകരണങ്ങൾ",
    col_trigger: "ട്രിഗർ",
    col_shortcut: "ഷോർട്ട്കട്ട്",
    btn_add: "+ പുതിയത് ചേർക്കുക",
    btn_reset: "എല്ലാം മായ്ക്കുക",
    btn_help: "സഹായം",
    ph_selector: "CSS സെലക്ടർ",
    ph_key: "കീ സെറ്റ് ചെയ്യുക",
    ph_name: "പേര് നൽകുക",
    msg_saved: "സേവ് ചെയ്തു",
    msg_deleted: "നീക്കം ചെയ്തു",
    msg_cleared: "എല്ലാം മായ്ച്ചു",
    msg_confirm_del: "നീക്കം ചെയ്യണോ",
    msg_confirm_clear: "എല്ലാ ക്രമീകരണങ്ങളും നീക്കം ചെയ്യണോ"
  }
};

/* --------------------------------------------------------------------------
   2. INITIALIZATION & LISTENERS
   -------------------------------------------------------------------------- */
window.addEventListener('mousedown', () => { __ct_isClicking = true; }, true);
window.addEventListener('mouseup', () => { setTimeout(() => { __ct_isClicking = false; }, 100); }, true);

document.addEventListener('DOMContentLoaded', () => {
  window.speechSynthesis.cancel(); 

  // Init Refs
  rowsContainer = document.getElementById('rows');
  resetBtn = document.getElementById('resetBtn');
  helpBtn = document.getElementById('helpShortcuts');
  readAllBtn = document.getElementById('readAllBtn');
  error = document.getElementById('error');
  addBtn = document.getElementById('addBtn');
  title = document.getElementById('title');
  pickerBtn = document.getElementById('pickerBtn');
  langSelect = document.getElementById('langSelect');

  loadSystemShortcuts();

  // Load Language Preference
  ext.storage.sync.get(['ks_lang'], (res) => {
      currentLang = res.ks_lang || 'en';
      if(langSelect) {
          langSelect.value = currentLang;
          applyLanguage(currentLang);
      }
      // Load Data AFTER language is set so placeholders are correct
      loadMappings((mappings) => renderRows(mappings));
  });

  // Language Change Listener
  if(langSelect) {
      langSelect.addEventListener('change', (e) => {
          currentLang = e.target.value;
          ext.storage.sync.set({ ks_lang: currentLang });
          applyLanguage(currentLang);
          // Re-render rows to update placeholders inside the table
          renderRows(currentData); 
      });
  }

  // ... (Rest of listeners remain the same) ...
  const a11yStart = document.getElementById('a11y-start');
  if (a11yStart) {
      requestAnimationFrame(() => setTimeout(() => a11yStart.focus(), 200));
  }

  if (pickerBtn) {
      pickerBtn.addEventListener('click', () => {
          if (ext.tabs && ext.tabs.query) {
              ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                  if (tabs && tabs[0]) {
                      ext.tabs.sendMessage(tabs[0].id, { action: "mouse_capture" }, () => window.close());
                  } else { window.close(); }
              });
          }
      });
  }

  if (readAllBtn) readAllBtn.addEventListener('click', readAllShortcuts);

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      const txt = TRANSLATIONS[currentLang];
      if(confirm(`${txt.msg_confirm_clear} ${currentHostname}?`)) {
         isDeleting = true; 
         try {
             currentData = [];
             renderRows([]);
             await saveMappings([]); 
             showStatus(txt.msg_cleared, "saved");
             if(a11yStart) a11yStart.focus();
         } finally { isDeleting = false; }
      }
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      // Just a simple help alert, can be localized if needed
      alert(`KeySight Help:\n\n1. "Picker" selects elements.\n2. Click Shortcut box to record.\n3. Use Alt+Shift+C for Quick Capture.`);
    });
  }

  if (rowsContainer) {
    rowsContainer.addEventListener("click", async (event) => {
      const btn = event.target.closest('.deleteBtn');
      if(btn){
        const visualIndex = parseInt(btn.value);
        const txt = TRANSLATIONS[currentLang];
        if(confirm(`${txt.msg_confirm_del} ${visualIndex + 1}?`)){
          await deleteRow(visualIndex);
          showStatus(txt.msg_deleted, "saved");
          if(addBtn) addBtn.focus(); 
        } else { isDeleting = false; }
      } 
    });
  }

  if (addBtn) addBtn.addEventListener('click', addNewRow);
});

/* --------------------------------------------------------------------------
   3. LANGUAGE LOGIC
   -------------------------------------------------------------------------- */
function applyLanguage(lang) {
    const dict = TRANSLATIONS[lang] || TRANSLATIONS['en'];
    
    // Update all static text with data-i18n attribute
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (dict[key]) el.textContent = dict[key];
    });

    // Update Dropdown itself? (Optional, kept native names in HTML)
}

/* --------------------------------------------------------------------------
   (KEEP EXISTING FUNCTIONS: defaultMappings, getStorageKey, performAutoSave, loadSystemShortcuts)
   -------------------------------------------------------------------------- */
function defaultMappings() { return []; }
function getStorageKey() { return "keysight_" + currentHostname; }

async function performAutoSave() {
  if (isDeleting) return; 
  const mappings = collectRows();
  if (error) error.classList.remove('visible');
  const ok = await saveMappings(mappings);
  if (ok) {
    currentData = mappings; 
    showStatus(TRANSLATIONS[currentLang].msg_saved, "saved");
  } else {
    showStatus("Error saving", "error");
  }
}

function loadSystemShortcuts() {
  if (!ext.commands || !ext.commands.getAll) return;
  ext.commands.getAll((commands) => {
    const map = { "quick-capture": "key-quick", "mouse-capture": "key-mouse", "_execute_action": "key-open" };
    commands.forEach((cmd) => {
      const elId = map[cmd.name];
      if (elId) {
        const el = document.getElementById(elId);
        if (el) {
          el.textContent = cmd.shortcut || "Not Set";
          if (!cmd.shortcut) {
             el.style.color = "#999"; el.style.fontWeight = "400"; el.style.fontStyle = "italic";
          }
        }
      }
    });
  });
}

/* --------------------------------------------------------------------------
   RENDERING (Updated with Translation Placeholders)
   -------------------------------------------------------------------------- */
function getDisplayName(mapping) {
  if (mapping.customName) return mapping.customName;
  if (mapping.fingerprint && mapping.fingerprint.ariaLabel) return mapping.fingerprint.ariaLabel;
  // Use translated placeholder name
  return TRANSLATIONS[currentLang].ph_name;
}

function buildRow(index, mapping) {
  const dict = TRANSLATIONS[currentLang];
  const tr = document.createElement('tr');
  tr.className = 'row-card'; 
  tr.dataset.index = index;
  
  const tdIndex = document.createElement('td');
  tdIndex.className = 'col-index';
  tdIndex.textContent = index + 1;
  tr.appendChild(tdIndex);

  const tdMain = document.createElement('td');
  tdMain.className = 'col-main';
  
  const nameRow = document.createElement('div');
  nameRow.className = 'name-row';
  
  const nameText = document.createElement('span');
  nameText.className = 'trigger-name';
  const displayName = getDisplayName(mapping);
  nameText.textContent = displayName;
  if (displayName === dict.ph_name) nameText.classList.add('placeholder');

  const editIcon = document.createElement('button');
  editIcon.className = 'icon-btn edit-btn';
  editIcon.innerHTML = '✎';
  editIcon.title = "Rename";
  editIcon.onclick = () => enableNameEditing(nameRow, mapping, index);

  nameRow.appendChild(nameText);
  nameRow.appendChild(editIcon);
  tdMain.appendChild(nameRow);

  const inputsRow = document.createElement('div');
  inputsRow.className = 'inputs-row';

  const selectorInput = document.createElement('input');
  selectorInput.type = 'text';
  selectorInput.className = 'selector';
  selectorInput.value = mapping.selector || '';
  selectorInput.placeholder = dict.ph_selector; 
  selectorInput.addEventListener('change', performAutoSave);
  
  const shortcutInput = document.createElement('input');
  shortcutInput.type = 'text';
  shortcutInput.className = 'shortcut';
  shortcutInput.readOnly = true;
  shortcutInput.value = mapping.shortcut || '';
  shortcutInput.placeholder = dict.ph_key;
  shortcutInput.setAttribute('aria-label', `Shortcut`);

  inputsRow.appendChild(selectorInput);
  inputsRow.appendChild(shortcutInput);
  tdMain.appendChild(inputsRow);

  tr.appendChild(tdMain);

  const tdDelete = document.createElement('td');
  tdDelete.className = 'col-delete';
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.innerText = '×'; 
  deleteBtn.className = 'deleteBtn';
  deleteBtn.value = index; 
  deleteBtn.setAttribute('aria-label', `Delete`);
  deleteBtn.addEventListener('mousedown', () => { isDeleting = true; });

  tdDelete.appendChild(deleteBtn);
  tr.appendChild(tdDelete);

  return tr;
}

function enableNameEditing(container, mapping, index) {
  container.innerHTML = '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'name-edit-input';
  input.value = mapping.customName || (mapping.fingerprint?.ariaLabel || "");
  input.placeholder = TRANSLATIONS[currentLang].ph_name;
  
  const saveName = () => {
    const newName = input.value.trim();
    currentData[index].customName = newName; 
    performAutoSave().then(() => renderRows(currentData));
  };

  input.addEventListener('blur', saveName);
  input.addEventListener('keydown', (e) => {
    if(e.key === 'Enter') { e.preventDefault(); input.blur(); }
  });

  container.appendChild(input);
  input.focus();
}

// ... (Rest of functions: renderRows, addNewRow, deleteRow, collectRows, readAllShortcuts, speakText, startRecordingOn, stopRecordingOn, attachRecorders, enableShortcutInput, updateInputDisplay, saveMappings, showStatus, loadMappings, fetchStorage) ...
// KEEP THEM EXACTLY AS THEY WERE IN PREVIOUS VERSION, they don't need changes except 'showStatus' usage inside them (which I updated above in performAutoSave).

// RE-PASTING THE REST TO BE SAFE:

function renderRows(mappings) {
  if (!rowsContainer) return;
  rowsContainer.innerHTML = '';
  currentData = mappings || []; 
  currentData.forEach((map, i) => {
    const safeMap = map || { selector: '', shortcut: '', entryType: 'manual'};
    rowsContainer.appendChild(buildRow(i, safeMap));
  });
  attachRecorders();
}

function addNewRow(){
  const currentMappings = collectRows();
  const newRow = { customName: "", selector: '', shortcut: '', entryType: 'manual', fingerprint: null };
  currentMappings.push(newRow);
  currentData = currentMappings; 
  renderRows(currentData);
  saveMappings(currentData); 
}

async function deleteRow(index){
  try {
    isDeleting = true; 
    const currentMappings = collectRows();
    currentMappings.splice(index, 1);
    currentData = currentMappings;
    renderRows(currentData);
    await saveMappings(currentData);
  } catch (e) {
    showStatus("Error: " + (e.message || "Delete failed"), "error");
  } finally {
    setTimeout(() => { isDeleting = false; }, 50);
  }
}

function collectRows() {
  if (!rowsContainer) return [];
  try {
      return Array.from(rowsContainer.querySelectorAll('tr')).map((tr, i) => {
        const existing = currentData[i] || {};
        const selEl = tr.querySelector('.selector');
        const scEl = tr.querySelector('.shortcut');
        return {
          ...existing, 
          selector: selEl ? selEl.value.trim() : (existing.selector || ""),
          shortcut: scEl ? scEl.value.trim() : (existing.shortcut || "")
        };
      });
  } catch(e) { return currentData; }
}

function readAllShortcuts() {
  if (currentData.length === 0) {
    speakText("No shortcuts configured.");
    return;
  }
  const textParts = ["Shortcuts:"];
  currentData.forEach((map, i) => {
    const name = getDisplayName(map);
    const keys = map.shortcut ? map.shortcut.split('+').join(' ') : "no key";
    textParts.push(`Trigger ${i+1}: ${name}, ${keys}.`);
  });
  speakText(textParts.join(" "));
}

function speakText(text) {
  window.speechSynthesis.cancel(); 
  const utterance = new SpeechSynthesisUtterance(text);
  // Optional: Set voice language based on currentLang
  if (currentLang === 'hi') utterance.lang = 'hi-IN';
  if (currentLang === 'mr') utterance.lang = 'mr-IN';
  if (currentLang === 'ml') utterance.lang = 'ml-IN';
  window.speechSynthesis.speak(utterance);
}

function startRecordingOn(input) {
  if (!input) return;
  delete input.dataset.skipFocus;
  input.dataset.recording = '1';
  input._previousValue = input.value;
  input.value = '...';
  input.classList.add('recording');
  try { input.focus(); } catch (e) {}
}

function stopRecordingOn(input, save) {
  if (!input) return;
  delete input.dataset.recording;
  input.classList.remove('recording');
  if (!save && input._previousValue !== undefined) input.value = input._previousValue;
  delete input.dataset.activatedByEnter; 
  if (save) performAutoSave();
}

function attachRecorders() {
    document.querySelectorAll('input.shortcut').forEach(input => enableShortcutInput(input));
}

function enableShortcutInput(input) {
  if (!input || input._attached) return;
  input._attached = true;
  input.readOnly = true;
  input.autocomplete = 'off';

  input.addEventListener('focus', () => {
    if (input.dataset.skipFocus === '1') { delete input.dataset.skipFocus; return; }
    if (__ct_isClicking) startRecordingOn(input);
  });
  input.addEventListener('click', () => { if (!input.dataset.recording) startRecordingOn(input); });
  input.addEventListener('blur', () => { if (input.dataset.recording) stopRecordingOn(input, true); });
  
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') return; 
    e.preventDefault(); e.stopPropagation();
    if (input.dataset.recording !== '1') startRecordingOn(input);
    updateInputDisplay(input, e);
  });
}

function updateInputDisplay(input, e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let main = '';
  if (/^Digit\d$/.test(e.code)) main = e.code.slice(5); 
  else if (/^Numpad\d$/.test(e.code)) main = e.code.slice(6); 
  else if (/^Key[A-Z]$/.test(e.code)) main = e.code.slice(3); 
  else if (/^F\d{1,2}$/.test(e.code)) main = e.code; 
  else if (['Enter', 'Space', 'Tab', 'Backspace', 'Delete', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape'].includes(e.code)) {
      main = e.code.replace('Arrow', ''); 
  } else {
      const codeMap = { 'Backquote': '`', 'Minus': '-', 'Equal': '=', 'BracketLeft': '[', 'BracketRight': ']', 'Backslash': '\\', 'Semicolon': ';', 'Quote': "'", 'Comma': ',', 'Period': '.', 'Slash': '/' };
      main = codeMap[e.code] || e.key.toUpperCase();
      if(['CONTROL','ALT','SHIFT','META'].includes(main)) main = '';
  }

  if (main) parts.push(main);
  input.value = parts.join('+');

  if (main) {
      stopRecordingOn(input, true); 
      input.blur(); 
  }
}

function saveMappings(mappings) {
  return new Promise((resolve) => {
    try {
      const key = getStorageKey();
      const payload = {};
      payload[key] = mappings;
      ext.storage.sync.set(payload, () => resolve(!ext.runtime.lastError));
    } catch(e) { resolve(false); }
  });
}

function showStatus(msg, type = 'info') {
  if (type === 'error') {
    if (error) { error.textContent = msg; error.classList.add('visible'); }
  } else { 
    if (error) error.classList.remove('visible');
    if (type === 'saved') {
       const savedEl = document.querySelector('.saved-notice');
       if (savedEl) {
         savedEl.textContent = msg || "Saved"; // Use Msg if passed
         savedEl.classList.add('visible');
         setTimeout(() => savedEl.classList.remove('visible'), 1500);
       }
    }
  }
}

function loadMappings(cb) {
  const params = new URLSearchParams(window.location.search);
  const paramHost = params.get('hostname');
  if (paramHost) {
    currentHostname = paramHost;
    fetchStorage(cb);
  } else {
    if (ext.tabs && ext.tabs.query) {
      ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
           if (!ext.runtime.lastError && tabs && tabs[0] && tabs[0].url) {
             try { currentHostname = new URL(tabs[0].url).hostname; } catch(e) { currentHostname = "Global"; }
           }
           fetchStorage(cb);
      });
    } else {
      currentHostname = "Global";
      fetchStorage(cb);
    }
  }
}

function fetchStorage(cb) {
    if (title) title.innerText = `KeySight: ${currentHostname}`;
    const key = getStorageKey();
    if (ext.storage && ext.storage.sync) {
      ext.storage.sync.get(key, (res) => {
        const data = (res && res[key] && Array.isArray(res[key])) ? res[key] : [];
        cb(data);
      });
    } else { cb([]); }
}

ext.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    const key = getStorageKey();
    if (changes[key]) renderRows(changes[key].newValue || []);
  }
});