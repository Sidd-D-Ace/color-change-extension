/* import.js - Handles robust file importing in a tab */
const ext = (typeof chrome !== 'undefined') ? chrome : browser;

document.getElementById('fileInput').addEventListener('change', handleFileImport);

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const status = document.getElementById('status');
    status.textContent = "Reading file...";
    status.className = "";

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const json = JSON.parse(e.target.result);
            
            // LOGIC: Same as popup.js but safe here
            if (Array.isArray(json)) {
                // Single Site Array - We need the URL logic here, but since we are in a tab,
                // we can't easily know "current site". 
                // So for single-site imports, we treat them as Global or ask user.
                // SIMPLIFICATION: Save to "keysight_ManualImport" for safety, 
                // or better: Only allow Full Backups here.
                
                status.textContent = "Error: Please use 'Export All' for backups suitable for this import page.";
                status.className = "error";
                return;
            } 
            else if (typeof json === 'object') {
                ext.storage.sync.set(json, () => {
                    status.textContent = "✅ Success! Settings Imported.";
                    status.className = "success";
                    setTimeout(() => window.close(), 1500); // Close tab after success
                });
            } else {
                throw new Error("Invalid Format");
            }
        } catch (err) {
            console.error(err);
            status.textContent = "❌ Error: Invalid JSON File";
            status.className = "error";
        }
    };
    reader.readAsText(file);
}