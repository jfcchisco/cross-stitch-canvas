let canvas = document.getElementById("canvas")
let ctx = canvas.getContext('2d')

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

let csvData = '';
let csvFile = 'rabbit.csv';

const dataholder = document.getElementById("dataholder")

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
const response = fetch(csvFile)
    .then(response => response.text())
    .then((text) => {
        dataholder.innerHTML = text;
    })

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

}




function draw()
{
    
    //canvas.width = window.innerWidth
    //canvas.height = window.innerHeight
    //console.log(csvData);
    //csvData = getCSV(csvFile);
    //console.log(dataholder.innerHTML.split("\n"));

    bigArray = dataholder.innerHTML.split("\n")

    
    //console.log(bigArray[bigArray.length-2])
    if(bigArray.length > 1) {
        cols = parseInt(bigArray[bigArray.length-2].split(",")[0])+1
        rows = parseInt(bigArray[bigArray.length-2].split(",")[1])+1
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
    ctx.scale((canvas.width/canvas.clientWidth)*cameraZoom, (canvas.height/canvas.clientHeight)*cameraZoom)
    ctx.translate( -window.innerWidth / 2 + cameraOffset.x, -window.innerHeight / 2 + cameraOffset.y )
    //ctx.translate(0, 0);
    ctx.clearRect(0,0, window.innerWidth, window.innerHeight)
    ctx.fillStyle = "#991111"
    drawRect(0, 0, canvas.width, canvas.height);
    
    if(bigArray.length > 1) {
        for (i = 1; i < bigArray.length-1; i ++) {
            let line = bigArray[i].split(",");
            ctx.fillStyle = "rgb(" + line[4] + ", " + line[5] + ", " + line[6] + ")";
            drawRect(line[0]*box, line[1]*box, box, box);
        }
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
    console.log("Click X:", getEventLocation(e).x);
    console.log("Click Y:", getEventLocation(e).y);
    mouseDown.x = e.clientX;
    mouseDown.y = e.clientY;
    
    console.log("Canvas Offset X:", cameraOffset.x - canvas.clientWidth/2);
    console.log("Canvas Offset Y:", cameraOffset.y - canvas.clientHeight/2);
    //console.log("Canvas Width:", canvas.width, canvas.clientWidth, window.innerWidth);
    //console.log("Canvas Height:", canvas.height, canvas.clientHeight, window.innerHeight);
    console.log("Bounding Box:", canvas.getBoundingClientRect())

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

    console.log("Canvas Click X:", canvasClick.x);
    console.log("Canvas Click Y:", canvasClick.y);
    console.log(MIN_ZOOM);
    

    if(mouseUp.x == mouseDown.x && mouseUp.y == mouseDown.y) { console.log(getStitchCoord(canvasClick))}
    else { console.log("Dragged") }
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
        
        console.log(zoomAmount)
    }
}

function getStitchCoord(canvasClick) {

    var obj = {
        x: Math.floor(canvasClick.x/box)+1,
        y: Math.floor(canvasClick.y/box)+1
    }
    
    //console.log(Math.floor(canvasClick.x/box)+1, Math.floor(canvasClick.y/box)+1);
    return obj;
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
