/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authAPI, filingAPI } from "./api";
import { currentFinancialYear } from "./domain";

export const WorkspaceContext = createContext(null);
const FY_KEY = "provenance_fy";

const readStoredYear = () => {
  try {
    const stored = Number(localStorage.getItem(FY_KEY));
    return Number.isInteger(stored) && stored > 2000 ? stored : currentFinancialYear();
  } catch {
    return currentFinancialYear();
  }
};

export function WorkspaceProvider({ children }) {
  const [fy, setFyState] = useState(readStoredYear);
  const [filing, setFiling] = useState(null);
  const [filingError, setFilingError] = useState(null);
  const [account, setAccount] = useState({ user: null, company: null });

  const setFy = useCallback((year) => {
    setFyState(year);
    try {
      localStorage.setItem(FY_KEY, String(year));
    } catch {}
  }, []);

  const refreshFiling = useCallback(async () => {
    try {
      const response = await filingAPI.get(fy);
      setFiling(response.data);
      setFilingError(null);
      return response.data;
    } catch (error) {
      setFilingError(error.message);
      return null;
    }
  }, [fy]);

  const refreshAccount = useCallback(async () => {
    try {
      const response = await authAPI.me();
      setAccount({ user: response.data.user, company: response.data.company });
    } catch {}
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the request resolves
    refreshFiling();
  }, [refreshFiling]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount; state is set after the request resolves
    refreshAccount();
  }, [refreshAccount]);

  const processing = filing?.counts?.processing > 0;
  useEffect(() => {
    if (!processing) return undefined;
    const timer = setInterval(refreshFiling, 6000);
    return () => clearInterval(timer);
  }, [processing, refreshFiling]);

  const value = useMemo(
    () => ({
      fy,
      setFy,
      filing,
      filingError,
      refreshFiling,
      user: account.user,
      company: account.company,
      refreshAccount,
      profileComplete: Boolean(
        account.company?.gst_number && account.company?.Pibo_category?.length,
      ),
    }),
    [fy, setFy, filing, filingError, refreshFiling, account, refreshAccount],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export const useWorkspace = () => useContext(WorkspaceContext);
