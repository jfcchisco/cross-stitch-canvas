export default class GridCanvasRenderer {
    constructor(gridManager, pathRenderer, getPathSequence) {
        this.grid = gridManager;
        this.pathRenderer = pathRenderer;
        this.getPathSequence = getPathSequence;
    }

    cleanPatternCache(canvas) {
        const grid = this.grid;
        grid.patternCanvas.width = canvas.width;
        grid.patternCanvas.height = canvas.height;
        const context = grid.patternCanvas.getContext("2d");
        const currentPattern = grid.patternLoader.getCurrentPattern();
        grid.drawTiles(context, currentPattern);
        grid.drawLines(context);
    }

    ensureCanvasSize(canvas) {
        const grid = this.grid;
        const expectedWidth = grid.patternLoader.getCols() * grid.tileSize;
        const expectedHeight = grid.patternLoader.getRows() * grid.tileSize;
        if (canvas.width !== expectedWidth || canvas.height !== expectedHeight) {
            canvas.width = expectedWidth;
            canvas.height = expectedHeight;
            grid.patternCanvas.width = expectedWidth;
            grid.patternCanvas.height = expectedHeight;
            grid.patternCacheDirty = true;
        }
        this.resizeHighlightCanvas();
    }

    resizeHighlightCanvas() {
        const grid = this.grid;
        const width = grid.tileContainer.clientWidth;
        const height = grid.tileContainer.clientHeight;
        if (grid.highlightCanvas.width !== width || grid.highlightCanvas.height !== height) {
            grid.highlightCanvas.width = width;
            grid.highlightCanvas.height = height;
        }
    }

    renderCanvas() {
        const grid = this.grid;
        const canvas = grid.tileCanvas;
        const context = canvas.getContext("2d");
        this.ensureCanvasSize(canvas);

        if (grid.patternCacheDirty) {
            this.cleanPatternCache(canvas);
            grid.patternCacheDirty = false;
        }

        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.scale(
            (canvas.width / canvas.clientWidth) * grid.cameraZoom,
            (canvas.height / canvas.clientHeight) * grid.cameraZoom
        );
        context.translate(
            -window.innerWidth / 2 + grid.cameraOffset.x,
            -window.innerHeight / 2 + grid.cameraOffset.y
        );
        context.drawImage(grid.patternCanvas, 0, 0);
        this.renderHighlightLayer();
        grid.drawRulers();
    }

    renderHighlightLayer() {
        const grid = this.grid;
        const canvas = grid.tileCanvas;
        const context = grid.highlightCanvas.getContext("2d");
        if (!context || !canvas.width || !canvas.height) {
            return;
        }

        this.resizeHighlightCanvas();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, grid.highlightCanvas.width, grid.highlightCanvas.height);
        const scaleX = (grid.highlightCanvas.width / grid.highlightCanvas.clientWidth) * grid.cameraZoom;
        const scaleY = (grid.highlightCanvas.height / grid.highlightCanvas.clientHeight) * grid.cameraZoom;
        const translateX = -window.innerWidth / 2 + grid.cameraOffset.x;
        const translateY = -window.innerHeight / 2 + grid.cameraOffset.y;
        context.scale(scaleX, scaleY);
        context.translate(translateX, translateY);

        if (grid.highFlag) {
            context.fillStyle = "rgba(255, 255, 255, 0.5)";
            context.fillRect(
                -translateX,
                -translateY,
                grid.highlightCanvas.clientWidth / scaleX,
                grid.highlightCanvas.clientHeight / scaleY
            );

            const highlightedStitches = grid.stitchesByColor.get(grid.highlightedColor);
            if (highlightedStitches) {
                grid.drawHighlightedStitches(context, highlightedStitches);
            }
            grid.drawLines(context);
        }

        if (grid.pathFlag && this.pathRenderer) {
            this.pathRenderer.drawRoute(
                context,
                this.getPathSequence(),
                grid.tileSize,
                Math.max(3, grid.tileSize * 0.2)
            );
        }
    }
}
