import { useCallback, useEffect, useState } from "react";

import { findContact, saveContact } from "../api.js";

/**
 * Contact-search state for one prospect: run the web search, dismiss cards, and
 * save the chosen person as the primary contact.
 */
export default function useContactSearch(prospectId, { onContactSaved } = {}) {
  const [status, setStatus] = useState("idle");
  const [candidates, setCandidates] = useState([]);
  const [hiddenNames, setHiddenNames] = useState([]);
  const [error, setError] = useState("");
  const [searchedAt, setSearchedAt] = useState(null);
  const [savingName, setSavingName] = useState("");
  const [usedName, setUsedName] = useState("");

  useEffect(() => {
    setStatus("idle");
    setCandidates([]);
    setHiddenNames([]);
    setError("");
    setSearchedAt(null);
    setSavingName("");
    setUsedName("");
  }, [prospectId]);

  const runSearch = useCallback(async () => {
    if (!prospectId) return;
    setStatus("loading");
    setError("");
    setUsedName("");
    try {
      const data = await findContact(prospectId);
      setCandidates(data.candidates || []);
      setHiddenNames([]);
      setSearchedAt(data.searched_at || null);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [prospectId]);

  const useCandidate = useCallback(
    async (candidate) => {
      if (!prospectId) return;
      setSavingName(candidate.name);
      setError("");
      try {
        const saved = await saveContact(prospectId, { ...candidate, is_primary: true });
        setHiddenNames((current) => [...current, candidate.name]);
        setUsedName(saved.name);
        if (onContactSaved) await onContactSaved(saved);
      } catch (err) {
        setError(err.message);
      } finally {
        setSavingName("");
      }
    },
    [prospectId, onContactSaved]
  );

  const dismissCandidate = useCallback((candidate) => {
    setHiddenNames((current) => [...current, candidate.name]);
  }, []);

  return {
    status,
    candidates,
    visibleCandidates: candidates.filter(
      (candidate) => !hiddenNames.includes(candidate.name)
    ),
    error,
    searchedAt,
    savingName,
    usedName,
    runSearch,
    useCandidate,
    dismissCandidate,
  };
}
