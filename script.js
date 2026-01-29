import PatternLoader from "./load-pattern.js";
import GridManager from "./grid-manager.js";
import UIManager from "./ui-manager.js";

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

function loadJSON(data) {
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

    gridManager.initializeCanvas();
    gridManager.resetCanvasZoom();
    gridManager.refreshCanvas();

/*     
    gridManager.initializeGrid(cols, rows);

    gridManager.updateTileAttributes(processedData.stitches);
    gridManager.refreshGridDisplay();
    gridManager.drawGridLines(); */

    // Adjust tile container height
    tileContainer.style.height = (document.body.offsetHeight - 130 - 25)+"px";

    uiManager.updateFootnote("Loaded pattern"); 
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
                loadJSON(pattern);
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
    uiManager.preview(currentPattern.stitches, currentPattern.properties.width, currentPattern.properties.height);
    let modal = document.getElementById("previewModal");
    modal.style.display = "block";
}


function save() {
    patternLoader.mergeChanges();
    addChangesToJsonObject();
    uiManager.fillFlossUsage();

    const exportData = patternLoader.exportPattern();
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

// UI manager tool functions
window.flossUsageOpen = () => uiManager.flossUsageOpen();
window.flossUsageClose = () => uiManager.flossUsageClose();
window.previewPath = (type) => uiManager.previewPath(type);
window.drawSVG = () => uiManager.drawSVG();

// Grid manager tool functions
window.highlight = () => gridManager.activateHighlight();
window.paint = () => gridManager.activatePaint();
window.bucket = () => gridManager.activateBucket();
window.undo = () => gridManager.undo();
window.highContrast = () => gridManager.activateHighContrast();
window.zoomIn = () => gridManager.zoomIn();
window.zoomOut = () => gridManager.zoomOut();
window.zoomReset = () => gridManager.zoomReset();

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
    console.log("Touch end detected");
    e.preventDefault();
    gridManager.handleTouch(e, gridManager.onTouchEnd(e));
}, {passive: false});


// Prevent right-click context menu on canvas
document.querySelector('#tileCanvas').addEventListener('contextmenu', function(e) {
    e.preventDefault();
});
