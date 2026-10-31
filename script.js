import PatternLoader from "./load-pattern.js";
import GridManager from "./grid-manager.js";
import UIManager from "./ui-manager.js";

const GOOGLE_CLIENT_ID = "877144070400-ka6bh05tm1nrfndfhms8tl2ohecn957g.apps.googleusercontent.com";
const CLOUD_API_BASE_URL = "https://pattern-file-worker.jfcchisco.workers.dev";
let googleIdToken = null;
let googleUserId = null;
let googleIdentityServicesPromise = null;
let currentCloudFile = null;

const tileContainer = document.getElementsByClassName("tile-container")[0];

const patternLoader = new PatternLoader();
const uiManager = new UIManager();
const gridManager = new GridManager(patternLoader, uiManager);
uiManager.getGridManager(gridManager);
uiManager.getPatternLoader(patternLoader);

/* let CLUSTER_SEQUENCE = []
let THRESHOLD = 10; */

let cols = 0;
let rows = 0;

let jsonFiles = ['json/cubs.json', 'json/liverpool.json', 'json/japan.json', 'json/northern.json', 'json/cuphead.json', 'json/dino.json', 'json/amsterdam.json', 'json/african.json', 'json/messi.json'];
let currIndex = 0;

function loadGoogleIdentityServices() {
    if (window.google?.accounts?.id) {
        return Promise.resolve();
    }

    if (!googleIdentityServicesPromise) {
        googleIdentityServicesPromise = new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://accounts.google.com/gsi/client";
            script.async = true;
            script.onload = resolve;
            script.onerror = () => {
                googleIdentityServicesPromise = null;
                reject(new Error("Google Identity Services could not be loaded."));
            };
            document.head.appendChild(script);
        });
    }

    return googleIdentityServicesPromise;
}

function handleGoogleCredential(response) {
    if (!response.credential) {
        return;
    }

    googleIdToken = response.credential;
    googleUserId = null;
    let displayName = "Google user";
    try {
        const encodedPayload = response.credential.split(".")[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");
        const paddedPayload = encodedPayload.padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
        const payloadBytes = Uint8Array.from(atob(paddedPayload), character => character.charCodeAt(0));
        const claims = JSON.parse(new TextDecoder().decode(payloadBytes));
        displayName = claims.given_name || claims.name || claims.email || displayName;
        googleUserId = typeof claims.sub === "string" ? claims.sub : null;
    } catch (error) {
        console.warn("Could not read the Google account name from its sign-in token.", error);
    }

    const initial = Array.from(displayName.trim())[0]?.toLocaleUpperCase() || "?";
    const avatar = document.getElementById("googleUserAvatar");
    avatar.textContent = initial;
    avatar.title = `Signed in as ${displayName}`;
    avatar.setAttribute("aria-label", `Signed in as ${displayName}`);
    avatar.hidden = false;
    document.getElementById("googleSignInButton").hidden = true;
    document.getElementById("googleSignOutButton").hidden = false;
    document.getElementById("googleAuthStatus").textContent = "Signed in with Google";
}

async function initializeGoogleSignIn() {
    const status = document.getElementById("googleAuthStatus");
    if (GOOGLE_CLIENT_ID.startsWith("YOUR_GOOGLE_CLIENT_ID")) {
        status.textContent = "Google sign-in requires a Client ID in script.js";
        console.warn("Set GOOGLE_CLIENT_ID in script.js to enable Google sign-in.");
        return;
    }

    try {
        await loadGoogleIdentityServices();
        window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleCredential,
            auto_select: false
        });
        window.google.accounts.id.renderButton(
            document.getElementById("googleSignInButton"),
            { type: "icon", theme: "outline", size: "large", shape: "circle" }
        );
    } catch (error) {
        status.textContent = "Google sign-in is unavailable";
        console.error(error);
    }
}

function signOutFromGoogle() {
    googleIdToken = null;
    googleUserId = null;
    window.google?.accounts?.id?.disableAutoSelect();
    document.getElementById("googleUserAvatar").hidden = true;
    document.getElementById("googleSignOutButton").hidden = true;
    document.getElementById("googleSignInButton").hidden = false;
    document.getElementById("googleAuthStatus").textContent = "Signed out";
}

function requireCloudSignIn() {
    if (!googleIdToken) {
        alert("Please sign in with Google to use cloud files.");
        return false;
    }
    if (CLOUD_API_BASE_URL.startsWith("https://replace-with-your-worker")) {
        alert("Set CLOUD_API_BASE_URL in script.js to your deployed Cloudflare Worker URL.");
        return false;
    }
    return true;
}

