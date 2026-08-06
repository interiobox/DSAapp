import * as React from "react"
import { Link } from "wouter"
import { Archive as ArchiveIcon, ArrowRight, CalendarDays, CheckCircle2, Clock3, FileText, FolderKanban, History, Pencil, RotateCcw, Search, SlidersHorizontal, Trash2 } from "lucide-react"

import { getListDrawingsQueryKey, getListProjectsQueryKey, getListRecycleBinQueryKey, useDeleteProject, useListActivity, useListDrawings, useListProjects, useListRecycleBin, useRestoreRecycleBinEntry, useUpdateProject } from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate, formatDateShort } from "@/lib/utils"
import { usePortalAuth } from "@/App"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"

const statusLabel = (status: string) => status === "superseded" ? "Archived" : status.replace("_", " ")
const statusTone = (status: string) => status === "approved" ? "bg-emerald-100 text-emerald-800 border-emerald-200" : status === "issued" ? "bg-blue-100 text-blue-800 border-blue-200" : status === "in_review" ? "bg-amber-100 text-amber-800 border-amber-200" : status === "superseded" ? "bg-slate-100 text-slate-700 border-slate-200" : ""

function PageHeader({ icon: Icon, title, description, children }: { icon: React.ElementType; title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="flex-none border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-6 shadow-sm sm:px-8 sm:py-8 z-10 sticky top-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-start gap-4">
          <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary border border-primary/20 shadow-sm">
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return <div className="flex flex-col items-center justify-center px-6 py-20 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-sm m-4 bg-muted/10"><Icon className="mb-4 h-10 w-10 opacity-30" /><p className="text-sm font-medium">{message}</p></div>
}

export function Projects() {
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: projects, isLoading: projectsLoading } = useListProjects()
  const { data: drawings, isLoading: drawingsLoading } = useListDrawings()
  const deleteProject = useDeleteProject()
  const updateProject = useUpdateProject()
  const [search, setSearch] = React.useState("")
  const [editingProject, setEditingProject] = React.useState<{ id: number; name: string } | null>(null)
  const [projectNameDraft, setProjectNameDraft] = React.useState("")
  const isAdmin = user?.role === "admin"
  const visibleProjects = (projects ?? []).filter((project) => project.name.toLowerCase().includes(search.toLowerCase()))
  const loading = projectsLoading || drawingsLoading
  function handleDeleteProject(event: React.MouseEvent, projectId: number, projectName: string) {
    event.preventDefault()
    event.stopPropagation()
    if (!window.confirm(`Move “${projectName}” to the recycle bin? Its drawings will be kept.`)) return
    deleteProject.mutate({ id: projectId }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        toast({ title: "Project moved to recycle bin", description: "Its drawings remain available for recovery." })
      },
      onError: (error) => toast({ title: "Project could not be moved to recycle bin", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }
  function handleUpdateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editingProject || !projectNameDraft.trim()) return
    updateProject.mutate({ id: editingProject.id, data: { name: projectNameDraft.trim() } }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        void queryClient.invalidateQueries({ queryKey: getListDrawingsQueryKey() })
        setEditingProject(null)
        toast({ title: "Project renamed" })
      },
      onError: (error) => toast({ title: "Project could not be renamed", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }
  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <PageHeader icon={FolderKanban} title="Projects" description="Project-level view of the drawing register." />
      <div className="flex-1 overflow-auto p-4 sm:p-8"><div className="mx-auto max-w-7xl space-y-6">
        <div className="relative max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9 rounded-sm bg-background border-border/80" placeholder="Search projects" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        {loading ? <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{[1, 2, 3, 4].map((item) => <Skeleton className="h-44 rounded-sm" key={item} />)}</div> : visibleProjects.length === 0 ? <EmptyState icon={FolderKanban} message="No projects match your search." /> : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleProjects.map((project) => {
            const projectDrawings = (drawings ?? []).filter((drawing) => drawing.projectName === project.name)
            const active = projectDrawings.filter((drawing) => drawing.status !== "issued" && drawing.status !== "superseded").length
            const review = projectDrawings.filter((drawing) => drawing.status === "in_review").length
            return <Card key={project.id} className="group h-full rounded-sm border-border/60 transition-all group-hover:border-primary/40 group-hover:shadow-md">
              <Link href={`/projects/${encodeURIComponent(project.name)}`} className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                <CardHeader className="border-b border-border/40 pb-4 bg-muted/20">
                  <CardTitle className="flex items-center justify-between gap-3 text-base">
                    <span className="truncate group-hover:text-primary transition-colors">{project.name}</span>
                    <Badge variant="outline" className="font-mono bg-background shadow-sm rounded-sm">{projectDrawings.length}</Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">Added {formatDateShort(project.createdAt)}</CardDescription>
                </CardHeader>
              </Link>
              <CardContent className="pt-5">
                  <div className="grid grid-cols-3 gap-3 text-center text-sm"><div><p className="font-bold font-mono text-lg">{active}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Active</p></div><div><p className="font-bold font-mono text-lg">{review}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Review</p></div><div><p className="font-bold font-mono text-lg">{projectDrawings.filter((drawing) => drawing.status === "issued").length}</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Issued</p></div></div>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/40 pt-4 text-xs font-semibold uppercase tracking-wider">
                      <Link href={`/projects/${encodeURIComponent(project.name)}`} className="flex items-center gap-1.5 text-primary hover:underline">
                        <span>Workspace</span><ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                      </Link>
                       {project.id > 0 && (
                         <div className="flex items-center gap-1.5">
                           <Button type="button" variant="ghost" size="sm" className="h-8 rounded-sm px-2 text-xs font-medium" onClick={() => { setEditingProject({ id: project.id, name: project.name }); setProjectNameDraft(project.name) }} disabled={updateProject.isPending} data-testid={`button-edit-project-${project.id}`}>
                             <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                           </Button>
                           {isAdmin && (
                             <Button type="button" variant="outline" size="sm" className="h-8 rounded-sm px-2 text-xs font-medium text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60" onClick={(event) => handleDeleteProject(event, project.id, project.name)} disabled={deleteProject.isPending} data-testid={`button-recycle-project-${project.id}`}>
                               <Trash2 className="mr-1.5 h-3.5 w-3.5" />Recycle
                             </Button>
                           )}
                         </div>
                       )}
                    </div>
                </CardContent>
            </Card>
          })}</div>
        )}
       </div>
       <Dialog open={Boolean(editingProject)} onOpenChange={(open) => { if (!open) setEditingProject(null) }}>
         <DialogContent className="rounded-sm">
           <DialogHeader>
             <DialogTitle>Edit project</DialogTitle>
             <DialogDescription>Rename this project without breaking its drawings, notes, contacts, or checklists.</DialogDescription>
           </DialogHeader>
           <form onSubmit={handleUpdateProject} className="space-y-4">
             <Input value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} placeholder="Project name" aria-label="Project name" autoFocus required />
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => setEditingProject(null)}>Cancel</Button>
               <Button type="submit" disabled={!projectNameDraft.trim() || updateProject.isPending}>{updateProject.isPending ? "Saving..." : "Save changes"}</Button>
             </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>
       </div>
    </div>
  )
}

