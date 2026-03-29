export type StructureBlockShape = {
  scale: [number, number, number]
  yOffset: number
}

const FULL_BLOCK: StructureBlockShape = {
  scale: [1, 1, 1],
  yOffset: 0,
}

export function resolveStructureBlockShape(blockId: string): StructureBlockShape {
  const normalized = (blockId.includes(':') ? blockId : `minecraft:${blockId}`).toLowerCase()

  if (/slab/i.test(normalized)) {
    return { scale: [1, 0.5, 1], yOffset: -0.25 }
  }

  if (/stairs/i.test(normalized)) {
    return { scale: [1, 0.75, 1], yOffset: -0.125 }
  }

  if (/wall/i.test(normalized)) {
    return { scale: [0.6, 1, 0.6], yOffset: 0 }
  }

  if (/fence_gate/i.test(normalized)) {
    return { scale: [1, 0.85, 0.26], yOffset: -0.075 }
  }

  if (/fence|iron_bars/i.test(normalized)) {
    return { scale: [0.24, 1, 0.24], yOffset: 0 }
  }

  if (/pane|chain/i.test(normalized)) {
    return { scale: [0.14, 1, 0.14], yOffset: 0 }
  }

  if (/door/i.test(normalized)) {
    return { scale: [0.18, 1, 1], yOffset: 0 }
  }

  if (/trapdoor/i.test(normalized)) {
    return { scale: [1, 0.2, 1], yOffset: -0.4 }
  }

  if (/carpet|pressure_plate|daylight_detector/i.test(normalized)) {
    return { scale: [1, 0.08, 1], yOffset: -0.46 }
  }

  if (/lantern|soul_lantern|end_rod|candle|torch/i.test(normalized)) {
    return { scale: [0.28, 0.45, 0.28], yOffset: -0.275 }
  }

  if (/wall_sign|hanging_sign/i.test(normalized)) {
    return { scale: [1, 0.6, 0.12], yOffset: -0.2 }
  }

  if (/sign/i.test(normalized)) {
    return { scale: [0.8, 0.6, 0.12], yOffset: -0.2 }
  }

  if (/glass_pane/i.test(normalized)) {
    return { scale: [0.12, 1, 0.12], yOffset: 0 }
  }

  if (/wall_torch/i.test(normalized)) {
    return { scale: [0.18, 0.4, 0.18], yOffset: -0.3 }
  }

  return FULL_BLOCK
}
