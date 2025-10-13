import Phaser from 'phaser'

type Palette = {
  primary: number
  accent: number
}

type ArmPose = 'down' | 'forward' | 'back' | 'shoot' | 'up'
type LegPose = 'together' | 'forward' | 'back' | 'midair' | 'slide'

type Pose = {
  key: string
  leftArm: ArmPose
  rightArm: ArmPose
  leftLeg: LegPose
  rightLeg: LegPose
  lean?: number
  jump?: boolean
  slide?: boolean
  hurt?: boolean
}

export class Preload extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload(): void {
    const palette = this.registry.get('palette') as Palette | undefined

    const primary = palette?.primary ?? 0x3b82f6
    const accent = palette?.accent ?? 0x93c5fd

    const graphics = this.make.graphics(
      { x: 0, y: 0, add: false } as Phaser.Types.GameObjects.Graphics.Options & { add?: boolean }
    )

    const face = 0xf7d7b5
    const outline = 0x04162f
    const primaryColor = Phaser.Display.Color.IntegerToColor(primary)
    const darkPrimary = Phaser.Display.Color.GetColor(
      Math.floor((primaryColor.red * 3) / 5),
      Math.floor((primaryColor.green * 3) / 5),
      Math.floor((primaryColor.blue * 3) / 5)
    )
    const bulletCore = 0xe0f2ff
    const bulletOuter = 0x60a5fa
    const enemyMain = 0xf97316
    const enemyDark = 0xc2410c
    const hazard = 0xff4d6d

    const drawRect = (color: number, x: number, y: number, w: number, h: number) => {
      graphics.fillStyle(color)
      graphics.fillRect(x, y, w, h)
    }

    const drawPose = ({ key, leftArm, rightArm, leftLeg, rightLeg, lean = 0, jump, slide, hurt }: Pose) => {
      graphics.clear()

      const jumpOffset = jump ? -2 : 0
      const slideOffset = slide ? 2 : 0
      const baseY = jumpOffset + slideOffset
      const headX = 4 + lean
      const headY = 0 + baseY + (hurt ? 1 : 0)
      const bodyX = 5 + lean + (hurt ? 1 : 0)
      const bodyY = 6 + baseY + (hurt ? 1 : 0)
      const legY = 12 + baseY + (slide ? 2 : 0)

      // Helmet & face
      drawRect(outline, headX - 1, headY, 10, 6)
      drawRect(primary, headX, headY, 8, 4)
      drawRect(primary, headX - 1, headY + 1, 10, 3)
      drawRect(face, headX + 1, headY + 1, 6, 3)
      drawRect(accent, headX - 1, headY + 2, 2, 1)
      drawRect(accent, headX + 7, headY + 2, 2, 1)
      drawRect(accent, headX + 3, headY + 4, 2, 1)

      // Torso
      const torsoHeight = slide ? 4 : 5
      drawRect(outline, bodyX - 1, bodyY, 8, torsoHeight + 2)
      drawRect(primary, bodyX, bodyY, 6, torsoHeight)
      drawRect(primary, bodyX - 1, bodyY + 1, 8, torsoHeight - 1)
      drawRect(darkPrimary, bodyX, bodyY + 1, 2, torsoHeight - 1)
      drawRect(accent, bodyX - 1, bodyY + torsoHeight - 1, 8, 2)

      const drawLeftArm = (pose: ArmPose) => {
        if (pose === 'down') {
          drawRect(primary, bodyX - 3, bodyY, 2, 4)
          drawRect(primary, bodyX - 3, bodyY + 3, 3, 2)
          drawRect(accent, bodyX - 3, bodyY + 5, 3, 2)
        } else if (pose === 'forward') {
          drawRect(primary, bodyX - 4, bodyY + 2, 4, 2)
          drawRect(accent, bodyX - 4, bodyY + 4, 3, 2)
        } else if (pose === 'back') {
          drawRect(primary, bodyX - 5, bodyY + 1, 3, 3)
          drawRect(accent, bodyX - 5, bodyY + 3, 3, 2)
        } else if (pose === 'up') {
          drawRect(primary, bodyX - 2, bodyY - 3, 2, 5)
          drawRect(accent, bodyX - 2, bodyY + 2, 2, 2)
        } else {
          drawRect(primary, bodyX - 3, bodyY, 2, 4)
          drawRect(accent, bodyX - 3, bodyY + 4, 3, 2)
        }
      }

      const drawRightArm = (pose: ArmPose) => {
        if (pose === 'down') {
          drawRect(primary, bodyX + 7, bodyY, 2, 4)
          drawRect(primary, bodyX + 6, bodyY + 3, 3, 2)
          drawRect(accent, bodyX + 6, bodyY + 5, 3, 2)
        } else if (pose === 'forward') {
          drawRect(primary, bodyX + 6, bodyY + 2, 5, 2)
          drawRect(accent, bodyX + 9, bodyY + 1, 2, 4)
        } else if (pose === 'back') {
          drawRect(primary, bodyX + 6, bodyY + 1, 3, 3)
          drawRect(accent, bodyX + 6, bodyY + 3, 3, 2)
        } else if (pose === 'shoot') {
          drawRect(primary, bodyX + 6, bodyY + 1, 5, 3)
          drawRect(accent, bodyX + 10, bodyY, 3, 5)
          drawRect(bulletOuter, bodyX + 12, bodyY + 1, 2, 3)
        } else if (pose === 'up') {
          drawRect(primary, bodyX + 5, bodyY - 3, 2, 5)
          drawRect(accent, bodyX + 5, bodyY + 2, 2, 2)
        }
      }

      const drawLeg = (side: 'left' | 'right', pose: LegPose) => {
        const direction = side === 'left' ? -1 : 1
        const base = side === 'left' ? bodyX : bodyX + 3
        const footBase = side === 'left' ? bodyX - 1 : bodyX + 3

        if (slide) {
          drawRect(primary, bodyX - 1, legY, 8, 3)
          drawRect(accent, bodyX - 1, legY + 3, 8, 2)
          return
        }

        if (pose === 'together') {
          drawRect(primary, base, legY, 2, 4)
          drawRect(accent, footBase, legY + 4, 4, 2)
        } else if (pose === 'forward') {
          drawRect(primary, base + direction, legY + 1, 2, 3)
          drawRect(accent, footBase + direction - 1, legY + 4, 4, 2)
        } else if (pose === 'back') {
          drawRect(primary, base - direction, legY, 2, 4)
          drawRect(accent, footBase - direction - 1, legY + 4, 4, 2)
        } else if (pose === 'midair') {
          drawRect(primary, base, legY - 1, 2, 3)
          drawRect(accent, footBase, legY + 2, 4, 2)
        } else if (pose === 'slide') {
          drawRect(primary, bodyX - 1, legY, 8, 3)
          drawRect(accent, bodyX - 1, legY + 3, 8, 2)
        }
      }

      drawLeftArm(leftArm)
      drawRightArm(rightArm)
      drawLeg('left', leftLeg)
      drawLeg('right', rightLeg)

      if (hurt) {
        graphics.fillStyle(0xffffff, 0.3)
        graphics.fillRect(bodyX - 4, headY - 1, 16, 18)
      }

      graphics.generateTexture(key, 20, 20)
    }

