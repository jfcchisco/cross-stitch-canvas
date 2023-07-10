let canvas = document.getElementById("canvas")
let ctx = canvas.getContext('2d')

const colorTemplate = document.querySelector("[data-color-template]");
const colorContainer = document.querySelector("[data-color-container]");

canvas.width = 5000;
canvas.height = 5000;

let cameraOffset = { x: window.innerWidth/2, y: window.innerHeight/2 }
//let cameraZoom = 1
let MAX_ZOOM = 4
let MIN_ZOOM = Math.min(canvas.clientHeight / canvas.height, canvas.clientWidth / canvas.width);
let SCROLL_SENSITIVITY = 0.001
let cameraZoom = MIN_ZOOM;

let box = 50; // Stitch width and height
let i = 0;
let j = 0;
let cols = 0;
let rows = 0;

let paintFlag = false;
let highFlag = false;
let highCode = 0;
let alpha = 1;


let jsonText = '';
let jsonFile = 'rabbit.json';
let jsonObject = {};

let jsonColors = {};

//const dataholder = document.getElementById("dataholder")

//async function getCSV(csvFile) {

    //return new Promise(async function(resolve, reject){
    //    const res = await fetch(csvFile);

    //    resolve(res.text());
    //}) 

    

//    let response = await fetch(csvFile);
//    let data = await response.text();
    //console.log(data);

//    let splitData = data.split('\n');
//    console.log(splitData);
//    return data;
//}


//THIS WORKS
//const response = fetch(csvFile)
//    .then(response => response.text())
//    .then((text) => {
//        dataholder.innerHTML = text;
//    })

//console.log(dataholder.innerHTML.value);
//THIS WORKS

//async function fetchCSV() {
//    const response = await fetch(csvFile);
//    const csvData = await response.text();
//    return csvData;
//}

//fetchCSV().then(csvData => {csvData;});

//console.log(csvData);



window.onload = function() {

    
    //csvData = getCSV(csvFile);
    //console.log(csvData)//;
    //console.log(dataholder.innerHTML);


    //let csvText;
    //let file = 'rabbit.csv';
    //fetch(file)
    //.then(x => x.text())
    //.then(data => { csvText = data; })
    //.then(() => { console.log(csvText); });

    //console.log(csvText);

    
/*
    fetch("./rabbit_colors.json")
        .then(response => {
            return response.json();
        })
        .then(data => {
            jsonColors = data;
            colors = data.map(color =>  {
                //console.log(color.R);
                const colorDiv = colorTemplate.content.cloneNode(true).children[0];
                const colorBack = colorDiv.querySelector("[data-color-back]");
                const colorFront = colorDiv.querySelector("[data-color]");
                const colorId = colorDiv.querySelector("[data-color-id]");

                colorId.textContent = color.symbol;
                
                const backColor = "background-color: rgb(" + color.R + "," + color.G + "," + color.B + ")";
                colorFront.setAttribute('style', backColor)
                const colorTitle = color.code + " - " + color.name;
                colorFront.setAttribute('title', colorTitle);
                const colorClick = "selectColor(" + color.code + ", \"" + color.symbol + "\")";
                colorFront.setAttribute('onclick', colorClick);

                if(colorBack != null) {
                    colorBack.classList.add('holyS');
                    console.log('added');
                }
                colorContainer.append(colorDiv);
                

            })
        })

*/
    fetch("./rabbit.json")
        .then(response => {
            return response.json();
        })
        .then((data) => {
            jsonObject = data;

            //Create object with unique colors and count
            //jsonColors = {};
            colorArray = [];

            data.forEach(obj => {
                //console.log(obj);
                colorArray = checkAndAddColor(colorArray, obj);
            })

            colorArray.sort(function(a, b) {
                if(a.count < b.count) return 1;
                if(a.count > b.count) return -1;
                return 0;
            });
            //console.log(colorArray);
            //dataholder.dataset.json = JSON.stringify(data);
            //dataholder.innerHTML = JSON.stringify(data);

            colors = colorArray.map(color =>  {
                //console.log(color.R);
                if(color.code!=0) {
                    const colorDiv = colorTemplate.content.cloneNode(true).children[0];
                    const colorBack = colorDiv.querySelector("[data-color-back]");
                    const colorFront = colorDiv.querySelector("[data-color]");
                    const colorId = colorDiv.querySelector("[data-color-id]");

                    colorId.textContent = color.symbol;
                    colorId.style.color = (((color.R * 0.299)+(color.G * 0.587)+(color.B * 0.114)) > 186) ? 'black' : 'white'; // contrast threshold
                    
                    const backColor = "background-color: rgb(" + color.R + "," + color.G + "," + color.B + ")";
                    colorFront.setAttribute('style', backColor)
                    const colorTitle = color.code + " - " + color.name;
                    colorFront.setAttribute('title', colorTitle);
                    const colorClick = "selectColor(" + color.code + ", \"" + color.symbol + "\")";
                    colorFront.setAttribute('onclick', colorClick);

                    if(colorBack != null) {
                        colorBack.classList.add('holyS');
                        console.log('added');
                    }
                    colorContainer.append(colorDiv);
                }
                
                

            })

            fillFlossUsage();

            
        })


}

