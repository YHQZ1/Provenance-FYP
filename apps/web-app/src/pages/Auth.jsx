/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    background: "#fff",
    color: "#0a0a0a",
    minHeight: "100vh",
    width: "100vw",
    maxWidth: "100%",
    display: "flex",
    overflow: "hidden",
  },
  leftPanel: {
    width: "42%",
    flexShrink: 0,
    background: "#0a0a0a",
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    position: "relative",
    overflow: "hidden",
  },
  gridOverlay: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
    backgroundSize: "32px 32px",
    pointerEvents: "none",
  },
  rightPanel: {
    flex: 1,
    padding: "48px 40px",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
  },
  modeToggle: {
    display: "flex",
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 28,
  },
  modeButton: (active) => ({
    flex: 1,
    padding: "10px 0",
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    border: "none",
    background: active ? "#0a0a0a" : "#fafafa",
    color: active ? "#fff" : "#a3a3a3",
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  }),
  socialButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "11px 16px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "#fafafa",
    cursor: "pointer",
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "#525252",
    transition: "border-color 0.15s, background 0.15s, color 0.15s",
  },
  submitButton: (loading) => ({
    width: "100%",
    padding: "13px 0",
    background: "#0a0a0a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontFamily: "'DM Mono', monospace",
    fontSize: 11,
    fontWeight: 500,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    cursor: loading ? "not-allowed" : "pointer",
    opacity: loading ? 0.6 : 1,
    marginTop: 8,
    transition: "background 0.2s",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  }),
  errorAlert: {
    background: "var(--error-bg)",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--error)",
    marginBottom: 16,
  },
  successAlert: {
    background: "var(--success-bg)",
    border: "1px solid #a7f3d0",
    borderRadius: 8,
    padding: "12px 14px",
    fontSize: 13,
    color: "var(--success)",
    marginBottom: 16,
  },
};

const animations = `
  @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
  @keyframes spin { to { transform: rotate(360deg) } }
  @keyframes pulse { 0%, 100% { opacity: 0.35 } 50% { opacity: 1 } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
`;

function FullscreenLoader({ message }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0a0a0a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        animation: "fadeIn 0.25s ease",
      }}
    >
      <style>{animations}</style>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          border: "1.5px solid #1f1f1f",
          borderTop: "1.5px solid #059669",
          animation: "spin 0.75s linear infinite",
          marginBottom: 28,
        }}
      />
      <p
        style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#059669",
          animation: "pulse 1.6s ease-in-out infinite",
        }}
      >
        {message}
      </p>
    </div>
  );
}

