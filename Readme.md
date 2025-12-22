# KeySight

**Navigate without sight.**

KeySight is a browser extension designed for screen reader users and power users who want to navigate the web faster. It allows you to map **Unlimited custom keyboard shortcuts** to physically click buttons, follow links, or trigger elements on any webpage.

## 🚀 New Features (v1.4)

* **🛡️ Self-Healing Engine:** KeySight doesn't just save a "dumb" link. It creates a robust **Fingerprint** (ID, ARIA Label, Class, and Structural Position). If a website updates and changes a button's ID, KeySight finds it using the other data and **automatically updates** itself. Your shortcuts stay broken-free.
* **🖱️ Mouse Capture Mode:** Simply hover over an element and click to capture it.
* **⚡ Quick Capture:** Tab to a button and press the magic key to save it instantly.
* **Native UI:** Settings now open in the browser's native popup for better performance and accessibility.

## ✨ Core Features

* **Unlimited Custom Triggers:** Map distinct actions on any single page.
* **Universal Compatibility:** Works on any website (Gmail, GitHub, YouTube, etc.).
* **Accessibility First:**
    * Fully compatible with screen readers (NVDA, JAWS, VoiceOver).
    * Audible confirmation when a shortcut is triggered.
* **Auto-Save:** Settings are saved instantly as you type.

## 🛠️ Installation Guide (Important)

This extension uses **Manifest V3**. Because Firefox and Chromium (Chrome/Edge) handle background scripts differently, you must ensure you are using the correct `manifest.json` file for your browser.

### 1. Prepare the Manifest
The project contains two manifest files. **Rename the one matching your browser to `manifest.json`** before loading.

| Browser | Source File | Action |
| :--- | :--- | :--- |
| **Chrome / Edge / Brave** | `manifest_chrome.json` | Rename this to `manifest.json` |
| **Firefox** | `manifest_firefox.json` | Rename this to `manifest.json` |

---

### 2. Load into Browser

#### 🟢 Chrome / Edge / Brave
1.  Open **Extensions Management**:
    * **Chrome:** `chrome://extensions`
    * **Edge:** `edge://extensions`
2.  Enable **"Developer mode"** (toggle in the top right).
3.  Click **"Load unpacked"**.
4.  Select the project folder (where your renamed `manifest.json` is located).

#### 🦊 Firefox
1.  Type `about:debugging` in the address bar.
2.  Click **"This Firefox"** on the left sidebar.
3.  Click **"Load Temporary Add-on"**.
4.  Select the `manifest.json` file.

## 📖 How to Use

### 1. Quick Capture Mode (Keyboard)
*Best for screen reader users.*

1.  **Focus:** Use `Tab` to navigate to the button you want.
2.  **Capture:** Press **`Ctrl + Alt + C`**.
3.  **Assign:** The extension will announce "Element Captured". Press the key combination you want to use (e.g., `Alt+1`). KeySight saves it instantly.

### 2. Mouse Capture Mode (Visual)
*Best for sighted power users.*

1.  **Activate:** Press **`Alt + M`**. The cursor will turn into a crosshair.
2.  **Select:** Click on any element (button, link, icon).
3.  **Assign:** Press your desired shortcut key.

### 3. Managing Settings
1.  **Open Settings:** Press **`Alt + E`** (or click the extension icon in the toolbar).
2.  **View/Delete:** You can see all active triggers for the current website. Click "X" to remove any shortcut.
3.  **Manual Entry:** You can manually type CSS selectors (e.g., `.submit-btn` or `[aria-label="Search"]`) if you prefer advanced configuration.

## 📂 Project Structure

* `manifest.json`: The active configuration file (renamed from `manifest_chrome.json` or `manifest_firefox.json`).
* `content_script.js`: The "Brain." Handles recording, fingerprinting, and the Self-Healing engine.
* `background.js`: Handles global commands (Service Worker for Chrome / Event Page for Firefox).
* `popup.html` / `js` / `css`: The settings interface.

## 🤝 Contributing

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License.