class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.gameStarted = false;
        this.platformYDistance = 120;
        this.score = 0;
        this.gameOver = false;
        this.platformPool = null;
        this.lastPlatformY = 550;
        this.cleanupBoundary = 1000;
        this.maxParticles = 100;
        this.activeParticles = new Set();
        this.cameraScrollSpeed = 1; // Base scroll speed
        this.nextPlatformY = 550;
        this.maxPlatforms = 15; // Limit number of platforms
    }

    preload() {
        // Create better graphics
        const graphics = this.add.graphics();
        
        // Create player with better design
        graphics.clear();
        graphics.lineStyle(2, 0x00ff00);
        graphics.fillStyle(0x00ff00);
        graphics.beginPath();
        graphics.arc(16, 16, 14, 0, Math.PI * 2);
        graphics.closePath();
        graphics.strokePath();
        graphics.fill();
        graphics.generateTexture('player', 32, 32);
        
        // Create platform with better design
        graphics.clear();
        graphics.lineStyle(2, 0x4a9eff);
        graphics.fillStyle(0x2d7dd2);
        graphics.fillRect(0, 0, 128, 16);
        graphics.strokeRect(0, 0, 128, 16);
        graphics.generateTexture('platform', 128, 16);
        
        // Create water with better design
        graphics.clear();
        graphics.fillStyle(0x3498db);
        graphics.fillRect(0, 0, 800, 80);
        graphics.generateTexture('water', 800, 80);
        
        // Create particle texture
        graphics.clear();
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('particle', 8, 8);

        // Create star texture
        graphics.clear();
        graphics.fillStyle(0xffffff);
        graphics.fillCircle(2, 2, 2);
        graphics.generateTexture('star', 4, 4);
        
        graphics.destroy();
    }

    create() {
        // Reset game state
        this.gameStarted = false;
        this.gameOver = false;
        this.score = 0;
        this.lastPlatformY = 550;
        this.platformYDistance = 120;
        this.maxPlatforms = 15;

        // Set world bounds - only constrain horizontally
        this.physics.world.setBounds(0, -Infinity, 800, Infinity);
        
        // Create UI container that stays fixed
        this.uiContainer = this.add.container(0, 0);
        this.uiContainer.setScrollFactor(0);
        
        // Create water as UI element that stays at bottom
        this.water = this.add.tileSprite(400, 600, 800, 80, 'water');
        this.water.setOrigin(0.5, 1);
        this.uiContainer.add(this.water);
        
        // Create background
        this.createBackground();
        
        // Initialize game objects
        this.platforms = this.add.group({
            maxSize: this.maxPlatforms * 3
        });
        
        // Create player with physics
        this.player = this.physics.add.sprite(400, 500, 'player');
        this.player.setCircle(14);
        // Only constrain player horizontally
        this.player.setCollideWorldBounds(true);
        
        // Create starting platforms
        this.createStartingPlatforms();
        
        // Setup collisions
        this.physics.add.collider(this.player, this.platforms);
        
        // Setup camera with vertical focus
        this.cameras.main.startFollow(this.player, true, 0, 0.1);
        this.cameras.main.setDeadzone(0, 200); // Remove horizontal deadzone
        this.cameras.main.setBounds(0, -Infinity, 800, Infinity); // Allow infinite vertical movement
        
        // Setup controls
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Score text
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '20px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff'
        });
        this.scoreText.setScrollFactor(0);
        
        // Start text
        this.startText = this.add.text(400, 300, 'Press SPACE to Start', {
            fontSize: '24px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff'
        }).setOrigin(0.5);
        this.startText.setScrollFactor(0);
        
        // Setup space key
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.spaceKey.on('down', () => {
            if (!this.gameStarted && !this.gameOver) {
                this.startGame();
            }
        });
    }

    update() {
        if (!this.gameStarted) {
            this.player.setVelocityX(0);
            this.player.setVelocityY(0);
            return;
        }

        if (this.gameOver) return;

        // Player movement with horizontal bounds check
        if (this.cursors.left.isDown && this.player.x > 20) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown && this.player.x < 780) {
            this.player.setVelocityX(300);
        } else {
            this.player.setVelocityX(0);
        }

        // Jumping
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-400);
        }

        // Platform generation
        this.managePlatforms();

        // Update score based on highest point reached
        const newScore = Math.floor(Math.abs(this.player.y - 550) / 10);
        if (newScore > this.score) {
            this.score = newScore;
            this.scoreText.setText('Score: ' + this.score);
        }

        // Check for game over - when player touches water
        const waterY = this.cameras.main.scrollY + this.cameras.main.height - 40;
        if (this.player.y > waterY) {
            this.gameOverHandler();
        }

        // Keep camera centered horizontally
        this.cameras.main.scrollX = 0;
    }

    managePlatforms() {
        // Get camera bounds
        const cameraTop = this.cameras.main.scrollY;
        const cameraBottom = cameraTop + this.cameras.main.height;
        
        // Clean up platforms below camera
        this.platforms.children.each(platform => {
            if (platform.y > cameraBottom + 100) {
                platform.destroy();
            }
            return true;
        });
        
        // Find highest platform
        let highestY = this.lastPlatformY;
        this.platforms.children.each(platform => {
            if (platform.y < highestY) {
                highestY = platform.y;
            }
            return true;
        });
        
        // Generate new platforms if needed
        while (highestY > cameraTop - 300 && this.platforms.countActive() < this.maxPlatforms) {
            this.addNewPlatformRow(highestY - this.platformYDistance);
            highestY -= this.platformYDistance;
        }
    }

    addNewPlatformRow(y) {
        // Calculate number of platforms based on difficulty
        const numPlatforms = Math.max(2, Math.min(3, Math.floor(3 - (this.score / 1000))));
        const usedX = [];
        
        for (let i = 0; i < numPlatforms; i++) {
            let x;
            let attempts = 0;
            do {
                x = Phaser.Math.Between(100, 700);
                attempts++;
            } while (attempts < 5 && usedX.some(used => Math.abs(used - x) < 200));
            
            if (attempts < 5) {
                const platform = this.add.sprite(x, y, 'platform');
                this.physics.add.existing(platform, true);
                platform.body.immovable = true;
                this.platforms.add(platform);
                usedX.push(x);
            }
        }
        
        this.lastPlatformY = y;
    }

    createStartingPlatforms() {
        // Create initial platform under player
        const startPlatform = this.add.sprite(400, 550, 'platform');
        this.physics.add.existing(startPlatform, true);
        startPlatform.body.immovable = true;
        this.platforms.add(startPlatform);
        
        // Create initial set of platforms
        for (let i = 0; i < 5; i++) {
            this.addNewPlatformRow(550 - ((i + 1) * this.platformYDistance));
        }
    }

    createBackground() {
        // Create multiple layers of stars for parallax effect
        this.backgroundLayers = [];
        const numLayers = 3;
        const starsPerLayer = 30; // Reduced number of stars
        
        for (let layer = 0; layer < numLayers; layer++) {
            const stars = [];
            const depth = (layer + 1) / numLayers;
            
            for (let i = 0; i < starsPerLayer; i++) {
                const x = Phaser.Math.Between(0, 800);
                const y = Phaser.Math.Between(-2000, 600);
                const star = this.add.image(x, y, 'star');
                star.setAlpha(depth);
                star.setScale(depth);
                star.depth = layer - 10;
                star.scrollFactorY = depth * 0.9;
                stars.push(star);
                
                // Simplified twinkling
                if (i % 2 === 0) { // Only animate half the stars
                    this.tweens.add({
                        targets: star,
                        alpha: depth * 0.5,
                        duration: 2000,
                        yoyo: true,
                        repeat: -1,
                        ease: 'Sine.easeInOut'
                    });
                }
            }
            
            this.backgroundLayers.push(stars);
        }
    }

    updateBackground() {
        const cameraY = this.cameras.main.scrollY;
        const viewportHeight = this.cameras.main.height;
        
        this.backgroundLayers.forEach((stars, layerIndex) => {
            const depth = (layerIndex + 1) / this.backgroundLayers.length;
            
            stars.forEach(star => {
                if (Math.abs(star.y - cameraY) > viewportHeight * 2) {
                    star.y = cameraY - Phaser.Math.Between(0, viewportHeight);
                    star.x = Phaser.Math.Between(0, 800);
                }
                
                // Simplified star movement
                star.x += Math.sin(this.time.now * 0.0002 + star.y) * depth * 0.2;
                
                if (star.x < 0) star.x = 800;
                if (star.x > 800) star.x = 0;
            });
        });
    }

    createParticleEffect(x, y, config = {}) {
        // Check if we've reached the particle limit
        if (this.activeParticles.size >= this.maxParticles) {
            return;
        }

        const particles = this.add.particles(x, y, 'particle', {
            speed: config.speed || { min: 50, max: 100 },
            angle: config.angle || { min: 0, max: 360 },
            scale: config.scale || { start: 0.4, end: 0 },
            alpha: config.alpha || { start: 0.6, end: 0 },
            lifespan: config.lifespan || 400,
            quantity: Math.min(config.quantity || 10, this.maxParticles - this.activeParticles.size),
            gravityY: config.gravityY || 0,
            tint: config.tint || 0xffffff
        });

        this.activeParticles.add(particles);

        this.time.delayedCall(config.lifespan || 400, () => {
            particles.destroy();
            this.activeParticles.delete(particles);
        });
    }

    handlePlatformCollision(player, platform) {
        if (player.body.touching.down) {
            this.createParticleEffect(platform.x, platform.y - 8, {
                speed: { min: -50, max: 50 },
                scale: { start: 0.2, end: 0 },
                tint: 0x4a9eff,
                quantity: 5
            });
        }
    }

    startGame() {
        this.gameStarted = true;
        
        // Fade out start text
        this.tweens.add({
            targets: this.startText,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => {
                this.startText.destroy();
                this.startText = null;
            }
        });
    }

    gameOverHandler() {
        if (this.gameOver) return;
        
        this.gameOver = true;
        this.physics.pause();
        
        // Create falling particles effect
        for (let i = 0; i < 3; i++) {
            this.time.delayedCall(i * 200, () => {
                this.createParticleEffect(
                    this.player.x,
                    this.player.y - i * 50,
                    {
                        speed: { min: 50, max: 150 },
                        scale: { start: 0.4, end: 0 },
                        quantity: 15,
                        lifespan: 600,
                        tint: 0xff0000
                    }
                );
            });
        }
        
        // Add game over text with animation
        const gameOverText = this.add.text(400, 300, 'Game Over!', {
            fontSize: '48px',
            fontFamily: '"Press Start 2P"',
            fill: '#ff0000',
            padding: { x: 20, y: 20 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        }).setOrigin(0.5).setScrollFactor(0);
        
        gameOverText.alpha = 0;
        gameOverText.scale = 2;
        
        this.tweens.add({
            targets: gameOverText,
            alpha: 1,
            scale: 1,
            duration: 1000,
            ease: 'Bounce'
        });
        
        // Show final score
        const finalScoreText = this.add.text(400, 380, `Final Score: ${this.score}`, {
            fontSize: '24px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff',
            padding: { x: 16, y: 16 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        }).setOrigin(0.5).setScrollFactor(0);
        
        finalScoreText.alpha = 0;
        
        this.tweens.add({
            targets: finalScoreText,
            alpha: 1,
            duration: 800,
            ease: 'Power2',
            delay: 800
        });
        
        const restartText = this.add.text(400, 440, 'Press Space to Restart', {
            fontSize: '24px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff',
            padding: { x: 16, y: 16 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        }).setOrigin(0.5).setScrollFactor(0);
        
        restartText.alpha = 0;
        
        this.tweens.add({
            targets: restartText,
            alpha: 1,
            duration: 1000,
            ease: 'Power2',
            delay: 1600
        });
        
        // Clean up and add restart handler
        if (this.spaceKey) {
            this.spaceKey.removeAllListeners();
        }
        
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.spaceKey.on('down', () => {
            // Clean up existing objects
            this.cleanup();
            // Restart the scene
            this.scene.restart();
        });
    }

    cleanup() {
        // Stop all tweens
        this.tweens.killAll();
        
        // Clear all particles
        this.activeParticles.forEach(particle => {
            particle.destroy();
        });
        this.activeParticles.clear();
        
        // Clear all platforms
        this.platforms.clear(true, true);
        
        // Clear background layers
        if (this.backgroundLayers) {
            this.backgroundLayers.forEach(layer => {
                layer.forEach(star => star.destroy());
            });
            this.backgroundLayers = [];
        }
        
        // Remove all event listeners
        if (this.spaceKey) {
            this.spaceKey.removeAllListeners();
        }
        
        // Clear all game objects
        this.children.each(child => {
            child.destroy();
        });
    }

    createScoreEffect() {
        const scoreParticle = this.add.text(
            this.scoreText.x + this.scoreText.width + 20,
            this.scoreText.y,
            '+1',
            {
                fontSize: '20px',
                fontFamily: '"Press Start 2P"',
                fill: '#00ff00'
            }
        ).setScrollFactor(0);

        this.tweens.add({
            targets: scoreParticle,
            y: this.scoreText.y - 30,
            alpha: 0,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => scoreParticle.destroy()
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game',
    backgroundColor: '#1a1a2e',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 600 },
            debug: false
        }
    },
    scene: MainScene
};

const game = new Phaser.Game(config);
