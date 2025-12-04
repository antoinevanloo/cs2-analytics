/**
 * Custom hooks for demo data fetching
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { demosApi } from "@/lib/api";

export function useDemo(id: string) {
  return useQuery({
    queryKey: ["demo", id],
    queryFn: () => demosApi.get(id),
    enabled: !!id,
  });
}

export function useDemoStatus(id: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["demo-status", id],
    queryFn: () => demosApi.getStatus(id),
    enabled: !!id && enabled,
    refetchInterval: (query) => {
      // Poll while parsing
      if (query.state.data?.status === "parsing") {
        return 2000;
      }
      return false;
    },
  });
}

export function useDemoEvents(
  id: string,
  filters?: { type?: string; round?: number },
) {
  return useQuery({
    queryKey: ["demo-events", id, filters],
    queryFn: () => demosApi.getEvents(id, filters),
    enabled: !!id,
  });
}

export function useDemoRounds(id: string) {
  return useQuery({
    queryKey: ["demo-rounds", id],
    queryFn: () => demosApi.getRounds(id),
    enabled: !!id,
  });
}

export function useDemoPlayers(id: string) {
  return useQuery({
    queryKey: ["demo-players", id],
    queryFn: () => demosApi.getPlayers(id),
    enabled: !!id,
  });
}

export function useDemoList(params?: {
  page?: number;
  limit?: number;
  map?: string;
}) {
  return useQuery({
    queryKey: ["demos", params],
    queryFn: () => demosApi.list(params),
  });
}

export function useUploadDemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => demosApi.upload(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["demos"] });
    },
  });
}

export function useParseDemo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      options,
    }: {
      id: string;
      options?: { extractTicks?: boolean; tickInterval?: number };
    }) => demosApi.parse(id, options),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["demo", variables.id] });
      queryClient.invalidateQueries({
        queryKey: ["demo-status", variables.id],
      });
    },
  });
}
