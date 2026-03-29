import test from 'node:test'
import assert from 'node:assert/strict'
import { hydrateCatalogWithArt } from '../../app/minecraft/items'

test('hydrateCatalogWithArt leaves item art metadata unset until backend truth is resolved', () => {
  const hydrated = hydrateCatalogWithArt('1.21.4', [{
    id: 'combat',
    label: 'Combat',
    icon: '⚔️',
    items: [{ id: 'diamond_sword', label: 'Diamond Sword', maxStack: 1 }],
  }])

  assert.equal(hydrated[0]?.items[0]?.imageUrl, '/api/minecraft/art/item/1.21.4/diamond_sword')
  assert.equal(hydrated[0]?.items[0]?.art, null)
})

test('hydrateCatalogWithArt keeps image and art metadata empty when the minecraft version is unresolved', () => {
  const hydrated = hydrateCatalogWithArt(null, [{
    id: 'combat',
    label: 'Combat',
    icon: '⚔️',
    items: [{ id: 'diamond_sword', label: 'Diamond Sword', maxStack: 1 }],
  }])

  assert.equal(hydrated[0]?.items[0]?.imageUrl, null)
  assert.equal(hydrated[0]?.items[0]?.art, null)
})
