import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

const API_URL = import.meta.env.VITE_API_URL;

async function syncBackendCookie(token) {
  try {
    const res = await fetch(`${API_URL}/api/auth/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // ← required so the cookie is actually saved
      body: JSON.stringify({ token }),
    });
    if (!res.ok) console.warn("Backend sync returned", res.status);
  } catch (e) {
    console.warn("Backend sync failed:", e.message);
  }
}

function Spinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "#fff",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "2px solid var(--border)",
          borderTopColor: "var(--success)",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  // "loading"  → still checking session + syncing cookie
  // "ready"    → session confirmed, cookie set, safe to render
  // "unauth"   → no session, redirect to login
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let mounted = true;

    async function init() {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;

      if (!session) {
        if (mounted) setStatus("unauth");
        return;
      }

      // Ensure the httpOnly cookie is set BEFORE children mount and fire API calls.
      // Without this, Dashboard's API calls race ahead with no cookie → 401.
      localStorage.setItem("sb-access-token", session.access_token);
      await syncBackendCookie(session.access_token);

      if (mounted) setStatus("ready");
    }

    init();

    // Also handle token refresh — Supabase rotates tokens silently.
    // Re-sync the cookie whenever the session changes so it never goes stale.
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          if (mounted) setStatus("unauth");
          return;
        }
        localStorage.setItem("sb-access-token", session.access_token);
        await syncBackendCookie(session.access_token);
        if (mounted) setStatus("ready");
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") return <Spinner />;
  if (status === "unauth") return <Navigate to="/auth?mode=login" replace />;
  return children;
}
