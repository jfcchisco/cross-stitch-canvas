import PatternLoader from "./load-pattern.js";
import GridManager from "./grid-manager.js";
import UIManager from "./ui-manager.js";
import PathRenderer from "./path-renderer.js";
import GoogleAuth from "./google-auth.js";
import CloudFileService, { normalizeEtag } from "./cloud-file-service.js";
import CloudFileDialog from "./cloud-file-dialog.js";

const GOOGLE_CLIENT_ID = "877144070400-ka6bh05tm1nrfndfhms8tl2ohecn957g.apps.googleusercontent.com";
const CLOUD_API_BASE_URL = "https://pattern-file-worker.jfcchisco.workers.dev";
let currentCloudFile = null;

const tileContainer = document.getElementsByClassName("tile-container")[0];

const patternLoader = new PatternLoader();
const pathRenderer = new PathRenderer();
const uiManager = new UIManager(pathRenderer);
const gridManager = new GridManager(patternLoader, uiManager);
const googleAuth = new GoogleAuth(GOOGLE_CLIENT_ID);
const cloudFileService = new CloudFileService(
    CLOUD_API_BASE_URL,
    () => googleAuth.idToken,
    () => googleAuth.signOut()
);
const cloudFileDialog = new CloudFileDialog();
uiManager.getGridManager(gridManager);
uiManager.getPatternLoader(patternLoader);

let jsonFiles = ['json/cubs.json', 'json/liverpool.json', 'json/japan.json', 'json/northern.json', 'json/cuphead.json', 'json/dino.json', 'json/amsterdam.json', 'json/african.json', 'json/messi.json'];
let currIndex = 0;

function requireCloudSignIn() {
    if (!googleAuth.idToken) {
        alert("Please sign in with Google to use cloud files.");
        return false;
    }
    if (CLOUD_API_BASE_URL.startsWith("https://replace-with-your-worker")) {
        alert("Set CLOUD_API_BASE_URL in script.js to your deployed Cloudflare Worker URL.");
        return false;
    }
    return true;
}

function exportPatternWithThumbnail() {
    const pattern = patternLoader.exportPattern(buildSettingsPayload());
    const thumbnail = gridManager.createOriginalThumbnail();
    if (thumbnail) {
        pattern.thumbnail = thumbnail;
    }
    return pattern;
}

