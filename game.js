const canvas = document.getElementById("game");

const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const HEIGHT = canvas.height;
const WIDTH = canvas.width;

const playerHeight = HEIGHT * 0.1;
const playerWidth = WIDTH * 0.1;

const speedX = WIDTH * 0.5;
const speedY = HEIGHT * 0.45;

const localSave = localStorage.getItem("playerSave");

const buttons = document.getElementById("buttons");
const saveButton = document.getElementById("saveButton");
const resetButton = document.getElementById("resetButton");

let backroomsTimer = 0;

let playerStats = {};

if (localSave) {
    playerStats = JSON.parse(localSave);
} else {
    playerStats = {
        x: WIDTH / 2,
        y: HEIGHT / 2,
        strength: 0,
        inventory: [],
        map: "start"
    }
}

let game = true;

let onExit = null;

let gymTimer = 0;

let lastTime = 0;

let mapData = await getMapData(playerStats.map);

let spriteList = loadSprite(mapData.sprite);

let itemList = loadSprite(mapData.items);


const url = "https://storage.googleapis.com/mixed-media-assets";

const playerSprite = new Image();
playerSprite.src = `${url}/sprites/shaw.png`

let currentMap = new Image();
currentMap.src = `${url}/${playerStats.map}.png`;

const door = new Image();
door.src = `${url}/items/door.png`;

const bad = new Image();
bad.src = `${url}/items/death.png`

const good = new Image();
good.src = `${url}/items/win.png`;

saveButton.style.height = `${0.07  * HEIGHT}px`;
saveButton.style.width = `${0.13 * WIDTH}px`;

function saveData() {
    const save = JSON.stringify(playerStats);
    localStorage.setItem("playerSave", save);
}
saveButton.addEventListener("click", saveData)

resetButton.style.height = `${0.07  * HEIGHT}px`;
resetButton.style.width = `${0.05 * WIDTH}px`;

function resetData() {
    localStorage.removeItem("playerSave");
    location.reload();
}
resetButton.addEventListener("click", resetData);

async function playMusic() {
    const gameMusic = document.getElementById("gameMusic");
    await gameMusic.play();
}
//playMusic();

async function getMapData(map) {
    const response = await fetch(`./json/${map}.json`);
    const data = await response.json();
    return data;
}

// movement logic
const keys = {};

// keep track of which keys are pressed, add them to keys, 
// and apply a boolean for which is actively being pressed
window.addEventListener("keydown", event => {keys[event.key] = true;});
window.addEventListener("keyup", event => {keys[event.key] = false;});

// a helper function to determine collision between 
// the player and sprites (aabb collision detection)
function collisionHelper(player, sprite) {
    return (
        player.x < (sprite.x * WIDTH) + (sprite.width * WIDTH) &&
        player.x + player.width > (sprite.x * WIDTH) &&
        player.y < (sprite.y * HEIGHT) + (sprite.height * HEIGHT) &&
        player.y + player.height > (sprite.y * HEIGHT)
    );
}

