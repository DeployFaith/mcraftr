'use client'

import { Bounds, Center, Grid, OrbitControls, useGLTF } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { AlertCircle } from 'lucide-react'
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Color, Group, Matrix4, Object3D } from 'three'
import { shouldUseStructureVoxelPreview } from '@/lib/minecraft-preview-mode'

export type MinecraftPreviewType = 'structure' | 'entity' | 'item'

export type MinecraftPreviewVoxel = {
  x: number
  y: number
  z: number
  name?: string | null
  blockId?: string | null
}

export type MinecraftPreviewVoxelData = {
  voxels: MinecraftPreviewVoxel[]
  bounds?: {
    width: number
    height: number
    length: number
  } | null
  heights?: number[][] | null
  sampled?: boolean
  truncated?: boolean
  voxelCount?: number
}

export type MinecraftItemPreviewData = {
  color?: string
  label?: string | null
}

export type MinecraftEntityPreviewData = {
  color?: string
  label?: string | null
}

export type Minecraft3DPreviewProps = {
  id: string
  type: MinecraftPreviewType
  voxelData?: MinecraftPreviewVoxelData | null
  itemData?: MinecraftItemPreviewData | null
  entityData?: MinecraftEntityPreviewData | null
  fallbackSrc?: string | null
  className?: string
  canvasClassName?: string
  heightClassName?: string
  autoRotate?: boolean
  showGrid?: boolean
  shadows?: boolean
  disable3D?: boolean
}

type NormalizedVoxel = {
  x: number
  y: number
  z: number
  blockId: string
}

type VoxelGroupEntry = {
  blockId: string
  positions: Array<[number, number, number]>
  color: string
}

const BLOCK_COLORS: Record<string, string> = {
  'minecraft:oak_planks': '#b88752',
  'minecraft:spruce_planks': '#8e6a45',
  'minecraft:birch_planks': '#d9c78e',
  'minecraft:dark_oak_planks': '#6b4c33',
  'minecraft:cobblestone': '#7b7f87',
  'minecraft:stone': '#8b9098',
  'minecraft:stone_bricks': '#8c9097',
  'minecraft:mossy_stone_bricks': '#72836d',
  'minecraft:deepslate_tiles': '#4a4b56',
  'minecraft:glass': '#8ee7e2',
  'minecraft:glass_pane': '#8ee7e2',
  'minecraft:hay_block': '#d8b548',
  'minecraft:prismarine': '#7cc8b3',
  'minecraft:dark_prismarine': '#3d7a6f',
  'minecraft:sandstone': '#d7c08a',
  'minecraft:cut_sandstone': '#d9c693',
  'minecraft:polished_blackstone_bricks': '#4d434b',
  'minecraft:gilded_blackstone': '#7a6131',
  'minecraft:obsidian': '#3a2f52',
  'minecraft:crying_obsidian': '#5b49a4',
  'minecraft:purpur_block': '#af7ebc',
  'minecraft:end_stone_bricks': '#d4d2a2',
}

function fallbackBlockColor(blockId: string) {
  const normalized = blockId.startsWith('minecraft:') ? blockId : `minecraft:${blockId}`
  if (BLOCK_COLORS[normalized]) return BLOCK_COLORS[normalized]
  let hash = 0
  for (let index = 0; index < normalized.length; index += 1) hash = ((hash << 5) - hash) + normalized.charCodeAt(index)
  const hue = Math.abs(hash) % 360
  return `hsl(${hue} 28% 58%)`
}

function normalizeVoxelData(voxelData: MinecraftPreviewVoxelData | null | undefined): NormalizedVoxel[] {
  if (!voxelData?.voxels?.length) return []
  return voxelData.voxels.map(voxel => ({
    x: Number(voxel.x) || 0,
    y: Number(voxel.y) || 0,
    z: Number(voxel.z) || 0,
    blockId: String(voxel.blockId || voxel.name || 'minecraft:stone').trim() || 'minecraft:stone',
  }))
}

function groupVoxelData(voxels: NormalizedVoxel[]): VoxelGroupEntry[] {
  const groups = new Map<string, Array<[number, number, number]>>()
  for (const voxel of voxels) {
    const key = voxel.blockId.includes(':') ? voxel.blockId : `minecraft:${voxel.blockId}`
    const positions = groups.get(key) ?? []
    positions.push([voxel.x, voxel.y, voxel.z])
    groups.set(key, positions)
  }
  return Array.from(groups.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([blockId, positions]) => ({ blockId, positions, color: fallbackBlockColor(blockId) }))
}

function inferBounds(voxels: NormalizedVoxel[]) {
  if (voxels.length === 0) return { width: 1, height: 1, length: 1 }
  const maxX = Math.max(...voxels.map(voxel => voxel.x))
  const maxY = Math.max(...voxels.map(voxel => voxel.y))
  const maxZ = Math.max(...voxels.map(voxel => voxel.z))
  return { width: maxX + 1, height: maxY + 1, length: maxZ + 1 }
}

function computeCameraDistance(bounds: { width: number; height: number; length: number }) {
  return Math.max(7, Math.max(bounds.width, bounds.height, bounds.length) * 1.65)
}