async function download() {
    if (!requireCloudSignIn()) {
        return;
    }

    let files;
    try {
        uiManager.showSpinner("Loading cloud files...");
        files = await cloudFileService.listUserFiles();
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

    const selectedFileId = await cloudFileDialog.choose(files, "Open cloud pattern", "No cloud files found.");
    if (!selectedFileId) {
        return;
    }

    try {
        uiManager.showSpinner("Downloading cloud file...");
        const { data: rawPattern, etag: responseEtag } = await cloudFileService.getUserFile(selectedFileId);
        const pattern = patternLoader.loadJSON(rawPattern);
        const selectedFile = files.find(file => file.id === selectedFileId);
        const etag = responseEtag || normalizeEtag(selectedFile?.etag);
        if (!etag) {
            throw new Error("The server did not provide a version for this file. Please reload the cloud file list and try again.");
        }
        loadJSON(pattern, {
            promptForSettings: true,
            cloudFile: {
                id: selectedFileId,
                name: selectedFile?.name || "Untitled pattern",
                etag,
                ownerSub: googleAuth.userId
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
        files = await cloudFileService.listDefaultFiles();
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

    const selectedFileKey = await cloudFileDialog.choose(files, "Open default pattern", "No default patterns found.");
    if (!selectedFileKey) {
        return;
    }

    try {
        uiManager.showSpinner("Opening default pattern...");
        const { data: rawPattern } = await cloudFileService.getDefaultFile(selectedFileKey);
        const pattern = patternLoader.loadJSON(rawPattern);
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
    if (currentCloudFile && currentCloudFile.ownerSub !== googleAuth.userId) {
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
        const pattern = exportPatternWithThumbnail();
        const isUpdate = Boolean(currentCloudFile);
        const etag = isUpdate ? normalizeEtag(currentCloudFile.etag) : null;
        if (isUpdate && !etag) {
            throw new Error("This cloud file's version is missing or invalid. Download it again before saving.");
        }
        const result = await cloudFileService.saveFile({
            id: currentCloudFile?.id,
            name,
            pattern,
            etag
        });
        currentCloudFile = {
            id: result.id,
            name: result.name,
            etag: result.etag,
            ownerSub: currentCloudFile?.ownerSub || googleAuth.userId
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
    gridManager.setHighlightState(Boolean(settings.highFlag));
    gridManager.setContrastState(Boolean(settings.contrastFlag));

    if (Number.isInteger(Number(settings.lastSelectedID)) && Number(settings.lastSelectedID) >= 0) {
        const matchingColor = currentPattern && currentPattern.colors
            ? currentPattern.colors.find(color => Number(color.id) === Number(settings.lastSelectedID))
            : null;

        if (matchingColor) {
            gridManager.selectColor(matchingColor.dmcCode, matchingColor.symbol);
        }
    }

    gridManager.syncGridToolState();
    gridManager.refreshCanvas(true);
    return true;
}

async function initializeApplication() {
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
    // Reset edit and route state for regular pattern transitions. Highlight and
    // contrast remain available until settings are applied or preserved by the caller.
    gridManager.resetInteractionState();

    // Set the final viewport size before initializing the canvas layers and zoom.
    tileContainer.style.height = (document.body.offsetHeight - 130 - 25)+"px";
    gridManager.initializeCanvas();
    gridManager.resetCanvasZoom();
    gridManager.syncGridToolState();

    if (processedData.settings) {
        applyLoadedSettings(processedData.settings, promptForSettings);
    }

    gridManager.refreshCanvas(true);

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
    uiManager.preview();
    let modal = document.getElementById("previewModal");
    modal.style.display = "block";
}


function save() {
    uiManager.fillFlossUsage();

    const exportData = exportPatternWithThumbnail();
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

function bindUiEvents() {
    const actions = {
        openFile,
        save,
        download,
        upload,
        openDefaultPatterns,
        flossUsageOpen: () => uiManager.flossUsageOpen(),
        flossUsageClose: () => uiManager.flossUsageClose(),
        highlight: () => gridManager.activateHighlight(),
        paint: () => gridManager.activatePaint(),
        bucket: () => gridManager.activateBucket(),
        restore: () => gridManager.activateRestore(),
        highContrast: () => gridManager.activateHighContrast(),
        previewOpen,
        previewClose,
        previewPath: () => uiManager.previewPath(Number(document.getElementById("pathSelect").value)),
        drawPath: () => uiManager.drawPath(),
        zoomIn: () => gridManager.zoomIn(),
        zoomOut: () => gridManager.zoomOut(),
        zoomReset: () => gridManager.zoomReset(),
        pathToggle: () => gridManager.pathToggle(),
        loadNextFile,
        closeCloudFileDialog: () => cloudFileDialog.close()
    };

    document.querySelectorAll("[data-action]").forEach(element => {
        const action = actions[element.dataset.action];
        if (!action) {
            throw new Error(`Unknown UI action: ${element.dataset.action}`);
        }

        const eventName = element instanceof HTMLSelectElement ? "change" : "click";
        element.addEventListener(eventName, action);
    });

    document.getElementById("myModal").addEventListener("click", event => {
        if (event.target === event.currentTarget) {
            uiManager.flossUsageClose();
        }
    });

    document.getElementById("googleSignOutButton").addEventListener("click", () => googleAuth.signOut());
    document.getElementById("tileCanvas").addEventListener("wheel", event => {
        const zoomAmount = -event.deltaY * gridManager.scrollSensitivity;
        gridManager.adjustCanvasZoom(zoomAmount, null, event);
    });

    document.getElementById("tileCanvas").addEventListener("mousedown", event => gridManager.onPointerDown(event));
    document.getElementById("tileCanvas").addEventListener("mouseup", event => gridManager.onPointerUp(event));
    document.getElementById("tileCanvas").addEventListener("mousemove", event => gridManager.onPointerMove(event));

    document.getElementById("tileCanvas").addEventListener("touchstart", event => {
        event.preventDefault();
        gridManager.handleTouch(event, touchEvent => gridManager.onPointerDown(touchEvent));
    }, { passive: false });

    document.getElementById("tileCanvas").addEventListener("touchmove", event => {
        event.preventDefault();
        gridManager.handleTouch(event, touchEvent => gridManager.onPointerMove(touchEvent));
    }, { passive: false });

    document.getElementById("tileCanvas").addEventListener("touchend", event => {
        event.preventDefault();
        gridManager.handleTouch(event, gridManager.onTouchEnd(event));
    }, { passive: false });

    document.getElementById("tileCanvas").addEventListener("contextmenu", event => event.preventDefault());

    window.addEventListener('resize', function() {
        const height = document.body.offsetHeight - 130 - 25;
        tileContainer.style.height = `${height}px`;
        if (patternLoader.getCurrentPattern()) {
            gridManager.renderCanvas();
        }
    }, true);

    void googleAuth.initialize();
    void initializeApplication();
}

bindUiEvents();