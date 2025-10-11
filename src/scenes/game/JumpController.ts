export interface JumpTarget {
  setVelocityY(value: number): void
}

export class JumpController {
  private jumpHeld = false
  private wasGrounded = false

  constructor(private readonly jumpVelocity = -420) {}

  update(target: JumpTarget, wantsJump: boolean, grounded: boolean): boolean {
    let jumped = false

    if (!wantsJump) {
      this.jumpHeld = false
    } else if (grounded && (!this.jumpHeld || !this.wasGrounded)) {
      target.setVelocityY(this.jumpVelocity)
      this.jumpHeld = true
      jumped = true
    }

    this.wasGrounded = grounded
    return jumped
  }

  reset(): void {
    this.jumpHeld = false
    this.wasGrounded = false
  }
}
