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
        this.THRESHOLD = 10;
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
        let percentage = ((stitched * 100)/ toStitch).toFixed(2);

        //Sort for table 
        colorArray.sort(function(a, b) {
            if(a.count < b.count) return 1;
            if(a.count > b.count) return -1;
            return 0;
        });

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
        par.innerHTML = hS + "h x " + wS + "w (" + hCM + "cm x " + wCM + "cm). " + stitched + "/" + toStitch + " stitched (" + percentage + "%)";

        //Fill floss count
        let flossCountPar = document.getElementById("flossCount");
        flossCountPar.innerHTML = colorArray.length + " colors";

        //Fill table
        
        //let table = document.getElementById("modalTable");
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
                //newCell.textContent = color.R + "," + color.G + "," + color.B;
                let backColor = "background-color: rgb(" + color.R + "," + color.G + "," + color.B + ")";
                newCell.setAttribute('style', backColor);
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.symbol;
                newCell.setAttribute('style', 'text-align: center');
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.code;
                newCell.setAttribute('style', 'text-align: right');
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.name;
                newRow.appendChild(newCell);

                newCell = document.createElement('td');
                newCell.textContent = color.count;
                newCell.setAttribute('style', 'text-align: right');
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
            if(color.code!="empty" && color.count > 0) {
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

    preview(data, cols, rows) {
        let canvas = document.getElementById("canvas")
        let ctx = canvas.getContext('2d')

        let modal = document.getElementById("previewModal");

        let box = Math.max(1, (Math.min(Math.floor(document.body.offsetHeight/rows), Math.floor(document.body.offsetWidth/cols))));
        canvas.height = box * rows;
        canvas.width =  box * cols;

        let modalHeight = box * rows + 30;
        let modalWidth =  box * cols + 30;

        modal.style.height = modalHeight+"px";
        modal.style.width = modalWidth+"px";

        ctx.clearRect(0,0, canvas.width, canvas.height)
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        
        for (let i = 0; i < data.length; i++) {
            let tileValues = data[i];
            //Adding offset due to ruler and svg-container
            let row = this.gridManager.tileContainer.children.item(tileValues.Y + 2);
            let tile = row.children.item(tileValues.X + 1)

            let backColor = tile.style.backgroundColor;
            if(!backColor.match('rgba')) {
                ctx.fillStyle = backColor;
                ctx.fillRect(tileValues.X * box, tileValues.Y * box, tileValues.X * box + box, tileValues.Y * box + box);
            }
            else {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(tileValues.X * box, tileValues.Y * box, tileValues.X * box + box, tileValues.Y * box + box);
            }
        }

        this.drawPreviewGridLines(box, ctx, cols, rows);

        let createPathDiv = document.getElementsByClassName("pathButtons")[0];
        let inputFields = document.getElementsByClassName("inputFields")[0];
        inputFields.style.display = "none";
        createPathDiv.style.display = "none";
        if(this.gridManager.highFlag && this.gridManager.highlightedColor != 0) {
            createPathDiv.style.display = "grid";
            inputFields.style.display = "grid";
        }
    }

    createMarkers() {
        let svgContainer = document.getElementsByClassName("svg-container")[0].children[0];
        //Clear previous markers
        while(svgContainer.lastElementChild) {
            svgContainer.removeChild(svgContainer.lastElementChild);
        }
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const marker1 = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker1.setAttribute("id", "arrow1");   
        marker1.setAttribute("markerWidth", "10");
        marker1.setAttribute("markerHeight", "10");
        marker1.setAttribute("refX", "3.5");
        marker1.setAttribute("refY", "2.5");
        marker1.setAttribute("orient", "auto");
        const arrowPath1 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath1.setAttribute("d", "M0,0 L0,5 L4,2.5 z");
        arrowPath1.setAttribute("fill", "dodgerblue");
        marker1.appendChild(arrowPath1);
        defs.appendChild(marker1);

        const marker2 = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker2.setAttribute("id", "arrow2");   
        marker2.setAttribute("markerWidth", "10");
        marker2.setAttribute("markerHeight", "10");
        marker2.setAttribute("refX", "3.5");
        marker2.setAttribute("refY", "2.5");
        marker2.setAttribute("orient", "auto");
        const arrowPath2 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath2.setAttribute("d", "M0,0 L0,5 L4,2.5 z");
        arrowPath2.setAttribute("fill", "orange");
        marker2.appendChild(arrowPath2);
        defs.appendChild(marker2);

        const marker3 = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker3.setAttribute("id", "arrow3");   
        marker3.setAttribute("markerWidth", "10");
        marker3.setAttribute("markerHeight", "10");
        marker3.setAttribute("refX", "3.5");
        marker3.setAttribute("refY", "2.5");
        marker3.setAttribute("orient", "auto");
        const arrowPath3 = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrowPath3.setAttribute("d", "M0,0 L0,5 L4,2.5 z");
        arrowPath3.setAttribute("fill", "red");
        marker3.appendChild(arrowPath3);
        defs.appendChild(marker3);
        
        const marker4 = document.createElementNS("http://www.w3.org/2000/svg", "marker");
        marker4.setAttribute("id", "circle");
        marker4.setAttribute("markerWidth", "10");
        marker4.setAttribute("markerHeight", "10");
        marker4.setAttribute("refX", "5");
        marker4.setAttribute("refY", "5");
        marker4.setAttribute("orient", "auto");
        const circlePath = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        circlePath.setAttribute("cx", "5");
        circlePath.setAttribute("cy", "5");
        circlePath.setAttribute("r", "5");
        circlePath.setAttribute("fill", "red");
        marker4.appendChild(circlePath);
        defs.appendChild(marker4);

        svgContainer.appendChild(defs);

    }

    assignClusters(stitchesList) {
        // Assign clusters to a list of highlighted stitches
        let clusterCounter = 0;
        // Create a map for fast coordinate lookup
        const stitchMap = new Map();
        stitchesList.forEach((stitch, index) => {
            const key = `${stitch.X},${stitch.Y}`;
            stitchMap.set(key, index);
            stitch.cluster = 0; // Reset clusters
        });

        for(let i = 0; i < stitchesList.length; i++) {
            let s = stitchesList[i];
            if(s.cluster == 0) {
                clusterCounter += 1;
                let neighborList = this.gridManager.getConnectedTiles(s.X, s.Y, s.code);
                for(let neighbor of neighborList) {
                    const key = `${neighbor.x},${neighbor.y}`;
                    const index = stitchMap.get(key);
                    if(index !== undefined) {
                        stitchesList[index].cluster = clusterCounter;
                    }
                }
            }
        }
        return stitchesList;
    }

    getDistBetweenClusters(c1, c2, sList) {
        let retVal = [0, 0, 0, [0, 0], [0, 0]];
        let dist = Infinity;
        for(let s1 of sList) {
            if(s1.cluster == c1) {
                for(let s2 of sList) {
                    if(s2.cluster == c2) {
                        let newDist = Math.sqrt((s1.X - s2.X) ** 2 + (s1.Y - s2.Y) ** 2);
                        if(newDist < dist) {
                            dist = newDist;
                            retVal = [c1, c2, dist, [s1.X, s1.Y], [s2.X, s2.Y] ];
                        }
                    }
                }
            }
        }
        return retVal;
    }

    getClosestClusterToPoint(clusterNumbers, sList, pointX, pointY) {
        let retCluster = -1;
        let dist = Infinity;
        for(let c of clusterNumbers) {
            for(let s of sList) {
                if(s.cluster == c) {
                    let newDist = Math.sqrt((s.X - pointX) ** 2 + (s.Y - pointY) ** 2);
                    if(newDist < dist) {
                        dist = newDist;
                        retCluster = c;
                    }
                }
            }
        }
        return retCluster;
    }

    previewPath(type) {
        // This function should be called only when there is already a created canvas
        // with the highlighted color and highlight flag activated
        this.showSpinner('Calculating path...');
        
        // Use setTimeout to allow the spinner to render before heavy computation
        setTimeout(() => {
            const cols = this.patternLoader.getCols();
            const rows = this.patternLoader.getRows();
            const thresholdInput = document.getElementById('pathInput');
            const threshold = thresholdInput ? Number(thresholdInput.value) : 10;

            let highStitches = this.gridManager.getHighlightedStitches(this.gridManager.highlightedColor);
            highStitches = this.assignClusters(highStitches);
            
            let clusterNumbers = [];
            highStitches.forEach(s => {
                if(!clusterNumbers.includes(s.cluster)) {
                    clusterNumbers.push(s.cluster);
                }
            });

            let canvas = document.getElementById("canvas");
            let ctx = canvas.getContext('2d');

            //Repeated drawing of stitches
            let box = Math.max(1, (Math.min(Math.floor(document.body.offsetHeight/rows), Math.floor(document.body.offsetWidth/cols))));
            
            ctx.clearRect(0,0, canvas.width, canvas.height)
            ctx.fillStyle = "#ffffff"
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw one rectangle as test
            let s = highStitches[1];
            ctx.fillStyle = "#000000";
            ctx.fillRect(10,10,20,20);
            
            const tileCollection = document.getElementsByClassName("tile");

            for (let i = 0; i < tileCollection.length; i++) {
                let tileObj = tileCollection[i];
                let code = tileObj.getAttribute('data-tile-code');
                let x = Number(tileObj.getAttribute('data-tile-x'));
                let y = Number(tileObj.getAttribute('data-tile-y'));
                if(code == this.gridManager.highlightedColor) {
                    ctx.fillStyle = "#000000";;
                    ctx.fillRect(x * box, y * box, x * box + box, y * box + box);
                }
                else {
                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(x * box, y * box, x * box + box, y * box + box);
                }
            }
            let clusterSequence = [];
            let nextCluster = 0;
            if(type == 0) {
                // Closest to top-left
                nextCluster = this.getClosestClusterToPoint(clusterNumbers, highStitches, 0, 0);
            }
            else if(type == 1) {
                // Closest to center
                nextCluster = this.getClosestClusterToPoint(clusterNumbers, highStitches, cols/2, rows/2);
            }
            else if(type == 2) {
                // Closest to bottom-right
                let coordX = Number(document.getElementById("pathXInput").value);
                let coordY = Number(document.getElementById("pathYInput").value);
                if(coordX == null || !Number.isInteger(coordX) || coordX > cols || coordX < 0) {
                    alert("Invalid X coordinate, using 0"); 
                    coordX = 0;
                }
                if(coordY == null || !Number.isInteger(coordY) || coordY > rows || coordY < 0) {
                    alert("Invalid Y coordinate, using 0");
                    coordY = 0;
                }
                nextCluster = this.getClosestClusterToPoint(clusterNumbers, highStitches, coordX, coordY);
            }
            else if(type == 3) {
                nextCluster = clusterNumbers[Math.floor(Math.random() * clusterNumbers.length)];
            }
            let closestCluster = 0;
            while(clusterNumbers.length > 0) {
                let dist2Next = [nextCluster, 0, Infinity, [0,0], [0,0]];
                for (let i = 0; i < clusterNumbers.length; i++) {
                    let cNum = clusterNumbers[i];
                    let dist2Cluster = this.getDistBetweenClusters(nextCluster, cNum, highStitches);
                    if(dist2Cluster[2] < dist2Next[2] && dist2Cluster[2] != 0) {
                        dist2Next = dist2Cluster;
                        closestCluster = cNum;
                    }
                }

                if(dist2Next[2] <= threshold) {
                    clusterSequence.push(dist2Next);
                    if(clusterSequence.length == 1) {
                        let index = clusterNumbers.indexOf(nextCluster);
                        if (index > -1) {
                            clusterNumbers.splice(index, 1);
                        }
                    }
                    nextCluster = closestCluster;
                    //remove from clusterNumbers
                    let index = clusterNumbers.indexOf(closestCluster);
                    if (index > -1) {
                        clusterNumbers.splice(index, 1);
                    }
                }
                else {
                    // Try a better path
                    // Go through the clusterSequence and find the summed
                    // distance to each pair
                    let newMinSum = dist2Next[2];
                    let betterOptionFlag = false;
                    let newSeq0 = [];
                    let newSeq1 = [];
                    let betterOptionIndex = -1;
                    for(let i = 0; i < clusterSequence.length; i++) {
                        let dist0 = this.getDistBetweenClusters(clusterSequence[i][0], closestCluster, highStitches);
                        let dist1 = this.getDistBetweenClusters(closestCluster, clusterSequence[i][1], highStitches);
                        let sumDist = dist0[2] + dist1[2];
                        if(sumDist < newMinSum) {
                            // Found a better option
                            newMinSum = sumDist;
                            betterOptionFlag = true;
                            newSeq0 = dist0;
                            newSeq1 = dist1;
                            betterOptionIndex = i;
                        }
                    }
                    if(betterOptionFlag) {
                        clusterSequence.splice(betterOptionIndex, 1, newSeq0, newSeq1);
                        let index = clusterNumbers.indexOf(closestCluster);
                        if (index > -1) {
                            clusterNumbers.splice(index, 1);
                        }
                    }
                    else {
                        clusterSequence.push(dist2Next);
                        if(clusterSequence.length == 1) {
                            let index = clusterNumbers.indexOf(nextCluster);
                            if (index > -1) {
                                clusterNumbers.splice(index, 1);
                            }
                        }
                        nextCluster = closestCluster;
                        //remove from clusterNumbers
                        let index = clusterNumbers.indexOf(closestCluster);
                        if (index > -1) {
                            clusterNumbers.splice(index, 1);
                        }
                    }
                }
            }
            // Draw circle on the initial point
            ctx.beginPath();
            ctx.arc(clusterSequence[0][3][0]*box + box/2, clusterSequence[0][3][1]*box + box/2, box, 0, 2 * Math.PI);
            ctx.strokeStyle = "red";
            ctx.lineWidth = 2;
            ctx.stroke();
            // Draw circle on the final point
            let lastCluster = clusterSequence[clusterSequence.length - 1];
            ctx.beginPath();   
            ctx.arc(lastCluster[4][0]*box + box/2, lastCluster[4][1]*box + box/2, box, 0, 2 * Math.PI);
            ctx.strokeStyle = "orange";
            ctx.lineWidth = 2;
            ctx.stroke();
            // Draw path lines
            let lineColor = "cyan";
            clusterSequence.forEach(cluster => {
                ctx.beginPath();
                ctx.moveTo(cluster[3][0]*box + box/2, cluster[3][1]*box + box/2);
                ctx.lineTo(cluster[4][0]*box + box/2, cluster[4][1]*box + box/2);
                if(lineColor == "cyan") {
                    lineColor = "greenyellow";
                }
                else {
                    lineColor = "cyan";
                }
                if(cluster[2] > threshold) {
                    ctx.strokeStyle = "red";
                }
                else {
                    ctx.strokeStyle = lineColor;
                }
                ctx.lineWidth = 2;
                ctx.stroke();
            })
            // Copy to global variable
            this.CLUSTER_SEQUENCE = clusterSequence;
            this.THRESHOLD = threshold;
            this.drawPreviewGridLines(box, ctx, cols, rows);
            this.hideSpinner();
        }, 0);
    }

    drawSVG() {
        const cols = this.patternLoader.getCols();
        const rows = this.patternLoader.getRows();
        if(this.CLUSTER_SEQUENCE.length === 0) {
            return;
        }
        let tileWidth = document.getElementsByClassName("tile")[0].offsetWidth;
        let svgContainer = document.getElementsByClassName("svg-container")[0].children[0];
        // Delete all previous lines
        while (svgContainer.lastElementChild) { 
            svgContainer.removeChild(svgContainer.lastElementChild);
        }

        let svgWidth = tileWidth * (cols + 1);
        let svgHeight = tileWidth * (rows + 1);
        svgContainer.setAttribute("viewBox", `0 0 ${svgWidth} ${svgHeight}`);
        svgContainer.setAttribute("width", svgWidth);
        svgContainer.setAttribute("height", svgHeight);
        /// Insert defs for arrowheads
        this.createMarkers(svgContainer);

        let lineColor = "dodgerblue";
        this.CLUSTER_SEQUENCE.forEach(cluster => {
            let newLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
            
            newLine.setAttribute("x1", (cluster[3][0]*tileWidth + tileWidth + tileWidth/2).toString());
            newLine.setAttribute("y1", (cluster[3][1]*tileWidth + tileWidth + tileWidth/2).toString());
            newLine.setAttribute("x2", (cluster[4][0]*tileWidth + tileWidth + tileWidth/2).toString());
            newLine.setAttribute("y2", (cluster[4][1]*tileWidth + tileWidth + tileWidth/2).toString());
            newLine.setAttribute("stroke-width", "2");
            newLine.setAttribute("marker-end", "url(#arrowhead)");
            if(lineColor == "dodgerblue") {
                lineColor = "orange";
                newLine.setAttribute("marker-end", "url(#arrow2)");
            }
            else {
                lineColor = "dodgerblue";
                newLine.setAttribute("marker-end", "url(#arrow1)");
            }
            if(cluster[2] > this.THRESHOLD) {
                lineColor = "red";
                newLine.setAttribute("marker-end", "url(#arrow3)");
            }
            newLine.setAttribute("stroke", lineColor);
            svgContainer.append(newLine); 
        });
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