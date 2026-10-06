import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Alert, Button, Field, Input } from "../components/ui";
import AuthLayout from "../components/AuthLayout";
import BrandedLoader from "../components/BrandedLoader";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/;
const MIN_PASSWORD = 8;

const cx = (...classes) => classes.filter(Boolean).join(" ");

const readParams = () => new URLSearchParams(window.location.search);

// Creates the company record for a new user; signing in still works if it fails.
const syncWithBackend = async (token) => {
  try {
    await fetch(`${API_URL}/api/auth/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    console.warn("Backend sync failed, continuing:", error.message);
  }
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
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
  );
}

function MicrosoftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden>
      <path d="M1 1h9v9H1z" fill="#F25022" />
      <path d="M11 1h9v9h-9z" fill="#7FBA00" />
      <path d="M1 11h9v9H1z" fill="#00A4EF" />
      <path d="M11 11h9v9h-9z" fill="#FFB900" />
    </svg>
  );
}

// Supabase's raw messages ("Email address … is invalid") read like a bug; say what happened instead.
const friendlyAuthError = (error) => {
  const code = error?.code || "";
  const text = error?.message || "Something went wrong. Please try again.";
  if (
    code === "email_address_invalid" ||
    /email address .* is invalid/i.test(text)
  ) {
    return "We can't send email to this address. Check it's an inbox you can receive mail at, or ask your administrator to reset your password.";
  }
  if (code === "over_email_send_rate_limit" || /rate limit/i.test(text)) {
    return "Too many emails have been sent recently. Wait a few minutes, then try again.";
  }
  if (
    code === "invalid_credentials" ||
    /invalid login credentials/i.test(text)
  ) {
    return "That email and password don't match. Check them, or reset your password.";
  }
  if (code === "email_not_confirmed" || /email not confirmed/i.test(text)) {
    return "Confirm your email first. Open the link we sent when you created your account.";
  }
  if (code === "user_already_exists" || /already registered/i.test(text)) {
    return "An account with this email already exists. Sign in instead.";
  }
  return text;
};

function FullscreenLoader({ message }) {
  return <BrandedLoader message={message} />;
}

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const destination = location.state?.from || "/dashboard";

  // "form" is sign in / create account; "forgot" asks for an email; "reset-sent" confirms it went out.
  const [view, setView] = useState(() =>
    readParams().get("mode") === "forgot" ? "forgot" : "form",
  );
  const [resetSentTo, setResetSentTo] = useState(null);
  const [resendIn, setResendIn] = useState(0);
  const [isLogin, setIsLogin] = useState(
    () => readParams().get("mode") !== "signup",
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(() => readParams().get("email") || "");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [transition, setTransition] = useState(null);
  const [error, setError] = useState(() =>
    readParams().get("expired")
      ? "Your session expired. Please sign in again."
      : null,
  );
  const [message, setMessage] = useState(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState(null);
  const didInit = useRef(false);

  const enterApp = (label) => {
    setTransition(label);
    navigate(destination, { replace: true });
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    const init = async () => {
      // Returning from Google or Microsoft: the session arrives in the URL hash.
      const hash = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hash.get("access_token");
      if (accessToken) {
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hash.get("refresh_token"),
        });
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );
        if (sessionError || !data.session) {
          setError(
            "Signing in with that account didn't work. Please try again.",
          );
          setInitializing(false);
          return;
        }
        await syncWithBackend(data.session.access_token);
        enterApp("Signing in…");
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (data.session) {
        await syncWithBackend(data.session.access_token);
        navigate(destination, { replace: true });
        return;
      }
      setInitializing(false);
    };

    init();
    // Runs once on mount; navigation targets are read from the initial location.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setModeInUrl = (mode) => {
    const url = new URL(window.location.href);
    url.searchParams.set("mode", mode);
    url.searchParams.delete("expired");
    window.history.replaceState({}, "", url);
  };

  const switchMode = (login) => {
    setIsLogin(login);
    setView("form");
    setError(null);
    setMessage(null);
    setModeInUrl(login ? "login" : "signup");
  };

  const openForgot = () => {
    setView("forgot");
    setError(null);
    setMessage(null);
    setModeInUrl("forgot");
  };

  // Counts down the "Resend link" cooldown.
  useEffect(() => {
    if (resendIn <= 0) return undefined;
    const timer = setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const signInWith = async (provider, label) => {
    setTransition(`Redirecting to ${label}…`);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (oauthError) {
      setTransition(null);
      setError(friendlyAuthError(oauthError));
    }
  };

  const gst = gstNumber.trim().toUpperCase();
  const gstError =
    !isLogin && gst && !GSTIN_PATTERN.test(gst)
      ? "Enter a valid 15-character GSTIN, or leave it blank for now."
      : null;
  const passwordError =
    !isLogin && password && password.length < MIN_PASSWORD
      ? `Use at least ${MIN_PASSWORD} characters.`
      : null;

  const submit = async (event) => {
    event.preventDefault();
    if (gstError || passwordError) return;
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (isLogin) {
        const { data, error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await syncWithBackend(data.session.access_token);
        enterApp("Signing in…");
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            company_name: companyName.trim(),
            gst_number: gst || null,
          },
          emailRedirectTo: `${window.location.origin}/auth?mode=login`,
        },
      });
      if (signUpError) throw signUpError;
      if (!data.session) {
        setConfirmationSentTo(email);
        setLoading(false);
        return;
      }
      await syncWithBackend(data.session.access_token);
      enterApp("Setting up your workspace…");
    } catch (submitError) {
      setError(friendlyAuthError(submitError));
      setLoading(false);
    }
  };

  const sendReset = async (event) => {
    event?.preventDefault();
    const address = email.trim();
    if (!address) {
      setError("Enter the email you sign in with.");
      return;
    }
    setLoading(true);
    setError(null);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      address,
      {
        redirectTo: `${window.location.origin}/reset-password`,
      },
    );
    setLoading(false);
    if (resetError) {
      setError(friendlyAuthError(resetError));
      return;
    }
    setResetSentTo(address);
    setResendIn(30);
    setView("reset-sent");
  };

  if (initializing || transition) {
    return <FullscreenLoader message={transition || "Loading…"} />;
  }

  return (
    <AuthLayout>
      <>
        {view === "forgot" ? (
          <div>
            <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
              Account recovery
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Reset your password
            </h2>
            <p className="mt-2 text-neutral-600">
              Enter the email you sign in with and we'll send you a link to set
              a new password.
            </p>
            <form onSubmit={sendReset} className="mt-8 space-y-4">
              {error && <Alert tone="error">{error}</Alert>}
              <Field label="Email" htmlFor="reset-email">
                <Input
                  id="reset-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@company.com"
                  autoFocus
                  required
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                className="h-11 w-full"
                loading={loading}
              >
                Send reset link
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-neutral-500">
              Remembered it?{" "}
              <button
                type="button"
                onClick={() => switchMode(true)}
                className="font-medium text-neutral-950 underline underline-offset-4 hover:text-emerald-700"
              >
                Back to sign in
              </button>
            </p>
          </div>
        ) : view === "reset-sent" ? (
          <div>
            <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
              Check your inbox
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Reset link sent
            </h2>
            <p className="mt-3 text-neutral-600">
              If an account exists for{" "}
              <span className="font-medium text-neutral-950">
                {resetSentTo}
              </span>
              , you'll get an email with a link to set a new password. It can
              take a minute, so check your spam folder too.
            </p>
            {error && (
              <div className="mt-6">
                <Alert tone="error">{error}</Alert>
              </div>
            )}
            <Button
              variant="primary"
              className="mt-8 h-11 w-full"
              onClick={() => switchMode(true)}
            >
              Back to sign in
            </Button>
            <p className="mt-6 text-center text-sm text-neutral-500">
              Didn't get it?{" "}
              <button
                type="button"
                onClick={() => sendReset()}
                disabled={resendIn > 0 || loading}
                className="font-medium text-neutral-950 underline underline-offset-4 hover:text-emerald-700 disabled:cursor-not-allowed disabled:text-neutral-400 disabled:no-underline"
              >
                {resendIn > 0 ? `Resend link in ${resendIn}s` : "Resend link"}
              </button>
            </p>
          </div>
        ) : confirmationSentTo ? (
          <div>
            <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
              Check your inbox
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              Confirm your email
            </h2>
            <p className="mt-3 text-neutral-600">
              We sent a confirmation link to{" "}
              <span className="font-medium text-neutral-950">
                {confirmationSentTo}
              </span>
              . Open it to activate your account, then sign in.
            </p>
            <Button
              variant="primary"
              className="mt-8 w-full"
              onClick={() => {
                setConfirmationSentTo(null);
                setPassword("");
                switchMode(true);
              }}
            >
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
              {isLogin ? "Welcome back" : "Get started"}
            </p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight">
              {isLogin ? "Sign in to Provenance" : "Create your account"}
            </h2>
            <p className="mt-2 text-neutral-600">
              {isLogin
                ? "Pick up your EPR filing where you left off."
                : "Set up your company and start with this year's invoices."}
            </p>

            <div
              className="relative mt-6 grid grid-cols-2 rounded-md border border-neutral-200 p-1"
              role="tablist"
              aria-label="Account"
            >
              {/* The highlight slides between the two tabs instead of jumping. */}
              <span
                aria-hidden
                className={cx(
                  "absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-sm bg-neutral-950 transition-transform duration-300 ease-out motion-reduce:transition-none",
                  isLogin ? "translate-x-0" : "translate-x-full",
                )}
              />
              {[
                [true, "Sign in"],
                [false, "Create account"],
              ].map(([login, label]) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={isLogin === login}
                  onClick={() => switchMode(login)}
                  className={cx(
                    "relative z-10 rounded-sm py-2 text-sm font-medium transition-colors duration-300",
                    isLogin === login
                      ? "text-white"
                      : "text-neutral-500 hover:text-neutral-950",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button
                onClick={() => signInWith("google", "Google")}
                disabled={loading}
              >
                <GoogleIcon /> Google
              </Button>
              <Button
                onClick={() => signInWith("azure", "Microsoft")}
                disabled={loading}
              >
                <MicrosoftIcon /> Microsoft
              </Button>
            </div>

            <div className="my-5 flex items-center gap-4">
              <span className="h-px flex-1 bg-neutral-200" />
              <span className="mono text-[11px] uppercase tracking-[0.14em] text-neutral-400">
                or with email
              </span>
              <span className="h-px flex-1 bg-neutral-200" />
            </div>

            <div className="space-y-3">
              {error && <Alert tone="error">{error}</Alert>}
              {message && <Alert tone="ok">{message}</Alert>}
            </div>

            <form
              onSubmit={submit}
              className={cx((error || message) && "mt-4")}
            >
              {/* Sign-up fields expand and collapse in place instead of popping in. */}
              <div
                className={cx(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none",
                  isLogin
                    ? "grid-rows-[0fr] opacity-0"
                    : "grid-rows-[1fr] opacity-100",
                )}
                inert={isLogin}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-4 pb-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Your name" htmlFor="full-name">
                        <Input
                          id="full-name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          autoComplete="name"
                          required={!isLogin}
                        />
                      </Field>
                      <Field label="Company name" htmlFor="company-name">
                        <Input
                          id="company-name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          autoComplete="organization"
                          required={!isLogin}
                        />
                      </Field>
                    </div>
                    <Field
                      label={
                        <>
                          GSTIN{" "}
                          <span className="font-normal text-neutral-500">
                            (optional, needed before finalizing)
                          </span>
                        </>
                      }
                      htmlFor="gstin"
                      error={gstError}
                    >
                      <Input
                        id="gstin"
                        value={gstNumber}
                        onChange={(e) =>
                          setGstNumber(e.target.value.toUpperCase())
                        }
                        maxLength={15}
                        placeholder="27ABCDE1234F1Z5"
                        className="mono uppercase"
                      />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <Field label={isLogin ? "Email" : "Work email"} htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    placeholder="you@company.com"
                    required
                  />
                </Field>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-neutral-800"
                    >
                      Password
                    </label>
                    {isLogin ? (
                      <button
                        type="button"
                        onClick={openForgot}
                        className="text-sm font-medium text-emerald-700 hover:text-emerald-600"
                      >
                        Forgot password?
                      </button>
                    ) : (
                      <span className="text-xs text-neutral-500">
                        At least {MIN_PASSWORD} characters
                      </span>
                    )}
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={isLogin ? "current-password" : "new-password"}
                    required
                  />
                  {passwordError && (
                    <p className="text-xs text-red-600">{passwordError}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  className="h-11 w-full"
                  loading={loading}
                >
                  {isLogin ? "Sign in" : "Create account"}
                </Button>
              </div>
            </form>

            <p className="mt-6 text-center text-sm text-neutral-500">
              {isLogin ? "New to Provenance? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => switchMode(!isLogin)}
                className="font-medium text-neutral-950 underline underline-offset-4 hover:text-emerald-700"
              >
                {isLogin ? "Create an account" : "Sign in"}
              </button>
            </p>
          </>
        )}
      </>
    </AuthLayout>
  );
}
