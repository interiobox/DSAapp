import * as React from "react"
import { Link, useLocation } from "wouter"
import { Archive, BarChart3, Bell, BookOpen, CalendarDays, ClipboardCheck, FileText, FileWarning, FolderKanban, History, Layers, ListChecks, LogOut, Menu, MessageSquare, Settings, ShieldCheck, Users, UserRoundCog, UsersRound } from "lucide-react"
import { getListNotificationsQueryKey, useListNotifications } from "@workspace/api-client-react"
import { cn } from "@/lib/utils"
import { usePortalAuth } from "@/App"
import { UniversalSearch } from "@/components/UniversalSearch"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

function NavItem({ href, icon: Icon, children, badge, onClick }: { href: string; icon: React.ElementType; children: React.ReactNode; badge?: React.ReactNode; onClick?: () => void }) {
  const [location] = useLocation()
  const isActive = location.startsWith(href)

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between rounded-sm px-3 py-2 text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        isActive
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-sidebar-primary-foreground" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground")} />
        <span>{children}</span>
      </div>
      {badge && (
        <span className={cn(
          "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold transition-colors",
          isActive ? "bg-sidebar-primary-foreground text-sidebar-primary" : "bg-primary text-primary-foreground"
        )}>
          {badge}
        </span>
      )}
    </Link>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()
  const { user, logout } = usePortalAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false)
  const displayName = user?.name || user?.username || "Signed-in user"
  const notificationsQuery = useListNotifications({
    query: {
      queryKey: getListNotificationsQueryKey(),
      refetchInterval: 5000,
    },
  })
  const unreadNotifications = (notificationsQuery.data ?? []).filter((notification) => !notification.readAt).length
  React.useEffect(() => {
    setMobileMenuOpen(false)
  }, [location])

  const navigation = (
    <div className="space-y-0.5">
      <NavItem href="/dashboard" icon={Layers}>Overview</NavItem>
      <NavItem href="/drawings" icon={FileText}>Drawing Library</NavItem>
      <NavItem href="/projects" icon={FolderKanban}>Projects</NavItem>
      <NavItem href="/assignments" icon={Users}>Assignments</NavItem>
      <NavItem href="/review-queue" icon={ClipboardCheck}>Review Queue</NavItem>
      <NavItem href="/deadlines" icon={CalendarDays}>Deadlines</NavItem>
      <NavItem href="/feed" icon={FileText}>My Feed</NavItem>
      <NavItem href="/chat" icon={MessageSquare}>Team Chat</NavItem>
      <NavItem href="/notifications" icon={Bell} badge={unreadNotifications > 0 ? (unreadNotifications > 99 ? "99+" : unreadNotifications) : undefined}>Notifications</NavItem>
      <NavItem href="/checklists" icon={ListChecks}>Checklists</NavItem>
      <NavItem href="/contacts" icon={UsersRound}>Contacts</NavItem>
      <NavItem href="/issues" icon={FileWarning}>Issue register</NavItem>
      <NavItem href="/standards" icon={BookOpen}>Standards</NavItem>
      <NavItem href="/reports" icon={BarChart3}>Reports</NavItem>
       <NavItem href="/activity" icon={History}>Audit history</NavItem>
      <NavItem href="/archive" icon={Archive}>Recycle bin</NavItem>
      <NavItem href="/settings" icon={Settings}>Settings</NavItem>
      <NavItem href="/attendance" icon={ClipboardCheck}>Attendance register</NavItem>
      {user?.role === "admin" && (
        <>
          <NavItem href="/team" icon={UsersRound}>Team directory</NavItem>
          <NavItem href="/users" icon={UserRoundCog}>Portal users</NavItem>
          <NavItem href="/admin" icon={ShieldCheck}>Admin</NavItem>
        </>
      )}
    </div>
  )

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row w-full bg-sidebar md:bg-background">
      {/* Sidebar Mobile Header */}
      <div className="flex items-center justify-between border-b bg-sidebar px-4 py-3 md:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary shadow-sm">
            <Layers className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-sidebar-foreground">Design Sense Architects</p>
             <p className="truncate text-[10px] uppercase tracking-[0.16em] text-muted-foreground font-mono">Drawing Library</p>
          </div>
        </div>
        <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setMobileMenuOpen(true)} aria-label="Open navigation menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="w-[min(86vw,320px)] overflow-y-auto bg-sidebar p-0 text-sidebar-foreground border-r-sidebar-border">
          <SheetHeader className="border-b border-sidebar-border/50 p-4 text-left">
            <SheetTitle className="text-left text-sidebar-foreground flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-primary shadow-sm">
                <Layers className="h-3 w-3 text-primary-foreground" />
              </div>
               DSA Register
            </SheetTitle>
            <p className="text-xs text-muted-foreground">{displayName}</p>
          </SheetHeader>
          <div className="border-b border-sidebar-border/50 p-3 bg-sidebar-accent/20"><UniversalSearch /></div>
          <nav className="p-3">{navigation}</nav>
          <div className="border-t border-sidebar-border/50 p-3">
            <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.98]">
              <LogOut className="h-4 w-4 text-sidebar-foreground/50" /><span>Log out</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border/80 bg-sidebar md:flex md:flex-col shadow-[1px_0_10px_rgba(0,0,0,0.02)] z-10 relative">
        <div className="p-5 border-b border-sidebar-border/50 flex items-start gap-3 bg-sidebar-accent/10">
          <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center shrink-0 shadow-sm mt-0.5">
            <Layers className="text-primary-foreground w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="font-bold text-sm tracking-tight text-sidebar-foreground leading-tight">
               Design Sense<br />Architects
            </h1>
             <p className="mt-1.5 text-[10px] text-primary uppercase font-mono tracking-widest font-semibold">
                Drawing Library
            </p>
          </div>
        </div>
        <div className="border-b border-sidebar-border/50 p-3 bg-sidebar-accent/20">
          <UniversalSearch />
        </div>
        <nav className="flex-1 overflow-y-auto p-3 custom-scrollbar">{navigation}</nav>

        <div className="border-t border-sidebar-border/50 p-3 bg-sidebar-accent/10">
          <div className="px-3 pb-3 pt-1">
            <p className="truncate text-xs font-medium text-sidebar-foreground">{displayName}</p>
            <p className="truncate text-[10px] text-sidebar-foreground/50 capitalize">{user?.role || "User"}</p>
          </div>
          <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-left text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-[0.98]">
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col relative bg-background shadow-[-10px_0_15px_-5px_rgba(0,0,0,0.05)]">
        {children}
      </main>
    </div>
  )
}

