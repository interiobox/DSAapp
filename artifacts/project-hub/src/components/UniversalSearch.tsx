import * as React from "react"
import { useLocation } from "wouter"
import { Activity, Archive, BarChart3, Bell, BookOpen, CalendarDays, CheckSquare, FileText, FileWarning, FolderKanban, LayoutDashboard, MessageSquare, Search, Settings, ShieldCheck, UserRoundCog, Users, UsersRound } from "lucide-react"
import {
  useListActivity,
  useListCategories,
  useListDrawings,
  useListProjects,
  useListUsers,
} from "@workspace/api-client-react"

import { Button } from "@/components/ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { usePortalAuth } from "@/App"

type SearchResult = {
  id: string
  label: string
  detail?: string
  group: string
  icon: React.ElementType
  href: string
}

export function UniversalSearch() {
  const { user } = usePortalAuth()
  const [, setLocation] = useLocation()
  const [open, setOpen] = React.useState(false)
  const { data: drawings } = useListDrawings()
  const { data: projects } = useListProjects()
  const { data: categories } = useListCategories()
  const { data: users } = useListUsers()
  const { data: activity } = useListActivity()

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((current) => !current)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const results = React.useMemo<SearchResult[]>(() => {
    const navigationResults = [
      { label: "Dashboard", detail: "Overview and drawing status", icon: LayoutDashboard, href: "/dashboard" },
      { label: "Drawing Library", detail: "Browse and manage drawings", icon: FileText, href: "/drawings" },
      { label: "Projects", detail: "Project-level drawing register", icon: FolderKanban, href: "/projects" },
      { label: "Assignments", detail: "Assigned drawing workload", icon: Users, href: "/assignments" },
      { label: "Review Queue", detail: "Drawings waiting for review", icon: CheckSquare, href: "/review-queue" },
      { label: "Deadlines", detail: "Upcoming drawing deadlines", icon: CalendarDays, href: "/deadlines" },
      { label: "My Feed", detail: "Your assigned work and activity", icon: FileText, href: "/feed" },
      { label: "Team Chat", detail: "Project coordination conversations", icon: MessageSquare, href: "/chat" },
      { label: "Notifications", detail: "Your unread updates", icon: Bell, href: "/notifications" },
      { label: "Audit history", detail: "Shared drawing activity history", icon: Activity, href: "/activity" },
      { label: "Reports", detail: "Detailed register health and workload", icon: BarChart3, href: "/reports" },
      { label: "Standards", detail: "Reusable checklist templates and categories", icon: BookOpen, href: "/standards" },
      { label: "Issue Register", detail: "Review comments and drawing issues", icon: FileWarning, href: "/issues" },
      { label: "Contacts", detail: "Project contacts and partners", icon: UsersRound, href: "/contacts" },
      { label: "Recycle bin", detail: "All recycled records retained for 30 days", icon: Archive, href: "/archive" },
      { label: "Settings", detail: "Personal preferences and categories", icon: Settings, href: "/settings" },
      ...(user?.role === "admin" ? [
        { label: "Team Directory", detail: "People available for assignments", icon: UsersRound, href: "/team" },
        { label: "Portal Users", detail: "Manage portal accounts", icon: UserRoundCog, href: "/users" },
        { label: "Admin", detail: "Manage access and workspace audit", icon: ShieldCheck, href: "/admin" },
      ] : []),
    ].map((item) => ({
      ...item,
      id: `navigation-${item.href}`,
      group: "Navigation",
    }))
    const drawingResults = (drawings ?? []).map((drawing) => ({
      id: `drawing-${drawing.id}`,
      label: drawing.title,
      detail: `${drawing.drawingNumber} · ${drawing.projectName} · ${drawing.status.replace("_", " ")}`,
      group: "Drawings",
      icon: FileText,
      href: `/drawings/${drawing.id}`,
    }))
    const projectResults = (projects ?? []).map((project) => ({
      id: `project-${project.id}`,
      label: project.name,
      detail: "Project drawing register",
      group: "Projects",
      icon: FolderKanban,
      href: `/projects/${encodeURIComponent(project.name)}`,
    }))
    const categoryResults = (categories ?? []).map((category) => ({
      id: `category-${category.id}`,
      label: category.name,
      detail: "Drawing category",
      group: "Categories",
      icon: BookOpen,
      href: "/settings",
    }))
    const userResults = (users ?? []).map((person) => ({
      id: `user-${person.id}`,
      label: person.name,
      detail: "Available for drawing assignments",
      group: "People",
      icon: Users,
      href: user?.role === "admin" ? "/users" : "/assignments",
    }))
    const activityResults = (activity ?? []).slice(0, 20).map((item) => ({
      id: `activity-${item.id}`,
      label: item.message,
      detail: item.actor ? `${item.actor} · ${new Date(item.createdAt).toLocaleDateString()}` : new Date(item.createdAt).toLocaleDateString(),
      group: "Activity",
      icon: Activity,
      href: item.drawingId ? `/drawings/${item.drawingId}` : "/activity",
    }))
    return [...navigationResults, ...drawingResults, ...projectResults, ...categoryResults, ...userResults, ...activityResults]
  }, [activity, categories, drawings, projects, user?.role, users])

  const groupedResults = React.useMemo(() => {
    const groups = new Map<string, SearchResult[]>()
    for (const result of results) {
      const current = groups.get(result.group) ?? []
      current.push(result)
      groups.set(result.group, current)
    }
    return groups
  }, [results])

  function selectResult(href: string) {
    setOpen(false)
    setLocation(href)
  }

  return (
    <>
      <button
        type="button"
        className="flex h-9 w-full items-center justify-between rounded-sm border border-sidebar-border bg-background/50 px-3 text-sm text-sidebar-foreground/60 shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <Search className="h-4 w-4" />
          <span>Search library...</span>
        </span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border border-sidebar-border bg-sidebar-accent/50 px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex text-sidebar-foreground/70">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search drawings, projects, people, categories..." />
        <CommandList className="max-h-[min(65vh,520px)] custom-scrollbar">
          <CommandEmpty>No matching records found.</CommandEmpty>
          {Array.from(groupedResults.entries()).map(([group, groupResults]) => (
            <CommandGroup key={group} heading={group}>
              {groupResults.map((result) => {
                const Icon = result.icon
                return (
                  <CommandItem
                    key={result.id}
                    value={`${result.label} ${result.detail ?? ""}`}
                    onSelect={() => selectResult(result.href)}
                    className="cursor-pointer"
                  >
                    <Icon className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{result.label}</span>
                      {result.detail && <span className="truncate text-xs text-muted-foreground">{result.detail}</span>}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  )
}