    const poses: Pose[] = [
      { key: 'player_idle_0', leftArm: 'down', rightArm: 'down', leftLeg: 'together', rightLeg: 'together' },
      {
        key: 'player_idle_1',
        leftArm: 'down',
        rightArm: 'down',
        leftLeg: 'together',
        rightLeg: 'together',
        lean: 1
      },
      {
        key: 'player_run_0',
        leftArm: 'forward',
        rightArm: 'back',
        leftLeg: 'forward',
        rightLeg: 'back',
        lean: -1
      },
      {
        key: 'player_run_1',
        leftArm: 'down',
        rightArm: 'down',
        leftLeg: 'together',
        rightLeg: 'together',
        lean: 0
      },
      {
        key: 'player_run_2',
        leftArm: 'back',
        rightArm: 'forward',
        leftLeg: 'back',
        rightLeg: 'forward',
        lean: 1
      },
      {
        key: 'player_run_3',
        leftArm: 'down',
        rightArm: 'down',
        leftLeg: 'together',
        rightLeg: 'together',
        lean: 0
      },
      {
        key: 'player_jump',
        leftArm: 'back',
        rightArm: 'forward',
        leftLeg: 'midair',
        rightLeg: 'midair',
        jump: true
      },
      {
        key: 'player_fall',
        leftArm: 'down',
        rightArm: 'forward',
        leftLeg: 'midair',
        rightLeg: 'midair',
        jump: true,
        lean: 1
      },
      {
        key: 'player_shoot',
        leftArm: 'down',
        rightArm: 'shoot',
        leftLeg: 'together',
        rightLeg: 'together'
      },
      {
        key: 'player_shoot_air',
        leftArm: 'back',
        rightArm: 'shoot',
        leftLeg: 'midair',
        rightLeg: 'midair',
        jump: true
      },
      {
        key: 'player_slide',
        leftArm: 'back',
        rightArm: 'shoot',
        leftLeg: 'slide',
        rightLeg: 'slide',
        slide: true,
        lean: 1
      },
      {
        key: 'player_hurt',
        leftArm: 'forward',
        rightArm: 'back',
        leftLeg: 'midair',
        rightLeg: 'back',
        jump: true,
        hurt: true,
        lean: -2
      }
    ]

