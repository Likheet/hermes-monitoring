import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

export interface WorkerNote {
  id: string
  title: string
  content: string
  created_at: Date
  updated_at: Date
}

interface WorkerNoteRecord {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

const STORAGE_KEY_PREFIX = "worker-notes"

const mapRecordToNote = (record: WorkerNoteRecord): WorkerNote => ({
  id: record.id,
  title: record.title,
  content: record.content,
  created_at: new Date(record.created_at),
  updated_at: new Date(record.updated_at),
})

const sortNotesByUpdatedAt = (notes: WorkerNote[]) =>
  [...notes].sort((a, b) => b.updated_at.getTime() - a.updated_at.getTime())

function buildStorageKey(userId: string | undefined) {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX
}

function loadLocalNotes(userId: string | undefined): WorkerNote[] {
  try {
    const raw = localStorage.getItem(buildStorageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as Array<Omit<WorkerNote, "created_at" | "updated_at"> & { created_at: string; updated_at: string }>
    return parsed.map((note) => ({
      ...note,
      created_at: new Date(note.created_at),
      updated_at: new Date(note.updated_at),
    }))
  } catch (error) {
    console.warn("[notes] Failed to restore local notes:", error)
    return []
  }
}

function persistLocalNotes(userId: string | undefined, notes: WorkerNote[]) {
  try {
    const payload = notes.map((note) => ({
      ...note,
      created_at: note.created_at.toISOString(),
      updated_at: note.updated_at.toISOString(),
    }))
    localStorage.setItem(buildStorageKey(userId), JSON.stringify(payload))
  } catch (error) {
    console.warn("[notes] Failed to persist local notes:", error)
  }
}

export function useWorkerNotes(userId?: string) {
  const supabase = useMemo(() => createClient(), [])
  const [notes, setNotes] = useState<WorkerNote[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const loadNotes = useCallback(async () => {
    if (!userId) {
      setNotes([])
      setLoading(false)
      return
    }

    // Always hydrate from local storage immediately for responsiveness.
    const localSnapshot = loadLocalNotes(userId)
    if (localSnapshot.length > 0) {
      setNotes(sortNotesByUpdatedAt(localSnapshot))
    }

    setLoading(true)
    setError(null)
    try {
      const { data, error: queryError } = await supabase
        .from("worker_notes")
        .select("id, title, content, created_at, updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })

      if (queryError) {
        throw new Error(queryError.message)
      }

      if (isMountedRef.current) {
        const mapped = (data ?? []).map(mapRecordToNote)
        setNotes(mapped)
        persistLocalNotes(userId, mapped)
      }
    } catch (loadError) {
      if (isMountedRef.current) {
        const message = loadError instanceof Error ? loadError.message : String(loadError)
        setError(message)
        // Fall back to whatever we have locally (already loaded above).
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false)
      }
    }
  }, [supabase, userId])

  useEffect(() => {
    void loadNotes()
  }, [loadNotes])

  const createNote = useCallback(
    async (payload: { title: string; content: string }) => {
      if (!userId) {
        throw new Error("User id is required before creating notes")
      }

      const trimmedTitle = payload.title.trim()
      const trimmedContent = payload.content.trim()

      if (!trimmedTitle || !trimmedContent) {
        throw new Error("Both title and content are required")
      }

      const nowIso = new Date().toISOString()

      const { data, error: insertError } = await supabase
        .from("worker_notes")
        .insert({
          user_id: userId,
          title: trimmedTitle,
          content: trimmedContent,
          created_at: nowIso,
          updated_at: nowIso,
        })
        .select("id, title, content, created_at, updated_at")
        .single()

      if (insertError) {
        throw new Error(insertError.message)
      }

      const note = mapRecordToNote(data as WorkerNoteRecord)
      setNotes((prev) => {
        const next = sortNotesByUpdatedAt([note, ...prev])
        persistLocalNotes(userId, next)
        return next
      })
      return note
    },
    [supabase, userId],
  )

  const updateNote = useCallback(
    async (noteId: string, payload: { title: string; content: string }) => {
      if (!userId) {
        throw new Error("User id is required before updating notes")
      }

      const trimmedTitle = payload.title.trim()
      const trimmedContent = payload.content.trim()

      if (!trimmedTitle || !trimmedContent) {
        throw new Error("Both title and content are required")
      }

      const nowIso = new Date().toISOString()

      const { data, error: updateError } = await supabase
        .from("worker_notes")
        .update({
          title: trimmedTitle,
          content: trimmedContent,
          updated_at: nowIso,
        })
        .eq("id", noteId)
        .eq("user_id", userId)
        .select("id, title, content, created_at, updated_at")
        .single()

      if (updateError) {
        throw new Error(updateError.message)
      }

      const updated = mapRecordToNote(data as WorkerNoteRecord)
      setNotes((prev) => {
        const filtered = prev.filter((note) => note.id !== noteId)
        const next = sortNotesByUpdatedAt([updated, ...filtered])
        persistLocalNotes(userId, next)
        return next
      })
      return updated
    },
    [supabase, userId],
  )

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!userId) {
        throw new Error("User id is required before deleting notes")
      }

      const { error: deleteError } = await supabase
        .from("worker_notes")
        .delete()
        .eq("id", noteId)
        .eq("user_id", userId)

      if (deleteError) {
        throw new Error(deleteError.message)
      }

      setNotes((prev) => {
        const next = prev.filter((note) => note.id !== noteId)
        persistLocalNotes(userId, next)
        return next
      })
    },
    [supabase, userId],
  )

  return {
    notes,
    loading,
    error,
    refresh: loadNotes,
    createNote,
    updateNote,
    deleteNote,
  }
}