function checkAndAddColor (colors, line) 
{
    let length = colors.length;
    let found = false;
    //console.log(line);

    for (i = 0; i < length; i ++) {
        
        if(line.dmcCode == colors[i].code) {
            found = true;
            colors[i].count = colors[i].count + 1;
        }
    }
    

    if(!found) {
        colors.push( { 
            "code": line.dmcCode,
            "name": line.dmcName,
            "R": line.R,
	        "G": line.G,
	        "B": line.B,
	        "symbol": line.symbol,
            "count": 1
        } );
    }
   
    return colors;

}


function draw()
{
    
    //canvas.width = window.innerWidth
    //canvas.height = window.innerHeight
    //console.log(csvData);
    //csvData = getCSV(csvFile);
    //console.log(dataholder.innerHTML.split("\n"));

    //jsonText = dataholder.getAttribute("data-json");
    //jsonText = jsonText.replace("[",""); 
    //jsonText = jsonText.replace("]","");
    
    
    //console.log(jsonColors);
    

    //console.log(jsonObject[Object.keys(jsonObject).length-1]);

    //var jsonObject = JSON.parse('[{"X":"0","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"1","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"2","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"3","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"4","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"5","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"6","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"7","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"8","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"9","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"10","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"11","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"12","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"13","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"14","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"15","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"16","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"17","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"18","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"19","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"20","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"21","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"22","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"23","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"24","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"25","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"26","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"27","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"28","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"29","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""},{"X":"30","Y":"0","dmcCode":"0","dmcName":"Empty","R":"0","G":"0","B":"0","symbol":""}]');
    //console.log(jsonObject);
    //jsonText = "'" + jsonText + "'"
    //let jsonObject = JSON.parse(dataholder.innerHTML);
    
    //bigArray = dataholder.innerHTML.split("\n")

    jsonLength = Object.keys(jsonObject).length
    
    //console.log(bigArray[bigArray.length-2])
    if(jsonLength > 1) {
        cols = jsonObject[jsonLength-1].X + 1;
        rows = jsonObject[jsonLength-1].Y + 1;
        //cols = parseInt(bigArray[bigArray.length-2].split(",")[0])+1
        //rows = parseInt(bigArray[bigArray.length-2].split(",")[1])+1
        //console.log(cols, rows)
        //console.log(jsonObject[Object.keys(jsonObject).length-1].X + 1)
    }
    else {
        rows = 10;
        cols = 10;
    }
    //console.log(rows, cols)
    canvas.width = cols * box;
    canvas.height = rows * box;
    //canvas.width = 5000;
    //canvas.height = 5000;
    
    MIN_ZOOM = Math.min(canvas.clientHeight / canvas.height, canvas.clientWidth / canvas.width);
    
    //console.log(canvas.width, canvas.height);
    
    // Translate to the canvas centre before zooming - so you'll always zoom on what you're looking directly at
    //ctx.translate( window.innerWidth / 2, window.innerHeight / 2 )
    //ctx.translate(0, 0);
    ctx.scale((canvas.width/canvas.clientWidth)*cameraZoom, (canvas.height/canvas.clientHeight)*cameraZoom);
    ctx.translate( -window.innerWidth / 2 + cameraOffset.x, -window.innerHeight / 2 + cameraOffset.y );
    
    //ctx.translate(0, 0);
    ctx.clearRect(0,0, window.innerWidth, window.innerHeight)
    ctx.fillStyle = "#ffffff"
    drawRect(0, 0, canvas.width, canvas.height);
    
    
    //highCode = 553;

    //console.log(bigArray.length, Object.keys(jsonObject).length)


    if(jsonLength > 1) {
        for (i = 1; i < jsonLength; i ++) {
            
            //let line = bigArray[i].split(",");
            let line = jsonObject[i]
            //console.log(line)
            //console.log(line);

            if(highFlag == true && line.dmcCode != highCode) {
                alpha = 0.2;
            } 
            else if (highFlag == true && line.dmcCode == highCode) {
                alpha = 1;
                //ctx.fillStyle = "black";
                //ctx.lineWidth = 1;
                //draw lines around box
                //up
                //ctx.beginPath()
                //ctx.moveTo(line.X*box, line.Y*box);
                //ctx.lineTo(line.X*box, line.Y*box+box);
                //ctx.lineTo(line.X*box+box, line.Y*box+box);
                //ctx.lineTo(line.X*box+box, line.Y*box);
                //ctx.lineTo(line.X*box, line.Y*box);
                //ctx.stroke();
            } 
            else {
                alpha = 1;
            }


            ctx.fillStyle = "rgba(" + line.R + ", " + line.G + ", " + line.B + "," + alpha + ")";
            drawRect(line.X*box, line.Y*box, box, box);
            //ctx.fillStyle = "rgba(0,0,0," + alpha + ")";
            ctx.fillStyle = (((line.R * 0.299)+(line.G * 0.587)+(line.B * 0.114)) > 186) ? "rgba(0,0,0," + alpha + ")" : "rgba(255,255,255," + alpha + ")"; // contrast threshold
            ctx.font = "bold 35px Arial";
            ctx.fillText(line.symbol, line.X*box+12, line.Y*box+38);

        }
    }

    //DRAW LINES
    for(i = 0; i < cols/10; i++) {
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.moveTo(i*10*box-1, 0);
        ctx.lineTo(i*10*box-1, canvas.height);
        ctx.lineWidth = 3;
        ctx.stroke();

        drawRect(i*10*box, box+(125 - canvas.getBoundingClientRect().y)/cameraZoom - (cameraOffset.y - canvas.clientHeight/2), 50, 32)

        ctx.fillStyle = "white";
        ctx.fillText(i*10, i*10*box+5, box+((125+25*cameraZoom) - canvas.getBoundingClientRect().y)/cameraZoom - (cameraOffset.y - canvas.clientHeight/2));

    }

    for(i = 0; i < rows/10; i++) {
        ctx.fillStyle = "black";
        ctx.beginPath();
        ctx.moveTo(0, i*10*box-1);
        ctx.lineTo(canvas.width, i*10*box-1);
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = "blue";
        drawRect((canvas.getBoundingClientRect().x)/cameraZoom - (cameraOffset.x - canvas.clientWidth/2), i*10*box, 50, 32)

        ctx.fillStyle = "white";

        //ctx.rotate((90 * Math.PI) / 180);
        ctx.fillText(i*10, ((2*cameraZoom) - canvas.getBoundingClientRect().x)/cameraZoom - (cameraOffset.x - canvas.clientWidth/2), i*10*box+25);
        //ctx.rotate(0);
    }



    //i=0; j = 0;
    //for(j = 0; j < 100; j++) {
        //console.log(i, i%0);
    //    for(i = 0; i < 100; i++) {
    //        if((i+j)%2 == 0) { ctx.fillStyle = "#00ffff"; }
    //        else { ctx.fillStyle = "#ff00ff"; }
    //        drawRect(i*box, j*box, box, box);
    //    }
        
        
    //}
       
    requestAnimationFrame( draw )
}

