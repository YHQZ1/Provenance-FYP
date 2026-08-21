import { BrowserRouter, Routes, Route } from "react-router-dom";
import Provenance from "./pages/Provenance.jsx";
import Auth from "./pages/Auth.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import UploadData from "./pages/Upload.jsx";
import DataValidation from "./pages/Validation.jsx";
import ComplianceMapping from "./pages/ComplianceMapping.jsx";
import Reports from "./pages/Reports.jsx";
import Insights from "./pages/Insights.jsx";
import Settings from "./pages/Settings.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";

function ProtectedLayout({ children }) {
  return (
    <ProtectedRoute>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Provenance />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedLayout>
              <Dashboard />
            </ProtectedLayout>
          }
        />
        <Route
          path="/upload"
          element={
            <ProtectedLayout>
              <UploadData />
            </ProtectedLayout>
          }
        />
        <Route
          path="/validation"
          element={
            <ProtectedLayout>
              <DataValidation />
            </ProtectedLayout>
          }
        />
        <Route
          path="/mapping"
          element={
            <ProtectedLayout>
              <ComplianceMapping />
            </ProtectedLayout>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedLayout>
              <Reports />
            </ProtectedLayout>
          }
        />
        <Route
          path="/insights"
          element={
            <ProtectedLayout>
              <Insights />
            </ProtectedLayout>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedLayout>
              <Settings />
            </ProtectedLayout>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
