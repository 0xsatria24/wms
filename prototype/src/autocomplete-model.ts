export interface Suggestion {
  value: string;
  label: string;
  description?: string;
  keywords?: string;
}

const normalize = (value: string) =>
  value.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLocaleLowerCase();

export function valueSuggestions(
  values: (string | null | undefined)[],
): Suggestion[] {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    if (typeof value !== "string" || !value.trim()) return [];
    const key = normalize(value);
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ value: value.trim(), label: value.trim() }];
  });
}

export function productSuggestions(
  products: { sku: string; name: string; barcode?: string; active?: boolean }[],
  activeOnly = false,
): Suggestion[] {
  return products
    .filter((product) => !activeOnly || product.active)
    .map((product) => ({
      value: product.sku,
      label: product.name,
      description: [product.sku, product.barcode].filter(Boolean).join(" · "),
      keywords: product.barcode,
    }));
}

export function matchSuggestions(
  options: Suggestion[],
  query: string,
  limit = 8,
): Suggestion[] {
  const search = normalize(query);
  const terms = search.split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  return options
    .flatMap((option, index) => {
      const key = normalize(option.value);
      if (seen.has(key)) return [];
      const text = normalize(
        [option.value, option.label, option.description, option.keywords]
          .filter(Boolean)
          .join(" "),
      );
      const words = text.split(/\s+/);
      if (
        !text.includes(search) &&
        !terms.every((term) => words.some((word) => word.startsWith(term)))
      )
        return [];
      seen.add(key);
      const label = normalize(option.label);
      const rank =
        !search || key === search || label === search
          ? 0
          : key.startsWith(search) || label.startsWith(search)
            ? 1
            : 2;
      return [{ option, rank, index }];
    })
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .slice(0, limit)
    .map(({ option }) => option);
}
