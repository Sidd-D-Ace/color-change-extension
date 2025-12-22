/* popup.js - KeySight: Fixed "Ghost Row" Glitch */
const ext = (typeof chrome !== 'undefined') ? chrome : browser;

// DOM references
let rowsContainer;
let resetBtn;
let helpBtn;
let error;
let addBtn;
let title;

let __ct_isClicking = false;
let currentHostname = "Global"; 

window.addEventListener('mousedown', () => { __ct_isClicking = true; }, true);
window.addEventListener('mouseup', () => { setTimeout(() => { __ct_isClicking = false; }, 100); }, true);


/* --------------------------------------------------------------------------
   DEFAULTS
   -------------------------------------------------------------------------- */
function defaultMappings() {
  // FIX: Return empty array so no "ghost" row appears automatically
  return [];
}

function getStorageKey() {
  return "keysight_" + currentHostname;
}

/* --------------------------------------------------------------------------
   Auto-Save Logic
   -------------------------------------------------------------------------- */
async function performAutoSave() {
  const mappings = collectRows();
  
  if (typeof highlightRows === 'function') highlightRows([]);
  if (error) error.classList.remove('visible');

  const dups = findDuplicateShortcuts(mappings);
  if (dups.length > 0) {
    if (typeof highlightRows === 'function') highlightRows(dups);
    showStatus("Duplicate shortcuts detected. Not saved.", "error");
    return;
  }

  const ok = await saveMappings(mappings);
  if (ok) showStatus("Saved for " + currentHostname, "saved");
  else showStatus("Error saving settings", "error");
}


