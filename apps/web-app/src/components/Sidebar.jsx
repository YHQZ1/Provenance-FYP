/* eslint-disable no-unused-vars */
import { useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Upload,
  CheckCircle,
  Map,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const menuItems = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Upload Data", path: "/upload", icon: Upload },
  { label: "Validation", path: "/validation", icon: CheckCircle },
  { label: "Compliance Mapping", path: "/mapping", icon: Map },
  { label: "Reports", path: "/reports", icon: FileText },
  { label: "Insights", path: "/insights", icon: BarChart3 },
  { label: "Settings", path: "/settings", icon: Settings },
];

export default function Sidebar({ isCollapsed, onToggle }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <style>{`
        .sidebar-root {
          position: fixed;
          left: 0;
          top: 64px;
          height: calc(100vh - 64px);
          z-index: 40;
          background: #fff;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          transition: width 0.22s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sidebar-nav {
          flex: 1;
          padding: 20px 10px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          overflow-y: auto;
          overflow-x: hidden;
        }

        .nav-btn {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 10px;
          border: none;
          cursor: pointer;
          background: transparent;
          color: var(--text-muted);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 500;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          transition: all 0.15s;
          position: relative;
        }

        .nav-btn:hover {
          background: #f5f5f5;
          color: #0a0a0a;
        }

        .nav-btn.active {
          background: var(--success-bg);
          color: var(--success);
        }

        .nav-btn.active .nav-indicator {
          position: absolute;
          left: 0;
          top: 8px;
          bottom: 8px;
          width: 3px;
          border-radius: 99px;
          background: var(--success);
        }

        .nav-label {
          overflow: hidden;
          transition: opacity 0.18s, width 0.22s;
          letter-spacing: -0.01em;
        }

        .nav-label.hidden {
          opacity: 0;
          width: 0;
        }

        .nav-label.visible {
          opacity: 1;
          width: auto;
        }

        .sidebar-footer {
          padding: 16px 10px;
          border-top: 1px solid var(--border-light);
          display: flex;
          justify-content: ${isCollapsed ? "center" : "flex-start"};
          transition: justify-content 0.22s;
        }

        .toggle-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          width: ${isCollapsed ? "36px" : "100%"};
          height: 36px;
          padding: ${isCollapsed ? "0" : "0 12px"};
          border-radius: 8px;
          border: 1px solid var(--border);
          background: #fff;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s;
          font-family: 'DM Sans', sans-serif;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
        }

        .toggle-btn:hover {
          background: #fafafa;
          border-color: #0a0a0a;
          color: #0a0a0a;
        }

        .toggle-btn span {
          overflow: hidden;
          transition: opacity 0.18s;
        }

        .toggle-btn span.hidden {
          opacity: 0;
          width: 0;
        }

        .toggle-btn span.visible {
          opacity: 1;
        }

        .sidebar-root::-webkit-scrollbar {
          width: 0;
        }
      `}</style>

      <div className="sidebar-root" style={{ width: isCollapsed ? 64 : 220 }}>
        <nav className="sidebar-nav">
          {menuItems.map(({ label, path, icon: Icon }) => {
            const active = location.pathname === path;
            return (
              <button
                key={path}
                className={`nav-btn ${active ? "active" : ""}`}
                onClick={() => navigate(path)}
                title={isCollapsed ? label : undefined}
                style={{
                  justifyContent: isCollapsed ? "center" : "flex-start",
                  paddingLeft: isCollapsed ? 0 : 12,
                }}
              >
                {active && <span className="nav-indicator" />}
                <Icon size={18} strokeWidth={1.8} />
                <span
                  className={`nav-label ${isCollapsed ? "hidden" : "visible"}`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="toggle-btn"
            onClick={onToggle}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <ChevronRight size={16} />
            ) : (
              <ChevronLeft size={16} />
            )}
            <span className={isCollapsed ? "hidden" : "visible"}>Close</span>
          </button>
        </div>
      </div>
    </>
  );
}
