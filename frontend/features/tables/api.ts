import type {
  CreateTableSchema,
  Table,
  UpdateTableSchema,
} from "@plateflow/shared"
import { apiRequest } from "@/lib/api-client"

export type { Table }
export type CreateTableInput = CreateTableSchema["body"]
export type UpdateTableInput = UpdateTableSchema["body"]

// Staff-only, like the rest of this feature: the endpoint requires an
// OWNER/MANAGER session (enforced server-side).
export function listTables(): Promise<Table[]> {
  return apiRequest<Table[]>("/tables")
}

export function createTable(input: CreateTableInput): Promise<Table> {
  return apiRequest<Table>("/tables", { method: "POST", body: input })
}

export function updateTable(
  id: string,
  input: UpdateTableInput
): Promise<Table> {
  return apiRequest<Table>(`/tables/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: input,
  })
}

export function deleteTable(id: string): Promise<void> {
  return apiRequest<void>(`/tables/${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
}
