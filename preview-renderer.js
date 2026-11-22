export default class PreviewRenderer {
    sizeCanvas(canvas, tileContainer, cols, rows) {
        const box = Math.max(1, Math.min(
            Math.floor(tileContainer.offsetHeight / rows),
            Math.floor(tileContainer.offsetWidth / cols)
        ));
        canvas.height = box * rows;
        canvas.width = box * cols;
        return { box, context: canvas.getContext("2d") };
    }

    drawGridLines(ctx, box, cols, rows) {
        ctx.beginPath();
        for (let row = 0; row <= rows; row++) {
            if (row % 10 === 0 || row === rows) {
                ctx.moveTo(0, row * box);
                ctx.lineTo(cols * box, row * box);
            }
        }
        for (let col = 0; col <= cols; col++) {
            if (col % 10 === 0 || col === cols) {
                ctx.moveTo(col * box, 0);
                ctx.lineTo(col * box, rows * box);
            }
        }
        ctx.strokeStyle = "gray";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    drawPattern(ctx, box, stitches, changes, getTileColor) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        for (const stitch of stitches) {
            ctx.fillStyle = getTileColor(stitch.dmcCode, stitch.origCode);
            ctx.fillRect(stitch.X * box, stitch.Y * box, box, box);
        }

        for (const change of changes) {
            ctx.fillStyle = getTileColor("stitched", change.originalCode);
            ctx.clearRect(change.X * box, change.Y * box, box, box);
            ctx.fillRect(change.X * box, change.Y * box, box, box);
        }
    }

    drawPathBase(ctx, box, stitches, highlightedColor, isTileChanged) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        for (const stitch of stitches) {
            const isHighlighted = stitch.dmcCode === highlightedColor &&
                !isTileChanged(stitch.X, stitch.Y);
            ctx.fillStyle = isHighlighted ? "#000000" : "#ffffff";
            ctx.fillRect(stitch.X * box, stitch.Y * box, box, box);
        }
    }
}
