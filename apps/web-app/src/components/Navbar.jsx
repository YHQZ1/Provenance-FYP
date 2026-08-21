/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Bell, Settings, LogOut } from "lucide-react";

const DropdownItem = ({ icon: Icon, label, onClick, danger = false }) => (
  <button
    onClick={onClick}
    style={{
      width: "100%",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "10px 12px",
      borderRadius: 8,
      border: "none",
      background: "transparent",
      cursor: "pointer",
      fontSize: 13,
      fontWeight: 500,
      color: danger ? "var(--error)" : "#0a0a0a",
      textAlign: "left",
      fontFamily: "'DM Sans', sans-serif",
      transition: "background 0.15s",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
  >
    <Icon size={15} />
    {label}
  </button>
);

const ProfileDropdown = ({ user, onSettings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const handleSignOut = async () => {
    setIsOpen(false);
    await supabase.auth.signOut();
    navigate("/");
  };

  const displayName =
    user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const userEmail = user?.email || "";

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button
        onClick={() => setIsOpen((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "4px 8px 4px 4px",
          borderRadius: 40,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              objectFit: "cover",
              border: "1.5px solid var(--border)",
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "var(--success-bg)",
              border: "1.5px solid var(--success)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'DM Mono', monospace",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--success)",
              flexShrink: 0,
            }}
          >
            {displayName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#0a0a0a",
            maxWidth: 120,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          {displayName}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#a3a3a3"
          strokeWidth="2"
          style={{
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 8px)",
            width: 260,
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 14,
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "16px",
              borderBottom: "1px solid var(--border-light)",
            }}
          >
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                fontWeight: 500,
                color: "var(--text-light)",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                margin: "0 0 4px",
              }}
            >
              Signed in as
            </p>
            <p
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: "#0a0a0a",
                margin: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {displayName}
            </p>
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: 10,
                color: "var(--text-muted)",
                margin: "2px 0 0",
                letterSpacing: "0.04em",
              }}
            >
              {userEmail}
            </p>
          </div>
          <div style={{ padding: 8 }}>
            <DropdownItem
              icon={Settings}
              label="Settings"
              onClick={() => {
                onSettings();
                setIsOpen(false);
              }}
            />
            <DropdownItem
              icon={LogOut}
              label="Sign Out"
              onClick={handleSignOut}
              danger
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default function Navbar() {
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => setUser(session?.user ?? null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) =>
      setUser(session?.user ?? null),
    );
    return () => subscription.unsubscribe();
  }, []);

  return (
    <nav
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <img
          src="/provenance.png"
          alt="Provenance"
          style={{ height: 32, width: 32 }}
        />
        <span
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "#0a0a0a",
          }}
        >
          Provenance
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          style={{
            position: "relative",
            padding: 8,
            borderRadius: 10,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: "#0a0a0a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          <Bell size={18} strokeWidth={1.8} />
        </button>
        <div
          style={{
            width: 1,
            height: 20,
            background: "var(--border)",
            margin: "0 8px",
          }}
        />
        {user && (
          <ProfileDropdown
            user={user}
            onSettings={() => navigate("/settings")}
          />
        )}
      </div>
    </nav>
  );
}
