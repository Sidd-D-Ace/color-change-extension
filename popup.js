/* popup.js - KeySight: Generic Triggers + No Auto-Advance */
const ext = (typeof browser !== 'undefined') ? browser : chrome;

// DOM references
const rowsContainer = document.getElementById('rows');
const resetBtn = document.getElementById('resetBtn');
const helpBtn = document.getElementById('helpShortcuts');
const error = document.getElementById('error');

const ROW_COUNT = 10;
let __ct_isClicking = false;

window.addEventListener('mousedown', () => { __ct_isClicking = true; }, true);
window.addEventListener('mouseup', () => { setTimeout(() => { __ct_isClicking = false; }, 100); }, true);


/* --------------------------------------------------------------------------
   DEFAULTS (Updated to Generic Triggers)
   -------------------------------------------------------------------------- */
function defaultMappings() {
  const mappings = [];
  for (let i = 1; i <= ROW_COUNT; i++) {
    mappings.push({
      colorName: `Trigger ${i}`, // Generic label (used for aria-labels)
      selector: "",              // Blank by default
      shortcut: ""               // Blank by default
    });
  }
  return mappings;
}


/* --------------------------------------------------------------------------
   Auto-Save Logic
   -------------------------------------------------------------------------- */
async function performAutoSave() {
  const mappings = collectRows();
  
  highlightRows([]);
  if (error) error.classList.remove('visible');

  const dups = findDuplicateShortcuts(mappings);
  if (dups.length > 0) {
    highlightRows(dups);
    showStatus("Duplicate shortcuts detected. Not saved.", "error");
    return;
  }

  const ok = await saveMappings(mappings);
  if (ok) showStatus("Saved", "saved");
  else showStatus("Error saving settings", "error");
}


/* --------------------------------------------------------------------------
   Rendering
   -------------------------------------------------------------------------- */
function buildRow(index, mapping) {
  const tr = document.createElement('tr');
  tr.dataset.index = index;

  // Index
  const tdIndex = document.createElement('td');
  tdIndex.textContent = index + 1;
  tr.appendChild(tdIndex);

  // Selector
  const tdSelector = document.createElement('td');
  const selectorInput = document.createElement('input');
  selectorInput.type = 'text';
  selectorInput.className = 'selector';
  selectorInput.value = mapping.selector || '';
  selectorInput.placeholder = index === 0 ? "e.g. .btn-save or #submit" : ""; // Helpful hint on row 1
  selectorInput.addEventListener('change', performAutoSave);
  tdSelector.appendChild(selectorInput);
  tr.appendChild(tdSelector);

  // Shortcut
  const tdShortcut = document.createElement('td');
  const shortcutInput = document.createElement('input');
  shortcutInput.type = 'text';
  shortcutInput.className = 'shortcut';
  shortcutInput.readOnly = true;
  shortcutInput.value = mapping.shortcut || '';
  // Use the generic name "Trigger 1" for the label
  shortcutInput.setAttribute('aria-label', `Shortcut for ${mapping.colorName || 'Row ' + (index+1)}`);
  tdShortcut.appendChild(shortcutInput);
  tr.appendChild(tdShortcut);

  // Test Button
  const tdTest = document.createElement('td');
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.textContent = 'Test';
  tdTest.appendChild(testBtn);
  tr.appendChild(tdTest);

  return tr;
}

