type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
  clear: () => void
  key: (index: number) => string | null
  length: number
}

function createStorageShim(): StorageLike {
  const values = new Map<string, string>()

  return {
    getItem(key: string) {
      return values.has(key) ? values.get(key)! : null
    },
    setItem(key: string, value: string) {
      values.set(key, value)
    },
    removeItem(key: string) {
      values.delete(key)
    },
    clear() {
      values.clear()
    },
    key(index: number) {
      return Array.from(values.keys())[index] ?? null
    },
    get length() {
      return values.size
    },
  }
}

export function ensureSafeBrowserStorage(): void {
  if (typeof window === "undefined") return

  try {
    const storage = window.localStorage as Partial<StorageLike> | undefined

    // If localStorage exists but is not interface-compatible, shim it.
    const isUsable =
      typeof (storage as any)?.getItem === "function" &&
      typeof (storage as any)?.setItem === "function" &&
      typeof (storage as any)?.removeItem === "function"

    if (isUsable) return

    const shim = createStorageShim()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      enumerable: true,
      value: shim,
      writable: true,
    })
  } catch {
    // Ignore environments where localStorage cannot be redefined.
  }
}