function isLowEndDevice() {
  if (typeof navigator === 'undefined') return false
  const hardwareConcurrency = navigator.hardwareConcurrency ?? 4
  const deviceMemory = 'deviceMemory' in navigator ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4) : 4
  return hardwareConcurrency <= 2 || deviceMemory <= 2
}

class PreviewErrorBoundary extends Component<{ fallback: ReactNode; resetKey: string; children?: ReactNode }, { hasError: boolean }> {
  constructor(props: { fallback: ReactNode; resetKey: string; children?: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  override componentDidUpdate(prevProps: Readonly<{ resetKey: string }>) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function AutoRotate({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const ref = useRef<Group | null>(null)
  useFrame((_, delta) => {
    if (!enabled || !ref.current) return
    ref.current.rotation.y += delta * 0.3
  })
  return <group ref={ref}>{children}</group>
}

function InstancedVoxelGroup({ entry }: { entry: VoxelGroupEntry }) {
  const color = useMemo(() => new Color(entry.color), [entry.color])
  return (
    <instancedMesh
      castShadow
      receiveShadow
      args={[undefined, undefined, entry.positions.length]}
      ref={mesh => {
        if (!mesh) return
        const matrix = new Matrix4()
        entry.positions.forEach(([x, y, z], index) => {
          matrix.makeTranslation(x, y, z)
          mesh.setMatrixAt(index, matrix)
          mesh.setColorAt(index, color)
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }}
    >
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial vertexColors roughness={0.76} metalness={0.03} emissive={color} emissiveIntensity={0.08} />
    </instancedMesh>
  )
}

function VoxelScene({ voxelData, autoRotate = true, showGrid = true, shadows = false }: { voxelData: MinecraftPreviewVoxelData; autoRotate?: boolean; showGrid?: boolean; shadows?: boolean }) {
  const voxels = useMemo(() => normalizeVoxelData(voxelData), [voxelData])
  const groups = useMemo(() => groupVoxelData(voxels), [voxels])
  const bounds = useMemo(() => voxelData.bounds ?? inferBounds(voxels), [voxelData.bounds, voxels])
  const target = useMemo<[number, number, number]>(() => [bounds.width / 2, Math.max(0.5, bounds.height / 2), bounds.length / 2], [bounds])
  const distance = useMemo(() => computeCameraDistance(bounds), [bounds])
  const cameraPosition: [number, number, number] = [target[0] + distance * 0.9, target[1] + distance * 1.05, target[2] + distance * 0.9]

  return (
    <Canvas shadows={shadows} camera={{ position: cameraPosition, fov: 40 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#141922']} />
      <ambientLight intensity={3} />
      <hemisphereLight args={['#edfff9', '#24323a', 1.7]} />
      <directionalLight castShadow={shadows} position={[12, 18, 12]} intensity={3.4} />
      <directionalLight position={[-9, 14, -7]} intensity={1.7} />
      <pointLight position={[target[0], target[1] + distance * 0.7, target[2]]} intensity={1.5} />
      <Bounds fit clip observe margin={1.12}>
        <Center top>
          <AutoRotate enabled={autoRotate}>
            <group position={[-target[0], -0.5, -target[2]]}>
              {groups.map(entry => <InstancedVoxelGroup key={entry.blockId} entry={entry} />)}
            </group>
          </AutoRotate>
        </Center>
      </Bounds>
      {showGrid && <Grid position={[0, -0.51, 0]} args={[Math.max(8, bounds.width + bounds.length), Math.max(8, bounds.width + bounds.length)]} cellColor="#2a4a45" sectionColor="#20312d" fadeDistance={42} fadeStrength={1.3} />}
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.72} zoomSpeed={0.85} minPolarAngle={0.35} maxPolarAngle={1.42} minDistance={4} maxDistance={distance * 2.2} target={target} />
    </Canvas>
  )
}

function PlaceholderScene({ type, color, autoRotate = true, shadows = false }: { type: MinecraftPreviewType; color: string; autoRotate?: boolean; shadows?: boolean }) {
  const meshColor = useMemo(() => new Color(color), [color])
  const geometry = type === 'entity'
    ? <capsuleGeometry args={[0.55, 1.1, 6, 10]} />
    : type === 'item'
      ? <boxGeometry args={[1.1, 0.18, 1.1]} />
      : <boxGeometry args={[1, 1, 1]} />

  return (
    <Canvas shadows={shadows} camera={{ position: [3.2, 2.7, 3.2], fov: 42 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#141922']} />
      <ambientLight intensity={2.8} />
      <hemisphereLight args={['#f1fff9', '#233038', 1.4]} />
      <directionalLight castShadow={shadows} position={[6, 10, 6]} intensity={2.9} />
      <directionalLight position={[-4, 6, -4]} intensity={1.1} />
      <Center>
        <AutoRotate enabled={autoRotate}>
          <mesh castShadow receiveShadow>
            {geometry}
            <meshStandardMaterial color={meshColor} roughness={0.64} metalness={0.04} emissive={meshColor} emissiveIntensity={0.07} />
          </mesh>
        </AutoRotate>
      </Center>
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.7} zoomSpeed={0.85} minDistance={2.2} maxDistance={7} />
    </Canvas>
  )
}

function GLTFScene({ modelPath, autoRotate = true, shadows = false }: { modelPath: string; autoRotate?: boolean; shadows?: boolean }) {
  const gltf = useGLTF(modelPath)
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene])
  return (
    <Canvas shadows={shadows} camera={{ position: [3.5, 2.7, 3.5], fov: 40 }} dpr={[1, 1.5]}>
      <color attach="background" args={['#141922']} />
      <ambientLight intensity={2.4} />
      <hemisphereLight args={['#f0fff8', '#223038', 1.35]} />
      <directionalLight castShadow={shadows} position={[7, 11, 7]} intensity={2.8} />
      <directionalLight position={[-5, 8, -5]} intensity={1.2} />
      <Bounds fit clip observe margin={1.16}>
        <Center>
          <AutoRotate enabled={autoRotate}>
            <primitive object={cloned as Object3D} />
          </AutoRotate>
        </Center>
      </Bounds>
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.72} zoomSpeed={0.85} minDistance={2.5} maxDistance={9} />
    </Canvas>
  )
}

function PreviewFallback({ fallbackSrc, type, label, className = '' }: { fallbackSrc?: string | null; type: MinecraftPreviewType; label: string; className?: string }) {
  if (fallbackSrc) {
    return <img src={fallbackSrc} alt={`${label} preview`} className={`h-full w-full object-contain ${className}`} />
  }
  return (
    <div className={`flex h-full w-full items-center justify-center rounded-[inherit] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-4 text-center ${className}`}>
      <div>
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/10 text-[22px] font-mono text-[var(--text-dim)]">{type === 'entity' ? 'E' : type === 'item' ? 'I' : 'S'}</div>
        <div className="text-[11px] font-mono text-[var(--text)]">{label}</div>
        <div className="mt-1 text-[10px] font-mono text-[var(--text-dim)]">3D preview unavailable</div>
      </div>
    </div>
  )
}

function modelPathFor(type: MinecraftPreviewType, id: string) {
  return `/models/${type}s/${encodeURIComponent(id)}.glb`
}

export default function Minecraft3DPreview({
  id,
  type,
  voxelData = null,
  itemData = null,
  entityData = null,
  fallbackSrc = null,
  className = '',
  canvasClassName = '',
  heightClassName = 'h-96',
  autoRotate = true,
  showGrid = true,
  shadows = false,
  disable3D = false,
}: Minecraft3DPreviewProps) {
  const [prefer3D, setPrefer3D] = useState(false)
  const [allow3D, setAllow3D] = useState(false)

  useEffect(() => {
    if (disable3D) {
      setAllow3D(false)
      return
    }
    setAllow3D(!isLowEndDevice())
  }, [disable3D])

  useEffect(() => {
    setPrefer3D(Boolean(voxelData?.voxels?.length) || type === 'item' || type === 'entity')
  }, [type, voxelData?.voxels?.length])

  const modelPath = modelPathFor(type, id)
  const fallbackColor = itemData?.color ?? entityData?.color ?? (type === 'item' ? '#8fd4ff' : type === 'entity' ? '#7be3b8' : '#8c9097')
  const label = itemData?.label ?? entityData?.label ?? id
  const containerClassName = `${heightClassName} ${className}`.trim()
  const voxelAvailable = Boolean(voxelData?.voxels?.length)

  const fallbackNode = (
    <div className={`${containerClassName} ${canvasClassName}`.trim()}>
      <PreviewFallback fallbackSrc={fallbackSrc} type={type} label={label} />
    </div>
  )

  const renderVoxelOrPlaceholder = () => (
    <div className={`${containerClassName} ${canvasClassName}`.trim()}>
      {voxelAvailable
        ? <VoxelScene voxelData={voxelData!} autoRotate={autoRotate} showGrid={showGrid} shadows={shadows} />
        : <PlaceholderScene type={type} color={fallbackColor} autoRotate={autoRotate} shadows={shadows} />}
      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-mono text-[var(--text-dim)]">
        <AlertCircle size={12} /> Drag to orbit · scroll to zoom
      </div>
    </div>
  )

  if (shouldUseStructureVoxelPreview(type, voxelData)) return renderVoxelOrPlaceholder()
  if (!allow3D || !prefer3D) return fallbackNode

  const gltfFallback = renderVoxelOrPlaceholder()

  return (
    <PreviewErrorBoundary fallback={gltfFallback} resetKey={`${type}:${id}`}>
      <Suspense fallback={gltfFallback}>
        <div className={`${containerClassName} ${canvasClassName}`.trim()}>
          <GLTFScene modelPath={modelPath} autoRotate={autoRotate} shadows={shadows} />
          <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-mono text-[var(--text-dim)]">
            <AlertCircle size={12} /> Drag to orbit · scroll to zoom
          </div>
        </div>
      </Suspense>
    </PreviewErrorBoundary>
  )
}

useGLTF.preload('/models/items/diamond_sword.glb')
