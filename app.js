/**
 * 
 * @param {any} condition 
 * @param {string} message 
 */
function assert(condition, message = "Assertion failed!") {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * 
 * @param {number} value 
 * @param {number} minValue 
 * @param {number} maxValue 
 */
function clamp(value, minValue, maxValue) {
  assert(minValue <= maxValue);
  if (value < minValue) {
    return minValue;
  } else if (value > maxValue) {
    return maxValue;
  } else {
    return value;
  }
}

/**
 * 
 * @param {HTMLElement} el 
 * @param {MouseEvent} evt 
 */
function getMousePosition(el, evt) {
  const rect = el.getBoundingClientRect();
  return {
    x: evt.clientX - rect.left,
    y: evt.clientY - rect.top
  };
}

/**
 * 
 * @param {string} url 
 * @returns {Promise<HTMLImageElement>}
 */
function fetchImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = (ev) => {
      resolve(image);
    };
    image.onerror = (ev) => {
      console.error(`Error loading image: ${url}`);
      reject();
    };

    image.src = url;
  });
}

// Junk
let _;

/** @type {HTMLCanvasElement} */
let canvas;



/** @type {HTMLImageElement} */
let backgroundImage;

/** @type {HTMLCanvasElement} */
let backgroundCanvas = document.createElement("canvas");

/** @type {HTMLImageElement} */
let foregroundImage;

/** @type {HTMLCanvasElement} */
let foregroundCanvas = document.createElement("canvas");

/** @type {HTMLImageElement} */
let borderImage;

/** @type {HTMLCanvasElement} */
let borderCanvas = document.createElement("canvas");

/**
 * What to scale the image by so its height fits the canvas's height.
 * 
 * * If the image's height is larger than that of the canvas, then the scale 
 *   will be less than 1.
 * * If the image's height is exactly as that of the canvas, then the scale will
 *   be exactly 1.
 * * If the image's height is smaller than the canvas, then the scale will be
 *   greater than 1.
 */
let imageScale = 1;

const promiseWindowLoaded = new Promise((resolve, reject) => {
  const handleLoad = () => {
    window.removeEventListener("load", handleLoad);
    resolve();
  };
  window.addEventListener("load", handleLoad);
});

let ready = false;

let animating = false;



let imageOffsetX = 0;

/** @type {number} */
let animationRequestID;


const mouse = {
  x: 0,
  y: 0
};

/** Previous time of animation frame.  Default 0. */
let previousTime = 0;


const panningSpeed = 800;



const KEY_ARROW_LEFT = 37;
const KEY_ARROW_UP = 38;
const KEY_ARROW_RIGHT = 39;
const KEY_ARROW_DOWN = 40;

const KEY_A = 65;
const KEY_W = 87;
const KEY_D = 68;
const KEY_S = 83;

const g_keys = [];


window.onkeydown = (ev) => {
  if (false) {
    console.info(ev);
  }
  g_keys[ev.keyCode] = true;
};

window.onkeyup = (ev) => {
  g_keys[ev.keyCode] = false;
};

/**
 * 
 * @param {number} keyCode 
 */
function isKeyDown(keyCode) {
  return !!g_keys[keyCode];
}

/**
 * 
 * @param {number[]} keyCodes 
 */
function isOneKeyDown(keyCodes) {
  for (let i = 0; i < keyCodes.length; ++i) {
    const keyCode = keyCodes[i];
    if (isKeyDown(keyCode)) return true;
  }
  return false;
}

window.onresize = (ev) => {
  resizeCanvas();
};

/**
 * 
 * @param {HTMLImageElement | HTMLCanvasElement} source
 * @param {HTMLCanvasElement} target
 * @param {number} scale
 */
function resizeImage(source, target, scale) {
  
  target.width = Math.round(scale * source.width);
  target.height = Math.round(scale * source.height);

  const ctx = target.getContext("2d");

  if (ctx.imageSmoothingQuality) {
    ctx.imageSmoothingQuality = "high";
  }

  {
    const image = source;

    const sx = 0;
    const sy = 0;
    const sWidth = source.width;
    const sHeight = source.height;

    const dx = 0;
    const dy = 0;
    const dWidth = target.width;
    const dHeight = target.height;

    ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
  }
}

