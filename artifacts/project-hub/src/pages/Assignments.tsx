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
      <div className="flex-none border-b bg-card px-4 py-4 sm:px-6 sm:py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Assignments</h1>
            <p className="mt-1 text-sm text-muted-foreground">See who owns each drawing and how work is progressing.</p>
          </div>
          <div className="w-full max-w-sm">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">Your name</label>
            <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 text-sm text-foreground">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{yourName || "Loading your profile..."}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total drawings</p>
                <p className="mt-2 text-2xl font-semibold">{drawings?.length ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Assigned</p>
                <p className="mt-2 text-2xl font-semibold">{assignedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Unassigned</p>
                <p className="mt-2 text-2xl font-semibold">{(drawings?.length ?? 0) - assignedCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Overall progress</p>
                  <span className="text-sm font-semibold text-primary">{overallProgress}%</span>
                </div>
                <Progress value={overallProgress} className="mt-3" />
                <p className="mt-2 text-xs text-muted-foreground">{completeCount} complete</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row">
            <Select value={personFilter} onValueChange={setPersonFilter}>
              <SelectTrigger className="w-full sm:w-[220px]">
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
              <SelectTrigger className="w-full sm:w-[220px]">
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projectOptions.map((project) => <SelectItem key={project} value={project}>{project}</SelectItem>)}
              </SelectContent>
            </Select>
            {(personFilter !== "all" || projectFilter !== "all") && (
              <Button variant="ghost" size="icon" onClick={() => { setPersonFilter("all"); setProjectFilter("all") }} title="Clear filters">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-32 w-full" />)}
            </div>
          ) : groupedByPerson.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground">
                <FileText className="mb-3 h-9 w-9 opacity-50" />
                <p>No drawings match these filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {groupedByPerson.map(([person, personDrawings]) => {
                const personProgress = Math.round(personDrawings.reduce((total, drawing) => total + progressForStatus(drawing.status), 0) / personDrawings.length)
                return (
                  <Card key={person}>
                    <CardHeader className="border-b px-4 py-4 sm:px-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="flex items-center gap-3 text-base">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(person)}</span>
                          <span>{person}</span>
                          <Badge variant="outline">{personDrawings.length} drawing{personDrawings.length === 1 ? "" : "s"}</Badge>
                        </CardTitle>
                        <div className="flex min-w-[180px] items-center gap-3">
                          <Progress value={personProgress} className="h-2 rounded-sm" />
                          <span className="w-10 text-right text-xs font-semibold text-muted-foreground">{personProgress}%</span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {personDrawings.map((drawing) => {
                          const progress = progressForStatus(drawing.status)
                          const draftAssignee = assigneeDrafts[drawing.id] ?? drawing.assignedTo ?? ""
                          const isSaving = updateAssignment.isPending
                          return (
                            <div key={drawing.id} className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.8fr)_minmax(280px,1.2fr)] sm:items-center sm:px-6">
                              <button type="button" className="min-w-0 text-left" onClick={() => setLocation(`/drawings/${drawing.id}`)}>
                                <p className="whitespace-normal break-words font-medium leading-snug text-foreground hover:text-primary">{drawing.title}</p>
                                <p className="mt-1 whitespace-normal break-words text-xs leading-relaxed text-muted-foreground">
                                  <span className="font-medium text-foreground/80">Project:</span> {drawing.projectName}
                                  <span className="mx-1">·</span>
                                  <span className="capitalize">{drawing.discipline}</span>
                                  <span className="mx-1">·</span>
                                  {drawing.drawingNumber} · Rev {drawing.revision}
                                </p>
                                <p className="mt-2 text-[11px] font-medium text-primary">Open drawing details →</p>
                              </button>
                              <div className="min-w-0">
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">{progress === 100 ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : progress > 0 ? <Clock3 className="h-4 w-4 shrink-0 text-amber-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}<span>Progress</span></span>
                                  <Badge variant={drawing.status} className="shrink-0 capitalize">{statusLabel(drawing.status)}</Badge>
                                </div>
                                <Progress value={progress} />
                              </div>
                              <div className="rounded-lg border bg-muted/20 p-2">
                                <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assignment</p>
                                <div className="flex flex-col gap-2 sm:flex-row sm:flex-nowrap">
                                  <Select
                                    value={draftAssignee || undefined}
                                    onValueChange={(value) => setAssigneeDrafts((current) => ({ ...current, [drawing.id]: value }))}
                                  >
                                    <SelectTrigger className="h-9 min-w-0 flex-1" aria-label={`Assign ${drawing.title}`}>
                                      <UserRoundPlus className="mr-2 h-4 w-4 text-muted-foreground" />
                                      <SelectValue placeholder="Select a user" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {assignmentOptions.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Button size="sm" variant="outline" className="shrink-0" disabled={isSaving || !yourName || !draftAssignee.trim()} onClick={() => assignDrawing(drawing.id, draftAssignee)}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserRoundPlus className="mr-2 h-4 w-4" />}
                                    Assign
                                  </Button>
                                  {drawing.assignedTo && (
                                    <Button size="icon" variant="ghost" disabled={isSaving || !yourName} onClick={() => assignDrawing(drawing.id, null)} title="Unassign drawing">
                                      <X className="h-4 w-4" />
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