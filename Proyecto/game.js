let game;

const gameOptions = {
    playerGravity: 800,
    playerSpeed: 500,
    opponentSpeed: 500
}

window.onload = function () {
    //define game configurations
    let gameConfig = {
        type: Phaser.AUTO,
        backgroundColor: "#023127",
        scale: {
            mode: Phaser.Scale.FIT,
            autoCenter: Phaser.Scale.CENTER_BOTH,
            width: 800,
            height: 1000,
        },
        pixelArt: true,
        physics: {
            default: "arcade",
            arcade: {
                gravity: {
                    y: 10
                }
            }
        },
        scene: [StartScene, PlayGame, GameOverScene]
    }

    game = new Phaser.Game(gameConfig)
    window.focus();
}

class StartScene extends Phaser.Scene {

    constructor() {
        super("StartScene")
    }

    preload() {
        this.load.image("basketball", "assets/basketball.png")
        this.load.image("star", "assets/star.png")
        this.load.image("hoop", "assets/basketball_hoop.png")
        this.load.image("pink-tile", "assets/pink_tile2.png")
        this.load.audio("bgmusic", "sounds/nba.mp3")
    }

    create() {
        const cx = game.config.width / 2
        const cy = game.config.height / 2

        if (!this.sound.get("bgmusic")) {
            this.sound.add("bgmusic", { loop: true, volume: 0.5 }).play()
        }

        // decoracion: tiles de fondo
        for (let i = 0; i < 12; i++) {
            let tile = this.add.image(
                Phaser.Math.Between(0, game.config.width),
                Phaser.Math.Between(0, game.config.height),
                "pink-tile"
            )
            tile.setScale(0.5)
            tile.setAlpha(0.3)
        }

        // titulo
        this.add.text(cx, cy - 220, "CRAZY", {
            fontSize: "90px",
            fill: "#ff69b4",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 6
        }).setOrigin(0.5)

        this.add.text(cx, cy - 120, "BASKETBALL GAME", {
            fontSize: "46px",
            fill: "#ffffff",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 4
        }).setOrigin(0.5)

        // iconos decorativos
        this.add.image(cx - 120, cy + 10, "basketball").setScale(0.25)
        this.add.image(cx, cy + 10, "hoop").setScale(0.2)
        this.add.image(cx + 120, cy + 10, "star").setScale(0.14)

        // instrucciones
        this.add.text(cx, cy + 130, "Controles:", {
            fontSize: "26px", fill: "#ffdd57", fontStyle: "bold"
        }).setOrigin(0.5)

        this.add.text(cx, cy + 175, "← → Moverse     ↑ Saltar     ↓ Bajar", {
            fontSize: "22px", fill: "#cccccc"
        }).setOrigin(0.5)

        this.add.text(cx, cy + 220, "Recoge balones y anota en el aro.\nEvita a Michael Jordan.", {
            fontSize: "22px", fill: "#cccccc", align: "center"
        }).setOrigin(0.5)

        // texto parpadeante para iniciar
        this.startText = this.add.text(cx, cy + 340, "PRESIONA CUALQUIER TECLA PARA INICIAR", {
            fontSize: "22px", fill: "#ffffff",
            stroke: "#000000", strokeThickness: 3
        }).setOrigin(0.5)

        this.tweens.add({
            targets: this.startText,
            alpha: 0,
            duration: 600,
            yoyo: true,
            repeat: -1
        })

        this.input.keyboard.once("keydown", () => {
            this.scene.start("PlayGame")
        })
    }
}

class PlayGame extends Phaser.Scene {

    constructor() {
        super("PlayGame")
        this.scoreB = 0;
        this.scoreStar = 0;
        this.scoreHoop = 0;
    }


