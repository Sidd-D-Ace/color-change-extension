/* popup.js - KeySight: Bulletproof Focus */
const ext = (typeof chrome !== 'undefined') ? chrome : browser;

// DOM references
let rowsContainer;
let resetBtn;
let helpBtn;
let readAllBtn;
let error;
let addBtn;
let title;

let __ct_isClicking = false;
let currentHostname = "Global"; 
let currentData = [];

window.addEventListener('mousedown', () => { __ct_isClicking = true; }, true);
window.addEventListener('mouseup', () => { setTimeout(() => { __ct_isClicking = false; }, 100); }, true);

/* --------------------------------------------------------------------------
   DEFAULTS & STORAGE
   -------------------------------------------------------------------------- */
function defaultMappings() { return []; }
function getStorageKey() { return "keysight_" + currentHostname; }

async function performAutoSave() {
  const mappings = collectRows();
  if (error) error.classList.remove('visible');
  const ok = await saveMappings(mappings);
  if (ok) {
    currentData = mappings; 
    showStatus("Saved", "saved");
  } else {
    showStatus("Error saving settings", "error");
  }
}

/* --------------------------------------------------------------------------
   RENDERING
   -------------------------------------------------------------------------- */
function getDisplayName(mapping) {
  if (mapping.customName) return mapping.customName;
  if (mapping.fingerprint && mapping.fingerprint.ariaLabel) return mapping.fingerprint.ariaLabel;
  return "Name this trigger";
}

function buildRow(index, mapping) {
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
  if (displayName === "Name this trigger") nameText.classList.add('placeholder');

  const editIcon = document.createElement('button');
  editIcon.className = 'icon-btn edit-btn';
  editIcon.innerHTML = '✎';
  editIcon.title = "Rename trigger";
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
  selectorInput.placeholder = "CSS Selector"; 
  selectorInput.addEventListener('change', performAutoSave);
  
  const shortcutInput = document.createElement('input');
  shortcutInput.type = 'text';
  shortcutInput.className = 'shortcut';
  shortcutInput.readOnly = true;
  shortcutInput.value = mapping.shortcut || '';
  shortcutInput.placeholder = "Set Key";
  shortcutInput.setAttribute('aria-label', `Shortcut for ${displayName}`);

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
  deleteBtn.setAttribute('aria-label', `Delete trigger ${index + 1}`);
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
  input.placeholder = "Enter name...";
  
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
  const newRow = { 
      customName: "",
      selector: '', 
      shortcut: '', 
      entryType: 'manual',
      fingerprint: null
  };
  currentMappings.push(newRow);
  
  currentData = currentMappings; 
  renderRows(currentData);
  saveMappings(currentData); 
}

function deleteRow(index){
  const currentMappings = collectRows();
  currentMappings.splice(index, 1);
  currentData = currentMappings;
  renderRows(currentData);
  saveMappings(currentData);
}

function collectRows() {
  if (!rowsContainer) return [];
  return Array.from(rowsContainer.querySelectorAll('tr')).map((tr, i) => {
    const existing = currentData[i] || {};
    return {
      ...existing, 
      selector: tr.querySelector('.selector').value.trim(),
      shortcut: tr.querySelector('.shortcut').value.trim()
    };
  });
}

/* --------------------------------------------------------------------------
   VOICE FEATURE
   -------------------------------------------------------------------------- */
function readAllShortcuts() {
  if (currentData.length === 0) {
    speakText("No shortcuts configured.");
    return;
  }
  const textParts = ["Here are your shortcuts."];
  currentData.forEach((map, i) => {
    const name = getDisplayName(map);
    const keys = map.shortcut ? map.shortcut.split('+').join(' ') : "no key set";
    textParts.push(`Trigger ${i+1}: ${name}, using ${keys}.`);
  });
  speakText(textParts.join(" "));
}

function speakText(text) {
  window.speechSynthesis.cancel(); 
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.0;
  window.speechSynthesis.speak(utterance);
}

/* --------------------------------------------------------------------------
   SHORTCUT RECORDER
   -------------------------------------------------------------------------- */
function startRecordingOn(input) {
  if (!input) return;
  delete input.dataset.skipFocus;
  input.dataset.recording = '1';
  input._previousValue = input.value;
  input.value = 'Press keys...';
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
    if (input.dataset.recording === '1') return;
    if (e.key === 'Tab') return;
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    if (e.key === 'Enter') {
      e.preventDefault(); e.stopPropagation();
      input.dataset.activatedByEnter = '1';
      startRecordingOn(input);
      return;
    }
    e.preventDefault();
    startRecordingOn(input);
    updateInputDisplay(input, e);
  });
}

function updateInputDisplay(input, e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  let main = e.code.replace(/^(Key|Digit|Numpad)/, '');
  if(e.key.length === 1) main = e.key.toUpperCase();
  if (!['Control','Alt','Shift','Meta'].includes(e.key)) parts.push(main);
  input.value = parts.join('+');
}

/* --------------------------------------------------------------------------
   STORAGE & UTILS
   -------------------------------------------------------------------------- */
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
         savedEl.textContent = "Saved";
         savedEl.classList.add('visible');
         setTimeout(() => savedEl.classList.remove('visible'), 1500);
       }
    }
  }
}

// --- INIT ---
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

document.addEventListener('DOMContentLoaded', () => {
  window.speechSynthesis.cancel(); // Stop old audio

  rowsContainer = document.getElementById('rows');
  resetBtn = document.getElementById('resetBtn');
  helpBtn = document.getElementById('helpShortcuts');
  readAllBtn = document.getElementById('readAllBtn');
  error = document.getElementById('error');
  addBtn = document.getElementById('addBtn');
  title = document.getElementById('title');

  // --- FOCUS STRATEGY: Target the Hidden Button ---
  const a11yStart = document.getElementById('a11y-start');
  if (a11yStart) {
      // Use requestAnimationFrame to ensure painting is done
      requestAnimationFrame(() => {
          setTimeout(() => {
              a11yStart.focus();
          }, 200); // 200ms delay to catch slow renderers
      });
  }

  loadMappings((mappings) => { renderRows(mappings); });

  if (readAllBtn) readAllBtn.addEventListener('click', readAllShortcuts);

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if(confirm("Delete all settings for " + currentHostname + "?")) {
         currentData = [];
         renderRows([]);
         await saveMappings([]); 
         showStatus("All settings cleared", "saved");
         if(a11yStart) a11yStart.focus();
      }
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      alert(`KeySight Help:\n\n1. "Read All" hears your triggers.\n2. Click Pencil to rename.\n3. Click Shortcut box to record.`);
    });
  }

  if (rowsContainer) {
    rowsContainer.addEventListener("click", async (event) => {
      const btn = event.target.closest('.deleteBtn');
      if(btn){
        const visualIndex = parseInt(btn.value);
        if(confirm(`Delete Trigger ${visualIndex + 1}?`)){
          deleteRow(visualIndex);
          showStatus("Trigger deleted", "saved");
          if(addBtn) addBtn.focus(); 
        }
      } 
    });
  }

  if (addBtn) addBtn.addEventListener('click', addNewRow);
});