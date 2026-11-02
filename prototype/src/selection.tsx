import React, { useEffect, useRef, useState } from "react";
import { runBulk, visibleSelection, type BulkResult } from "./bulk-model";

export function useBulkSelection<T = any>({
  rows,
  scope,
  key = (row: any) => row.id,
  label = (row: any) => row.name || row.id,
  allowed = () => true,
  disabled = false,
}: {
  rows: T[];
  scope: string;
  key?: (row: T) => string;
  label?: (row: T) => string;
  allowed?: (row: T) => boolean;
  disabled?: boolean;
}) {
  const visit = useRef({ scope, epoch: 0 });
  if (visit.current.scope !== scope)
    visit.current = { scope, epoch: visit.current.epoch + 1 };
  const token = JSON.stringify([scope, visit.current.epoch]);
  const [state, setState] = useState({ scope: token, ids: [] as string[] });
  const [busy, setBusy] = useState(false);
  const liveScope = useRef(scope);
  const mounted = useRef(true);
  liveScope.current = token;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const ids =
    state.scope === token
      ? visibleSelection(state.ids, rows, key, allowed)
      : [];
  const signature = JSON.stringify(ids);
  useEffect(() => {
    setState((previous) =>
      previous.scope === token && JSON.stringify(previous.ids) === signature
        ? previous
        : { scope: token, ids: JSON.parse(signature) },
    );
  }, [token, signature]);
  const selectedRows = rows.filter(
    (row) => ids.includes(key(row)) && allowed(row),
  );
  const selectable = rows.filter(allowed);
  const live = useRef({ rows, ids, disabled, allowed });
  live.current = { rows, ids, disabled, allowed };
  const remove = (values: string[]) =>
    setState((previous) =>
      previous.scope === token
        ? {
            scope: token,
            ids: previous.ids.filter((id) => !values.includes(id)),
          }
        : previous,
    );
  return {
    scope,
    token,
    rows,
    ids,
    selectedRows,
    selectable,
    key,
    label,
    allowed,
    busy,
    disabled: disabled || busy,
    checked: (row: T) => ids.includes(key(row)),
    toggle: (row: T) => {
      if (!disabled && !busy && allowed(row))
        setState({
          scope: token,
          ids: ids.includes(key(row))
            ? ids.filter((id) => id !== key(row))
            : [...ids, key(row)],
        });
    },
    toggleAll: () => {
      if (!disabled && !busy)
        setState({
          scope: token,
          ids:
            selectable.length &&
            selectable.every((row) => ids.includes(key(row)))
              ? []
              : selectable.map(key),
        });
    },
    clear: () => setState({ scope: token, ids: [] }),
    remove,
    async run(
      batch: T[],
      execute: (row: T) => Promise<void | Partial<BulkResult>>,
      eligible: (row: T) => boolean = () => true,
    ) {
      if (
        liveScope.current !== token ||
        !mounted.current ||
        live.current.disabled
      )
        return [];
      setBusy(true);
      try {
        return await runBulk(batch, execute, key, (row) => {
          const current = live.current.rows.find(
            (candidate) => key(candidate) === key(row),
          );
          return (
            liveScope.current === token &&
            mounted.current &&
            !live.current.disabled &&
            !!current &&
            live.current.ids.includes(key(row)) &&
            live.current.allowed(current) &&
            eligible(current)
          );
        });
      } finally {
        if (mounted.current) setBusy(false);
      }
    },
  };
}

export type BulkSelection = ReturnType<typeof useBulkSelection<any>>;

function Checkbox({ checked, mixed = false, disabled, label, onChange }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = mixed;
  }, [mixed]);
  return (
    <label className="table-checkbox">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
      />
      <span className="sr-only">{label}</span>
    </label>
  );
}

export function SelectionHeader({
  selection,
  label,
}: {
  selection: BulkSelection;
  label: string;
}) {
  const all =
    selection.selectable.length > 0 &&
    selection.selectable.every((row) => selection.checked(row));
  return (
    <th scope="col" className="selection-column">
      <Checkbox
        checked={all}
        mixed={!all && selection.ids.length > 0}
        disabled={selection.disabled || !selection.selectable.length}
        label={label}
        onChange={selection.toggleAll}
      />
    </th>
  );
}

export function SelectionCell({
  selection,
  row,
  label,
}: {
  selection: BulkSelection;
  row: any;
  label: string;
}) {
  return (
    <td className="selection-column">
      <Checkbox
        checked={selection.checked(row)}
        disabled={selection.disabled || !selection.allowed(row)}
        label={label}
        onChange={() => selection.toggle(row)}
      />
    </td>
  );
}
