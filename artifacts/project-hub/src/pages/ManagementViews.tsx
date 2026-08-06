import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Bell, BarChart3, BookOpen, File, FileWarning, FolderOpen, UsersRound } from "lucide-react"

import { getListNotificationsQueryKey, useGetDashboardSummary, useListActivity, useListChecklistTemplates, useListCategories, useListDrawings, useListNotifications, useListProjects, useListUsers, useMarkAllNotificationsRead, useMarkNotificationRead } from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from "wouter"
import { formatDate, formatDateShort, getTodayInIST } from "@/lib/utils"
import { getStorageObjectUrl } from "@/components/SheetPreview"

const statusLabel = (status: string) => status === "superseded" ? "Archived" : status.replace("_", " ")
const statusClass = (status: string) => status === "approved" ? "text-emerald-700" : status === "in_review" ? "text-amber-700" : status === "issued" ? "text-blue-700" : ""

function Header({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) {
  return <div className="flex-none border-b bg-card px-4 py-4 sm:px-6 sm:py-5 shadow-sm"><div className="flex items-start gap-3"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" /><div className="min-w-0"><h1 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h1><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div></div>
}
function Empty({ icon: Icon, text }: { icon: React.ElementType; text: string }) { return <div className="flex flex-col items-center justify-center px-6 py-16 text-center text-muted-foreground"><Icon className="mb-3 h-9 w-9 opacity-50" /><p>{text}</p></div> }

export function Notifications() {
  const queryClient = useQueryClient()
  const { data: notifications, isLoading } = useListNotifications({
    query: {
      queryKey: getListNotificationsQueryKey(),
    },
  })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const { data: drawings } = useListDrawings()
  const assigned = (drawings ?? []).filter((drawing) => drawing.assignedTo)
  const dueSoon = assigned.filter((drawing) => drawing.dueDate && drawing.dueDate >= getTodayInIST()).slice(0, 5)
  const unread = (notifications ?? []).filter((notification) => !notification.readAt)
  return <div className="flex h-full flex-1 flex-col overflow-hidden"><Header icon={Bell} title="Notifications" description="Mentions, assignments, status changes, and drawing updates for you." /><div className="flex-1 overflow-auto p-3 sm:p-6"><div className="mx-auto max-w-5xl space-y-6">
    <Card><CardHeader className="flex flex-row items-start justify-between gap-4 border-b"><div><CardTitle className="text-base">Your notifications <Badge variant="outline">{unread.length} unread</Badge></CardTitle><CardDescription>Updates refresh automatically while you work.</CardDescription></div><button type="button" className="text-xs font-medium text-primary hover:underline disabled:opacity-50" disabled={!unread.length || markAllRead.isPending} onClick={() => markAllRead.mutate(undefined, { onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) } })}>Mark all read</button></CardHeader><CardContent className="p-0">{isLoading ? <Skeleton className="m-6 h-32" /> : notifications?.length ? <div className="divide-y">{notifications.map((item) => {
      const content = <div className={`px-6 py-4 transition-colors ${item.readAt ? "" : "bg-primary/[0.04]"}`}><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="font-medium">{item.title}</p><p className="mt-1 text-sm text-muted-foreground">{item.message}</p><p className="mt-2 text-xs text-muted-foreground">{formatDate(item.createdAt)}</p></div>{!item.readAt && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />}</div></div>
      const markReadAndRefresh = () => {
        if (!item.readAt) {
          markRead.mutate({ id: item.id }, {
            onSuccess: () => { void queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }) },
          })
        }
      }
      return item.link ? <Link key={item.id} href={item.link} onClick={markReadAndRefresh}>{content}</Link> : <button type="button" key={item.id} className="block w-full text-left" onClick={markReadAndRefresh}>{content}</button>
    })}</div> : <Empty icon={Bell} text="You are all caught up." />}</CardContent></Card>
    <Card><CardHeader className="border-b"><CardTitle className="text-base">Upcoming assigned deadlines</CardTitle></CardHeader><CardContent className="p-0">{dueSoon.length ? <div className="divide-y">{dueSoon.map((drawing) => <Link key={drawing.id} href={`/drawings/${drawing.id}`} className="block px-6 py-4 hover:bg-muted/40"><p className="font-medium">{drawing.title}</p><p className="mt-1 text-xs text-muted-foreground">Due {formatDateShort(drawing.dueDate)} · {drawing.assignedTo}</p></Link>)}</div> : <Empty icon={Bell} text="No upcoming assigned deadlines." />}</CardContent></Card>
  </div></div></div>
}