async function cloudApiRequest(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${googleIdToken}`);
    const response = await fetch(`${CLOUD_API_BASE_URL.replace(/\/+$/, "")}${path}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        signOutFromGoogle();
        throw new Error("Your Google sign-in expired. Please sign in again.");
    }

    return response;
}

async function readCloudError(response) {
    let details = {};
    try {
        details = await response.json();
    } catch {
        // Use the HTTP status if the Worker did not return JSON.
    }
    const error = new Error(details.error || `Cloud request failed (${response.status}).`);
    error.status = response.status;
    error.details = details;
    return error;
}

function normalizeCloudEtag(value) {
    if (typeof value !== "string") {
        return null;
    }

    const etag = value.trim();
    if (/^"[^"\r\n]+"$/.test(etag)) {
        return etag;
    }
    if (etag.startsWith("W/") || !/^[\x21\x23-\x7E]+$/.test(etag)) {
        return null;
    }

    return `"${etag}"`;
}

async function listCloudFiles() {
    const files = [];
    let cursor = null;

    do {
        const query = new URLSearchParams({ limit: "100" });
        if (cursor) {
            query.set("cursor", cursor);
        }
        const response = await cloudApiRequest(`/api/files?${query}`);
        if (!response.ok) {
            throw await readCloudError(response);
        }
        const result = await response.json();
        files.push(...result.files);
        cursor = result.cursor;
    } while (cursor);

    return files;
}

function chooseCloudFile(files, title = "Open cloud pattern", emptyText = "No cloud files found.") {
    const dialog = document.getElementById("cloudFileDialog");
    const list = document.getElementById("cloudFileList");
    const emptyMessage = document.getElementById("cloudFileEmpty");
    document.getElementById("cloudFileDialogTitle").textContent = title;
    list.replaceChildren();
    emptyMessage.textContent = emptyText;
    emptyMessage.hidden = files.length > 0;

    for (const file of files) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cloud-file-option";
        button.textContent = file.name;
        button.addEventListener("click", () => dialog.close(file.id));
        item.appendChild(button);
        list.appendChild(item);
    }

    return new Promise(resolve => {
        const handleClose = () => {
            dialog.removeEventListener("close", handleClose);
            resolve(dialog.returnValue || null);
        };
        dialog.addEventListener("close", handleClose);
        dialog.returnValue = "";
        dialog.showModal();
    });
}

async function listDefaultFiles() {
    const files = [];
    let cursor = null;

    do {
        const query = new URLSearchParams({ limit: "100" });
        if (cursor) {
            query.set("cursor", cursor);
        }
        const response = await cloudApiRequest(`/api/default-files?${query}`);
        if (!response.ok) {
            throw await readCloudError(response);
        }
        const result = await response.json();
        files.push(...result.files);
        cursor = result.cursor;
    } while (cursor);

    return files;
}

function closeCloudFileDialog() {
    document.getElementById("cloudFileDialog").close();
}

async function download() {
    if (!requireCloudSignIn()) {
        return;
    }

    let files;
    try {
        uiManager.showSpinner("Loading cloud files...");
        files = await listCloudFiles();
    } catch (error) {
        alert(`Could not list cloud files: ${error.message}`);
        return;
    } finally {
        uiManager.hideSpinner();
    }

    if (files.length === 0) {
        alert("There are no cloud files to open.");
        return;
    }

    const selectedFileId = await chooseCloudFile(files, "Open cloud pattern", "No cloud files found.");
    if (!selectedFileId) {
        return;
    }

    try {
        uiManager.showSpinner("Downloading cloud file...");
        const response = await cloudApiRequest(`/api/files/${encodeURIComponent(selectedFileId)}`);
        if (!response.ok) {
            throw await readCloudError(response);
        }

        const rawPattern = await response.json();
        const pattern = patternLoader.loadJSON(rawPattern);
        const selectedFile = files.find(file => file.id === selectedFileId);
        const etag = normalizeCloudEtag(response.headers.get("ETag"))
            || normalizeCloudEtag(selectedFile?.etag);
        if (!etag) {
            throw new Error("The server did not provide a version for this file. Please reload the cloud file list and try again.");
        }
        loadJSON(pattern, {
            promptForSettings: true,
            cloudFile: {
                id: selectedFileId,
                name: selectedFile?.name || "Untitled pattern",
                etag,
                ownerSub: googleUserId
            }
        });
    } catch (error) {
        alert(`Could not open cloud file: ${error.message}`);
    } finally {
        uiManager.hideSpinner();
    }
}

