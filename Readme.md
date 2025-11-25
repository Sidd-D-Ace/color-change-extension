# Color Trigger Extension

A browser extension designed to help **visually impaired users** trigger color‑based actions on any webpage using **custom keyboard shortcuts**. The popup interface allows users to map 10 shortcuts to 10 selectable elements on a page.

This project is fully accessible and compatible with **NVDA screen reader**.

---

## ✨ Features

* 10 customizable shortcut → button mappings
* Designed for visually impaired users
* NVDA‑friendly labels and focus order
* Modifier-aware recorder (Ctrl, Shift, Alt, Meta)
* Prevents duplicate shortcuts
* Test button for each mapping
* Works on Chrome, Edge, and Firefox

---

## 📦 How to Install (Load Unpacked Extension)

Follow these steps to load the extension locally.

### **Chrome / Edge**

1. Download or clone this repository.
2. Open your browser.
3. Go to:

   * **Chrome:** `chrome://extensions/`
   * **Edge:** `edge://extensions/`
4. Enable **Developer mode** (top-right toggle).
5. Click **Load unpacked**.
6. Select the folder containing this extension (the folder with `manifest.json`).
7. The extension will now appear in your toolbar.

### **Firefox (Temporary Add-on)**

1. Download or clone this repository.
2. Open Firefox.
3. Go to: `about:debugging#/runtime/this-firefox`
4. Click **Load Temporary Add-on**.
5. Select the `manifest.json` file.
6. The extension will be active until the browser closes.

> ⚠️ Firefox temporarily disables extensions when the browser restarts. For permanent installation, publish through AMO.

---

## 🎯 Using the Extension

1. Click the extension icon.
2. You will see 10 rows:

   * **Color Name** (label for the action)
   * **Selector** (CSS selector of the button on the page)
   * **Shortcut** (record your keys)
   * **Test** (check if the mapping works)
3. To change a shortcut:

   * Click inside the shortcut box
   * Press your desired combination (e.g., `Ctrl + Shift + 2`)
4. Save your settings.

Shortcuts will trigger the corresponding element on the active webpage.

---

## ♿ Accessibility

* All inputs are labeled with **ARIA labels**.
* NVDA announces every state clearly.
* Error messages are read using a live region.
* Focus automatically moves to the next row after recording.
* No mouse required—fully keyboard navigable.

---

## 🛠 Development

```
color-extension/
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
├── background.js
├── content_script.js
└── icons/
```

You can edit files and reload the extension from the browser extensions page.

---

## 🤝 Contributing

Pull requests are welcome. Please ensure:

* Code is readable
* Accessibility is preserved
* No breaking changes to keyboard recording

---

## 📄 License

This project is released under the **MIT License**.
