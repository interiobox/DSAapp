import * as React from "react"
import { Link, useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle2, Circle, Clock3, FileText, Loader2, UserRound, UserRoundPlus, Users, X } from "lucide-react"

import {
  getListDrawingsQueryKey,
  getGetDrawingQueryKey,
  getGetDashboardSummaryQueryKey,
  getListActivityQueryKey,
  getListNotificationsQueryKey,
  useListDrawings,
  useListUsers,
  useUpdateDrawingAssignment,
} from "@workspace/api-client-react"
import { usePortalAuth } from "@/App"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

const statusLabel = (status: string) => status === "superseded" ? "Archived" : status.replace("_", " ")
const progressForStatus = (status: string) => {
  switch (status) {
    case "in_review": return 40
    case "approved": return 70
    case "issued":
    case "superseded": return 100
    default: return 0
  }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"
}

export default function Assignments() {
  const [, setLocation] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: drawings, isLoading } = useListDrawings()
  const { data: users, isLoading: usersLoading } = useListUsers()
  const updateAssignment = useUpdateDrawingAssignment()
  const { user } = usePortalAuth()
  const yourName = user?.name || user?.username || ""
  const [assigneeDrafts, setAssigneeDrafts] = React.useState<Record<number, string>>({})
  const [personFilter, setPersonFilter] = React.useState("all")
  const [projectFilter, setProjectFilter] = React.useState("all")

  const projectOptions = React.useMemo(
    () => Array.from(new Set((drawings ?? []).map((drawing) => drawing.projectName))).sort((a, b) => a.localeCompare(b)),
    [drawings],
  )
  const people = React.useMemo(
    () => Array.from(new Set((drawings ?? []).map((drawing) => drawing.assignedTo).filter((name): name is string => Boolean(name)))).sort((a, b) => a.localeCompare(b)),
    [drawings],
  )
  const userNames = React.useMemo(() => users?.map((user) => user.name) ?? [], [users])
  const assignmentOptions = React.useMemo(() => {
    const existingAssignmentNames = (drawings ?? [])
      .map((drawing) => drawing.assignedTo)
      .filter((name): name is string => Boolean(name))
    return Array.from(new Set([yourName, ...userNames, ...existingAssignmentNames].filter(Boolean))).sort((a, b) => a.localeCompare(b))
  }, [drawings, userNames, yourName])
  const visibleDrawings = React.useMemo(
    () => (drawings ?? []).filter((drawing) => {
      const matchesPerson = personFilter === "all"
        || (personFilter === "unassigned" ? !drawing.assignedTo : drawing.assignedTo === personFilter)
      const matchesProject = projectFilter === "all" || drawing.projectName === projectFilter
      return matchesPerson && matchesProject
    }),
    [drawings, personFilter, projectFilter],
  )
  const groupedByPerson = React.useMemo(() => {
    const groups = new Map<string, typeof visibleDrawings>()
    for (const drawing of visibleDrawings) {
      const name = drawing.assignedTo ?? "Unassigned"
      groups.set(name, [...(groups.get(name) ?? []), drawing])
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === "Unassigned") return -1
      if (b === "Unassigned") return 1
      return a.localeCompare(b)
    })
  }, [visibleDrawings])

  const assignedCount = (drawings ?? []).filter((drawing) => drawing.assignedTo).length
  const completeCount = (drawings ?? []).filter((drawing) => drawing.status === "issued" || drawing.status === "superseded").length
  const overallProgress = drawings?.length ? Math.round((drawings.reduce((total, drawing) => total + progressForStatus(drawing.status), 0) / drawings.length)) : 0

  function assignDrawing(id: number, assigneeName: string | null) {
    const assignedBy = yourName.trim()
    if (!assignedBy) {
      toast({ title: "Add your name first", description: "Enter your name above so everyone can see who made the assignment." })
      return
    }
    const trimmedAssignee = assigneeName?.trim() || null
    updateAssignment.mutate(
      { id, data: { assigneeName: trimmedAssignee, assignedBy } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListDrawingsQueryKey() })
          queryClient.invalidateQueries({ queryKey: getGetDrawingQueryKey(id) })
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() })
          queryClient.invalidateQueries({ queryKey: getListActivityQueryKey() })
          queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() })
          toast({
            title: trimmedAssignee ? "Drawing assigned" : "Drawing unassigned",
             description: trimmedAssignee ? `Assigned to ${trimmedAssignee}.` : "The drawing is available for assignment.",
          })
          setAssigneeDrafts((current) => ({ ...current, [id]: trimmedAssignee ?? "" }))
        },
        onError: (error) => {
          toast({ title: "Assignment failed", description: error instanceof Error ? error.message : "The assignment could not be saved." })
        },
      },
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-none border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-6 shadow-sm sm:px-8 sm:py-8 z-10">
        <div className="mx-auto max-w-7xl flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary border border-primary/20 shadow-sm">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Assignments</h1>
                <Badge variant="outline" className="font-mono rounded-sm shadow-sm">{visibleDrawings.length} visible</Badge>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">See who owns each drawing and how work is progressing.</p>
            </div>
          </div>
          <div className="w-full max-w-xs">
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Your Name (for assignments)</label>
            <div className="flex h-10 items-center gap-3 rounded-sm border border-border/80 bg-muted/20 px-3 text-sm text-foreground shadow-sm">
              <UserRound className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="truncate font-medium">{yourName || "Loading your profile..."}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 sm:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card className="rounded-sm shadow-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Total drawings</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{drawings?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card className="rounded-sm shadow-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Assigned</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{assignedCount}</p>
              </CardContent>
            </Card>
            <Card className="rounded-sm shadow-sm border-border/60">
              <CardContent className="p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Unassigned</p>
                <p className="mt-2 text-3xl font-bold tracking-tight">{(drawings?.length ?? 0) - assignedCount}</p>
              </CardContent>
            </Card>
            <Card className="rounded-sm shadow-sm border-border/60">
              <CardContent className="p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">Overall progress</p>
                  <span className="text-sm font-bold font-mono text-primary">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="mt-3 h-2 rounded-sm" />
                <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground font-mono">{completeCount} complete</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3 rounded-sm border border-border/60 bg-card p-4 shadow-sm sm:flex-row sm:items-center">
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-full sm:w-[240px] rounded-sm bg-background">
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Everyone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Everyone</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {people.map((person) => <SelectItem key={person} value={person}>{person}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[240px] rounded-sm bg-background">
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projectOptions.map((project) => <SelectItem key={project} value={project}>{project}</SelectItem>)}
              </SelectContent>
            </Select>
            {(personFilter !== "all" || projectFilter !== "all") && (
              <Button variant="ghost" size="sm" className="rounded-sm" onClick={() => { setPersonFilter("all"); setProjectFilter("all") }} title="Clear filters">
                <X className="mr-1.5 h-4 w-4" /> Clear filters
              </Button>
            )}
            <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground sm:ml-auto">{assignedCount} assigned · {(drawings?.length ?? 0) - assignedCount} unassigned</span>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 w-full rounded-sm" />)}
            </div>
          ) : groupedByPerson.length === 0 ? (
            <Card className="rounded-sm shadow-sm border-border/60">
              <CardContent className="flex flex-col items-center justify-center px-6 py-20 text-center text-muted-foreground border-2 border-dashed border-border/60 rounded-sm m-4 bg-muted/10">
                <FileText className="mb-4 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">No drawings match these filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {groupedByPerson.map(([person, personDrawings]) => {
                const personProgress = Math.round(personDrawings.reduce((total, drawing) => total + progressForStatus(drawing.status), 0) / personDrawings.length)
                return (
                  <Card key={person} className="rounded-sm shadow-sm border-border/60 overflow-hidden">
                    <CardHeader className="border-b border-border/40 px-5 py-4 bg-muted/20">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <CardTitle className="flex items-center gap-3 text-base">
                          <span className="flex h-10 w-10 items-center justify-center rounded-sm bg-background border border-border/60 shadow-sm text-sm font-bold text-primary">{initials(person)}</span>
                           <span className="font-semibold">{person}</span>
                          <Badge variant="outline" className="font-mono rounded-sm shadow-sm bg-background">{personDrawings.length} drawing{personDrawings.length === 1 ? "" : "s"}</Badge>
                        </CardTitle>
                        <div className="flex min-w-[200px] items-center gap-4">
                          <Progress value={personProgress} className="h-2 rounded-sm" />
                          <span className="w-12 text-right text-sm font-bold font-mono text-muted-foreground">{personProgress}%</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/50">
                        {personDrawings.map((drawing) => {
                          const progress = progressForStatus(drawing.status)
                          const draftAssignee = assigneeDrafts[drawing.id] ?? drawing.assignedTo ?? ""
                          const isSaving = updateAssignment.isPending
                             return (
                              <div key={drawing.id} className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(130px,0.65fr)_minmax(230px,0.85fr)] lg:items-center">
                               <button type="button" className="min-w-0 text-left group" onClick={() => setLocation(`/drawings/${drawing.id}`)}>
                                  <p className="whitespace-normal break-words font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">{drawing.title}</p>
                                  <p className="mt-1 whitespace-normal break-words text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{drawing.projectName} · <span className="capitalize">{drawing.discipline}</span></p>
                                 <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-primary opacity-0 group-hover:opacity-100 transition-opacity">Open drawing →</p>
                               </button>
                               <div className="min-w-0">
                                 <div className="mb-2.5 flex items-center justify-between gap-2">
                                   <span className="flex min-w-0 items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground font-mono">{progress === 100 ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : progress > 0 ? <Clock3 className="h-4 w-4 shrink-0 text-amber-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}<span>Progress</span></span>
                                   <Badge variant="outline" className="shrink-0 capitalize rounded-sm shadow-sm">{statusLabel(drawing.status)}</Badge>
                                 </div>
                                 <Progress value={progress} className="h-1.5 rounded-sm" />
                               </div>
                                <div className="min-w-0">
                                   <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                  <Select
                                    value={draftAssignee || undefined}
                                    onValueChange={(value) => setAssigneeDrafts((current) => ({ ...current, [drawing.id]: value }))}
                                  >
                                     <SelectTrigger className="h-9 min-w-0 flex-1 rounded-sm bg-background" aria-label={`Assign ${drawing.title}`}>
                                      <SelectValue placeholder="Select user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {assignmentOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                   <Button size="sm" variant="outline" className="rounded-sm" disabled={isSaving || !yourName || !draftAssignee.trim()} onClick={() => assignDrawing(drawing.id, draftAssignee)}>
                                     {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundPlus className="mr-2 h-4 w-4" />}
                                     Assign
                                  </Button>
                                  {drawing.assignedTo && (
                                     <Button size="sm" variant="ghost" className="rounded-sm px-2 text-muted-foreground" disabled={isSaving || !yourName} onClick={() => assignDrawing(drawing.id, null)} title="Unassign drawing">
                                       <X className="h-4 w-4" />
                                       <span className="sr-only">Clear assignment</span>
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}