export function Reports() {
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary()
  const { data: drawings, isLoading } = useListDrawings()
  const byStatus = ["draft", "in_review", "approved", "issued", "superseded"].map((status) => ({ status, count: (drawings ?? []).filter((drawing) => drawing.status === status).length }))
  const byProject = Array.from(new Set((drawings ?? []).map((drawing) => drawing.projectName))).map((name) => ({ name, count: (drawings ?? []).filter((drawing) => drawing.projectName === name).length })).sort((a, b) => b.count - a.count)
  return <div className="flex h-full flex-1 flex-col overflow-hidden"><Header icon={BarChart3} title="Reports" description="A live view of register health and workload." /><div className="flex-1 overflow-auto p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-6">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{summaryLoading ? [1, 2, 3, 4].map((item) => <Skeleton className="h-28" key={item} />) : [["Total drawings", summary?.totalDrawings ?? 0], ["In review", summary?.inReview ?? 0], ["Approved", summary?.approved ?? 0], ["Overdue", summary?.overdue ?? 0]].map(([label, value]) => <Card key={label as string}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-2 text-3xl font-bold">{value}</p></CardContent></Card>)}</div>
    <div className="grid gap-6 lg:grid-cols-2"><Card><CardHeader className="border-b"><CardTitle className="text-base">Status distribution</CardTitle></CardHeader><CardContent className="space-y-4 pt-5">{isLoading ? <Skeleton className="h-40" /> : byStatus.map(({ status, count }) => <div key={status}><div className="mb-1 flex justify-between text-sm"><span className={`capitalize ${statusClass(status)}`}>{statusLabel(status)}</span><span className="text-muted-foreground">{count}</span></div><Progress value={(count / Math.max(drawings?.length ?? 1, 1)) * 100} /></div>)}</CardContent></Card><Card><CardHeader className="border-b"><CardTitle className="text-base">Drawings by project</CardTitle></CardHeader><CardContent className="p-0">{byProject.length ? <div className="divide-y">{byProject.map((project) => <div className="flex justify-between px-6 py-4" key={project.name}><span className="truncate">{project.name}</span><Badge variant="outline">{project.count}</Badge></div>)}</div> : <Empty icon={BarChart3} text="No project data yet." />}</CardContent></Card></div>
  </div></div></div>
}

export function Standards() {
  const { data: templates, isLoading } = useListChecklistTemplates()
  const { data: categories } = useListCategories()
  return <div className="flex h-full flex-1 flex-col overflow-hidden"><Header icon={BookOpen} title="Standards & Templates" description="Reusable review and handover standards for the team." /><div className="flex-1 overflow-auto p-4 sm:p-6"><div className="mx-auto max-w-6xl space-y-6">
    <Card><CardHeader className="border-b"><CardTitle className="text-base">Checklist templates</CardTitle><CardDescription>Open Checklists to manage reusable templates and apply them to projects.</CardDescription></CardHeader><CardContent className="p-0">{isLoading ? <Skeleton className="m-6 h-32" /> : templates?.length ? <div className="divide-y">{templates.map((template) => <div className="flex items-center justify-between gap-4 px-6 py-4" key={template.id}><div><p className="font-medium">{template.name}</p><p className="mt-1 text-xs text-muted-foreground">{template.items.length} checklist item{template.items.length === 1 ? "" : "s"}{template.description ? ` · ${template.description}` : ""}</p></div><Badge variant="outline">Reusable</Badge></div>)}</div> : <Empty icon={BookOpen} text="No standards templates yet." />}</CardContent></Card>
    <Card><CardHeader className="border-b"><CardTitle className="text-base">Active categories</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2 p-6">{(categories ?? []).map((category) => <Badge key={category.id} variant="secondary">{category.name}</Badge>)}</CardContent></Card>
  </div></div></div>
}

type CommentRecord = { id: number; drawingId: number; comment: string; author: string; createdAt: string }
export function Issues() {
  const { data: drawings, isLoading: drawingsLoading } = useListDrawings()
  const [comments, setComments] = React.useState<CommentRecord[]>([])
  const [commentsLoading, setCommentsLoading] = React.useState(false)
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setCommentsLoading(true)
      const results = await Promise.all((drawings ?? []).map(async (drawing) => {
        const response = await fetch(`/api/drawings/${drawing.id}/comments`)
        return response.ok ? await response.json() as CommentRecord[] : []
      }))
      if (!cancelled) {
        setComments(results.flat())
        setCommentsLoading(false)
      }
    }
    if (drawings) {
      if (drawings.length) void load()
      else setCommentsLoading(false)
    }
    return () => { cancelled = true }
  }, [drawings])
  const drawingMap = new Map((drawings ?? []).map((drawing) => [drawing.id, drawing]))
  return <div className="flex h-full flex-1 flex-col overflow-hidden"><Header icon={FileWarning} title="Issue Register" description="Review comments and drawing issues in one place." /><div className="flex-1 overflow-auto p-4 sm:p-6"><div className="mx-auto max-w-5xl"><Card><CardContent className="p-0">{drawingsLoading || commentsLoading ? <div className="space-y-3 p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : comments.length ? <div className="divide-y">{comments.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((comment) => <Link href={`/drawings/${comment.drawingId}`} key={comment.id} className="block px-6 py-4 hover:bg-muted/40"><div className="flex items-center justify-between gap-4"><p className="font-medium">{drawingMap.get(comment.drawingId)?.title ?? "Drawing"}</p><span className="text-xs text-muted-foreground">{formatDate(comment.createdAt)}</span></div><p className="mt-2 text-sm text-muted-foreground">{comment.comment}</p><p className="mt-2 text-xs text-muted-foreground">Raised by {comment.author}</p></Link>)}</div> : <Empty icon={FileWarning} text="No review issues have been recorded." />}</CardContent></Card></div></div></div>
}

