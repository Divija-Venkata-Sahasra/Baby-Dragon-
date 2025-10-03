// ===================================
// GAME CONSTANTS AND CONFIGURATION
// ===================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas to full screen
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Load images
const images = {
    dragon: new Image(),
    obstacle: new Image(),
    background: new Image()
};

images.dragon.src = 'assets/dragon.jpg';


images.obstacle.src = 'assets/obstacle.jpg';
images.background.src = 'assets/background.jpg';

let imagesLoaded = 0;
const totalImages = 3;

images.dragon.onload = images.obstacle.onload = images.background.onload = function() {
    imagesLoaded++;
};

// Game state
let gameState = 'start'; // start, playing, gameOver
let score = 0;
let highScore = parseInt(localStorage.getItem('highScore')) || 0;
let animationFrameId = null;
let lastTime = 0;
let gameSpeed = 1;

// Dragon properties
const dragon = {
    x: 150,
    y: 150,
    width: 120,
    height: 120,
    velocity: 0,
    gravity: 0.1,
    jumpStrength: -5,
    rotation: 0,
    color: '#FF6B6B',
    evolution: 'baby', // baby, fire, phoenix, mythical
    tailLength: 0
};

// Tail system (snake-like)
const tail = [];
const tailSegmentSize = 20;
const tailDelay = 5; // Frames between segments
const tailHistory = []; // Store dragon positions

// Obstacles
const obstacles = [];
const obstacleWidth = 80;
const obstacleGap = 300;
const minObstacleGap = 200;
const obstacleSpeed = 3;
let obstacleSpawnTimer = 0;
const obstacleSpawnInterval = 150; // Frames

// Collectibles (gems)
const collectibles = [];
const collectibleSize = 25;
let collectibleSpawnTimer = 0;
const collectibleSpawnInterval = 200;

// Power-ups
const powerups = [];
const powerupSize = 30;
let powerupSpawnTimer = 0;
const powerupSpawnInterval = 800; // Rare spawns
let activePowerup = null;
let powerupDuration = 0;

// Abilities
const abilities = {
    fire: {
        unlocked: false,
        available: false,
        cooldown: 0,
        maxCooldown: 300, // Frames
        active: false
    },
    shield: {
        unlocked: false,
        available: false,
        cooldown: 0,
        maxCooldown: 180, // 3 seconds at 60fps
        active: false
    }
};

// Fire breath projectiles
const fireBreaths = [];

// Sound effect cooldowns (prevent spam)
let soundCooldowns = {
    jump: 0,
    collect: 0,
    crash: 0,
    ability: 0
};

// Evolution thresholds (based on tail length)
const evolutionThresholds = {
    baby: 0,
    fire: 5,
    phoenix: 12,
    mythical: 20
};

// ===================================
// INITIALIZATION
// ===================================

function init() {
    document.getElementById('high-score').textContent = highScore;
    
    // Event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    canvas.addEventListener('click', handleClick);
    document.getElementById('restart-btn').addEventListener('click', restartGame);
    document.getElementById('start-btn').addEventListener('click', startGame);
    
    // Handle window visibility for auto-pause
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Resize handler
    window.addEventListener('resize', handleResize);
}

function handleResize() {
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    // Adjust dragon position
    dragon.y = (dragon.y / oldHeight) * canvas.height;
}

function handleVisibilityChange() {
    if (document.hidden && gameState === 'playing') {
        gameState = 'paused';
    } else if (!document.hidden && gameState === 'paused') {
        gameState = 'playing';
        gameLoop(performance.now());
    }
}

function handleKeyDown(e) {
    if (gameState !== 'playing') return;
    
    if (e.code === 'Space') {
        e.preventDefault();
        jump();
    }
    
    if (e.code === 'KeyF') {
        useFireBreath();
    }
    
    if (e.code === 'KeyS') {
        useShield();
    }
}

function handleKeyUp(e) {
    // Handle any key up events if needed
}

function handleClick() {
    if (gameState === 'playing') {
        jump();
    }
}

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    gameState = 'playing';
    resetGame();
    gameLoop(0);
}

