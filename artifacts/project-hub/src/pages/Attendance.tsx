import * as React from "react"
import { useQueryClient } from "@tanstack/react-query"
import { AlertTriangle, CalendarDays, Check, ClipboardCheck, Clock3, Home, Loader2, MapPin, Plane, UserCheck, Users } from "lucide-react"

import {
  getGetMyAttendanceMonthQueryKey,
  getListAttendanceQueryKey,
  useGetMyAttendanceMonth,
  useListAttendance,
  useRecordAttendance,
} from "@workspace/api-client-react"
import type { AttendanceEntry, AttendanceStatus } from "@workspace/api-client-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { formatCalendarDate, formatDate, formatTime, getTodayInIST } from "@/lib/utils"
import { usePortalAuth } from "@/App"

const statusOptions: Array<{ value: AttendanceStatus; label: string; icon: React.ElementType; className: string }> = [
  { value: "present", label: "Present", icon: UserCheck, className: "text-emerald-700 bg-emerald-500/10 border-emerald-500/20" },
  { value: "late", label: "Late", icon: Clock3, className: "text-amber-700 bg-amber-500/10 border-amber-500/20" },
  { value: "remote", label: "Remote", icon: Home, className: "text-blue-700 bg-blue-500/10 border-blue-500/20" },
  { value: "leave", label: "On leave", icon: Plane, className: "text-violet-700 bg-violet-500/10 border-violet-500/20" },
  { value: "absent", label: "Absent", icon: AlertTriangle, className: "text-rose-700 bg-rose-500/10 border-rose-500/20" },
]

function statusOption(value: string | null) {
  return statusOptions.find((option) => option.value === value)
}

function statusLabel(value: string | null) {
  return statusOption(value)?.label ?? "Not recorded"
}

export default function AttendancePage() {
  const { user } = usePortalAuth()
  return user?.role === "admin" ? <AdminAttendancePage /> : <EmployeeAttendancePage />
}

