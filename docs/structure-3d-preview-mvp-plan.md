# Structure 3D Preview MVP Plan

> For Hermes: implement this as Option A only — structures first, inspect-modal first, 2D fallback preserved.

Goal: add a real interactive 3D structure preview for Mcraftr structures without trying to solve general Minecraft item/entity model rendering.

Architecture:
- Beacon remains the source of structure preview truth.
- The app gets a new 3D-friendly structure preview payload from Beacon.
- The UI adds a lazy-loaded Structure3DPreview component rendered only in structure inspect/detail surfaces.
- Existing 2D Preview and Materials modes remain intact as safe fallbacks.

Tech stack:
- three
- @react-three/fiber
- @react-three/drei
- Next.js dynamic import
- Beacon structure preview payload extensions

---

## Product decisions

1. Scope only structures.
2. Do not attempt general Minecraft model loading yet.
3. Do not put 3D canvases into every catalog card initially.
4. Add 3D only in the structure inspect modal first.
5. Keep 2D Preview and Materials as first-class fallbacks.
6. Render voxel geometry from Beacon data, not glTF exports.

---

## MVP user experience

In the structure inspect modal, the artwork area becomes 3 selectable modes:
- Preview
- 3D
- Materials

Behavior:
- Preview = current 2D isometric-lite renderer
- 3D = interactive orbitable voxel preview
- Materials = current materials board
- If 3D data is unavailable or 3D rendering fails, the UI falls back to Preview and shows a small note

---

## Data model design

Current Beacon structure preview already returns:
- blocks
- cells
- heights
- dimensions

For 3D MVP, Beacon should also return a bounded voxel payload shaped like this:

```ts
export type Structure3DVoxel = {
  x: number
  y: number
  z: number
  blockId: string
}

export type Structure3DPreview = {
  voxels: Structure3DVoxel[]
  bounds: {
    width: number
    height: number
    length: number
  }
  truncated: boolean
  sampled: boolean
  voxelCount: number
}

export type StructurePreviewDescriptor = {
  blocks: string[]
  cells?: string[][] | null
  heights?: number[][] | null
  dimensions?: {
    width: number | null
    height: number | null
    length: number | null
  } | null
  preview3d?: Structure3DPreview | null
}
```

Rules:
- preview3d is optional
- Beacon may omit it for giant structures or unsupported cases
- voxelCount is explicit so the UI can warn about truncation/sampling

---

## Performance constraints

Hard limits for MVP:
- Max raw voxel export target: 6000 voxels
- Prefer shell/top-exposed voxels instead of full solid mass when needed
- If source structure exceeds threshold:
  - mark sampled=true and/or truncated=true
  - include a representative voxel subset
- Use instanced rendering in three.js
- Group by blockId/texture to reduce draw calls

---

## File plan

Files to modify:
- `beacon/server.mjs`
- `lib/minecraft-assets/structure-art.ts`
- `app/minecraft/components/CatalogArtwork.tsx`
- `app/minecraft/components/SpawnInspectModal.tsx`
- `app/api/minecraft/art/structure/route.ts` only if additional API wiring becomes necessary
- `package.json`

Files to create:
- `app/minecraft/components/Structure3DPreview.tsx`
- `app/minecraft/components/Structure3DViewport.tsx`
- `lib/catalog-art/structure-3d.ts`
- `tests/unit/structure-3d-preview-data.test.ts`
- `tests/unit/structure-3d-mode.test.ts`
- optionally `tests/playwright/structure-art.spec.ts`

---

## Task 1: Add 3D preview payload builder in Beacon

Objective: make Beacon emit a bounded voxel preview for structures.

Files:
- Modify: `beacon/server.mjs`
- Test: `tests/unit/structure-3d-preview-data.test.ts`

Step 1: add a failing unit test for 3D preview shaping
- Verify output includes:
  - `preview3d.voxels`
  - `preview3d.bounds`
  - `truncated`
  - `sampled`
  - `voxelCount`

Step 2: implement helper functions in Beacon:
- `buildStructure3DPreview(dimensions, positionedBlocks)`
- `filterRenderablePreviewBlocks(positionedBlocks)`
- `downsampleStructureVoxels(...)`

Implementation rules:
- discard air/non-previewable blocks
- normalize block names with existing strip/state helpers
- preserve coordinates relative to structure origin
- cap voxel count
- prefer top/shell visibility when downsampling

Step 3: attach `preview3d` to native-template and file-based preview responses
- do not block route if 3D preview generation fails
- preserve existing 2D payload behavior

Step 4: run the unit test and confirm it passes

---

## Task 2: Add three.js dependencies and lazy loading boundary

Objective: prepare the app for 3D without bloating the default bundle.

Files:
- Modify: `package.json`
- Modify: `app/minecraft/components/SpawnInspectModal.tsx`