async function openDefaultPatterns() {
    if (!requireCloudSignIn()) {
        return;
    }

    let files;
    try {
        uiManager.showSpinner("Loading default patterns...");
        files = await listDefaultFiles();
    } catch (error) {
        alert(`Could not list default patterns: ${error.message}`);
        return;
    } finally {
        uiManager.hideSpinner();
    }

    if (files.length === 0) {
        alert("There are no default patterns to open.");
        return;
    }

    const selectedFileKey = await chooseCloudFile(files, "Open default pattern", "No default patterns found.");
    if (!selectedFileKey) {
        return;
    }

    try {
        uiManager.showSpinner("Opening default pattern...");
        const query = new URLSearchParams({ key: selectedFileKey });
        const response = await cloudApiRequest(`/api/default-files?${query}`);
        if (!response.ok) {
            throw await readCloudError(response);
        }

        const pattern = patternLoader.loadJSON(await response.json());
        loadJSON(pattern, { promptForSettings: true });
    } catch (error) {
        alert(`Could not open default pattern: ${error.message}`);
    } finally {
        uiManager.hideSpinner();
    }
}

async function upload() {
    if (!requireCloudSignIn()) {
        return;
    }
    if (currentCloudFile && currentCloudFile.ownerSub !== googleUserId) {
        alert("Sign in with the Google account that opened this cloud file to save your changes.");
        return;
    }

    const currentPattern = patternLoader.getCurrentPattern();
    if (!currentPattern) {
        alert("There is no pattern to upload.");
        return;
    }

    const name = currentCloudFile?.name || prompt(
        "Name for this cloud file:",
        currentPattern.properties?.name || "Cross-stitch pattern"
    );
    if (!name) {
        return;
    }

    try {
        uiManager.showSpinner("Saving cloud file...");
        const pattern = patternLoader.exportPattern(buildSettingsPayload());
        const isUpdate = Boolean(currentCloudFile);
        const etag = isUpdate ? normalizeCloudEtag(currentCloudFile.etag) : null;
        if (isUpdate && !etag) {
            throw new Error("This cloud file's version is missing or invalid. Download it again before saving.");
        }
        const path = isUpdate
            ? `/api/files/${encodeURIComponent(currentCloudFile.id)}`
            : "/api/files";
        const headers = { "Content-Type": "application/json" };
        if (isUpdate) {
            headers["If-Match"] = etag;
        }

        const response = await cloudApiRequest(path, {
            method: isUpdate ? "PUT" : "POST",
            headers,
            body: JSON.stringify({ name, pattern })
        });

        if (response.status === 409) {
            const error = await readCloudError(response);
            if (error.details.error === "duplicate_file_name") {
                throw new Error("A cloud file with this name already exists. Choose a different name.");
            }
            throw new Error("This cloud file changed in another session. Download the latest copy before saving again.");
        }
        if (!response.ok) {
            throw await readCloudError(response);
        }

        const result = await response.json();
        currentCloudFile = {
            id: result.id,
            name: result.name,
            etag: normalizeCloudEtag(response.headers.get("ETag"))
                || normalizeCloudEtag(result.etag),
            ownerSub: currentCloudFile?.ownerSub || googleUserId
        };
        alert("Cloud file saved successfully.");
    } catch (error) {
        alert(`Could not save cloud file: ${error.message}`);
    } finally {
        uiManager.hideSpinner();
    }
}

function buildSettingsPayload() {
    const currentPattern = patternLoader.getCurrentPattern();
    const selectedColor = gridManager.highlightedColor;
    let lastSelectedID = -1;

    if (selectedColor && currentPattern && currentPattern.colors) {
        const matchingColor = currentPattern.colors.find(color => color.dmcCode === selectedColor);
        if (matchingColor) {
            lastSelectedID = Number(matchingColor.id);
        }
    }

    return {
        highFlag: Boolean(gridManager.highFlag),
        contrastFlag: Boolean(gridManager.contrastFlag),
        lastSelectedID
    };
}

