/* popup_readable.js
   Clear, well-documented version of popup.js suitable for an intermediate JS programmer.
   Preserves behavior: 10 rows, load/save/reset, duplicate detection+highlight, Test button,
   shortcut recording with modifier preview on keydown and finalization on keyup,
   auto-advance to next row but does not auto-start recording on programmatic focus.

   Note: Content script messaging uses the same callback/promise fallbacks as before.
*/

const ext = (typeof browser !== 'undefined') ? browser : chrome;

// DOM references
const rowsContainer = document.getElementById('rows');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const helpBtn = document.getElementById('helpShortcuts');
const announce = document.getElementById('announce'); // aria-live area
const error = document.getElementById('error');       // visible error area

// Number of rows we show
const ROW_COUNT = 10;

/* --------------------------------------------------------------------------
   Defaults and helpers
   -------------------------------------------------------------------------- */
function defaultMappings() {
  // Create 10 default mappings (Red..Black) with sensible selectors and shortcuts
  const names = ['Red','Green','Blue','Yellow','Magenta','Cyan','Orange','Purple','Brown','Black'];
  return names.map((n, i) => ({
    colorName: n,
    selector: `.${n.toLowerCase()}Btn`,
    // map last one to 0
    shortcut: `Ctrl+Shift+${i === 9 ? 0 : i+1}`
  }));
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

/* --------------------------------------------------------------------------
   Rendering rows
   -------------------------------------------------------------------------- */
function buildRow(index, mapping) {
  // Build a <tr> with inputs and a Test button
  const tr = document.createElement('tr');
  tr.dataset.index = index;

  // Column 1: index
  const tdIndex = document.createElement('td');
  tdIndex.textContent = index + 1;
  tr.appendChild(tdIndex);

  // Column 2: color name
  const tdColor = document.createElement('td');
  const colorInput = document.createElement('input');
  colorInput.type = 'text';
  colorInput.className = 'colorName';
  colorInput.setAttribute('aria-label', `Color name ${index+1}`);
  colorInput.value = mapping.colorName || '';
  tdColor.appendChild(colorInput);
  tr.appendChild(tdColor);

  // Column 3: selector / id
  const tdSelector = document.createElement('td');
  const selectorInput = document.createElement('input');
  selectorInput.type = 'text';
  selectorInput.className = 'selector';
  selectorInput.setAttribute('aria-label', `Selector ${index+1}`);
  selectorInput.value = mapping.selector || '';
  tdSelector.appendChild(selectorInput);
  tr.appendChild(tdSelector);

  // Column 4: shortcut (read-only — recorded via keyboard handlers)
  const tdShortcut = document.createElement('td');
  const shortcutInput = document.createElement('input');
  shortcutInput.type = 'text';
  shortcutInput.className = 'shortcut';
  shortcutInput.setAttribute('aria-label', `Shortcut ${index+1}`);
  shortcutInput.readOnly = true;
  shortcutInput.value = mapping.shortcut || '';
  tdShortcut.appendChild(shortcutInput);
  tr.appendChild(tdShortcut);

  // Column 5: Test button
  const tdTest = document.createElement('td');
  const testBtn = document.createElement('button');
  testBtn.type = 'button';
  testBtn.textContent = 'Test';
  testBtn.setAttribute('aria-label', `Test mapping ${index+1}`);
  tdTest.appendChild(testBtn);
  tr.appendChild(tdTest);

  return tr;
}

function renderRows(mappings) {
  rowsContainer.innerHTML = ''; // clear existing
  for (let i = 0; i < ROW_COUNT; i++) {
    const map = mappings[i] || { colorName: '', selector: '', shortcut: '' };
    rowsContainer.appendChild(buildRow(i, map));
  }
  attachRecorders();    // hook up shortcut inputs
  attachTestButtons();  // hook up Test buttons
}

/* --------------------------------------------------------------------------
   Storage helpers (simple wrappers around ext.storage.sync)
   -------------------------------------------------------------------------- */
function loadMappings(callback) {
  ext.storage.sync.get({ mappings: null }, (res) => {
    callback(res.mappings || defaultMappings());
  });
}

function saveMappings(mappings, callback) {
  ext.storage.sync.set({ mappings }, () => { if (callback) callback(); });
}

/* --------------------------------------------------------------------------
   Collect current table state and duplicate-checking
   -------------------------------------------------------------------------- */
function collectRows() {
  const trs = Array.from(rowsContainer.querySelectorAll('tr'));
  return trs.map(tr => ({
    colorName: tr.querySelector('.colorName').value.trim(),
    selector: tr.querySelector('.selector').value.trim(),
    shortcut: tr.querySelector('.shortcut').value.trim()
  }));
}

function normalizeShortcutString(s) {
  return (s || '').trim().replace(/\s+/g, '').toLowerCase();
}

function findDuplicateShortcuts(mappings) {
  const seen = Object.create(null);
  const duplicates = new Set();
  mappings.forEach((m, i) => {
    const key = normalizeShortcutString(m.shortcut);
    if (!key) return;
    if (seen[key] !== undefined) {
      duplicates.add(i);
      duplicates.add(seen[key]);
    } else {
      seen[key] = i;
    }
  });
  return Array.from(duplicates).sort((a,b) => a - b);
}

function highlightRows(indices) {
  document.querySelectorAll('#rows tr').forEach(tr => tr.classList.remove('duplicate'));
  indices.forEach(i => {
    const tr = document.querySelector(`#rows tr[data-index='${i}']`);
    if (tr) tr.classList.add('duplicate');
  });
}

/* --------------------------------------------------------------------------
   Test button wiring (sends a content-script message to the active tab)
   -------------------------------------------------------------------------- */
function attachTestButtons() {
  rowsContainer.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const tr = btn.closest('tr');
      if (!tr) return;
      const selector = tr.querySelector('.selector').value.trim();
      const colorName = tr.querySelector('.colorName').value.trim();
      const payload = { action: 'trigger', selector, colorName };

      // Use a promise wrapper to support both callback and promise styles
      sendMessageToActiveTab(payload).then(() => {
        announceMessage(`Tested row ${tr.dataset.index}`);
      }).catch(() => {
        announceMessage('Content script not found on the current page.');
      });
    });
  });
}

