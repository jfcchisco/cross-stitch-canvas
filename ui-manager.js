/**
 * UI Manager Module
 * Manages user interface interactions and updates.
 * Handles all modal functionalities (Floss Usage, Preview, SGV Path)
 */

class UIManager {
    constructor() {
        // Initialization code if needed
        this.gridManager = null;
        this.patternLoader = null;
        this.colorTemplate = document.querySelector("[data-color-template]");
        this.colorContainer = document.querySelector("[data-color-container]");
        this.CLUSTER_SEQUENCE = [];
        this.CLUSTER_SIZE_FACTOR = 5.25;
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
        let colorContainer = this.colorContainer;
        //clear all elements of the modal
        let modalList = document.getElementById("modalList");

        //Clear table
        while(modalList.lastElementChild) {
            modalList.removeChild(modalList.lastElementChild);
        }

        // Get color array from GridManager
        const colorArray = this.gridManager.getColorArray();

        //Sort for table 
        colorArray.sort(function(a, b) {
            if(a.count < b.count) return 1;
            if(a.count > b.count) return -1;
            return 0;
        });

        //Count already stitched
        let stitched = 0;
        let toStitch = 0;
        colorArray.forEach(obj => {
            if(obj.code == "stitched") {
                stitched = obj.count;
            }
            else if(obj.code != "empty") {
                toStitch += obj.count;
            }
        })

        toStitch += stitched;
        // Add changed stitches
        let percentage = ((stitched * 100)/ toStitch).toFixed(2);

        // Fill color selectors
        this.refreshColorSelectors(colorContainer, colorArray);

        //Fill properties
        let par = document.getElementById("properties");
        const currentPattern = this.patternLoader.getCurrentPattern();
        let hS = currentPattern.properties.height;
        let wS = currentPattern.properties.width;
        // Aida 14 is 5.4 stitches per cm (0.185 mm per stitch)
        let hCM = (hS * 0.185).toFixed(1);
        let wCM = (wS * 0.185).toFixed(1);
        par.innerHTML = `<b>Dimensions:</b>&nbsp${hS}h x ${wS}w (${hCM}cm x ${wCM}cm)`;

        // Fill progress
        const progressPar = document.getElementById("progress");
        progressPar.innerHTML = `<b>Progress:</b>&nbsp${stitched}/${toStitch} stitched (${percentage}%)`;
        //Fill floss count
        let flossCountPar = document.getElementById("flossCount");
        flossCountPar.innerHTML = `<b>Color count:</b>&nbsp${this.gridManager.getColorCount()}`;

        //Fill table
        
        let table = document.createElement("table");
        const headRow = document.createElement('tr');

        let heads = ["Color", "Symbol", "Code", "Name", "Count"];
        for (let i in heads) {
            const headCell = document.createElement('th');
            headCell.textContent = heads[i];
            headRow.appendChild(headCell);
        }

        table.appendChild(headRow);

        let newRow = document.createElement('tr');
        let newCell = document.createElement('td');

        colorArray.map(color =>  {
            if(color.code != "empty") {
                newRow = document.createElement('tr');

                newCell = document.createElement('td');
                let backColor = "background-color: rgb(" + color.R + "," + color.G + "," + color.B + ")";
                newCell.setAttribute('style', backColor);
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.symbol;
                newCell.setAttribute('style', 'text-align: center');
                if(color.code === this.gridManager.highlightedColor) {
                    newCell.style.backgroundColor = "#ffff77";
                }
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.code;
                newCell.setAttribute('style', 'text-align: right');
                if(color.code === this.gridManager.highlightedColor) {
                    newCell.style.backgroundColor = "#ffff77";
                }
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.name;
                if(color.code === this.gridManager.highlightedColor) {
                    newCell.style.backgroundColor = "#ffff77";
                }
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.count;
                newCell.setAttribute('style', 'text-align: right');
                if(color.code === this.gridManager.highlightedColor) {
                    newCell.style.backgroundColor = "#ffff77";
                }
                newRow.appendChild(newCell);
                table.appendChild(newRow);
            }
        })
        
        if (this.gridManager.highFlag) {
            this.gridManager.selectColor(this.gridManager.highlightedColor, this.gridManager.highlightedSymbol);
        }

        modalList.appendChild(table);
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

    refreshColorSelectors(colorContainer, colorArray) {
        // Clear color selectors
        while(colorContainer.lastElementChild) {
            colorContainer.removeChild(colorContainer.lastElementChild);
        }

        colorArray.map(color =>  {
            // Fill color selectors
            if((color.code!="empty" && color.count > 0) || color.code === "stitched") {
                const colorDiv = this.colorTemplate.content.cloneNode(true).children[0];
                const colorBack = colorDiv.querySelector("[data-color-back]");
                const colorFront = colorDiv.querySelector("[data-color]");
                const colorId = colorDiv.querySelector("[data-color-id]");

                colorId.textContent = color.symbol;
                colorId.style.color = (((color.R * 0.299)+(color.G * 0.587)+(color.B * 0.114)) > 186) ? 'black' : 'white'; // contrast threshold
                
                const backColor = "background-color: rgb(" + color.R + "," + color.G + "," + color.B + ")";
                colorFront.setAttribute('style', backColor)
                const colorTitle = color.code + " - " + color.name;
                colorFront.setAttribute('title', colorTitle);
                const colorClick = `selectColor(\"${color.code}\", \"${color.symbol}\")`;
                colorFront.setAttribute('onclick', colorClick);

                if(colorBack != null) {
                    colorBack.classList.add('holyS');
                }
                this.colorContainer.append(colorDiv);
            }
        })
    }

    //* Preview Modal *//

    drawPreviewGridLines(argBox, argCtx, cols, rows) {          
        argCtx.beginPath();
        for(let i=0; i<=rows; i++) {
            if(i%10 == 0 || i==rows) {
                argCtx.moveTo(0, i*argBox);
                argCtx.lineTo(cols*argBox, i*argBox);
            }
        }
        for(let j=0; j<=cols; j++) {
            if(j%10 == 0 || j==cols) {
                argCtx.moveTo(j*argBox, 0);
                argCtx.lineTo(j*argBox, rows*argBox);
            }
        }
        argCtx.strokeStyle = "gray";
        argCtx.lineWidth = 1;
        argCtx.stroke();
    }

    preview() {
        this.showSpinner('Generating preview...');
        
        // Use setTimeout to allow the spinner to render before heavy computation
        setTimeout(() => {
            const canvas = document.getElementById("previewCanvas")
            const ctx = canvas.getContext('2d')
            const tileContainer = document.getElementsByClassName('tile-container')[0];

            const cols = this.patternLoader.getCols();
            const rows = this.patternLoader.getRows();

            let modal = document.getElementById("previewModal");

            const box = Math.max(1, (Math.min(Math.floor(tileContainer.offsetHeight/rows), Math.floor(tileContainer.offsetWidth/cols))));
            canvas.height = box * rows;
            canvas.width =  box * cols;

            modal.style.height = window.offsetHeight + "px";
            modal.style.width = window.offsetWidth + "px";

            ctx.clearRect(0,0, canvas.width, canvas.height)
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw tiles
            for(let stitch in this.patternLoader.currentPattern.stitches) {
                let stitchObj = this.patternLoader.currentPattern.stitches[stitch];
                
                let x = stitchObj.X * box;
                let y = stitchObj.Y * box;
                let colorData = (stitchObj.dmcCode === "stitched") ? this.gridManager.getDMCValuesFromCode(stitchObj.origCode) : this.gridManager.getDMCValuesFromCode(stitchObj.dmcCode);
                let R = colorData.R;
                let G = colorData.G;
                let B = colorData.B;
                let code = stitchObj.dmcCode;
                
                const [color] = this.gridManager.getTileColorsBasedOnFlags(code, R, G, B);
                ctx.fillStyle = color;
                ctx.fillRect(x, y, box, box);
            }

            //Draw changed tiles
            for(let change of this.patternLoader.changes) {
                let x = change.X * box;
                let y = change.Y * box;
                let colorData = this.gridManager.getDMCValuesFromCode(change.originalCode);
                let R = colorData.R;
                let G = colorData.G;
                let B = colorData.B;
                let code = "stitched";

                const [color] = this.gridManager.getTileColorsBasedOnFlags(code, R, G, B);
                ctx.fillStyle = color;
                ctx.clearRect(x, y, box, box);
                ctx.fillRect(x, y, box, box);
            }

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
            this.drawPreviewGridLines(box, ctx, cols, rows);
            document.getElementById("pathXInput").value = this.gridManager.lastClickedX;
            document.getElementById("pathYInput").value = this.gridManager.lastClickedY;
            this.hideSpinner();
        }, 0);
    }

    createPathClusters(stitchesList, cols, threshold) {
        const stitchByCoordinate = new Map();
        for (const stitch of stitchesList) {
            stitch.cluster = -1;
            stitchByCoordinate.set(stitch.Y * cols + stitch.X, stitch);
        }

        const clusters = [];
        for (const seed of stitchesList) {
            if (seed.cluster !== -1) {
                continue;
            }

            const cluster = {
                id: clusters.length,
                stitches: [],
                boundary: [],
                bounds: { minX: seed.X, minY: seed.Y, maxX: seed.X, maxY: seed.Y },
                buckets: new Map()
            };
            const queue = [seed];
            seed.cluster = cluster.id;

            for (let head = 0; head < queue.length; head++) {
                const stitch = queue[head];
                cluster.stitches.push(stitch);
                cluster.bounds.minX = Math.min(cluster.bounds.minX, stitch.X);
                cluster.bounds.minY = Math.min(cluster.bounds.minY, stitch.Y);
                cluster.bounds.maxX = Math.max(cluster.bounds.maxX, stitch.X);
                cluster.bounds.maxY = Math.max(cluster.bounds.maxY, stitch.Y);

                const neighbors = [
                    [stitch.X, stitch.Y - 1],
                    [stitch.X, stitch.Y + 1],
                    [stitch.X - 1, stitch.Y],
                    [stitch.X + 1, stitch.Y]
                ];
                for (const [x, y] of neighbors) {
                    if (x < 0 || x >= cols || y < 0) {
                        continue;
                    }
                    const neighbor = stitchByCoordinate.get(y * cols + x);
                    if (neighbor && neighbor.cluster === -1) {
                        neighbor.cluster = cluster.id;
                        queue.push(neighbor);
                    }
                }
            }
            clusters.push(cluster);
        }

        const bucketSize = Math.max(1, Math.ceil(threshold));
        for (const cluster of clusters) {
            for (const stitch of cluster.stitches) {
                const neighbors = [
                    [stitch.X, stitch.Y - 1],
                    [stitch.X, stitch.Y + 1],
                    [stitch.X - 1, stitch.Y],
                    [stitch.X + 1, stitch.Y]
                ];
                const isBoundary = neighbors.some(([x, y]) => {
                    const neighbor = x < 0 || x >= cols || y < 0
                        ? null
                        : stitchByCoordinate.get(y * cols + x);
                    return !neighbor || neighbor.cluster !== cluster.id;
                });
                if (!isBoundary) {
                    continue;
                }

                cluster.boundary.push(stitch);
                const bucketKey = this.getPathBucketKey(stitch.X, stitch.Y, bucketSize);
                let bucket = cluster.buckets.get(bucketKey);
                if (!bucket) {
                    bucket = [];
                    cluster.buckets.set(bucketKey, bucket);
                }
                bucket.push(stitch);
            }
        }
        return { clusters, bucketSize };
    }

    getPathBucketKey(x, y, bucketSize) {
        return `${Math.floor(x / bucketSize)},${Math.floor(y / bucketSize)}`;
    }

    getPathConnection(first, second, threshold, bucketSize, connectionCache) {
        if (first === second) {
            return null;
        }

        const firstId = Math.min(first.id, second.id);
        const secondId = Math.max(first.id, second.id);
        const cacheKey = `${firstId}:${secondId}`;
        let cached = connectionCache.get(cacheKey);
        if (cached === undefined) {
            const firstBounds = first.bounds;
            const secondBounds = second.bounds;
            const dx = Math.max(0, firstBounds.minX - secondBounds.maxX, secondBounds.minX - firstBounds.maxX);
            const dy = Math.max(0, firstBounds.minY - secondBounds.maxY, secondBounds.minY - firstBounds.maxY);
            if (dx * dx + dy * dy > threshold * threshold) {
                return null;
            }

            let source = first;
            let target = second;
            if (source.boundary.length > target.boundary.length) {
                source = second;
                target = first;
            }

            let bestDistanceSquared = threshold * threshold;
            let sourcePoint = null;
            let targetPoint = null;
            for (const point of source.boundary) {
                const pointBucketX = Math.floor(point.X / bucketSize);
                const pointBucketY = Math.floor(point.Y / bucketSize);
                const minBucketX = pointBucketX - 1;
                const maxBucketX = pointBucketX + 1;
                const minBucketY = pointBucketY - 1;
                const maxBucketY = pointBucketY + 1;
                for (let bucketY = minBucketY; bucketY <= maxBucketY; bucketY++) {
                    for (let bucketX = minBucketX; bucketX <= maxBucketX; bucketX++) {
                        const bucket = target.buckets.get(`${bucketX},${bucketY}`);
                        if (!bucket) {
                            continue;
                        }
                        for (const candidate of bucket) {
                            const deltaX = point.X - candidate.X;
                            const deltaY = point.Y - candidate.Y;
                            const distanceSquared = deltaX * deltaX + deltaY * deltaY;
                            if (distanceSquared < bestDistanceSquared ||
                                (!sourcePoint && distanceSquared === bestDistanceSquared)) {
                                bestDistanceSquared = distanceSquared;
                                sourcePoint = point;
                                targetPoint = candidate;
                                if (bestDistanceSquared === 0) {
                                    break;
                                }
                            }
                        }
                        if (bestDistanceSquared === 0) {
                            break;
                        }
                    }
                    if (bestDistanceSquared === 0) {
                        break;
                    }
                }
                if (bestDistanceSquared === 0) {
                    break;
                }
            }

            if (!sourcePoint) {
                return null;
            }
            cached = {
                firstId,
                secondId,
                distance: Math.sqrt(bestDistanceSquared),
                firstPoint: source.id === firstId ? sourcePoint : targetPoint,
                secondPoint: source.id === firstId ? targetPoint : sourcePoint
            };
            connectionCache.set(cacheKey, cached);
            if (connectionCache.size > 20000) {
                connectionCache.delete(connectionCache.keys().next().value);
            }
        }

        if (first.id === cached.firstId) {
            return [
                first.id,
                second.id,
                cached.distance,
                [cached.firstPoint.X, cached.firstPoint.Y],
                [cached.secondPoint.X, cached.secondPoint.Y]
            ];
        }
        return [
            first.id,
            second.id,
            cached.distance,
            [cached.secondPoint.X, cached.secondPoint.Y],
            [cached.firstPoint.X, cached.firstPoint.Y]
        ];
    }

    getClosestPathCluster(clusters, pointX, pointY) {
        let closestCluster = null;
        let closestDistanceSquared = Infinity;
        for (const cluster of clusters) {
            for (const stitch of cluster.stitches) {
                const dx = stitch.X - pointX;
                const dy = stitch.Y - pointY;
                const distanceSquared = dx * dx + dy * dy;
                if (distanceSquared < closestDistanceSquared) {
                    closestDistanceSquared = distanceSquared;
                    closestCluster = cluster;
                }
            }
        }
        return closestCluster;
    }

    getPathRouteDistance(route, threshold, bucketSize, connectionCache) {
        let distance = 0;
        for (let index = 1; index < route.length; index++) {
            const connection = this.getPathConnection(
                route[index - 1],
                route[index],
                threshold,
                bucketSize,
                connectionCache
            );
            if (!connection) {
                return Infinity;
            }
            distance += connection[2] + route[index].stitches.length * this.CLUSTER_SIZE_FACTOR;
        }
        return distance;
    }

    findBestPathInsertion(route, clusters, visited, routeDistance, threshold, maxTotalDistance, bucketSize, connectionCache) {
        let bestInsertion = null;
        for (const candidate of clusters) {
            if (visited.has(candidate.id)) {
                continue;
            }

            const serviceCost = candidate.stitches.length * this.CLUSTER_SIZE_FACTOR;
            for (let position = 1; position <= route.length; position++) {
                const previous = route[position - 1];
                const toCandidate = this.getPathConnection(previous, candidate, threshold, bucketSize, connectionCache);
                if (!toCandidate) {
                    continue;
                }

                let addedCost = toCandidate[2] + serviceCost;
                if (position < route.length) {
                    const next = route[position];
                    const fromCandidate = this.getPathConnection(candidate, next, threshold, bucketSize, connectionCache);
                    const replaced = this.getPathConnection(previous, next, threshold, bucketSize, connectionCache);
                    if (!fromCandidate || !replaced) {
                        continue;
                    }
                    addedCost += fromCandidate[2] - replaced[2];
                }

                if (routeDistance + addedCost > maxTotalDistance) {
                    continue;
                }

                const score = candidate.stitches.length / Math.max(addedCost, 0.001);
                if (!bestInsertion ||
                    score > bestInsertion.score ||
                    (score === bestInsertion.score && candidate.stitches.length > bestInsertion.cluster.stitches.length) ||
                    (score === bestInsertion.score &&
                        candidate.stitches.length === bestInsertion.cluster.stitches.length &&
                        addedCost < bestInsertion.addedCost) ||
                    (score === bestInsertion.score &&
                        candidate.stitches.length === bestInsertion.cluster.stitches.length &&
                        addedCost === bestInsertion.addedCost &&
                        candidate.id < bestInsertion.cluster.id)) {
                    bestInsertion = { cluster: candidate, position, addedCost, score };
                }
            }
        }
        return bestInsertion;
    }

    improvePathRoute(route, maxTotalDistance, threshold, bucketSize, connectionCache) {
        const maxEvaluations = 5000;
        let routeDistance = this.getPathRouteDistance(route, threshold, bucketSize, connectionCache);

        for (let pass = 0; pass < 2; pass++) {
            let bestRoute = route;
            let bestDistance = routeDistance;
            let evaluations = 0;

            for (let start = 1; start < route.length && evaluations < maxEvaluations; start++) {
                for (let end = start + 1; end < route.length && evaluations < maxEvaluations; end++) {
                    const reordered = route.slice();
                    const [moved] = reordered.splice(start, 1);
                    reordered.splice(end, 0, moved);
                    const distance = this.getPathRouteDistance(reordered, threshold, bucketSize, connectionCache);
                    evaluations++;
                    if (distance <= maxTotalDistance && distance < bestDistance) {
                        bestRoute = reordered;
                        bestDistance = distance;
                    }
                }
            }

            for (let start = 1; start < route.length - 1 && evaluations < maxEvaluations; start++) {
                for (let end = start + 1; end < route.length && evaluations < maxEvaluations; end++) {
                    const reordered = route.slice();
                    const reversed = reordered.slice(start, end + 1).reverse();
                    reordered.splice(start, reversed.length, ...reversed);
                    const distance = this.getPathRouteDistance(reordered, threshold, bucketSize, connectionCache);
                    evaluations++;
                    if (distance <= maxTotalDistance && distance < bestDistance) {
                        bestRoute = reordered;
                        bestDistance = distance;
                    }
                }
            }

            if (bestDistance >= routeDistance) {
                break;
            }
            route = bestRoute;
            routeDistance = bestDistance;
        }
        return { route, distance: routeDistance };
    }

    buildCoveragePath(startCluster, clusters, threshold, maxTotalDistance, bucketSize, connectionCache) {
        if (!startCluster) {
            return { sequence: [], stitchCount: 0, distance: 0 };
        }

        let route = [startCluster];
        let routeDistance = 0;
        const visited = new Set([startCluster.id]);
        while (true) {
            const insertion = this.findBestPathInsertion(
                route,
                clusters,
                visited,
                routeDistance,
                threshold,
                maxTotalDistance,
                bucketSize,
                connectionCache
            );
            if (insertion) {
                route.splice(insertion.position, 0, insertion.cluster);
                visited.add(insertion.cluster.id);
                routeDistance = this.getPathRouteDistance(route, threshold, bucketSize, connectionCache);
                continue;
            }

            const improved = this.improvePathRoute(
                route,
                maxTotalDistance,
                threshold,
                bucketSize,
                connectionCache
            );
            if (improved.distance >= routeDistance) {
                break;
            }
            route = improved.route;
            routeDistance = improved.distance;
        }

        const sequence = [];
        let stitchCount = route[0].stitches.length;
        for (let index = 1; index < route.length; index++) {
            const connection = this.getPathConnection(
                route[index - 1],
                route[index],
                threshold,
                bucketSize,
                connectionCache
            );
            if (connection) {
                sequence.push(connection);
                stitchCount += route[index].stitches.length;
            }
        }
        return { sequence, stitchCount, distance: routeDistance };
    }

    drawPathConnections(ctx, sequence, box, lineWidth) {
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

    drawPathEndpoint(ctx, point, box, color, lineWidth) {
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

    drawPathRoute(ctx, sequence, box, lineWidth) {
        if (sequence.length === 0) {
            return;
        }

        ctx.save();
        this.drawPathConnections(ctx, sequence, box, lineWidth);
        this.drawPathEndpoint(ctx, sequence[0][3], box, "#B6FF00", lineWidth);
        this.drawPathEndpoint(ctx, sequence[sequence.length - 1][4], box, "#FF2D95", lineWidth);
        ctx.restore();
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
                const ctx = canvas.getContext("2d");
                const tileContainer = document.getElementsByClassName("tile-container")[0];
                const threshold = Number(document.getElementById("pathInput")?.value ?? 10);
                const distanceInput = document.getElementById("pathDistanceLimit")?.value.trim() ?? "";
                const maxTotalDistance = distanceInput === ""
                    ? cols * rows * 2
                    : Number(distanceInput);

                if (!ctx) {
                    throw new Error("Preview canvas context is unavailable.");
                }
                if (!Number.isFinite(threshold) || threshold < 0) {
                    throw new Error("Threshold must be a non-negative number.");
                }
                if (!Number.isFinite(maxTotalDistance) || maxTotalDistance < 0) {
                    throw new Error("Distance limit must be a non-negative number.");
                }
                if (cols <= 0 || rows <= 0) {
                    throw new Error("The current pattern has no drawable area.");
                }

                const box = Math.max(1, Math.min(
                    Math.floor(tileContainer.offsetHeight / rows),
                    Math.floor(tileContainer.offsetWidth / cols)
                ));
                canvas.height = box * rows;
                canvas.width = box * cols;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                const highlightedColor = this.gridManager.highlightedColor;
                for (const stitch of this.patternLoader.getCurrentPattern().stitches) {
                    const isHighlighted = stitch.dmcCode === highlightedColor &&
                        !this.gridManager.isTileChanged(stitch.X, stitch.Y);
                    ctx.fillStyle = isHighlighted ? "#000000" : "#ffffff";
                    ctx.fillRect(stitch.X * box, stitch.Y * box, box, box);
                }

                const highlightedStitches = this.gridManager.getHighlightedStitches(highlightedColor);
                const { clusters, bucketSize } = this.createPathClusters(highlightedStitches, cols, threshold);
                let startCluster = null;
                if (clusters.length > 0) {
                    if (type === 0) {
                        startCluster = this.getClosestPathCluster(clusters, 0, 0);
                    } else if (type === 1) {
                        startCluster = this.getClosestPathCluster(clusters, cols / 2, rows / 2);
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
                        startCluster = this.getClosestPathCluster(clusters, coordX, coordY);
                    } else if (type === 3) {
                        startCluster = clusters[Math.floor(Math.random() * clusters.length)];
                    } else {
                        throw new Error("Unknown path start selection.");
                    }
                }

                const connectionCache = new Map();
                const result = this.buildCoveragePath(
                    startCluster,
                    clusters,
                    threshold,
                    maxTotalDistance,
                    bucketSize,
                    connectionCache
                );
                this.CLUSTER_SEQUENCE = result.sequence;
                if (stats) {
                    stats.textContent = `Covered: ${result.stitchCount}/${highlightedStitches.length} stitches · Estimated path cost: ${result.distance.toFixed(1)}`;
                }

                this.drawPreviewGridLines(box, ctx, cols, rows);
                this.drawPathRoute(ctx, result.sequence, box, Math.max(1, box * 0.12));
            } catch (error) {
                this.CLUSTER_SEQUENCE = [];
                if (stats) {
                    stats.textContent = `Path calculation failed: ${error.message}`;
                }
                console.error("Path calculation failed.", error);
            } finally {
                this.hideSpinner();
            }
        }, 0);
    }

    drawPreviewPath(ctx) {
        if(this.CLUSTER_SEQUENCE.length === 0) {
            return;
        }
        const box = this.gridManager.tileSize;
        this.drawPathRoute(ctx, this.CLUSTER_SEQUENCE, box, Math.max(3, box * 0.2));
    }

    drawPath() {
        this.gridManager.pathFlag = true;
        this.gridManager.renderHighlightLayer();
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