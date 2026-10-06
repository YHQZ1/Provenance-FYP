import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
} from "react-router-dom";
import Provenance from "./pages/Provenance.jsx";
import Auth from "./pages/Auth.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Home from "./pages/Home.jsx";
import Documents from "./pages/Documents.jsx";
import Review from "./pages/Review.jsx";
import Filing from "./pages/Filing.jsx";
import RegulatoryResearch from "./pages/RegulatoryResearch.jsx";
import Settings from "./pages/Settings.jsx";
import Obligations from "./pages/Obligations.jsx";
import Activity from "./pages/Activity.jsx";
import Materials from "./pages/Materials.jsx";
import NotFound from "./pages/NotFound.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import { ToastProvider } from "./components/ui.jsx";
import { WorkspaceProvider } from "./lib/workspace.jsx";

function AppShell() {
  return (
    <ProtectedRoute>
      <WorkspaceProvider>
        <Layout>
          <Outlet />
        </Layout>
      </WorkspaceProvider>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Provenance />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Home />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/review" element={<Review />} />
            <Route path="/filing" element={<Filing />} />
            <Route path="/regulatory" element={<RegulatoryResearch />} />
            <Route path="/obligations" element={<Obligations />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/materials" element={<Materials />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* Old routes from the previous navigation. */}
          <Route
            path="/upload"
            element={<Navigate to="/documents" replace />}
          />
          <Route
            path="/validation"
            element={<Navigate to="/review" replace />}
          />
          <Route path="/mapping" element={<Navigate to="/filing" replace />} />
          <Route path="/reports" element={<Navigate to="/filing" replace />} />
          <Route
            path="/insights"
            element={<Navigate to="/dashboard" replace />}
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
