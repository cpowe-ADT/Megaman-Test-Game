import { describe, expect, it } from 'vitest'
import { computeTilePlacements, TILE_SIZE } from '../src/stage/tileSkin'

describe('tileSkin.computeTilePlacements', () => {
  it('tiles a ground strip with top caps and repeats fill variants below', () => {
    const placements = computeTilePlacements({ x: 0, y: 0, width: 48, height: 32 }, 'ground')
    const topRow = placements.filter((p) => p.y === 0)
    const fillRow = placements.filter((p) => p.y === TILE_SIZE)
    expect(topRow.map((p) => p.frame)).toEqual(
      expect.arrayContaining([expect.stringMatching(/^ground_top_\d$/)])
    )
    expect(topRow).toHaveLength(3)
    expect(fillRow).toHaveLength(3)
    fillRow.forEach((p) => expect(p.frame).toMatch(/^ground_fill_\d$/))
    placements.forEach((p) => {
      expect(p.width).toBe(TILE_SIZE)
      expect(p.height).toBe(TILE_SIZE)
    })
  })

  it('caps a floating ledge on the left/middle/right and fills the same columns below', () => {
    const placements = computeTilePlacements({ x: 100, y: 200, width: 48, height: 32 }, 'solid')
    expect(placements.filter((p) => p.y === 200).map((p) => p.frame)).toEqual([
      'ledge_top_l',
      'ledge_top_m',
      'ledge_top_r'
    ])
    expect(placements.filter((p) => p.y === 216).map((p) => p.frame)).toEqual([
      'ledge_fill_l',
      'ledge_fill_m',
      'ledge_fill_r'
    ])
  })

  it('draws wall faces on the side columns for every row, fill in the middle', () => {
    const placements = computeTilePlacements({ x: 0, y: 0, width: 48, height: 32 }, 'wall')
    const row0 = placements.filter((p) => p.y === 0).map((p) => p.frame)
    const row1 = placements.filter((p) => p.y === TILE_SIZE).map((p) => p.frame)
    expect(row0).toEqual(['wall_face_l', 'wall_fill', 'wall_face_r'])
    expect(row1).toEqual(['wall_face_l', 'wall_fill', 'wall_face_r'])
  })

  it('lays planks across a one-way platform', () => {
    const placements = computeTilePlacements({ x: 0, y: 0, width: 48, height: 8 }, 'oneWay')
    expect(placements.map((p) => p.frame)).toEqual(['plank_l', 'plank_m', 'plank_r'])
    placements.forEach((p) => expect(p.height).toBe(8))
  })

  it('repeats the spike frame across a hazard strip', () => {
    const placements = computeTilePlacements({ x: 0, y: 0, width: 32, height: 16 }, 'spike')
    expect(placements.map((p) => p.frame)).toEqual(['spike', 'spike'])
  })

  it('clips the trailing tile at an odd width instead of stretching', () => {
    const placements = computeTilePlacements({ x: 0, y: 0, width: 20, height: 16 }, 'ground')
    expect(placements).toHaveLength(2)
    expect(placements[0].width).toBe(16)
    expect(placements[1].width).toBe(4)
  })

  it('clips the trailing row at an odd height', () => {
    const placements = computeTilePlacements({ x: 0, y: 0, width: 16, height: 20 }, 'wall')
    expect(placements).toHaveLength(2)
    expect(placements[0].height).toBe(16)
    expect(placements[1].height).toBe(4)
  })

  it('is deterministic across repeated calls at the same position', () => {
    const a = computeTilePlacements({ x: 320, y: 96, width: 64, height: 16 }, 'ground')
    const b = computeTilePlacements({ x: 320, y: 96, width: 64, height: 16 }, 'ground')
    expect(a).toEqual(b)
  })

  it('falls back to a single left-cap tile for a rect narrower than one tile', () => {
    const placements = computeTilePlacements({ x: 0, y: 0, width: 8, height: 16 }, 'solid')
    expect(placements).toHaveLength(1)
    expect(placements[0].frame).toBe('ledge_top_l')
    expect(placements[0].width).toBe(8)
  })
})
