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
        this.maxParticles = 20;
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
        this.maxParticles = 20;
        this.activeParticles = new Set();
        
        // Set world bounds - only constrain horizontally
        this.physics.world.setBounds(0, -Infinity, 800, Infinity);
        
        // Create background with parallax stars
        this.createBackground();
        
        // Initialize game objects
        this.platforms = this.add.group({
            maxSize: this.maxPlatforms * 3
        });
        
        // Create player with physics
        this.player = this.physics.add.sprite(400, 500, 'player');
        this.player.setCircle(14);
        this.player.setCollideWorldBounds(true);
        
        // Add glow effect to player
        this.playerGlow = this.add.sprite(400, 500, 'player');
        this.playerGlow.setScale(1.2);
        this.playerGlow.setAlpha(0.3);
        this.playerGlow.setTint(0x00ff00);
        
        // Create starting platforms
        this.createStartingPlatforms();
        
        // Create water visual - much larger now
        const waterHeight = 400; // Increased height
        this.waterGraphics = this.add.tileSprite(400, 800, 1200, waterHeight, 'water');
        this.waterGraphics.setDepth(1000);
        this.waterGraphics.setOrigin(0.5, 0);
        
        // Create water physics body - matching the visual size
        this.waterCollider = this.physics.add.sprite(400, 800, 'water');
        this.waterCollider.displayWidth = 1200;
        this.waterCollider.displayHeight = waterHeight;
        this.waterCollider.setOrigin(0.5, 0);
        this.waterCollider.refreshBody();
        this.waterCollider.setImmovable(true);
        this.waterCollider.body.allowGravity = false;
        this.waterCollider.setVisible(false);
        
        // Setup collisions
        this.physics.add.collider(this.player, this.platforms, this.handlePlatformCollision, null, this);
        this.physics.add.overlap(this.player, this.waterCollider, this.handleWaterCollision, null, this);
        
        // Setup camera with vertical focus
        this.cameras.main.startFollow(this.player, true, 0, 0.1);
        this.cameras.main.setDeadzone(0, 200);
        this.cameras.main.setBounds(0, -Infinity, 800, Infinity);
        
        // Setup controls
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Score text with style
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '20px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff',
            padding: { x: 8, y: 8 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        });
        this.scoreText.setScrollFactor(0);
        
        // Start text with animation
        this.startText = this.add.text(400, 300, 'Press SPACE to Start', {
            fontSize: '24px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff',
            padding: { x: 16, y: 16 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        }).setOrigin(0.5);
        this.startText.setScrollFactor(0);
        
        // Animate start text
        this.tweens.add({
            targets: this.startText,
            alpha: 0.5,
            yoyo: true,
            repeat: -1,
            duration: 1000,
            ease: 'Sine.easeInOut'
        });
        
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

        // Update background
        this.updateBackground();

        // Update water position to follow camera - slightly lower
        const cameraY = this.cameras.main.scrollY;
        const waterY = cameraY + this.cameras.main.height - 180; // Adjusted to -180 (between -100 and -250)
        this.waterGraphics.y = waterY;
        this.waterCollider.y = waterY;
        
        // Update water animation
        this.waterGraphics.tilePositionX += 0.5;

        // Player movement with horizontal bounds check
        if (this.cursors.left.isDown && this.player.x > 20) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown && this.player.x < 780) {
            this.player.setVelocityX(300);
        } else {
            this.player.setVelocityX(0);
        }

        // Jumping with particle effect
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-400);
            this.createJumpEffect();
        }

        // Update player glow position
        this.playerGlow.x = this.player.x;
        this.playerGlow.y = this.player.y;

        // Platform generation
        this.managePlatforms();

        // Update score with effect
        const newScore = Math.floor(Math.abs(this.player.y - 550) / 10);
        if (newScore > this.score) {
            this.score = newScore;
            this.scoreText.setText('Score: ' + this.score);
            if (this.score % 10 === 0) {
                this.createScoreEffect();
            }
        }

        // Keep camera centered horizontally
        this.cameras.main.scrollX = 0;
    }

    createJumpEffect() {
        if (this.activeParticles.size >= this.maxParticles) return;
        
        const particles = this.add.particles(this.player.x, this.player.y + 14, 'particle', {
            speed: { min: 50, max: 100 },
            angle: { min: 60, max: 120 },
            scale: { start: 0.4, end: 0 },
            lifespan: 300,
            quantity: 5,
            tint: 0x00ff00
        });
        
        this.activeParticles.add(particles);
        this.time.delayedCall(300, () => {
            particles.destroy();
            this.activeParticles.delete(particles);
        });
    }

    createScoreEffect() {
        const scoreEffect = this.add.text(
            this.scoreText.x + this.scoreText.width + 20,
            this.scoreText.y,
            '+10',
            {
                fontSize: '20px',
                fontFamily: '"Press Start 2P"',
                fill: '#00ff00'
            }
        ).setScrollFactor(0);

        this.tweens.add({
            targets: scoreEffect,
            alpha: 0,
            y: this.scoreText.y - 30,
            duration: 1000,
            ease: 'Power2',
            onComplete: () => scoreEffect.destroy()
        });
    }

    handlePlatformCollision(player, platform) {
        if (player.body.touching.down && !platform.touched) {
            platform.touched = true;
            this.createPlatformTouchEffect(platform);
        }
    }

    createPlatformTouchEffect(platform) {
        const touchEffect = this.add.sprite(platform.x, platform.y - 5, 'platform');
        touchEffect.setAlpha(0.5);
        touchEffect.setTint(0x00ff00);

        this.tweens.add({
            targets: touchEffect,
            alpha: 0,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 300,
            ease: 'Power2',
            onComplete: () => touchEffect.destroy()
        });
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

    handleWaterCollision(player, water) {
        if (!this.gameOver) {
            this.gameOver = true;
            
            // Create splash effect at collision point
            this.createWaterSplashEffect(player.x, water.y);
            
            // Stop player movement and add sinking effect
            player.setVelocity(0, 50);
            player.body.setAllowGravity(false);
            
            // Show game over text
            this.showGameOver();
        }
    }

    createWaterSplashEffect(x, y) {
        if (this.activeParticles.size >= this.maxParticles) return;
        
        const particles = this.add.particles(x, y, 'particle', {
            speed: { min: 100, max: 200 },
            angle: { min: 30, max: 150 }, // Wider angle for bigger splash
            scale: { start: 0.6, end: 0 }, // Larger particles
            lifespan: 800, // Longer lasting particles
            quantity: 15, // More particles
            tint: 0x00ffff
        });
        
        this.activeParticles.add(particles);
        this.time.delayedCall(800, () => {
            particles.destroy();
            this.activeParticles.delete(particles);
        });
    }

    showGameOver() {
        // Game Over text with style
        const gameOverText = this.add.text(400, 200, 'Game Over!', {
            fontSize: '48px',
            fontFamily: '"Press Start 2P"',
            fill: '#ff0000',
            padding: { x: 20, y: 20 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        }).setOrigin(0.5).setScrollFactor(0);

        // Final score
        const finalScoreText = this.add.text(400, 300, 'Final Score: ' + this.score, {
            fontSize: '24px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff',
            padding: { x: 20, y: 20 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        }).setOrigin(0.5).setScrollFactor(0);

        // Restart prompt
        const restartText = this.add.text(400, 400, 'Press Space to Restart', {
            fontSize: '20px',
            fontFamily: '"Press Start 2P"',
            fill: '#fff',
            padding: { x: 20, y: 20 },
            shadow: { color: '#000', fill: true, offsetX: 2, offsetY: 2, blur: 4 }
        }).setOrigin(0.5).setScrollFactor(0);

        // Enable space key for restart
        this.spaceKey.on('down', () => {
            if (this.gameOver) {
                this.scene.restart();
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