function sendMessageToActiveTab(message) {
  return new Promise((resolve, reject) => {
    ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || !tabs[0]) return reject(new Error('no active tab'));
      const tabId = tabs[0].id;

      // Try chrome-style callback first
      try {
        ext.tabs.sendMessage(tabId, message, (res) => {
          if (ext.runtime && ext.runtime.lastError) {
            // callback had an error; try promise-style if available
            try {
              const p = ext.tabs.sendMessage(tabId, message);
              if (p && typeof p.then === 'function') {
                p.then(resolve).catch(reject);
              } else {
                reject(ext.runtime.lastError);
              }
            } catch (e) {
              reject(ext.runtime.lastError);
            }
          } else {
            resolve(res);
          }
        });
      } catch (err) {
        // fallback for environments that return a promise
        try {
          const p = ext.tabs.sendMessage(tabId, message);
          if (p && typeof p.then === 'function') p.then(resolve).catch(reject);
          else reject(err);
        } catch (e) {
          reject(e);
        }
      }
    });
  });
}

/* --------------------------------------------------------------------------
   Announce / error helper
   -------------------------------------------------------------------------- */
function announceMessage(msg, type = 'info') {
  if (announce) announce.textContent = msg;

  if (type === 'error') {
    if (error) {
      error.textContent = msg;
      error.classList.add('visible');
    }
  } else {
    if (error) error.classList.remove('visible');
    if (type === 'saved') {
      const saved = document.querySelector('.saved-notice');
      if (saved) {
        saved.textContent = msg;
        saved.classList.add('visible');
        setTimeout(() => saved.classList.remove('visible'), 1800);
      }
    }
  }
}

/* --------------------------------------------------------------------------
   Shortcut recording helpers (readable implementation)

   Behavior:
   - When a .shortcut input is focused (or clicked) it enters RECORDING mode
   - keydown: show live modifier preview (Ctrl/Alt/Shift/Meta)
   - keyup: determine the real key (preferring e.code for digits/letters) and finalize
   - pressing Escape cancels; Backspace/Delete clears
   - when finalized we programmatically focus the next row's shortcut but set a flag
     so that focus from code won't auto-start recording there
   -------------------------------------------------------------------------- */

function normalizeKeyName(key) {
  if (!key) return '';
  const s = key.toString();
  if (/^arrow/i.test(s)) return s[0].toUpperCase() + s.slice(1);            // ArrowUp -> ArrowUp
  if (/^f\d{1,2}$/i.test(s)) return s.toUpperCase();                       // F5
  const lk = s.toLowerCase();
  if (lk === 'control' || lk === 'ctrl') return 'Ctrl';
  if (lk === 'meta' || lk === 'command' || lk === 'cmd') return 'Meta';
  if (lk === 'alt') return 'Alt';
  if (lk === 'shift') return 'Shift';
  if (lk === 'escape' || lk === 'esc') return 'Escape';
  if (lk === ' ') return 'Space';
  if (s.length === 1) return s.toUpperCase();                              // 'a' -> 'A'
  return s[0] ? (s[0].toUpperCase() + s.slice(1)) : s;
}

function mainKeyFromEvent(e) {
  // Prefer e.code when it maps cleanly to a single character (Digit, Numpad, Key)
  if (e.code) {
    if (/^Digit\d$/i.test(e.code)) return e.code.slice(-1);   // Digit1 -> '1'
    if (/^Numpad\d$/i.test(e.code)) return e.code.slice(-1);  // Numpad1 -> '1'
    if (/^Key[A-Z]$/i.test(e.code)) return e.code.slice(-1);   // KeyK -> 'K'
    if (/^Arrow/i.test(e.code) || /^F\d{1,2}$/i.test(e.code)) return e.code; // ArrowUp or F5
  }
  // Otherwise fall back to e.key
  return e.key || '';
}

