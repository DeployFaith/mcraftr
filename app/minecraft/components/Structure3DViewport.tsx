'use client'

import { OrbitControls } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BoxGeometry, Color, InstancedMesh, MeshStandardMaterial, Object3D, type PerspectiveCamera } from 'three'
import {
  computeStructureCameraDistance,
  computeStructureCameraTarget,
  computeStructureExtentsFromVoxels,
  groupVoxelsByBlockId,
  type Structure3DPreview,
} from '@/lib/catalog-art/structure-3d'
import { resolveStructureBlockColor } from '@/lib/catalog-art/structure-block-color'

const INSTANCE_GEOMETRY = new BoxGeometry(1, 1, 1)
const OBJECT_HELPER = new Object3D()

function fallbackColor(blockId: string) {
  return resolveStructureBlockColor(blockId)
}

function VoxelGroup({
  blockId,
  positions,
  center,
}: {
  blockId: string
  positions: Array<[number, number, number]>
  center: [number, number, number]
}) {
  const meshRef = useRef<InstancedMesh | null>(null)
  const material = useMemo(() => {
    const base = new Color(fallbackColor(blockId))
    const shaded = base.clone().multiplyScalar(0.94)
    return new MeshStandardMaterial({
      color: shaded,
      roughness: 0.82,
      metalness: 0.04,
      emissive: base.clone().multiplyScalar(0.06),
      vertexColors: true,
    })
  }, [blockId])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return

    for (let index = 0; index < positions.length; index += 1) {
      const [x, y, z] = positions[index]
      OBJECT_HELPER.position.set(x - center[0], y - center[1], z - center[2])
      OBJECT_HELPER.updateMatrix()
      mesh.setMatrixAt(index, OBJECT_HELPER.matrix)
      mesh.setColorAt(index, material.color)
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [center, material.color, positions])

  return (
    <instancedMesh ref={meshRef} args={[INSTANCE_GEOMETRY, material, positions.length]} castShadow receiveShadow frustumCulled={false} />
  )
}

function CameraRig({
  preview3d,
  resetToken,
}: {
  preview3d: Structure3DPreview
  resetToken: number
}) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const extents = useMemo(() => computeStructureExtentsFromVoxels(preview3d.voxels), [preview3d])
  const target = useMemo(() => computeStructureCameraTarget(preview3d), [preview3d])
  const distance = useMemo(() => computeStructureCameraDistance(preview3d), [preview3d])

  useEffect(() => {
    const controls = controlsRef.current
    const camera = controls?.object as PerspectiveCamera | undefined
    if (!controls || !camera) return

    const centeredTarget: [number, number, number] = [0, 0, 0]
    camera.position.set(distance * 0.88, Math.max(extents.size[1] * 0.55, distance * 0.58), distance * 0.88)
    camera.near = 0.1
    camera.far = Math.max(250, distance * 12)
    camera.updateProjectionMatrix()
    controls.target.set(...centeredTarget)
    camera.lookAt(...centeredTarget)
    controls.minDistance = Math.max(4, distance * 0.35)
    controls.maxDistance = Math.max(12, distance * 3)
    controls.update()
  }, [distance, extents.size, resetToken, target])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      rotateSpeed={0.72}
      zoomSpeed={0.9}
      panSpeed={0.75}
      minPolarAngle={0.18}
      maxPolarAngle={Math.PI / 2 - 0.05}
    />
  )
}

export default function Structure3DViewport({
  preview3d,
  resetToken = 0,
}: {
  preview3d: Structure3DPreview
  resetToken?: number
}) {
  const groups = useMemo(() => groupVoxelsByBlockId(preview3d), [preview3d])
  const extents = useMemo(() => computeStructureExtentsFromVoxels(preview3d.voxels), [preview3d])
  const gridSize = useMemo(() => Math.max(8, extents.size[0] + extents.size[2] + 4), [extents.size])

  return (
    <Canvas
      shadows
      dpr={[1, 1.5]}
      camera={{
        position: [10, 10, 10],
        fov: 42,
        near: 0.1,
        far: 300,
      }}
    >
      <color attach="background" args={['#151a22']} />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={['#f1fff8', '#1f2c33', 1.05]} />
      <directionalLight castShadow position={[12, 22, 10]} intensity={2.2} shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <directionalLight position={[-10, 14, -8]} intensity={1.25} />
      <pointLight position={[0, Math.max(extents.size[1] * 1.4, 10), 0]} intensity={0.6} />

      <group>
        {groups.map(group => (
          <VoxelGroup key={group.blockId} blockId={group.blockId} positions={group.positions} center={extents.center} />
        ))}
      </group>

      <gridHelper args={[gridSize, gridSize, '#2b4b45', '#20312d']} position={[0, -extents.center[1] - 0.51, 0]} />
      <CameraRig preview3d={preview3d} resetToken={resetToken} />
    </Canvas>
  )
}