// Gets the relevant location from a mouse or single touch event
function getEventLocation(e)
{
    if (e.touches && e.touches.length == 1)
    {
        return { x:e.touches[0].clientX, y: e.touches[0].clientY }
    }
    else if (e.clientX && e.clientY)
    {
        return { x: e.clientX, y: e.clientY }        
    }
}

function drawRect(x, y, width, height)
{
    ctx.fillRect( x, y, width, height )
}

function drawText(text, x, y, size, font)
{
    ctx.font = `${size}px ${font}`
    ctx.fillText(text, x, y)
}

let isDragging = false
let dragStart = { x: 0, y: 0 }
let mouseDown = { x: 0, y: 0 }
let mouseUp = { x: 0, y: 0 }
let canvasClick = { x: 0, y:0 }

function onPointerDown(e)
{
    isDragging = true
    dragStart.x = getEventLocation(e).x/cameraZoom - cameraOffset.x
    dragStart.y = getEventLocation(e).y/cameraZoom - cameraOffset.y
    //console.log("Click X:", getEventLocation(e).x);
    //console.log("Click Y:", getEventLocation(e).y);
    mouseDown.x = e.clientX;
    mouseDown.y = e.clientY;
    
    //console.log("Canvas Offset X:", cameraOffset.x - canvas.clientWidth/2);
    //console.log("Canvas Offset Y:", cameraOffset.y - canvas.clientHeight/2);
    //console.log("Canvas Width:", canvas.width, canvas.clientWidth, window.innerWidth);
    //console.log("Canvas Height:", canvas.height, canvas.clientHeight, window.innerHeight);
    //console.log("Bounding Box:", canvas.getBoundingClientRect())

}


