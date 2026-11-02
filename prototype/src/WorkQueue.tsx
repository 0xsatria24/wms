import React, { useDeferredValue, useMemo, useRef, useState } from "react";
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import {
  Button,
  DataTable,
  Field,
  Lookup,
  ProductName,
  Tag,
  useText,
} from "./ui";
import { productSuggestions } from "./autocomplete-model";
import { useServerCatalogue } from "./server-catalogue";
import {
  workQueuePage,
  queryForDocumentDraft,
  workQueueRows,
  type WorkQueueItem,
} from "./work-queue-model";

export function WorkQueue({
  items,
  products,
  selected,
  onSelect,
  kind,
  title,
  detail,
  data,
  setCatalogueQuery,
  focusDocument,
  lookupSku,
}: {
  items: WorkQueueItem[];
  products: any[];
  selected?: string;
  onSelect: (id: string) => void;
  kind: string;
  title: string;
  detail?: React.ReactNode;
  data?: any;
  setCatalogueQuery?: (query: any) => void;
  focusDocument?: string;
  lookupSku?: string;
}) {
  const t = useText();
  const panel = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [status, setStatus] = useState(["reservations", "picking", "shipping"].includes(kind) ? "ready" : "");
  const [sku, setSku] = useState("");
  const [sort, setSort] = useState("document");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const rows = useMemo(
    () => workQueueRows(items, products, kind),
    [items, products, kind],
  );
  const server = useServerCatalogue(data || {}, setCatalogueQuery, queryForDocumentDraft({ view: kind, query: deferredQuery, status, sku, sort, page, pageSize }, { document: focusDocument, newOrderSku: lookupSku }));
  const localResult = useMemo(
    () =>
      workQueuePage(server ? rows.filter((row) => server.ids.includes(row.id)) : rows, {
        query: deferredQuery,
        status,
        sku,
        sort,
        page: setCatalogueQuery ? 1 : page,
        pageSize,
        selected,
      }),
    [rows, deferredQuery, status, sku, sort, page, pageSize, selected, server],
  );
  const result = server ? { ...localResult, ...server, rows: localResult.rows } : localResult;
  const productMap = new Map(products.map((product) => [product.sku, product]));
  const statuses = server?.statuses || [...new Set(rows.map((row) => row.status))].sort();
  const skus = [...new Set(rows.map((row) => row.sku))].sort();
  const statusLabel = (value: string) =>
    ({
      "not-received": t("Not received", "Belum diterima"),
      "partially-received": t("Partially received", "Diterima sebagian"),
      received: t("Received", "Diterima"),
      "awaiting-qc": t("Awaiting QC", "Menunggu QC"),
      ready: t("Ready", "Siap"),
      waiting: t("Waiting", "Menunggu"),
      draft: t("Draft", "Draf"),
      "pending-approval": t("Awaiting approval", "Menunggu persetujuan"),
      approved: t("Approved", "Disetujui"),
      released: t("Released", "Dilepas"),
      rejected: t("Rejected", "Ditolak"),
      cancelled: t("Cancelled", "Dibatalkan"),
      unknown: t("Not specified", "Belum ditentukan"),
    })[value] || value;
  const clear = () => {
    setQuery("");
    setStatus("");
    setSku("");
    setPage(1);
  };
  const open = (id: string) => {
    onSelect(id);
    requestAnimationFrame(() => {
      const detail = panel.current?.nextElementSibling;
      if (detail instanceof HTMLElement) {
        detail.setAttribute("tabindex", "-1");
        detail.focus({ preventScroll: true });
        detail.scrollIntoView({ block: "start", behavior: "instant" });
      }
    });
  };
  const columns = [
    {
      key: "id",
      label: t(
        ["quality", "putaway"].includes(kind) ? "Task" : "Document",
        ["quality", "putaway"].includes(kind) ? "Tugas" : "Dokumen",
      ),
      render: (row) => (
        <span className="queue-document">
          <strong>{row.id}</strong>
          {selected === row.id && (
            <small className="queue-selected">
              <CheckCircle size={15} aria-hidden="true" />
              {t("Selected", "Terpilih")}
            </small>
          )}
        </span>
      ),
    },
    {
      key: "sku",
      label: t("Item / SKU", "Barang / SKU"),
      render: (row) => (
        <ProductName
          product={
            productMap.get(row.sku) || { name: row.productName, sku: row.sku }
          }
        />
      ),
    },
    ...(["quality", "putaway"].includes(kind)
      ? [{ key: "source", label: t("Source", "Sumber") }]
      : []),
    ...(kind === "receiving"
      ? [
          { key: "ordered", label: t("Ordered", "Dipesan"), numeric: true },
          { key: "received", label: t("Received", "Diterima"), numeric: true },
        ]
      : kind === "orders"
        ? [{ key: "qty", label: t("Requested", "Diminta"), numeric: true }]
        : []),
    { key: "remaining", label: t("Remaining", "Sisa"), numeric: true },
    {
      key: "status",
      label: t("Status", "Status"),
      render: (row) => (
        <Tag
          kind={
            ["awaiting-qc", "pending-approval"].includes(row.status)
              ? "warning"
              : "neutral"
          }
        >
          {statusLabel(row.status)}
        </Tag>
      ),
    },
    {
      key: "actions",
      label: t("Actions", "Tindakan"),
      render: (row) => (
        <Button
          onClick={() => open(row.id)}
          aria-label={t(`Open ${row.id}`, `Buka ${row.id}`)}
        >
          {t("Open", "Buka")}
        </Button>
      ),
    },
  ];
  return (
    <>
    <section className="panel work-queue" ref={panel} aria-label={title}>
      <div className="catalogue-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">
            {t(
              "Find a document, then open its details to continue.",
              "Cari dokumen, lalu buka detailnya untuk melanjutkan.",
            )}
          </p>
        </div>
      </div>
      <div className="catalogue-toolbar">
        <div className="search">
          <MagnifyingGlass size={20} aria-hidden="true" />
          <Field
            label={t("Search documents", "Cari dokumen")}
            type="search"
            value={query}
            suggestions={rows
              .filter(
                (row) =>
                  (!status || row.status === status) &&
                  (!sku || row.sku === sku),
              )
              .map((row) => ({
                value: row.id,
                label: row.id,
                description: [row.productName, row.sku, row.source]
                  .filter(Boolean)
                  .join(" · "),
              }))}
            placeholder={t(
              "Search document, item, SKU or source…",
              "Cari dokumen, barang, SKU, atau sumber…",
            )}
            onValueChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
          />
        </div>
        <Field label={t("Status", "Status")}>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
          >
            <option value="">{t("All statuses", "Semua status")}</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("Item", "Barang")}>
          <Lookup
            value={sku}
            options={[
              { value: "", label: t("All items", "Semua barang") },
              ...productSuggestions(
                skus.map(
                  (value) =>
                    productMap.get(value) || { sku: value, name: value },
                ),
              ),
            ]}
            onValueChange={(value) => {
              setSku(value);
              setPage(1);
            }}
          />
        </Field>
        <Field label={t("Sort by", "Urutkan")}>
          <select
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              setPage(1);
            }}
          >
            <option value="document">{t("Document A–Z", "Dokumen A–Z")}</option>
            <option value="document-desc">
              {t("Document Z–A", "Dokumen Z–A")}
            </option>
            <option value="item">{t("Item A–Z", "Barang A–Z")}</option>
            <option value="remaining-desc">
              {t("Remaining: high to low", "Sisa: terbesar dahulu")}
            </option>
          </select>
        </Field>
      </div>
      <div className="catalogue-results">
        <span role="status">
          {t(
            `${result.total} of ${server?.scopeTotal ?? rows.length} documents`,
            `${result.total} dari ${server?.scopeTotal ?? rows.length} dokumen`,
          )}
        </span>
        {(query || status || sku) && (
          <Button onClick={clear}>{t("Clear filters", "Hapus filter")}</Button>
        )}
      </div>
      <p className="queue-context">
        {t(
          "Quantities in units. Open a row to view its details below.",
          "Jumlah dalam unit. Buka baris untuk melihat detail di bawah.",
        )}
        <span className="queue-scroll-hint">
          {t(
            "Scroll horizontally or use the arrow keys to see all columns.",
            "Geser ke samping atau gunakan tombol panah untuk melihat semua kolom.",
          )}
        </span>
      </p>
      <div
        className="work-queue-table"
        aria-busy={query !== deferredQuery}
        role="region"
        aria-label={t(`${title} table`, `Tabel ${title}`)}
        tabIndex={0}
      >
        <DataTable
          label={title}
          showSelectionMark={false}
          rows={result.rows}
          columns={columns}
          selected={selected}
          onSelect={(row) => open(row.id)}
          empty={
            rows.length
              ? t(
                  "No documents match these filters.",
                  "Tidak ada dokumen yang cocok dengan filter ini.",
                )
              : t(
                  "No documents in this warehouse.",
                  "Belum ada dokumen di gudang ini.",
                )
          }
        />
      </div>
      <div className="catalogue-pagination">
        <span>
          {t(
            `Showing ${result.from}–${result.to} of ${result.total}`,
            `Menampilkan ${result.from}–${result.to} dari ${result.total}`,
          )}
        </span>
        <Field label={t("Rows per page", "Baris per halaman")}>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
          >
            {[10, 25, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </Field>
        <nav aria-label={t("Document pages", "Halaman dokumen")}>
          <Button
            aria-label={t(
              "Previous document page",
              "Halaman dokumen sebelumnya",
            )}
            disabled={result.page === 1}
            onClick={() => setPage(result.page - 1)}
          >
            <CaretLeft size={18} aria-hidden="true" />
          </Button>
          <span>
            {t(
              `Page ${result.page} of ${result.pages}`,
              `Halaman ${result.page} dari ${result.pages}`,
            )}
          </span>
          <Button
            aria-label={t("Next document page", "Halaman dokumen berikutnya")}
            disabled={result.page === result.pages}
            onClick={() => setPage(result.page + 1)}
          >
            <CaretRight size={18} aria-hidden="true" />
          </Button>
        </nav>
      </div>
    </section>
    {detail && (query !== deferredQuery || !result.selectedInFilter ? (
      <section className="panel" aria-label={t("Document details", "Detail dokumen")}>
        <p role="status">
          {query !== deferredQuery
            ? t("Updating search results…", "Memperbarui hasil pencarian…")
            : t(
                `${selected} is outside these filters. Its details and actions are hidden; your draft is kept. Open a result or clear the filters to continue.`,
                `${selected} berada di luar filter ini. Detail dan tindakannya disembunyikan; draf tetap tersimpan. Buka salah satu hasil atau hapus filter untuk melanjutkan.`,
              )}
        </p>
        <Button onClick={clear}>{t("Clear filters", "Hapus filter")}</Button>
      </section>
    ) : detail)}
    </>
  );
}
