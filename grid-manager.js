import GridCanvasRenderer from "./grid-canvas-renderer.js";

/**
 * GridManager Class
 * Manages the grid of tiles for the cross-stitch pattern.
 * Handles tool interactions, tile updates, and color management.
 * Depends on PatternLoader and UIManager.
 */
class GridManager {
    constructor(patternLoader, uiManager) {
        this.tileContainer = document.getElementsByClassName("tile-container")[0];
        this.tileCanvas = document.getElementById("tileCanvas");
        this.highlightCanvas = document.getElementById("highlightCanvas");
        this.patternLoader = patternLoader;
        this.uiManager = uiManager;
        this.activeTool = null;
        this.toolMode = null;
        this.pathRequested = false;
        this.highlightedColor = null;
        this.highlightedSymbol = null;
        this.changeCounter = 0;
        this.contrastFlag = false; // High contrast mode flag
        this.paintFlag = false; // Paint mode flag
        this.bucketFlag = false; // Bucket mode flag
        this.restoreFlag = false; // Restore mode flag
        this.highFlag = false; // Highlight mode flag
        this.pathFlag = false; // Path visibility flag
        this.zoomResetFlag = false; 
        this.maxHeight = 50;
        this.minHeight = 10;
        this.defaultHeight = 20;
        // Canvas parameters
        this.tileSize = 15;
        this.cameraOffset = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        this.maxZoom = 1.25;
        this.minZoom = 0.5;
        this.scrollSensitivity = 0.0005;
        this.cameraZoom = this.minZoom;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.mouseDown = { x: 0, y: 0 };
        this.mouseUp = { x: 0, y: 0 };
        this.canvasClick = { x: 0, y: 0 };
        this.initialPinchDistance = null;
        this.lastZoom = this.cameraZoom;
        this.renderScheduled = false;
        this.patternCanvas = document.createElement('canvas');
        this.patternCanvas.width = 0;
        this.patternCanvas.height = 0;
        // Fast lookup of tiles changed by the user (x,y keys)
        this.changedTiles = new Set();
        this.stitchesByColor = new Map();
        this.patternCacheDirty = true;
        this.lastClickedX = 0;
        this.lastClickedY = 0;
        this.canvasRenderer = new GridCanvasRenderer(
            this,
            uiManager.pathRenderer,
            () => uiManager.CLUSTER_SEQUENCE
        );
    }

    /**
     * TOOL ACTIVATION AND INTERACTION HANDLERS
     */

    // Tool activation methods
    setToolMode(mode) {
        const normalizedMode = mode === "paint" || mode === "bucket" || mode === "restore" ? mode : null;
        this.toolMode = normalizedMode;
        this.activeTool = normalizedMode;
        this.paintFlag = normalizedMode === "paint";
        this.bucketFlag = normalizedMode === "bucket";
        this.restoreFlag = normalizedMode === "restore";
        this.syncGridToolState();
    }

    toggleToolMode(mode) {
        this.setToolMode(this.toolMode === mode ? null : mode);
    }

    activatePaint() {
        this.toggleToolMode("paint");
    }

    activateBucket() {
        this.toggleToolMode("bucket");
    }

    activateRestore() {
        this.toggleToolMode("restore");
    }

    activateHighlight() {
        this.setHighlightState(!this.highFlag);
    }

    setHighlightState(enabled) {
        this.highFlag = Boolean(enabled);
        if (!this.highFlag) {
            this.pathRequested = false;
            this.pathFlag = false;
        } else {
            this.syncPathState();
        }
        this.syncGridToolState();
        this.renderHighlightLayer();
    }

    pathToggle() {
        const valid = this.isPathAvailable();
        if (!valid) {
            this.pathRequested = false;
            this.pathFlag = false;
            this.syncGridToolState();
            this.uiManager.updateFootnote(this.getPathUnavailableMessage());
            this.renderHighlightLayer();
            return;
        }
        this.pathRequested = !this.pathRequested;
        this.pathFlag = this.pathRequested;
        this.syncGridToolState();
        this.renderHighlightLayer();
    }

    activateHighContrast() {
        this.toggleHighContrast();
    }

    deactivateTools() {
        this.setToolMode(null);
    }

    // Main interaction handler
    handleTileClick(x, y) {
        // const tile = this.getTile(x, y);
        // if (!tile) return;

        const code = this.getCoordinateColors(x, y);
        if(!code) return;
        this.lastClickedX = x + 1;
        this.lastClickedY = y + 1;
        // console.log("TILE CLICK");
        // this.getTileValues(x, y);
        // this.displayCoordinateInfo(x, y);
        this.uiManager.updateFootnote(`Tile (X: ${x+1}, Y: ${y+1}) - Code: ${code} - ${this.getDMCValuesFromCode(code).dmcName}`);
        if (this.paintFlag) {
            if(this.highFlag && this.highlightedColor !== code) {
                return; // Cannot paint non-highlighted colors
            }
            return this.handlePaint(x, y, code);
        } 
        else if (this.bucketFlag) {
            if(this.highFlag && this.highlightedColor !== code) {
                return; // Cannot bucket-fill non-highlighted colors
            }
            return this.handleBucketFill(x, y, code);
        } 
        else if(this.restoreFlag) {
            if(this.highFlag && this.highlightedColor !== code) {
                return; // Cannot restore non-highlighted colors
            }
            if(code !== 'stitched') {
                // alert("Only stitched tiles can be restored.");
                return 0;
            }
            // this.displayCoordinateInfo(x, y);
            console.log(this.getTileOriginalCode(x, y));
            return this.handleRestore(x, y, this.getTileOriginalCode(x, y));
            
        }

        else if (this.highFlag) {
            return this.handleHighlight(x, y, code);
        }

    }

    // ===== IMPLEMENTATION DETAILS =====