function applyLoadedSettings(settings, promptForSettings = false) {
    if (!settings || typeof settings !== 'object') {
        return false;
    }

    if (promptForSettings) {
        const shouldLoad = confirm('This pattern file contains saved settings. Load them?');
        if (!shouldLoad) {
            return false;
        }
    }

    const currentPattern = patternLoader.getCurrentPattern();
    gridManager.highFlag = Boolean(settings.highFlag);
    gridManager.contrastFlag = Boolean(settings.contrastFlag);

    if (Number.isInteger(Number(settings.lastSelectedID)) && Number(settings.lastSelectedID) >= 0) {
        const matchingColor = currentPattern && currentPattern.colors
            ? currentPattern.colors.find(color => Number(color.id) === Number(settings.lastSelectedID))
            : null;

        if (matchingColor) {
            gridManager.highlightedColor = matchingColor.dmcCode;
            gridManager.highlightedSymbol = matchingColor.symbol;
            gridManager.updateColorSelectorUI(matchingColor.dmcCode, matchingColor.symbol);
        }
    }

    if (gridManager.highFlag) {
        gridManager.activateUIToolState('highTool');
    }

    gridManager.refreshCanvas(true);
    return true;
}

window.onload = async function() {
    try {
        uiManager.showSpinner();
        const pattern = await patternLoader.loadPattern(jsonFiles[currIndex]);
        loadJSON(pattern);
    } catch (error) {
        console.error('Failed to load initial pattern:', error);
    } finally {
        uiManager.hideSpinner();
    }
}

async function loadNextFile() {
    try {
        uiManager.showSpinner();
        const pattern = await patternLoader.loadNextPattern();
        loadJSON(pattern);
    } catch (error) {
        console.error('Failed to load next pattern:', error);
    } finally {
        uiManager.hideSpinner();
    }
}

function addChangesToJsonObject() {
    let tiles = document.querySelectorAll('[data-tile-change]');
    const currentPattern = patternLoader.getCurrentPattern();

    currentPattern.stitches.forEach(stitch => {
        for(let i=0; i<tiles.length; i++) {
            let X = tiles[i].getAttribute('data-tile-x');
            let Y = tiles[i].getAttribute('data-tile-y');
            if(stitch.X == X && stitch.Y == Y) {
                // Record the change in PatternLoader
                patternLoader.recordChange(X, Y, 'stitched', stitch.dmcCode);
                // After this the change will be undoable
                tiles[i].removeAttribute('data-tile-change');
                tiles[i].removeAttribute('data-tile-orig-code');
                let tileTitle = "STITCHED - X: " + X + " - Y: " + Y;
                tiles[i].setAttribute('title', tileTitle);
                stitch.dmcCode = 'stitched';
            }
        }
    })
    return;
}

function loadJSON(data, options = {}) {
    const { promptForSettings = false, cloudFile = null } = options;

    // Data is already processed by PatternLoader
    const processedData = data;

    // Initialize color array in GridManager
    gridManager.initializeColorArray(processedData);
    uiManager.fillFlossUsage();

    //Create all divs for tiles
    //One additional because the array starts at zero
    //Another additional
    cols = processedData.stitches[processedData.stitches.length-1].X+1
    rows = processedData.stitches[processedData.stitches.length-1].Y+1

    // Reset flags for regular tool state transitions, but preserve highlight/contrast
    // when the loaded file does not contain saved settings.
    gridManager.paintFlag = false;
    gridManager.bucketFlag = false;
    gridManager.pathFlag = false;

    gridManager.initializeCanvas();
    gridManager.resetCanvasZoom();
    gridManager.clearUIToolStates();

    if (processedData.settings) {
        applyLoadedSettings(processedData.settings, promptForSettings);
    }

    gridManager.refreshCanvas(true);

    // Adjust tile container height
    tileContainer.style.height = (document.body.offsetHeight - 130 - 25)+"px";

    uiManager.updateFootnote("Loaded pattern"); 
    currentCloudFile = cloudFile;
}

async function openFile() {
    let input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if(file) {
            try {
                uiManager.showSpinner();
                const pattern = await patternLoader.loadFromFile(file);
                loadJSON(pattern, { promptForSettings: true });
            } catch (error) {
                alert('Error loading file: ' + error.message);
            } finally {
                uiManager.hideSpinner();
            }
        }
    };
    input.click();
}

function previewClose() {
    let modal = document.getElementById("previewModal");
    modal.style.display = "none";
}

function previewOpen() {
    const currentPattern = patternLoader.getCurrentPattern();
    uiManager.preview();
    let modal = document.getElementById("previewModal");
    modal.style.display = "block";
}


