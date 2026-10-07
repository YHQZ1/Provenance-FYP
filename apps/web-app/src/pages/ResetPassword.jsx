import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Alert, Button, Field, Input } from "../components/ui";
import AuthLayout from "../components/AuthLayout";

const MIN_LENGTH = 8;

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSession, setHasSession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session)));
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setHasSession(true);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const mismatch = confirmPassword && password !== confirmPassword;
  const tooShort = password && password.length < MIN_LENGTH;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (mismatch || tooShort) return;
    setLoading(true);
    setError("");
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    navigate("/dashboard", { replace: true });
  };

  return (
    <AuthLayout>
      <p className="mono text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-700">
        Account recovery
      </p>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight">Set a new password</h2>
      <p className="mt-2 text-neutral-600">
        Choose a password with at least {MIN_LENGTH} characters.
      </p>

      {hasSession === false ? (
        <div className="mt-6 space-y-4">
          <Alert tone="warn" title="This reset link is invalid or has expired">
            Request a new link from the sign-in page.
          </Alert>
          <Button to="/auth?mode=login" variant="primary" className="w-full">
            Back to sign in
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field
            label="New password"
            htmlFor="password"
            error={tooShort ? `Use at least ${MIN_LENGTH} characters.` : null}
          >
            <div className="relative">
              <Input
                id="password"
                type={visible ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setVisible((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
                aria-label={visible ? "Hide password" : "Show password"}
              >
                {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </Field>
          <Field
            label="Confirm password"
            htmlFor="confirm"
            error={mismatch ? "Passwords don't match." : null}
          >
            <Input
              id="confirm"
              type={visible ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            className="h-11 w-full"
            loading={loading}
            disabled={!password || mismatch || tooShort}
          >
            Update password
          </Button>
          <p className="text-center text-sm text-neutral-500">
            <Link to="/auth?mode=login" className="underline underline-offset-2">
              Back to sign in
            </Link>
          </p>
        </form>
      )}
    </AuthLayout>
  );
}