    preload() {
        this.load.image("pink-tile", "assets/pink_tile2.png")
        let basketball = this.load.image("basketball", "assets/basketball.png")
        let star = this.load.image("star", "assets/star.png")
        let hoop = this.load.image("hoop", "assets/basketball_hoop.png")
        this.load.spritesheet("player", "assets/player.png", { frameWidth: 300, frameHeight: 300 })
        this.load.spritesheet("player-right", "assets/player_right.png", { frameWidth: 300, frameHeight: 300 })
        //this.load.spritesheet("player-left", "assets/player_left.png", { frameWidth: 300, frameHeight: 300 })
        this.load.image("opponent", "assets/jordan.png", { frameWidth: 10, frameHeight: 48 })
    }

    create() {
        this.gameOver = false
        this.scoreB = 0
        this.scoreStar = 0
        this.scoreHoop = 0
        this.currentSpeed = gameOptions.playerSpeed
        this.level = 1

        this.groundGroup = this.physics.add.group({
            immovable: true,
            allowGravity: false
        })


        //add pink tiles
        for (let i = 0; i < 10; i++) {
            let tile = this.groundGroup.create(
                Phaser.Math.Between(0, game.config.width), Phaser.Math.Between(0, game.config.height), "pink-tile"
            );
            tile.setScale(0.5)
            tile.setVelocityY(gameOptions.playerSpeed / 6)
        }

        this.player = this.physics.add.sprite(game.config.width / 2, game.config.height / 2.5, "player")
        this.player.setScale(0.2)
        this.player.body.gravity.y = gameOptions.playerGravity
        this.physics.add.collider(this.player, this.groundGroup)

        //create groups
        this.basketballsGroup = this.physics.add.group({})
        this.starGroup = this.physics.add.group({})
        this.hoopGroup = this.physics.add.group({})
        this.jordan = this.physics.add.group({})
        this.smallJordan = this.physics.add.group({})


        this.physics.add.collider(this.groundGroup, this.starGroup)


        this.jordan.height = 30
        this.jordan.scaleY = this.player.scaleX

        this.physics.add.overlap(this.player, this.basketballsGroup, this.collectBasketball, null, this)
        this.physics.add.overlap(this.player, this.starGroup, this.collectStar, null, this)
        this.physics.add.overlap(this.player, this.hoopGroup, this.hoop, null, this)
        this.physics.add.overlap(this.player, this.jordan, this.collideWithBigJordan, null, this)
        this.physics.add.overlap(this.player, this.smallJordan, this.collideWithSmallJordan, null, this)

        //display scores in the upper left corner
        let imgB = this.add.image(40, 40, "basketball", { frameHeight: 10 })
        imgB.setScale(0.2)
        this.scoreBText = this.add.text(90, 23, "0", { fontSize: "30px", fill: "#ffffff" })

        let imgS = this.add.image(158, 40, "star", { frameHeight: 10 })
        imgS.setScale(0.14)
        this.scoreStarText = this.add.text(200, 23, "0", { fontSize: "30px", fill: "#ffffff" })

        let imgH = this.add.image(280, 40, "hoop", { frameHeight: 10 })
        imgH.setScale(0.14)
        this.scoreHoopText = this.add.text(330, 23, "0", { fontSize: "30px", fill: "#ffffff" })

        this.levelText = this.add.text(game.config.width - 20, 23, "NVL 1", {
            fontSize: "28px", fill: "#ffdd57", fontStyle: "bold"
        }).setOrigin(1, 0)

        this.eventText = this.add.text(game.config.width / 2, game.config.height - 60, "", { fontSize: "30px", fill: "#ffffff", backgroundColor: "#000000", align: "center"})
        this.eventText.setOrigin(0.5, 1)
        this.eventText.setWordWrapWidth(500)



        this.cursors = this.input.keyboard.createCursorKeys()


        this.anims.create({
            key: "left",
            frames: this.anims.generateFrameNumbers("player", { start: 0, end: 1 }),
            frameRate: 10,
            repeat: -1
        })
        this.anims.create({
            key: "right",
            frames: this.anims.generateFrameNumbers("player-right", { start: 0, end: 1 }),
            frameRate: 10,
            repeat: -1
        })

        this.triggerTimer = this.time.addEvent({
            callback: this.addGround,
            callbackScope: this,
            delay: 700,
            loop: true
        })

        this.time.addEvent({
            callback: this.increaseDifficulty,
            callbackScope: this,
            delay: 10000,
            loop: true
        })

        this.input.keyboard.on('keydown-LEFT', () => {
            this.player.anims.play('left', true);
        });

        this.input.keyboard.on('keydown-RIGHT', () => {
            this.player.anims.play('right', true);
        });
    }

