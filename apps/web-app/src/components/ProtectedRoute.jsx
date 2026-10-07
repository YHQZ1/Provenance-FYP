import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import BrandedLoader from "./BrandedLoader";
import { supabase } from "../lib/supabase";
import { authAPI } from "../lib/api";

export default function ProtectedRoute({ children }) {
  const [status, setStatus] = useState("loading");
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      const session = data?.session;
      if (!session) {
        if (mounted) setStatus("unauth");
        return;
      }
      await authAPI.sync(session.access_token).catch(() => {});
      if (mounted) setStatus("ready");
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session && mounted) setStatus("unauth");
      if (event === "SIGNED_IN" && session && mounted) setStatus("ready");
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (status === "loading") return <BrandedLoader />;
  if (status === "unauth") {
    return <Navigate to="/auth?mode=login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
