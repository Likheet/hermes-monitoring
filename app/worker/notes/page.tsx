"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/protected-route"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { ArrowLeft, Trash2, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatDistanceToNow } from "@/lib/date-utils"
import { useWorkerNotes, type WorkerNote } from "@/hooks/use-worker-notes"

function NotesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const {
    notes,
    loading: notesLoading,
    error: notesError,
    createNote,
    updateNote,
    deleteNote,
  } = useWorkerNotes(user?.id)
  const [editingNote, setEditingNote] = useState<WorkerNote | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  useEffect(() => {
    if (notesError) {
      console.error("[notes] Failed to load worker notes:", notesError)
      toast({
        title: "Notes unavailable",
        description: "We could not load your notes from the server. Please try again.",
        variant: "destructive",
      })
    }
  }, [notesError, toast])

  const handleSaveNote = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Error",
        description: "Please enter both title and content",
        variant: "destructive",
      })
      return
    }

    try {
      setNoteSubmitting(true)
      if (editingNote) {
        await updateNote(editingNote.id, { title, content })
        toast({ title: "Note updated successfully" })
      } else {
        await createNote({ title, content })
        toast({ title: "Note created successfully" })
      }

      setTitle("")
      setContent("")
      setEditingNote(null)
    } catch (error) {
      console.error("[notes] Failed to save note:", error)
      toast({
        title: "Unable to save note",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setNoteSubmitting(false)
    }
  }

  const handleEditNote = (note: WorkerNote) => {
    setEditingNote(note)
    setTitle(note.title)
    setContent(note.content)
  }

  const handleDeleteNote = async (noteId: string) => {
    try {
      setNoteSubmitting(true)
      await deleteNote(noteId)
      if (editingNote?.id === noteId) {
        handleCancel()
      }
      toast({ title: "Note deleted" })
    } catch (error) {
      console.error("[notes] Failed to delete note:", error)
      toast({
        title: "Unable to delete note",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      })
    } finally {
      setNoteSubmitting(false)
    }
  }

  const handleCancel = () => {
    setTitle("")
    setContent("")
    setEditingNote(null)
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-20">
      <header className="border-b bg-background sticky top-0 z-10">
        <div className="container mx-auto flex items-center gap-4 px-4 py-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/worker")} className="md:hidden">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">My Notes</h1>
            <p className="text-sm text-muted-foreground">{notes.length} notes</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Note Editor */}
        <Card>
          <CardHeader>
            <CardTitle>{editingNote ? "Edit Note" : "New Note"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Note title..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-lg font-medium"
            />
            <Textarea
              placeholder="Write your note here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button onClick={handleSaveNote} className="flex-1" disabled={noteSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {noteSubmitting ? "Saving..." : editingNote ? "Update Note" : "Save Note"}
              </Button>
              {editingNote && (
                <Button variant="outline" onClick={handleCancel} disabled={noteSubmitting}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        <div className="space-y-4">
          {notesLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading notes...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No notes yet. Create your first note above!</p>
            </div>
          ) : (
            notes.map((note) => (
              <Card key={note.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg mb-1">{note.title}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Updated {formatDistanceToNow(note.updated_at)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEditNote(note)}>
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  )
}

export default function NotesPageWrapper() {
  return (
    <ProtectedRoute allowedRoles={["worker", "front_office"]}>
      <NotesPage />
    </ProtectedRoute>
  )
}