type UploadRecord = { id: number; drawingId: number; filePath: string; fileName: string; fileSize: number; contentType: string; uploadedBy: string; uploadedAt: string }
export function Files() {
  const { data: drawings, isLoading } = useListDrawings()
  const [uploads, setUploads] = React.useState<UploadRecord[]>([])
  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const results = await Promise.all((drawings ?? []).map(async (drawing) => {
        const response = await fetch(`/api/drawings/${drawing.id}/uploads`)
        return response.ok ? await response.json() as UploadRecord[] : []
      }))
      if (!cancelled) setUploads(results.flat())
    }
    if (drawings?.length) void load()
    return () => { cancelled = true }
  }, [drawings])
  const drawingMap = new Map((drawings ?? []).map((drawing) => [drawing.id, drawing]))
   return <div className="flex h-full flex-1 flex-col overflow-hidden"><Header icon={FolderOpen} title="Files & Documents" description="Every uploaded drawing file, with its source drawing and upload history." /><div className="flex-1 overflow-auto p-4 sm:p-6"><div className="mx-auto max-w-6xl"><Card><CardContent className="p-0">{isLoading ? <Skeleton className="m-6 h-32" /> : uploads.length ? <div className="divide-y">{uploads.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)).map((upload) => <div key={upload.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-center gap-3"><File className="h-5 w-5 shrink-0 text-primary" /><div className="min-w-0"><a className="truncate font-medium text-primary hover:underline" href={getStorageObjectUrl(upload.filePath) ?? "#"} target="_blank" rel="noreferrer">{upload.fileName}</a><p className="mt-1 text-xs text-muted-foreground"><Link className="hover:underline" href={`/drawings/${upload.drawingId}`}>{drawingMap.get(upload.drawingId)?.title ?? "Drawing"}</Link> · {upload.uploadedBy} · {formatDate(upload.uploadedAt)}</p></div></div><Badge variant="outline">{(upload.fileSize / 1024 / 1024).toFixed(2)} MB</Badge></div>)}</div> : <Empty icon={FolderOpen} text="No uploaded files yet." />}</CardContent></Card></div></div></div>
}

export function Team() {
  const { data: users, isLoading } = useListUsers()
  const { data: drawings } = useListDrawings()
  const assigned = new Map<string, number>()
  for (const drawing of drawings ?? []) if (drawing.assignedTo) assigned.set(drawing.assignedTo, (assigned.get(drawing.assignedTo) ?? 0) + 1)
  return <div className="flex h-full flex-1 flex-col overflow-hidden"><Header icon={UsersRound} title="Team Directory" description="People available for drawing assignments and review work." /><div className="flex-1 overflow-auto p-4 sm:p-6"><div className="mx-auto max-w-5xl"><Card><CardContent className="p-0">{isLoading ? <Skeleton className="m-6 h-32" /> : users?.length ? <div className="divide-y">{users.map((user) => <div className="flex items-center justify-between gap-4 px-6 py-4" key={user.id}><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">{user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><p className="font-medium">{user.name}</p><p className="text-xs text-muted-foreground">Available for assignments</p></div></div><Badge variant="outline">{assigned.get(user.name) ?? 0} assigned</Badge></div>)}</div> : <Empty icon={UsersRound} text="No team members yet." />}</CardContent></Card></div></div></div>
}