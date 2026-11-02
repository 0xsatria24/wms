import React from "react";
import { isGeneratedReference } from "./reference-format";

export function Reference({ value, embedded = false }: { value: string; embedded?: boolean }) {
  return !embedded && isGeneratedReference(value)
    ? <span className="reference-id" title={value}>{value}</span>
    : <>{value}</>;
}
