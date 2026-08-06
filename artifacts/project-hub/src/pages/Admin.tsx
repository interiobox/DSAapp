import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Activity as ActivityIcon, CalendarDays, Cloud, Eye, FileEdit, KeyRound, Plus, Save, ShieldCheck, StickyNote, Trash2, Upload, Users } from "lucide-react"

import {
  getAdminListActivityQueryKey,
  getAdminGetGoogleDriveStatusQueryKey,
  useAdminDisconnectGoogleDrive,
  useAdminGetGoogleDriveStatus,
  useAdminListPersonalNotes,
  getAdminListUsersQueryKey,
  useAdminCreateUser,
  useAdminDeleteUser,
  useAdminListActivity,
  useAdminListUsers,
  useAdminUpdateUser,
} from "@workspace/api-client-react"
import type { Activity, AdminUserInputRole, AdminUserUpdateRole, PortalUser } from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { formatDate } from "@/lib/utils"
import { usePortalAuth } from "@/App"
import { Redirect } from "wouter"

type DraftUser = { name: string; username: string; password: string; role: AdminUserUpdateRole; active: boolean }

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?"
}

function localDateValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function actionLabel(type: Activity["type"]) {
  switch (type) {
    case "drawing_uploaded": return "Uploaded file"
    case "drawing_assigned": return "Changed assignment"
    case "drawing_added": return "Added drawing"
    case "drawing_approved": return "Approved drawing"
    case "drawing_issued": return "Issued drawing"
    case "drawing_deleted": return "Deleted drawing"
    case "comment_added": return "Added review comment"
    default: return "Updated drawing"
  }
}

function activityTime(dateString: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(dateString))
}