function save() {
    // patternLoader.mergeChanges();
    // addChangesToJsonObject();
    uiManager.fillFlossUsage();
    // console.log(gridManager.colorArray);

    const exportData = patternLoader.exportPattern(buildSettingsPayload());
    var text2write = JSON.stringify(exportData);
    
    var element = document.createElement('a');

    // Date object
    const date = new Date();

    let currentDay= String(date.getDate()).padStart(2, '0');
    let currentMonth = String(date.getMonth()+1).padStart(2,"0");
    let currentYear = date.getFullYear();

    let hour = String(date.getHours()).padStart(2, '0');
    let mins = String(date.getMinutes()).padStart(2, '0');
    let secs = String(date.getSeconds()).padStart(2, '0');
    // we will display the date as DD-MM-YYYY 

    let currentDate = `${currentYear}-${currentMonth}-${currentDay}_${hour}-${mins}-${secs}`;

    let fileName = prompt("File name:", "");
    if (fileName == null || fileName == "") {
        fileName = "out";
    }

    let outFile = fileName + '_' + currentDate + '.json'; 

    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text2write));
    element.setAttribute('download', outFile);
    console.log("Saving file: " + outFile);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
}

function selectColor(color, symbol) {
    gridManager.selectColor(color, symbol);
}

function tileClick(obj) {
    const x = Number(obj.getAttribute('data-tile-x'));
    const y = Number(obj.getAttribute('data-tile-y'));
    gridManager.handleTileClick(x, y);
}

window.onclick = function(event) {
    let modal = document.getElementById("myModal");
    if(event.target == modal) {
        modal.style.display = "none";
    }
}

window.addEventListener('resize', function(event) {
    var body = document.body;
    var height = body.offsetHeight - 130 - 25; // total minus the 2 toolbars and some margin
    tileContainer.style.height = height+"px";
}, true);

// Expose functions to global scope for HTML onclick attributes
window.openFile = openFile;
window.save = save;
window.loadNextFile = loadNextFile;
window.previewOpen = previewOpen;
window.previewClose = previewClose;
window.download = download;
window.upload = upload;
window.openDefaultPatterns = openDefaultPatterns;
window.closeCloudFileDialog = closeCloudFileDialog;

document.getElementById("googleSignOutButton").addEventListener("click", signOutFromGoogle);
void initializeGoogleSignIn();

// UI manager tool functions
window.flossUsageOpen = () => uiManager.flossUsageOpen();
window.flossUsageClose = () => uiManager.flossUsageClose();
window.previewPath = (type) => uiManager.previewPath(type);
window.drawPath = () => uiManager.drawPath();

// Grid manager tool functions
window.highlight = () => gridManager.activateHighlight();
window.paint = () => gridManager.activatePaint();
window.bucket = () => gridManager.activateBucket();
window.restore = () => gridManager.activateRestore();
window.undo = () => gridManager.undo();
window.highContrast = () => gridManager.activateHighContrast();
window.zoomIn = () => gridManager.zoomIn();
window.zoomOut = () => gridManager.zoomOut();
window.zoomReset = () => gridManager.zoomReset();
window.pathToggle = () => gridManager.pathToggle();

window.selectColor = selectColor;
window.tileClick = tileClick;

// Tile canvas event listeners
document.querySelector('#tileCanvas').addEventListener('wheel', function(e) {
    const zoomAmount = -e.deltaY * gridManager.scrollSensitivity;
    gridManager.adjustCanvasZoom(zoomAmount, null, e);
});

document.querySelector('#tileCanvas').addEventListener('mousedown', function(e) {
    gridManager.onPointerDown(e);
});

document.querySelector('#tileCanvas').addEventListener('mouseup', function(e) {
    gridManager.onPointerUp(e);
});

document.querySelector('#tileCanvas').addEventListener('mousemove', function(e) {
    gridManager.onPointerMove(e);
});

document.querySelector('#tileCanvas').addEventListener('touchstart', function(e) {
    e.preventDefault();
    gridManager.handleTouch(e, function(e) {
        gridManager.onPointerDown(e);
    });
}, {passive: false});

document.querySelector('#tileCanvas').addEventListener('touchmove', function(e) {
    e.preventDefault();
    gridManager.handleTouch(e, function(e) {
        gridManager.onPointerMove(e);
    });
}, {passive: false});

document.querySelector('#tileCanvas').addEventListener('touchend', (e) => {
    // console.log("Touch end detected");
    e.preventDefault();
    gridManager.handleTouch(e, gridManager.onTouchEnd(e));
}, {passive: false});


// Prevent right-click context menu on canvas
document.querySelector('#tileCanvas').addEventListener('contextmenu', function(e) {
    e.preventDefault();
});