/**
 * Demo state management with Zustand
 */

import { create } from "zustand";

interface Demo {
  id: string;
  filename: string;
  mapName?: string;
  status: string;
}

interface DemoState {
  // Current selected demo
  selectedDemo: Demo | null;
  setSelectedDemo: (demo: Demo | null) => void;

  // Demo list
  demos: Demo[];
  setDemos: (demos: Demo[]) => void;
  addDemo: (demo: Demo) => void;
  updateDemo: (id: string, updates: Partial<Demo>) => void;
  removeDemo: (id: string) => void;

  // Filters
  filters: {
    map?: string;
    status?: string;
    dateFrom?: Date;
    dateTo?: Date;
  };
  setFilters: (filters: Partial<DemoState["filters"]>) => void;
  clearFilters: () => void;

  // Pagination
  page: number;
  setPage: (page: number) => void;
  totalPages: number;
  setTotalPages: (totalPages: number) => void;
}

export const useDemoStore = create<DemoState>((set) => ({
  // Current selected demo
  selectedDemo: null,
  setSelectedDemo: (demo) => set({ selectedDemo: demo }),

  // Demo list
  demos: [],
  setDemos: (demos) => set({ demos }),
  addDemo: (demo) => set((state) => ({ demos: [demo, ...state.demos] })),
  updateDemo: (id, updates) =>
    set((state) => ({
      demos: state.demos.map((d) => (d.id === id ? { ...d, ...updates } : d)),
    })),
  removeDemo: (id) =>
    set((state) => ({
      demos: state.demos.filter((d) => d.id !== id),
    })),

  // Filters
  filters: {},
  setFilters: (filters) =>
    set((state) => ({ filters: { ...state.filters, ...filters } })),
  clearFilters: () => set({ filters: {} }),

  // Pagination
  page: 1,
  setPage: (page) => set({ page }),
  totalPages: 1,
  setTotalPages: (totalPages) => set({ totalPages }),
}));