function renderRows(mappings) {
  rowsContainer.innerHTML = '';
  for (let i = 0; i < ROW_COUNT; i++) {
    const map = mappings[i] || { colorName: `Trigger ${i+1}`, selector: '', shortcut: '' };
    rowsContainer.appendChild(buildRow(i, map));
  }
  attachRecorders();
  attachTestButtons();
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

  input.addEventListener('click', () => {
    if (!input.dataset.recording) startRecordingOn(input);
  });

  input.addEventListener('blur', () => {
    if (input.dataset.recording) stopRecordingOn(input, true);
  });

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

/* --------------------------------------------------------------------------
   Global Key Logic
   -------------------------------------------------------------------------- */
window.addEventListener('keydown', function (e) {
  const active = document.activeElement;
  if (!active || !active.classList.contains('shortcut') || active.dataset.recording !== '1') return;
  
  if (active.dataset.activatedByEnter === '1' && e.key === 'Enter') {
    e.preventDefault(); e.stopPropagation(); return;
  }

  e.preventDefault(); e.stopPropagation();

  if (e.key === 'Escape') { stopRecordingOn(active, false); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') { active.value = ''; return; }

  updateInputDisplay(active, e);
}, true);

window.addEventListener('keyup', (e) => {
  const active = document.activeElement;
  if (!active || !active.classList.contains('shortcut')) return;

  if (active.dataset.activatedByEnter === '1' && e.key === 'Enter') {
     e.preventDefault(); e.stopPropagation();
     delete active.dataset.activatedByEnter;
     return;
  }

  if (active.dataset.recording !== '1') return;
  e.preventDefault(); e.stopPropagation();
  if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') return;

  const parts = active.value.split('+');
  let main = mainKeyFromEvent(e);
  if (main === ' ') main = 'Space';
  if (main === 'Esc') main = 'Escape';
  const normalized = normalizeKeyName(main);

  if (normalized && !['Ctrl','Alt','Shift','Meta'].includes(normalized)) {
    // Stop recording. Do NOT auto-advance.
    stopRecordingOn(active, true);
  }
}, true);

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */
function updateInputDisplay(input, e) {
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let main = mainKeyFromEvent(e);
  if (main === ' ') main = 'Space';
  if (main === 'Esc') main = 'Escape';
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
  const defaults = defaultMappings();
  return Array.from(rowsContainer.querySelectorAll('tr')).map((tr, i) => ({
    colorName: defaults[i].colorName, // "Trigger 1", "Trigger 2", etc.
    selector: tr.querySelector('.selector').value.trim(),
    shortcut: tr.querySelector('.shortcut').value.trim()
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

function attachTestButtons() {
  document.querySelectorAll('button').forEach(btn => {
    if (btn.id === 'resetBtn' || btn.id === 'helpShortcuts') return;
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      if (!tr) return;
      const index = parseInt(tr.dataset.index, 10);
      const defaults = defaultMappings();
      
      sendMessageToActiveTab({ 
        action: 'trigger', 
        selector: tr.querySelector('.selector').value.trim(), 
        colorName: defaults[index] ? defaults[index].colorName : "" 
      });
    });
  });
}

function saveMappings(mappings) {
  return new Promise((resolve) => {
    try {
      ext.storage.sync.set({ mappings }, () => {
        resolve(!ext.runtime.lastError);
      });
    } catch(e) { resolve(false); }
  });
}

function loadMappings(cb) {
  ext.storage.sync.get({ mappings: null }, (res) => {
    cb((res && res.mappings) ? res.mappings : defaultMappings());
  });
}

function sendMessageToActiveTab(msg) {
  ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs && tabs[0]) ext.tabs.sendMessage(tabs[0].id, msg);
  });
}

// Init
resetBtn.addEventListener('click', async () => {
  if(confirm("Clear all settings?")) {
     const defs = defaultMappings();
     renderRows(defs);
     await saveMappings(defs);
     showStatus("All settings cleared", "saved");
  }
});

helpBtn.addEventListener('click', () => {
  alert('KeySight Help:\n\n1. Enter a CSS Selector (e.g. .btn-save or #submit).\n2. Click the box on the right and press your shortcut.\n3. Shortcuts work when the webpage is focused.\n\nPress "Test" to verify your selector.');
});

document.addEventListener('DOMContentLoaded', () => {
  loadMappings((mappings) => {
    renderRows(mappings);
    const firstInput = document.querySelector('input');
    if (firstInput) firstInput.focus();
  });
  // Ensure button text matches our new "Clear All" logic
  if (resetBtn) resetBtn.textContent = "Clear All";
});