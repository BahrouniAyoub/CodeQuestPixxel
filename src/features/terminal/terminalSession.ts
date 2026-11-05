import { create } from "zustand";

interface TerminalSession {
  pendingPath: string | null;
  openFile: (path: string) => void;
  consume: () => void;
}

export const useTerminalSession = create<TerminalSession>((set) => ({
  pendingPath: null,
  openFile: (path) => set({ pendingPath: path }),
  consume: () => set({ pendingPath: null }),
}));
