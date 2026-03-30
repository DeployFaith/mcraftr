import { type Page, type Route } from '@playwright/test'

type MockOptions = {
  experimentalArtEnabled: boolean
}

const nowSeconds = () => Math.floor(Date.now() / 1000)

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  })
}

export async function installExperimentalArtMocks(page: Page, options: MockOptions) {
  const { experimentalArtEnabled } = options

  await page.route('**/api/account/preferences', async route => {
    if (route.request().method() !== 'GET') {
      return json(route, { ok: true })
    }

    return json(route, {
      ok: true,
      avatar: { type: 'none', value: null },
      features: {
        enable_dashboard_tab: true,
        enable_players_tab: true,
        enable_actions_tab: true,
        enable_worlds_tab: true,
        enable_chat: true,
        enable_admin: true,
        enable_world: true,
        enable_player_commands: true,
        enable_teleport: true,
        enable_kits: true,
        enable_custom_kits: true,
        enable_item_catalog: true,
        enable_inventory: true,
        enable_world_inventory: true,
        enable_world_build_tools: true,
        enable_world_maps: true,
        enable_plugin_stack_status: true,
        enable_world_spawn_tools: true,
        enable_structure_catalog: true,
        enable_entity_catalog: true,
        enable_world_management: true,
        enable_structure_place: true,
        enable_structure_remove: true,
        enable_structure_upload: true,
        enable_entity_spawn: true,
        enable_entity_live_tools: true,
        enable_entity_presets: true,
        enable_randomized_placement: true,
        enable_placement_validation: true,
        enable_player_session: true,
        enable_player_vitals: true,
        enable_player_location: true,
        enable_player_effects: true,
        enable_chat_read: true,
        enable_chat_write: true,
        enable_terminal_catalog: true,
        enable_terminal_docs: true,
        enable_terminal_wizards: true,
        enable_terminal_autocomplete: true,
        enable_terminal_history: true,
        enable_terminal_favorites: true,
        enable_admin_server_info: true,
        enable_admin_rules: true,
        enable_admin_server_controls: true,
        enable_admin_moderation: true,
        enable_admin_whitelist: true,
        enable_admin_operator: true,
        enable_admin_schedules: true,
        enable_rcon: true,
        enable_admin_audit: true,
        enable_admin_user_management: true,
        enable_admin_feature_policies: true,
        enable_experimental_structure_art: experimentalArtEnabled,
        enable_experimental_entity_art: experimentalArtEnabled,
        enable_experimental_item_art: experimentalArtEnabled,
      },
    })
  })

  await page.route('**/api/players', route => json(route, { players: 'Alex' }))
  await page.route('**/api/admin/players?**', route => json(route, { ok: true, players: [{ player_name: 'Alex', last_seen: nowSeconds() }] }))
  await page.route('**/api/servers/active', route => json(route, {
    ok: true,
    activeServer: {
      id: 'server-1',
      label: 'Disposable Full Stack',
      stackMode: 'full',
      bridgeEnabled: true,
      sidecarEnabled: true,
      minecraftVersion: { resolved: '1.21.4', requested: '1.21.4', source: 'override' },
    },
  }))

  await page.route('**/api/minecraft/dashboard', route => json(route, {
    ok: true,
    server: { id: 'server-1', label: 'Disposable Full Stack', host: 'full.mcraftr.test', port: 25576, stackMode: 'full', stackLabel: 'Full Mcraftr Stack' },
    overview: { online: 1, max: 20, players: ['Alex'], version: '1.21.4', tps: 19.97, weather: 'clear', timeOfDay: 'day', difficulty: 'normal' },
    rules: { keepInventory: 'true', mobGriefing: 'false', pvp: 'true', whitelistCount: 1 },
    recentChat: [],
    recentAudit: [],
    stack: { mode: 'full', modeLabel: 'Full Mcraftr Stack', modeDescription: 'Playwright experimental art mock harness.', upgradeRecommended: false, bridgeOk: true, sidecarOk: true, worldCount: 1, mapCount: 0 },
  }))

  await page.route('**/api/minecraft/player?**', route => json(route, {
    ok: true,
    uuid: '8667ba71-b85a-4004-af54-457a9734eed7',
    health: 20,
    food: 18,
    xpLevel: 15,
    xpP: 0.5,
    gamemode: 'survival',
    pos: { x: 12, y: 64, z: -8 },
    spawn: { x: 0, y: 64, z: 0 },
    dimension: 'minecraft:overworld',
    onlineTime: '2h 14m',
    ping: 42,
  }))
  await page.route('**/api/minecraft/effects?**', route => json(route, { ok: true, active: [] }))
  await page.route('**/api/minecraft/player-location?**', route => json(route, { ok: true, world: 'world', x: 12, y: 64, z: -8 }))

  await page.route('**/api/minecraft/inventory**', route => json(route, {
    ok: true,
    items: [
      { slot: 0, id: 'diamond_sword', count: 1, label: 'Diamond Sword', enchants: 'sharpness=5' },
    ],
  }))

  await page.route('**/api/minecraft/items/catalog-art?**', route => {
    const url = new URL(route.request().url())
    const ids = (url.searchParams.get('ids') ?? '').split(',').map(id => id.trim()).filter(Boolean)
    return json(route, {
      ok: true,
      items: ids.map(itemId => ({
        itemId,
        imageUrl: itemId === 'diamond_sword' ? '/api/minecraft/art/item/1.21.4/diamond_sword' : null,
        art: itemId === 'diamond_sword'
          ? { url: '/api/minecraft/art/item/1.21.4/diamond_sword', class: 'item-card', strategy: 'item-render', reviewState: 'approved' }
          : null,
      })),
    })
  })

  await page.route('**/api/minecraft/worlds', route => json(route, {
    ok: true,
    worlds: [{ id: 'world', name: 'world', displayName: 'Overworld', environment: 'normal', loaded: true, difficulty: 'normal', spawn: { x: 0, y: 64, z: 0 }, weather: 'clear', time: 'day' }],
  }))
  await page.route('**/api/minecraft/worlds/*', route => json(route, {
    ok: true,
    world: { id: 'world', name: 'world', displayName: 'Overworld', environment: 'normal', loaded: true, difficulty: 'normal', spawn: { x: 0, y: 64, z: 0 }, weather: 'clear', time: 'day' },
  }))
  await page.route('**/api/minecraft/plugin-stack', route => json(route, {
    ok: true,
    relay: { ok: true, serverVersion: '1.21.4', capabilities: ['terminal', 'worlds', 'entities'] },
    sidecar: { ok: true, capabilities: ['structures', 'maps', 'entity-presets'] },
  }))
  await page.route('**/api/minecraft/structures/placements', route => json(route, { ok: true, placements: [] }))
  await page.route('**/api/minecraft/structures/metadata', route => json(route, { ok: true, roots: ['plugins/WorldEdit/schematics'] }))
  await page.route('**/api/minecraft/entities/live?**', route => json(route, { ok: true, entities: [] }))
  await page.route('**/api/minecraft/entities/presets**', route => json(route, { ok: true, presets: [] }))
  await page.route('**/api/minecraft/placement/validate', route => json(route, { ok: true, valid: true, warning: null }))
  await page.route('**/api/minecraft/placement/randomize', route => json(route, { ok: true, x: 18, y: 64, z: -12 }))

  await page.route('**/api/minecraft/structures', route => json(route, {
    ok: true,
    structures: [
      {
        id: 'castle_keep',
        label: 'Castle Keep',
        category: 'Fortress',
        sourceKind: 'template',
        placementKind: 'schematic',
        format: 'schem',
        sizeBytes: 1024,
        updatedAt: nowSeconds(),
        imageUrl: '/api/minecraft/art/structure?version=1.21.4&placementKind=schematic&relativePath=castle_keep.schem&label=Castle%20Keep',
        art: { url: '/api/minecraft/art/structure?version=1.21.4&placementKind=schematic&relativePath=castle_keep.schem&label=Castle%20Keep', class: 'structure-materials', strategy: 'structure-material-board', reviewState: 'approved' },
        hasPreview: true,
        has3d: false,
        summary: 'Compact fortified keep.',
      },
    ],
  }))

  await page.route('**/api/minecraft/entities', route => json(route, {
    ok: true,
    entities: [
      {
        id: 'villager',
        entityId: 'minecraft:villager',
        label: 'Villager',
        category: 'Passive',
        sourceKind: 'builtin',
        defaultCount: 1,
        imageUrl: '/api/minecraft/art/entity/1.21.4/villager',
        art: { url: '/api/minecraft/art/entity/1.21.4/villager', class: 'entity-sheet', strategy: 'entity-render', reviewState: 'approved' },
        summary: 'Helpful town resident.',
      },
    ],
  }))
}
