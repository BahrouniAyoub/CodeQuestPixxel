import { create } from "zustand";

export interface BrowserNavigationRequest {
  readonly id: number;
  readonly address: string;
}

interface BrowserNavigationIntentState {
  readonly request: BrowserNavigationRequest | null;
  requestNavigation: (address: string) => void;
  consumeNavigation: () => void;
}

/**
 * In-memory handoff from PixelOS launch surfaces to the simulated Browser.
 * It is deliberately not persisted: an unclaimed request lives only until the
 * Browser mounts or observes it, and is consumed exactly once by BrowserApp.
 */
export const useBrowserNavigationIntent = create<BrowserNavigationIntentState>((set) => ({
  request: null,
  requestNavigation: (address) =>
    set((state) => ({
      request: {
        id: (state.request?.id ?? 0) + 1,
        address,
      },
    })),
  consumeNavigation: () => set({ request: null }),
}));
