import { useState } from "react";
import { Activity, AlertCircle } from "lucide-react";
import { MONO } from "../utils/constants";

export interface LoginPageProps {
  onLogin: (username: string, password: string) => Promise<boolean>;
  loginError?: string | null;
}

export function LoginPage({ onLogin, loginError }: LoginPageProps) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [localErr, setLocalErr] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLocalErr(false);
    const ok = await onLogin(u, p);
    setSubmitting(false);
    if (!ok) setLocalErr(true);
  }

  const err = localErr || !!loginError;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#F1F3F7", fontFamily: "'Inter', sans-serif" }}
    >
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm w-80 p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0">
            <Activity size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-gray-900 leading-tight">HMI Monitor</div>
            <div className="text-[10px] text-gray-400 leading-tight" style={{ fontFamily: MONO }}>
              v2.4.1 · ESP32 System
            </div>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-0.5">Sign in</h2>
        <p className="text-xs text-gray-500 mb-6">Industrial monitoring access</p>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Username</label>
            <input
              type="text"
              value={u}
              onChange={(e) => {
                setU(e.target.value);
                setLocalErr(false);
              }}
              placeholder="Enter username"
              autoComplete="username"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
            <input
              type="password"
              value={p}
              onChange={(e) => {
                setP(e.target.value);
                setLocalErr(false);
              }}
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            />
          </div>
          {err && (
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle size={12} />
              Invalid username or password
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="text-xs text-center text-gray-400 mt-5">
          Demo:{" "}
          <span style={{ fontFamily: MONO }} className="text-gray-600">
            admin
          </span>{" "}
          /{" "}
          <span style={{ fontFamily: MONO }} className="text-gray-600">
            admin
          </span>
        </p>
      </div>
    </div>
  );
}