function FieldWrap({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label
        style={{
          display: "block",
          fontFamily: "'DM Mono', monospace",
          fontSize: 10,
          fontWeight: 500,
          color: "#0a0a0a",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function AuthInput(props) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        fontWeight: 400,
        padding: "11px 14px",
        border: `1px solid ${focused ? "#059669" : "#e5e5e5"}`,
        borderRadius: 8,
        background: focused ? "#fff" : "#fafafa",
        color: "#0a0a0a",
        outline: "none",
        transition: "border-color 0.2s, background 0.2s",
      }}
    />
  );
}

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [transitionMessage, setTransitionMessage] =
    useState("Authenticating...");
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // ✅ FIX 1: Guard so the init effect only ever runs once,
  //    preventing double-execution on re-renders / StrictMode.
  const didInit = useRef(false);

  const API_URL = import.meta.env.VITE_API_URL;
  const navigate = useNavigate();

  const syncWithBackend = async (token) => {
    const response = await fetch(`${API_URL}/api/auth/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
    if (!response.ok) throw new Error("Failed to sync with backend");
  };

  // ✅ FIX 2: Never sign the user out on a sync failure.
  //    Just log a warning and proceed to the dashboard.
  //    Signing out here was what destroyed the session that
  //    ProtectedRoute was watching, causing the redirect loop.
  const syncSafe = async (token) => {
    try {
      await syncWithBackend(token);
    } catch (err) {
      console.warn("Backend sync failed, proceeding anyway:", err.message);
    }
  };

  const redirectToHome = (msg) => {
    setTransitionMessage(msg);
    setTransitioning(true);
    navigate("/dashboard", { replace: true });
  };

  useEffect(() => {
    // ✅ FIX 1 (continued): Bail out if already ran.
    if (didInit.current) return;
    didInit.current = true;

    const handleAuth = async () => {
      // --- Handle OAuth redirect (Google / Microsoft) ---
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");

      if (accessToken) {
        const {
          data: { session },
          error,
        } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get("refresh_token"),
        });

        if (error || !session) {
          setError("OAuth sign-in failed. Please try again.");
          setInitializing(false);
          return;
        }

        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        await syncSafe(session.access_token);
        redirectToHome("Signing in...");
        return;
      }

      // --- Handle already-logged-in user landing on /auth ---
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        // ✅ FIX 2 (continued): Don't sign out on failure — just navigate.
        await syncSafe(session.access_token);
        navigate("/dashboard", { replace: true });
        return;
      }

      setInitializing(false);
    };

    handleAuth();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setIsLogin(params.get("mode") !== "signup");
  }, []);

  const handleGoogleLogin = async () => {
    setTransitionMessage("Redirecting to Google...");
    setTransitioning(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (error) {
      setTransitioning(false);
      setError(error.message);
    }
  };

  const handleMicrosoftLogin = async () => {
    setTransitionMessage("Redirecting to Microsoft...");
    setTransitioning(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: window.location.origin + "/auth" },
    });
    if (error) {
      setTransitioning(false);
      setError(error.message);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw new Error(error.message);
        if (!data.session) throw new Error("Login failed. Please try again.");
        localStorage.setItem("sb-access-token", data.session.access_token);
        await syncSafe(data.session.access_token);
        redirectToHome("Signing in...");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { company_name: companyName, gst_number: gstNumber },
          },
        });
        if (error) throw new Error(error.message);
        if (!data.session) {
          setMessage(
            "Check your email to confirm your account before signing in.",
          );
          setLoading(false);
          return;
        }
        localStorage.setItem("sb-access-token", data.session.access_token);
        await syncSafe(data.session.access_token);
        redirectToHome("Creating your workspace...");
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMessage("Password reset link sent to your email.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    const nextMode = isLogin ? "signup" : "login";
    setIsLogin(!isLogin);
    setError(null);
    setMessage(null);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set("mode", nextMode);
    window.history.replaceState({}, "", newUrl);
  };

  if (initializing || transitioning) {
    return (
      <FullscreenLoader
        message={transitioning ? transitionMessage : "Loading..."}
      />
    );
  }

  return (
    <div style={styles.container}>
      <style>{animations}</style>

      <div style={styles.leftPanel}>
        <div style={styles.gridOverlay} />
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 48,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#059669",
              }}
            />
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#fff",
              }}
            >
              Provenance
            </span>
          </div>
          <h2
            style={{
              fontSize: 36,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.1,
              color: "#fff",
              maxWidth: 280,
            }}
          >
            The immutable ledger for your compliance posture.
          </h2>
        </div>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            borderTop: "1px solid #1f1f1f",
            paddingTop: 20,
          }}
        >
          <p
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: 10,
              color: "#059669",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            System_Status
          </p>
          <p style={{ fontSize: 13, color: "#737373", fontWeight: 400 }}>
            All telemetry pipelines active.
          </p>
        </div>
      </div>

      <div style={styles.rightPanel}>
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontFamily: "'DM Mono', monospace",
            fontSize: 11,
            fontWeight: 500,
            color: "#a3a3a3",
            textDecoration: "none",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            marginBottom: 40,
            transition: "color 0.15s",
          }}
          className="hover:text-[#0a0a0a]"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to website
        </Link>

        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: "100%",
            maxWidth: 480,
            margin: "0 auto",
          }}
        >
          <div style={styles.modeToggle}>
            {[
              { label: "Sign In", mode: true },
              { label: "Create Workspace", mode: false },
            ].map(({ label, mode }) => (
              <button
                key={label}
                onClick={() => {
                  setIsLogin(mode);
                  setError(null);
                  setMessage(null);
                }}
                style={styles.modeButton(isLogin === mode)}
              >
                {label}
              </button>
            ))}
          </div>

          <p
            style={{
              fontSize: 14,
              color: "#737373",
              fontWeight: 400,
              lineHeight: 1.5,
              marginBottom: 28,
            }}
          >
            {isLogin
              ? "Enter your credentials to access your enterprise dashboard."
              : "Set up your workspace to begin syncing telemetry data."}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
              marginBottom: 24,
            }}
          >
            {[
              {
                label: "Google",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                ),
                onClick: handleGoogleLogin,
              },
              {
                label: "Microsoft",
                icon: (
                  <svg width="16" height="16" viewBox="0 0 21 21">
                    <path d="M1 1h9v9H1z" fill="#F25022" />
                    <path d="M11 1h9v9h-9z" fill="#7FBA00" />
                    <path d="M1 11h9v9H1z" fill="#00A4EF" />
                    <path d="M11 11h9v9h-9z" fill="#FFB900" />
                  </svg>
                ),
                onClick: handleMicrosoftLogin,
              },
            ].map(({ label, icon, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                disabled={loading}
                style={styles.socialButton}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = "#d4d4d4";
                  e.currentTarget.style.color = "#0a0a0a";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = "#e5e5e5";
                  e.currentTarget.style.color = "#525252";
                }}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 24,
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
            <span
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "#a3a3a3",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                whiteSpace: "nowrap",
              }}
            >
              or continue with email
            </span>
            <div style={{ flex: 1, height: 1, background: "#f0f0f0" }} />
          </div>

          {error && <div style={styles.errorAlert}>{error}</div>}
          {message && <div style={styles.successAlert}>{message}</div>}

          <form onSubmit={handleEmailAuth}>
            {!isLogin && (
              <>
                <FieldWrap label="Company Name">
                  <AuthInput
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Acme Industries Pvt Ltd"
                    required
                  />
                </FieldWrap>
                <FieldWrap label="GST Number">
                  <AuthInput
                    type="text"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="22AAAAA0000A1Z5"
                    required
                  />
                </FieldWrap>
              </>
            )}
            <FieldWrap label="Work Email">
              <AuthInput
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@enterprise.com"
                required
              />
            </FieldWrap>
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    fontWeight: 500,
                    color: "#0a0a0a",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Password
                </span>
                {isLogin && (
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: 10,
                      fontWeight: 500,
                      color: "#059669",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                    }}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <AuthInput
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={styles.submitButton(loading)}
              onMouseOver={(e) => {
                if (!loading) e.currentTarget.style.background = "#1a1a1a";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#0a0a0a";
              }}
            >
              {loading ? (
                <>
                  <span
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: "1.5px solid rgba(255,255,255,0.25)",
                      borderTop: "1.5px solid #fff",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Processing...
                </>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Workspace"
              )}
            </button>
          </form>

          <p
            style={{
              textAlign: "center",
              marginTop: 20,
              fontSize: 13,
              color: "#737373",
            }}
          >
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              type="button"
              onClick={toggleMode}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                color: "#0a0a0a",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              {isLogin ? "Create Workspace" : "Sign In"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