    poses.forEach((pose) => drawPose(pose))

    const bulletFrames = [
      { key: 'buster_0', radius: 2 },
      { key: 'buster_1', radius: 3 },
      { key: 'buster_2', radius: 4 }
    ]

    bulletFrames.forEach(({ key, radius }) => {
      graphics.clear()
      graphics.fillStyle(bulletOuter)
      graphics.fillCircle(radius + 1, radius + 1, radius)
      graphics.fillStyle(bulletCore)
      graphics.fillCircle(radius + 1, radius + 1, Math.max(1, radius - 1))
      graphics.generateTexture(key, radius * 2 + 2, radius * 2 + 2)
    })

    const dummyFrames = [
      { key: 'dummy_idle_0', eyeY: 6 },
      { key: 'dummy_idle_1', eyeY: 7 }
    ]

    dummyFrames.forEach(({ key, eyeY }) => {
      graphics.clear()
      drawRect(enemyDark, 2, 9, 12, 6)
      drawRect(enemyMain, 2, 4, 12, 9)
      drawRect(0xffffff, 5, eyeY, 2, 2)
      drawRect(0xffffff, 9, eyeY, 2, 2)
      drawRect(bulletOuter, 6, eyeY + 3, 4, 2)
      graphics.generateTexture(key, 16, 18)
    })

    const explosionFrames = [
      { key: 'explosion_0', radius: 2 },
      { key: 'explosion_1', radius: 4 },
      { key: 'explosion_2', radius: 6 },
      { key: 'explosion_3', radius: 8 }
    ]

    explosionFrames.forEach(({ key, radius }) => {
      graphics.clear()
      graphics.fillStyle(bulletOuter)
      graphics.fillCircle(radius + 2, radius + 2, radius)
      graphics.fillStyle(0xffffff)
      graphics.fillCircle(radius + 2, radius + 2, Math.max(1, radius - 2))
      graphics.generateTexture(key, radius * 2 + 4, radius * 2 + 4)
    })

    graphics.clear()
    graphics.fillStyle(hazard)
    graphics.fillRect(0, 4, 16, 8)
    graphics.fillStyle(0xffffff)
    graphics.fillTriangle(0, 4, 4, 0, 8, 4)
    graphics.fillTriangle(8, 4, 12, 0, 16, 4)
    graphics.generateTexture('hazard_spikes', 16, 12)
  }

  create(): void {
    const createAnimation = (key: string, frames: string[], frameRate: number, repeat = -1) => {
      if (this.anims.exists(key)) {
        return
      }
      this.anims.create({
        key,
        frames: frames.map((frame) => ({ key: frame })),
        frameRate,
        repeat
      })
    }

    createAnimation('player-idle', ['player_idle_0', 'player_idle_1'], 6)
    createAnimation('player-run', ['player_run_0', 'player_run_1', 'player_run_2', 'player_run_3'], 12)
    createAnimation('player-jump', ['player_jump'], 1)
    createAnimation('player-fall', ['player_fall'], 1)
    createAnimation('player-shoot', ['player_shoot'], 1)
    createAnimation('player-shoot-air', ['player_shoot_air'], 1)
    createAnimation('player-slide', ['player_slide'], 1)
    createAnimation('player-hurt', ['player_hurt'], 1)

    createAnimation('buster-fly', ['buster_0', 'buster_1', 'buster_2', 'buster_1'], 18)
    createAnimation('dummy-idle', ['dummy_idle_0', 'dummy_idle_1'], 4)
    createAnimation('dummy-explode', ['explosion_0', 'explosion_1', 'explosion_2', 'explosion_3'], 16, 0)

    if (!this.textures.exists('bossBullet')) {
      const tex = this.textures.createCanvas('bossBullet', 4, 4)
      if (tex) {
        const canvas = tex.getSourceImage() as HTMLCanvasElement
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = '#60a5fa'
          ctx.fillRect(0, 0, 4, 4)
          tex.refresh()
        }
      }
    }

    this.scene.start('StageSelect')
  }
}
