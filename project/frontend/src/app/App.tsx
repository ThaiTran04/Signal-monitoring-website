import { useState } from "react";
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

export default function App() {
  const { isAuthenticated, username, checking, loginError, login, logout } = useAuth();
  const [page, setPage] = useState<Page>("dashboard");
  const [machine, setMachine] = useState<Machine | null>(null);

  // Only fetch machines once the session-restore check has finished AND the
  // user is actually authenticated — see useMachines.ts for why this gate
  // matters (avoids a premature 401 that never gets retried).
  const { machines, loading, error, wsConnected } = useMachines(!checking && isAuthenticated);

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
    if (p !== "detail") setMachine(null);
  }

  function openMachine(m: Machine) {
    setMachine(m);
    setPage("detail");
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
