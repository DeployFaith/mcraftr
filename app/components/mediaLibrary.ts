'use client'

export type MediaAssetKind = 'sound' | 'music'

type MediaAssetRecord = {
  id: string
  kind: MediaAssetKind
  name: string
  mime: string
  blob: Blob
  createdAt: number
}

const DB_NAME = 'mcraftr-media-library'
const STORE_NAME = 'assets'
const DB_VERSION = 1

const objectUrlCache = new Map<string, string>()

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Failed to open media library'))
  })
}

export async function saveUploadedFiles(kind: MediaAssetKind, files: File[]) {
  if (typeof window === 'undefined' || files.length === 0) return []
  const db = await openDb()

  return await Promise.all(files.map(file => new Promise<{ id: string; label: string }>((resolve, reject) => {
    const id = crypto.randomUUID()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const record: MediaAssetRecord = {
      id,
      kind,
      name: file.name,
      mime: file.type || 'audio/ogg',
      blob: file,
      createdAt: Date.now(),
    }
    store.put(record)
    tx.oncomplete = () => resolve({ id, label: file.name })
    tx.onerror = () => reject(tx.error ?? new Error('Failed to save uploaded media'))
  })))
}

export async function getUploadedFileUrl(id: string) {
  if (typeof window === 'undefined') return null
  if (objectUrlCache.has(id)) return objectUrlCache.get(id) ?? null

  const db = await openDb()
  return await new Promise<string | null>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const request = store.get(id)
    request.onsuccess = () => {
      const record = request.result as MediaAssetRecord | undefined
      if (!record) return resolve(null)
      const url = URL.createObjectURL(record.blob)
      objectUrlCache.set(id, url)
      resolve(url)
    }
    request.onerror = () => reject(request.error ?? new Error('Failed to load uploaded media'))
  })
}

export async function deleteUploadedFile(id: string) {
  if (typeof window === 'undefined') return
  const cached = objectUrlCache.get(id)
  if (cached) {
    URL.revokeObjectURL(cached)
    objectUrlCache.delete(id)
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error ?? new Error('Failed to delete uploaded media'))
  })
}
