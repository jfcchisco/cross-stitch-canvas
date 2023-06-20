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

function draw()
{
    
    //canvas.width = window.innerWidth
    //canvas.height = window.innerHeight
    canvas.width = 5000;
    canvas.height = 5000;
    
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
    
    //ctx.fillStyle = "#eecc77"
    //drawRect(-35,-35,20,20)
    //drawRect(15,-35,20,20)
    //drawRect(-35,15,70,20)
    
    i=0; j = 0;
    //ctx.fillStyle = "#00ffff"
    for(j = 0; j < 100; j++) {
        //console.log(i, i%0);
        for(i = 0; i < 100; i++) {
            if((i+j)%2 == 0) { ctx.fillStyle = "#00ffff"; }
            else { ctx.fillStyle = "#ff00ff"; }
            drawRect(i*box, j*box, box, box);
        }
        
        
    }
    //ctx.fillStyle = "#00ffff"
    //drawRect(0,0,box,box)
    //ctx.fillStyle = "#ff00ff"
    //drawRect(0,50,box,box)


    //drawText("Simple Pan and Zoom Canvas", -255, -100, 32, "courier")
    
    //ctx.rotate((Math.round(Date.now()/40)%35000)*Math.PI / 180)
    //ctx.fillStyle = `#${(Math.round(Date.now()/40)%4096).toString(16)}`
    //drawText("Now with touch!", -110, 100, 32, "courier")
    
    //ctx.fillStyle = "#fff"
    //ctx.rotate(31*Math.PI / 180)
    
    //drawText("Wow, you found me!", -260, -2000, 48, "courier")
    
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
    console.log("Canvas Width:", canvas.width, canvas.clientWidth, window.innerWidth);
    console.log("Canvas Height:", canvas.height, canvas.clientHeight, window.innerHeight);
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
    canvasClick.y = (getEventLocation(e).y - canvas.getBoundingClientRect().y)/cameraZoom - (cameraOffset.y - canvas.clientHeight/2);

    //console.log("Canvas Click X:", canvasClick.x);
    //console.log("Canvas Click Y:", canvasClick.y);
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