// the function for updating player movement
// based on keypress, sprite collision, and 
// screen border collision
function updateMovement(dt) {
    // up down character movement
    if (keys["w"]) {
        playerStats.y -= speedY * dt; // up
    }
    if (keys["s"]) {
        playerStats.y += speedY * dt; // down
    }

    // wall collision checker
    if (playerStats.y < 0) {
        playerStats.y = 0; // top wall
    }
    if (playerStats.y + playerHeight > canvas.height) {
        playerStats.y = canvas.height - playerHeight; // bottom wall
    }

    // sprite collision: y-axis
    // no separation will result in "sticky walls"
    // can't move along opposite axis if stuck on one
    // e.g., collide on x, can't move along y

    let playerDimensions = {
    x: playerStats.x,
    y: playerStats.y,
    width: playerWidth,
    height: playerHeight
    }

    // undo movement if colliding with sprite
    if (spriteList.length > 0) {
        for (const sprite of spriteList) {
            if (collisionHelper(playerDimensions, sprite)) {
                if (sprite.name === 'entity') {
                    gameOver("bad");
                    console.log("dead brah")
                }
                eventChecker();
                if (keys["w"]) {
                    playerStats.y += speedY * dt
                }
                if (keys["s"]) {
                    playerStats.y -= speedY * dt;
                }
            }
        }
    }

    // left right character movement
    if (keys["a"]) {
        playerStats.x -= speedX * dt; // left
    }
    if (keys["d"]) {
        playerStats.x += speedX * dt; // right
    }

    // wall collision checker
    if (playerStats.x < 0) {
        playerStats.x = 0; // left wall
    }
    if (playerStats.x + playerWidth > canvas.width) {
        playerStats.x = canvas.width - playerWidth; // right wall
    }

    playerDimensions = {
    x: playerStats.x,
    y: playerStats.y,
    width: playerWidth,
    height: playerHeight
    }

    // sprite collision: x-axis
    if (spriteList.length > 0) {
        for (const sprite of spriteList) {
            if (collisionHelper(playerDimensions, sprite)) {
                if (sprite.name === 'entity') {
                    gameOver("bad");
                    console.log("you've been backroomed")
                }
                eventChecker();
                if (keys["a"]) {
                    playerStats.x += speedX * dt;
                }
                if (keys["d"]) {
                    playerStats.x -= speedX * dt;
                }
            }
        }
    }
}

function itemCollision() {
    if (itemList.length === 0) {
        return;
    }

    let playerDimensions = {
    x: playerStats.x,
    y: playerStats.y,
    width: playerWidth,
    height: playerHeight
    }

    for (const item of itemList) {
        const itemDimensions = {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height
        }

        if (collisionHelper(playerDimensions, itemDimensions)) {
            if (item.name === "uranium") {
                gameOver("bad");
                console.log("uranium fever!");
            }
            playerStats.inventory.push(item);
            console.log("picked up item!");
            itemList.pop();
            return;
        }
    }
}

function exits() {
    const playerDimensions = {
        x: playerStats.x,
        y: playerStats.y,
        width: playerWidth,
        height: playerHeight
    }

    for (const exit of mapData.exits) {
        const exitDimensions = {
            x: exit.x,
            y: exit.y,
            width: exit.width,
            height: exit.height
        }

        if (collisionHelper(playerDimensions, exitDimensions)) {
            let enterX = WIDTH / 2;
            let enterY = HEIGHT / 2;
            newArea(exit.location, enterX, enterY);
            return;
        }
    }
}

async function newArea(newMap, newX, newY) {
    mapData = await getMapData(newMap);

    playerStats.x = newX;
    playerStats.y = newY;
    playerStats.map = newMap;

    currentMap = new Image();
    currentMap.src = mapData.mapSrc;

    spriteList = loadSprite(mapData.sprite);
    itemList = loadSprite(mapData.items);
}

function loadSprite(list) {
    if (list === 0) {
        return [];
    }

    let returnList = []

    for (const sprite of list) {
        if (playerStats.inventory.length > 0) {
            for (const item of playerStats.inventory) {
                if (item.name === sprite.name) {
                    return [];
                }
            }
        }
        const image = new Image();
        image.src = sprite.src;

        returnList.push({
            ...sprite,
            image: image
        })
    }

    return returnList;
}

function dontDrawItem(roomItem) {
    let itemNames = [];
    if (playerStats.length === 0) {
        return false;
    }
    for (let item of playerStats.inventory) {
        itemNames.push(item.name);
    }
    for (const itemName of itemNames) {
        if (itemName === roomItem.name) {
            return true;
        }
    }
    return false;
}

function drawSprite() {
    ctx.drawImage(playerSprite, playerStats.x, playerStats.y,
                  playerWidth, playerHeight);

    if (spriteList.length > 0) {
        for (const sprite of spriteList) {
            ctx.drawImage(
                sprite.image,
                sprite.x * WIDTH,
                sprite.y * HEIGHT,
                sprite.width * WIDTH,
                sprite.height * HEIGHT
            );
        }
    }

    if (itemList.length === 0){
        return;
    }
    for (const item of itemList) {
        if (dontDrawItem(item)) {
            return;
        }
        ctx.drawImage(
            item.image,
            item.x * WIDTH,
            item.y * HEIGHT,
            item.width * WIDTH,
            item.height * HEIGHT
        );
    }   
}

