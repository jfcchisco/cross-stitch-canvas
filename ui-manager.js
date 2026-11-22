import FlossUsageView from "./floss-usage-view.js";
import PathPlanner from "./path-planner.js";
import PathRenderer from "./path-renderer.js";
import PreviewRenderer from "./preview-renderer.js";

/**
 * UI Manager Module
 * Manages user interface interactions and updates.
 * Handles all modal functionalities (Floss Usage, Preview, SGV Path)
 */

class UIManager {
    constructor(pathRenderer = new PathRenderer()) {
        // Initialization code if needed
        this.gridManager = null;
        this.patternLoader = null;
        this.colorTemplate = document.querySelector("[data-color-template]");
        this.colorContainer = document.querySelector("[data-color-container]");
        this.pathPlanner = new PathPlanner();
        this.pathRenderer = pathRenderer;
        this.previewRenderer = new PreviewRenderer();
        this.flossUsageView = new FlossUsageView(
            this.colorTemplate,
            this.colorContainer,
            (color, symbol) => this.gridManager.selectColor(color, symbol)
        );
        this.CLUSTER_SEQUENCE = [];
        this.SEQUENCED_COLOR = null;
    }

    getGridManager(gridManager) {
        this.gridManager = gridManager;
    }

    getPatternLoader(patternLoader) {
        this.patternLoader = patternLoader;
    }

    updateFootnote(text) {
        const footnoteElement = document.getElementsByClassName('footnote')[0];
        const footLeft = footnoteElement.querySelector('.footLeft');
        const footRight = footnoteElement.querySelector('.footRight');
        footLeft.innerText = text;
        footRight.innerText = "Stitched: " + this.gridManager.getStitchedCount();
    }

    //* Fill Floss Usage Modal *

    fillFlossUsage() {
        const colorArray = this.gridManager.getColorArray();
        colorArray.sort((first, second) => second.count - first.count);
        let stitched = 0;
        let totalStitches = 0;
        for (const color of colorArray) {
            if (color.code === "stitched") {
                stitched = color.count;
            } else if (color.code !== "empty") {
                totalStitches += color.count;
            }
        }
        totalStitches += stitched;

        this.flossUsageView.render({
            colorArray,
            stitched,
            totalStitches,
            currentPattern: this.patternLoader.getCurrentPattern(),
            colorCount: this.gridManager.getColorCount(),
            highlightedColor: this.gridManager.highlightedColor
        });
        
        if (this.gridManager.highFlag) {
            this.gridManager.selectColor(this.gridManager.highlightedColor, this.gridManager.highlightedSymbol);
        }
    }

    flossUsageClose() {
        let modal = document.getElementById("myModal");
        modal.style.display = "none";
    }

    flossUsageOpen() {
        this.fillFlossUsage();
        let modal = document.getElementById("myModal");
        modal.style.display = "block";
    }

    //* Preview Modal *//

    preview() {
        this.showSpinner('Generating preview...');
        
        // Use setTimeout to allow the spinner to render before heavy computation
        setTimeout(() => {
            const canvas = document.getElementById("previewCanvas")
            const tileContainer = document.getElementsByClassName('tile-container')[0];

            const cols = this.patternLoader.getCols();
            const rows = this.patternLoader.getRows();

            let modal = document.getElementById("previewModal");

            const { box, context: ctx } = this.previewRenderer.sizeCanvas(canvas, tileContainer, cols, rows);

            modal.style.height = window.offsetHeight + "px";
            modal.style.width = window.offsetWidth + "px";

            this.previewRenderer.drawPattern(
                ctx,
                box,
                this.patternLoader.getCurrentPattern().stitches,
                this.patternLoader.changes,
                (code, originalCode) => {
                    const colorCode = code === "stitched" ? originalCode : code;
                    const colorData = this.gridManager.getDMCValuesFromCode(colorCode);
                    return this.gridManager.getTileColorsBasedOnFlags(
                        code,
                        colorData.R,
                        colorData.G,
                        colorData.B
                    )[0];
                }
            );

            let createPathDiv = document.getElementsByClassName("pathButtons")[0];
            let inputFields = document.getElementsByClassName("inputFields")[0];
            let drawPathButtons = document.getElementsByClassName("drawPathButtons")[0];
            inputFields.style.display = "none";
            createPathDiv.style.display = "none";
            drawPathButtons.style.display = "none";
            if(this.gridManager.highFlag && this.gridManager.highlightedColor && this.gridManager.highlightedColor != "stitched") {
                createPathDiv.style.display = "grid";
                inputFields.style.display = "grid";
                drawPathButtons.style.display = "grid";
            }
            this.previewRenderer.drawGridLines(ctx, box, cols, rows);
            document.getElementById("pathXInput").value = this.gridManager.lastClickedX;
            document.getElementById("pathYInput").value = this.gridManager.lastClickedY;
            this.hideSpinner();
        }, 0);
    }

