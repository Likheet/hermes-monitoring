/**
 * Legacy stub preserved to prevent reintroducing the retired worker notes feature.
 * Any new usage should be removed instead of relying on this hook.
 */
export type WorkerNote = never

export function useWorkerNotes(): never {
  throw new Error("worker_notes feature has been retired; remove useWorkerNotes() usage from your code.")
}