function restartGame() {
    document.getElementById('game-over').classList.add('hidden');
    gameState = 'playing';
    resetGame();
    gameLoop(0);
}

function resetGame() {
    // Reset dragon
    dragon.x = 150;
    dragon.y = canvas.height / 2;
    dragon.velocity = 0;
    dragon.rotation = 0;
    dragon.evolution = 'baby';
    dragon.tailLength = 0;
    
    // Clear arrays
    tail.length = 0;
    tailHistory.length = 0;
    obstacles.length = 0;
    collectibles.length = 0;
    powerups.length = 0;
    fireBreaths.length = 0;
    
    // Reset score
    score = 0;
    gameSpeed = 1;
    
    // Reset abilities
    abilities.fire.unlocked = false;
    abilities.fire.available = false;
    abilities.fire.cooldown = 0;
    abilities.fire.active = false;
    
    abilities.shield.unlocked = false;
    abilities.shield.available = false;
    abilities.shield.cooldown = 0;
    abilities.shield.active = false;
    
    // Reset power-up
    activePowerup = null;
    powerupDuration = 0;
    
    // Reset timers
    obstacleSpawnTimer = 0;
    collectibleSpawnTimer = 0;
    powerupSpawnTimer = 0;
    
    // Update UI
    updateUI();
}

// ===================================
// GAME LOOP
// ===================================

function gameLoop(timestamp) {
    if (gameState !== 'playing') {
        cancelAnimationFrame(animationFrameId);
        return;
    }
    
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    // Update and draw
    updateGame();
    drawGame();
    
    // Continue loop
    animationFrameId = requestAnimationFrame(gameLoop);
}

// ===================================
// UPDATE FUNCTIONS
// ===================================

function updateGame() {
    // Apply game speed from power-ups
    const effectiveSpeed = gameSpeed;
    
    // Update dragon physics
    dragon.velocity += dragon.gravity * effectiveSpeed;
    dragon.y += dragon.velocity * effectiveSpeed;
    
    // Dragon rotation based on velocity
    dragon.rotation = Math.min(Math.max(dragon.velocity * 3, -30), 90);
    
    // Enforce screen boundaries - game over on collision
    if (dragon.y - dragon.height / 2 <= 0) {
        if (!abilities.shield.active) {
            gameOver();
            return;
        }
        dragon.y = dragon.height / 2;
        dragon.velocity = 0;
    }
    if (dragon.y + dragon.height / 2 >= canvas.height) {
        if (!abilities.shield.active) {
            gameOver();
            return;
        }
        dragon.y = canvas.height - dragon.height / 2;
        dragon.velocity = 0;
    }
    
    // Update tail history
    tailHistory.push({ x: dragon.x, y: dragon.y });
    if (tailHistory.length > dragon.tailLength * tailDelay + tailDelay) {
        tailHistory.shift();
    }
    
    // Update tail segments
    updateTail();
    
    // Update obstacles
    updateObstacles();
    
    // Update collectibles
    updateCollectibles();
    
    // Update power-ups
    updatePowerups();
    
    // Update fire breaths
    updateFireBreaths();
    
    // Update abilities
    updateAbilities();
    
    // Update power-up duration
    if (activePowerup) {
        powerupDuration--;
        if (powerupDuration <= 0) {
            deactivatePowerup();
        }
    }
    
    // Update sound cooldowns
    Object.keys(soundCooldowns).forEach(key => {
        if (soundCooldowns[key] > 0) soundCooldowns[key]--;
    });
    
    // Check collisions
    checkCollisions();
    
    // Update evolution
    checkEvolution();
    
    // Spawn new entities
    spawnObstacles();
    spawnCollectibles();
    spawnPowerups();
    
    // Update UI
    updateUI();
}

function updateTail() {
    tail.length = 0;
    
    for (let i = 0; i < dragon.tailLength; i++) {
        const historyIndex = tailHistory.length - 1 - (i + 1) * tailDelay;
        if (historyIndex >= 0 && historyIndex < tailHistory.length) {
            tail.push({
                x: tailHistory[historyIndex].x,
                y: tailHistory[historyIndex].y,
                size: tailSegmentSize
            });
        }
    }
}