function onPointerUp(e)
{
    isDragging = false
    initialPinchDistance = null
    lastZoom = cameraZoom
    mouseUp.x = e.clientX;
    mouseUp.y = e.clientY;
    //console.log(mouseDown, mouseUp);

    canvasClick.x = (getEventLocation(e).x - canvas.getBoundingClientRect().x)/cameraZoom - (cameraOffset.x - canvas.clientWidth/2);
    canvasClick.y = box+(getEventLocation(e).y - canvas.getBoundingClientRect().y)/cameraZoom - (cameraOffset.y - canvas.clientHeight/2);
    // Why box + ...? Hell I don't know

    //console.log("Canvas Click X:", canvasClick.x);
    //console.log("Canvas Click Y:", canvasClick.y);
    //console.log(MIN_ZOOM);

    //console.log(cameraOffset);
    

    if(mouseUp.x == mouseDown.x && mouseUp.y == mouseDown.y) { 
        console.log(getStitchCoord(canvasClick))
    }
    //else { console.log("Dragged") }
}

function onPointerMove(e)
{
    if (isDragging)
    {
        cameraOffset.x = getEventLocation(e).x/cameraZoom - dragStart.x
        cameraOffset.y = getEventLocation(e).y/cameraZoom - dragStart.y
        
    }
    
}

function handleTouch(e, singleTouchHandler)
{
    if ( e.touches.length == 1 )
    {
        singleTouchHandler(e)
    }
    else if (e.type == "touchmove" && e.touches.length == 2)
    {
        isDragging = false
        handlePinch(e)
    }
}

let initialPinchDistance = null
let lastZoom = cameraZoom

function handlePinch(e)
{
    e.preventDefault()
    
    let touch1 = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    let touch2 = { x: e.touches[1].clientX, y: e.touches[1].clientY }
    
    // This is distance squared, but no need for an expensive sqrt as it's only used in ratio
    let currentDistance = (touch1.x - touch2.x)**2 + (touch1.y - touch2.y)**2
    
    if (initialPinchDistance == null)
    {
        initialPinchDistance = currentDistance
    }
    else
    {
        adjustZoom( null, currentDistance/initialPinchDistance )
    }
}

