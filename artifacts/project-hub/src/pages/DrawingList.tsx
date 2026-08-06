import * as React from "react"
import {
  FileText, Plus, Search,
  Pencil, Trash2, X, FolderKanban
} from "lucide-react"
import { Link, useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"

import {
  useListDrawings, useCreateDrawing, useDeleteDrawing,
  useListProjects, useCreateProject, useListCategories,
  getListDrawingsQueryKey, getGetDashboardSummaryQueryKey, getListActivityQueryKey,
  getListProjectsQueryKey
} from "@workspace/api-client-react"
import type { DrawingDiscipline, DrawingStatus } from "@workspace/api-client-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { formatDateShort } from "@/lib/utils"
import { usePortalAuth } from "@/App"

const statusOptions = ["draft", "in_review", "approved", "issued", "superseded"] as const
const statusLabel = (status: string) => status === "superseded" ? "Archived" : status.replace("_", " ")

const statusTone = (status: string) =>
  status === "approved" ? "bg-emerald-100 text-emerald-800 border-emerald-200" :
  status === "issued" ? "bg-blue-100 text-blue-800 border-blue-200" :
  status === "in_review" ? "bg-amber-100 text-amber-800 border-amber-200" :
  status === "superseded" ? "bg-slate-100 text-slate-700 border-slate-200" : ""

export default function DrawingList() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user } = usePortalAuth()
  const isAdmin = user?.role === "admin"
  
  const [searchQuery, setSearchQuery] = React.useState("")
  const [categoryFilter, setCategoryFilter] = React.useState<DrawingDiscipline | "all">("all")
  const [statusFilter, setStatusFilter] = React.useState<DrawingStatus | "all">("all")
  const [projectFilter, setProjectFilter] = React.useState(() => new URLSearchParams(window.location.search).get("project") || "all")
  const [isCreateOpen, setIsCreateOpen] = React.useState(false)
  const [isProjectOpen, setIsProjectOpen] = React.useState(false)
  const [selectedProject, setSelectedProject] = React.useState("")
  const [newProjectName, setNewProjectName] = React.useState("")
  const { data: drawings, isLoading } = useListDrawings({
    search: searchQuery || undefined,
    discipline: categoryFilter !== "all" ? categoryFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  }, { query: { queryKey: getListDrawingsQueryKey({ search: searchQuery || undefined, discipline: categoryFilter !== "all" ? categoryFilter : undefined, status: statusFilter !== "all" ? statusFilter : undefined }) }})

  const createDrawing = useCreateDrawing()
  const deleteDrawing = useDeleteDrawing()
  const { data: projects, isLoading: projectsLoading } = useListProjects()
  const { data: categories } = useListCategories()
  const createProject = useCreateProject()
  const projectOptions = React.useMemo(() => projects?.map((project) => project.name) ?? [], [projects])
  const visibleDrawings = React.useMemo(
    () => (drawings ?? []).filter((drawing) => projectFilter === "all" || drawing.projectName === projectFilter),
    [drawings, projectFilter],
  )
  const groupedDrawings = React.useMemo(() => {
    const groups = new Map<string, NonNullable<typeof drawings>[number][]>()
    for (const drawing of visibleDrawings) {
      const projectDrawings = groups.get(drawing.projectName) ?? []
      projectDrawings.push(drawing)
      groups.set(drawing.projectName, projectDrawings)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [visibleDrawings])

  const [newDrawingName, setNewDrawingName] = React.useState("")

  function createBlankDrawing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = newDrawingName.trim()
    if (!selectedProject || !title) return
    createDrawing.mutate(
      { data: { projectName: selectedProject, title } },
      {
        onSuccess: (newDrawing) => {
          queryClient.invalidateQueries({ queryKey: getListDrawingsQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
          queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() })
          toast({ title: "Drawing created", description: "Add a file to start tracking this drawing." })
          setNewDrawingName("")
          setIsCreateOpen(false)
          setLocation(`/drawings/${newDrawing.id}`)
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Could not create drawing. Please try again.",
          })
        }
      }
    )
  }

  function handleCreateProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = newProjectName.trim()
    if (!name) return
    createProject.mutate(
      { data: { name } },
      {
        onSuccess: (project) => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() })
          setNewProjectName("")
          setIsProjectOpen(false)
          setSelectedProject(project.name)
          toast({ title: "Project added", description: `${project.name} is ready for drawings.` })
        },
        onError: (error) => {
          toast({ title: "Project could not be added", description: error instanceof Error ? error.message : "A project with this name may already exist." })
        },
      },
    )
  }

  function handleDelete(id: number, title: string) {
    if (!confirm(`Move “${title}” to the recycle bin? You can restore it within 30 days.`)) return
    
    deleteDrawing.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDrawingsQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
          toast({ title: "Drawing moved to recycle bin" })
        }
      }
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex-none border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-6 shadow-sm sm:px-8 sm:py-8 z-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <FileText className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Drawing Library</h1>
                <Badge variant="outline" className="font-mono rounded-sm bg-background shadow-sm mt-1">{isLoading ? "Loading" : `${visibleDrawings.length} shown`}</Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">All project drawings in one place, grouped by project for quick scanning.</p>
            </div>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center shrink-0">
            <Button className="w-full sm:w-auto rounded-sm" variant="outline" onClick={() => setIsProjectOpen(true)}>
              <FolderKanban className="mr-2 h-4 w-4" />
              Add Project
            </Button>
            <Button className="w-full sm:w-auto rounded-sm shadow-sm" onClick={() => setIsCreateOpen(true)} disabled={projectsLoading}>
              <Plus className="w-4 h-4 mr-2" />
              Create Drawing
            </Button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-none p-3 sm:p-4 border-b border-border/60 bg-muted/10 flex flex-col sm:flex-row gap-3 z-10 sticky top-0 backdrop-blur-md">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
             placeholder="Search drawing names..."
             className="pl-9 text-sm rounded-sm bg-background border-border/80 h-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-full sm:w-[200px] h-9 rounded-sm bg-background border-border/80">
              <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Project" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projectOptions.map((project) => (
                <SelectItem key={project} value={project}>{project}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={(v: any) => setCategoryFilter(v)}>
            <SelectTrigger className="w-full sm:w-[160px] h-9 rounded-sm bg-background border-border/80">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
               {(categories ?? []).map(category => (
                 <SelectItem key={category.id} value={category.name} className="capitalize">{category.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-full sm:w-[140px] h-9 rounded-sm bg-background border-border/80">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
                 <SelectItem value="all">All Statuses</SelectItem>
                 {statusOptions.map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{statusLabel(s)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(searchQuery || categoryFilter !== "all" || statusFilter !== "all" || projectFilter !== "all") && (
            <Button variant="ghost" size="sm" className="h-9 px-2 text-muted-foreground hover:text-foreground" onClick={() => { setSearchQuery(""); setCategoryFilter("all"); setStatusFilter("all"); setProjectFilter("all"); }} title="Clear filters">
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 bg-background">
        <div className="space-y-4 md:hidden max-w-7xl mx-auto">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-sm border border-border/60 bg-card p-4 shadow-sm">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="mt-3 h-5 w-3/4" />
                <Skeleton className="mt-4 h-4 w-1/2" />
              </div>
            ))
          ) : visibleDrawings.length === 0 ? (
            <div className="rounded-sm border-2 border-dashed border-border/60 bg-muted/10 px-5 py-20 text-center text-muted-foreground m-4">
              <FileText className="mx-auto mb-4 h-10 w-10 opacity-30" />
              <p className="font-medium text-foreground">No drawings found.</p>
              <p className="mt-1 text-xs">Try changing your search or filters, or create a new drawing.</p>
              <Button size="sm" className="mt-6 rounded-sm shadow-sm" onClick={() => setIsCreateOpen(true)} disabled={projectsLoading}><Plus className="mr-2 h-4 w-4" />Create drawing</Button>
            </div>
          ) : (
            groupedDrawings.map(([project, projectDrawings]) => (
              <section key={project} className="space-y-3">
                <div className="flex items-center gap-2 px-1 pt-2">
                  <FolderKanban className="h-4 w-4 text-primary" />
                  <h2 className="font-bold text-foreground text-sm tracking-tight">{project}</h2>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{projectDrawings.length} drawing{projectDrawings.length === 1 ? "" : "s"}</span>
                </div>
                {projectDrawings.map((drawing) => (
                  <div
                    key={drawing.id}
                    className="rounded-sm border border-border/60 bg-card p-4 text-left shadow-sm transition-colors active:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setLocation(`/drawings/${drawing.id}`)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold text-foreground text-sm leading-tight">{drawing.title}</h3>
                        <p className="mt-1.5 text-xs text-muted-foreground font-mono">{drawing.drawingNumber}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="outline" className={`capitalize rounded-sm shadow-sm ${statusTone(drawing.status)}`}>{statusLabel(drawing.status)}</Badge>
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 rounded-sm px-2 text-xs font-medium"
                            onClick={(event) => { event.stopPropagation(); setLocation(`/drawings/${drawing.id}`) }}
                            data-testid={`button-edit-drawing-mobile-${drawing.id}`}
                          >
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                          </Button>
                          {isAdmin && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 rounded-sm px-2 text-xs font-medium text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                              onClick={(event) => { event.stopPropagation(); handleDelete(drawing.id, drawing.title) }}
                              disabled={deleteDrawing.isPending}
                              data-testid={`button-recycle-drawing-mobile-${drawing.id}`}
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Recycle
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      <span className="capitalize">{drawing.discipline}</span>
                      <span>{formatDateShort(drawing.updatedAt)}</span>
                    </div>
                  </div>
                ))}
              </section>
            ))
          )}
        </div>

        <div className="hidden rounded-sm border border-border/80 bg-card shadow-sm md:block max-w-7xl mx-auto overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-semibold text-foreground/80 h-10">Title</TableHead>
              <TableHead className="w-[140px] font-semibold text-foreground/80 h-10">Category</TableHead>
                <TableHead className="w-[140px] font-semibold text-foreground/80 h-10">Status</TableHead>
                <TableHead className="w-[120px] font-semibold text-foreground/80 h-10">Updated</TableHead>
                <TableHead className="w-[60px] h-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-5 w-64" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                  </TableRow>
                ))
              ) : visibleDrawings.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center">
                      <FileText className="h-10 w-10 text-muted-foreground/30 mb-3" />
                       <p className="font-medium text-foreground">No drawings found.</p>
                       <p className="text-sm mt-1">Adjust your filters or add a new drawing.</p>
                       <Button size="sm" variant="outline" className="mt-4 rounded-sm shadow-sm" onClick={() => setIsCreateOpen(true)} disabled={projectsLoading}><Plus className="mr-2 h-4 w-4" />Create drawing</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                groupedDrawings.flatMap(([project, projectDrawings]) => [
                  <TableRow key={`project-${project}`} className="bg-muted/10 hover:bg-muted/10">
                    <TableCell colSpan={5} className="py-2.5">
                      <div className="flex items-center gap-3">
                        <FolderKanban className="h-4 w-4 text-primary" />
                        <span className="font-bold text-foreground text-sm">{project}</span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{projectDrawings.length} drawing{projectDrawings.length === 1 ? "" : "s"}</span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...projectDrawings.map((drawing) => (
                  <TableRow key={drawing.id} className="group cursor-pointer transition-colors hover:bg-muted/30" onClick={() => setLocation(`/drawings/${drawing.id}`)}>
                    <TableCell>
                      <div className="font-semibold text-foreground/90 group-hover:text-primary transition-colors">{drawing.title}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{drawing.drawingNumber}</div>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground text-xs font-medium">{drawing.discipline}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`shadow-sm rounded-sm ${statusTone(drawing.status)}`}>{statusLabel(drawing.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-[11px] font-mono text-muted-foreground whitespace-nowrap uppercase">
                      {formatDateShort(drawing.updatedAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-sm px-2 text-xs font-medium"
                          onClick={(event) => { event.stopPropagation(); setLocation(`/drawings/${drawing.id}`) }}
                          data-testid={`button-edit-drawing-${drawing.id}`}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
                        </Button>
                        {isAdmin && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 rounded-sm px-2 text-xs font-medium text-destructive hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={(event) => { event.stopPropagation(); handleDelete(drawing.id, drawing.title) }}
                            disabled={deleteDrawing.isPending}
                            data-testid={`button-recycle-drawing-${drawing.id}`}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />Recycle
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                  )),
                ])
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>Create drawing</DialogTitle>
            <DialogDescription>Choose a project to start a new drawing record.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createBlankDrawing} className="space-y-4">
            <Input
              value={newDrawingName}
              onChange={(event) => setNewDrawingName(event.target.value)}
              placeholder="Drawing name"
              aria-label="Drawing name"
              className="rounded-sm"
              autoFocus
              required
            />
            <Select value={selectedProject} onValueChange={setSelectedProject} required>
              <SelectTrigger className="rounded-sm">
                <FolderKanban className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder={projectsLoading ? "Loading projects..." : "Choose a project"} />
              </SelectTrigger>
              <SelectContent className="rounded-sm">
                {projectOptions.map((project) => <SelectItem key={project} value={project}>{project}</SelectItem>)}
              </SelectContent>
            </Select>
            {projectOptions.length === 0 && (
              <p className="text-sm text-muted-foreground">Add a project first before creating a drawing.</p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button type="submit" className="rounded-sm shadow-sm" disabled={!selectedProject || !newDrawingName.trim() || createDrawing.isPending}>
                {createDrawing.isPending ? "Creating..." : "Create drawing"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isProjectOpen} onOpenChange={setIsProjectOpen}>
        <DialogContent className="rounded-sm">
          <DialogHeader>
            <DialogTitle>Add project</DialogTitle>
            <DialogDescription>Create a project that can be selected for drawings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <Input
              value={newProjectName}
              onChange={(event) => setNewProjectName(event.target.value)}
              placeholder="Project name"
              aria-label="Project name"
              className="rounded-sm"
              autoFocus
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-sm" onClick={() => setIsProjectOpen(false)}>Cancel</Button>
              <Button type="submit" className="rounded-sm shadow-sm" disabled={!newProjectName.trim() || createProject.isPending}>
                {createProject.isPending ? "Adding..." : "Add project"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </div>
  )
}