function updateObstacles() {
    obstacleSpawnTimer++;
    
    for (let i = obstacles.length - 1; i >= 0; i--) {
        obstacles[i].x -= obstacleSpeed * gameSpeed;
        
        // Remove off-screen obstacles
        if (obstacles[i].x + obstacleWidth < 0) {
            obstacles.splice(i, 1);
        }
    }
}

function updateCollectibles() {
    collectibleSpawnTimer++;
    
    for (let i = collectibles.length - 1; i >= 0; i--) {
        collectibles[i].x -= obstacleSpeed * gameSpeed;
        collectibles[i].rotation += 2;
        
        // Remove off-screen collectibles
        if (collectibles[i].x + collectibleSize < 0) {
            collectibles.splice(i, 1);
        }
    }
}

function updatePowerups() {
    powerupSpawnTimer++;
    
    for (let i = powerups.length - 1; i >= 0; i--) {
        powerups[i].x -= obstacleSpeed * gameSpeed;
        powerups[i].rotation += 3;
        powerups[i].pulse += 0.1;
        
        // Remove off-screen power-ups
        if (powerups[i].x + powerupSize < 0) {
            powerups.splice(i, 1);
        }
    }
}

function updateFireBreaths() {
    for (let i = fireBreaths.length - 1; i >= 0; i--) {
        fireBreaths[i].x += 8;
        fireBreaths[i].lifetime--;
        
        // Check collision with obstacles
        for (let j = obstacles.length - 1; j >= 0; j--) {
            if (checkFireObstacleCollision(fireBreaths[i], obstacles[j])) {
                obstacles.splice(j, 1);
                fireBreaths.splice(i, 1);
                playSound('ability');
                break;
            }
        }
        
        // Remove expired fire breaths
        if (fireBreaths[i] && fireBreaths[i].lifetime <= 0) {
            fireBreaths.splice(i, 1);
        }
    }
}

function updateAbilities() {
    // Update fire cooldown
    if (abilities.fire.cooldown > 0) {
        abilities.fire.cooldown--;
        if (abilities.fire.cooldown === 0 && abilities.fire.unlocked) {
            abilities.fire.available = true;
        }
    }
    
    // Update shield cooldown
    if (abilities.shield.cooldown > 0) {
        abilities.shield.cooldown--;
        if (abilities.shield.cooldown === 0) {
            abilities.shield.active = false;
            if (abilities.shield.unlocked) {
                abilities.shield.available = true;
            }
        }
    }
}

// ===================================
// SPAWN FUNCTIONS
// ===================================

function spawnObstacles() {
    if (obstacleSpawnTimer >= obstacleSpawnInterval) {
        obstacleSpawnTimer = 0;
        
        // Random gap position
        const gapY = Math.random() * (canvas.height - obstacleGap - 100) + 50;
        
        obstacles.push({
            x: canvas.width,
            gapY: gapY,
            gapSize: Math.max(obstacleGap, minObstacleGap),
            passed: false
        });
    }
}

function spawnCollectibles() {
    if (collectibleSpawnTimer >= collectibleSpawnInterval && obstacles.length > 0) {
        collectibleSpawnTimer = 0;
        
        // Find a safe position (in an obstacle gap)
        const obstacle = obstacles[obstacles.length - 1];
        
        if (obstacle && isSafeSpawnPosition(obstacle.x, obstacle.gapY + obstacle.gapSize / 2)) {
            collectibles.push({
                x: obstacle.x + obstacleWidth / 2,
                y: obstacle.gapY + obstacle.gapSize / 2,
                size: collectibleSize,
                rotation: 0,
                collected: false
            });
        }
    }
}

