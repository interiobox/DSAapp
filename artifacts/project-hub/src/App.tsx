import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from "wouter";

import type { PortalUser } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/layouts/AppLayout";
import AdminPage from "@/pages/Admin";
import Assignments from "@/pages/Assignments";
import ChecklistsPage from "@/pages/Checklists";
import ChatPage from "@/pages/Chat";
import DrawingDetail from "@/pages/DrawingDetail";
import DrawingList from "@/pages/DrawingList";
import ProjectDetail from "@/pages/ProjectDetail";
import MyFeed from "@/pages/MyFeed";
import NotFound from "@/pages/not-found";
import UsersPage from "@/pages/Users";
import { Activity, Archive, Deadlines, Projects, ReviewQueue } from "@/pages/WorkspaceViews";
import { Issues, Notifications, Reports, Standards, Team } from "@/pages/ManagementViews";
import SettingsPage from "@/pages/Settings";
import Dashboard from "@/pages/Dashboard";
import ContactsPage from "@/pages/Contacts";
import AttendancePage from "@/pages/Attendance";
import GalleryPage from "@/pages/Gallery";
import { Layers } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

type AuthContextValue = {
  user: PortalUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<PortalUser>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function usePortalAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("usePortalAuth must be used inside AuthProvider");
  return context;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetch("/api/auth/me", { credentials: "include" })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<PortalUser>;
      })
      .then((currentUser) => {
        if (mounted) setUser(currentUser);
      })
      .catch(() => {
        if (mounted) setUser(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    async login(username, password) {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | PortalUser | null;
      if (!response.ok) throw new Error(payload && "error" in payload ? payload.error : "Unable to sign in");
      setUser(payload as PortalUser);
      queryClient.clear();
      return payload as PortalUser;
    },
    async logout() {
      try {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      } finally {
        setUser(null);
        queryClient.clear();
      }
    },
  }), [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function AuthLanding() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-primary shadow-sm border border-primary/20">
          <Layers className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Design Sense Architects</h1>
          <p className="mt-2 text-sm text-muted-foreground">Drawing Library & Coordination</p>
        </div>
        <div className="rounded-sm border border-border/80 bg-card p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground mb-6">Sign in to manage the register, assignments, reviews, and your personal feed.</p>
          <ButtonLink href="/sign-in">Sign in</ButtonLink>
        </div>
      </div>
    </div>
  );
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex h-10 w-full items-center justify-center rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
      {children}
    </Link>
  );
}

function SignInPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading, login } = usePortalAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isLoading && user) return <Redirect to="/dashboard" />;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await login(username, password);
      setLocation("/dashboard");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Unable to sign in");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-sm bg-primary shadow-sm border border-primary/20">
          <Layers className="h-7 w-7 text-primary-foreground" />
        </div>
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in to access your workspace.</p>
        </div>
        <div className="rounded-sm border border-border/80 bg-card p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Username</label>
              <input id="username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="flex h-10 w-full rounded-sm border border-border/80 bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" required />
            </div>
            <div>
              <label htmlFor="password" className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-mono">Password</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className="flex h-10 w-full rounded-sm border border-border/80 bg-background px-3 py-2 text-sm outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring" required />
            </div>
            {error && <p role="alert" className="rounded-sm border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">{error}</p>}
            <button type="submit" disabled={isSubmitting} className="mt-2 inline-flex h-10 w-full items-center justify-center rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60">
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">Accounts are created and managed by administrators.</p>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user, isLoading } = usePortalAuth();
  if (isLoading) return <LoadingScreen />;
  return user ? <Redirect to="/dashboard" /> : <AuthLanding />;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-[100dvh] flex-col gap-4 items-center justify-center bg-background">
      <Layers className="h-8 w-8 text-primary animate-pulse" />
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Loading workspace...</div>
    </div>
  );
}

function AdminUsersRoute() {
  const { user } = usePortalAuth();
  return user?.role === "admin" ? <UsersPage /> : <Redirect to="/drawings" />;
}

function AttendanceRoute() {
  return <AttendancePage />;
}

function ProtectedRoutes() {
  const { user, isLoading } = usePortalAuth();
  if (isLoading) return <LoadingScreen />;
  if (!user) return <Redirect to="/sign-in" />;
  return (
    <AppLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/drawings" component={DrawingList} />
        <Route path="/drawings/:id" component={DrawingDetail} />
        <Route path="/assignments" component={Assignments} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:projectName" component={ProjectDetail} />
        <Route path="/review-queue" component={ReviewQueue} />
        <Route path="/activity" component={Activity} />
        <Route path="/deadlines" component={Deadlines} />
        <Route path="/archive" component={Archive} />
        <Route path="/checklists" component={ChecklistsPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/reports" component={Reports} />
        <Route path="/standards" component={Standards} />
        <Route path="/issues" component={Issues} />
        <Route path="/files"><Redirect to="/drawings" /></Route>
        <Route path="/team" component={Team} />
        <Route path="/contacts" component={ContactsPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/users" component={AdminUsersRoute} />
        <Route path="/feed" component={MyFeed} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/attendance" component={AttendanceRoute} />
        <Route path="/gallery" component={GalleryPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomeRedirect} />
      <Route path="/sign-in" component={SignInPage} />
      <Route path="/sign-up" component={SignInPage} />
      <Route component={ProtectedRoutes} />
    </Switch>
  );
}

export default function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Router />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </WouterRouter>
  );
}