function drawExits() {
    for (const exit of mapData.exits) {
        const exitDimensions = {
            x: exit.x * WIDTH,
            y: exit.y * HEIGHT,
            width: exit.width * WIDTH,
            height: exit.height * HEIGHT
        };

        ctx.drawImage(
            door,
            exitDimensions.x,
            exitDimensions.y,
            exitDimensions.width,
            exitDimensions.height
        );
    }
}

function drawMap() {
    ctx.drawImage(currentMap, 0, 0, WIDTH, HEIGHT);
    drawExits();
    drawSprite();
}

const hudX = WIDTH * 0.9;
const hudY = HEIGHT * 0.05;

function eventChecker(dt) {
    // backrooms 10 sec. timer before death logic
    if (playerStats.map === "backrooms") {
        backroomsTimer += dt;

        ctx.fillStyle = "white";
        ctx.font = "50px Courier New";
        ctx.textAlign = "center";

        ctx.fillText(`${backroomsTimer.toFixed(2)} / 10`, hudX, hudY);

        if (backroomsTimer > 10) {
            gameOver("bad");
        }
        return;
    } else {
        backroomsTimer = 0;
    }

    // gym strength increase logic
    if (playerStats.map === "gym") {
        gymTimer += dt;


        ctx.fillStyle = "white";
        ctx.font = "50px Courier New";
        ctx.textAlign = "center";

        ctx.fillText(`strength: ${playerStats.strength}`, hudX, hudY);

        if (gymTimer > 1) {
            playerStats.strength += 1;
            gymTimer = 0;
            return;
        }
    }

    // giving apple to alex logic
    if (playerStats.map === "bridge") {
        if (playerStats.inventory.length === 0) {
            return;
        }
        for (const item of playerStats.inventory) {
            if (item.name === "golden apple") {
                let playerDimensions = {
                x: playerStats.x,
                y: playerStats.y,
                width: playerWidth,
                height: playerHeight
                }

                if (collisionHelper(playerDimensions, spriteList[0])) {
                    console.log("game over");
                    gameOver("good");
                }
            }
        }
    }

    // slaying the elf logic
    if (playerStats.map === "loz") {
        let playerDimensions = {
                x: playerStats.x,
                y: playerStats.y,
                width: playerWidth,
                height: playerHeight
            }
        let touchingElf = collisionHelper(playerDimensions, spriteList[0]);

        if (touchingElf) {
            for (const item of playerStats.inventory) {
                console.log(item.name)
                if (item.name === "sword" && playerStats.strength >= 10) {
                    gameOver("good");
                    return;
                }
            }
            gameOver("bad");
        }
    }
}

function gameOver(endingType) {
    game = false;

    let x = WIDTH  * 0.25;
    let y = HEIGHT * 0.25;
    let w = WIDTH * 0.5;
    let h = HEIGHT * 0.5;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    if (endingType === "bad") {
        ctx.drawImage(bad, x, y, w, h);
        console.log("drawn bad");
    } else if (endingType === "good") {
        ctx.drawImage(good, x, y, w, h);
        console.log("drawn good");
    }

    buttons.style.display = "none";

    ctx.fillStyle = "white";
    ctx.font = "50px Courier New";
    ctx.textAlign = "center";

    ctx.fillText("Click to Restart", (WIDTH / 2), y + h);

    window.addEventListener("click", resetData);
}

async function loop() {
    if (!game) {
        return;
    }
    let currentTime = performance.now();
    let dt = 0;
    if (lastTime > 0) {
        dt = (currentTime - lastTime) / 1000;
    }
    lastTime = currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    exits();
    drawMap();
    updateMovement(dt);
    itemCollision();
    eventChecker(dt);
    requestAnimationFrame(loop);
}
loop();
