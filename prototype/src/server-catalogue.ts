import { useEffect } from "react";

export function useServerCatalogue(
  data: any,
  setQuery: ((query: any) => void) | undefined,
  options: Record<string, string | number | boolean>,
) {
  const key = JSON.stringify(options);
  useEffect(() => {
    setQuery?.(JSON.parse(key));
  }, [key, setQuery]);
  return setQuery && data.catalogue?.requestKey === key ? data.catalogue : null;
}