    increaseDifficulty() {
        if (this.gameOver) return
        this.currentSpeed = Math.min(this.currentSpeed + 60, 1200)
        this.level++
        this.levelText.setText(`NVL ${this.level}`)
        this.eventText.setText(`¡Nivel ${this.level}!`)
    }

    addGround() {
        //add more ground
        let tile = this.groundGroup.create(Phaser.Math.Between(0, game.config.width), 0, "pink-tile")
        tile.setVelocityY(this.currentSpeed / 6)
        tile.setScale(0.5)

        //add flying basketballs
        if (Phaser.Math.Between(0, 1)) {
            let basketball = this.basketballsGroup.create(Phaser.Math.Between(0, game.config.width), 0, "basketball")
            basketball.setVelocityY(this.currentSpeed)
            basketball.setScale(0.3)
        }

        //add hoop collectibles
        if (Phaser.Math.Between(0, 0.5)) {
            let hoop = this.hoopGroup.create(Phaser.Math.Between(0, game.config.width), 0, "hoop")
            hoop.setVelocityY(this.currentSpeed)
            hoop.setScale(0.2)
        }

        //add flying stars
        if (Phaser.Math.Between(0, 0.7)) {
            let star = this.starGroup.create(Phaser.Math.Between(0, game.config.width), 0, "star")
            star.setVelocityY(this.currentSpeed)
            star.setScale(0.1)
            star.setVelocityX(this.currentSpeed / 6)
        }

        //add flying big opponents
        if (Phaser.Math.Between(0, 1)) {
            let opponentBig = this.jordan.create(Phaser.Math.Between(0, game.config.width), 0, "opponent")
            opponentBig.setVelocityX(this.currentSpeed)
            opponentBig.setVelocityY(this.currentSpeed * 1.5)
            opponentBig.setScale(0.4)
        }

        //add flying small opponents
        if (Phaser.Math.Between(0, 0.8)) {
            let opponentSmall = this.smallJordan.create(Phaser.Math.Between(0, game.config.width), 0, "opponent")
            opponentSmall.setVelocityX(this.currentSpeed * -1)
            opponentSmall.setVelocityY(this.currentSpeed * 1.5)
            opponentSmall.setScale(0.1)
        }
    }


    collectBasketball(player, basketball) {
        basketball.disableBody(true, true)
        this.scoreB++
        this.scoreBText.setText(this.scoreB)
    }
    collectStar(player, star) {
        star.disableBody(true, true)
        this.scoreStar++;
        this.scoreStarText.setText(this.scoreStar)
        this.eventText.setText("¡Estrella recogida!")
    }
    hoop(player, hoop) {
        hoop.disableBody(true, true)
        if (this.scoreB > 0) {
            this.scoreB--
            this.scoreHoop++
            this.scoreBText.setText(this.scoreB)
            this.scoreHoopText.setText(this.scoreHoop)
            this.eventText.setText("¡Anotaste!")
        }
        else{
            this.eventText.setText("No tienes balones.")
        }
    }

    collideWithSmallJordan(player, jordan) {
        if (this.gameOver) return
        this.gameOver = true
        this.scene.start("GameOverScene", {
            scoreB: this.scoreB,
            scoreStar: this.scoreStar,
            scoreHoop: this.scoreHoop
        })
    }

    collideWithBigJordan(player, jordan) {
        this.eventText.setText("¡Jordan te quitó todos los balones!")
        this.scoreB = 0
        this.scoreBText.setText(this.scoreB)
    }

