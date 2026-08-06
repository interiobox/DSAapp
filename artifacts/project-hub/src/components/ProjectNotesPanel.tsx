import * as React from "react"
import { Pencil, Plus, StickyNote, Trash2, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import {
  getListProjectNotesQueryKey,
  useCreateProjectNote,
  useDeleteProjectNote,
  useListProjectNotes,
  useUpdateProjectNote,
} from "@workspace/api-client-react"

import { usePortalAuth } from "@/App"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"

export function ProjectNotesPanel({ projectName }: { projectName: string }) {
  const { user } = usePortalAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: notes, isLoading } = useListProjectNotes({ projectName })
  const createNote = useCreateProjectNote()
  const updateNote = useUpdateProjectNote()
  const deleteNote = useDeleteProjectNote()
  const [draft, setDraft] = React.useState("")
  const [editingId, setEditingId] = React.useState<number | null>(null)
  const [editingText, setEditingText] = React.useState("")

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: getListProjectNotesQueryKey({ projectName }) })
  }

  function showError(error: unknown) {
    toast({ title: "Note could not be saved", description: error instanceof Error ? error.message : "Please try again." })
  }

  function submitNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()
    if (!content) return
    createNote.mutate({ data: { projectName, content } }, {
      onSuccess: () => {
        setDraft("")
        refresh()
        toast({ title: "Project note added" })
      },
      onError: showError,
    })
  }

  function saveEdit(id: number) {
    const content = editingText.trim()
    if (!content) return
    updateNote.mutate({ id, data: { content } }, {
      onSuccess: () => {
        setEditingId(null)
        setEditingText("")
        refresh()
        toast({ title: "Project note updated" })
      },
      onError: showError,
    })
  }

  function removeNote(id: number) {
    if (!window.confirm("Move this project note to the recycle bin? You can restore it within 30 days.")) return
    deleteNote.mutate({ id }, {
      onSuccess: () => {
        refresh()
        toast({ title: "Project note moved to recycle bin" })
      },
      onError: showError,
    })
  }

  return (
    <div className="mt-4 border-t pt-4" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote className="h-4 w-4 text-primary" />
          Project notes
          <Badge variant="outline">{notes?.length ?? 0}</Badge>
        </div>
        <span className="text-[11px] font-normal text-muted-foreground">Shared with the project team</span>
      </div>
      <form onSubmit={submitNote} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a note for this project..."
          className="min-h-[58px] resize-none bg-background text-sm"
          maxLength={2000}
        />
        <Button type="submit" size="sm" className="shrink-0 sm:h-9" disabled={!draft.trim() || createNote.isPending}>
          <Plus className="mr-1.5 h-4 w-4" />Add note
        </Button>
      </form>
      <div className="mt-3 space-y-2">
        {isLoading ? <p className="text-xs text-muted-foreground">Loading notes...</p> : notes?.length ? notes.map((note) => {
          const canManage = user?.role === "admin" || user?.id === note.authorId
          return (
            <div key={note.id} className="rounded-md border bg-background/80 p-3 text-left">
              {editingId === note.id ? (
                <div className="space-y-2">
                  <Textarea value={editingText} onChange={(event) => setEditingText(event.target.value)} className="min-h-[70px] resize-none text-sm" maxLength={2000} autoFocus />
                  <div className="flex justify-end gap-2">
                    <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingText("") }}><X className="mr-1.5 h-3.5 w-3.5" />Cancel</Button>
                    <Button type="button" size="sm" onClick={() => saveEdit(note.id)} disabled={!editingText.trim() || updateNote.isPending}>Save</Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{note.authorName} · {formatDate(note.updatedAt)}</span>
                    {canManage && <span className="flex items-center gap-1">
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingId(note.id); setEditingText(note.content) }}><Pencil className="mr-1 h-3 w-3" />Edit</Button>
                      <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => removeNote(note.id)} disabled={deleteNote.isPending}><Trash2 className="mr-1 h-3 w-3" />Recycle</Button>
                    </span>}
                  </div>
                </>
              )}
            </div>
          )
        }) : <p className="text-xs text-muted-foreground">No project notes yet. Add the first one for the team.</p>}
      </div>
    </div>
  )
}