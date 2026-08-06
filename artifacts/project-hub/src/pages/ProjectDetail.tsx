import * as React from "react"
import { Link, useLocation, useRoute } from "wouter"
import {
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  History,
  Mail,
  Pencil,
  Trash2,
  UsersRound,
} from "lucide-react"

import {
  getListProjectsQueryKey,
  useDeleteProject,
  useListActivity,
  useListContacts,
  useListDrawings,
  useListProjectChecklists,
  useListProjects,
  useUpdateProject,
} from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ProjectNotesPanel } from "@/components/ProjectNotesPanel"
import { formatDateShort, getTodayInIST } from "@/lib/utils"
import { usePortalAuth } from "@/App"
import { useQueryClient } from "@tanstack/react-query"
import { useToast } from "@/hooks/use-toast"

const statusLabel = (status: string) => status === "superseded" ? "Archived" : status.replace("_", " ")
const statusTone = (status: string) =>
  status === "approved" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
  status === "issued" ? "bg-blue-100 text-blue-800 border-blue-200" :
  status === "in_review" ? "bg-amber-100 text-amber-800 border-amber-200" :
  status === "superseded" ? "bg-slate-100 text-slate-700 border-slate-200" : ""
const activityLabel = (type: string) => type.replace("drawing_", "").replace("_", " ")
const activityTone = (type: string) =>
  type.includes("issued") ? "bg-blue-100 text-blue-800 border-blue-200" :
  type.includes("approved") ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
  type.includes("assigned") ? "bg-violet-100 text-violet-800 border-violet-200" :
  type.includes("uploaded") ? "bg-cyan-100 text-cyan-800 border-cyan-200" : "bg-muted text-muted-foreground border-border/60"