function AdminAttendancePage() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const todayDate = getTodayInIST()
  const [selectedDate, setSelectedDate] = React.useState(todayDate)
  const [editingReason, setEditingReason] = React.useState<Record<number, string>>({})
  const [savingEmployeeId, setSavingEmployeeId] = React.useState<number | null>(null)
  const { data: attendance, isLoading, isFetching, error } = useListAttendance({ date: selectedDate }, {
    query: {
      queryKey: getListAttendanceQueryKey({ date: selectedDate }),
    },
  })
  const recordAttendance = useRecordAttendance()

  const recorded = (attendance ?? []).filter((entry) => entry.status).length
  const unrecorded = (attendance ?? []).length - recorded
  const presentCount = (attendance ?? []).filter((entry) => entry.status === "present" || entry.status === "late" || entry.status === "remote").length

  function showError(title: string, mutationError: unknown) {
    toast({ title, description: mutationError instanceof Error ? mutationError.message : "The attendance change could not be saved." })
  }

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey({ date: selectedDate }) })
  }

  function saveStatus(entry: AttendanceEntry, status: AttendanceStatus) {
    const reason = editingReason[entry.employeeId]?.trim() || undefined
    if ((status === "absent" || status === "leave") && !reason) {
      toast({ title: "Reason required", description: `Add a reason before marking ${entry.employeeName} ${status === "leave" ? "on leave" : "absent"}.` })
      return
    }
    setSavingEmployeeId(entry.employeeId)
    recordAttendance.mutate({ employeeId: entry.employeeId, data: { attendanceDate: selectedDate, status, ...(reason ? { reason } : {}) } }, {
      onSuccess: () => {
        invalidate()
        setEditingReason((current) => ({ ...current, [entry.employeeId]: "" }))
        toast({ title: "Attendance saved", description: `${entry.employeeName} marked ${statusLabel(status).toLowerCase()}.` })
      },
      onError: (mutationError) => showError("Attendance could not be saved", mutationError),
      onSettled: () => setSavingEmployeeId(null),
    })
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Attendance Register</h1>
              <p className="mt-1 text-sm text-muted-foreground">All active employees can view the selected date. Employees self-check in with location evidence; administrators can correct existing check-ins.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="attendance-date" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Register date</label>
            <Input id="attendance-date" type="date" max={todayDate} value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="w-full sm:w-[170px]" />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card><CardContent className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-primary" /><div><p className="text-xl font-bold">{attendance?.length ?? 0}</p><p className="text-xs text-muted-foreground">Active employees</p></div></CardContent></Card>
            <Card><CardContent className="flex items-center gap-3 p-4"><Check className="h-5 w-5 text-emerald-600" /><div><p className="text-xl font-bold">{presentCount}</p><p className="text-xs text-muted-foreground">Accounted for</p></div></CardContent></Card>
            <Card className={unrecorded > 0 ? "border-amber-500/30 bg-amber-500/[0.04]" : ""}><CardContent className="flex items-center gap-3 p-4"><AlertTriangle className={`h-5 w-5 ${unrecorded > 0 ? "text-amber-600" : "text-muted-foreground"}`} /><div><p className="text-xl font-bold">{unrecorded}</p><p className="text-xs text-muted-foreground">Not recorded</p></div></CardContent></Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-4 w-4 text-primary" />{formatDate(selectedDate)}</CardTitle>
                  <CardDescription>Attendance is visible to all signed-in employees. Employees must capture their location and self-check in; administrators can correct an existing location-backed check-in.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-20 w-full" />)}</div>
              ) : error ? (
                <div className="p-8 text-center text-sm text-destructive">The attendance register could not be loaded. Check the API connection and try again.</div>
              ) : attendance?.length ? (
                <div className="divide-y">
                  {attendance.map((entry) => {
                    const selected = statusOption(entry.status)
                    const isSaving = savingEmployeeId === entry.employeeId
                    return (
                      <div key={entry.employeeId} className="flex flex-col gap-3 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{entry.employeeName.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{entry.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{entry.username ? `@${entry.username}` : "Portal employee"}{entry.reason ? ` · ${entry.reason}` : ""}</p>
                            {entry.selfCheckinAt && entry.latitude !== null && entry.longitude !== null && (
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <Check className="h-3 w-3" />
                                  Self-checked in at {formatTime(entry.selfCheckinAt)}
                                </span>
                                <a
                                  href={`https://www.google.com/maps?q=${entry.latitude},${entry.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                                >
                                  <MapPin className="h-3 w-3" />
                                  GPS evidence{entry.accuracyMeters !== null ? ` · ±${Math.round(entry.accuracyMeters)} m` : ""}
                                </a>
                              </div>
                            )}
                          </div>
                          <Badge variant="outline" className={selected?.className}>{selected?.label ?? "Not recorded"}</Badge>
                        </div>
                        {entry.selfCheckinAt && entry.latitude !== null && entry.longitude !== null && entry.accuracyMeters !== null ? (
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              value={editingReason[entry.employeeId] ?? ""}
                              onChange={(event) => setEditingReason((current) => ({ ...current, [entry.employeeId]: event.target.value }))}
                              placeholder={entry.status === "absent" || entry.status === "leave" ? "Reason required" : "Optional note"}
                              aria-label={`Reason for ${entry.employeeName}`}
                              className="w-full sm:w-[190px]"
                            />
                            <Select value={entry.status ?? ""} onValueChange={(value) => saveStatus(entry, value as AttendanceStatus)} disabled={isSaving}>
                              <SelectTrigger className="w-full sm:w-[150px]"><SelectValue placeholder="Set status" /></SelectTrigger>
                              <SelectContent>{statusOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                            </Select>
                            {isSaving && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Waiting for employee self-check-in</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-10 text-center text-sm text-muted-foreground">No active employees are available for attendance.</div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">Changes are restricted to administrators. {isFetching ? "Refreshing register…" : "Register data is saved to the workspace database."}</p>
        </div>
      </div>
    </div>
  )
}

function EmployeeAttendancePage() {
  const todayMonth = getTodayInIST().slice(0, 7)
  const [selectedMonth, setSelectedMonth] = React.useState(todayMonth)
  const { data: attendance, isLoading, isFetching, error } = useGetMyAttendanceMonth(
    { month: selectedMonth },
    { query: { queryKey: getGetMyAttendanceMonthQueryKey({ month: selectedMonth }) } },
  )

  const officeDays = (attendance ?? []).filter((entry) => entry.status === "present" || entry.status === "late").length
  const remoteDays = (attendance ?? []).filter((entry) => entry.status === "remote").length

  function formatMonth(value: string) {
    return new Date(`${value}-01T00:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })
  }

  return (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <div className="flex-none border-b bg-card px-4 py-4 shadow-sm sm:px-6 sm:py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ClipboardCheck className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">My Monthly Attendance</h1>
              <p className="mt-1 text-sm text-muted-foreground">Only your attendance records are shown. Self-check-in is available for today from the dashboard.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="attendance-month" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Month</label>
            <Input
              id="attendance-month"
              type="month"
              max={todayMonth}
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value || todayMonth)}
              className="w-[170px]"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 sm:p-6">
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <CalendarDays className="h-5 w-5 text-primary" />
                <div><p className="text-xl font-bold">{attendance?.length ?? 0}</p><p className="text-xs text-muted-foreground">Recorded days</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <UserCheck className="h-5 w-5 text-emerald-600" />
                <div><p className="text-xl font-bold">{officeDays}</p><p className="text-xs text-muted-foreground">Office days</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Home className="h-5 w-5 text-blue-600" />
                <div><p className="text-xl font-bold">{remoteDays}</p><p className="text-xs text-muted-foreground">Remote days</p></div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                {formatMonth(selectedMonth)}
              </CardTitle>
              <CardDescription>Your recorded attendance for this month.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-6">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-16 w-full" />)}</div>
              ) : error ? (
                <div className="p-8 text-center text-sm text-destructive">Your monthly attendance could not be loaded. Check the API connection and try again.</div>
              ) : attendance?.length ? (
                <div className="divide-y">
                  {attendance.map((entry) => {
                    const selected = statusOption(entry.status)
                    return (
                      <div key={`${entry.employeeId}-${entry.attendanceDate}`} className="flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                        <div>
                          <p className="font-medium">{formatCalendarDate(entry.attendanceDate)}</p>
                          <p className="text-xs text-muted-foreground">{entry.reason ?? "Attendance recorded"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className={selected?.className}>{selected?.label ?? "Not recorded"}</Badge>
                          {entry.selfCheckinAt && (
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 text-emerald-600" />
                              {formatTime(entry.selfCheckinAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-10 text-center text-sm text-muted-foreground">No attendance recorded for {formatMonth(selectedMonth)}.</div>
              )}
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground">{isFetching ? "Refreshing your attendance…" : "Only your attendance records are available in this view."}</p>
        </div>
      </div>
    </div>
  )
}