function spawnPowerups() {
    if (powerupSpawnTimer >= powerupSpawnInterval && Math.random() < 0.3 && !activePowerup) {
        powerupSpawnTimer = 0;
        
        // Find a safe position
        const y = Math.random() * (canvas.height - 200) + 100;
        
        if (isSafeSpawnPosition(canvas.width, y)) {
            const types = ['shield', 'slowmo'];
            const type = types[Math.floor(Math.random() * types.length)];
            
            powerups.push({
                x: canvas.width,
                y: y,
                type: type,
                rotation: 0,
                pulse: 0
            });
        }
    }
}

function isSafeSpawnPosition(x, y) {
    // Check distance from dragon
    const distToDragon = Math.hypot(x - dragon.x, y - dragon.y);
    if (distToDragon < 100) return false;
    
    // Check distance from tail
    for (let segment of tail) {
        const distToSegment = Math.hypot(x - segment.x, y - segment.y);
        if (distToSegment < 80) return false;
    }
    
    // Check not inside other obstacles
    for (let obstacle of obstacles) {
        if (Math.abs(x - obstacle.x) < 100) {
            if (y < obstacle.gapY || y > obstacle.gapY + obstacle.gapSize) {
                return false;
            }
        }
    }
    
    return true;
}

// ===================================
// COLLISION DETECTION
// ===================================

function checkCollisions() {
    // Dragon vs obstacles
    for (let obstacle of obstacles) {
        if (checkDragonObstacleCollision(obstacle)) {
            if (!abilities.shield.active) {
                gameOver();
                return;
            }
        }
    }
    
    // Tail collision detection removed - tail segments don't cause game over
    
    // Dragon vs collectibles
    for (let i = collectibles.length - 1; i >= 0; i--) {
        if (checkCircleCollision(
            dragon.x, dragon.y, dragon.width / 2,
            collectibles[i].x, collectibles[i].y, collectibles[i].size / 2
        )) {
            collectCollectible(i);
        }
    }
    
    // Dragon vs power-ups
    for (let i = powerups.length - 1; i >= 0; i--) {
        if (checkCircleCollision(
            dragon.x, dragon.y, dragon.width / 2,
            powerups[i].x, powerups[i].y, powerupSize / 2
        )) {
            collectPowerup(i);
        }
    }
}

function checkDragonObstacleCollision(obstacle) {
    // Reduce collision box by 30% for more forgiving gameplay
    const collisionReduction = 0.3;
    const effectiveWidth = dragon.width * (1 - collisionReduction);
    const effectiveHeight = dragon.height * (1 - collisionReduction);
    
    // Check if dragon is in the obstacle's x range
    if (dragon.x + effectiveWidth / 2 > obstacle.x && 
        dragon.x - effectiveWidth / 2 < obstacle.x + obstacleWidth) {
        
        // Check if dragon is outside the gap
        if (dragon.y - effectiveHeight / 2 < obstacle.gapY || 
            dragon.y + effectiveHeight / 2 > obstacle.gapY + obstacle.gapSize) {
            return true;
        }
    }
    return false;
}

function checkCircleCollision(x1, y1, r1, x2, y2, r2) {
    const distance = Math.hypot(x2 - x1, y2 - y1);
    return distance < r1 + r2;
}

function checkFireObstacleCollision(fire, obstacle) {
    return fire.x + 15 > obstacle.x && 
           fire.x < obstacle.x + obstacleWidth &&
           (fire.y < obstacle.gapY || fire.y > obstacle.gapY + obstacle.gapSize);
}

// ===================================
// COLLECTION FUNCTIONS
// ===================================

function collectCollectible(index) {
    collectibles.splice(index, 1);
    score++;
    dragon.tailLength++;
    playSound('collect');
    
    // Update high score
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('highScore', highScore);
    }
}

function collectPowerup(index) {
    const powerup = powerups[index];
    powerups.splice(index, 1);
    
    activatePowerup(powerup.type);
    playSound('collect');
}

function activatePowerup(type) {
    activePowerup = type;
    powerupDuration = 180; // 3 seconds at 60fps
    
    if (type === 'shield') {
        abilities.shield.active = true;
        abilities.shield.cooldown = 180;
    } else if (type === 'slowmo') {
        gameSpeed = 0.5;
    }
    
    updatePowerupDisplay();
}