export default function ProjectDetail() {
  const [, params] = useRoute("/projects/:projectName")
  const [, setLocation] = useLocation()
  const projectName = params?.projectName ? decodeURIComponent(params.projectName) : ""
  const { user } = usePortalAuth()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const deleteProject = useDeleteProject()
  const updateProject = useUpdateProject()
  const [isEditOpen, setIsEditOpen] = React.useState(false)
  const [projectNameDraft, setProjectNameDraft] = React.useState("")
  const { data: projects, isLoading: projectsLoading } = useListProjects()
  const { data: drawings, isLoading: drawingsLoading } = useListDrawings()
  const { data: contacts, isLoading: contactsLoading } = useListContacts(
    projectName ? { projectName } : undefined,
  )
  const { data: checklists, isLoading: checklistsLoading } = useListProjectChecklists(
    projectName ? { projectName } : undefined,
  )
  const { data: activities, isLoading: activitiesLoading } = useListActivity()

  const project = projects?.find((item) => item.name === projectName)
  const isAdmin = user?.role === "admin"
  const projectDrawings = (drawings ?? []).filter((drawing) => drawing.projectName === projectName)
  const activeDrawings = projectDrawings.filter((drawing) => drawing.status !== "issued" && drawing.status !== "superseded")
  const issuedDrawings = projectDrawings.filter((drawing) => drawing.status === "issued")
  const reviewDrawings = projectDrawings.filter((drawing) => drawing.status === "in_review")
  const dueDrawings = projectDrawings
    .filter((drawing): drawing is typeof drawing & { dueDate: string } => Boolean(drawing.dueDate))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 4)
  const today = getTodayInIST()
  const overdueDrawings = projectDrawings.filter(
    (drawing) => Boolean(drawing.dueDate) && drawing.dueDate! < today && drawing.status !== "issued" && drawing.status !== "superseded",
  )
  const unassignedDrawings = projectDrawings.filter((drawing) => !drawing.assignedTo)
  const projectDrawingIds = new Set(projectDrawings.map((drawing) => drawing.id))
  const projectActivities = (activities ?? []).filter(
    (activity) => activity.drawingId !== null && projectDrawingIds.has(activity.drawingId),
  )
  const drawingById = new Map(projectDrawings.map((drawing) => [drawing.id, drawing]))
  const completedChecklistItems = (checklists ?? []).reduce(
    (total, checklist) => total + checklist.items.filter((item) => item.completed).length,
    0,
  )
  const checklistItems = (checklists ?? []).reduce((total, checklist) => total + checklist.items.length, 0)
  const checklistProgress = checklistItems ? Math.round((completedChecklistItems / checklistItems) * 100) : 0
  const isLoading = projectsLoading || drawingsLoading
  const projectNeedsAttention = overdueDrawings.length > 0 || unassignedDrawings.length > 0

  function handleDeleteProject() {
    if (!project || !window.confirm(`Move “${project.name}” to the recycle bin? Its drawings will be kept.`)) return
    deleteProject.mutate({ id: project.id }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        toast({ title: "Project moved to recycle bin", description: "Its drawings remain available for recovery." })
        window.location.href = "/archive"
      },
      onError: (error) => toast({
        title: "Project could not be moved to recycle bin",
        description: error instanceof Error ? error.message : "Please try again.",
      }),
    })
  }
  function handleUpdateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!project || !projectNameDraft.trim()) return
    updateProject.mutate({ id: project.id, data: { name: projectNameDraft.trim() } }, {
      onSuccess: (updatedProject) => {
        void queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
        setIsEditOpen(false)
        toast({ title: "Project renamed" })
        setLocation(`/projects/${encodeURIComponent(updatedProject.name)}`)
      },
      onError: (error) => toast({ title: "Project could not be renamed", description: error instanceof Error ? error.message : "Please try again." }),
    })
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <div className="border-b border-border/80 bg-background/95 px-4 py-6 sm:px-8 sm:py-8"><Skeleton className="h-8 w-72 rounded-sm" /><Skeleton className="mt-4 h-4 w-96 rounded-sm" /></div>
        <div className="flex-1 overflow-auto p-4 sm:p-8"><div className="mx-auto max-w-7xl space-y-6"><Skeleton className="h-32 w-full rounded-sm" /><div className="grid gap-5 md:grid-cols-3"><Skeleton className="h-40 rounded-sm" /><Skeleton className="h-40 rounded-sm" /><Skeleton className="h-40 rounded-sm" /></div></div></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-lg text-center rounded-sm shadow-sm border-border/60">
          <CardContent className="pt-12 pb-12 border-2 border-dashed border-border/60 rounded-sm m-4 bg-muted/10">
            <FolderKanban className="mx-auto mb-4 h-12 w-12 text-muted-foreground/30" />
            <h1 className="text-xl font-bold">Project not found</h1>
            <p className="mt-2 text-sm text-muted-foreground">This project may have been renamed or is no longer available.</p>
            <Button asChild className="mt-6 rounded-sm" variant="outline"><Link href="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Back to projects</Link></Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <header className="flex-none border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-6 shadow-sm sm:px-8 sm:py-8 z-10 sticky top-0">
        <div className="mx-auto max-w-7xl">
          <Link href="/projects" className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> All projects
          </Link>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary border border-primary/20 shadow-sm">
                <FolderKanban className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary font-mono">Project dashboard</p>
                <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">{project.name}</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">One place for drawings, coordination, notes, deadlines, and project progress.</p>
              </div>
            </div>
             <div className="flex flex-wrap items-center gap-1.5">
               {project.id > 0 && <Button variant="outline" className="rounded-sm" onClick={() => { setProjectNameDraft(project.name); setIsEditOpen(true) }} disabled={updateProject.isPending} data-testid="button-edit-project-detail"><Pencil className="mr-2 h-4 w-4" />Edit</Button>}
               {isAdmin && (
                 <>
                   <Button variant="outline" className="rounded-sm text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60" onClick={handleDeleteProject} disabled={deleteProject.isPending} data-testid="button-recycle-project-detail"><Trash2 className="mr-2 h-4 w-4" />{deleteProject.isPending ? "Recycling..." : "Recycle"}</Button>
                 </>
               )}
              <Button variant="outline" className="rounded-sm" asChild><Link href={`/drawings?project=${encodeURIComponent(project.name)}`}><FileText className="mr-2 h-4 w-4" />View drawings</Link></Button>
              <Button className="rounded-sm shadow-sm" asChild><Link href={`/contacts?project=${encodeURIComponent(project.name)}`}><UsersRound className="mr-2 h-4 w-4" />Directory</Link></Button>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Added {formatDateShort(project.createdAt)}</span>
            <span className="inline-flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />{projectDrawings.length} drawing{projectDrawings.length === 1 ? "" : "s"}</span>
            <span className="inline-flex items-center gap-1.5"><UsersRound className="h-3.5 w-3.5" />{contacts?.length ?? 0} partner{contacts?.length === 1 ? "" : "s"}</span>
          </div>
        </div>
       </header>
       <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
         <DialogContent className="rounded-sm">
           <DialogHeader>
             <DialogTitle>Edit project</DialogTitle>
             <DialogDescription>Rename this project without breaking its drawings, notes, contacts, or checklists.</DialogDescription>
           </DialogHeader>
           <form onSubmit={handleUpdateProject} className="space-y-4">
             <Input value={projectNameDraft} onChange={(event) => setProjectNameDraft(event.target.value)} placeholder="Project name" aria-label="Project name" autoFocus required />
             <DialogFooter>
               <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
               <Button type="submit" disabled={!projectNameDraft.trim() || updateProject.isPending}>{updateProject.isPending ? "Saving..." : "Save changes"}</Button>
             </DialogFooter>
           </form>
         </DialogContent>
       </Dialog>

      <main className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Active drawings", value: activeDrawings.length, detail: "Still in progress", icon: FileText },
              { label: "In review", value: reviewDrawings.length, detail: "Awaiting review/approval", icon: CheckCircle2 },
              { label: "Issued", value: issuedDrawings.length, detail: "Released for use", icon: ClipboardList },
              { label: "Checklist", value: `${checklistProgress}%`, detail: checklistItems ? `${completedChecklistItems}/${checklistItems} items` : "No checklists", icon: CheckCircle2 },
            ].map(({ label, value, detail, icon: Icon }) => (
              <Card key={label} className="rounded-sm shadow-sm border-border/60">
                <CardContent className="flex items-start justify-between gap-3 p-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">{label}</p>
                    <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
                    <p className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{detail}</p>
                  </div>
                  <div className="rounded-sm bg-primary/10 p-2 text-primary border border-primary/20"><Icon className="h-5 w-5" /></div>
                </CardContent>
              </Card>
            ))}
          </section>

          <Card className={`rounded-sm shadow-sm ${projectNeedsAttention ? "border-amber-300 bg-amber-50/40" : "border-emerald-300 bg-emerald-50/20"}`}>
            <CardContent className="p-6">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-4">
                  <div className={`rounded-sm p-3 border shadow-sm ${projectNeedsAttention ? "bg-amber-100 text-amber-700 border-amber-300" : "bg-emerald-100 text-emerald-700 border-emerald-300"}`}>
                    {projectNeedsAttention ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground font-mono">Project health</p>
                    <h2 className="mt-1 text-xl font-bold">{projectNeedsAttention ? "Needs attention" : "On track"}</h2>
                    <p className="mt-1 text-sm text-muted-foreground max-w-lg">
                      {projectNeedsAttention ? "Resolve the items below to keep project work moving smoothly." : "No overdue or unassigned drawing work is currently flagged."}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm sm:grid-cols-4">
                  <HealthMetric label="Overdue" value={overdueDrawings.length} warning={overdueDrawings.length > 0} />
                  <HealthMetric label="Unassigned" value={unassignedDrawings.length} warning={unassignedDrawings.length > 0} />
                  <HealthMetric label="In review" value={reviewDrawings.length} warning={reviewDrawings.length > 0} />
                  <HealthMetric label="Checklist" value={`${checklistProgress}%`} warning={checklistItems > 0 && checklistProgress < 100} />
                </div>
              </div>
              {projectNeedsAttention && (
                <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 border-t border-amber-300/70 pt-5 text-[11px] font-mono uppercase tracking-wider font-bold">
                  {overdueDrawings.length > 0 && <Link className="text-amber-800 hover:text-amber-600 transition-colors flex items-center gap-1.5" href={`/drawings?project=${encodeURIComponent(project.name)}`}>Review {overdueDrawings.length} overdue drawing{overdueDrawings.length === 1 ? "" : "s"} <ArrowRight className="h-3 w-3" /></Link>}
                  {unassignedDrawings.length > 0 && <Link className="text-amber-800 hover:text-amber-600 transition-colors flex items-center gap-1.5" href={`/drawings?project=${encodeURIComponent(project.name)}`}>Assign {unassignedDrawings.length} unassigned drawing{unassignedDrawings.length === 1 ? "" : "s"} <ArrowRight className="h-3 w-3" /></Link>}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]">
            <div className="space-y-6">
              <Card className="rounded-sm shadow-sm border-border/60">
                <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div><CardTitle className="text-base font-semibold">Project drawings</CardTitle><CardDescription className="text-xs">{projectDrawings.length ? `Showing ${Math.min(projectDrawings.length, 8)} of ${projectDrawings.length} drawings.` : `No drawing work for ${project.name} yet.`}</CardDescription></div>
                    <Button variant="ghost" size="sm" className="rounded-sm" asChild><Link href={`/drawings?project=${encodeURIComponent(project.name)}`}>Open library <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {projectDrawings.length === 0 ? <div className="px-6 py-16 text-center text-sm text-muted-foreground"><FileText className="mx-auto mb-4 h-8 w-8 opacity-30" />No drawings have been added to this project yet.</div> : (
                    <div className="divide-y divide-border/50">{projectDrawings.slice(0, 8).map((drawing) => (
                      <Link key={drawing.id} href={`/drawings/${drawing.id}`} className="flex flex-col gap-3 px-6 py-5 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between group">
                        <div className="min-w-0"><p className="truncate font-semibold group-hover:text-primary transition-colors">{drawing.title}</p><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{drawing.drawingNumber} · {drawing.discipline} · Rev {drawing.revision}</p></div>
                        <div className="flex shrink-0 items-center gap-4"><Badge variant="outline" className={`capitalize rounded-sm shadow-sm ${statusTone(drawing.status)}`}>{statusLabel(drawing.status)}</Badge><span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground w-20 text-right">{formatDateShort(drawing.updatedAt)}</span></div>
                      </Link>
                    ))}</div>
                  )}
                </CardContent>
              </Card>

              <ProjectNotesPanel projectName={project.name} />

              <Card className="rounded-sm shadow-sm border-border/60">
                <CardHeader className="border-b border-border/40 bg-muted/10 pb-4">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold"><History className="h-4 w-4 text-primary" />Project activity</CardTitle>
                  <CardDescription className="text-xs">Recent drawing changes recorded for this project.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {activitiesLoading ? <div className="space-y-4 p-6"><Skeleton className="h-12 w-full rounded-sm" /><Skeleton className="h-12 w-full rounded-sm" /></div> : projectActivities.length === 0 ? (
                    <div className="px-6 py-12 text-center text-sm text-muted-foreground"><History className="mx-auto mb-4 h-8 w-8 opacity-30" />No project activity has been recorded yet.</div>
                  ) : (
                    <div className="divide-y divide-border/50">{projectActivities.slice(0, 8).map((activity) => {
                      const drawing = activity.drawingId ? drawingById.get(activity.drawingId) : undefined
                      return <div key={activity.id} className="flex gap-4 px-6 py-5 hover:bg-muted/20 transition-colors">
                        <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <Badge variant="outline" className={`text-[9px] uppercase tracking-widest font-mono rounded-sm shadow-sm ${activityTone(activity.type)}`}>{activityLabel(activity.type)}</Badge>
                            <p className="text-sm font-medium text-foreground/90">{activity.message}</p>
                          </div>
                          <p className="mt-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{activity.actor ?? "System"} · {formatDateShort(activity.createdAt)}{drawing ? <> · Ref: <Link className="text-primary hover:underline font-semibold" href={`/drawings/${drawing.id}`}>{drawing.drawingNumber}</Link></> : null}</p>
                        </div>
                      </div>
                    })}</div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="rounded-sm shadow-sm border-border/60">
                <CardHeader className="bg-muted/10 border-b border-border/40 pb-4"><CardTitle className="flex items-center gap-2 text-base font-semibold"><CalendarDays className="h-4 w-4 text-primary" />Upcoming dates</CardTitle><CardDescription className="text-xs">Deadlines connected to this project.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  {dueDrawings.length === 0 ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">No deadlines have been set.</p> : <div className="divide-y divide-border/50">{dueDrawings.map((drawing) => { const overdue = drawing.dueDate < today && drawing.status !== "issued" && drawing.status !== "superseded"; return <Link key={drawing.id} href={`/drawings/${drawing.id}`} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-muted/40 transition-colors group"><div className="min-w-0"><p className="truncate text-sm font-semibold group-hover:text-primary transition-colors">{drawing.title}</p><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{drawing.drawingNumber}</p></div><span className={`shrink-0 text-right text-[11px] font-bold font-mono tracking-wider ${overdue ? "text-destructive" : "text-foreground"}`}>{overdue ? "OVERDUE · " : ""}{formatDateShort(drawing.dueDate)}</span></Link> })}</div>}
                </CardContent>
              </Card>

              <Card className="rounded-sm shadow-sm border-border/60">
                <CardHeader className="bg-muted/10 border-b border-border/40 pb-4"><CardTitle className="flex items-center gap-2 text-base font-semibold"><UsersRound className="h-4 w-4 text-primary" />Project directory</CardTitle><CardDescription className="text-xs">People and organizations linked.</CardDescription></CardHeader>
                <CardContent className="p-0">
                  {contactsLoading ? <div className="space-y-4 p-6"><Skeleton className="h-10 w-full rounded-sm" /><Skeleton className="h-10 w-full rounded-sm" /></div> : !contacts?.length ? <p className="px-6 py-8 text-center text-sm text-muted-foreground">No partners linked yet.</p> : <div className="divide-y divide-border/50">{contacts.slice(0, 5).map((contact) => <div key={contact.id} className="flex items-start gap-4 px-6 py-4 hover:bg-muted/20 transition-colors"><div className="mt-0.5 rounded-sm bg-muted/50 p-2 border border-border/60"><UsersRound className="h-4 w-4 text-muted-foreground" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold">{contact.companyName}</p><p className="mt-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{contact.projects.find((item) => item.projectName === project.name)?.role ?? contact.type}{contact.contactName ? ` · ${contact.contactName}` : ""}</p>{contact.email && <a className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-primary hover:underline" href={`mailto:${contact.email}`}><Mail className="h-3 w-3" />{contact.email}</a>}</div></div>)}</div>}
                  <div className="border-t border-border/60 p-4"><Button variant="outline" size="sm" className="w-full rounded-sm" asChild><Link href={`/contacts?project=${encodeURIComponent(project.name)}`}>Open directory <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button></div>
                </CardContent>
              </Card>

              <Card className="rounded-sm shadow-sm border-border/60">
                <CardHeader className="bg-muted/10 border-b border-border/40 pb-4"><CardTitle className="flex items-center gap-2 text-base font-semibold"><ClipboardList className="h-4 w-4 text-primary" />Project checklists</CardTitle><CardDescription className="text-xs">Handover and readiness work.</CardDescription></CardHeader>
                <CardContent className="p-5">
                  {checklistsLoading ? <Skeleton className="h-10 w-full rounded-sm" /> : !checklists?.length ? <p className="py-4 text-center text-sm text-muted-foreground">No checklists applied.</p> : <div className="space-y-5">{checklists.slice(0, 3).map((checklist) => { const complete = checklist.items.filter((item) => item.completed).length; const total = checklist.items.length; const progress = total ? Math.round((complete / total) * 100) : 0; return <div key={checklist.id}><div className="flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold">{checklist.name}</span><span className="shrink-0 text-[10px] font-bold font-mono tracking-widest text-muted-foreground">{progress}%</span></div><div className="mt-2 flex items-center gap-3"><Progress className="h-1.5 flex-1 rounded-sm" value={progress} /><span className="shrink-0 text-[10px] font-mono text-muted-foreground">{complete}/{total}</span></div></div> })}</div>}
                  <Button variant="outline" size="sm" className="mt-6 w-full rounded-sm" asChild><Link href="/checklists">Manage checklists <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function HealthMetric({ label, value, warning }: { label: string; value: number | string; warning: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">{label}</p>
      <p className={`mt-1.5 text-2xl font-bold tracking-tight ${warning ? "text-amber-700" : "text-foreground"}`}>{value}</p>
    </div>
  )
}