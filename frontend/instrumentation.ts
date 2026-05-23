/**
 * Next.js Instrumentation File
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * This file runs ONCE when the Next.js server starts, before any request
 * handling. We use it to patch the Node.js global `localStorage` that
 * Next.js 15 injects as a partial mock for SSR of client components.
 *
 * Problem: Next.js 15 injects `window`/`localStorage` globals into the SSR
 * environment so that "use client" components can be pre-rendered on the
 * server. However, the injected `localStorage` object has non-function
 * `getItem`/`setItem` stubs (the --localstorage-file flag with an invalid
 * path), causing:
 *   TypeError: localStorage.getItem is not a function
 *
 * This crash originates inside Next.js's own dev overlay component, which
 * calls `localStorage.getItem(...)` inside a `useState()` initializer
 * (i.e. at render time, not in useEffect) after checking only
 * `typeof localStorage !== 'undefined'` — which is TRUE in the SSR env.
 *
 * Fix: replace the broken stub with a proper in-memory implementation before
 * any component renders.
 */
export async function register() {
  // Only patch in the Node.js runtime (SSR). The edge runtime and browser
  // handle their own storage correctly.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    patchNodeLocalStorage();
  }
}

function patchNodeLocalStorage() {
  // If localStorage is already a proper Storage-like object, leave it alone.
  const existing = (globalThis as any).localStorage;
  if (
    existing &&
    typeof existing.getItem === "function" &&
    typeof existing.setItem === "function"
  ) {
    return;
  }

  // Install a proper in-memory localStorage shim.
  // This satisfies `typeof localStorage !== 'undefined'` checks AND makes
  // getItem/setItem callable, so Next.js's dev overlay no longer crashes.
  const store = new Map<string, string>();

  const shim: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, String(value)); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  };

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: shim,
  });
}