export default function AdminPage() {
  const { user } = usePortalAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: users, isLoading: usersLoading } = useAdminListUsers()
  const [activityDate, setActivityDate] = React.useState(() => localDateValue())
  const { data: activity, isLoading: activityLoading } = useAdminListActivity({ date: activityDate })
  const { data: personalNotes, isLoading: personalNotesLoading } = useAdminListPersonalNotes()
  const { data: driveStatus, isLoading: driveLoading } = useAdminGetGoogleDriveStatus()
  const createUser = useAdminCreateUser()
  const updateUser = useAdminUpdateUser()
  const deleteUser = useAdminDeleteUser()
  const [newUser, setNewUser] = React.useState<DraftUser>({ name: "", username: "", password: "", role: "user", active: true })
  const [userDrafts, setUserDrafts] = React.useState<Record<number, DraftUser>>({})
  const disconnectDrive = useAdminDisconnectGoogleDrive()
  const userNamesById = React.useMemo(
    () => new Map((users ?? []).map((portalUser) => [String(portalUser.id), portalUser.name])),
    [users],
  )
  const activityGroups = React.useMemo(() => {
    const groups = new Map<string, { name: string; items: Activity[] }>()
    for (const portalUser of users ?? []) {
      groups.set(portalUser.name, { name: portalUser.name, items: [] })
    }
    for (const item of activity ?? []) {
      const name = item.actor ? userNamesById.get(item.actor) ?? `User ${item.actor}` : "System"
      const group = groups.get(name) ?? { name, items: [] }
      group.items.push(item)
      groups.set(name, group)
    }
    return Array.from(groups.values()).sort((a, b) => {
      if (a.items.length === 0 && b.items.length > 0) return 1
      if (a.items.length > 0 && b.items.length === 0) return -1
      return a.name.localeCompare(b.name)
    })
  }, [activity, userNamesById, users])
  const uploadCount = (activity ?? []).filter((item) => item.type === "drawing_uploaded").length
  const activeUserCount = activityGroups.filter((group) => group.items.length > 0).length

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const result = params.get("drive")
    if (result === "connected") {
      toast({ title: "Google Drive connected", description: "New drawing uploads will be organized in Google Drive." })
      void queryClient.invalidateQueries({ queryKey: getAdminGetGoogleDriveStatusQueryKey() })
      window.history.replaceState({}, "", "/admin")
    } else if (result === "error") {
      toast({ title: "Google Drive connection failed", description: params.get("message") || "Authorization could not be completed." })
      window.history.replaceState({}, "", "/admin")
    }
  }, [queryClient, toast])

  if (user?.role !== "admin") return <Redirect to="/drawings" />

  function showError(title: string, error: unknown) {
    toast({ title, description: error instanceof Error ? error.message : "The change could not be saved." })
  }

  function invalidateUsers() {
    void queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() })
  }

  function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newUser.name.trim() || !newUser.username.trim() || !newUser.password) return
    createUser.mutate({ data: { ...newUser, name: newUser.name.trim(), username: newUser.username.trim().toLowerCase() as string, password: newUser.password, role: newUser.role as AdminUserInputRole } }, {
      onSuccess: () => {
        setNewUser({ name: "", username: "", password: "", role: "user", active: true })
        void queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() })
        toast({ title: "Portal user created", description: "The user can now sign in with the assigned credentials." })
      },
      onError: (error) => showError("User could not be created", error),
    })
  }

  function draftFor(portalUser: PortalUser): DraftUser {
    return userDrafts[portalUser.id] ?? {
      name: portalUser.name,
      username: portalUser.username ?? "",
      password: "",
      role: portalUser.role,
      active: portalUser.active,
    }
  }

  function saveUser(portalUser: PortalUser) {
    const draft = draftFor(portalUser)
    updateUser.mutate({ id: portalUser.id, data: {
      name: draft.name.trim(),
      username: draft.username.trim().toLowerCase(),
      ...(draft.password ? { password: draft.password } : {}),
      role: draft.role,
      active: draft.active,
    } }, {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: getAdminListUsersQueryKey() })
        toast({ title: "User updated", description: `${draft.name} account settings were saved.` })
        setUserDrafts((current) => ({ ...current, [portalUser.id]: { ...draft, password: "" } }))
      },
      onError: (error) => showError("User could not be updated", error),
    })
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Admin</h1>
            <p className="mt-1 text-sm text-muted-foreground">Manage portal access and everything happening in the workspace.</p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-3 p-5"><Users className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{users?.length ?? 0}</p><p className="text-xs text-muted-foreground">Portal users</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-5"><KeyRound className="h-5 w-5 text-primary" /><div><p className="text-2xl font-bold">{users?.filter((item) => item.role === "admin").length ?? 0}</p><p className="text-xs text-muted-foreground">Administrators</p></div></CardContent></Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Cloud className="h-4 w-4 text-primary" />Google Drive storage</CardTitle>
              <CardDescription>
                Store new drawing files in an organized Drive structure: Drawing Library, project, Drawings, and drawing folders. Drawing metadata and review records remain in the workspace database.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${driveStatus?.connected ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
                <div>
                  <p className="text-sm font-medium">{driveLoading ? "Checking connection..." : driveStatus?.connected ? "Connected to Google Drive" : "Using workspace storage"}</p>
                  <p className="text-xs text-muted-foreground">{driveStatus?.connected ? driveStatus.accountEmail || "Authorized Google account" : "Connect Drive to move new uploads away from local object storage."}</p>
                </div>
              </div>
              {driveStatus?.connected ? (
                <Button variant="outline" onClick={() => disconnectDrive.mutate(undefined, {
                  onSuccess: () => {
                    void queryClient.invalidateQueries({ queryKey: getAdminGetGoogleDriveStatusQueryKey() })
                    toast({ title: "Google Drive disconnected", description: "New uploads will use workspace storage again." })
                  },
                  onError: (error) => showError("Google Drive could not be disconnected", error),
                })} disabled={disconnectDrive.isPending}>
                  {disconnectDrive.isPending ? "Disconnecting..." : "Disconnect Drive"}
                </Button>
              ) : (
                <Button onClick={() => { window.location.href = "/api/admin/google-drive/oauth/start" }} disabled={driveLoading}>
                  <Cloud className="mr-2 h-4 w-4" />Connect Google Drive
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[minmax(300px,380px)_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-base">Add portal user</CardTitle>
                <CardDescription>Assign the username and password they will use to sign in.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateUser} className="space-y-3">
                  <Input value={newUser.name} onChange={(event) => setNewUser({ ...newUser, name: event.target.value })} placeholder="Full name" autoComplete="name" required />
                  <Input value={newUser.username} onChange={(event) => setNewUser({ ...newUser, username: event.target.value })} placeholder="Username" autoComplete="username" required />
                  <Input type="password" value={newUser.password} onChange={(event) => setNewUser({ ...newUser, password: event.target.value })} placeholder="Temporary password" autoComplete="new-password" minLength={4} required />
                  <Select value={newUser.role} onValueChange={(role: AdminUserInputRole) => setNewUser({ ...newUser, role })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent>
                  </Select>
                  <Button type="submit" className="w-full" disabled={createUser.isPending}><Plus className="mr-2 h-4 w-4" />{createUser.isPending ? "Creating..." : "Create account"}</Button>
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b"><CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4 text-primary" />All portal accounts <Badge variant="outline">{users?.length ?? 0}</Badge></CardTitle></CardHeader>
              <CardContent className="p-0">
                {usersLoading ? <div className="space-y-3 p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : (
                  <div className="divide-y">
                    {(users ?? []).map((portalUser) => {
                      const draft = draftFor(portalUser)
                      return <div key={portalUser.id} className="space-y-3 px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(draft.name)}</span>
                          <div className="min-w-0"><p className="truncate font-medium">{portalUser.name}</p><p className="text-xs text-muted-foreground">{portalUser.username ? `@${portalUser.username}` : "Assignment-only directory record"}</p></div>
                          <Badge variant={portalUser.role === "admin" ? "default" : "outline"} className="ml-auto">{portalUser.role}</Badge>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input value={draft.name} onChange={(event) => setUserDrafts({ ...userDrafts, [portalUser.id]: { ...draft, name: event.target.value } })} placeholder="Name" />
                          <Input value={draft.username} onChange={(event) => setUserDrafts({ ...userDrafts, [portalUser.id]: { ...draft, username: event.target.value } })} placeholder="Username" />
                          <Input type="password" value={draft.password} onChange={(event) => setUserDrafts({ ...userDrafts, [portalUser.id]: { ...draft, password: event.target.value } })} placeholder="New password (optional)" autoComplete="new-password" />
                          <Select value={draft.role} onValueChange={(role: AdminUserUpdateRole) => setUserDrafts({ ...userDrafts, [portalUser.id]: { ...draft, role } })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Administrator</SelectItem></SelectContent></Select>
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={draft.active} onChange={(event) => setUserDrafts({ ...userDrafts, [portalUser.id]: { ...draft, active: event.target.checked } })} /> Active account</label>
                           <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => saveUser(portalUser)} disabled={updateUser.isPending}><Save className="mr-1.5 h-3.5 w-3.5" />Save</Button><Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { if (window.confirm(`Move ${portalUser.name} to the recycle bin? They can be restored by an administrator within 30 days.`)) deleteUser.mutate({ id: portalUser.id }, { onSuccess: invalidateUsers, onError: (error) => showError("User could not be moved to recycle bin", error) }) }}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Recycle</Button></div>
                        </div>
                      </div>
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ActivityIcon className="h-4 w-4 text-primary" />Daily activity register
                    <Badge variant="outline">{activity?.length ?? 0} actions</Badge>
                  </CardTitle>
                  <CardDescription>See what every user did on one specific day, including files uploaded and drawing changes.</CardDescription>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm font-medium">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="sr-only">Activity date</span>
                  <Input type="date" value={activityDate} onChange={(event) => setActivityDate(event.target.value)} className="w-[155px]" />
                </label>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid grid-cols-2 divide-x border-b sm:grid-cols-4">
                <div className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Actions</p><p className="mt-1 text-2xl font-semibold">{activity?.length ?? 0}</p></div>
                <div className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Uploads</p><p className="mt-1 text-2xl font-semibold">{uploadCount}</p></div>
                <div className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Active users</p><p className="mt-1 text-2xl font-semibold">{activeUserCount}</p></div>
                <div className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">Users tracked</p><p className="mt-1 text-2xl font-semibold">{users?.length ?? 0}</p></div>
              </div>
              {activityLoading ? (
                <div className="space-y-3 p-6"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>
              ) : activityGroups.length === 0 ? (
                <div className="px-6 py-14 text-center text-sm text-muted-foreground">No portal users or activity records are available.</div>
              ) : (
                <div className="divide-y">
                  {activityGroups.map((group) => (
                    <section key={group.name} className="px-5 py-5 sm:px-6">
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{initials(group.name)}</span>
                        <div className="min-w-0"><p className="font-semibold">{group.name}</p><p className="text-xs text-muted-foreground">{group.items.length ? `${group.items.length} action${group.items.length === 1 ? "" : "s"} on ${activityDate}` : "No activity recorded on this date"}</p></div>
                        <Badge variant={group.items.length ? "default" : "outline"} className="ml-auto">{group.items.length}</Badge>
                      </div>
                      {group.items.length > 0 && (
                        <div className="ml-0 divide-y rounded-md border sm:ml-12">
                          {group.items.map((item) => (
                            <div key={item.id} className="flex gap-3 px-4 py-3">
                              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${item.type === "drawing_uploaded" ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
                                {item.type === "drawing_uploaded" ? <Upload className="h-3.5 w-3.5" /> : <FileEdit className="h-3.5 w-3.5" />}
                              </span>
                              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className="text-[10px]">{actionLabel(item.type)}</Badge><span className="text-xs text-muted-foreground">{activityTime(item.createdAt)}</span></div><p className="mt-1 text-sm leading-relaxed">{item.message}</p></div>
                            </div>
                          ))}
                        </div>
                      )}
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><StickyNote className="h-4 w-4 text-primary" />Everyone’s personal notes <Badge variant="outline">{personalNotes?.length ?? 0}</Badge></CardTitle>
              <CardDescription>Administrator-only read access to every user’s private notes.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {personalNotesLoading ? <div className="space-y-3 p-6"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : personalNotes?.length ? (
                <div className="max-h-[520px] divide-y overflow-auto">
                  {personalNotes.map((note) => <div key={note.id} className="px-6 py-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-medium">{note.title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p></div><span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3.5 w-3.5" />Admin view</span></div><p className="mt-2 text-xs text-muted-foreground">{note.authorName} · Updated {formatDate(note.updatedAt)}</p></div>)}
                </div>
              ) : <p className="p-6 text-sm text-muted-foreground">No personal notes have been created.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}