import { request } from "./api";
import type { WorkflowData } from "./workflow-model";
const path = (warehouse: string) =>
  `/api/workspaces/${encodeURIComponent(warehouse)}/workflow`;
export const workflowRead = (
  warehouse: string,
  query: Record<string, string | number>,
  signal?: AbortSignal,
) =>
  request<WorkflowData>(
    `${path(warehouse)}?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`,
    undefined,
    undefined,
    true,
    signal,
  );
export const workflowDrafts = (warehouse: string, page = 1) =>
  request<any>(`${path(warehouse)}/drafts?page=${page}`);
export const workflowDraft = (warehouse: string, id: string) =>
  request<any>(`${path(warehouse)}/drafts/${id}`);
export const saveWorkflowDraft = (
  warehouse: string,
  id: string,
  version: number,
  data: unknown,
) => request<any>(`${path(warehouse)}/drafts/${id}`, { version, data });
export const proposeItem = (warehouse: string, id: string, data: unknown) =>
  request<any>(`${path(warehouse)}/proposals/${id}`, data);
export const reviewItemProposal = (
  warehouse: string,
  id: string,
  version: number,
  data: unknown,
) =>
  request<any>(`${path(warehouse)}/proposals/${id}/review`, { version, data });
