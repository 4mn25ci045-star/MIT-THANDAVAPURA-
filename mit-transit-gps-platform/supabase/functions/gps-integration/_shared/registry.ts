import { readTraccarPosition } from "./traccar.ts";
import type { ProviderAdapter } from "./types.ts";

const adapters: Record<string, ProviderAdapter> = {
  traccar: {
    id: "traccar",
    name: "Traccar",
    readPosition: readTraccarPosition,
  },
};

export function getProviderAdapter(id: string): ProviderAdapter | undefined {
  return adapters[id];
}

export function listProviderAdapters() {
  return Object.values(adapters).map(({ id, name }) => ({ id, name }));
}
