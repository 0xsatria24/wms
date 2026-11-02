import React, { useRef, useState } from "react";
import { Button, Field, Modal, Notice, useText, errorText } from "./ui";
import type { BulkSelection } from "./selection";
import type { BulkResult } from "./bulk-model";
import { withBulkOutput } from "./bulk-model";

export interface BulkAction {
  id: string;
  label: string;
  allowed?: (row: any) => boolean;
  reason?: boolean;
  danger?: boolean;
  description?: string;
  perform: (row: any, reason: string) => Promise<void | Partial<BulkResult>>;
  after?: (rows: any[]) => Promise<void> | void;
  complete?: (rows: any[]) => Promise<void> | void;
  confirmLabel?: string;
  cancelLabel?: string;
}

export function BulkActions({
  selection,
  actions,
}: {
  selection: BulkSelection;
  actions: BulkAction[];
}) {
  const t = useText();
  const [review, setReview] = useState<{
    action: BulkAction;
    rows: any[];
    skipped: any[];
    scope: string;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [report, setReport] = useState<{
    scope: string;
    results: BulkResult[];
    names: Map<string, string>;
    refreshFailed?: boolean;
  } | null>(null);
  const [progress, setProgress] = useState(0);
  const executing = useRef(false);
  const activeReview = review?.scope === selection.token ? review : null;
  const activeReport = report?.scope === selection.token ? report : null;
  const run = async (event) => {
    event.preventDefault();
    if (
      !activeReview ||
      executing.current ||
      (activeReview.action.reason && !reason.trim())
    )
      return;
    executing.current = true;
    const { action, rows, skipped, scope } = activeReview;
    setProgress(0);
    try {
      let results = await selection.run(
        rows,
        async (row) => {
          const result = await action.perform(row, reason.trim());
          setProgress((n) => n + 1);
          return result;
        },
        action.allowed,
      );
      const succeeded = rows.filter((row) =>
        results.some(
          (r) => r.id === selection.key(row) && r.status === "success",
        ),
      );
      if (action.complete)
        results = await withBulkOutput(results, () =>
          action.complete(succeeded),
        );
      let refreshFailed = false;
      try {
        await action.after?.(succeeded);
      } catch {
        refreshFailed = true;
      }
      results.push(
        ...skipped.map((row) => ({
          id: selection.key(row),
          status: "skipped" as const,
          message: "ineligible",
        })),
      );
      selection.remove(
        results.filter((r) => r.status === "success").map((r) => r.id),
      );
      setReport({
        scope,
        results,
        names: new Map(
          [...rows, ...skipped].map((row) => [
            selection.key(row),
            selection.label(row),
          ]),
        ),
        refreshFailed,
      });
      setReview(null);
    } finally {
      executing.current = false;
    }
  };
  const outcomeLabel = (status: BulkResult["status"]) =>
    ({
      success: t("Completed", "Berhasil"),
      error: t("Failed", "Gagal"),
      pending: t("Outcome not confirmed", "Hasil belum terkonfirmasi"),
      skipped: t("Skipped", "Dilewati"),
    })[status];
  const message = (value: string) =>
    value === "output-failed"
      ? t(
          "The file could not be created. These items remain selected; try the download again.",
          "File belum dapat dibuat. Item tetap terpilih; coba unduh kembali.",
        )
      : value === "batch-stopped"
        ? t(
            "Not sent. The batch stopped; check the earlier result before continuing.",
            "Belum dikirim. Proses dihentikan; periksa hasil sebelumnya sebelum melanjutkan.",
          )
        : value === "ineligible"
          ? t(
              "Status or permission does not allow this action.",
              "Status atau izin tidak memenuhi syarat tindakan ini.",
            )
          : value === "unknown" || value === "offline"
            ? t(
                "Keep the original request and resolve it in Pending transactions.",
                "Pertahankan permintaan asal dan periksa di Transaksi tertunda.",
              )
            : errorText(value, t);
  return (
    <>
      {selection.selectedRows.length > 0 && (
        <div
          className="bulk-toolbar"
          role="region"
          aria-label={t("Selected row actions", "Tindakan baris terpilih")}
          aria-busy={selection.busy}
        >
          <strong role="status">
            {t(
              `${selection.selectedRows.length} selected on this page`,
              `${selection.selectedRows.length} terpilih di halaman ini`,
            )}
          </strong>
          <div className="bulk-action-buttons">
            {actions.map((action) => {
              const eligible = selection.selectedRows.filter(
                (row) => !action.allowed || action.allowed(row),
              );
              return (
                <Button
                  key={action.id}
                  danger={action.danger}
                  disabled={selection.disabled || !eligible.length}
                  onClick={() => {
                    setReason("");
                    setReview({
                      action,
                      rows: eligible,
                      skipped: selection.selectedRows.filter(
                        (row) => !eligible.includes(row),
                      ),
                      scope: selection.token,
                    });
                  }}
                >
                  {action.label} ({eligible.length})
                </Button>
              );
            })}
            <Button disabled={selection.busy} onClick={selection.clear}>
              {t("Clear selection", "Batal pilih")}
            </Button>
          </div>
        </div>
      )}
      {activeReport && (
        <div className="bulk-outcomes" role="status">
          {activeReport.refreshFailed && (
            <Notice kind="warning">
              {t(
                "Results are recorded, but the latest list could not be loaded. Refresh the page before another action.",
                "Hasil sudah tercatat, tetapi daftar terbaru belum dapat dimuat. Muat ulang halaman sebelum tindakan berikutnya.",
              )}
            </Notice>
          )}
          <strong>
            {t(
              `Completed ${activeReport.results.filter((r) => r.status === "success").length} · Failed ${activeReport.results.filter((r) => r.status === "error").length} · Pending ${activeReport.results.filter((r) => r.status === "pending").length} · Skipped ${activeReport.results.filter((r) => r.status === "skipped").length}`,
              `Berhasil ${activeReport.results.filter((r) => r.status === "success").length} · Gagal ${activeReport.results.filter((r) => r.status === "error").length} · Tertunda ${activeReport.results.filter((r) => r.status === "pending").length} · Dilewati ${activeReport.results.filter((r) => r.status === "skipped").length}`,
            )}
          </strong>
          <details>
            <summary>
              {t("View individual results", "Lihat hasil per item")}
            </summary>
            <ul className="bulk-review-list">
              {activeReport.results.map((result, i) => (
                <li key={`${result.id}:${i}`}>
                  <strong>
                    {activeReport.names.get(result.id) || result.id}
                  </strong>
                  <span>
                    {outcomeLabel(result.status)}
                    {result.message && ` · ${message(result.message)}`}
                  </span>
                </li>
              ))}
            </ul>
          </details>
          <Button onClick={() => setReport(null)}>
            {t("Dismiss results", "Tutup hasil")}
          </Button>
        </div>
      )}
      {activeReview && (
        <Modal
          title={activeReview.action.label}
          onClose={() => {
            if (!executing.current) setReview(null);
          }}
        >
          <form className="stack" onSubmit={run}>
            <p>
              {t(
                `${activeReview.rows.length} eligible; ${activeReview.skipped.length} skipped. Only the listed items will be processed.`,
                `${activeReview.rows.length} memenuhi syarat; ${activeReview.skipped.length} dilewati. Hanya item dalam daftar ini yang diproses.`,
              )}
            </p>
            {activeReview.action.description && (
              <Notice>{activeReview.action.description}</Notice>
            )}
            <ul className="bulk-review-list">
              {activeReview.rows.map((row) => (
                <li key={selection.key(row)}>{selection.label(row)}</li>
              ))}
            </ul>
            {activeReview.action.reason && (
              <Field
                label={t("Reason (required)", "Alasan (wajib)")}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                maxLength={2000}
                disabled={selection.busy}
              />
            )}
            {selection.busy && (
              <p role="status">
                {t(
                  `Processing ${progress} of ${activeReview.rows.length}…`,
                  `Memproses ${progress} dari ${activeReview.rows.length}…`,
                )}
              </p>
            )}
            <div className="form-actions">
              <Button disabled={selection.busy} onClick={() => setReview(null)}>
                {activeReview.action.cancelLabel || t("Cancel", "Batal")}
              </Button>
              <Button
                type="submit"
                primary={!activeReview.action.danger}
                danger={activeReview.action.danger}
                disabled={
                  selection.disabled ||
                  (activeReview.action.reason && !reason.trim())
                }
              >
                {selection.busy
                  ? t("Processing…", "Memproses…")
                  : activeReview.action.confirmLabel || t("Confirm selected", "Konfirmasi terpilih")}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