function startRecordingOn(input) {
  input.dataset.recording = '1';
  input._previousValue = input.value;
  input.value = 'Press keys...';
  input.classList.add('recording');
  input.focus();
  if (announce) announce.textContent = 'Recording shortcut. Press desired key combination, Escape to cancel.';
}

function stopRecordingOn(input, save) {
  delete input.dataset.recording;
  input.classList.remove('recording');
  if (!save && input._previousValue !== undefined) input.value = input._previousValue;
  if (announce) announce.textContent = '';
}

function enableShortcutInput(input) {
  if (!input) return;
  if (input._attached) return; // idempotent
  input._attached = true;
  input.readOnly = true;
  input.autocomplete = 'off';
  input.inputMode = 'none';

  input.addEventListener('focus', () => {
    // If focus was set programmatically with skipFocus flag, consume it and don't start
    if (input.dataset.skipFocus === '1') { delete input.dataset.skipFocus; return; }
    startRecordingOn(input);
  });

  input.addEventListener('click', () => { if (!input.dataset.recording) startRecordingOn(input); });

  input.addEventListener('blur', () => { if (input.dataset.recording) stopRecordingOn(input, true); });

  input.addEventListener('paste', (e) => e.preventDefault());
}

function attachRecorders() {
  const shortcuts = document.querySelectorAll('#rows .shortcut');
  shortcuts.forEach(enableShortcutInput);
}

// keydown: show modifiers live (do not finalize)
window.addEventListener('keydown', (e) => {
  const active = document.activeElement;
  if (!active || !active.classList || !active.classList.contains('shortcut')) return;
  if (!active.dataset || active.dataset.recording !== '1') return;

  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape') { stopRecordingOn(active, false); return; }
  if (e.key === 'Backspace' || e.key === 'Delete') { active.value = ''; return; }

  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  // Update the input to show currently held modifiers
  if (parts.length) active.value = parts.join('+');
}, true);

// keyup: finalize the shortcut using e.code-aware detection
window.addEventListener('keyup', (e) => {
  const active = document.activeElement;
  if (!active || !active.classList || !active.classList.contains('shortcut')) return;
  if (!active.dataset || active.dataset.recording !== '1') return;

  e.preventDefault();
  e.stopPropagation();

  if (e.key === 'Escape' || e.key === 'Backspace' || e.key === 'Delete') return;

  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Meta');

  let main = mainKeyFromEvent(e);
  if (main === ' ') main = 'Space';
  if (main === 'Esc') main = 'Escape';
  const normalizedMain = normalizeKeyName(main);

  // If the released key is just a modifier, keep showing modifiers
  if (['Ctrl','Alt','Shift','Meta'].includes(normalizedMain)) {
    active.value = parts.join('+');
    return;
  }

  // For normal keys, combine and finish recording
  if (normalizedMain) {
    const combined = parts.slice();
    if (!combined.includes(normalizedMain)) combined.push(normalizedMain);
    active.value = combined.join('+');
    stopRecordingOn(active, true);

    // move focus to next row's shortcut without auto-starting recording
    const tr = active.closest('tr');
    if (tr) {
      const next = tr.nextElementSibling;
      if (next) {
        const nextShortcut = next.querySelector('.shortcut');
        if (nextShortcut) {
          nextShortcut.dataset.skipFocus = '1';
          nextShortcut.focus();
        }
      }
    }
  }
}, true);

/* --------------------------------------------------------------------------
   Controls: Save / Reset / Help
   -------------------------------------------------------------------------- */

saveBtn.addEventListener('click', () => {
  // clear UI highlights & errors
  highlightRows([]);
  if (error) error.classList.remove('visible');

  const mappings = collectRows();
  const dups = findDuplicateShortcuts(mappings);
  if (dups.length > 0) {
    highlightRows(dups);
    announceMessage(`Repeated shortcut on rows: ${dups.map(i => i+1).join(', ')}.`, 'error');
    return;
  }

  saveMappings(mappings, () => announceMessage('Settings saved.', 'saved'));
});

resetBtn.addEventListener('click', () => {
  const defs = defaultMappings();
  renderRows(defs);
  saveMappings(defs, () => announceMessage('Reset to defaults.', 'saved'));
});

helpBtn.addEventListener('click', () => {
  alert('To change browser-level shortcuts open Extensions → Keyboard Shortcuts. The popup shortcuts are used when the page has focus.');
});

/* --------------------------------------------------------------------------
   Initialization
   -------------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', () => {
  loadMappings(renderRows);
});

// expose some helpers for debugging in devtools (optional)
window.__popupHelpers = { collectRows, findDuplicateShortcuts, buildRow };