function deactivatePowerup() {
    if (activePowerup === 'slowmo') {
        gameSpeed = 1;
    }
    if (activePowerup === 'shield') {
        abilities.shield.active = false;
    }
    
    activePowerup = null;
    powerupDuration = 0;
    updatePowerupDisplay();
}

// ===================================
// EVOLUTION SYSTEM
// ===================================

function checkEvolution() {
    const oldEvolution = dragon.evolution;
    
    if (dragon.tailLength >= evolutionThresholds.mythical) {
        dragon.evolution = 'mythical';
    } else if (dragon.tailLength >= evolutionThresholds.phoenix) {
        dragon.evolution = 'phoenix';
    } else if (dragon.tailLength >= evolutionThresholds.fire) {
        dragon.evolution = 'fire';
    } else {
        dragon.evolution = 'baby';
    }
    
    // Unlock abilities based on evolution (only unlock once per evolution)
    if ((dragon.evolution === 'fire' || dragon.evolution === 'mythical') && !abilities.fire.unlocked) {
        abilities.fire.unlocked = true;
        abilities.fire.available = true;
        abilities.fire.cooldown = 0;
    }
    
    if ((dragon.evolution === 'phoenix' || dragon.evolution === 'mythical') && !abilities.shield.unlocked) {
        abilities.shield.unlocked = true;
        abilities.shield.available = true;
        abilities.shield.cooldown = 0;
    }
    
    // Play sound if evolved
    if (oldEvolution !== dragon.evolution) {
        playSound('ability');
    }
}

// ===================================
// ABILITY FUNCTIONS
// ===================================

function useFireBreath() {
    if (abilities.fire.unlocked && abilities.fire.available && abilities.fire.cooldown === 0) {
        abilities.fire.available = false;
        abilities.fire.cooldown = abilities.fire.maxCooldown;
        
        fireBreaths.push({
            x: dragon.x + dragon.width / 2,
            y: dragon.y,
            size: 15,
            lifetime: 100
        });
        
        playSound('ability');
    }
}

function useShield() {
    if (abilities.shield.unlocked && abilities.shield.available && abilities.shield.cooldown === 0) {
        abilities.shield.available = false;
        abilities.shield.active = true;
        abilities.shield.cooldown = 180; // 3 seconds
        
        playSound('ability');
    }
}

// ===================================
// PLAYER ACTIONS
// ===================================

function jump() {
    dragon.velocity = dragon.jumpStrength;
    playSound('jump');
}

// ===================================
// DRAW FUNCTIONS
// ===================================

function drawGame() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw background image
    if (images.background.complete) {
        ctx.drawImage(images.background, 0, 0, canvas.width, canvas.height);
    } else {
        // Fallback gradient if image not loaded
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.5, '#E0F6FF');
        gradient.addColorStop(1, '#FFE5B4');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    
    // Draw obstacles
    drawObstacles();
    
    // Draw collectibles
    drawCollectibles();
    
    // Draw power-ups
    drawPowerups();
    
    // Draw tail
    drawTail();
    
    // Draw dragon
    drawDragon();
    
    // Draw fire breaths
    drawFireBreaths();
    
    // Draw shield effect
    if (abilities.shield.active) {
        drawShield();
    }
}

