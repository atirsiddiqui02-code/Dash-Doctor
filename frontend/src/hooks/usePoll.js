import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

export function usePoll(path, ms = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get(path);
      if (alive.current) { setData(r.data); setError(null); }
    } catch (e) {
      if (alive.current) setError(e);
    }
  }, [path]);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(refresh, ms);
    return () => { alive.current = false; clearInterval(id); };
  }, [refresh, ms]);

  return { data, error, refresh, loading: data === null && !error };
}
