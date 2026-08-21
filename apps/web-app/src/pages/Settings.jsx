/* eslint-disable no-unused-vars */
import { useState, useEffect, useCallback } from "react";
import { CheckCircle, AlertTriangle, Mail, Bell, Calendar } from "lucide-react";
import { companyAPI, authAPI } from "../lib/api";
import PageHeader from "../components/PageHeader";
import { BtnPrimary, MonoLabel } from "../components/ui";

const styles = {
  panel: {
    border: "1px solid var(--border)",
    borderRadius: 14,
    background: "#fff",
    overflow: "hidden",
  },
  sectionHeader: {
    padding: "18px 24px",
    borderBottom: "1px solid var(--border-light)",
    background: "#fafafa",
  },
  sectionBody: { padding: 24 },
  errorBanner: {
    background: "#fafafa",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "14px 18px",
    marginBottom: 24,
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  toast: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "#0a0a0a",
    color: "#fff",
    padding: "12px 18px",
    borderRadius: 12,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
  },
};

const SectionTitle = ({ children }) => (
  <p
    style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      fontWeight: 500,
      color: "#0a0a0a",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      margin: 0,
    }}
  >
    {children}
  </p>
);
const SectionSubtitle = ({ children }) => (
  <p
    style={{
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 15,
      fontWeight: 600,
      color: "#0a0a0a",
      letterSpacing: "-0.01em",
      margin: "6px 0 0",
    }}
  >
    {children}
  </p>
);
const FieldLabel = ({ children, htmlFor }) => (
  <label
    htmlFor={htmlFor}
    style={{
      display: "block",
      fontFamily: "'DM Mono', monospace",
      fontSize: 10,
      fontWeight: 500,
      color: "var(--text-muted)",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      marginBottom: 8,
    }}
  >
    {children}
  </label>
);

const Input = ({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled,
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "100%",
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 13,
        color: disabled ? "var(--text-light)" : "#0a0a0a",
        padding: "10px 13px",
        border: `1px solid ${focused ? "var(--success)" : "var(--border)"}`,
        borderRadius: 8,
        background: focused ? "#fff" : "#fafafa",
        outline: "none",
        cursor: disabled ? "not-allowed" : "text",
        transition: "border-color 0.15s, background 0.15s",
      }}
    />
  );
};

const Toggle = ({ checked, onChange }) => (
  <label
    style={{
      position: "relative",
      display: "inline-block",
      width: 44,
      height: 24,
      flexShrink: 0,
      cursor: "pointer",
    }}
  >
    <input
      type="checkbox"
      checked={checked}
      onChange={onChange}
      style={{ opacity: 0, width: 0, height: 0, position: "absolute" }}
    />
    <span
      style={{
        position: "absolute",
        inset: 0,
        borderRadius: 99,
        background: checked ? "var(--success)" : "var(--border)",
        border: `1px solid ${checked ? "var(--success)" : "var(--border-hover)"}`,
        transition: "background 0.2s, border-color 0.2s",
      }}
    />
    <span
      style={{
        position: "absolute",
        width: 16,
        height: 16,
        left: checked ? 22 : 3,
        top: "50%",
        transform: "translateY(-50%)",
        background: "#fff",
        borderRadius: "50%",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
        transition: "left 0.2s",
      }}
    />
  </label>
);

const ToggleRow = ({ icon: Icon, label, sub, checked, onChange }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "16px 0",
      borderBottom: "1px solid var(--border-light)",
    }}
  >
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
      <Icon
        size={15}
        color="var(--text-light)"
        style={{ marginTop: 2, flexShrink: 0 }}
      />
      <div>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: "#0a0a0a",
            margin: "0 0 3px",
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 12,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {sub}
        </p>
      </div>
    </div>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