/* --------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */
function buildRow(index, mapping) {
  const tr = document.createElement('tr');
  tr.dataset.index = index;
  const label = mapping.colorName || `Trigger ${index + 1}`;

  const tdIndex = document.createElement('td');
  tdIndex.textContent = index + 1;
  tr.appendChild(tdIndex);

  const tdSelector = document.createElement('td');
  const selectorInput = document.createElement('input');
  selectorInput.type = 'text';
  selectorInput.className = 'selector';
  selectorInput.value = mapping.selector || '';
  selectorInput.placeholder = index === 0 ? "e.g. #search" : ""; 
  selectorInput.addEventListener('change', performAutoSave);
  tdSelector.appendChild(selectorInput);
  tr.appendChild(tdSelector);

  const tdShortcut = document.createElement('td');
  const shortcutInput = document.createElement('input');
  shortcutInput.type = 'text';
  shortcutInput.className = 'shortcut';
  shortcutInput.readOnly = true;
  shortcutInput.value = mapping.shortcut || '';
  shortcutInput.setAttribute('aria-label', `Shortcut for ${label}`);
  tdShortcut.appendChild(shortcutInput);
  tr.appendChild(tdShortcut);

  const tdDelete = document.createElement('td');
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

function renderRows(mappings) {
  if (!rowsContainer) {
    console.error("Rows container not found!");
    return;
  }
  rowsContainer.innerHTML = '';
  
  (mappings || []).forEach((map, i) => {
    // Ensure we handle missing fields gracefully
    const safeMap = map || { colorName: `Trigger ${i+1}`, selector: '', shortcut: '', entryType: 'manual'};
    rowsContainer.appendChild(buildRow(i, safeMap));
  });
  
  attachRecorders();
}

function addNewRow(){
  const currentMappings = collectRows();
  const newRow = { 
      colorName: `Trigger ${currentMappings.length + 1}`,
      selector: '', 
      shortcut: '', 
      entryType: 'manual'
  };
  currentMappings.push(newRow);
  renderRows(currentMappings);
  // Don't auto-save empty rows immediately if you prefer, 
  // but saving here ensures the UI state persists.
  saveMappings(currentMappings); 
  return currentMappings;
}

function deleteRow(index){
  const currentMappings = collectRows();
  currentMappings.splice(index, 1);
  renderRows(currentMappings);
  saveMappings(currentMappings);
  return currentMappings;
}

/* --------------------------------------------------------------------------
   Shortcut Recorder
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

  if (!save && input._previousValue !== undefined) {
    input.value = input._previousValue;
  }
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
  input.addEventListener('paste', (e) => e.preventDefault());
}

window.addEventListener('keydown', function (e) {
  const active = document.activeElement;
  if (!active || !active.classList.contains('shortcut') || active.dataset.recording !== '1') return;
  if (active.dataset.activatedByEnter === '1' && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); return; }
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'Escape') { stopRecordingOn(active, false); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') { active.value = ''; return; }
  updateInputDisplay(active, e);
}, true);

window.addEventListener('keyup', (e) => {
  const active = document.activeElement;
  if (!active || !active.classList.contains('shortcut')) return;
  if (active.dataset.activatedByEnter === '1' && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); delete active.dataset.activatedByEnter; return; }
  if (active.dataset.recording !== '1') return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') return;

  const parts = active.value.split('+');
  let main = mainKeyFromEvent(e);
  const normalized = normalizeKeyName(main);
  if (normalized && !['Ctrl','Alt','Shift','Meta'].includes(normalized)) {
    stopRecordingOn(active, true);
  }
}, true);

function updateInputDisplay(input, e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');
  let main = mainKeyFromEvent(e);
  const normalizedMain = normalizeKeyName(main);
  if (normalizedMain && !['Ctrl','Alt','Shift','Meta'].includes(normalizedMain)) {
    if (!parts.includes(normalizedMain)) parts.push(normalizedMain);
  }
  input.value = parts.join('+');
}

function mainKeyFromEvent(e) {
  if (e.code) {
    if (/^Digit\d$/i.test(e.code)) return e.code.slice(-1);
    if (/^Numpad\d$/i.test(e.code)) return e.code.slice(-1);
    if (/^Key[A-Z]$/i.test(e.code)) return e.code.slice(-1);
    if (/^Arrow/i.test(e.code) || /^F\d{1,2}$/i.test(e.code)) return e.code;
  }
  return e.key || '';
}

function normalizeKeyName(key) {
  if (!key) return '';
  const s = key.toString();
  if (/^f\d{1,2}$/i.test(s)) return s.toUpperCase();
  const lk = s.toLowerCase();
  if (lk === 'control') return 'Ctrl';
  if (lk === 'meta' || lk === 'command') return 'Meta';
  if (s.length === 1) return s.toUpperCase();
  return s[0] ? (s[0].toUpperCase() + s.slice(1)) : s;
}

function collectRows() {
  if (!rowsContainer) return [];
  return Array.from(rowsContainer.querySelectorAll('tr')).map((tr, i) => ({
    colorName: `Trigger ${i + 1}`, 
    selector: tr.querySelector('.selector').value.trim(),
    shortcut: tr.querySelector('.shortcut').value.trim(),
    entryType: 'manual'
  }));
}

function findDuplicateShortcuts(mappings) {
  const seen = {};
  const duplicates = new Set();
  mappings.forEach((m, i) => {
    const key = (m.shortcut || '').replace(/\s+/g, '').toLowerCase();
    if (!key) return;
    if (seen[key] !== undefined) {
      duplicates.add(i); duplicates.add(seen[key]);
    } else { seen[key] = i; }
  });
  return Array.from(duplicates);
}

function highlightRows(indices) {
  if (!rowsContainer) return;
  document.querySelectorAll('#rows tr').forEach(tr => tr.classList.remove('duplicate'));
  indices.forEach(i => {
    const tr = document.querySelector(`#rows tr[data-index='${i}']`);
    if (tr) tr.classList.add('duplicate');
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

function attachRecorders() {
  document.querySelectorAll('.shortcut').forEach(enableShortcutInput);
}

/* --------------------------------------------------------------------------
   STORAGE & INIT (Per-Site Logic)
   -------------------------------------------------------------------------- */
function saveMappings(mappings) {
  return new Promise((resolve) => {
    try {
      const key = getStorageKey();
      const payload = {};
      payload[key] = mappings;
      
      if (ext.storage && ext.storage.sync) {
        ext.storage.sync.set(payload, () => {
          resolve(!ext.runtime.lastError);
        });
      } else {
        console.error("Storage API unavailable");
        resolve(false);
      }
    } catch(e) { resolve(false); }
  });
}

function loadMappings(cb) {
  const params = new URLSearchParams(window.location.search);
  const paramHost = params.get('hostname');

  if (paramHost) {
    currentHostname = paramHost;
    fetchStorage(cb);
  } else {
    if (ext.tabs && ext.tabs.query) {
      try {
        ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
           if (ext.runtime.lastError) {
             currentHostname = "Global";
           } else if (tabs && tabs[0] && tabs[0].url) {
             try {
               currentHostname = new URL(tabs[0].url).hostname;
             } catch(e) { currentHostname = "Global"; }
           }
           fetchStorage(cb);
        });
      } catch(e) {
         currentHostname = "Global";
         fetchStorage(cb);
      }
    } else {
      currentHostname = "Global";
      fetchStorage(cb);
    }
  }
}

