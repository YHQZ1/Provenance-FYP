import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initMonitoring, reportError } from "./lib/monitoring";

initMonitoring();

const onError = (error, info) => reportError(error, { componentStack: info?.componentStack });

createRoot(document.getElementById("root"), {
  onUncaughtError: onError,
  onCaughtError: onError,
  onRecoverableError: onError,
}).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