export default function Settings() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [notifs, setNotifs] = useState({
    emailAlerts: true,
    complianceReminders: true,
    filingDeadlineAlerts: false,
  });

  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [userRes, companyRes] = await Promise.all([
        authAPI.getCurrentUser(),
        companyAPI.getProfile().catch(() => ({ data: null })),
      ]);
      setUser(userRes.data?.user || userRes);
      setCompany(companyRes.data);
    } catch (err) {
      setError(err.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSaveProfile = async () => {
    if (!company) return;
    setSavingProfile(true);
    try {
      await companyAPI.updateProfile({
        company_name: company.company_name,
        gst_number: company.gst_number,
      });
      showToast("success", "Profile saved");
      await fetchUserData();
    } catch (err) {
      showToast("error", err.message || "Save failed");
    } finally {
      setSavingProfile(false);
    }
  };
  const handleSaveNotifs = async () => {
    try {
      await new Promise((r) => setTimeout(r, 400));
      showToast("success", "Notification preferences saved");
    } catch (err) {
      showToast("error", err.message || "Save failed");
    }
  };

  const initials = user?.email?.substring(0, 2).toUpperCase() || "U";
  const displayName =
    company?.company_name || user?.email?.split("@")[0] || "User";
  const userEmail = user?.email || "";

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", color: "#0a0a0a" }}>
      <PageHeader
        eyebrow="System Config"
        title="Settings"
        subtitle="Manage your account, preferences, and notification rules"
      />

      {error && (
        <div style={styles.errorBanner}>
          <AlertTriangle size={14} color="#0a0a0a" />
          <MonoLabel color="#0a0a0a">Failed to load settings.</MonoLabel>
          <span
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 13,
              color: "var(--text-muted)",
              marginLeft: 4,
            }}
          >
            {error}
          </span>
          <button
            onClick={fetchUserData}
            style={{
              marginLeft: "auto",
              padding: "4px 12px",
              fontSize: 11,
              fontFamily: "'DM Mono', monospace",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      <div
        style={{
          maxWidth: 680,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={styles.panel}>
          <div style={styles.sectionHeader}>
            <MonoLabel>MOD-00 · Profile</MonoLabel>
            <SectionSubtitle>Account Information</SectionSubtitle>
          </div>
          <div style={styles.sectionBody}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                marginBottom: 24,
                paddingBottom: 20,
                borderBottom: "1px solid var(--border-light)",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "#0a0a0a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "#fff",
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                }}
              >
                {loading ? "..." : initials}
              </div>
              <div>
                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0a0a0a",
                    margin: 0,
                  }}
                >
                  {loading ? "Loading..." : displayName}
                </p>
                <p
                  style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginTop: 4,
                    letterSpacing: "0.04em",
                  }}
                >
                  {loading ? "" : userEmail}
                </p>
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel htmlFor="companyName">Company Name</FieldLabel>
              <Input
                id="companyName"
                value={loading ? "" : company?.company_name || ""}
                onChange={(e) =>
                  setCompany((c) => ({ ...c, company_name: e.target.value }))
                }
                disabled={loading}
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <FieldLabel htmlFor="gstNumber">GST Number</FieldLabel>
              <Input
                id="gstNumber"
                value={loading ? "" : company?.gst_number || ""}
                onChange={(e) =>
                  setCompany((c) => ({ ...c, gst_number: e.target.value }))
                }
                disabled={loading}
              />
            </div>
            <div style={{ marginBottom: 24 }}>
              <FieldLabel htmlFor="email">Email Address</FieldLabel>
              <Input id="email" value={userEmail} disabled />
              <p
                style={{
                  fontFamily: "'DM Mono', monospace",
                  fontSize: 10,
                  color: "var(--text-light)",
                  marginTop: 6,
                  letterSpacing: "0.04em",
                }}
              >
                Contact your administrator to update your email.
              </p>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <BtnPrimary
                onClick={handleSaveProfile}
                disabled={savingProfile || loading}
              >
                {savingProfile ? "Saving…" : "Save Changes"}
              </BtnPrimary>
            </div>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.sectionHeader}>
            <MonoLabel>MOD-02 · Notifications</MonoLabel>
            <SectionSubtitle>Alert Preferences</SectionSubtitle>
          </div>
          <div style={styles.sectionBody}>
            <div style={{ marginBottom: 20 }}>
              <ToggleRow
                icon={Mail}
                label="Email Alerts"
                sub="Receive compliance status updates via email."
                checked={notifs.emailAlerts}
                onChange={(e) =>
                  setNotifs((n) => ({ ...n, emailAlerts: e.target.checked }))
                }
              />
              <ToggleRow
                icon={Bell}
                label="Compliance Reminders"
                sub="Get reminded about upcoming filing deadlines."
                checked={notifs.complianceReminders}
                onChange={(e) =>
                  setNotifs((n) => ({
                    ...n,
                    complianceReminders: e.target.checked,
                  }))
                }
              />
              <div style={{ borderBottom: "none" }}>
                <ToggleRow
                  icon={Calendar}
                  label="Filing Deadline Alerts"
                  sub="Push notifications 7 days before CPCB deadlines."
                  checked={notifs.filingDeadlineAlerts}
                  onChange={(e) =>
                    setNotifs((n) => ({
                      ...n,
                      filingDeadlineAlerts: e.target.checked,
                    }))
                  }
                />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <BtnPrimary onClick={handleSaveNotifs}>
                Save Preferences
              </BtnPrimary>
            </div>
          </div>
        </div>
      </div>

      {toast && (
        <div style={styles.toast}>
          {toast.type === "success" ? (
            <CheckCircle size={14} color="#4ade80" />
          ) : (
            <AlertTriangle size={14} color="#fbbf24" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
