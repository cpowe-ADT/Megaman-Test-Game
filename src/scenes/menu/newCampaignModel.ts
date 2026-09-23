import type { Difficulty, ProgressionMode } from '../../progression/types'
export const CAMPAIGN_DIFFICULTIES: Difficulty[] = ['assist', 'normal', 'veteran']
export class NewCampaignModel {
  difficulty: Difficulty = 'normal'
  mode: ProgressionMode = 'classic'
  seed: string
  constructor(readonly randomizerAvailable: boolean, private readonly urlSeed: string | null, private readonly makeSeed = () => Math.random().toString(36).slice(2,10)) { this.seed = this.nextSeed() }
  private nextSeed(): string { return this.urlSeed?.trim().slice(0,64) || this.makeSeed() }
  cycleDifficulty(delta: number): void { this.difficulty = CAMPAIGN_DIFFICULTIES[(CAMPAIGN_DIFFICULTIES.indexOf(this.difficulty)+delta+3)%3] }
  toggleMode(): void { if(this.randomizerAvailable) this.mode = this.mode === 'classic' ? 'relay_randomizer' : 'classic' }
  reroll(): void { if(this.mode === 'relay_randomizer') this.seed = this.makeSeed() }
  selection(): { mode: ProgressionMode; difficulty: Difficulty; seed: string } { return { mode: this.mode, difficulty: this.difficulty, seed: this.mode === 'classic' ? 'classic' : this.seed } }
}
