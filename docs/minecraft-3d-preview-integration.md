# Minecraft 3D Preview Integration

## Files added

- `app/components/minecraft/Minecraft3DPreview.tsx`
- `tools/blockbench/mcraftr-batch-glb-exporter.js`

## What the component does

`Minecraft3DPreview` is a reusable client component that:
- tries to load `/models/<type>s/<id>.glb` first
- falls back to voxel rendering when `voxelData` exists
- falls back to a simple placeholder mesh for items/entities if no voxel data exists
- falls back to the existing 2D preview image when 3D is disabled or fails

## Suggested integration points

### Structures

Primary catalog/detail surfaces:
- `app/minecraft/components/WorldsSection.tsx`
- `app/minecraft/components/SpawnInspectModal.tsx`

Recommended structure usage:

```tsx
import Minecraft3DPreview from '@/app/components/minecraft/Minecraft3DPreview'

<Minecraft3DPreview
  id={structure.id}
  type="structure"
  voxelData={structurePreview?.preview3d ? {
    voxels: structurePreview.preview3d.voxels.map(voxel => ({
      x: voxel.x,
      y: voxel.y,
      z: voxel.z,
      blockId: voxel.blockId,
    })),
    bounds: structurePreview.preview3d.bounds,
    sampled: structurePreview.preview3d.sampled,
    truncated: structurePreview.preview3d.truncated,
    voxelCount: structurePreview.preview3d.voxelCount,
  } : null}
  fallbackSrc={target.imageUrl}
  autoRotate={false}
  heightClassName="h-[384px]"
/>
```

Best UX:
- use in structure inspect/preview modal first
- use on card surfaces selectively only for structures with compact voxel previews

### Entities

Suggested surfaces:
- `app/minecraft/components/WorldsSection.tsx`
- `app/minecraft/components/SpawnInspectModal.tsx`

Recommended initial entity usage:

```tsx
<Minecraft3DPreview
  id={entity.entityId ?? entity.id}
  type="entity"
  fallbackSrc={entity.imageUrl}
  entityData={{ label: entity.label, color: '#7be3b8' }}
  autoRotate
  heightClassName="h-[320px]"
/>
```

Notes:
- until real entity voxel/model data exists, this will use GLB if present or a placeholder mesh
- pre-generate GLBs first for creeper, zombie, skeleton, villager, armor_stand, player-like entities

### Items

Suggested surfaces:
- item inspect/detail surfaces first
- avoid dropping 3D canvases into every list row immediately

Recommended initial item usage:

```tsx
<Minecraft3DPreview
  id={item.id}
  type="item"
  fallbackSrc={item.imageUrl}
  itemData={{ label: item.label, color: '#8fd4ff' }}
  autoRotate
  heightClassName="h-[256px]"
/>
```

Notes:
- if `/public/models/items/<item.id>.glb` exists it will render that
- otherwise it falls back to a simple rotating item mesh

## Public model folder structure

Use this layout:

- `public/models/items/diamond_sword.glb`
- `public/models/items/netherite_pickaxe.glb`
- `public/models/entities/creeper.glb`
- `public/models/entities/zombie.glb`
- `public/models/structures/woodland_mansion.glb`
- `public/models/structures/ocean_monument.glb`

Naming rules:
- use the mcraftr catalog id where possible
- lowercase
- underscores, not spaces
- for namespaced ids, omit `minecraft:` in the filename

Examples:
- `minecraft:creeper` -> `creeper.glb`
- `diamond_sword` -> `diamond_sword.glb`
- `woodland_mansion` -> `woodland_mansion.glb`

## Blockbench plugin installation

1. Open Blockbench desktop app
2. Go to File -> Plugins -> Load Plugin from File
3. Select `tools/blockbench/mcraftr-batch-glb-exporter.js`
4. After install, open Tools -> Batch Export .bbmodel Folder to GLB
5. Choose:
   - input folder with `.bbmodel` files
   - output folder, ideally `mcraftr/public/models`
6. The plugin automatically buckets files into:
   - `items/`
   - `entities/`
   - `structures/`

## Best assets to pre-generate first

### Entities
- creeper
- zombie
- skeleton
- villager
- armor_stand
- player / steve / alex-like models

### Items
- diamond_sword
- netherite_sword
- diamond_pickaxe
- totem_of_undying
- trident
- bow

### Structures
Only pre-generate hero/landmark structures where curated GLB quality matters more than voxel speed:
- woodland_mansion
- ocean_monument
- bastion_remnant
- end_city
- trial_chamber

## Recommended next improvements

1. Replace simple voxel colors with block-face textures from catalog-art or a texture atlas
2. Add optional animation controls for GLB entities
3. Add device heuristics / reduced-motion handling for mobile
4. Cache successful GLB loads by id in a small runtime map
5. Add Playwright checks for 3D canvas presence on supported previews