    handlePaint(x, y, code) {
        if(code === 'stitched' || code === 'empty') {
            return 0; // Tile already stitched
        }
        // Update the tile's code in the pattern data
        this.updateCode(x, y, 'stitched');
        //this.displayCoordinateInfo(x, y);
        this.updateChangesToColorArray('stitched', code, 1);

        // Record change for undo functionality
       /*  this.changeCounter++;
        this.patternLoader.changeCounter = this.changeCounter;
        this.patternLoader.recordChange(x, y, 'stitched', code); */
        // Track changed tile for fast checks
        // this.changedTiles.add(`${x},${y}`);
        
        // Draw only the changed tile into the cached pattern and composite once
        const patternCtx = this.patternCanvas.getContext('2d');
        this.drawChangedTileToPatternCanvas(patternCtx, x, y, 'stitched', code);
        // Composite updated cache to visible canvas (throttled by renderScheduled)
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                this.renderScheduled = false;
            });
        }
        this.uiManager.updateFootnote("1 stitch painted");
        


    }

    handleBucketFill(startX, startY, fillColor) {
        if(fillColor === 'stitched' || fillColor === 'empty') {
            return 0; // Cannot fill stitched or empty areas
        }
        // Get all connected tiles of the same color
        const tilesToFill = this.getConnectedTiles(startX, startY, fillColor);
        
        // Safety check for large fills
        if (tilesToFill.length > 100) {
            const confirmed = confirm(`${tilesToFill.length} stitches will be painted. Continue?`);
            if (!confirmed) return 0;
        }


        
        // Record change for undo functionality
        // this.changeCounter++;
        // this.patternLoader.changeCounter = this.changeCounter;
        
        // Apply paint to all connected tiles and draw them directly to cache
        let tilesAffected = 0;
        const patternCtx = this.patternCanvas.getContext('2d');
        for (let {x, y} of tilesToFill) {
            this.updateCode(x, y, 'stitched');
            this.updateChangesToColorArray('stitched', fillColor, 1);
            this.drawChangedTileToPatternCanvas(patternCtx, x, y, 'stitched', fillColor);
            /* this.patternLoader.recordChange(x, y, 'stitched', fillColor);
            this.updateChangesToColorArray(fillColor, 1);
            this.changedTiles.add(`${x},${y}`);
            this.drawChangedTileToPatternCanvas(patternCtx, x, y, fillColor); */
            tilesAffected++;
        }

        // Composite updated cache once (throttled)
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                this.renderScheduled = false;
            });
        }

        this.uiManager.updateFootnote(`${tilesAffected} stitches painted`);
        return tilesAffected;
    }

    handleRestore(x, y, code) {
        // console.log("handleRestore called for tile: ", x, y);
        if(this.getTileOriginalCode(x, y) === null) {
            return 0; // No original code to restore to
        }
        
        this.updateCode(x, y, code);
        this.updateChangesToColorArray(code, 'stitched', 1);
        const patternCtx = this.patternCanvas.getContext('2d');
        this.drawChangedTileToPatternCanvas(patternCtx, x, y, code, 'stitched');
        
        if(!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                this.renderScheduled = false;
            });
        } 
        this.uiManager.updateFootnote("Tile restored to original color");
        
        // this.patternCacheDirty = true; // Mark cache dirty to trigger full redraw with restore changes
        // this.refreshCanvas(true); // Force redraw to show restored tile

        // this.displayCoordinateInfo(x, y);

        // Find the original code for this tile
        /* let originalCode = null;
        for(let change of this.patternLoader.changes) {
            if(change.X == x && change.Y == y) {
                originalCode = change.originalCode;
                break;
            }
        }
        if(!originalCode) {
            return 0; // No change record found, cannot restore
         }*/
        // Record the restore action as a new change for undo functionality
        /* this.changeCounter++;
        this.patternLoader.changeCounter = this.changeCounter;
        this.patternLoader.recordChange(x, y, 'restore', originalCode);
        this.updateChangesToColorArray(originalCode, -1);
        this.changedTiles.delete(`${x},${y}`);
        // Draw only the changed tile into the cached pattern and composite once
        
        this.drawChangedTileToPatternCanvas(patternCtx, x, y, originalCode); */
        // Composite updated cache to visible canvas (throttled by renderScheduled)

        
        /* if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                this.renderScheduled = false;
            });
        } */
        // 
        return;
    }

    handleHighlight(x, y, code) {
        const symbol = this.getTileSymbol(code);
        
        // Select the color 
        this.selectColor(code, symbol);
        this.uiManager.updateFootnote(`Tile (X: ${x+1}, Y: ${y+1}) - Code: ${code} - ${this.getDMCValuesFromCode(code).dmcName}`);
        return 0; // No tiles directly modified
    }

    undo() {
        if(this.patternLoader.changeCounter == 0) {
            return;
        }
        for(let i=this.patternLoader.changes.length-1; i>=0; i--) {
            let changeToUndo = this.patternLoader.changes[i];
            if(changeToUndo.id == this.patternLoader.changeCounter) {
                this.patternLoader.changes.splice(i, 1);
                this.updateChangesToColorArray(changeToUndo.originalCode, -1);
                // remove from changed set so isTileChanged is accurate
                this.changedTiles.delete(`${changeToUndo.X},${changeToUndo.Y}`);
            }
        }
        this.patternLoader.changeCounter--;
        // Rebuild the pattern cache because some tiles reverted
        this.patternCacheDirty = true;
        this.refreshCanvas(true);
        this.uiManager.updateFootnote("Change undone");
        
    }

    updateChangesToColorArray(newCode, origCode, totalChanges) {
        let colorArray = this.getColorArray();
        colorArray.map(color => {
            if(color.code === origCode) color.count -= totalChanges;
            if(color.code === newCode) color.count += totalChanges;
        })
    }

    setHeight(newHeight) {
        const collection = document.getElementsByClassName("tile");
        let newHeightStyle = newHeight + "px";
        let newFontSizeStyle = Math.round((newHeight*3)/4) + "px";

        for (let i = 0; i < collection.length; i++) {
            collection[i].style.height = newHeightStyle;
            collection[i].style.width = newHeightStyle;
            collection[i].children.item(0).style.fontSize = newFontSizeStyle;
        }

    }

    zoomIn() {
        const zoomAmount = 100 * this.scrollSensitivity;
        this.cameraZoom += zoomAmount;
        
        // Schedule a single render instead of rendering on every move
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                this.renderScheduled = false;
            });
        }
    }

    zoomOut() {
        const zoomAmount = -100 * this.scrollSensitivity;
        this.cameraZoom += zoomAmount;

        if(this.cameraZoom > this.maxZoom) {
            this.cameraZoom = this.maxZoom;
        }
        if(this.cameraZoom < this.minZoom) {
            this.cameraZoom = this.minZoom;
        }

        // Schedule a single render instead of rendering on every move
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                this.renderScheduled = false;
            });
        }
    }

    zoomReset() {
        const canvas = document.getElementById('tileCanvas');
        this.minZoom = Math.min(this.tileContainer.offsetHeight / canvas.height, this.tileContainer.offsetWidth / canvas.width) * 0.95;
        this.cameraZoom = this.minZoom;
        this.cameraOffset = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        // Schedule a single render instead of rendering on every move
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                
                this.renderScheduled = false;
            });
        }

    }

    // ===== HELPER METHODS =====

    isTileChanged(x, y) {
        return this.changedTiles.has(`${x},${y}`);
    }

    // Draw a single changed tile into the pattern cache canvas.
    drawChangedTileToPatternCanvas(patternCtx, tileX, tileY, newCode, origCode) {
        // Ensure pattern cache exists and is in-sync
        const canvas = document.getElementById('tileCanvas');
        this.canvasRenderer.ensureCanvasSize(canvas);
        // console.log(this.patternCacheDirty, this.patternCanvas.width, canvas.width, this.patternCanvas.height, canvas.height);
        if (this.patternCacheDirty || this.patternCanvas.width !== canvas.width || this.patternCanvas.height !== canvas.height) {
            // console.log("Pattern cache out of sync, rebuilding...");
            this.canvasRenderer.cleanPatternCache(canvas);
            this.patternCacheDirty = false;
        }
        patternCtx = this.patternCanvas.getContext('2d');
        if (!patternCtx) return;
        const x = tileX * this.tileSize;
        const y = tileY * this.tileSize;
        const colorData = (newCode === "stitched") ? this.getDMCValuesFromCode(origCode) : this.getDMCValuesFromCode(newCode);
        const R = colorData.R;
        const G = colorData.G;
        const B = colorData.B;
        const symbol = colorData.symbol;
        const code = newCode;
        const [color, spanColor] = this.getTileColorsBasedOnFlags(code, R, G, B, false);

        // Paint background
        patternCtx.fillStyle = color;
        patternCtx.clearRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);
        patternCtx.fillRect(x + 1, y + 1, this.tileSize - 2, this.tileSize - 2);
        // Draw stitched X
        if(newCode === "stitched"){
            patternCtx.beginPath();
            patternCtx.strokeStyle = spanColor;
            patternCtx.lineWidth = 2;
            patternCtx.moveTo(x + 3, y + 3);
            patternCtx.lineTo(x + this.tileSize - 3, y + this.tileSize - 3);
            patternCtx.moveTo(x + this.tileSize - 3, y + 3);
            patternCtx.lineTo(x + 3, y + this.tileSize - 3);
            patternCtx.stroke();
        } else {
            console.log("Drawing symbol for code: ", newCode, " with color: ", color, ", symbol: ", symbol);
            patternCtx.fillStyle = spanColor;
            patternCtx.fillText(symbol, x + this.tileSize / 2, y + this.tileSize / 2);
        }

        // Refresh lines and rulers in case they were affected
        // this.drawLines(patternCtx);
    }

    updateCode(x, y, newCode) {
        for(let stitch of this.patternLoader.getCurrentPattern().stitches) {
            if(stitch.X == x && stitch.Y == y) {
                const oldCode = stitch.dmcCode;
                if(newCode === 'stitched') {
                    stitch.origCode = stitch.dmcCode; // Store original code for potential restore
                }
                else {
                    stitch.origCode = null; // Clear original code if not stitched
                }
                stitch.dmcCode = newCode;
                this.updateStitchColorIndex(stitch, oldCode, newCode);
                return;
            }
        }
    }


    getConnectedTiles(startX, startY, targetColor) {
        // Prevent filling stitched or empty areas
        if (targetColor === 'stitched' || targetColor === '0') {
            return [];
        }
        
        const foundTiles = [];
        const tilesToCheck = [{x: startX, y: startY}];
        const visited = new Set();
        
        while (tilesToCheck.length > 0) {
            const current = tilesToCheck.pop();
            const key = `${current.x},${current.y}`;
            
            if (visited.has(key)) continue;
            visited.add(key);
            

            // const tile = this.getTile(current.x, current.y);
            //if (!tile) continue;
            
            const tileColor = this.getCoordinateColors(current.x, current.y);
            if(!tileColor) continue;
            // const tileColor = tile.getAttribute('data-tile-code');
            
            if (tileColor === targetColor) {
                foundTiles.push(current);
                
                // Check 4-directional neighbors
                const neighbors = [
                    {x: current.x, y: current.y - 1}, // North
                    {x: current.x, y: current.y + 1}, // South
                    {x: current.x - 1, y: current.y}, // West
                    {x: current.x + 1, y: current.y}  // East
                ];
                
                neighbors.forEach(neighbor => {
                    const neighborKey = `${neighbor.x},${neighbor.y}`;
                    if (!visited.has(neighborKey) && !this.isTileChanged(neighbor.x, neighbor.y)) {
                        tilesToCheck.push(neighbor);
                    }
                });
            }
        }
        
        return foundTiles;
    }

    selectColor(colorCode, symbol) {
        // Selecting a color ends edit modes so the new selection is not ambiguous.
        this.setToolMode(null);

        this.highlightedColor = colorCode;
        this.highlightedSymbol = symbol;

        this.syncPathState();
        this.updateColorSelectorUI(colorCode, symbol);

        this.renderHighlightLayer();
        this.uiManager.updateFootnote("Selected color: " + colorCode + " - " + this.getDMCValuesFromCode(colorCode).dmcName);
    }

    updateColorStats() {
        // Update the GridManager's colorArray
        for(let change of this.patternLoader.changes) {
            for(let color of this.colorArray) {
                if(color.code === change.originalCode) {
                    color.count--;
                } else if(color.code === 'stitched') {
                    color.count++;
                }
            }
        }
    }

    

    // ===== UTILITY METHODS =====

    displayCoordinateInfo(x, y) {
        const tileValues = this.getTileValues(x, y);
        console.log(`Tile at (X: ${x}, Y: ${y}) - DMC Code: ${tileValues.dmcCode}, Original Code: ${tileValues.origCode}`);
    }

    getCoordinateColors(x, y) {
        if(this.isTileChanged(x, y)) return "stitched";
        for(let stitch of this.patternLoader.getCurrentPattern().stitches) {
            if(stitch.X == x && stitch.Y == y) {
                return stitch.dmcCode;
            }
        }
        return null;
    }

    getTileSymbol(colorCode) {
        const currentPattern = this.patternLoader.getCurrentPattern();
        const colorObj = currentPattern.colors.find(c => c.dmcCode === colorCode);
        return colorObj ? colorObj.symbol : '?';
    }

    activateUIToolState(activeToolId) {
        const toolElement = document.getElementById(activeToolId);
        if (toolElement) {
            toolElement.classList.add('activeTool');
        }
    }

    isPathAvailable() {
        const sequence = this.uiManager?.CLUSTER_SEQUENCE;
        return Boolean(
            this.highFlag
            && this.highlightedColor
            && sequence?.length
            && this.highlightedColor === this.uiManager.SEQUENCED_COLOR
        );
    }

    getPathUnavailableMessage() {
        if (!this.highFlag) {
            return "Turn on highlight to show the path";
        }
        if (!this.uiManager?.CLUSTER_SEQUENCE?.length) {
            return "Calculate a path before showing it";
        }
        if (this.highlightedColor !== this.uiManager.SEQUENCED_COLOR) {
            return "Select the highlighted color used to calculate the path";
        }
        return "Path is unavailable";
    }

    syncPathState() {
        if (!this.isPathAvailable()) {
            this.pathRequested = false;
            this.pathFlag = false;
        } else {
            this.pathFlag = this.pathRequested;
        }
        this.syncGridToolState();
    }

    setCalculatedRoute(sequence, colorCode) {
        this.uiManager.CLUSTER_SEQUENCE = Array.isArray(sequence) ? sequence : [];
        this.uiManager.SEQUENCED_COLOR = this.uiManager.CLUSTER_SEQUENCE.length ? colorCode : null;
        if (this.highlightedColor !== colorCode) {
            this.pathRequested = false;
        }
        this.syncPathState();
        this.syncGridToolState();
        this.renderHighlightLayer();
    }

    setPathVisible(requested) {
        if (!requested) {
            this.pathRequested = false;
            this.pathFlag = false;
        } else if (this.isPathAvailable()) {
            this.pathRequested = true;
            this.pathFlag = true;
        } else {
            this.pathRequested = false;
            this.pathFlag = false;
            this.uiManager.updateFootnote(this.getPathUnavailableMessage());
        }
        this.syncGridToolState();
        this.renderHighlightLayer();
    }

    invalidateRoute(render = true) {
        if (this.uiManager) {
            this.uiManager.CLUSTER_SEQUENCE = [];
            this.uiManager.SEQUENCED_COLOR = null;
        }
        this.pathRequested = false;
        this.pathFlag = false;
        this.syncGridToolState();
        if (render) {
            this.renderHighlightLayer();
        }
    }

    resetInteractionState() {
        this.setToolMode(null);
        this.pathRequested = false;
        this.pathFlag = false;
        this.invalidateRoute();
    }

    syncGridToolState() {
        const states = {
            highTool: this.highFlag,
            contrastTool: this.contrastFlag,
            pathTool: this.pathFlag,
            paintTool: this.paintFlag,
            bucketTool: this.bucketFlag,
            restoreTool: this.restoreFlag
        };

        for (const [id, enabled] of Object.entries(states)) {
            const element = document.getElementById(id);
            if (!element) continue;
            element.classList.toggle('activeTool', enabled);
            element.setAttribute('aria-pressed', enabled ? 'true' : 'false');
        }

        const pathTool = document.getElementById('pathTool');
        if (pathTool) {
            pathTool.setAttribute('aria-disabled', this.isPathAvailable() ? 'false' : 'true');
        }
    }

    clearUIToolStates() {
        this.syncGridToolState();
    }

    updateColorSelectorUI(colorCode, symbol) {
        // Clear previous selection
        document.querySelectorAll('.colorback').forEach(el => {
            el.classList.remove('activeColor');
        });
        
        // Find and highlight the selected color
        document.querySelectorAll('.colorback').forEach(el => {
            const colorSymbol = el.querySelector('[data-color-id]');
            if (colorSymbol && colorSymbol.innerText === symbol) {
                el.classList.add('activeColor');
            }
        });
    }

    setContrastState(enabled) {
        this.contrastFlag = Boolean(enabled);
        this.patternCacheDirty = true;
        this.syncGridToolState();
        this.renderCanvas();
        return this.contrastFlag;
    }

    toggleHighContrast() {
        return this.setContrastState(!this.contrastFlag);
    }

    /**
     * GRID DRAWING METHODS
     */

    initializeCanvas() {
        const canvas = document.getElementById("tileCanvas");
        const ctx = canvas.getContext("2d");
        // Adjust tile size based on pattern dimensions, max canvas size of 5000 pixels on the longest side, minimum tile size of 10 pixels, maximum of 50 pixels
        const cols = this.patternLoader.getCols();
        const rows = this.patternLoader.getRows();
        const maxDimension = Math.max(cols, rows);
        this.tileSize = Math.min(Math.max(Math.floor(6000 / maxDimension), 20), 50);
        // Adjust max zoom based on tile size
        this.maxZoom = 50 / this.tileSize;
        
        canvas.width = cols * this.tileSize;
        canvas.height = rows * this.tileSize;
        this.canvasRenderer.resizeHighlightCanvas();
        this.buildStitchesByColor();
        this.minZoom = Math.min(this.tileContainer.offsetHeight / canvas.height, this.tileContainer.offsetWidth / canvas.width) * 0.95;
        this.cameraZoom = this.minZoom;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
    }

    cleanPatternCache(canvas) {
        this.canvasRenderer.cleanPatternCache(canvas);
    }

    ensureCanvasSize(canvas) {
        this.canvasRenderer.ensureCanvasSize(canvas);
    }

    resizeHighlightCanvas() {
        this.canvasRenderer.resizeHighlightCanvas();
    }

    refreshCanvas(visibleFlag=false) {
        if (visibleFlag) {
            this.patternCacheDirty = true;
        }
        this.renderCanvas();
    }

    renderCanvas() {
        this.canvasRenderer.renderCanvas();
    }

    renderHighlightLayer() {
        this.canvasRenderer.renderHighlightLayer();
    }

    drawHighlightedStitches(ctx, stitches) {
        if (stitches.size === 0) {
            return;
        }

        if (this.highlightedColor === "stitched") {
            for (const stitch of stitches) {
                this.drawTile(ctx, stitch, true);
            }
            return;
        }

        const colorData = this.getDMCValuesFromCode(this.highlightedColor);
        const [color, spanColor] = this.getTileColorsBasedOnFlags(
            this.highlightedColor,
            colorData.R,
            colorData.G,
            colorData.B,
            true
        );

        ctx.fillStyle = color;
        ctx.beginPath();
        for (const stitch of stitches) {
            ctx.rect(
                stitch.X * this.tileSize,
                stitch.Y * this.tileSize,
                this.tileSize,
                this.tileSize
            );
        }
        ctx.fill();

        ctx.fillStyle = spanColor;
        ctx.font = `${Math.round((this.tileSize * 3) / 4)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (const stitch of stitches) {
            ctx.fillText(
                colorData.symbol,
                (stitch.X + 0.5) * this.tileSize,
                (stitch.Y + 0.5) * this.tileSize
            );
        }
    }

    buildStitchesByColor() {
        this.stitchesByColor.clear();
        const currentPattern = this.patternLoader.getCurrentPattern();
        if (!currentPattern) {
            return;
        }

        for (const stitch of currentPattern.stitches) {
            let stitches = this.stitchesByColor.get(stitch.dmcCode);
            if (!stitches) {
                stitches = new Set();
                this.stitchesByColor.set(stitch.dmcCode, stitches);
            }
            stitches.add(stitch);
        }
    }

    updateStitchColorIndex(stitch, oldCode, newCode) {
        if (oldCode === newCode) {
            return;
        }

        const oldStitches = this.stitchesByColor.get(oldCode);
        if (oldStitches) {
            oldStitches.delete(stitch);
            if (oldStitches.size === 0) {
                this.stitchesByColor.delete(oldCode);
            }
        }

        let newStitches = this.stitchesByColor.get(newCode);
        if (!newStitches) {
            newStitches = new Set();
            this.stitchesByColor.set(newCode, newStitches);
        }
        newStitches.add(stitch);
    }

    DEBUGPrintZoomInfo() {
        console.log("-----------------------");
        console.log("--- Zoom Debug Info ---");
        console.log("-----------------------");
        console.log(`Zoom: ${this.cameraZoom}, MinZoom: ${this.minZoom}, MaxZoom: ${this.maxZoom}`);
        console.log(`OffsetX: ${this.cameraOffset.x}, OffsetY: ${this.cameraOffset.y}`);
        console.log(`TileSize: ${this.tileSize}`);
        /* console.log(`CanvasWidth: ${this.tileCanvas.width}, CanvasHeight: ${this.tileCanvas.height}`);
        console.log(`ClientWidth: ${this.tileCanvas.clientWidth}, ClientHeight: ${this.tileCanvas.clientHeight}`);
        console.log(`Canvas ClientBoundingRect: `, this.tileCanvas.getBoundingClientRect());
        console.log(`ContainerWidth: ${this.tileContainer.offsetWidth}, ContainerHeight: ${this.tileContainer.offsetHeight}`);
        console.log(`WindowWidth: ${window.innerWidth}, WindowHeight: ${window.innerHeight}`);
        console.log("-----------------------");
        console.log("--- Viewport bounds ---");
        console.log("-----------------------");
        const minX = -this.cameraOffset.x + window.innerWidth / 2;
        const minY = -this.cameraOffset.y + window.innerHeight / 2;
        const maxX = minX + this.tileContainer.offsetWidth / this.cameraZoom;
        const maxY = minY + this.tileContainer.offsetHeight / this.cameraZoom;
        const minTileX = Math.max(0, Math.floor(minX / this.tileSize));
        const maxTileX = Math.min(this.patternLoader.getCols(), Math.ceil(maxX / this.tileSize));
        const minTileY = Math.max(0, Math.floor(minY / this.tileSize));
        const maxTileY = Math.min(this.patternLoader.getRows(), Math.ceil(maxY / this.tileSize));
        console.log(`Viewport Bounds - minX: ${minX}, minY: ${minY}, maxX: ${maxX}, maxY: ${maxY}`);
        console.log(`Tile Bounds - minTileX: ${minTileX}, minTileY: ${minTileY}, maxTileX: ${maxTileX}, maxTileY: ${maxTileY}`);
        console.log("-----------------------"); 
        const absMinX = (this.cameraOffset.x - window.innerWidth / 2) * this.cameraZoom;
        const absMinY = (this.cameraOffset.y - window.innerHeight / 2) * this.cameraZoom;
        const rulerminX = Math.max(0, absMinX);
        const rulerminY = Math.max(0, absMinY);
        console.log(`Abs Mins: ${absMinX}, ${absMinY}`);
        const absMaxX = absMinX + this.patternLoader.getCols() * this.tileSize * this.cameraZoom;
        const absMaxY = absMinY + this.patternLoader.getRows() * this.tileSize * this.cameraZoom;
        console.log(`Abs Max: ${absMaxX}, ${absMaxY}`);
        const rulermaxX = Math.min(this.tileContainer.offsetWidth, absMaxX);
        const rulermaxY = Math.min(this.tileContainer.offsetHeight, absMaxY);
        console.log(`Ruler Draw Bounds - minX: ${rulerminX}, maxX: ${rulermaxX}, minY: ${rulerminY}, maxY: ${rulermaxY}`) */;
        
    }

    drawTiles(ctx, currentPattern, visibleFlag = false) {
        for (const stitch of currentPattern.stitches) {
            if (visibleFlag && this.isTileChanged(stitch.X, stitch.Y)) {
                continue;
            }
            this.drawTile(ctx, stitch, false);
        }

        for(let change in this.patternLoader.changes) {
            let changeObj = this.patternLoader.changes[change];
            const x = changeObj.X * this.tileSize;
            const y = changeObj.Y * this.tileSize;
            ctx.clearRect(x, y, this.tileSize, this.tileSize);
            this.drawTile(ctx, {
                X: changeObj.X,
                Y: changeObj.Y,
                dmcCode: "stitched",
                origCode: changeObj.originalCode
            }, false);
        }
    }

    drawTile(ctx, stitch, applyHighlight) {
        const { X, Y, dmcCode, origCode } = stitch;
        const x = X * this.tileSize;
        const y = Y * this.tileSize;
        const colorCode = dmcCode === "stitched" ? origCode : dmcCode;
        const colorData = this.getDMCValuesFromCode(colorCode);
        const [color, spanColor] = this.getTileColorsBasedOnFlags(
            dmcCode,
            colorData.R,
            colorData.G,
            colorData.B,
            applyHighlight
        );

        ctx.fillStyle = color;
        ctx.fillRect(x, y, this.tileSize, this.tileSize);
        ctx.fillStyle = spanColor;
        ctx.font = `${Math.round((this.tileSize * 3) / 4)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (dmcCode === "stitched") {
            ctx.beginPath();
            ctx.strokeStyle = spanColor;
            ctx.lineWidth = 2;
            ctx.moveTo(x + 3, y + 3);
            ctx.lineTo(x + this.tileSize - 3, y + this.tileSize - 3);
            ctx.moveTo(x + this.tileSize - 3, y + 3);
            ctx.lineTo(x + 3, y + this.tileSize - 3);
            ctx.stroke();
        } else {
            ctx.fillText(colorData.symbol, x + this.tileSize / 2, y + this.tileSize / 2);
        }
    }

    drawLines(ctx) {
        const cols = this.patternLoader.getCols();
        const rows = this.patternLoader.getRows();
        ctx.strokeStyle = 'silver';
        ctx.lineWidth = 1;
        // Draw vertical lines
        for (let i = 0; i <= cols; i++) {
            ctx.setLineDash([0, 0]);
            if(i == Math.floor(cols/2)) {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'darkred';
                ctx.lineWidth = 3;
            } else if(i % 10 === 0) {
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = '#777777';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(i * this.tileSize, 0);
            ctx.lineTo(i * this.tileSize, rows * this.tileSize);
            ctx.stroke();
        }
        // Draw horizontal lines
        for (let j = 0; j <= rows; j++) {
            ctx.setLineDash([0, 0]);
            if(j == Math.floor(rows/2)) {
                ctx.setLineDash([5, 5]);
                ctx.strokeStyle = 'darkred';
                ctx.lineWidth = 3;
            } else if(j % 10 === 0) {
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = '#777777';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(0, j * this.tileSize);
            ctx.lineTo(cols * this.tileSize, j * this.tileSize);
            ctx.stroke();
        }
    }

    drawRulers() {
        const rulerWidth = 25;
        const tileCountPrint = ((this.cameraZoom * this.tileSize) < 4) ? 50 : 10;
        const absMinX = (this.cameraOffset.x - window.innerWidth / 2) * this.cameraZoom;
        const absMinY = (this.cameraOffset.y - window.innerHeight / 2) * this.cameraZoom;
        const minX = Math.max(0, absMinX);
        const minY = Math.max(0, absMinY);
        const absMaxX = absMinX + this.patternLoader.getCols() * this.tileSize * this.cameraZoom;
        const absMaxY = absMinY + this.patternLoader.getRows() * this.tileSize * this.cameraZoom;
        const maxX = Math.min(this.tileContainer.offsetWidth, absMaxX);
        const maxY = Math.min(this.tileContainer.offsetHeight, absMaxY);
        
        const rulerCanvas = document.getElementById("rulerCanvas");
        const ctx = rulerCanvas.getContext("2d");
        rulerCanvas.width = this.tileContainer.offsetWidth;
        rulerCanvas.height = this.tileContainer.offsetHeight;
        ctx.clearRect(0, 0, rulerCanvas.width, rulerCanvas.height);
        // Draw vertical ruler
        ctx.fillStyle = "rgba(200, 200, 200, 0.9)";
        ctx.fillRect(0, minY, rulerWidth, maxY - minY);
        // Draw vertical lines
        let tileCount = 0;
        for(let y=absMinY; y<=absMaxY; y=y+this.tileSize*this.cameraZoom) {
            
            if(y > minY && y < maxY) {
                ctx.strokeStyle = "black";
                ctx.lineWidth = 1;
                ctx.beginPath();
                if(tileCount%10 == 0) {
                    ctx.lineWidth = 1.5;
                    ctx.moveTo(rulerWidth-10, y);
                } else if(tileCount%5 == 0) {
                    ctx.moveTo(rulerWidth-8, y);
                
                } else {
                    ctx.moveTo(rulerWidth-4, y);
                }
                
                ctx.lineTo(rulerWidth, y);
                ctx.stroke();
            }
            
            if(tileCount % tileCountPrint == 0 && tileCount > 0 && tileCount < this.patternLoader.getRows()) {
                ctx.fillStyle = 'darkblue';
                ctx.font = `15px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(tileCount / 10 , rulerWidth - 15, y - 10);
                ctx.textAlign = "center";
                ctx.fillText(0, rulerWidth - 15, y + 6);
            }
            tileCount++;
        }
        
        // Draw horizontal ruler
        ctx.fillStyle = "rgba(200, 200, 200, 0.9)";
        // console.log(maxX);
        ctx.fillRect(minX, 0, maxX - minX, rulerWidth);
        // Draw horizontal lines
        tileCount = 0;
        for(let x=absMinX; x<=absMaxX; x=x+this.tileSize*this.cameraZoom) {
            
            if(x > minX && x < maxX) {
                ctx.strokeStyle = "black";
                ctx.lineWidth = 1;
                ctx.beginPath();
                if(tileCount%10 == 0) {
                    ctx.lineWidth = 1.5;
                    ctx.moveTo(x, rulerWidth-10);
                } else if(tileCount%5 == 0) {
                    ctx.moveTo(x, rulerWidth-8);
                
                } else {
                    ctx.moveTo(x, rulerWidth-4);
                }
                
                ctx.lineTo(x, rulerWidth);
                ctx.stroke();
            }
            if(tileCount % tileCountPrint == 0 && tileCount > 0 && tileCount < this.patternLoader.getCols()) {
                ctx.fillStyle = 'darkblue';
                ctx.font = `15px Arial`;
                ctx.textAlign = "right";
                ctx.textBaseline = "middle";
                ctx.fillText(tileCount / 10 , x, rulerWidth - 15);
                ctx.textAlign = "center";
                ctx.fillText(0, x + 6, rulerWidth - 15);
            }
            tileCount++;
        }
        // Ruler drawing logic can be implemented here if needed
    }

     getTileColorsBasedOnFlags(code, R, G, B, applyHighlight = this.highFlag) {
        /*
        - If code STITCHED
            - highFlag TRUE
                - Highlighted code === code
                    => color = RGB, spanColor = getContrastColor (CASE 0)
                - Highlighted code !== code
                    => color = RGB alpha 0.25, spanColor = getContrastColor black ? silver : white (CASE 1)
            - highFlag FALSE
                => color = RGB alpha 0.25, spanColor = getContrastColor black ? silver : white (CASE 1) 
        - Else
            - contrastFlag TRUE
                - highFlag TRUE
                    - Highlighted code === code
                        => color = black, spanColor = white (CASE 2)
                    - Highlighted code !== code
                        => color = white, spanColor = silver (CASE 4)
                - highFlag FALSE
                    => color = white, spanColor = black (CASE 3)
            - contrastFlag FALSE
                - highFlag TRUE
                    - Highlighted code === code
                        => color = RGB, spanColor = getContrastColor (CASE 0)
                    - Highlighted code !== code
                        => color = RGB alpha 0.25, spanColor = getContrastColor black ? silver : white (CASE 1)
                - highFlag FALSE
                    => color = RGB, spanColor = getContrastColor (CASE 0)
        
                    

        */
        let drawCase = null;
        let color = null;
        let spanColor = null;
        if(code === "stitched") {
            drawCase = 1;
            if(applyHighlight) {
                drawCase = (this.highlightedColor === code) ? 0 : 1;
            }
        } else {
            drawCase = 0;
            if(this.contrastFlag) {
                if(applyHighlight) {
                    drawCase = (this.highlightedColor === code) ? 2 : 4;
                } else {
                    drawCase = 3;
                }
            } else {
                if(applyHighlight) {
                    drawCase = (this.highlightedColor === code) ? 0 : 1;
                }
            }
        }

        switch(drawCase) {
            case 0:
                color = `rgba(${R}, ${G}, ${B}, 1)`;
                spanColor = this.getContrastColor(R, G, B);
                break;
            case 1:
                color = `rgba(${R}, ${G}, ${B}, 1)`;
                spanColor = (this.getContrastColor(R, G, B) === "black") ? "silver" : "white";
                break;
            case 2:
                color = "black";
                spanColor = "white";
                break;
            case 3:
                color = "white";
                spanColor = "black";
                break;
            case 4:
                color = "white";
                spanColor = "silver";
            
        }
        return [color, spanColor];
    } 

    adjustCanvasZoom(zoomAmount, zoomFactor, mouseEvent) {
        const canvas = document.getElementById("tileCanvas");
        const mousePos = this.getEventLocation(mouseEvent);
        const canvasRect = canvas.getBoundingClientRect();
        
        // Calculate current scale and translate
        const scaleX = (canvas.width / canvas.clientWidth) * this.cameraZoom;
        const scaleY = (canvas.height / canvas.clientHeight) * this.cameraZoom;
        const tx = -window.innerWidth / 2 + this.cameraOffset.x;
        const ty = -window.innerHeight / 2 + this.cameraOffset.y;
        
        // Mouse position in canvas display coordinates
        const dx = mousePos.x - canvasRect.x;
        const dy = mousePos.y - canvasRect.y;
        
        // World coordinates under the mouse
        const worldX = dx / scaleX - tx;
        const worldY = dy / scaleY - ty;
        
        // Apply zoom
        if(!this.isDragging) {
            if(zoomAmount) {
                this.cameraZoom += zoomAmount;
            }
        } else if(zoomFactor) {
            this.cameraZoom = zoomFactor * this.lastZoom;
        }
        if(this.cameraZoom > this.maxZoom) {
            this.cameraZoom = this.maxZoom;
        }
        if(this.cameraZoom < this.minZoom) {
            this.cameraZoom = this.minZoom;
        }
        
        // New scale
        const newScaleX = (canvas.width / canvas.clientWidth) * this.cameraZoom;
        const newScaleY = (canvas.height / canvas.clientHeight) * this.cameraZoom;
        
        // Adjust offset so world point is still under mouse
        const newTx = dx / newScaleX - worldX;
        const newTy = dy / newScaleY - worldY;
        
        this.cameraOffset.x = newTx + window.innerWidth / 2;
        this.cameraOffset.y = newTy + window.innerHeight / 2;

        // Schedule a single render instead of rendering on every move
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.renderCanvas();
                
                this.renderScheduled = false;
            });
        }
    }

    resetCanvasZoom() {
        this.cameraZoom = this.minZoom;
        this.cameraOffset = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    getEventLocation(e) {
        if (e.touches && e.touches.length == 2) {
            // For pinch, return the midpoint between two touches
            const x = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const y = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            return { x, y };
        } else if (e.touches && e.touches.length == 1) {
            return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        } else if (e.clientX && e.clientY) {
            return { x: e.clientX, y: e.clientY };
        }
    }
        
    onPointerDown(e) {
        this.isDragging = true;
        const eventLoc = this.getEventLocation(e);
        this.dragStart.x = eventLoc.x / this.cameraZoom - this.cameraOffset.x;
        this.dragStart.y = eventLoc.y / this.cameraZoom - this.cameraOffset.y;
        this.mouseDown.x = eventLoc.x;
        this.mouseDown.y = eventLoc.y;
    }

    onPointerUp(e) {
        // this.DEBUGPrintZoomInfo();
        this.isDragging = false;
        this.initialPinchDistance = null;
        this.lastZoom = this.cameraZoom;
        const eventLoc = this.getEventLocation(e);
        this.mouseUp.x = eventLoc.x;
        this.mouseUp.y = eventLoc.y;
        const canvas = document.getElementById("tileCanvas");
        this.canvasClick.x = (eventLoc.x - canvas.getBoundingClientRect().x) / this.cameraZoom - (this.cameraOffset.x - canvas.parentElement.offsetWidth / 2);
        this.canvasClick.y = (eventLoc.y - canvas.getBoundingClientRect().y) / this.cameraZoom - (this.cameraOffset.y - canvas.parentElement.offsetHeight / 2) + 77.5; // Why 77.5 you ask? Hell I don't know

        if(this.mouseDown.x === this.mouseUp.x && this.mouseDown.y === this.mouseUp.y) {
            if(this.canvasClick.x < 0 || this.canvasClick.y < 0) {
                return;
            } else if(this.canvasClick.x > canvas.width || this.canvasClick.y > canvas.height) {
                return;
            } else {
                this.handleTileClick(Math.floor(this.canvasClick.x / this.tileSize), Math.floor(this.canvasClick.y / this.tileSize));
            }
            
        }
        /* if(this.cameraZoom > 1.25) {
            console.log("Zoom level high enough to trigger refresh on click");
            this.renderCanvas();
            this.refreshCanvas(true);
        } */
    }

    onTouchEnd(e) {
        this.isDragging = false;
        this.initialPinchDistance = null;
        this.lastZoom = this.cameraZoom;
        this.mouseUp.x = e.changedTouches[0].clientX;
        this.mouseUp.y = e.changedTouches[0].clientY;
        
        if(this.mouseDown.x === this.mouseUp.x && this.mouseDown.y === this.mouseUp.y) {
            const canvas = document.getElementById("tileCanvas");
            this.canvasClick.x = (e.changedTouches[0].clientX - canvas.getBoundingClientRect().x) / this.cameraZoom - (this.cameraOffset.x - canvas.parentElement.offsetWidth / 2);
            this.canvasClick.y = (e.changedTouches[0].clientY - canvas.getBoundingClientRect().y) / this.cameraZoom - (this.cameraOffset.y - canvas.parentElement.offsetHeight / 2) + 77.5; // Why 77.5 you ask? Hell I don't know  
            if(this.canvasClick.x < 0 || this.canvasClick.y < 0) {
                return;
            } else if(this.canvasClick.x > canvas.width || this.canvasClick.y > canvas.height) {
                return;
            } else {
                this.handleTileClick(Math.floor(this.canvasClick.x / this.tileSize), Math.floor(this.canvasClick.y / this.tileSize));
            }
        }
        if(this.cameraZoom > 1.25) {
            this.refreshCanvas(true);
        }
        
    }

    onPointerMove(e) {
        if (this.isDragging) {
            this.cameraOffset.x = this.getEventLocation(e).x / this.cameraZoom - this.dragStart.x;
            this.cameraOffset.y = this.getEventLocation(e).y / this.cameraZoom - this.dragStart.y;
            
            // Schedule a single render instead of rendering on every move
            if (!this.renderScheduled) {
                this.renderScheduled = true;
                requestAnimationFrame(() => {
                    this.renderCanvas();
                    this.renderScheduled = false;
                });
            }
        }
    }

    handleTouch(e, singleTouchHandler) {
        if (e.touches.length == 1) {
            singleTouchHandler(e);
        } else if (e.touches.length == 2) {
            // Handle pinch on both touchstart and touchmove
            if (e.type == "touchstart") {
                this.isDragging = false;
                this.initialPinchDistance = null;
                this.lastZoom = this.cameraZoom;
            } else if (e.type == "touchmove") {
                this.isDragging = false;
                this.handlePinch(e);
            }
        }
    }

    handlePinch(e) {
        const touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY };
        const currentDistance = Math.hypot(touch2.x - touch1.x, touch2.y - touch1.y);
        
        if (this.initialPinchDistance == null) {
            this.initialPinchDistance = currentDistance;
        } else {
            const midX = (touch1.x + touch2.x) / 2;
            const midY = (touch1.y + touch2.y) / 2;
            const canvas = document.getElementById("tileCanvas");
            const scaleX = (canvas.width/canvas.clientWidth)*this.cameraZoom;
            const scaleY = (canvas.height/canvas.clientHeight)*this.cameraZoom;
            const tx = -window.innerWidth / 2 + this.cameraOffset.x;
            const ty = -window.innerHeight / 2 + this.cameraOffset.y;
            const dx = midX - canvas.getBoundingClientRect().x;
            const dy = midY - canvas.getBoundingClientRect().y;
            const worldX = dx / scaleX - tx;
            const worldY = dy / scaleY - ty;
            const zoomFactor = currentDistance / this.initialPinchDistance;
            this.cameraZoom = zoomFactor + this.lastZoom - 1;
            // Adjust zoom limits
            if(this.cameraZoom > this.maxZoom) {
                this.cameraZoom = this.maxZoom;
            }
            if(this.cameraZoom < this.minZoom) {
                this.cameraZoom = this.minZoom;
            }

            // Adjust camera offset to keep midpoint stable
            const newScaleX = (canvas.width/canvas.clientWidth)*this.cameraZoom;
            const newScaleY = (canvas.height/canvas.clientHeight)*this.cameraZoom;
            const newTx = dx / newScaleX - worldX;
            const newTy = dy / newScaleY - worldY;
            this.cameraOffset.x = newTx + window.innerWidth / 2;
            this.cameraOffset.y = newTy + window.innerHeight / 2; 

            // Schedule a single render instead of rendering on every move
            if (!this.renderScheduled) {
                this.renderScheduled = true;
                requestAnimationFrame(() => {
                    this.renderCanvas();
                    this.renderScheduled = false;
                });
            }
        }
    }
    // ===== COLOR MANAGEMENT METHODS =====

    initializeColorArray(pattern) {
        // Clear color array for fresh start
        this.colorArray = [];

        pattern.stitches.forEach(stitch => {
            this.colorArray = this.checkAndAddColor(this.colorArray, stitch);
        });

        // Sort by count (most used first)
        this.colorArray.sort((a, b) => b.count - a.count);

        // Add stitched color if not present
        const stitchedExists = this.colorArray.some(color => color.code === 'stitched');
        if (!stitchedExists) {
            this.colorArray.push({
                "code": 'stitched',
                "name": 'STITCHED',
                "R": 0,
                "G": 255,
                "B": 0,
                "symbol": "×",
                "count": 0
            });
        }

        return this.colorArray;
    }

    checkAndAddColor(colors, stitch) {
        let found = false;

        for (let i = 0; i < colors.length; i++) {
            if (stitch.dmcCode === colors[i].code) {
                found = true;
                colors[i].count += 1;
                break;
            }
        }

        if (!found) {
            // Use the existing getDMCValuesFromCode function from script.js
            const colorData = this.getDMCValuesFromCode(stitch.dmcCode);
            colors.push({
                "code": stitch.dmcCode,
                "name": colorData.dmcName,
                "R": colorData.R,
                "G": colorData.G,
                "B": colorData.B,
                "symbol": colorData.symbol,
                "count": 1
            });
        }

        return colors;
    }

    getDMCValuesFromCode(code) {
        const currentPattern = this.patternLoader.getCurrentPattern();
        const colorObj = currentPattern.colors.find(obj => obj.dmcCode === code);
        return colorObj || {
            dmcName: "Unknown",
            R: 128, G: 128, B: 128,
            symbol: "?"
        };
    }

    createOriginalThumbnail(maxSize = 128) {
        const pattern = this.patternLoader.originalPattern;
        if (!pattern?.properties || !Array.isArray(pattern.stitches) || !Array.isArray(pattern.colors)) {
            return null;
        }

        const { width, height } = pattern.properties;
        if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
            return null;
        }

        const colorByCode = new Map(pattern.colors.map(color => [color.dmcCode, color]));
        let thumbnailSize = Math.min(maxSize, 128);
        while (thumbnailSize >= 32) {
            const scale = Math.min(thumbnailSize / width, thumbnailSize / height);
            const thumbnailWidth = Math.max(1, Math.round(width * scale));
            const thumbnailHeight = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement("canvas");
            canvas.width = thumbnailWidth;
            canvas.height = thumbnailHeight;
            const context = canvas.getContext("2d");
            if (!context) {
                return null;
            }

            const image = context.createImageData(thumbnailWidth, thumbnailHeight);
            for (let offset = 0; offset < image.data.length; offset += 4) {
                image.data[offset] = 255;
                image.data[offset + 1] = 255;
                image.data[offset + 2] = 255;
                image.data[offset + 3] = 255;
            }

            for (const stitch of pattern.stitches) {
                const code = stitch.dmcCode === "stitched" ? stitch.origCode : stitch.dmcCode;
                const color = colorByCode.get(code);
                if (!color || stitch.X < 0 || stitch.X >= width || stitch.Y < 0 || stitch.Y >= height) {
                    continue;
                }

                const x = Math.min(thumbnailWidth - 1, Math.floor(stitch.X * thumbnailWidth / width));
                const y = Math.min(thumbnailHeight - 1, Math.floor(stitch.Y * thumbnailHeight / height));
                const offset = (y * thumbnailWidth + x) * 4;
                image.data[offset] = color.R;
                image.data[offset + 1] = color.G;
                image.data[offset + 2] = color.B;
                image.data[offset + 3] = 255;
            }

            context.putImageData(image, 0, 0);
            const thumbnail = canvas.toDataURL("image/webp", 0.65);
            if (thumbnail.length <= 6000) {
                return thumbnail;
            }
            thumbnailSize = Math.floor(thumbnailSize / 2);
        }

        return null;
    }

    getTileValues(x, y) {
        const currentPattern = this.patternLoader.getCurrentPattern();
        const stitch = currentPattern.stitches.find(s => s.X === x && s.Y === y); 
        if(stitch) {
            console.log(stitch);
            return stitch;
        }
        return null;
    }

    getTileOriginalCode(x, y) {
        const currentPattern = this.patternLoader.getCurrentPattern();
        const stitch = currentPattern.stitches.find(s => s.X === x && s.Y === y);
        if(stitch) {
            return stitch.origCode;
        }
        return null;
    }

    getColorArray() {
        return this.colorArray;
    }

    getChangeCount(code) {
        let count = 0;
        for(let change of this.patternLoader.changes) {
            if(change.originalCode === code) {
                count++;
            }
        }
        return count;
    }

    getStitchedCount() {
        const stitchedColor = this.colorArray.find(color => color.code === "stitched");
        return stitchedColor ? (stitchedColor.count) : 0;
    }

    getContrastColor(r, g, b) {
        // Calculate luminance for contrast
        const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
        return luminance > 186 ? 'black' : 'white';
    }

    getColorCount() {
        let colorCount = 0
        for(let color of this.colorArray) {
            if(color.code === "stitched" || color.code === "empty") { 
                continue;
            }
            colorCount++;
        }
        return colorCount;
    }
    //this.tileCanvas.addEventListener('touchend', (e) => {
    //    this.handleTouch(e, onPointerUp))

    getHighlightedStitches() {
        const highlightedStitches = [];
        const currentPattern = this.patternLoader.getCurrentPattern();
        for(let stitch of currentPattern.stitches) {
            if(stitch.dmcCode === this.highlightedColor && !this.isTileChanged(stitch.X, stitch.Y)) {
                highlightedStitches.push({
                    X: stitch.X,
                    Y: stitch.Y,
                    code: stitch.dmcCode,
                    cluster: 0
                });
            }
        }
        return highlightedStitches;
    }

    
}

export default GridManager;