import * as React from "react"
import { Link } from "wouter"
import { CheckCircle2, Clock3, FileText, History, ListTodo, Pencil, Plus, StickyNote, Trash2, X } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"

import {
  getListPersonalNotesQueryKey,
  useCreatePersonalNote,
  useDeletePersonalNote,
  useListActivity,
  useListDrawings,
  useListPersonalNotes,
  useUpdatePersonalNote,
} from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/utils"
import { usePortalAuth } from "@/App"
import { useToast } from "@/hooks/use-toast"

const progressForStatus = (status: string) => {
  if (status === "in_review") return 40
  if (status === "approved") return 70
  if (status === "issued" || status === "superseded") return 100
  return 0
}

const statusLabel = (status: string) => status === "superseded" ? "Archived" : status.replace("_", " ")

export default function MyFeed() {
  const { user } = usePortalAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: drawings, isLoading: drawingsLoading } = useListDrawings()
  const { data: activities, isLoading: activitiesLoading } = useListActivity()
  const { data: personalNotes, isLoading: personalNotesLoading } = useListPersonalNotes()
  const createPersonalNote = useCreatePersonalNote()
  const updatePersonalNote = useUpdatePersonalNote()
  const deletePersonalNote = useDeletePersonalNote()
  const displayName = user?.name || user?.username || "Signed-in user"
  const userId = user ? String(user.id) : undefined
  const assignedDrawings = (drawings ?? []).filter((drawing) => drawing.assignedTo === displayName)
  const activeDrawings = assignedDrawings.filter((drawing) => drawing.status !== "issued" && drawing.status !== "superseded")
  const completedDrawings = assignedDrawings.filter((drawing) => drawing.status === "issued" || drawing.status === "superseded")
  const myActivities = (activities ?? []).filter((activity) => activity.actor === userId)
  const [noteTitle, setNoteTitle] = React.useState("")
  const [noteContent, setNoteContent] = React.useState("")
  const [editingNoteId, setEditingNoteId] = React.useState<number | null>(null)
  const [editingTitle, setEditingTitle] = React.useState("")
  const [editingContent, setEditingContent] = React.useState("")

  function refreshPersonalNotes() {
    void queryClient.invalidateQueries({ queryKey: getListPersonalNotesQueryKey() })
  }

  function showNoteError(error: unknown) {
    toast({ title: "Personal note could not be saved", description: error instanceof Error ? error.message : "Please try again." })
  }

  function submitPersonalNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!noteContent.trim()) return
    createPersonalNote.mutate({ data: { title: noteTitle.trim() || undefined, content: noteContent.trim() } }, {
      onSuccess: () => {
        setNoteTitle("")
        setNoteContent("")
        refreshPersonalNotes()
        toast({ title: "Personal note added" })
      },
      onError: showNoteError,
    })
  }

  function savePersonalNote(id: number) {
    if (!editingContent.trim()) return
    updatePersonalNote.mutate({ id, data: { title: editingTitle.trim() || undefined, content: editingContent.trim() } }, {
      onSuccess: () => {
        setEditingNoteId(null)
        setEditingTitle("")
        setEditingContent("")
        refreshPersonalNotes()
        toast({ title: "Personal note updated" })
      },
      onError: showNoteError,
    })
  }

  function removePersonalNote(id: number) {
    if (!window.confirm("Move this personal note to the recycle bin? You can restore it within 30 days.")) return
    deletePersonalNote.mutate({ id }, {
      onSuccess: () => {
        refreshPersonalNotes()
        toast({ title: "Personal note moved to recycle bin" })
      },
      onError: showNoteError,
    })
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your assigned work, completed work, and recent actions.</p>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          <Card className="bg-primary text-primary-foreground">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-primary-foreground/75">Signed in as</p>
                <p className="mt-1 text-xl font-semibold">{displayName}</p>
              </div>
              <div className="min-w-[190px]">
                <div className="flex justify-between text-xs text-primary-foreground/80">
                  <span>My active work</span>
                  <span>{activeDrawings.length} drawing{activeDrawings.length === 1 ? "" : "s"}</span>
                </div>
                <Progress value={assignedDrawings.length ? Math.round((completedDrawings.length / assignedDrawings.length) * 100) : 0} className="mt-2 bg-primary-foreground/25 [&>div]:bg-primary-foreground" />
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base"><ListTodo className="h-4 w-4 text-primary" />Need to do <Badge variant="outline">{activeDrawings.length}</Badge></CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {drawingsLoading ? <div className="space-y-3 p-6"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : activeDrawings.length ? (
                  <div className="divide-y">
                    {activeDrawings.map((drawing) => (
                      <Link key={drawing.id} href={`/drawings/${drawing.id}`} className="block px-6 py-4 transition-colors hover:bg-muted/40">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{drawing.title}</p>
                          <Badge variant={drawing.status} className="capitalize">{statusLabel(drawing.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{drawing.projectName} · {progressForStatus(drawing.status)}% complete</p>
                      </Link>
                    ))}
                  </div>
                ) : <p className="p-6 text-sm text-muted-foreground">You have no active drawings assigned.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b">
                <CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-4 w-4 text-emerald-600" />Done <Badge variant="outline">{completedDrawings.length}</Badge></CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {completedDrawings.length ? (
                  <div className="divide-y">
                    {completedDrawings.map((drawing) => (
                      <Link key={drawing.id} href={`/drawings/${drawing.id}`} className="block px-6 py-4 transition-colors hover:bg-muted/40">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{drawing.title}</p>
                          <Badge variant={drawing.status} className="capitalize">{statusLabel(drawing.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{drawing.projectName} · Complete</p>
                      </Link>
                    ))}
                  </div>
                ) : <p className="p-6 text-sm text-muted-foreground">Completed assignments will appear here.</p>}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base"><History className="h-4 w-4 text-primary" />What I did <Badge variant="outline">{myActivities.length}</Badge></CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {activitiesLoading ? <div className="space-y-3 p-6"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div> : myActivities.length ? (
                <div className="divide-y">
                  {myActivities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3 px-6 py-4">
                      {activity.type === "drawing_uploaded" ? <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0">
                        <p className="text-sm">{activity.message}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatDate(activity.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="p-6 text-sm text-muted-foreground">Your recent uploads, comments, assignments, and updates will appear here.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="h-4 w-4 text-primary" />My personal notes <Badge variant="outline">{personalNotes?.length ?? 0}</Badge></CardTitle>
              <p className="text-sm text-muted-foreground">Private notes only visible to you. You can edit or move your own notes to the recycle bin anytime.</p>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
              <form onSubmit={submitPersonalNote} className="space-y-2 rounded-lg border bg-muted/20 p-3">
                <div className="grid gap-2 sm:grid-cols-[minmax(0,220px)_1fr]">
                  <Input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="Title (optional)" maxLength={120} />
                  <Textarea value={noteContent} onChange={(event) => setNoteContent(event.target.value)} placeholder="Write a private note..." className="min-h-[72px] resize-none" maxLength={4000} />
                </div>
                <div className="flex justify-end"><Button type="submit" size="sm" disabled={!noteContent.trim() || createPersonalNote.isPending}><Plus className="mr-1.5 h-4 w-4" />Add personal note</Button></div>
              </form>
              {personalNotesLoading ? <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div> : personalNotes?.length ? (
                <div className="space-y-3">
                  {personalNotes.map((note) => editingNoteId === note.id ? (
                    <div key={note.id} className="space-y-2 rounded-lg border p-3">
                      <Input value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} placeholder="Title (optional)" maxLength={120} />
                      <Textarea value={editingContent} onChange={(event) => setEditingContent(event.target.value)} className="min-h-[90px] resize-none" maxLength={4000} autoFocus />
                      <div className="flex justify-end gap-2"><Button type="button" size="sm" variant="ghost" onClick={() => { setEditingNoteId(null); setEditingTitle(""); setEditingContent("") }}><X className="mr-1.5 h-3.5 w-3.5" />Cancel</Button><Button type="button" size="sm" onClick={() => savePersonalNote(note.id)} disabled={!editingContent.trim() || updatePersonalNote.isPending}>Save</Button></div>
                    </div>
                  ) : (
                    <div key={note.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{note.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{note.content}</p></div><div className="flex shrink-0 gap-1"><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingNoteId(note.id); setEditingTitle(note.title); setEditingContent(note.content) }}><Pencil className="mr-1 h-3 w-3" />Edit</Button><Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive" onClick={() => removePersonalNote(note.id)} disabled={deletePersonalNote.isPending}><Trash2 className="mr-1 h-3 w-3" />Recycle</Button></div></div>
                      <p className="mt-2 text-xs text-muted-foreground">Updated {formatDate(note.updatedAt)}</p>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">No personal notes yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}