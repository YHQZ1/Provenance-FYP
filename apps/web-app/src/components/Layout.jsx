import { useState } from "react";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

const SIDEBAR_EXPANDED = 220;
const SIDEBAR_COLLAPSED = 64;
const NAVBAR_HEIGHT = 64;
const STORAGE_KEY = "provenance_sidebar_collapsed";

export default function Layout({ children }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const handleToggle = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        //
      }
      return next;
    });
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "var(--bg)",
        overflowX: "hidden",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        maxWidth: "100%",
      }}
    >
      <style>{`
        * {
          box-sizing: border-box;
        }
      `}</style>

      <Navbar />

      <Sidebar isCollapsed={isSidebarCollapsed} onToggle={handleToggle} />

      <main
        style={{
          marginLeft: isSidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED,
          paddingTop: NAVBAR_HEIGHT,
          minHeight: "100vh",
          backgroundColor: "var(--bg)",
          transition: "margin-left 0.22s cubic-bezier(0.4, 0, 0.2, 1)",
          overflowY: "auto",
          height: "100vh",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            padding: "32px",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