Step 1: add dependencies
- `three`
- `@react-three/fiber`
- `@react-three/drei`
- optional: `@types/three`

Step 2: add lazy import boundary using `next/dynamic`
- disable SSR for the 3D preview component
- keep a loading skeleton in the inspect modal

Step 3: verify the app still typechecks after dependency addition

---

## Task 3: Create a pure data-to-render preparation layer

Objective: keep three.js rendering separate from Beacon/raw API shapes.

Files:
- Create: `lib/catalog-art/structure-3d.ts`
- Test: `tests/unit/structure-3d-preview-data.test.ts`

Functions to create:
- `groupVoxelsByBlockId(preview3d)`
- `computeStructureCameraTarget(preview3d)`
- `computeStructureScale(preview3d)`
- `summarizeStructure3DMeta(preview3d)`

This layer should:
- stay framework-agnostic
- return predictable render groups
- be unit-testable without WebGL

---

## Task 4: Build `Structure3DPreview` component

Objective: render grouped voxels with orbit controls and sane defaults.

Files:
- Create: `app/minecraft/components/Structure3DPreview.tsx`
- Create: `app/minecraft/components/Structure3DViewport.tsx`

Component responsibilities:
- `Structure3DPreview`:
  - receives preview3d payload
  - handles loading/error/empty states
  - renders metadata badges: voxel count, sampled/truncated
- `Structure3DViewport`:
  - owns `<Canvas>`
  - ambient + directional light
  - orbit controls
  - reset camera button
  - grouped instanced meshes per blockId

MVP rendering choice:
- use simple cube voxels first
- texture faces if available from existing texture pipeline
- if texture lookup is not ready yet, fall back to accent-tinted/material-colored cubes

Success criteria:
- user can orbit, zoom, and inspect shape
- no crash if textures fail
- empty payload shows a graceful fallback card

---

## Task 5: Add structure mode switching in inspect modal

Objective: expose Preview / 3D / Materials clearly in the structure inspect flow.

Files:
- Modify: `app/minecraft/components/SpawnInspectModal.tsx`
- Possibly modify: `app/minecraft/components/CatalogArtwork.tsx`

Design:
- keep existing Preview/Materials toggle behavior for 2D image mode
- add a higher-level mode selector in the inspect modal:
  - `2D Preview`
  - `3D`
  - `Materials`

Recommended behavior:
- default to `2D Preview`
- if `preview3d` exists, enable `3D`
- if not, disable `3D` with a short explanatory tooltip/text

Important:
- do not force 3D into list cards yet
- keep list browsing lightweight

---

## Task 6: Add fallback and failure handling

Objective: 3D should never break structure browsing.

Files:
- Modify: `Structure3DPreview.tsx`
- Modify: `SpawnInspectModal.tsx`
- Test: `tests/unit/structure-3d-mode.test.ts`

Required cases:
- no preview3d payload -> 3D tab disabled
- preview3d payload present but canvas/init fails -> show fallback notice and keep Preview available
- truncated/sample preview -> show metadata badge so users know it is approximate

---

## Task 7: Add tests

Objective: lock in behavior before expanding scope.

Unit tests:
- `tests/unit/structure-3d-preview-data.test.ts`
  - preview3d payload shape
  - grouping/downsampling behavior
- `tests/unit/structure-3d-mode.test.ts`
  - mode enable/disable logic
  - fallback behavior

Optional Playwright test:
- `tests/playwright/structure-art.spec.ts`
  - open structure inspect modal
  - switch between Preview / 3D / Materials
  - confirm 3D canvas exists when payload exists
  - confirm fallback notice for structures without 3D payload

---

## Task 8: Verification commands

Run after implementation:

```bash
cd /workspace/projects/mcraftr-source && npx -y tsx --test ./tests/unit/structure-3d-preview-data.test.ts
cd /workspace/projects/mcraftr-source && npx -y tsx --test ./tests/unit/structure-3d-mode.test.ts
cd /workspace/projects/mcraftr-source && ./node_modules/.bin/tsc --noEmit --pretty false
```

If a Playwright pass is added:

```bash
cd /workspace/projects/mcraftr-source && npx playwright test tests/playwright/structure-art.spec.ts --project=desktop-chromium
```

---

## Recommended commit sequence

1. `feat(beacon): emit bounded 3d structure preview payloads`
2. `feat(art): add structure 3d preview component`
3. `feat(ui): add 3d mode to structure inspect modal`
4. `test(art): cover structure 3d preview fallbacks`

---

## Non-goals for MVP

Do not do these yet:
- item 3D previews
- entity 3D previews
- generalized Minecraft model loader pipeline
- animation systems
- full resource-pack compatibility
- 3D canvases inside every catalog card

---

## Recommendation after MVP

If MVP succeeds, the next best follow-up is:
1. texture-face accuracy improvements
2. better shell extraction for giant structures
3. optional remembered per-user mode preference
4. only then consider entities or items
