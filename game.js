class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });
        this.gameStarted = false;
        this.platformYDistance = 120;
        this.score = 0;
        this.gameOver = false;
    }

    preload() {
        // Create placeholder graphics if assets fail to load
        const graphics = this.add.graphics();
        
        // Create player placeholder
        graphics.fillStyle(0x3498db);
        graphics.fillRect(0, 0, 32, 32);
        graphics.generateTexture('player', 32, 32);
        
        // Create platform placeholder
        graphics.clear();
        graphics.fillStyle(0x95a5a6);
        graphics.fillRect(0, 0, 128, 16);
        graphics.generateTexture('platform', 128, 16);
        
        // Create water placeholder
        graphics.clear();
        graphics.fillStyle(0x2980b9);
        graphics.fillRect(0, 0, 800, 40);
        graphics.generateTexture('water', 800, 40);
        
        graphics.destroy();
    }

    create() {
        // Reset game state
        this.gameStarted = false;
        this.gameOver = false;
        this.score = 0;
        
        // Set up the game world bounds - very large negative Y for upward movement
        this.physics.world.setBounds(0, -1000000, 800, 1000600);
        
        // Initialize game objects
        this.platforms = this.add.group();
        
        // Create player
        this.player = this.physics.add.sprite(400, 500, 'player');
        this.player.setCollideWorldBounds(true);
        
        // Create water (game over line)
        this.water = this.add.tileSprite(400, 580, 800, 40, 'water');
        this.physics.add.existing(this.water, true);
        
        // Create initial platforms
        this.createStartingPlatforms();
        
        // Setup collisions
        this.physics.add.collider(this.player, this.platforms);
        this.physics.add.overlap(this.player, this.water, this.gameOverHandler, null, this);
        
        // Setup controls
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Create UI layer for score that stays fixed on screen
        this.uiLayer = this.add.container(0, 0);
        this.uiLayer.setScrollFactor(0);
        
        // Score text - add to UI layer
        this.scoreText = this.add.text(16, 16, 'Score: 0', {
            fontSize: '32px',
            fill: '#fff'
        });
        this.uiLayer.add(this.scoreText);

        // Start game text - add to UI layer
        this.startText = this.add.text(400, 300, 'Press SPACE to Start', {
            fontSize: '32px',
            fill: '#fff',
            align: 'center'
        }).setOrigin(0.5);
        this.uiLayer.add(this.startText);

        // Setup camera
        this.cameras.main.startFollow(this.player, true, 0, 1);
        this.cameras.main.setFollowOffset(0, 100); // Offset camera to see more above player
        
        // Setup space key for starting game
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.spaceKey.on('down', () => {
            if (!this.gameStarted && !this.gameOver) {
                this.startGame();
            }
        });
    }

    createStartingPlatforms() {
        // Create a platform right under the player
        this.createPlatform(400, 550);
        
        // Create several platforms above
        for (let i = 0; i < 8; i++) {
            const y = 550 - ((i + 1) * this.platformYDistance);
            const x = Phaser.Math.Between(100, 700);
            this.createPlatform(x, y);
            
            // Add an extra platform on some rows
            if (Math.random() > 0.5) {
                const x2 = Phaser.Math.Between(100, 700);
                if (Math.abs(x - x2) > 200) { // Ensure platforms aren't too close
                    this.createPlatform(x2, y);
                }
            }
        }
    }

    startGame() {
        this.gameStarted = true;
        if (this.startText) {
            this.startText.destroy();
            this.startText = null;
        }
        this.player.setVelocityY(0);
    }

    update() {
        if (!this.gameStarted) {
            this.player.setVelocityX(0);
            this.player.setVelocityY(0);
            return;
        }

        if (this.gameOver) return;

        // Player movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
        } else {
            this.player.setVelocityX(0);
        }
        
        // Jumping
        if (this.cursors.up.isDown && this.player.body.touching.down) {
            this.player.setVelocityY(-400);
        }

        // Generate new platforms as player moves up
        const highestPlatform = this.getHighestPlatformY();
        if (this.player.y < highestPlatform + 400) {
            this.addNewPlatformRow(highestPlatform - this.platformYDistance);
        }

        // Update score based on height
        const newScore = Math.floor(Math.abs(550 - this.player.y) / 10);
        if (newScore > this.score) {
            this.score = newScore;
            this.scoreText.setText('Score: ' + this.score);
        }

        // Check for game over
        if (this.player.y > 600) {
            this.gameOverHandler();
        }
    }

    getHighestPlatformY() {
        let highest = 550;
        this.platforms.children.iterate((platform) => {
            if (platform && platform.y < highest) {
                highest = platform.y;
            }
        });
        return highest;
    }

    addNewPlatformRow(y) {
        const numPlatforms = Phaser.Math.Between(2, 3);
        const usedX = [];
        
        for (let i = 0; i < numPlatforms; i++) {
            let x;
            do {
                x = Phaser.Math.Between(100, 700);
            } while (usedX.some(usedX => Math.abs(usedX - x) < 200));
            
            this.createPlatform(x, y);
            usedX.push(x);
        }
    }

    createPlatform(x, y) {
        const platform = this.physics.add.sprite(x, y, 'platform');
        platform.setImmovable(true);
        platform.body.allowGravity = false;
        this.platforms.add(platform);
        return platform;
    }

    gameOverHandler() {
        if (this.gameOver) return;
        
        this.gameOver = true;
        this.physics.pause();
        
        // Add game over text to UI layer
        const gameOverText = this.add.text(400, 300, 'Game Over!', {
            fontSize: '64px',
            fill: '#fff'
        }).setOrigin(0.5);
        this.uiLayer.add(gameOverText);
        
        const restartText = this.add.text(400, 350, 'Press Space to Restart', {
            fontSize: '32px',
            fill: '#fff'
        }).setOrigin(0.5);
        this.uiLayer.add(restartText);
        
        // Clean up existing space key listener
        if (this.spaceKey) {
            this.spaceKey.removeAllListeners();
        }
        
        // Add restart listener
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.spaceKey.on('down', () => {
            this.scene.restart();
        });
    }
}

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game',
    backgroundColor: '#2c3e50',
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