export function ReviewQueue() {
  const { data: drawings, isLoading } = useListDrawings()
  const [project, setProject] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const projects = Array.from(new Set((drawings ?? []).map((drawing) => drawing.projectName))).sort()
  const queue = (drawings ?? []).filter((drawing) => (drawing.status === "in_review" || drawing.status === "approved") && (project === "all" || drawing.projectName === project) && `${drawing.title} ${drawing.drawingNumber} ${drawing.assignedTo ?? ""}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
  return <div className="flex h-full flex-1 flex-col overflow-hidden">
    <PageHeader icon={CheckCircle2} title="Review Queue" description="Drawings waiting for review, approval, or issue." />
    <div className="flex-1 overflow-auto p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9 rounded-sm bg-background border-border/80" placeholder="Search the queue" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={project} onValueChange={setProject}><SelectTrigger className="w-full sm:w-[240px] rounded-sm bg-background border-border/80"><SelectValue placeholder="All projects" /></SelectTrigger><SelectContent><SelectItem value="all">All projects</SelectItem>{projects.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
       <Card className="rounded-sm shadow-sm border-border/60"><CardHeader className="border-b border-border/40 bg-muted/20"><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="h-4 w-4 text-primary" />Active review items <Badge variant="outline" className="rounded-sm font-mono shadow-sm bg-background ml-auto">{queue.length}</Badge></CardTitle><CardDescription className="text-xs">Prioritized by due date, oldest first.</CardDescription></CardHeader><CardContent className="p-0">{isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-16 w-full rounded-sm" /><Skeleton className="h-16 w-full rounded-sm" /></div> : queue.length === 0 ? <EmptyState icon={CheckCircle2} message="The review queue is clear." /> : <div className="divide-y divide-border/50">{queue.map((drawing) => { const overdue = drawing.dueDate && drawing.dueDate < new Date().toISOString().slice(0, 10); return <Link href={`/drawings/${drawing.id}`} key={drawing.id} className="flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:justify-between group"><div className="min-w-0"><p className="truncate font-medium group-hover:text-primary transition-colors">{drawing.title}</p><p className="mt-1 text-xs text-muted-foreground font-mono">{drawing.drawingNumber} · {drawing.projectName} · {drawing.discipline}</p></div><div className="flex shrink-0 items-center gap-4"><Badge variant="outline" className={`capitalize rounded-sm shadow-sm ${statusTone(drawing.status)}`}>{statusLabel(drawing.status)}</Badge><span className={`text-xs font-mono font-medium ${overdue ? "text-destructive" : "text-muted-foreground"}`}>{overdue ? "OVERDUE · " : ""}{drawing.dueDate ? formatDateShort(drawing.dueDate) : "No due date"}</span></div></Link> })}</div>}</CardContent></Card>
    </div></div>
  </div>
}

export function Activity() {
  const { data: activities, isLoading } = useListActivity()
  const { data: drawings } = useListDrawings()
  const [filter, setFilter] = React.useState("all")
  const [search, setSearch] = React.useState("")
  const types = Array.from(new Set((activities ?? []).map((activity) => activity.type))).sort()
  const drawingById = new Map((drawings ?? []).map((drawing) => [drawing.id, drawing]))
  const visible = (activities ?? []).filter((item) => (filter === "all" || item.type === filter) && item.message.toLowerCase().includes(search.toLowerCase()))
  return <div className="flex h-full flex-1 flex-col overflow-hidden">
    <PageHeader icon={History} title="Activity" description="The shared audit trail for drawing-library changes." />
    <div className="flex-1 overflow-auto p-4 sm:p-8"><div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1 sm:max-w-md"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9 rounded-sm bg-background border-border/80" placeholder="Search activity" value={search} onChange={(event) => setSearch(event.target.value)} /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger className="w-full sm:w-[240px] rounded-sm bg-background border-border/80"><SlidersHorizontal className="mr-2 h-4 w-4" /><SelectValue placeholder="All activity" /></SelectTrigger><SelectContent><SelectItem value="all">All activity</SelectItem>{types.map((type) => <SelectItem key={type} value={type} className="capitalize">{type.replaceAll("_", " ")}</SelectItem>)}</SelectContent></Select></div>
      <Card className="rounded-sm shadow-sm border-border/60"><CardContent className="p-0">{isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-16 w-full rounded-sm" /><Skeleton className="h-16 w-full rounded-sm" /></div> : visible.length === 0 ? <EmptyState icon={History} message="No activity matches these filters." /> : <div className="divide-y divide-border/50">{visible.map((item) => <div key={item.id} className="flex gap-4 px-6 py-5 transition-colors hover:bg-muted/30"><div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary/80 shadow-[0_0_8px_rgba(var(--primary),0.5)]" /><div className="min-w-0"><p className="text-sm font-medium text-foreground/90">{item.message}</p><p className="mt-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{item.actor ? `User: ${item.actor}` : "System"} · {formatDate(item.createdAt)}{item.drawingId && drawingById.has(item.drawingId) ? <span> · Ref: <Link className="text-primary hover:underline font-semibold" href={`/drawings/${item.drawingId}`}>{drawingById.get(item.drawingId)?.drawingNumber}</Link></span> : null}</p></div></div>)}</div>}</CardContent></Card>
    </div></div>
  </div>
}

export function Deadlines() {
  const { data: drawings, isLoading } = useListDrawings()
  const [scope, setScope] = React.useState("upcoming")
  const today = new Date().toISOString().slice(0, 10)
  const items = (drawings ?? []).filter((drawing): drawing is typeof drawing & { dueDate: string } => Boolean(drawing.dueDate) && (scope === "all" || (scope === "overdue" ? drawing.dueDate! < today : drawing.dueDate! >= today))).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  return <div className="flex h-full flex-1 flex-col overflow-hidden">
    <PageHeader icon={CalendarDays} title="Deadlines" description="Upcoming due dates and issue milestones across the register." />
    <div className="flex-1 overflow-auto p-4 sm:p-8"><div className="mx-auto max-w-4xl space-y-6">
      <div className="flex gap-2 p-1 bg-muted/40 rounded-sm w-fit border border-border/40"><Button size="sm" variant={scope === "upcoming" ? "default" : "ghost"} className="rounded-sm text-xs font-semibold" onClick={() => setScope("upcoming")}>Upcoming</Button><Button size="sm" variant={scope === "overdue" ? "destructive" : "ghost"} className="rounded-sm text-xs font-semibold" onClick={() => setScope("overdue")}>Overdue</Button><Button size="sm" variant={scope === "all" ? "default" : "ghost"} className="rounded-sm text-xs font-semibold" onClick={() => setScope("all")}>All deadlines</Button></div>
      <Card className="rounded-sm shadow-sm border-border/60"><CardContent className="p-0">{isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-16 w-full rounded-sm" /><Skeleton className="h-16 w-full rounded-sm" /></div> : items.length === 0 ? <EmptyState icon={CalendarDays} message={scope === "overdue" ? "No overdue drawings." : "No deadlines in this view."} /> : <div className="divide-y divide-border/50">{items.map((drawing) => <Link href={`/drawings/${drawing.id}`} key={drawing.id} className="flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-muted/40 group"><div className="min-w-0"><p className="truncate font-medium group-hover:text-primary transition-colors">{drawing.title}</p><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{drawing.projectName} · {drawing.assignedTo ?? "Unassigned"}</p></div><div className="text-right"><p className={`text-sm font-mono font-bold ${drawing.dueDate < today ? "text-destructive" : "text-foreground"}`}>{formatDateShort(drawing.dueDate)}</p><Badge variant="outline" className={`mt-1.5 capitalize rounded-sm shadow-sm ${statusTone(drawing.status)}`}>{statusLabel(drawing.status)}</Badge></div></Link>)}</div>}</CardContent></Card>
    </div></div>
  </div>
}

export function Archive() {
  const { data: drawings, isLoading } = useListDrawings({ status: "superseded" })
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const isAdmin = user?.role === "admin"
  const { data: recycleBinEntries, isLoading: recycleBinLoading } = useListRecycleBin({ query: { enabled: Boolean(user), queryKey: getListRecycleBinQueryKey() } })
  const restoreEntry = useRestoreRecycleBinEntry()
  function handleRestoreEntry(type: string, id: number, label: string) {
    restoreEntry.mutate({ type, id }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListRecycleBinQueryKey() })
        void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        void queryClient.invalidateQueries()
        toast({ title: "Item restored", description: `${label} is back in the active workspace.` })
      },
      onError: (error) => toast({ title: "Item could not be restored", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }
  const typeLabels: Record<string, string> = {
    project: "Project",
    drawing: "Drawing",
    upload: "Upload",
    comment: "Comment",
    "project-note": "Project note",
    "personal-note": "Personal note",
    contact: "Contact",
    "contact-project": "Contact link",
    checklist: "Project checklist",
    template: "Checklist template",
    category: "Category",
    user: "User",
  }
  const retentionLabel = (deletedAt: string) => {
    const expiresAt = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000
    const days = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)))
    return days === 1 ? "1 day left" : `${days} days left`
  }
  return <div className="flex h-full flex-1 flex-col overflow-hidden">
    <PageHeader icon={ArchiveIcon} title="Recycle bin" description="Deleted records are retained for 30 days. Restore anything you have access to; administrators can restore any record." />
    <div className="flex-1 overflow-auto p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-6">
      <Card className="rounded-sm shadow-sm border-border/60"><CardHeader className="border-b border-border/40 bg-muted/20"><CardTitle className="text-base">Deleted records <Badge variant="outline" className="ml-2">{recycleBinEntries?.length ?? 0}</Badge></CardTitle><CardDescription>Restore an item before its 30-day retention period expires.</CardDescription></CardHeader><CardContent className="p-0">{recycleBinLoading ? <div className="space-y-4 p-6"><Skeleton className="h-16 w-full rounded-sm" /><Skeleton className="h-16 w-full rounded-sm" /></div> : recycleBinEntries?.length ? <div className="divide-y divide-border/50">{recycleBinEntries.map((entry) => <div key={`${entry.type}-${entry.id}`} className="flex items-center justify-between gap-4 px-6 py-5"><div className="min-w-0"><div className="flex items-center gap-2"><Badge variant="outline" className="shrink-0 rounded-sm text-[10px] uppercase tracking-wider">{typeLabels[entry.type] ?? entry.type}</Badge><p className="truncate font-medium">{entry.label}</p></div><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Deleted {formatDateShort(entry.deletedAt)} · {retentionLabel(entry.deletedAt)}</p></div><Button size="sm" variant="outline" className="shrink-0 rounded-sm" onClick={() => handleRestoreEntry(entry.type, entry.id, entry.label)} disabled={restoreEntry.isPending}><RotateCcw className="mr-2 h-4 w-4" />Restore</Button></div>)}</div> : <EmptyState icon={ArchiveIcon} message="No records available to restore." />}</CardContent></Card>
      <Card className="rounded-sm shadow-sm border-border/60"><CardHeader className="border-b border-border/40 bg-muted/20"><CardTitle className="text-base">Archived drawings <Badge variant="outline" className="ml-2">{drawings?.length ?? 0}</Badge></CardTitle><CardDescription>Superseded drawings retained for reference and audit.</CardDescription></CardHeader><CardContent className="p-0">{isLoading ? <div className="space-y-4 p-6"><Skeleton className="h-16 w-full rounded-sm" /><Skeleton className="h-16 w-full rounded-sm" /></div> : !drawings?.length ? <EmptyState icon={ArchiveIcon} message="No archived drawings yet." /> : <div className="divide-y divide-border/50">{drawings.map((drawing) => <Link href={`/drawings/${drawing.id}`} key={drawing.id} className="flex items-center justify-between gap-4 px-6 py-5 transition-colors hover:bg-muted/40 group"><div className="min-w-0"><p className="truncate font-medium text-foreground/80 group-hover:text-foreground">{drawing.title}</p><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{drawing.drawingNumber} · {drawing.projectName} · Rev {drawing.revision}</p></div><span className="text-right text-[10px] font-mono uppercase tracking-wider text-muted-foreground bg-muted/30 px-2 py-1 rounded-sm border">Updated {formatDateShort(drawing.updatedAt)}</span></Link>)}</div>}</CardContent></Card>
    </div></div>
  </div>
}