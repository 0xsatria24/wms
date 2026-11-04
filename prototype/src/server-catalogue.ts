import { useEffect, useRef } from "react";
import { scheduleCatalogueRead } from "./catalogue-reads";

export function useServerCatalogue(
  data: any,
  setQuery: ((query: any) => void) | undefined,
  options: Record<string, string | number | boolean>,
  submission = 0,
) {
  const key = JSON.stringify(options);
  const previous = useRef(null);
  const previousSubmission = useRef(submission);
  useEffect(() => {
    if (!setQuery) return;
    const next = JSON.parse(key);
    const cancel = scheduleCatalogueRead(previous.current, next, setQuery, { immediate: previousSubmission.current !== submission });
    previous.current = next;
    previousSubmission.current = submission;
    return cancel;
  }, [key, setQuery, submission]);
  return setQuery && data.catalogue?.requestKey === key ? data.catalogue : null;
}