function resizeImages() {
  resizeImage(backgroundImage, backgroundCanvas, imageScale);
  resizeImage(foregroundImage, foregroundCanvas, imageScale);
  resizeImage(borderImage, borderCanvas, imageScale * 1.8);
}

function resizeCanvas() {
  if (!ready) return;

  const { width, height } = canvas.getBoundingClientRect();
  canvas.width = width;
  canvas.height = height;

  // Determine what we should scale images by.
  imageScale = canvas.height / foregroundImage.height;

  resizeImages();
}


function stopAnimation() {
  animating = false;
  window.cancelAnimationFrame(animationRequestID);;
}


function startAnimation() {
  if (animating) return;
  animating = true;
  previousTime = 0;
  animate(previousTime);
}

/**
 * 
 * @param {number} currentTime 
 */
function animate(currentTime) {
  if (!animating) return;
  const dt = Math.max(currentTime - previousTime, 1000 / 60);

  previousTime = currentTime;

  step(dt);
  render(dt);

  animationRequestID = window.requestAnimationFrame(animate);
}

/**
 * 
 * @param {number} dt 
 */
function step(dt) {
  {
    // Move offset of image (proportional to dt)
    const imageMovement = panningSpeed * dt / 1000;

    const canvasWidth = canvas.width;
    const imageWidth = foregroundCanvas.width;
    assert(canvasWidth < imageWidth);
    const limit = imageWidth - canvasWidth;

    if (isOneKeyDown([KEY_ARROW_LEFT, KEY_A])) {
      imageOffsetX = clamp(imageOffsetX - imageMovement, 0, limit);
    } else if (isOneKeyDown([KEY_ARROW_RIGHT, KEY_D])) {
      imageOffsetX = clamp(imageOffsetX + imageMovement, 0, limit);
    }
  }
}

/**
 * 
 * @param {number} dt 
 */
function render(dt) {
  if (!ready) return;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // TODO: crap is resolution dependent :'(
  const borderWidth = borderCanvas.width;
  const borderHeight = borderCanvas.height;

  const backgroundScale = 0.9;


  // Draw foreground image
  {
    const image = foregroundCanvas;

    const dx = -imageOffsetX;
    const dy = 0;

    ctx.drawImage(image, dx, dy);
  }

  // Draw portion of background image
  if (true) {
    const image = backgroundCanvas;

    const backgroundWidth = borderWidth * 0.937;
    const backgroundHeight = borderHeight * 0.937;

    const sx = mouse.x + imageOffsetX - backgroundWidth / 2;
    const sy = mouse.y - backgroundHeight / 2;
    const sWidth = backgroundWidth;
    const sHeight = backgroundHeight;

    const dx = mouse.x - backgroundWidth / 2;
    const dy = mouse.y - backgroundHeight / 2;
    const dWidth = backgroundWidth;
    const dHeight = backgroundHeight;

    ctx.drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight);
  }
  

  // Draw border image
  {
    const image = borderCanvas;

    const sx = mouse.x - borderWidth / 2;
    const sy = mouse.y - borderHeight / 2;

    ctx.drawImage(image, sx, sy);
  }

  if (false) {
    // DEBUG: Framerate
    ctx.fillStyle = "green";
    ctx.fillText(`FPS: ${1000 / dt}`, 10, 10);
  }
}


async function main() {
  [_, foregroundImage, backgroundImage, borderImage] = await Promise.all([
    promiseWindowLoaded,
    fetchImage("./HappyPanorama.jpg"),
    fetchImage("./SadPanorama.jpg"),
    
    fetchImage("./phone-landscape.png")
  ]);

  assert(typeof foregroundImage !== "undefined");
  assert(typeof backgroundImage !== "undefined");
  assert(typeof borderImage !== "undefined");

  assert(foregroundImage.width === backgroundImage.width);
  assert(foregroundImage.height === backgroundImage.height);

  canvas = document.querySelector("#canvas");

  ready = true;

  resizeCanvas();



  canvas.onmousemove = (evt) => {
    const { x, y } = getMousePosition(canvas, evt);

    mouse.x = x;
    mouse.y = y;
  };

  

  // await resizeImages();

  startAnimation();
}

main();