function fetchStorage(cb) {
    if (title) title.textContent = `z.WebKeyBind: ${currentHostname}`;
    console.log("[KeySight Popup] Loading for:", currentHostname);

    const key = getStorageKey();
    if (ext.storage && ext.storage.sync) {
      ext.storage.sync.get(key, (res) => {
        console.log("[KeySight Popup] Data loaded:", res);
        const data = (res && res[key] && Array.isArray(res[key])) ? res[key] : [];
        // FIX: Just pass the data (even if empty). Do NOT call defaultMappings() here.
        cb(data);
      });
    } else {
       console.error("Storage API unavailable");
       cb(defaultMappings());
    }
}

// ⚠️ INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
  rowsContainer = document.getElementById('rows');
  resetBtn = document.getElementById('resetBtn');
  helpBtn = document.getElementById('helpShortcuts');
  error = document.getElementById('error');
  addBtn = document.getElementById('addBtn');
  title = document.getElementById('title');

  loadMappings((mappings) => {
    renderRows(mappings);
    const firstInput = document.querySelector('input');
    if (firstInput) firstInput.focus();
  });

  if (resetBtn) {
    resetBtn.textContent = "Clear All";
    resetBtn.addEventListener('click', async () => {
      if(confirm("Delete all settings for " + currentHostname + "?")) {
         // FIX: defaultMappings() is now empty [], so this properly clears the UI
         const defs = defaultMappings();
         renderRows(defs);
         await saveMappings(defs); 
         showStatus("All settings cleared", "saved");
      }
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      alert(`z.WebKeyBind Help for ${currentHostname}:\n\n1. Press "Add New" to add a row.\n2. Enter a Selector.\n3. Click the box on the right and press your shortcut.\n4. Use the "X" button to delete rows.`);
    });
  }

  if (rowsContainer) {
    rowsContainer.addEventListener("click", async (event) => {
      const btn = event.target.closest('.deleteBtn');
      if(btn){
        const visualIndex = parseInt(btn.value) + 1;
        if(confirm(`Delete Trigger ${visualIndex}?`)){
          const btnIndex = parseInt(btn.value);
          deleteRow(btnIndex);
          showStatus("Trigger deleted", "saved");
        }
      } 
    });
  }

  if (addBtn) {
    addBtn.addEventListener('click', async () => {
      const mapping = addNewRow();
      const index = mapping.length - 1;
      setTimeout(() => {
          const currRow = document.querySelector(`tr[data-index="${index}"]`);
          if(currRow){
            const firstInput = currRow.querySelector('input.selector');
            if(firstInput) firstInput.focus();
          }
      }, 50);
    });
  }
});