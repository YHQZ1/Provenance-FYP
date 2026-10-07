const runtime = () => (typeof window !== "undefined" && window.__ENV__) || {};

export const readEnv = (name, runtimeValues = runtime(), buildValues = import.meta.env) =>
  runtimeValues[name] || buildValues[name] || "";
