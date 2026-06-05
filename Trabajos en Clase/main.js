class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.player = null;
        this.cursors = null;
        this.wasd = null;
        this.groundLayer = null;
    }

    preload() {
        this.load.tilemapTiledJSON('map', '00-2d/map.json');
        this.load.image('tiles', '00-2d/spritesheet-tiles-default.png');

        // Spritesheet: 1536x1024 px, 3 columnas x 2 filas = 6 frames de 512x512 cada uno
        // Fila 0 (frames 0-2): animación de caminar
        // Fila 1 (frames 3-5): animación de caminar (continuación / variante)
        this.load.spritesheet('player', 'bomberman.png', {
            frameWidth:  512,
            frameHeight: 512
        });
    }

    create() {
        const map = this.make.tilemap({ key: 'map' });
        const tileset = map.addTilesetImage('spritesheet-tiles-default', 'tiles');
        this.groundLayer = map.createLayer('Tile Layer 1', tileset, 0, 0);
        this.groundLayer.setCollisionByExclusion([-1, 0]);

        // Fila superior (frames 0-2): caminar hacia la DERECHA
        // Fila inferior (frames 3-5): caminar hacia la IZQUIERDA
        this.anims.create({
            key: 'idle_right',
            frames: [{ key: 'player', frame: 0 }],
            frameRate: 1,
            repeat: -1
        });

        this.anims.create({
            key: 'idle_left',
            frames: [{ key: 'player', frame: 3 }],
            frameRate: 1,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_right',
            frames: this.anims.generateFrameNumbers('player', { start: 0, end: 2 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'walk_left',
            frames: this.anims.generateFrameNumbers('player', { start: 3, end: 5 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: 'jump_right',
            frames: [{ key: 'player', frame: 1 }],
            frameRate: 1,
            repeat: 0
        });

        this.anims.create({
            key: 'jump_left',
            frames: [{ key: 'player', frame: 4 }],
            frameRate: 1,
            repeat: 0
        });

        // Sprite animado con física arcade
        this.player = this.physics.add.sprite(96, 100, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setScale(0.12); // 512px * 0.12 ≈ 61px — tamaño acorde al tile de 64px
        this.player.play('idle_right');
        this.lastDir = 'right'; // rastrea la última dirección para el idle y el salto

        this.physics.add.collider(this.player, this.groundLayer);

        const worldW = map.widthInPixels;
        const worldH = map.heightInPixels;
        this.physics.world.setBounds(0, 0, worldW, worldH);
        this.cameras.main.setBounds(0, 0, worldW, worldH);
        this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up:    Phaser.Input.Keyboard.KeyCodes.W,
            left:  Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        const hint = this.add
            .text(worldW / 2, 24, '← → / A D para moverse   ↑ / W para saltar', {
                fontSize: '14px',
                fill: '#ffffff',
                backgroundColor: '#00000088',
                padding: { x: 8, y: 4 }
            })
            .setOrigin(0.5, 0)
            .setScrollFactor(0);

        this.time.delayedCall(4000, () => hint.destroy());
    }

    update() {
        const SPEED   = 220;
        const JUMP    = -480;
        const onFloor = this.player.body.blocked.down;
        const movingL = this.cursors.left.isDown  || this.wasd.left.isDown;
        const movingR = this.cursors.right.isDown || this.wasd.right.isDown;
        const jumping = this.cursors.up.isDown    || this.wasd.up.isDown;

        // Movimiento horizontal
        if (movingL) {
            this.player.setVelocityX(-SPEED);
            this.lastDir = 'left';
        } else if (movingR) {
            this.player.setVelocityX(SPEED);
            this.lastDir = 'right';
        } else {
            this.player.setVelocityX(0);
        }

        // Salto
        if (jumping && onFloor) {
            this.player.setVelocityY(JUMP);
        }

        // Selección de animación según dirección y estado
        if (!onFloor) {
            this.player.play('jump_' + this.lastDir, true);
        } else if (movingL) {
            this.player.play('walk_left', true);
        } else if (movingR) {
            this.player.play('walk_right', true);
        } else {
            this.player.play('idle_' + this.lastDir, true);
        }
    }
}

const config = {
    type: Phaser.AUTO,
    width: 1280,
    height: 640,
    backgroundColor: '#87CEEB',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 500 },
            debug: false
        }
    },
    scene: [GameScene]
};

const game = new Phaser.Game(config);