function adjustZoom(zoomAmount, zoomFactor)
{
    if (!isDragging)
    {
        if (zoomAmount)
        {
            cameraZoom += zoomAmount
        }
        else if (zoomFactor)
        {
            //console.log(zoomFactor)
            cameraZoom = zoomFactor*lastZoom
        }
        
        cameraZoom = Math.min( cameraZoom, MAX_ZOOM )
        cameraZoom = Math.max( cameraZoom, MIN_ZOOM )
        
        //console.log(zoomAmount)
    }
}

function zoomReset() {
    cameraZoom = MIN_ZOOM;
    cameraOffset = { x: window.innerWidth/2, y: window.innerHeight/2 }
    
}



function getStitchCoord(canvasClick) {

    var obj = {
        x: Math.floor(canvasClick.x/box)+1,
        y: Math.floor(canvasClick.y/box)+1
    }
    
    //console.log(Math.floor(canvasClick.x/box)+1, Math.floor(canvasClick.y/box)+1);
    return obj;
}

function highlight() {
    //console.log(highFlag);
    clearActiveTool();
    highFlag = !highFlag;
    //console.log(highFlag);
    if(highFlag) {
        document.getElementById("highTool").classList.add("activeTool");
    }

    //clear other flags
    paintFlag = false;
}

function paint() {
    clearActiveTool();
    paintFlag = !paintFlag;

    if(paintFlag) {
        document.getElementById("paintTool").classList.add("activeTool");
    }

    //clear other flags
    highFlag = false;
}

function clearActiveTool() {
    const collection = document.getElementsByClassName("toolback");
    for (let i = 0; i < collection.length; i++) {
        collection[i].classList.remove("activeTool");
    }
   
}

function selectColor(color, symbol) {
    //console.log(color);
    const collection = document.getElementsByClassName("colorback");
    for (let i = 0; i < collection.length; i++) {
        collection[i].classList.remove("activeColor");
    }

    for (let i = 0; i < collection.length; i++) {
        if(collection[i].children[0].children[0].innerHTML == symbol) {
            collection[i].classList.add("activeColor");
        }
        //console.log(collection[i].children[0].children[0].innerHTML);
    }

    highCode = color;

}

function fillFlossUsage() {
    //Fill properties
    let par = document.getElementById("properties");
    par.innerHTML = (jsonObject[Object.keys(jsonObject).length-1].X + 1) + "w x " + (jsonObject[Object.keys(jsonObject).length-1].Y + 1) + "h"


    //Fill table
    let table = document.getElementById("modalTable");
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

    colors = colorArray.map(color =>  {
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
    })


    //list.appendChild(table);
}

function flossUsageOpen() {
    let modal = document.getElementById("myModal");
    modal.style.display = "block";


}

function flossUsageClose() {
    let modal = document.getElementById("myModal");
    modal.style.display = "none";
}



window.onclick = function(event) {
    let modal = document.getElementById("myModal");
    if(event.target == modal) {
        modal.style.display = "none";
    }
}

canvas.addEventListener('mousedown', onPointerDown)
canvas.addEventListener('touchstart', (e) => handleTouch(e, onPointerDown))
canvas.addEventListener('mouseup', onPointerUp)
canvas.addEventListener('touchend',  (e) => handleTouch(e, onPointerUp))
canvas.addEventListener('mousemove', onPointerMove)
canvas.addEventListener('touchmove', (e) => handleTouch(e, onPointerMove))
canvas.addEventListener( 'wheel', (e) => adjustZoom(e.deltaY*SCROLL_SENSITIVITY))

// Ready, set, go
draw()

//Refresh MIN_ZOOM in case there is a chance that the window changed size
//MIN_ZOOM = Math.min(canvas.clientHeight / canvas.height, canvas.clientWidth / canvas.width);
