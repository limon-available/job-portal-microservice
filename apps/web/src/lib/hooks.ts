"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type ApiEnvelope } from "@/lib/api";

export function useApiQuery<T>(key: readonly unknown[], path: string, params?: object) {
  return useQuery({
    queryKey: [...key, params],
    queryFn: async () => (await api.get<ApiEnvelope<T>>(path, { params })).data.data,
  });
}

export function useApiMutation<TVariables = unknown, TResult = unknown>(
  method: "post" | "put" | "patch" | "delete",
  path: string | ((variables: TVariables) => string),
  invalidate: readonly (readonly unknown[])[] = [],
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (variables: TVariables) => {
      const url = typeof path === "string" ? path : path(variables);
      const response = method === "delete"
        ? await api.delete<ApiEnvelope<TResult>>(url)
        : await api[method]<ApiEnvelope<TResult>>(url, variables);
      return response.data.data;
    },
    onSuccess: async () => {
      await Promise.all(invalidate.map((queryKey) =>
        queryClient.invalidateQueries({ queryKey: [...queryKey] }),
      ));
    },
  });
}
