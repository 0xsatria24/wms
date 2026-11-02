import React, { createContext, useContext, useEffect, useState } from "react";
import {
  Locale,
  useText,
  Field,
  Button,
  Notice,
  DataTable,
  errorText,
} from "./ui";
import { formatDate, formatStamp, timestampParts } from "./date-time";
import { saveDocumentDates } from "./api";
import { Reference } from "./Reference";

export const WarehouseTimeZone = createContext("Asia/Jakarta");
export function useDateTime() {
  const locale = useContext(Locale);
  const zone = useContext(WarehouseTimeZone);
  return {
    zone,
    stamp: (value, seconds = true) => formatStamp(value, locale, zone, seconds),
    date: (value) => formatDate(value, locale),
  };
}
export function WarehouseClock() {
  const [now, setNow] = useState(() => new Date().toISOString());
  const { stamp, zone } = useDateTime();
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time className="warehouse-clock" dateTime={now} title={zone}>
      {stamp(now)}
      <small>{zone}</small>
    </time>
  );
}
export function TableTimestamp({ value }: { value?: string | null }) {
  const t = useText();
  const locale = useContext(Locale);
  const { zone, stamp } = useDateTime();
  const parts = timestampParts(value, locale, zone);
  if (!parts)
    return (
      <span className="timestamp-empty">
        {t("Not recorded", "Belum tercatat")}
      </span>
    );
  return (
    <time className="table-timestamp" dateTime={value} title={stamp(value)}>
      <span>{parts.date}</span>
      <small>{parts.time}</small>
    </time>
  );
}
export function DocumentDates({ row, warehouse, user, onSaved }) {
  const t = useText();
  const { stamp, date } = useDateTime();
  const [editing, setEditing] = useState(false);
  const [documentDate, setDocumentDate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editVersion, setEditVersion] = useState<number | undefined>();
  useEffect(() => {
    setEditing(false);
    setError("");
  }, [row?.id]);
  if (!row) return null;
  return (
    <details className="document-date-details">
      <summary>
        {t("Date details and schedule", "Rincian tanggal dan jadwal")} ·{" "}
        <Reference value={row.id} />
      </summary>
      <DataTable
        label={t(`Date details for ${row.id}`, `Rincian tanggal ${row.id}`)}
        columns={[
          { key: "label", label: t("Event", "Kejadian") },
          {
            key: "value",
            label: t("Date / time", "Tanggal / waktu"),
            render: (item) =>
              item.dateOnly ? (
                date(item.value)
              ) : (
                <TableTimestamp value={item.value} />
              ),
          },
          { key: "actor", label: t("User", "Pengguna") },
        ]}
        rows={[
          {
            id: "document",
            label: t("Document date", "Tanggal dokumen"),
            value: row.documentDate,
            dateOnly: true,
          },
          {
            id: "schedule",
            label: t("Scheduled date", "Tanggal rencana"),
            value: row.scheduledDate,
            dateOnly: true,
          },
          {
            id: "created",
            label: t("Created", "Dibuat"),
            value: row.createdAt,
            actor: row.creator,
          },
          {
            id: "updated",
            label: t("Last updated", "Terakhir diubah"),
            value: row.updatedAt,
          },
          ...[
            ["startedAt", t("Started", "Dimulai")],
            ["submittedAt", t("Submitted", "Diajukan")],
            ["approvedAt", t("Approved", "Disetujui")],
            ["completedAt", t("Completed / closed", "Selesai / ditutup")],
          ]
            .filter(([key]) => row[key] || row.counter !== undefined)
            .map(([key, label]) => ({ id: key, label, value: row[key] })),
        ]}
      />
      {user &&
        ["admin", "supervisor"].includes(user.role) &&
        (!row.from || row.from === warehouse) &&
        !editing && (
          <Button
            onClick={() => {
              setDocumentDate(row.documentDate || "");
              setScheduledDate(row.scheduledDate || "");
              setEditVersion(row.version);
              setEditing(true);
            }}
          >
            {t("Edit dates / schedule", "Ubah tanggal / jadwal")}
          </Button>
        )}
      {editing && (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setSaving(true);
            setError("");
            try {
              await saveDocumentDates(warehouse, {
                id: row.id,
                version: editVersion,
                documentDate,
                scheduledDate,
              });
              await onSaved();
              setEditing(false);
            } catch (e) {
              setError(errorText(e.code || e.message, t));
            } finally {
              setSaving(false);
            }
          }}
        >
          <Field
            label={t("Document date", "Tanggal dokumen")}
            type="date"
            value={documentDate}
            onChange={(e) => setDocumentDate(e.target.value)}
          />
          <Field
            label={t(
              "Scheduled arrival / shipment / count",
              "Rencana tiba / kirim / hitung",
            )}
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
          />
          {error && <Notice kind="error">{error}</Notice>}
          <div className="form-actions">
            <Button disabled={saving} onClick={() => setEditing(false)}>
              {t("Cancel", "Batal")}
            </Button>
            <Button primary type="submit" disabled={saving}>
              {t("Save dates", "Simpan tanggal")}
            </Button>
          </div>
        </form>
      )}
    </details>
  );
}
