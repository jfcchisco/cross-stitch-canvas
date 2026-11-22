export default class PathRenderer {
    drawConnections(ctx, sequence, box, lineWidth) {
        const colors = ["#00B8D9", "#F05A28"];
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        sequence.forEach((connection, index) => {
            const startX = connection[3][0] * box + box / 2;
            const startY = connection[3][1] * box + box / 2;
            const endX = connection[4][0] * box + box / 2;
            const endY = connection[4][1] * box + box / 2;
            const deltaX = endX - startX;
            const deltaY = endY - startY;
            const length = Math.hypot(deltaX, deltaY);
            const color = colors[index % colors.length];

            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = lineWidth + 4;
            ctx.stroke();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = lineWidth + 2;
            ctx.stroke();
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            const arrowSize = Math.min(Math.max(3, box * 0.75), length * 0.2);
            if (length < arrowSize * 2.5) {
                return;
            }

            const angle = Math.atan2(deltaY, deltaX);
            ctx.save();
            ctx.translate(startX + deltaX * 0.6, startY + deltaY * 0.6);
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(arrowSize, 0);
            ctx.lineTo(-arrowSize, -arrowSize * 0.7);
            ctx.lineTo(-arrowSize, arrowSize * 0.7);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.strokeStyle = "#000000";
            ctx.lineWidth = 3;
            ctx.fill();
            ctx.stroke();
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
        });
    }

    drawEndpoint(ctx, point, box, color, lineWidth) {
        const x = point[0] * box + box / 2;
        const y = point[1] * box + box / 2;
        const radius = Math.max(box * 0.55, lineWidth * 1.5);

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.strokeStyle = "#000000";
        ctx.lineWidth = lineWidth + 4;
        ctx.stroke();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = lineWidth + 2;
        ctx.stroke();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    drawRoute(ctx, sequence, box, lineWidth) {
        if (sequence.length === 0) {
            return;
        }

        ctx.save();
        this.drawConnections(ctx, sequence, box, lineWidth);
        this.drawEndpoint(ctx, sequence[0][3], box, "#B6FF00", lineWidth);
        this.drawEndpoint(ctx, sequence[sequence.length - 1][4], box, "#FF2D95", lineWidth);
        ctx.restore();
    }
}