    update() {
        if (this.cursors.left.isDown) {
            this.player.body.velocity.x = -gameOptions.playerSpeed
            this.player.anims.play("left", true)
        }
        else if (this.cursors.right.isDown) {
            this.player.body.velocity.x = gameOptions.playerSpeed
            this.player.anims.play("right", true)
        }
        else if (this.cursors.down.isDown) {
            this.player.body.velocity.y = gameOptions.playerSpeed / 2
        }
        else {
            this.player.body.velocity.x = 0
        }

        if (this.cursors.up.isDown) {
            this.player.body.velocity.y = -gameOptions.playerGravity / 1.6
        }

        this.player.x = Phaser.Math.Clamp(this.player.x, 0, game.config.width)

        const halfH = this.player.displayHeight / 2
        if ((this.player.y > game.config.height + halfH || this.player.y < -halfH) && !this.gameOver) {
            this.gameOver = true
            this.scene.start("GameOverScene", {
                scoreB: this.scoreB,
                scoreStar: this.scoreStar,
                scoreHoop: this.scoreHoop
            })
        }
    }

}

class GameOverScene extends Phaser.Scene {

    constructor() {
        super("GameOverScene")
    }

    init(data) {
        this.scoreB = data.scoreB || 0
        this.scoreStar = data.scoreStar || 0
        this.scoreHoop = data.scoreHoop || 0
    }

    preload() {
        this.load.image("basketball", "assets/basketball.png")
        this.load.image("star", "assets/star.png")
        this.load.image("hoop", "assets/basketball_hoop.png")
    }

    create() {
        const cx = game.config.width / 2
        const cy = game.config.height / 2

        // titulo
        this.add.text(cx, cy - 300, "GAME OVER", {
            fontSize: "90px",
            fill: "#ff3333",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 8
        }).setOrigin(0.5)

        // subtitulo stats
        this.add.text(cx, cy - 170, "TUS ESTADÍSTICAS", {
            fontSize: "36px",
            fill: "#ffdd57",
            fontStyle: "bold",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5)

        // separador
        this.add.rectangle(cx, cy - 120, 500, 2, 0xffffff, 0.4)

        // fila balones
        this.add.image(cx - 190, cy - 60, "basketball").setScale(0.2)
        this.add.text(cx - 140, cy - 75, "Balones recogidos", { fontSize: "26px", fill: "#cccccc" })
        this.add.text(cx + 180, cy - 75, `${this.scoreB}`, {
            fontSize: "32px", fill: "#ffffff", fontStyle: "bold"
        }).setOrigin(1, 0)

        // fila estrellas
        this.add.image(cx - 190, cy + 10, "star").setScale(0.14)
        this.add.text(cx - 140, cy - 5, "Estrellas recogidas", { fontSize: "26px", fill: "#cccccc" })
        this.add.text(cx + 180, cy - 5, `${this.scoreStar}`, {
            fontSize: "32px", fill: "#ffffff", fontStyle: "bold"
        }).setOrigin(1, 0)

        // fila anotaciones
        this.add.image(cx - 190, cy + 80, "hoop").setScale(0.14)
        this.add.text(cx - 140, cy + 65, "Anotaciones", { fontSize: "26px", fill: "#cccccc" })
        this.add.text(cx + 180, cy + 65, `${this.scoreHoop}`, {
            fontSize: "32px", fill: "#ffffff", fontStyle: "bold"
        }).setOrigin(1, 0)

        // separador
        this.add.rectangle(cx, cy + 140, 500, 2, 0xffffff, 0.4)

        // texto parpadeante para reiniciar
        this.restartText = this.add.text(cx, cy + 260, "PRESIONA CUALQUIER TECLA PARA REINICIAR", {
            fontSize: "22px",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 3,
            align: "center"
        }).setOrigin(0.5)
        this.restartText.setWordWrapWidth(500)

        this.tweens.add({
            targets: this.restartText,
            alpha: 0,
            duration: 600,
            yoyo: true,
            repeat: -1
        })

        this.input.keyboard.once("keydown", () => {
            this.scene.start("PlayGame")
        })
    }
}
