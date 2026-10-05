const memoryStore = new Map<string, string>();

export function getSafeStorage(): Storage | null {
  if (typeof globalThis === "undefined") return null;

  const existing = (globalThis as typeof globalThis & { localStorage?: Storage | undefined }).localStorage;
  if (existing && typeof existing.getItem === "function" && typeof existing.setItem === "function") {
    return existing;
  }

  const storage: Storage = {
    get length() {
      return memoryStore.size;
    },
    clear() {
      memoryStore.clear();
    },
    getItem(key: string) {
      return memoryStore.has(key) ? memoryStore.get(key)! : null;
    },
    key(index: number) {
      return Array.from(memoryStore.keys())[index] ?? null;
    },
    removeItem(key: string) {
      memoryStore.delete(key);
    },
    setItem(key: string, value: string) {
      memoryStore.set(key, String(value));
    },
  };

  return storage;
}
