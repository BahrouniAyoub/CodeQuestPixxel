import { create } from "zustand";

interface FileSessionState {
  filePath: string | null;
  dirty: boolean;
  openFile: (path: string) => boolean;
  closeFile: () => boolean;
  setDirty: (dirty: boolean) => void;
}

function allowDiscard(path: string | null, dirty: boolean): boolean {
  return !path || !dirty || window.confirm(
    `You have unsaved changes in ${path}. Discard them?`
  );
}

export const useFileSession = create<FileSessionState>((set, get) => ({
  filePath: null,
  dirty: false,
  openFile: (path) => {
    const current = get();
    if (current.filePath === path) return true;
    if (!allowDiscard(current.filePath, current.dirty)) return false;
    set({ filePath: path, dirty: false });
    return true;
  },
  closeFile: () => {
    const current = get();
    if (!allowDiscard(current.filePath, current.dirty)) return false;
    set({ filePath: null, dirty: false });
    return true;
  },
  setDirty: (dirty) => set({ dirty }),
}));