function drawDragon() {
    ctx.save();
    ctx.translate(dragon.x, dragon.y);
    ctx.rotate(dragon.rotation * Math.PI / 180);
    
    // Draw dragon image
    if (images.dragon.complete) {
        // Apply color tint based on evolution
        if (dragon.evolution === 'fire') {
            ctx.globalAlpha = 0.9;
            ctx.filter = 'hue-rotate(20deg) saturate(1.5)';
        } else if (dragon.evolution === 'phoenix') {
            ctx.globalAlpha = 0.9;
            ctx.filter = 'hue-rotate(-30deg) saturate(1.5) brightness(1.2)';
        } else if (dragon.evolution === 'mythical') {
            ctx.globalAlpha = 1;
            ctx.filter = 'hue-rotate(180deg) saturate(1.3) brightness(1.1)';
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#FFD700';
        }
        
        ctx.drawImage(images.dragon, -dragon.width / 2, -dragon.height / 2, dragon.width, dragon.height);
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
    } else {
        // Fallback shape
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.ellipse(0, 0, dragon.width / 2, dragon.height / 2, 0, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.restore();
}

function drawTail() {
    for (let i = tail.length - 1; i >= 0; i--) {
        const segment = tail[i];
        const alpha = 1 - (i / tail.length) * 0.3;
        
        // Tail color based on evolution
        let tailColor = '#FF6B6B';
        if (dragon.evolution === 'fire') tailColor = '#FF4500';
        else if (dragon.evolution === 'phoenix') tailColor = '#FF1493';
        else if (dragon.evolution === 'mythical') tailColor = '#9370DB';
        
        ctx.fillStyle = tailColor;
        ctx.globalAlpha = alpha;
        
        ctx.beginPath();
        ctx.arc(segment.x, segment.y, segment.size / 2, 0, Math.PI * 2);
        ctx.fill();
        
        // Glowing outline
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
}

function drawObstacles() {
    for (let obstacle of obstacles) {
        if (images.obstacle.complete) {
            // Top obstacle using image
            ctx.save();
            ctx.drawImage(images.obstacle, obstacle.x, 0, obstacleWidth, obstacle.gapY);
            ctx.restore();
            
            // Bottom obstacle using image
            ctx.save();
            ctx.drawImage(images.obstacle, obstacle.x, obstacle.gapY + obstacle.gapSize, obstacleWidth, canvas.height - obstacle.gapY - obstacle.gapSize);
            ctx.restore();
        } else {
            // Fallback rectangles
            ctx.fillStyle = '#696969';
            ctx.fillRect(obstacle.x, 0, obstacleWidth, obstacle.gapY);
            ctx.fillRect(obstacle.x, obstacle.gapY + obstacle.gapSize, obstacleWidth, canvas.height - obstacle.gapY - obstacle.gapSize);
            
            ctx.strokeStyle = '#404040';
            ctx.lineWidth = 3;
            ctx.strokeRect(obstacle.x, 0, obstacleWidth, obstacle.gapY);
            ctx.strokeRect(obstacle.x, obstacle.gapY + obstacle.gapSize, obstacleWidth, canvas.height - obstacle.gapY - obstacle.gapSize);
        }
    }
}

function drawCollectibles() {
    for (let collectible of collectibles) {
        ctx.save();
        ctx.translate(collectible.x, collectible.y);
        ctx.rotate(collectible.rotation * Math.PI / 180);
        
        // Gem shape
        ctx.fillStyle = '#FF1493';
        ctx.beginPath();
        ctx.moveTo(0, -collectible.size / 2);
        ctx.lineTo(collectible.size / 3, 0);
        ctx.lineTo(0, collectible.size / 2);
        ctx.lineTo(-collectible.size / 3, 0);
        ctx.closePath();
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FFD700';
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.restore();
    }
}

function drawPowerups() {
    for (let powerup of powerups) {
        ctx.save();
        ctx.translate(powerup.x, powerup.y);
        
        const pulseSize = powerupSize + Math.sin(powerup.pulse) * 5;
        
        if (powerup.type === 'shield') {
            // Shield icon
            ctx.fillStyle = '#00CED1';
            ctx.beginPath();
            ctx.arc(0, 0, pulseSize / 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.stroke();
        } else if (powerup.type === 'slowmo') {
            // Clock icon
            ctx.fillStyle = '#9370DB';
            ctx.beginPath();
            ctx.arc(0, 0, pulseSize / 2, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = '#FFD700';
            ctx.lineWidth = 4;
            ctx.stroke();
            
            // Clock hands
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(0, -pulseSize / 3);
            ctx.stroke();
        }
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FFD700';
        
        ctx.restore();
    }
}

function drawFireBreaths() {
    for (let fire of fireBreaths) {
        ctx.fillStyle = '#FFA500';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#FF4500';
        
        ctx.beginPath();
        ctx.arc(fire.x, fire.y, fire.size, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner flame
        ctx.fillStyle = '#FF4500';
        ctx.beginPath();
        ctx.arc(fire.x, fire.y, fire.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    ctx.shadowBlur = 0;
}

function drawShield() {
    ctx.save();
    ctx.strokeStyle = '#00CED1';
    ctx.lineWidth = 4;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#00CED1';
    
    ctx.beginPath();
    ctx.arc(dragon.x, dragon.y, dragon.width + 10, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
}

// ===================================
// UI UPDATE FUNCTIONS
// ===================================

function updateUI() {
    document.getElementById('current-score').textContent = score;
    document.getElementById('high-score').textContent = highScore;
    
    // Evolution display
    const evolutionNames = {
        baby: 'Baby Dragon',
        fire: 'Fire Dragon 🔥',
        phoenix: 'Phoenix 🛡️',
        mythical: 'Mythical Dragon ✨'
    };
    document.getElementById('evolution-stage').textContent = evolutionNames[dragon.evolution];
    
    // Abilities
    const fireAbility = document.getElementById('fire-ability');
    const shieldAbility = document.getElementById('shield-ability');
    
    if (abilities.fire.unlocked) {
        fireAbility.classList.remove('locked');
        if (abilities.fire.available) {
            fireAbility.classList.add('active');
        } else {
            fireAbility.classList.remove('active');
        }
    } else {
        fireAbility.classList.add('locked');
    }
    
    if (abilities.shield.unlocked) {
        shieldAbility.classList.remove('locked');
        if (abilities.shield.available) {
            shieldAbility.classList.add('active');
        } else {
            shieldAbility.classList.remove('active');
        }
    } else {
        shieldAbility.classList.add('locked');
    }
    
    // Cooldown display
    if (abilities.fire.cooldown > 0) {
        const percent = (abilities.fire.cooldown / abilities.fire.maxCooldown) * 100;
        document.getElementById('fire-cooldown').style.width = percent + '%';
    } else {
        document.getElementById('fire-cooldown').style.width = '0%';
        if (abilities.fire.unlocked) {
            abilities.fire.available = true;
        }
    }
    
    if (abilities.shield.cooldown > 0 && !abilities.shield.active) {
        const percent = (abilities.shield.cooldown / abilities.shield.maxCooldown) * 100;
        document.getElementById('shield-cooldown').style.width = percent + '%';
    } else {
        document.getElementById('shield-cooldown').style.width = '0%';
        if (abilities.shield.unlocked && !abilities.shield.active) {
            abilities.shield.available = true;
        }
    }
}

function updatePowerupDisplay() {
    const display = document.getElementById('powerup-display');
    
    if (activePowerup) {
        const names = {
            shield: 'Shield Active',
            slowmo: 'Slow Motion'
        };
        display.textContent = names[activePowerup] + ' (' + Math.ceil(powerupDuration / 60) + 's)';
        display.classList.add('active');
    } else {
        display.classList.remove('active');
    }
}

// ===================================
// GAME OVER
// ===================================

function gameOver() {
    gameState = 'gameOver';
    playSound('crash');
    
    document.getElementById('final-score').textContent = score;
    document.getElementById('final-high-score').textContent = highScore;
    document.getElementById('game-over').classList.remove('hidden');
}

// ===================================
// SOUND EFFECTS
// ===================================

function playSound(type) {
    if (soundCooldowns[type] > 0) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'jump') {
        oscillator.frequency.value = 400;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
        soundCooldowns[type] = 10;
    } else if (type === 'collect') {
        oscillator.frequency.value = 800;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.2);
        soundCooldowns[type] = 15;
    } else if (type === 'crash') {
        oscillator.type = 'sawtooth';
        oscillator.frequency.value = 100;
        gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.3);
        soundCooldowns[type] = 30;
    } else if (type === 'ability') {
        oscillator.frequency.value = 600;
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.25);
        soundCooldowns[type] = 20;
    }
}

// ===================================
// INITIALIZE GAME
// ===================================

init();
