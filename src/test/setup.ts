import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * Node 22+ expõe um `localStorage`/`sessionStorage` experimental no escopo
 * global que só funciona com a flag `--localstorage-file`. Sem a flag o valor
 * chega como `undefined` e sombreia a implementação do jsdom, derrubando
 * qualquer teste que chame `localStorage.clear()`.
 *
 * O polyfill abaixo garante uma implementação de Storage sempre utilizável,
 * tanto em `window` quanto no global, independentemente da versão do Node.
 */
function createStorage(): Storage {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store = new Map();
    },
    getItem(key: string) {
      return store.has(String(key)) ? store.get(String(key))! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(String(key));
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value));
    },
  } satisfies Storage;
}

function installStorage(name: "localStorage" | "sessionStorage") {
  const existing = (window as unknown as Record<string, unknown>)[name];
  const usable = existing && typeof (existing as Storage).clear === "function";
  const storage = usable ? existing as Storage : createStorage();

  for (const target of [window, globalThis]) {
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: storage,
    });
  }
}

installStorage("localStorage");
installStorage("sessionStorage");
