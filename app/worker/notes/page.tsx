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

interface Note {
  id: string
  title: string
  content: string
  created_at: Date
  updated_at: Date
}

function NotesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { toast } = useToast()
  const [notes, setNotes] = useState<Note[]>([])
  const [editingNote, setEditingNote] = useState<Note | null>(null)
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")

  useEffect(() => {
    // Load notes from localStorage
    const savedNotes = localStorage.getItem(`notes_${user?.id}`)
    if (savedNotes) {
      const parsed = JSON.parse(savedNotes)
      setNotes(
        parsed.map((n: any) => ({ ...n, created_at: new Date(n.created_at), updated_at: new Date(n.updated_at) })),
      )
    }
  }, [user?.id])

  const saveNotes = (updatedNotes: Note[]) => {
    localStorage.setItem(`notes_${user?.id}`, JSON.stringify(updatedNotes))
    setNotes(updatedNotes)
  }

  const handleSaveNote = () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "Error",
        description: "Please enter both title and content",
        variant: "destructive",
      })
      return
    }

    if (editingNote) {
      // Update existing note
      const updatedNotes = notes.map((n) =>
        n.id === editingNote.id ? { ...n, title, content, updated_at: new Date() } : n,
      )
      saveNotes(updatedNotes)
      toast({ title: "Note updated successfully" })
    } else {
      // Create new note
      const newNote: Note = {
        id: `note-${Date.now()}`,
        title,
        content,
        created_at: new Date(),
        updated_at: new Date(),
      }
      saveNotes([newNote, ...notes])
      toast({ title: "Note created successfully" })
    }

    setTitle("")
    setContent("")
    setEditingNote(null)
  }

  const handleEditNote = (note: Note) => {
    setEditingNote(note)
    setTitle(note.title)
    setContent(note.content)
  }

  const handleDeleteNote = (noteId: string) => {
    const updatedNotes = notes.filter((n) => n.id !== noteId)
    saveNotes(updatedNotes)
    toast({ title: "Note deleted" })
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
              <Button onClick={handleSaveNote} className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                {editingNote ? "Update Note" : "Save Note"}
              </Button>
              {editingNote && (
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Notes List */}
        <div className="space-y-4">
          {notes.length === 0 ? (
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
                        Updated {formatDistanceToNow(note.updated_at, { addSuffix: true })}
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
    <ProtectedRoute allowedRoles={["worker"]}>
      <NotesPage />
    </ProtectedRoute>
  )
}