    previewPath(type) {
        // This function should be called only when there is already a created canvas
        // with the highlighted color and highlight flag activated
        this.showSpinner('Calculating path...');
        
        // Use setTimeout to allow the spinner to render before heavy computation
        setTimeout(() => {
            const stats = document.getElementById("pathStats");
            try {
                const cols = this.patternLoader.getCols();
                const rows = this.patternLoader.getRows();
                const canvas = document.getElementById("previewCanvas");
                const tileContainer = document.getElementsByClassName("tile-container")[0];
                const threshold = Number(document.getElementById("pathInput")?.value ?? 10);
                const distanceInput = document.getElementById("pathDistanceLimit")?.value.trim() ?? "";
                const maxTotalDistance = distanceInput === ""
                    ? cols * rows * 2
                    : Number(distanceInput);

                if (!Number.isFinite(threshold) || threshold < 0) {
                    throw new Error("Threshold must be a non-negative number.");
                }
                if (!Number.isFinite(maxTotalDistance) || maxTotalDistance < 0) {
                    throw new Error("Distance limit must be a non-negative number.");
                }
                if (cols <= 0 || rows <= 0) {
                    throw new Error("The current pattern has no drawable area.");
                }

                const { box, context: ctx } = this.previewRenderer.sizeCanvas(canvas, tileContainer, cols, rows);
                if (!ctx) {
                    throw new Error("Preview canvas context is unavailable.");
                }

                const highlightedColor = this.gridManager.highlightedColor;
                this.previewRenderer.drawPathBase(
                    ctx,
                    box,
                    this.patternLoader.getCurrentPattern().stitches,
                    highlightedColor,
                    (x, y) => this.gridManager.isTileChanged(x, y)
                );

                const highlightedStitches = this.gridManager.getHighlightedStitches(highlightedColor);
                const { clusters, bucketSize } = this.pathPlanner.createClusters(highlightedStitches, cols, threshold);
                let startCluster = null;
                if (clusters.length > 0) {
                    if (type === 0) {
                        startCluster = this.pathPlanner.getClosestCluster(clusters, 0, 0);
                    } else if (type === 1) {
                        startCluster = this.pathPlanner.getClosestCluster(clusters, cols / 2, rows / 2);
                    } else if (type === 2) {
                        let coordX = Number(document.getElementById("pathXInput").value);
                        let coordY = Number(document.getElementById("pathYInput").value);
                        if (!Number.isInteger(coordX) || coordX >= cols || coordX < 0) {
                            alert(`Invalid X coordinate, using 0`);
                            coordX = 0;
                        }
                        if (!Number.isInteger(coordY) || coordY >= rows || coordY < 0) {
                            alert(`Invalid Y coordinate, using 0`);
                            coordY = 0;
                        }
                        startCluster = this.pathPlanner.getClosestCluster(clusters, coordX, coordY);
                    } else if (type === 3) {
                        startCluster = clusters[Math.floor(Math.random() * clusters.length)];
                    } else {
                        throw new Error("Unknown path start selection.");
                    }
                }

                const connectionCache = new Map();
                const result = this.pathPlanner.buildCoveragePath(
                    startCluster,
                    clusters,
                    threshold,
                    maxTotalDistance,
                    bucketSize,
                    connectionCache
                );
                this.gridManager.setCalculatedRoute(result.sequence, highlightedColor);
                if (stats) {
                    stats.textContent = `Covered: ${result.stitchCount}/${highlightedStitches.length} stitches · Estimated path cost: ${result.distance.toFixed(1)}`;
                }

                this.previewRenderer.drawGridLines(ctx, box, cols, rows);
                this.pathRenderer.drawRoute(ctx, result.sequence, box, Math.max(1, box * 0.12));
            } catch (error) {
                this.gridManager.invalidateRoute();
                if (stats) {
                    stats.textContent = `Path calculation failed: ${error.message}`;
                }
                console.error("Path calculation failed.", error);
            } finally {
                this.hideSpinner();
            }
        }, 0);
    }

    drawPath() {
        this.gridManager.setPathVisible(true);
    }

    // Spinner functions
    showSpinner(message='Loading pattern...') {
        document.getElementById('loadingSpinner').style.display = 'flex';
        document.getElementById('spinnerMessage').textContent = message;
    }

    hideSpinner() {
        document.getElementById('loadingSpinner').style.display = 'none';
    }
}

export default UIManager;