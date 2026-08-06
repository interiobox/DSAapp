import "./_group.css";

import { useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileArchive,
  FileCheck2,
  FilePlus2,
  FileText,
  FolderKanban,
  FolderOpen,
  History,
  Layers3,
  LayoutDashboard,
  Menu,
  MessageSquare,
  MoreHorizontal,
  PanelRight,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";

type Status = "In review" | "Approved" | "Issued" | "Coordination";

type Drawing = {
  number: string;
  title: string;
  discipline: string;
  project: string;
  status: Status;
  revision: string;
  owner: string;
  due: string;
  dueTone?: "overdue" | "soon";
  updated: string;
};

const drawings: Drawing[] = [
  { number: "A-204", title: "Level 02 reflected ceiling plan", discipline: "Architecture", project: "Harbour House", status: "In review", revision: "P04", owner: "M. Chen", due: "Today · 16:00", dueTone: "soon", updated: "8 min ago" },
  { number: "S-118", title: "Transfer beam setting out", discipline: "Structure", project: "Harbour House", status: "Coordination", revision: "P03", owner: "D. Okafor", due: "Tomorrow", updated: "32 min ago" },
  { number: "M-301", title: "Plant room services layout", discipline: "Mechanical", project: "Civic Arts Centre", status: "Approved", revision: "P02", owner: "R. Singh", due: "14 Mar", updated: "1 hr ago" },
  { number: "A-611", title: "Typical bathroom details", discipline: "Architecture", project: "North Quay Lofts", status: "In review", revision: "P05", owner: "L. Byrne", due: "14 Mar", updated: "2 hrs ago" },
  { number: "E-402", title: "Lighting control schematic", discipline: "Electrical", project: "Civic Arts Centre", status: "Issued", revision: "C01", owner: "T. Wilson", due: "18 Mar", updated: "Yesterday" },
  { number: "A-109", title: "Ground floor general arrangement", discipline: "Architecture", project: "North Quay Lofts", status: "Issued", revision: "P07", owner: "J. Patel", due: "18 Mar", updated: "Yesterday" },
];

const allNavItems = [
  { label: "Overview", icon: LayoutDashboard },
  { label: "Drawing Library", icon: FileText, count: "248" },
  { label: "Projects", icon: FolderKanban },
  { label: "Work queue", icon: ClipboardCheck, count: "12" },
  { label: "Checklists", icon: CheckCircle2 },
  { label: "My work", icon: Sparkles, count: "7" },
  { label: "Collaboration", icon: MessageSquare, count: "3" },
  { label: "Notifications", icon: Bell, count: "4" },
  { label: "Reference", icon: BookOpen },
  { label: "Recycle bin", icon: Archive },
  { label: "Settings", icon: Settings2 },
  { label: "Team & admin", icon: ShieldCheck },
];

function StatusPill({ status }: { status: Status }) {
  const tone = {
    "In review": "review",
    Approved: "approved",
    Issued: "issued",
    Coordination: "coordination",
  }[status];
  return <span className={`fw-status fw-status-${tone}`}><span className="fw-status-dot" />{status}</span>;
}

function RailItem({
  label,
  icon: Icon,
  active,
  count,
  onClick,
}: {
  label: string;
  icon: typeof FileText;
  active?: boolean;
  count?: string;
  onClick: () => void;
}) {
  return (
    <button className={`fw-rail-item ${active ? "is-active" : ""}`} onClick={onClick}>
      <Icon size={15} strokeWidth={active ? 2.2 : 1.8} />
      <span>{label}</span>
      {count && <span className="fw-rail-count fw-mono">{count}</span>}
    </button>
  );
}

type WorkspaceTabViewProps = {
  activeNav: string;
  activeFilter: "All" | Status;
  setActiveFilter: (filter: "All" | Status) => void;
  query: string;
  setQuery: (query: string) => void;
  onNav: (label: string) => void;
  onToast: (message?: string) => void;
  selectedDrawing: Drawing | null;
  setSelectedDrawing: (drawing: Drawing) => void;
  note: string;
  setNote: (note: string) => void;
  postNote: () => void;
  checklistDone: number;
  setChecklistDone: (value: number) => void;
  restoredCount: number;
  setRestoredCount: (value: number) => void;
  notificationsRead: boolean;
  setNotificationsRead: (value: boolean) => void;
  compactMode: boolean;
  setCompactMode: (value: boolean) => void;
};

function WorkspaceTabView({
  activeNav,
  activeFilter,
  setActiveFilter,
  query,
  setQuery,
  onNav,
  onToast,
  selectedDrawing,
  setSelectedDrawing,
  note,
  setNote,
  postNote,
  checklistDone,
  setChecklistDone,
  restoredCount,
  setRestoredCount,
  notificationsRead,
  setNotificationsRead,
  compactMode,
  setCompactMode,
}: WorkspaceTabViewProps) {
  const visible = drawings.filter((drawing) => {
    const matchesFilter = activeFilter === "All" || drawing.status === activeFilter;
    return matchesFilter && `${drawing.number} ${drawing.title} ${drawing.project} ${drawing.discipline}`.toLowerCase().includes(query.toLowerCase());
  });

  const title = activeNav === "Drawing Library" ? "Drawing Library" : activeNav;
  const descriptions: Record<string, string> = {
    "Drawing Library": "Search, filter, and open every project drawing from one working register.",
    "Work queue": "Assignments, review gates, and deadlines that need a decision.",
    Checklists: "Track issue gates and project checks without hiding the checklist workflow.",
    "My work": "Your assigned drawings, open actions, and personal progress.",
    Collaboration: "Keep project conversations, activity, and coordination notes together.",
    Notifications: "Unread mentions, approvals, assignments, and system updates.",
    Reference: "Standards, contacts, files, issues, and reports for project decisions.",
    "Recycle bin": "Restore deleted drawings during the 30-day retention window.",
    Settings: "Personal workspace preferences and display controls.",
    "Team & admin": "People, permissions, and administrator tools.",
  };

  return (
    <div className="fw-tab-view fw-animate-in">
      <div className="fw-tab-hero">
        <div>
          <div className="fw-eyebrow fw-mono"><span className="fw-eyebrow-rule" /> WORKSPACE TAB / LIVE VIEW</div>
          <h1>{title}</h1>
          <p>{descriptions[activeNav] ?? "A focused workspace for architectural drawing coordination."}</p>
        </div>
        <div className="fw-tab-actions">
          {activeNav === "Drawing Library" && <button className="fw-button fw-button-primary" onClick={() => onToast("New drawing form opened")}><Plus size={15} />New drawing</button>}
          {activeNav === "Work queue" && <button className="fw-button fw-button-primary" onClick={() => onToast("Queue refreshed")}><Check size={15} />Refresh queue</button>}
          {activeNav === "Settings" && <button className="fw-button fw-button-quiet" onClick={() => setCompactMode(!compactMode)}><SlidersHorizontal size={15} />{compactMode ? "Comfortable rows" : "Compact rows"}</button>}
        </div>
      </div>

      {activeNav === "Drawing Library" && (
        <section className="fw-tab-panel">
          <div className="fw-tab-toolbar">
            <div className="fw-search"><Search size={15} /><input aria-label="Search drawings" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search number, title, project..." /></div>
            <div className="fw-filter-tabs">
              {(["All", "In review", "Coordination", "Approved", "Issued"] as const).map((filter) => (
                <button key={filter} className={activeFilter === filter ? "is-active" : ""} onClick={() => setActiveFilter(filter)}>{filter}<span className="fw-mono">{filter === "All" ? "248" : filter === "In review" ? "12" : filter === "Coordination" ? "7" : filter === "Approved" ? "31" : "198"}</span></button>
              ))}
              <button className="fw-filter-tab-archive" onClick={() => onNav("Recycle bin")} aria-label="Open recycle bin" title="Recycle bin"><Archive size={15} /></button>
            </div>
          </div>
          <div className={`fw-table ${compactMode ? "is-compact" : ""}`}>
            <div className="fw-table-head fw-mono"><span>DRAWING</span><span>PROJECT / DISCIPLINE</span><span>STATUS</span><span>OWNER</span><span>DUE</span><span /></div>
            {visible.map((drawing) => (
              <button key={drawing.number} className={`fw-table-row ${selectedDrawing?.number === drawing.number ? "is-selected" : ""}`} onClick={() => setSelectedDrawing(drawing)}>
                <div className="fw-drawing-cell"><span className="fw-drawing-number fw-mono">{drawing.number}</span><strong>{drawing.title}</strong><span className="fw-revision fw-mono">{drawing.revision}</span></div>
                <div className="fw-project-cell"><strong>{drawing.project}</strong><span>{drawing.discipline}</span></div>
                <div><StatusPill status={drawing.status} /></div>
                <div className="fw-owner"><span className="fw-small-avatar">{drawing.owner.split(" ").map((part) => part[0]).join("")}</span>{drawing.owner}</div>
                <div className={`fw-due fw-mono ${drawing.dueTone === "soon" ? "is-soon" : ""}`}>{drawing.due}</div>
                <ChevronRight className="fw-row-chevron" size={16} />
              </button>
            ))}
            {visible.length === 0 && <div className="fw-empty"><FileArchive size={24} /><strong>No drawings match this view</strong><span>Try a different status or search term.</span></div>}
          </div>
        </section>
      )}

      {activeNav === "Projects" && (
        <section className="fw-tab-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">ACTIVE PROJECTS / 03</div><h2>Project workspaces</h2></div><button className="fw-button fw-button-primary" onClick={() => onToast("New project form opened")}><Plus size={14} />New project</button></div>
          <div className="fw-projects fw-projects-tab">
            {[
              ["Harbour House", "17 Henrietta Street, London", "TENDER / LIVE", "68%", "84 drawings · 6 in review"],
              ["Civic Arts Centre", "Kingsway, Birmingham", "CONSTRUCTION", "84%", "96 drawings · 2 in review"],
              ["North Quay Lofts", "Canal Basin, Leeds", "PLANNING", "41%", "68 drawings · 4 in review"],
            ].map(([name, address, stage, progress, summary]) => (
              <button className="fw-project-card" key={name} onClick={() => { setQuery(name); onNav("Drawing Library"); }}>
                <div className="fw-project-top"><span className="fw-project-index fw-mono">PROJECT</span><span className="fw-project-stage">{stage}</span></div>
                <strong>{name}</strong><span className="fw-project-address">{address}</span>
                <div className="fw-progress-label"><span>Package progress</span><span className="fw-mono">{progress}</span></div>
                <div className="fw-progress"><span style={{ width: progress }} /></div><small className="fw-mono">{summary}</small>
              </button>
            ))}
          </div>
        </section>
      )}

      {activeNav === "Work queue" && (
        <div className="fw-card-grid">
          {[
            ["Review queue", "12 drawings waiting for a review decision", "Open review queue", "Review Queue"],
            ["Assignments", "2 drawings are still unclaimed", "Manage assignments", "My work"],
            ["Deadlines", "4 drawing deadlines fall within the next 48 hours", "Open deadlines", "Work queue"],
          ].map(([heading, body, action, target]) => (
            <section className="fw-tab-card" key={heading}><div className="fw-card-icon"><ClipboardCheck size={17} /></div><h2>{heading}</h2><p>{body}</p><button className="fw-text-button" onClick={() => target === "Work queue" ? onToast("Deadline view refreshed") : onNav(target)}>{action}<ArrowUpRight size={13} /></button></section>
          ))}
        </div>
      )}

      {activeNav === "Checklists" && (
        <section className="fw-tab-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">CIVIC ARTS CENTRE / ISSUE GATE</div><h2>Stage 04 coordination checklist</h2></div><strong className="fw-progress-number">{checklistDone}/5 complete</strong></div>
          <div className="fw-checklist">
            {["Confirm latest consultant backgrounds", "Verify plant room route against M-301", "Resolve transfer beam coordination note", "Attach signed issue sheet", "Record client issue decision"].map((item, index) => (
              <button key={item} className={`fw-check-row ${index < checklistDone ? "is-done" : ""}`} onClick={() => setChecklistDone(index < checklistDone ? index : index + 1)}><span className="fw-check-box">{index < checklistDone && <Check size={13} />}</span><span>{item}</span><ChevronRight size={14} /></button>
            ))}
          </div>
          <button className="fw-button fw-button-primary" onClick={() => { setChecklistDone(5); onToast("Checklist marked complete"); }}><CheckCircle2 size={15} />Complete checklist</button>
        </section>
      )}

      {activeNav === "My work" && (
        <section className="fw-tab-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">MAYA CHEN / PROJECT LEAD</div><h2>My open drawing work</h2></div><span className="fw-attention-count fw-mono">07</span></div>
          {drawings.slice(0, 4).map((drawing, index) => <button className="fw-work-row" key={drawing.number} onClick={() => setSelectedDrawing(drawing)}><span className="fw-drawing-number fw-mono">{drawing.number}</span><div><strong>{drawing.title}</strong><span>{drawing.project} · {index % 2 === 0 ? "Review due today" : "Coordination follow-up"}</span></div><StatusPill status={drawing.status} /><ChevronRight size={15} /></button>)}
        </section>
      )}

      {activeNav === "Collaboration" && (
        <section className="fw-tab-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">PROJECT ACTIVITY</div><h2>Latest collaboration</h2></div><button className="fw-button fw-button-primary" onClick={postNote}><Send size={14} />Post note</button></div>
          <div className="fw-activity-list fw-tab-activity"><div className="fw-activity-row"><span className="fw-small-avatar fw-avatar-blue">DO</span><p><strong>Daniel Okafor</strong> commented on <b>S-118</b><span>“Please confirm the transfer zone is clear of the riser.”</span></p><time className="fw-mono">09:10</time></div><div className="fw-activity-row"><span className="fw-small-avatar fw-avatar-sand">LB</span><p><strong>Lucía Byrne</strong> submitted <b>A-611</b> for review<span>Revision P05 · North Quay Lofts</span></p><time className="fw-mono">08:42</time></div></div>
          <div className="fw-quick-note"><input value={note} onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") postNote(); }} placeholder="Add a coordination note..." /><button onClick={postNote} aria-label="Send note"><Send size={15} /></button></div>
        </section>
      )}

      {activeNav === "Notifications" && (
        <section className="fw-tab-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">INBOX / {notificationsRead ? "ALL READ" : "4 UNREAD"}</div><h2>Notifications</h2></div><button className="fw-text-button" onClick={() => setNotificationsRead(true)}>Mark all read <Check size={13} /></button></div>
          {["A-204 is due today", "You were assigned S-118 for coordination", "M-301 was approved by Ravi Singh", "Lucía Byrne mentioned you in a note"].map((item, index) => <button className={`fw-notification-row ${notificationsRead || index > 1 ? "is-read" : ""}`} key={item} onClick={() => setNotificationsRead(true)}><span className="fw-notification-indicator" /><div><strong>{item}</strong><span>{index === 0 ? "Harbour House · due at 16:00" : "Drawing Library · today"}</span></div><time className="fw-mono">{index + 1}h ago</time></button>)}
        </section>
      )}

      {activeNav === "Reference" && (
        <div className="fw-card-grid">
          {[["Standards", "12 office standards and issue protocols", BookOpen], ["Issue register", "8 open coordination issues across 3 projects", FileArchive], ["Files & documents", "46 shared project documents", FolderOpen], ["Contacts", "24 consultant and client contacts", UsersRound], ["Reports", "Monthly register activity and issue reports", ArrowDown]].map(([heading, body, Icon]) => <section className="fw-tab-card" key={heading as string}><div className="fw-card-icon"><Icon size={17} /></div><h2>{heading as string}</h2><p>{body as string}</p><button className="fw-text-button" onClick={() => onToast(`${heading as string} opened`)}>Open {heading as string}<ArrowUpRight size={13} /></button></section>)}
        </div>
      )}

      {activeNav === "Recycle bin" && (
        <section className="fw-tab-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">RETENTION / 30 DAYS</div><h2>Recently recycled drawings</h2></div><span className="fw-mono fw-muted-label">{Math.max(0, 3 - restoredCount)} records</span></div>
          {drawings.slice(3, 6).slice(restoredCount).map((drawing, index) => <div className="fw-work-row fw-recycle-row" key={drawing.number}><span className="fw-drawing-number fw-mono">{drawing.number}</span><div><strong>{drawing.title}</strong><span>{drawing.project} · Deleted {index + restoredCount + 1} day ago</span></div><button className="fw-button fw-button-quiet" onClick={() => { setRestoredCount(restoredCount + 1); onToast(`${drawing.number} restored to Drawing Library`); }}>Restore</button></div>)}
          {restoredCount >= 3 && <div className="fw-empty"><Archive size={24} /><strong>Recycle bin is empty</strong><span>Restored drawings return to the Drawing Library.</span></div>}
        </section>
      )}

      {activeNav === "Settings" && (
        <section className="fw-tab-panel fw-settings-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">PERSONAL WORKSPACE</div><h2>Display preferences</h2></div></div>
          <button className="fw-setting-row" onClick={() => setCompactMode(!compactMode)}><div><strong>Compact drawing rows</strong><span>Fit more drawings into the register view.</span></div><span className={`fw-toggle ${compactMode ? "is-on" : ""}`}><span /></span></button>
          <button className="fw-setting-row" onClick={() => onToast("Live updates are enabled")}><div><strong>Live activity updates</strong><span>Keep notifications and collaboration changes current.</span></div><span className="fw-toggle is-on"><span /></span></button>
          <button className="fw-setting-row" onClick={() => onToast("Preferences saved")}><div><strong>Save workspace preferences</strong><span>Your display choices are saved for this session.</span></div><Check size={16} /></button>
        </section>
      )}

      {activeNav === "Team & admin" && (
        <section className="fw-tab-panel">
          <div className="fw-list-heading"><div><div className="fw-section-kicker fw-mono">DESIGN SENSE / ADMINISTRATION</div><h2>Team directory</h2></div><button className="fw-button fw-button-primary" onClick={() => onToast("Invite flow opened")}><Plus size={14} />Invite member</button></div>
          {[["MC", "Maya Chen", "Project Lead", "4 active drawings"], ["DO", "Daniel Okafor", "Structural Lead", "8 active drawings"], ["LB", "Lucía Byrne", "Architect", "6 active drawings"], ["RS", "Ravi Singh", "Project Architect", "12 active drawings"]].map(([initials, name, role, work]) => <div className="fw-team-row" key={name}><span className="fw-avatar fw-avatar-blue">{initials}</span><div><strong>{name}</strong><span>{role} · {work}</span></div><button className="fw-text-button" onClick={() => onToast(`${name}'s profile opened`)}>View profile</button></div>)}
        </section>
      )}
    </div>
  );
}

export function FocusedWorkspace() {
  const [activeNav, setActiveNav] = useState("Overview");
  const [activeFilter, setActiveFilter] = useState<"All" | Status>("All");
  const [query, setQuery] = useState("");
  const [selectedDrawing, setSelectedDrawing] = useState<Drawing | null>(drawings[0]);
  const [mobileRailOpen, setMobileRailOpen] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("Workspace action saved locally");
  const [note, setNote] = useState("");
  const [compactMode, setCompactMode] = useState(false);
  const [checklistDone, setChecklistDone] = useState(2);
  const [restoredCount, setRestoredCount] = useState(0);
  const [notificationsRead, setNotificationsRead] = useState(false);

  const visibleDrawings = useMemo(() => drawings.filter((drawing) => {
    const matchesFilter = activeFilter === "All" || drawing.status === activeFilter;
    const matchesQuery = `${drawing.number} ${drawing.title} ${drawing.project} ${drawing.discipline}`.toLowerCase().includes(query.toLowerCase());
    return matchesFilter && matchesQuery;
  }), [activeFilter, query]);

  function chooseNav(label: string) {
    setActiveNav(label);
    setMobileRailOpen(false);
    if (label !== "Overview" && label !== "Drawing Library") {
      setSelectedDrawing(null);
    }
  }

  function showActionToast(message = "Workspace action saved locally") {
    setShowToast(true);
    window.setTimeout(() => setShowToast(false), 2400);
    setToastMessage(message);
  }

  function postNote() {
    if (!note.trim()) return;
    setNote("");
    showActionToast("Coordination note posted");
  }

  const rail = (
    <aside className="fw-rail">
      <div className="fw-brand">
        <div className="fw-mark"><Layers3 size={18} /></div>
        <div>
          <div className="fw-brand-name">DESIGN SENSE</div>
          <div className="fw-brand-sub fw-mono">ARCHITECTS / REGISTER</div>
        </div>
        <button className="fw-rail-close" onClick={() => setMobileRailOpen(false)} aria-label="Close navigation"><X size={18} /></button>
      </div>
      <div className="fw-workspace-switcher">
        <div className="fw-switcher-kicker fw-mono">CURRENT WORKSPACE</div>
          <div className="fw-switcher-row"><span className="fw-project-dot" /><strong>Drawing Library</strong><ChevronDown size={14} /></div>
        <div className="fw-switcher-meta fw-mono">3 active projects · 248 drawings</div>
      </div>
        <nav className="fw-nav">
          <div className="fw-nav-label fw-mono">ALL WORKSPACE TABS</div>
          {allNavItems.map((item) => (
            <RailItem key={item.label} {...item} active={activeNav === item.label} onClick={() => chooseNav(item.label)} />
          ))}
      </nav>
      <div className="fw-rail-bottom">
        <div className="fw-user-chip"><div className="fw-avatar">MC</div><div><strong>Maya Chen</strong><span className="fw-mono">PROJECT LEAD</span></div><MoreHorizontal size={15} /></div>
      </div>
    </aside>
  );

  return (
    <div className="fw-root">
      <div className="fw-app-shell">
        <div className={`fw-mobile-rail ${mobileRailOpen ? "is-open" : ""}`}>
          {rail}
        </div>
        <div className="fw-desktop-rail">{rail}</div>
        <main className="fw-main">
          <header className="fw-topbar">
            <div className="fw-breadcrumb">
              <button className="fw-mobile-menu" onClick={() => setMobileRailOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
              <span className="fw-breadcrumb-muted">Drawing Library</span><ChevronRight size={14} /><strong>{activeNav === "Overview" ? "Overview" : activeNav}</strong>
            </div>
            <div className="fw-top-actions">
              <div className="fw-sync"><span className="fw-sync-dot" />Live <span className="fw-mono">09:42</span></div>
              <button className="fw-icon-button" aria-label="Notifications" onClick={() => chooseNav("Notifications")}><Bell size={17} /><span className="fw-notification-dot">4</span></button>
              <button className="fw-icon-button" aria-label="Open settings" onClick={() => chooseNav("Settings")}><Settings2 size={17} /></button>
            </div>
          </header>

          <div className="fw-content">
            {activeNav !== "Overview" ? (
              <WorkspaceTabView
                activeNav={activeNav}
                activeFilter={activeFilter}
                setActiveFilter={setActiveFilter}
                query={query}
                setQuery={setQuery}
                onNav={chooseNav}
                onToast={showActionToast}
                selectedDrawing={selectedDrawing}
                setSelectedDrawing={setSelectedDrawing}
                note={note}
                setNote={setNote}
                postNote={postNote}
                checklistDone={checklistDone}
                setChecklistDone={setChecklistDone}
                restoredCount={restoredCount}
                setRestoredCount={setRestoredCount}
                notificationsRead={notificationsRead}
                setNotificationsRead={setNotificationsRead}
                compactMode={compactMode}
                setCompactMode={setCompactMode}
              />
            ) : (
            <>
            <section className="fw-heading fw-animate-in">
              <div>
                <div className="fw-eyebrow fw-mono"><span className="fw-eyebrow-rule" /> THURSDAY 13 MARCH 2025 / CONTROL ROOM</div>
                <h1>Good morning, Maya.</h1>
                <p>One register, one read. Here is the work that needs a decision today.</p>
              </div>
              <div className="fw-heading-actions">
                <button className="fw-button fw-button-quiet" onClick={() => setCompactMode(!compactMode)}><SlidersHorizontal size={15} />{compactMode ? "Comfortable rows" : "Compact rows"}</button>
                <button className="fw-button fw-button-primary" onClick={() => { setShowToast(true); window.setTimeout(() => setShowToast(false), 2400); }}><Plus size={16} />New drawing</button>
              </div>
            </section>

            <div className="fw-workspace-grid">
              <section className="fw-register-panel fw-animate-in fw-animate-delay-2">
                <div className="fw-panel-heading">
                  <div>
                    <div className="fw-section-kicker fw-mono">PRIMARY WORK SURFACE</div>
                    <h2>Drawing Library <span className="fw-heading-count fw-mono">248</span></h2>
                  </div>
                  <button className="fw-text-button" onClick={() => chooseNav("Drawing Library")}>Open full library <ArrowUpRight size={14} /></button>
                </div>
                <div className="fw-register-toolbar">
                  <div className="fw-search"><Search size={15} /><input aria-label="Search drawings" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search number, title, project..." /></div>
                  <div className="fw-filter-tabs">
                    {(["All", "In review", "Coordination", "Approved", "Issued"] as const).map((filter) => (
                      <button key={filter} className={activeFilter === filter ? "is-active" : ""} onClick={() => setActiveFilter(filter)}>{filter}<span className="fw-mono">{filter === "All" ? "248" : filter === "In review" ? "12" : filter === "Coordination" ? "7" : filter === "Approved" ? "31" : "198"}</span></button>
                    ))}
                    <button className="fw-filter-tab-archive" onClick={() => chooseNav("Recycle bin")} aria-label="Open recycle bin" title="Recycle bin"><Archive size={15} /></button>
                  </div>
                </div>
                <div className={`fw-table ${compactMode ? "is-compact" : ""}`}>
                  <div className="fw-table-head fw-mono"><span>DRAWING</span><span>PROJECT / DISCIPLINE</span><span>STATUS</span><span>OWNER</span><span>DUE</span><span /></div>
                  {visibleDrawings.map((drawing) => (
                    <button key={drawing.number} className={`fw-table-row ${selectedDrawing?.number === drawing.number ? "is-selected" : ""}`} onClick={() => setSelectedDrawing(drawing)}>
                      <div className="fw-drawing-cell"><span className="fw-drawing-number fw-mono">{drawing.number}</span><strong>{drawing.title}</strong><span className="fw-revision fw-mono">{drawing.revision}</span></div>
                      <div className="fw-project-cell"><strong>{drawing.project}</strong><span>{drawing.discipline}</span></div>
                      <div><StatusPill status={drawing.status} /></div>
                      <div className="fw-owner"><span className="fw-small-avatar">{drawing.owner.split(" ").map((part) => part[0]).join("")}</span>{drawing.owner}</div>
                      <div className={`fw-due fw-mono ${drawing.dueTone === "soon" ? "is-soon" : ""}`}>{drawing.due}</div>
                      <ChevronRight className="fw-row-chevron" size={16} />
                    </button>
                  ))}
                  {visibleDrawings.length === 0 && <div className="fw-empty"><FileArchive size={24} /><strong>No drawings match this view</strong><span>Try a different status or search term.</span></div>}
                </div>
                <div className="fw-table-footer"><span className="fw-mono">SHOWING {visibleDrawings.length} OF 248 DRAWINGS</span><button onClick={() => chooseNav("Drawing Library")}>View library <ArrowUpRight size={13} /></button></div>
              </section>

              <aside className="fw-attention fw-animate-in fw-animate-delay-3">
                <div className="fw-attention-header"><div><div className="fw-section-kicker fw-mono">DECISION LOG</div><h2>Needs attention</h2></div><span className="fw-attention-count fw-mono">04</span></div>
                <div className="fw-attention-list">
                  <button className="fw-attention-item is-urgent" onClick={() => setSelectedDrawing(drawings[0])}><div className="fw-attention-icon"><Clock3 size={15} /></div><div><strong>A-204 is due today</strong><span>Review from Maya · Harbour House</span><em className="fw-mono">16:00 / 4 hrs</em></div><ChevronRight size={15} /></button>
                  <button className="fw-attention-item" onClick={() => setSelectedDrawing(drawings[1])}><div className="fw-attention-icon"><MessageSquare size={15} /></div><div><strong>Coordination note needs reply</strong><span>Transfer beam setting out · S-118</span><em className="fw-mono">D. Okafor / 32 min</em></div><ChevronRight size={15} /></button>
                   <button className="fw-attention-item" onClick={() => chooseNav("My work")}><div className="fw-attention-icon"><UsersRound size={15} /></div><div><strong>2 assignments are unclaimed</strong><span>North Quay Lofts package</span><em className="fw-mono">MY WORK / 2 OPEN</em></div><ChevronRight size={15} /></button>
                   <button className="fw-attention-item" onClick={() => chooseNav("Checklists")}><div className="fw-attention-icon"><CheckCircle2 size={15} /></div><div><strong>Stage 04 checklist is 80%</strong><span>Civic Arts Centre · issue gate</span><em className="fw-mono">CHECKLISTS / 2 CHECKS</em></div><ChevronRight size={15} /></button>
                 </div>
                 <button className="fw-attention-footer" onClick={() => chooseNav("Collaboration")}>Open collaboration <ArrowUpRight size={13} /></button>
              </aside>
            </div>

            <section className="fw-bottom-grid fw-animate-in fw-animate-delay-3">
              <div className="fw-project-strip">
                <div className="fw-panel-heading"><div><div className="fw-section-kicker fw-mono">ACTIVE WORKSPACES</div><h2>Project pulse</h2></div><button className="fw-text-button" onClick={() => chooseNav("Projects")}>All projects <ArrowUpRight size={14} /></button></div>
                <div className="fw-projects">
                  <button className="fw-project-card is-featured" onClick={() => setQuery("Harbour House")}><div className="fw-project-top"><span className="fw-project-index fw-mono">01</span><span className="fw-project-stage">TENDER / LIVE</span></div><strong>Harbour House</strong><span className="fw-project-address">17 Henrietta Street, London</span><div className="fw-progress-label"><span>Package progress</span><span className="fw-mono">68%</span></div><div className="fw-progress"><span style={{ width: "68%" }} /></div><small className="fw-mono">84 drawings · 6 in review</small></button>
                  <button className="fw-project-card" onClick={() => setQuery("Civic Arts Centre")}><div className="fw-project-top"><span className="fw-project-index fw-mono">02</span><span className="fw-project-stage">CONSTRUCTION</span></div><strong>Civic Arts Centre</strong><span className="fw-project-address">Kingsway, Birmingham</span><div className="fw-progress-label"><span>Package progress</span><span className="fw-mono">84%</span></div><div className="fw-progress"><span style={{ width: "84%" }} /></div><small className="fw-mono">96 drawings · 2 in review</small></button>
                  <button className="fw-project-card" onClick={() => setQuery("North Quay Lofts")}><div className="fw-project-top"><span className="fw-project-index fw-mono">03</span><span className="fw-project-stage">PLANNING</span></div><strong>North Quay Lofts</strong><span className="fw-project-address">Canal Basin, Leeds</span><div className="fw-progress-label"><span>Package progress</span><span className="fw-mono">41%</span></div><div className="fw-progress"><span style={{ width: "41%" }} /></div><small className="fw-mono">68 drawings · 4 in review</small></button>
                </div>
              </div>
              <div className="fw-activity-panel">
                 <div className="fw-panel-heading"><div><div className="fw-section-kicker fw-mono">COLLABORATION</div><h2>Latest activity</h2></div><button className="fw-text-button" onClick={() => chooseNav("Collaboration")}>Open collaboration <MessageSquare size={13} /></button></div>
                <div className="fw-activity-list"><div className="fw-activity-row"><span className="fw-small-avatar fw-avatar-blue">DO</span><p><strong>Daniel Okafor</strong> commented on <b>S-118</b><span>“Please confirm the transfer zone is clear of the riser.”</span></p><time className="fw-mono">09:10</time></div><div className="fw-activity-row"><span className="fw-small-avatar fw-avatar-sand">LB</span><p><strong>Lucía Byrne</strong> submitted <b>A-611</b> for review<span>Revision P05 · North Quay Lofts</span></p><time className="fw-mono">08:42</time></div><div className="fw-activity-row"><span className="fw-small-avatar fw-avatar-green">RS</span><p><strong>Ravi Singh</strong> marked <b>M-301</b> approved<span>Civic Arts Centre · package 04</span></p><time className="fw-mono">Yesterday</time></div></div>
                <div className="fw-quick-note"><input value={note} onChange={(event) => setNote(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") postNote(); }} placeholder="Add a coordination note..." /><button onClick={postNote} aria-label="Send note"><Send size={15} /></button></div>
              </div>
            </section>
            </>
            )}
          </div>
        </main>
        {selectedDrawing && (
          <aside className="fw-detail-drawer">
            <div className="fw-drawer-head"><div><div className="fw-section-kicker fw-mono">DRAWING DETAIL</div><h2>{selectedDrawing.number}</h2></div><button onClick={() => setSelectedDrawing(null)} aria-label="Close drawing detail"><X size={17} /></button></div>
            <div className="fw-drawer-title"><h3>{selectedDrawing.title}</h3><StatusPill status={selectedDrawing.status} /></div>
            <div className="fw-drawing-preview"><div className="fw-preview-grid" /><div className="fw-preview-label fw-mono">A / {selectedDrawing.revision} / 1:100</div><div className="fw-preview-line one" /><div className="fw-preview-line two" /><div className="fw-preview-box" /></div>
            <dl className="fw-detail-list"><div><dt>Project</dt><dd>{selectedDrawing.project}</dd></div><div><dt>Discipline</dt><dd>{selectedDrawing.discipline}</dd></div><div><dt>Owner</dt><dd>{selectedDrawing.owner}</dd></div><div><dt>Due</dt><dd className={selectedDrawing.dueTone === "soon" ? "is-soon" : ""}>{selectedDrawing.due}</dd></div><div><dt>Last update</dt><dd>{selectedDrawing.updated}</dd></div></dl>
            <div className="fw-drawer-note"><div className="fw-section-kicker fw-mono">COORDINATION NOTE</div><p>{selectedDrawing.number === "S-118" ? "Transfer beam alignment needs confirmation against M-301 plant room route." : "Review mark-up is ready for your decision. No unresolved consultant comments."}</p></div>
             <div className="fw-drawer-actions"><button className="fw-button fw-button-primary" onClick={() => { setShowToast(true); window.setTimeout(() => setShowToast(false), 2400); }}><FileText size={15} />Open drawing</button><button className="fw-button fw-button-quiet" onClick={() => chooseNav("Work queue")}><ClipboardCheck size={15} />Work queue</button></div>
          </aside>
        )}
         {showToast && <div className="fw-toast"><Check size={15} />{toastMessage}<span className="fw-mono">LOCAL MOCK</span></div>}
      </div>
    </div>
  );
}

export default FocusedWorkspace;