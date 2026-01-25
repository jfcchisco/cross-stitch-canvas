/**
 * GridManager Class
 * Manages the grid of tiles for the cross-stitch pattern.
 * Handles tool interactions, tile updates, and color management.
 * Depends on PatternLoader and UIManager.
 */
class GridManager {
    constructor(patternLoader, uiManager) {
        this.tileContainer = document.getElementsByClassName("tile-container")[0];
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
        this.refreshGridDisplay();
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
        const tile = this.getTile(x, y);
        if (!tile) return;

        const tileCode = tile.getAttribute('data-tile-code');
        this.uiManager.updateFootnote(`Tile (X: ${x+1}, Y: ${y+1}) - Code: ${tileCode} - ${this.getDMCValuesFromCode(tileCode).dmcName}`);
        if (this.paintFlag) {
            if(this.highFlag && this.highlightedColor !== tileCode) {
                return; // Cannot paint non-highlighted colors
            }
            return this.handlePaint(tile);
        } 
        else if (this.bucketFlag) {
            if(this.highFlag && this.highlightedColor !== tileCode) {
                return; // Cannot bucket-fill non-highlighted colors
            }
            return this.handleBucketFill(tile);
        } 
        else if (this.highFlag) {
            return this.handleHighlight(tile);
        }

    }

    // ===== IMPLEMENTATION DETAILS =====

    handlePaint(tile) {
        const tileCode = tile.getAttribute('data-tile-code');
        if(tileCode === 'stitched') {
            return 0; // Tile already stitched
        }
        // Record change for undo functionality
        this.changeCounter++;
        this.patternLoader.changeCounter = this.changeCounter;
        
        // Apply paint to single tile
        this.applyStitchToTile(tile, this.changeCounter);
        
        // Update color statistics
        this.updateColorStats(tileCode, 1);
        this.uiManager.updateFootnote("1 stitch painted");        
        return 1; // Return number of tiles affected
    }

    handleBucketFill(tile) {
        const startX = Number(tile.getAttribute('data-tile-x'));
        const startY = Number(tile.getAttribute('data-tile-y'));
        const fillColor = tile.getAttribute('data-tile-code');
        if(fillColor === 'stitched' || fillColor === '0') {
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
            const connectedTile = this.getTile(x, y);
            if (connectedTile) {
                this.applyStitchToTile(connectedTile, this.changeCounter);
                tilesAffected++;
            }
        });
        
        // Update color statistics
        this.updateColorStats(fillColor, tilesAffected);
        this.uiManager.updateFootnote(`${tilesAffected} stitches painted`);
        
        return tilesAffected;
    }

    handleHighlight(tile) {
        const tileCode = tile.getAttribute('data-tile-code');
        const tileSymbol = this.getTileSymbol(tileCode);
        
        // Select the color 
        this.selectColor(tileCode, tileSymbol);
        
        return 0; // No tiles directly modified
    }

    undo() {
        if(this.patternLoader.changeCounter == 0) {
            return;
        }
        let tiles = document.querySelectorAll(`[data-tile-change=${CSS.escape(this.patternLoader.changeCounter)}]`);
        tiles.forEach(tile => {
            let origCode = tile.getAttribute('data-tile-orig-code');
            let origColor = this.getDMCValuesFromCode(origCode);
            let R = origColor.R;
            let G = origColor.G;
            let B = origColor.B;

            tile.children.item(0).innerText = origColor.symbol;
            tile.removeAttribute('data-tile-change');
            tile.setAttribute('data-tile-code', origColor.dmcCode);
            tile.setAttribute('data-tile-r', origColor.R);
            tile.setAttribute('data-tile-g', origColor.G);
            tile.setAttribute('data-tile-b', origColor.B);
            
            let code = origCode;
            let alpha = 1;
            let spanColor = 'black';
            let color = 'white';
            
            //Check for high contrast
            if(this.contrastFlag) {
                if(code == "stitched") {
                    spanColor = this.getContrastColor(R, G, B);
                    color = "rgba(" + R + ", " + G + ", " + B + ",1)";
                }
                
                else {
                    if(this.highFlag) {
                        if(this.highlightedColor == code) {
                            spanColor = 'white';
                            color = 'black';
                        }
                        else {
                            alpha = 0.25;
                            spanColor = 'silver';
                        }
                    }
                }
            }

            else {
                spanColor = this.getContrastColor(R, G, B);
            
                if(this.highFlag && this.highlightedColor != code) {
                    alpha = 0.25;
                    spanColor = this.getContrastColor(R, G, B) === 'black' ? 'silver' : 'white';
                }
                if(code == "stitched") {
                    spanColor = this.getContrastColor(R, G, B);
                    color = "rgba(" + R + ", " + G + ", " + B + ",1)";
                    alpha = 1;
                }

                color = "rgba(" + R + ", " + G + ", " + B + "," + alpha + ")";
            }
            
            // Update stitch count and restore original count
            let length = this.colorArray.length;
            
            for (let i = 0; i < length; i ++) {
                
                if(origCode == this.colorArray[i].code) {
                    this.colorArray[i].count = this.colorArray[i].count + 1;
                }

                if(this.colorArray[i].code == 'stitched') {
                    this.colorArray[i].count = this.colorArray[i].count - 1;
                }
            }
            
            tile.children.item(0).style.color = spanColor;
            tile.style.backgroundColor = color;
            
        })
        this.patternLoader.changeCounter--;
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
        const collection = document.getElementsByClassName("tile");
        let height = collection[0].offsetHeight;
        if(height < this.maxHeight) {
            let newHeight = height + 2;
            this.setHeight(newHeight);
        }
        this.uiManager.drawSVG();
    }

    zoomOut() {
        const collection = document.getElementsByClassName("tile");
        let height = collection[0].offsetHeight;
        if(height > this.minHeight) {
            let newHeight = height - 2;
            this.setHeight(newHeight);
        }
        this.uiManager.drawSVG();
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
            
            const tile = this.getTile(current.x, current.y);
            if (!tile) continue;
            
            const tileColor = tile.getAttribute('data-tile-code');
            
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
        this.refreshGridDisplay();
        this.uiManager.updateFootnote("Selected color: " + colorCode + " - " + this.getDMCValuesFromCode(colorCode).dmcName);

    }

    updateColorStats(origCode, count) {
        // Update the GridManager's colorArray
        this.updateColorAfterPaint(origCode, count);
    }

    // ===== UTILITY METHODS =====

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
            // console.log(tile, stitch);
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
        this.updateTileColors();
        return this.contrastFlag;
    }

    /**
     * GRID DRAWING METHODS
     */

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

    getStitchedCount() {
        const stitchedColor = this.colorArray.find(color => color.code === "stitched");
        return stitchedColor ? stitchedColor.count : 0;
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

    
}

export default GridManager;