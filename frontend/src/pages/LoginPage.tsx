import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { roleHome } from "../components/auth/ProtectedRoute";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState("executive@smartflow.ai");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  if (user) return <Navigate to={roleHome(user.role)} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setWorking(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const lower = raw.toLowerCase();
      if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
        setError("Cannot reach the API. Start the backend (port 8000) and keep the Vite dev server proxy to /api.");
      } else if (raw.includes("401") || lower.includes("invalid credentials")) {
        setError(
          "Invalid email or password. Demo accounts (password demo1234): executive@smartflow.ai, operations@smartflow.ai, inventory@smartflow.ai, supplier@smartflow.ai — restart the API once so demo users sync.",
        );
      } else {
        setError(raw || "Sign-in failed.");
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-2xl">
        <h1 className="text-2xl font-semibold text-white">SmartFlow AI Login</h1>
        <p className="mt-1 text-sm text-slate-400">Role-based supply chain control tower</p>
        <div className="mt-5 space-y-3">
          <input aria-label="Email" placeholder="Email address" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input aria-label="Password" placeholder="Password" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error ? <p className="mt-3 text-sm text-rose-400">{error}</p> : null}
        <button type="submit" disabled={working} className="mt-5 w-full rounded-lg bg-blue-600 px-3 py-2 font-medium text-white hover:bg-blue-500 disabled:opacity-60">
          {working ? "Signing in..." : "Sign in"}
        </button>
        <p className="mt-4 text-xs text-slate-500">
          Password for all: <span className="font-mono text-slate-400">demo1234</span>
          <br />
          Emails: executive@, operations@, inventory@, supplier@ — all <span className="font-mono">smartflow.ai</span>
        </p>
      </form>
    </div>
  );
}
