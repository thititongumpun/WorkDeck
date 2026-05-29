import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  CreateProjectInput,
  CreateResourceInput,
  Project,
  UpdateProjectInput,
  UpdateResourceInput,
} from "../domain/workspace";
import { getProjectRepository } from "../repositories/projectRepository";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjectRepository().getAll(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => getProjectRepository().create(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useReplaceWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projects: Project[]) => getProjectRepository().replaceAll(projects),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectInput) => getProjectRepository().update(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => getProjectRepository().delete(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useAddResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateResourceInput) => getProjectRepository().addResource(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateResourceInput) => getProjectRepository().updateResource(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteResource() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => getProjectRepository().deleteResource(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => getProjectRepository().search(query),
    enabled: query.trim().length > 0,
  });
}
