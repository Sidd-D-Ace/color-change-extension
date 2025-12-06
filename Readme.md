# KeySight

**Navigate without sight.**

KeySight is a browser extension designed for screen reader users and power users who want to navigate the web faster. It allows you to map **Unlimited custom keyboard shortcuts** to physically click buttons, follow links, or trigger elements on any webpage using CSS selectors.

## 🚀 Features

* **Unlimited Custom Triggers:** Map Unlimited distinct actions on a single page.
* **Universal Compatibility:** Works on any website (Gmail, GitHub, YouTube, etc.).
* **CSS Selector Support:** Target elements by ID, Class, or Attributes (e.g., `[aria-label="Submit"]`).
* **Accessibility First:**
    * Fully compatible with screen readers (NVDA, JAWS, VoiceOver).
    * Audible confirmation when a shortcut is triggered (e.g., *"First shortcut triggered"*).
    * Settings dialog is fully keyboard navigable.
* **Quick Capture Mode:**
    * Automatically fetches button id,class.
    * Captures Shortcut and saves with the trigger.
    * Activates with a Magic Key (Ctrl+Alt+C). 
    * Automatically Renders new Row to the Setting Dialog.
* **Auto-Save:** Settings are saved instantly as you type.
* **No-Mouse Needed:** Open settings anywhere with `Ctrl+Shift+F`.

## 🛠️ Installation

### Chrome / Edge / Brave (Developer Mode)
Since this extension uses **Manifest V2**, it must be loaded in Developer Mode on Chromium browsers.

1.  Download or clone this repository.
2.  Open your browser's extensions page:
    * **Chrome:** `chrome://extensions`
    * **Edge:** `edge://extensions`
3.  Enable **"Developer mode"** (usually a toggle in the top right).
4.  Click **"Load unpacked"**.
5.  Select the folder containing `manifest.json`.

### Firefox
1.  Type `about:debugging` in the address bar.
2.  Click **"This Firefox"** on the left sidebar.
3.  Click **"Load Temporary Add-on"**.
4.  Select the `manifest.json` file from the project folder.

## 📖 How to Use
## 1. Quick Capture Mode

**1.    Focus on any Button on the Webpage**
        Use TAB Key to Navigate to your desired button.

**2.    Activate Quick Capture Mode**
        Press the **Magic Key** `Ctrl+Alt+C` (or Command+Option+C on Mac) on any webpage. KeySight will automatically sets Button id/class for you, with an announcement for confirmation.
    
**3.   Set Shortcut**
        Press a Combination of Shortcut to set for the button. KeySight will Saves the shortcut for you.
    
**4.  Use It:**
        Now, whenever you press your shortcut on that page, the button will be clicked instantly.

## 2. Manually
**1.  Open Settings:**
        Press `Ctrl+Shift+F` (or Command+Shift+F on Mac) on any webpage to open the KeySight overlay.

**2.  Configure a Trigger:**
        * **Selector:** Enter the CSS selector of the element you want to click.
            * *Example (ID):* `#submit-btn`
            * *Example (Class):* `.play-button`
            * *Example (Attribute):* `a[aria-label="Next Page"]`
        * **Shortcut:** Click the shortcut box and press the key combination you want to use (e.g., `Alt+1`).

**3.  Delete Trigger:**
        Click the **"Delete"** button in the settings row to delete the set trigger.

**4.  Use It:**
        Close the settings (`Esc`). Now, whenever you press your shortcut on that page, the button will be clicked instantly.


## 📂 Project Structure

* `manifest.json`: Extension configuration (MV2).
* `content_script.js`: Handles keyboard listeners, DOM manipulation, and the settings overlay injection.
* `background.js`: Manages global commands and settings storage retrieval.
* `popup.html` / `popup.css` / `popup.js`: The settings interface logic and styling.
* `test.html`: A local testing ground with buttons to verify shortcuts.

## ♿ Accessibility Notes

* **Announcements:** The extension uses `aria-live` regions to announce when the settings panel opens and when a shortcut is successfully triggered.
* **Focus Management:** When the settings panel opens, focus is automatically managed to prevent "double reading" of the page title.
* **Input Handling:** The shortcut recorder is designed to not trap focus; standard navigation keys like Tab work naturally unless you are actively recording.

## 🤝 Contributing

Pull requests are welcome! If you find a bug or want to improve the accessibility further, please open an issue.

1.  Fork the project.
2.  Create your feature branch (`git checkout -b feature/AmazingFeature`).
3.  Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4.  Push to the branch (`git push origin feature/AmazingFeature`).
5.  Open a Pull Request.

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.