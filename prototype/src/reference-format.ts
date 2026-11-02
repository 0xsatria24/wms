const hyphenatedUuid = "[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}";
const uuid = `(?:[a-f0-9]{32}|${hyphenatedUuid})`;
const prefix = "(?:TX|EDIT|SETTINGS|BOOTSTRAP|IMPORT|INSPECTION|PUTAWAY|COUNT|TRANSFER|CUSTOMER-RETURN|SUPPLIER-RETURN|RETURN-STOCK|ORDER|PO)-";
const reference = `(?:${prefix})?${uuid}`;
const completeReference = new RegExp(`^${reference}$`, "i");

export const referenceColumns = new Set(["id", "source", "transaction", "order", "task", "event", "actor", "user"]);
export function isReferenceLabel(value: unknown): boolean {
  return typeof value === "string" && /\b(id|source|transaction|entry|task|order|event|actor|owner|user|request|document|sumber|transaksi|entri|tugas|pelaku|pemilik|pengguna|permintaan|dokumen)\b/i.test(value);
}

export function isGeneratedReference(value: string): boolean {
  return /^[A-Za-z0-9_-]{16}$/.test(value) || completeReference.test(value);
}
