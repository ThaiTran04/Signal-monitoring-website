import { useEffect, useState } from "react";
import { Sidebar } from "../components/layout/Sidebar";
import { Header } from "../components/layout/Header";
import { LoginPage } from "../pages/LoginPage";
import { DashboardPage } from "../pages/DashboardPage";
import { SetupPage } from "../pages/SetupPage";
import { ConnectionHistoryPage } from "../pages/ConnectionHistoryPage";
import { MachineDetailPage } from "../pages/MachineDetailPage";
import { useAuth } from "../hooks/useAuth";
import { useMachines } from "../hooks/useMachines";
import type { Machine, Page } from "../types";

// Remembers which page (and, for Machine Detail, which machine) the user was
// on so a browser refresh (Ctrl+R) lands back where they were instead of
// always resetting to Dashboard IO — plain React state doesn't survive a
// full page reload, so this has to live in localStorage instead.
const PAGE_KEY = "hmi_last_page";
const MACHINE_ID_KEY = "hmi_last_machine_id";
const VALID_PAGES: Page[] = ["dashboard", "setup", "history", "detail"];

function readSavedPage(): Page {
  const saved = window.localStorage.getItem(PAGE_KEY);
  return (VALID_PAGES as string[]).includes(saved ?? "") ? (saved as Page) : "dashboard";
}

export default function App() {
  const { isAuthenticated, username, checking, loginError, login, logout } = useAuth();
  const [page, setPage] = useState<Page>(readSavedPage);
  const [machine, setMachine] = useState<Machine | null>(null);
  // Guards the one-time restore below so it doesn't keep bouncing back to
  // Dashboard while the machine list is still loading right after a refresh.
  const [machineRestored, setMachineRestored] = useState(false);

  // Only fetch machines once the session-restore check has finished AND the
  // user is actually authenticated — see useMachines.ts for why this gate
  // matters (avoids a premature 401 that never gets retried).
  const { machines, loading, error, wsConnected } = useMachines(!checking && isAuthenticated);

  // Persist the current page on every navigation, including the very first
  // render, so a refresh always has the latest value to read back.
  useEffect(() => {
    window.localStorage.setItem(PAGE_KEY, page);
  }, [page]);

  // After a refresh, `page` can come back as "detail" (from localStorage)
  // but `machine` is always null again (React state, not persisted) — look
  // the saved machine id up in the freshly-loaded machines list once, and
  // fall back to Dashboard if it's gone (e.g. the device was deleted).
  useEffect(() => {
    if (machineRestored || page !== "detail" || loading) return;
    const savedId = window.localStorage.getItem(MACHINE_ID_KEY);
    const found = savedId ? machines.find((m) => String(m.id) === savedId) : undefined;
    if (found) {
      setMachine(found);
    } else {
      setPage("dashboard");
    }
    setMachineRestored(true);
  }, [page, loading, machines, machineRestored]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#F1F3F7" }}>
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} loginError={loginError} />;
  }

  function go(p: Page) {
    setPage(p);
    if (p !== "detail") {
      setMachine(null);
      window.localStorage.removeItem(MACHINE_ID_KEY);
    }
  }

  function openMachine(m: Machine) {
    setMachine(m);
    setPage("detail");
    window.localStorage.setItem(MACHINE_ID_KEY, String(m.id));
  }

  // Keep the currently-viewed machine's status fresh as realtime updates land.
  const liveMachine = machine ? machines.find((m) => m.id === machine.id) ?? machine : null;

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#F1F3F7", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar page={page} onNavigate={go} onLogout={logout} wsConnected={wsConnected} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header page={page} machines={machines} username={username} onBack={() => go("dashboard")} onSelect={openMachine} />
        <main className="flex-1 overflow-auto p-6">
          {page === "dashboard" && (
            <DashboardPage machines={machines} loading={loading} error={error} onMachineClick={openMachine} />
          )}
          {page === "setup" && <SetupPage machines={machines} loading={loading} error={error} />}
          {page === "history" && <ConnectionHistoryPage />}
          {page === "detail" && liveMachine && <MachineDetailPage machine={liveMachine} />}
        </main>
      </div>
    </div>
  );
}
