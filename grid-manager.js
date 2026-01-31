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
        this.patternLoader = patternLoader;
        this.uiManager = uiManager;
        this.activeTool = null;
        this.highlightedColor = null;
        this.highlightedSymbol = null;
        this.changeCounter = 0;
        this.contrastFlag = false; // High contrast mode flag
        this.paintFlag = false; // Paint mode flag
        this.bucketFlag = false; // Bucket mode flag
        this.highFlag = false; // Highlight mode flag
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
        this.patternCacheDirty = true;
    }

    /**
     * TOOL ACTIVATION AND INTERACTION HANDLERS
     */

    // Tool activation methods
    activatePaint() {
        this.deactivateTools();
        // Toggle paint mode
        this.paintFlag = !this.paintFlag;

        if(this.paintFlag) {
            this.activateUIToolState('paintTool');
        }
        if(this.highFlag) {
            this.activateUIToolState('highTool');
        }
        this.bucketFlag = false;
    }

    activateBucket() {
        this.deactivateTools();
        // Toggle bucket mode
        this.bucketFlag = !this.bucketFlag;

        if(this.bucketFlag) {
            this.activateUIToolState('bucketTool');
        }
        if(this.highFlag) {
            this.activateUIToolState('highTool');
        }
        this.paintFlag = false;
    }

    activateHighlight() {
        this.deactivateTools();
        // Toggle highlight mode
        this.highFlag = !this.highFlag;
        if(this.highFlag) {
            this.activateUIToolState('highTool');
        }
        this.paintFlag = false;
        this.bucketFlag = false;
        this.refreshCanvas();
    }

    activateHighContrast() {
        this.toggleHighContrast();
    }

    deactivateTools() {
        this.activeTool = null;
        this.clearUIToolStates();
    }

    // Main interaction handler
    handleTileClick(x, y) {
        // const tile = this.getTile(x, y);
        // if (!tile) return;

        const code = this.getCoordinateColors(x, y);
        if(!code) return;
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
        else if (this.highFlag) {
            return this.handleHighlight(code);
        }

    }

    // ===== IMPLEMENTATION DETAILS =====

    handlePaint(x, y, code) {
        if(code === 'stitched' || code === 'empty') {
            return 0; // Tile already stitched
        }
        // Record change for undo functionality
        this.changeCounter++;
        this.patternLoader.changeCounter = this.changeCounter;
        this.patternLoader.recordChange(x, y, 'stitched', code);
        // this.updateColorStats(code, 1);
        // this.updateColorStats();
        this.refreshCanvas(true);
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
        this.changeCounter++;
        this.patternLoader.changeCounter = this.changeCounter;
        
        // Apply paint to all connected tiles
        let tilesAffected = 0;
        tilesToFill.forEach(({x, y}) => {
            //const connectedTile = this.getTile(x, y);
            this.patternLoader.recordChange(x, y, 'stitched', fillColor);
            tilesAffected++;
            
        });
        
        // Update color statistics
        // this.updateColorStats(fillColor, tilesAffected);
        // this.updateColorStats();
        this.refreshCanvas(true);
        this.uiManager.updateFootnote(`${tilesAffected} stitches painted`);
        
        return tilesAffected;
    }

    handleHighlight(code) {
        const symbol = this.getTileSymbol(code);
        
        // Select the color 
        this.selectColor(code, symbol);
        
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
            }
        }
        // this.patternLoader.changes = this.patternLoader.changes.filter(function(el) { return el.id < this.patternLoader.changeCounter;});
        this.patternLoader.changeCounter--;
        //this.patternLoader.changes.pop();
        
        this.refreshCanvas();
        this.uiManager.updateFootnote("Change undone");
        
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
        // this.adjustCanvasZoom(zoomAmount, null, null);
        /* const collection = document.getElementsByClassName("tile");
        let height = collection[0].offsetHeight;
        if(height < this.maxHeight) {
            let newHeight = height + 2;
            this.setHeight(newHeight);
        }
        this.uiManager.drawSVG(); */
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
        // this.adjustCanvasZoom(zoomAmount, null, null);
        /* const collection = document.getElementsByClassName("tile");
        let height = collection[0].offsetHeight;
        if(height > this.minHeight) {
            let newHeight = height - 2;
            this.setHeight(newHeight);
        }
        this.uiManager.drawSVG(); */
    }

    zoomReset() {
        this.zoomResetFlag = !this.zoomResetFlag;
        if(this.zoomResetFlag) {
            this.setHeight(Math.round(this.tileContainer.offsetHeight/this.tileContainer.children.length) - 1);
        }
        else {
            this.setHeight(this.defaultHeight);
        }
        this.uiManager.drawSVG();
    }



    // ===== HELPER METHODS =====

    applyStitchToTile(tile, changeCounter) {
        
        const origCode = tile.getAttribute('data-tile-code');
        
        // Update tile attributes
        tile.setAttribute('data-tile-code', 'stitched');
        tile.setAttribute('data-tile-orig-code', origCode);
        tile.setAttribute('data-tile-change', changeCounter);
        tile.setAttribute('data-tile-r', 0);
        tile.setAttribute('data-tile-g', 255);
        tile.setAttribute('data-tile-b', 0);
        
        // Update visual appearance
        tile.style.backgroundColor = "rgba(0, 255, 0, 1)"; // Green background
        tile.children[0].style.color = 'white';
        tile.children[0].innerText = '×'; // Stitched symbol
        
        // Record change in PatternLoader
        const x = Number(tile.getAttribute('data-tile-x'));
        const y = Number(tile.getAttribute('data-tile-y'));
        this.patternLoader.recordChange(x, y, 'stitched', origCode);
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
                    if (!visited.has(neighborKey)) {
                        tilesToCheck.push(neighbor);
                    }
                });
            }
        }
        
        return foundTiles;
    }

    selectColor(colorCode, symbol) {
        // Update global highlight state
        this.highlightedColor = colorCode;
        this.highlightedSymbol = symbol;
        
        this.updateColorSelectorUI(colorCode, symbol);
            
            // Refresh grid to show highlighting
        this.refreshCanvas();
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
        // this.updateColorAfterPaint(origCode, count);
    }

    

    // ===== UTILITY METHODS =====

    getCoordinateColors(x, y) {
        for(let stitch of this.patternLoader.getCurrentPattern().stitches) {
            if(stitch.X == x && stitch.Y == y) {
                return stitch.dmcCode;
            }
        }
        return null;
    }

    getTile(x, y) {
        return document.querySelector(`[data-tile-x="${x}"][data-tile-y="${y}"]`);
    }

    getTileSymbol(colorCode) {
        const currentPattern = this.patternLoader.getCurrentPattern();
        const colorObj = currentPattern.colors.find(c => c.dmcCode === colorCode);
        return colorObj ? colorObj.symbol : '?';
    }

    activateUIToolState(activeToolId) {
        // Activate specific tool
        const toolElement = document.getElementById(activeToolId);
        if (toolElement) {
            toolElement.classList.add('activeTool');
        }
    }

    clearUIToolStates() {
        document.querySelectorAll('.toolback').forEach(el => {
            el.classList.remove('activeTool');
        });
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

    refreshGridDisplay() {
        // Trigger a full grid visual refresh
        this.updateTileColors();
    }

    updateTileAttributes(stitches) {
        // Update tile data based on the provided stitches
        stitches.forEach(stitch => {

            //+2 to compensate for the horizontal ruler
            let row = this.tileContainer.children.item(stitch.Y + 2);

            //+1 to compensate for the vertical ruler
            let tile = row.children.item(stitch.X + 1);
            if (tile) {
                tile.setAttribute('data-tile-x', stitch.X);
                tile.setAttribute('data-tile-y', stitch.Y);
                const code = stitch.dmcCode || "empty";
                tile.setAttribute('data-tile-code', stitch.dmcCode);
                const colorData = this.getDMCValuesFromCode(stitch.dmcCode);
                tile.setAttribute('data-tile-r', colorData.R);
                tile.setAttribute('data-tile-g', colorData.G);
                tile.setAttribute('data-tile-b', colorData.B);
                tile.children[0].innerText = colorData.symbol;
                tile.setAttribute('title', `(X: ${stitch.X+1}, Y: ${stitch.Y+1}) - ${colorData.dmcName} (${stitch.dmcCode})`);
                // onsole.log(code);
                if(code !== "empty") {
                    tile.setAttribute('onclick', `tileClick(this)`);
                }
            }
        });
    }

    updateTileColors() {
        // Iterate through all tiles and update their visual appearance
        for (let i = 2; i < this.tileContainer.children.length; i++) {
            const row = this.tileContainer.children[i];
            for (let j = 1; j < row.children.length; j++) {
                const tile = row.children[j];
                this.updateSingleTileColor(tile);
            }
        }
    }

    updateSingleTileColor(tile) {
        const code = tile.getAttribute('data-tile-code');
        const R = parseInt(tile.getAttribute('data-tile-r')) || 0;
        const G = parseInt(tile.getAttribute('data-tile-g')) || 0;
        const B = parseInt(tile.getAttribute('data-tile-b')) || 0;
        let alpha = 1;
        let spanColor = 'black';
        let color = 'white';
        
        // Check for high contrast mode
        if (this.contrastFlag) {
            if (code === "stitched") {
                spanColor = this.getContrastColor(R, G, B);
                color = `rgba(${R}, ${G}, ${B}, 1)`;
            } else {
                if (this.highFlag) {
                    if (this.highlightedColor === code) {
                        spanColor = 'white';
                        color = 'black';
                    } else {
                        alpha = 0.25;
                        spanColor = 'silver';
                    }
                }
            }
        } else {
            spanColor = this.getContrastColor(R, G, B);
            
            if (this.highFlag && this.highlightedColor !== code) {
                alpha = 0.25;
                spanColor = this.getContrastColor(R, G, B) === 'black' ? 'silver' : 'white';
            }
            
            if (code === "stitched") {
                spanColor = this.getContrastColor(R, G, B);
                color = `rgba(${R}, ${G}, ${B}, 1)`;
                alpha = 1;
            }

            color = `rgba(${R}, ${G}, ${B}, ${alpha})`;
        }
        
        // Apply the calculated colors
        tile.children[0].style.color = spanColor;
        tile.style.backgroundColor = color;
    }

    toggleHighContrast() {
        this.contrastFlag = !this.contrastFlag;
        this.refreshCanvas();
        return this.contrastFlag;
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
        this.tileSize = Math.min(Math.max(Math.floor(4000 / maxDimension), 10), 50);
        // Adjust max zoom based on tile size
        this.maxZoom = 50 / this.tileSize;
        
        canvas.width = cols * this.tileSize;
        canvas.height = rows * this.tileSize;
        this.minZoom = Math.min(this.tileContainer.offsetHeight / canvas.height, this.tileContainer.offsetWidth / canvas.width);
        this.cameraZoom = this.minZoom;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
    }

    cleanPatternCache(canvas) {
        this.patternCanvas.width = canvas.width;
        this.patternCanvas.height = canvas.height;
        const patternCtx = this.patternCanvas.getContext("2d");
        const currentPattern = this.patternLoader.getCurrentPattern();
        this.drawTiles(patternCtx, currentPattern);
        this.drawLines(patternCtx);
    }

    refreshCanvas(visibleFlag=false) {
        const canvas = document.getElementById("tileCanvas");
        canvas.width = this.patternLoader.getCols() * this.tileSize;
        canvas.height = this.patternLoader.getRows() * this.tileSize;
        const ctx = canvas.getContext("2d");
        // ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Set zoom and offset
        ctx.scale((canvas.width/canvas.clientWidth)*this.cameraZoom, (canvas.height/canvas.clientHeight)*this.cameraZoom);
        ctx.translate( -window.innerWidth / 2 + this.cameraOffset.x, -window.innerHeight / 2 + this.cameraOffset.y );
        
        const currentPattern = this.patternLoader.getCurrentPattern();

        this.drawTiles(ctx, currentPattern, visibleFlag);
        this.drawLines(ctx);
        this.cleanPatternCache(canvas);
    }

    renderCanvas() {
        const canvas = document.getElementById("tileCanvas");
        const ctx = canvas.getContext("2d");
        
        // Regenerate pattern cache only when needed
        if (this.patternCacheDirty) {
            this.cleanPatternCache(canvas);
            this.patternCacheDirty = false;
        }
        
        // Now just apply transformation to cached content
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.scale((canvas.width/canvas.clientWidth)*this.cameraZoom, (canvas.height/canvas.clientHeight)*this.cameraZoom);
        ctx.translate(-window.innerWidth / 2 + this.cameraOffset.x, -window.innerHeight / 2 + this.cameraOffset.y);
        ctx.drawImage(this.patternCanvas, 0, 0);
    }

    DEBUGPrintZoomInfo() {
        console.log("-----------------------");
        console.log("--- Zoom Debug Info ---");
        console.log("-----------------------");
        console.log(`Zoom: ${this.cameraZoom}, MinZoom: ${this.minZoom}, MaxZoom: ${this.maxZoom}`);
        console.log(`OffsetX: ${this.cameraOffset.x}, OffsetY: ${this.cameraOffset.y}`);
        console.log(`TileSize: ${this.tileSize}`);
        console.log(`CanvasWidth: ${this.tileCanvas.width}, CanvasHeight: ${this.tileCanvas.height}`);
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
        
    }

    drawTiles(ctx, currentPattern, visibleFlag) {
        // Get viewport bounds in world coordinates
        const canvas = document.getElementById("tileCanvas");
        const scaleX = (canvas.width/canvas.clientWidth)*this.cameraZoom;
        const scaleY = (canvas.height/canvas.clientHeight)*this.cameraZoom;
        // Viewport bounds
        const minX = -this.cameraOffset.x + window.innerWidth / 2;
        const minY = -this.cameraOffset.y + window.innerHeight / 2;
        const maxX = minX + this.tileContainer.offsetWidth / this.cameraZoom;
        const maxY = minY + this.tileContainer.offsetHeight / this.cameraZoom;
        console.log(`Viewport Bounds - minX: ${minX}, minY: ${minY}, maxX: ${maxX}, maxY: ${maxY}`);
        const minTileX = Math.max(0, Math.floor(minX / this.tileSize));
        const maxTileX = Math.min(this.patternLoader.getCols(), Math.ceil(maxX / this.tileSize));
        const minTileY = Math.max(0, Math.floor(minY / this.tileSize));
        const maxTileY = Math.min(this.patternLoader.getRows(), Math.ceil(maxY / this.tileSize));
        let spanColor = 'black';
        let color = 'white';

        // Draw only visible tiles
        for(let stitch in currentPattern.stitches) {
            let stitchObj = currentPattern.stitches[stitch];
            if (stitchObj.X < minTileX || stitchObj.X >= maxTileX || 
                stitchObj.Y < minTileY || stitchObj.Y >= maxTileY) {
                    if(visibleFlag)
                        continue;
            }
            
            // ... rest of drawing code
        
            //let stitchObj = currentPattern.stitches[stitch];
            let x = stitchObj.X * this.tileSize;
            let y = stitchObj.Y * this.tileSize;
            let colorData = this.getDMCValuesFromCode(stitchObj.dmcCode);
            let R = colorData.R;
            let G = colorData.G;
            let B = colorData.B;
            let code = stitchObj.dmcCode;
            let alpha = 1;

            // Check for high contrast mode
            if (this.contrastFlag) {
                if (code === "stitched") {
                    spanColor = this.getContrastColor(R, G, B);
                    color = `rgba(${R}, ${G}, ${B}, 1)`;
                } else {
                    if (this.highFlag) {
                        if (this.highlightedColor === code) {
                            spanColor = 'white';
                            color = 'black';
                        } else {
                            alpha = 0.25;
                            spanColor = 'silver';
                            color = 'white';
                        }
                    }
                }
            } else {
                spanColor = this.getContrastColor(R, G, B);
                
                if (this.highFlag && this.highlightedColor !== code) {
                    alpha = 0.25;
                    spanColor = this.getContrastColor(R, G, B) === 'black' ? 'silver' : 'white';
                }
                
                if (code === "stitched") {
                    spanColor = this.getContrastColor(R, G, B);
                    color = `rgba(${R}, ${G}, ${B}, 1)`;
                    alpha = 1;
                }

                color = `rgba(${R}, ${G}, ${B}, ${alpha})`;
            }

            
            ctx.fillStyle = color;
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            // Draw symbol
            ctx.fillStyle = spanColor;
            ctx.font = `${Math.round((this.tileSize*3)/4)}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let symbol = colorData.symbol;
            ctx.fillText(symbol, x + this.tileSize / 2, y + this.tileSize / 2);
        }

        for(let change in this.patternLoader.changes) {
            let changeObj = this.patternLoader.changes[change];
            let x = changeObj.X * this.tileSize;
            let y = changeObj.Y * this.tileSize;
            let code = changeObj.newCode;
            let colorData = this.getDMCValuesFromCode(code);
            color = `rgba(0, 255, 0, 1)`;
            spanColor = 'white';
            ctx.fillStyle = color;
            ctx.fillRect(x, y, this.tileSize, this.tileSize);
            // Draw symbol
            ctx.fillStyle = spanColor;
            ctx.font = `${Math.round((this.tileSize*3)/4)}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            let symbol = "×";
            ctx.fillText(symbol, x + this.tileSize / 2, y + this.tileSize / 2);
        }
        
    }

    drawLines(ctx) {
        const cols = this.patternLoader.getCols();
        const rows = this.patternLoader.getRows();
        ctx.strokeStyle = 'silver';
        ctx.lineWidth = 1;
        // Draw vertical lines
        for (let i = 0; i <= cols; i++) {
            if(i % 10 === 0) {
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = 'gray';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(i * this.tileSize, 0);
            ctx.lineTo(i * this.tileSize, rows * this.tileSize);
            ctx.stroke();
        }
        // Draw horizontal lines
        for (let j = 0; j <= rows; j++) {
            if(j % 10 === 0) {
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
            } else {
                ctx.strokeStyle = 'gray';
                ctx.lineWidth = 1;
            }
            ctx.beginPath();
            ctx.moveTo(0, j * this.tileSize);
            ctx.lineTo(cols * this.tileSize, j * this.tileSize);
            ctx.stroke();
        }
    }

    drawRulers() {
        // Ruler drawing logic can be implemented here if needed
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
        this.DEBUGPrintZoomInfo();
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
        if(this.cameraZoom > 1.25) {
            this.renderCanvas();
            this.refreshCanvas(true);
        }
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

    removeAllTiles() {
        while (this.tileContainer.firstChild) {
            this.tileContainer.removeChild(this.tileContainer.firstChild);
        }
    }

    createSVGContainer() {
        // Create and append SVG container for grid lines
        const svgContainer = document.createElement("div");
        svgContainer.setAttribute("class", "svg-container");
        const newSVG = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgContainer.append(newSVG);
        this.tileContainer.append(svgContainer);
    }

    createTilesAndRulers(cols, rows) {
        const currentPattern = this.patternLoader.getCurrentPattern();
        const width = currentPattern.properties.width;
        const height = currentPattern.properties.height;
        // Create rows with tiles and rulers
        const rowTemplate = document.querySelector("[data-row-template]");
        const tileTemplate = document.querySelector("[data-tile-template]");

        // Add one vertical ruler div to the horizontal ruler row
        const rulerRow = rowTemplate.content.cloneNode(true).children[0];
        const rulerDiv = tileTemplate.content.cloneNode(true).children[0];
        rulerDiv.classList.add("vertRulerDiv");
        rulerRow.append(rulerDiv);

        // Add the rest of the horizontal ruler tiles
        for (let i = 1; i <= cols; i++)  {
            const tileDiv = tileTemplate.content.cloneNode(true).children[0];
            tileDiv.classList.add("horRulerRow");
            if(i%10 == 0) {
                tileDiv.children.item(0).innerText = i/10;
                tileDiv.children.item(0).setAttribute('style', "float: right;");
            }
            if(i%10 == 1 && i > 1) {
                tileDiv.children.item(0).innerText = 0;
                tileDiv.children.item(0).setAttribute('style', "float: left;");
            }
            rulerRow.append(tileDiv);
        }
        rulerRow.classList.add("horRulerRow");
        this.tileContainer.append(rulerRow);

        // Add the rest of the rows with vertical rulers and tiles
        for (let j = 1; j <= rows; j++) {
            const newRow = rowTemplate.content.cloneNode(true).children[0];

            //Adding vertical ruler div
            const rulerDiv = tileTemplate.content.cloneNode(true).children[0];
            rulerDiv.classList.add("vertRulerDiv");
            if(j%10 == 0) {
                rulerDiv.children.item(0).innerText = j/10;
            }
            if(j%10 == 1 && j > 1) {
                rulerDiv.children.item(0).innerText = 0;
            }
            newRow.append(rulerDiv);

            // Add color tiles, alternating colors for visibility
            for (let i = 1; i <= cols; i++)  {
                const tileDiv = tileTemplate.content.cloneNode(true).children[0];
                if(i%2==0) {
                    tileDiv.setAttribute('style', "background-color: white");
                }
                else {
                    tileDiv.setAttribute('style', "background-color: yellow");
                }
                newRow.append(tileDiv);
            }
            this.tileContainer.append(newRow)
        }
    }

    initializeGrid(cols, rows) {
        //
        this.removeAllTiles();
        this.createSVGContainer();
        this.createTilesAndRulers(cols, rows);
    }

    drawHorizontalLines() {
        // Draw horizontal grid lines
        for (let i = 2; i < this.tileContainer.children.length; i++) {
            const row = this.tileContainer.children[i];
            for (let j = 1; j < row.children.length; j++) {
                const tile = row.children[j];
                if ((i - 1) % 10 === 0) {
                    tile.classList.add('horBorder');
                }
            }
        }
    }

    drawVerticalLines() {
        // Draw vertical grid lines
        for (let i = 2; i < this.tileContainer.children.length; i++) {
            const row = this.tileContainer.children[i];
            for (let j = 1; j < row.children.length; j++) {
                const tile = row.children[j];
                if (j % 10 === 0) {
                    tile.classList.add('borderRight');
                }
                if (j % 10 == 1 && j < row.children.length-1 && j > 1) {
                    tile.classList.add("borderLeft");
                }
            }
        }
    }

    drawMiddleLines() {
        // Draw horizontal middle line
        let rows = document.getElementsByClassName("tile-container")[0];
        const currentPattern = this.patternLoader.getCurrentPattern();
        let midRowIndex = Math.round(currentPattern.properties.height / 2)
        let midRowTop = rows.children[midRowIndex];
        let midRowBot = rows.children[midRowIndex + 1];
        for (let i = 0; i < midRowTop.children.length; i ++) {
            midRowTop.children.item(i).classList.add("midRowTop");
        }
        for (let i = 0; i < midRowBot.children.length; i ++) {
            midRowBot.children.item(i).classList.add("midRowBot");
        }
        
        // Draw vertical middle line
        let midColIndex = Math.round(currentPattern.properties.width / 2)
        for (let i = 1; i < rows.children.length; i++) {
            let curRow = rows.children.item(i);
            curRow.children.item(midColIndex).classList.add("midColLeft");
            curRow.children.item(midColIndex + 1).classList.add("midColRight");
        }
    }

    drawGridLines() {
        this.drawHorizontalLines();
        this.drawVerticalLines();
        this.drawMiddleLines();
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

    updateColorAfterPaint(origCode, total) {
        // Decrease count of original color
        for (let i = 0; i < this.colorArray.length; i++) {
            if (this.colorArray[i].code === origCode) {
                this.colorArray[i].count -= Number(total);
                break;
            }
        }

        // Increase count of stitched color
        for (let i = 0; i < this.colorArray.length; i++) {
            if (this.colorArray[i].code === 'stitched') {
                this.colorArray[i].count += Number(total);
                break;
            }
        }
        return this.colorArray;
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
        return stitchedColor ? (stitchedColor.count + this.patternLoader.changes.length) : 0;
    }

    getContrastColor(r, g, b) {
        // Calculate luminance for contrast
        const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
        return luminance > 186 ? 'black' : 'white';
    }

    getHighlightedStitches() {
        // Return a collection of objects representing highlighted stitches
        const highlightedStitches = [];
        for (let i = 2; i < this.tileContainer.children.length; i++) {
            const row = this.tileContainer.children[i];
            for (let j = 1; j < row.children.length; j++) {
                const tile = row.children[j];
                const code = tile.getAttribute('data-tile-code');
                if (this.highlightedColor === code) {
                    highlightedStitches.push({
                        X: Number(tile.getAttribute('data-tile-x')),
                        Y: Number(tile.getAttribute('data-tile-y')),
                        code: code,
                        cluster: 0 // Initialize cluster to 0
                    });
                }
            }
        }        
        return highlightedStitches;
    }

    //this.tileCanvas.addEventListener('touchend', (e) => {
    //    this.handleTouch(e, onPointerUp))

    
}

export default GridManager;