'use client'

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useMemo } from 'react'
import { Color, InstancedMesh, Matrix4 } from 'three'
import { computeStructureCameraDistance, computeStructureCameraTarget, groupVoxelsByBlockId, type Structure3DPreview } from '@/lib/catalog-art/structure-3d'

const BLOCK_COLORS: Record<string, string> = {
  'minecraft:oak_planks': '#b88752',
  'minecraft:cobblestone': '#7b7f87',
  'minecraft:stone_bricks': '#8c9097',
  'minecraft:deepslate_tiles': '#4a4b56',
  'minecraft:glass_pane': '#8ee7e2',
  'minecraft:glass': '#8ee7e2',
  'minecraft:dark_oak_planks': '#6b4c33',
  'minecraft:hay_block': '#d8b548',
}

function fallbackColor(blockId: string) {
  if (BLOCK_COLORS[blockId]) return BLOCK_COLORS[blockId]
  let hash = 0
  for (let i = 0; i < blockId.length; i += 1) hash = ((hash << 5) - hash) + blockId.charCodeAt(i)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 32% 56%)`
}

function VoxelGroup({ blockId, positions }: { blockId: string; positions: Array<[number, number, number]> }) {
  const color = useMemo(() => new Color(fallbackColor(blockId)), [blockId])
  return (
    <instancedMesh
      args={[undefined, undefined, positions.length]}
      ref={mesh => {
        if (!mesh) return
        const matrix = new Matrix4()
        positions.forEach(([x, y, z], index) => {
          matrix.makeTranslation(x, y, z)
          mesh.setMatrixAt(index, matrix)
          mesh.setColorAt(index, color)
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.72} metalness={0.02} emissive={color} emissiveIntensity={0.1} />
    </instancedMesh>
  )
}

export default function Structure3DViewport({ preview3d }: { preview3d: Structure3DPreview }) {
  const groups = useMemo(() => groupVoxelsByBlockId(preview3d), [preview3d])
  const target = useMemo(() => computeStructureCameraTarget(preview3d), [preview3d])
  const distance = useMemo(() => computeStructureCameraDistance(preview3d), [preview3d])
  const cameraPosition: [number, number, number] = [target[0] + distance * 0.9, target[1] + distance * 1.05, target[2] + distance * 0.9]

  return (
    <Canvas camera={{ position: cameraPosition, fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#151a22']} />
      <ambientLight intensity={3.1} />
      <hemisphereLight args={['#ecfff8', '#223038', 1.7]} />
      <directionalLight position={[10, 18, 12]} intensity={3.6} />
      <directionalLight position={[-8, 14, -6]} intensity={1.8} />
      <pointLight position={[target[0], target[1] + distance * 0.8, target[2]]} intensity={1.7} />
      <group position={[-target[0], -0.5, -target[2]]}>
        {groups.map(group => <VoxelGroup key={group.blockId} blockId={group.blockId} positions={group.positions} />)}
      </group>
      <gridHelper args={[Math.max(8, preview3d.bounds.width + preview3d.bounds.length), Math.max(8, preview3d.bounds.width + preview3d.bounds.length), '#2b4b45', '#20312d']} position={[0, -0.51, 0]} />
      <OrbitControls makeDefault target={target} enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.65} zoomSpeed={0.85} minPolarAngle={0.45} maxPolarAngle={1.35} minDistance={4} maxDistance={distance * 2.1} />
    </Canvas>
  )
}
