type CatalogueQuery = Record<string, string | number | boolean>;

export function scheduleCatalogueRead(
  previous: CatalogueQuery | null,
  next: CatalogueQuery,
  send: (query: CatalogueQuery) => void,
  { immediate = false, delayMs = 250 } = {},
) {
  const changed = previous ? [...new Set([...Object.keys(previous), ...Object.keys(next)])].filter(key => previous[key] !== next[key]) : [];
  const searchKeys = ["query", "sku", "focusSku", "packagesQuery", "returnSourcesQuery"];
  const typing = previous && changed.some(key => searchKeys.includes(key)) && changed.every(key => searchKeys.includes(key) || /page$/i.test(key) && next[key] === 1);
  if (!typing || immediate) {
    send(next);
    return () => {};
  }
  const timer = setTimeout(() => send(next), delayMs);
  return () => clearTimeout(timer);
}
