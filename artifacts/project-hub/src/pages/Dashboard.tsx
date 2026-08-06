import * as React from "react"
import { Link, useLocation } from "wouter"
import { useGetDashboardSummary, useListActivity } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowRight, CheckCircle2, Clock3, FileText, Plus, Send, Activity as ActivityIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateShort } from "@/lib/utils"
import AttendanceSelfCheckin from "@/components/AttendanceSelfCheckin"

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: summary, isLoading: isSummaryLoading } = useGetDashboardSummary();
  const { data: activity, isLoading: isActivityLoading } = useListActivity();

  return (
    <div className="flex-1 overflow-auto bg-background p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <AttendanceSelfCheckin />
        
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">
                <LayoutDashboardIcon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary font-mono">Live Register</p>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl mt-0.5">Overview</h1>
              </div>
            </div>
            <p className="mt-2 text-sm text-muted-foreground max-w-2xl">A quick read on drawing progress and activity across all active projects.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setLocation('/drawings?create=true')} className="shrink-0 rounded-sm shadow-sm group">
              <Plus className="w-4 h-4 mr-2 transition-transform group-active:rotate-90 group-hover:scale-110" />
              New Drawing
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Drawings"
            value={summary?.totalDrawings}
            icon={<FileText className="w-5 h-5 text-primary" />}
            loading={isSummaryLoading}
          />
          <StatCard
            title="In Review"
            value={summary?.inReview}
            icon={<Clock3 className="w-5 h-5 text-amber-600" />}
            loading={isSummaryLoading}
            accent="border-amber-200 bg-amber-50/10"
          />
          <StatCard
            title="Approved"
            value={summary?.approved}
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-600" />}
            loading={isSummaryLoading}
            accent="border-emerald-200 bg-emerald-50/10"
          />
          <StatCard
            title="Issued"
            value={summary?.issued}
            icon={<Send className="w-5 h-5 text-blue-600" />}
            loading={isSummaryLoading}
            accent="border-blue-200 bg-blue-50/10"
          />
        </div>

        <Card className="border-primary/20 bg-primary/[0.02] shadow-sm rounded-sm">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary),0.6)]" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary font-mono">Register pulse</p>
                <p className="mt-1 text-sm font-medium text-foreground">Keep review work moving toward issue.</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {summary?.totalDrawings ? `${Math.round(((summary.issued ?? 0) / summary.totalDrawings) * 100)}% of drawings are issued.` : "Add a drawing to start tracking project progress."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="rounded-sm bg-background hover:bg-muted" asChild><Link href="/review-queue">Open review queue <ArrowRight className="ml-1.5 h-4 w-4" /></Link></Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Category Breakdown */}
          <Card className="lg:col-span-2 rounded-sm shadow-sm border-border/60">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-semibold">By Category</CardTitle>
              <CardDescription className="text-xs">Distribution of drawings across disciplines</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {isSummaryLoading ? (
                <div className="space-y-5">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full rounded-sm" />)}
                </div>
              ) : (
                <div className="space-y-5">
                  {summary && Object.entries(summary.byCategory).map(([category, count]) => {
                    const percentage = (count / summary.totalDrawings) * 100;
                    return (
                      <div key={category} className="space-y-2 group">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium capitalize text-foreground group-hover:text-primary transition-colors">{category}</span>
                          <span className="text-muted-foreground font-mono">{count}</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-sm overflow-hidden">
                          <div 
                            className="h-full bg-primary transition-all duration-500 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {(!summary || Object.keys(summary.byCategory).length === 0) && (
                    <div className="py-8 text-center">
                      <FileText className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
                      <p className="text-sm font-medium text-foreground">No drawings recorded yet.</p>
                      <Button size="sm" variant="link" className="mt-2" onClick={() => setLocation("/drawings?create=true")}>Create the first drawing <ArrowRight className="ml-1 h-3.5 w-3.5" /></Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card className="rounded-sm shadow-sm border-border/60 flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/40 pb-4">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ActivityIcon className="w-4 h-4 text-primary" />
                  Recent Activity
                </CardTitle>
                <CardDescription className="mt-1 text-xs">Latest library changes</CardDescription>
              </div>
              <Link href="/activity" className="shrink-0 text-xs font-semibold text-primary hover:underline uppercase tracking-wider">View all</Link>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              {isActivityLoading ? (
                <div className="space-y-4 p-5">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full rounded-sm" />)}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activity?.slice(0, 6).map((item) => {
                    const content = (
                      <div className="flex min-w-0 items-start gap-3 px-5 py-4 transition-colors hover:bg-muted/50 active:bg-muted">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug text-foreground/90">{item.message}</p>
                          <time className="mt-1.5 block text-[10px] font-mono text-muted-foreground uppercase tracking-wider">{formatDateShort(item.createdAt)}</time>
                        </div>
                      </div>
                    )
                    return item.drawingId ? <Link key={item.id} href={`/drawings/${item.drawingId}`} className="block">{content}</Link> : <div key={item.id}>{content}</div>
                  })}
                  {(!activity || activity.length === 0) && (
                    <p className="px-5 py-10 text-center text-sm text-muted-foreground">No recent activity.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}

function StatCard({ title, value, icon, loading, accent = "border-border/60" }: { title: string, value?: number, icon: React.ReactNode, loading: boolean, accent?: string }) {
  return (
    <Card className={`rounded-sm shadow-sm transition-shadow hover:shadow-md ${accent}`}>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-sm bg-background flex items-center justify-center shrink-0 border shadow-sm">
          {icon}
        </div>
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground font-mono truncate">{title}</p>
          {loading ? (
            <Skeleton className="h-8 w-16 rounded-sm mt-1" />
          ) : (
            <h2 className="text-3xl font-bold tracking-tight text-foreground truncate">{value ?? 0}</h2>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function LayoutDashboardIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </svg>
  )
}
