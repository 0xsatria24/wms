import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
} from "react";
import {
  Info,
  CheckCircle,
  WarningCircle,
  X,
  Image as ImageIcon,
} from "@phosphor-icons/react";

export const Locale = createContext("en");
export function useText() {
  const locale = useContext(Locale);
  return (en: string, id?: string) => (locale === "en" ? en : id || en);
}
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  primary?: boolean;
  danger?: boolean;
}
interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children?: React.ReactElement<any>;
}
interface BoxProps {
  children?: React.ReactNode;
  title?: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}
export function Button({
  children,
  primary = false,
  danger = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`button ${primary ? "primary" : ""} ${danger ? "danger" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
export function Field({ label, hint, error, children, ...props }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children ? (
        React.cloneElement(children, {
          id,
          "aria-describedby": hint || error ? `${id}-hint` : undefined,
          "aria-invalid": !!error,
        })
      ) : (
        <input
          id={id}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          aria-invalid={!!error}
          {...props}
        />
      )}
      {(hint || error) && (
        <small id={`${id}-hint`} className={error ? "error-text" : ""}>
          {error || hint}
        </small>
      )}
    </div>
  );
}
export function Notice({
  kind = "info",
  title,
  children,
  onClose,
}: {
  kind?: string;
  title?: React.ReactNode;
  children?: React.ReactNode;
  onClose?: () => void;
}) {
  const t = useText();
  const Icon =
    kind === "success"
      ? CheckCircle
      : ["error", "warning"].includes(kind)
        ? WarningCircle
        : Info;
  return (
    <div
      className={`notice ${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      <Icon size={21} aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        {children && <div>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          className="icon-button"
          aria-label={t("Close notification", "Tutup pemberitahuan")}
          onClick={onClose}
        >
          <X size={18} />
        </button>
      )}
    </div>
  );
}
export function Tag({
  kind = "neutral",
  children,
}: {
  kind?: string;
  children?: React.ReactNode;
}) {
  return <span className={`tag ${kind}`}>{children}</span>;
}
export function Panel({ title, children, className = "", action }: BoxProps) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-heading">
          <h2>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
export function Empty({ title, children, action }: BoxProps) {
  return (
    <div className="empty">
      <Info size={30} aria-hidden="true" />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function Summary({ items }: { items: React.ReactNode[][] }) {
  return (
    <dl className="summary">
      {items.map(([label, value], i) => (
        <div key={i}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: string[][];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="tabs" role="group" aria-label={label}>
      {items.map(([id, text]) => (
        <button
          type="button"
          key={id}
          aria-pressed={value === id}
          onClick={() => onChange(id)}
        >
          {text}
        </button>
      ))}
    </div>
  );
}
export function Thumb({
  product,
  large = false,
}: {
  product: any;
  large?: boolean;
}) {
  return (
    <span className={`thumbnail ${large ? "large" : ""}`}>
      {product?.image ? (
        <img
          src={product.image}
          width={large ? 80 : 40}
          height={large ? 80 : 40}
          alt=""
        />
      ) : (
        <ImageIcon size={large ? 42 : 24} aria-hidden="true" />
      )}
    </span>
  );
}
export function ProductName({ product }) {
  return (
    <div className="product-name">
      <Thumb product={product} />
      <div>
        <strong>{product?.name}</strong>
        <small>{product?.sku}</small>
      </div>
    </div>
  );
}
export function DataTable({
  columns,
  rows,
  label,
  empty,
  onSelect,
  selected,
}: {
  columns: {
    key: string;
    label: string;
    numeric?: boolean;
    render?: (row: any) => React.ReactNode;
  }[];
  rows: any[];
  label: string;
  empty?: string;
  onSelect?: (row: any, index: number) => void;
  selected?: any;
}) {
  return (
    <div className="table-wrap">
      <table aria-label={label}>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.numeric ? "numeric" : ""}
                scope="col"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={row.id || i}
              className={selected === (row.id || i) ? "selected" : ""}
            >
              {columns.map((col, ci) => (
                <td
                  key={col.key}
                  data-label={col.label}
                  className={col.numeric ? "numeric" : ""}
                >
                  {onSelect && ci === 0 ? (
                    <button
                      className="row-select"
                      type="button"
                      aria-pressed={selected === (row.id || i)}
                      onClick={() => onSelect(row, i)}
                    >
                      {col.render ? col.render(row) : row[col.key]}
                    </button>
                  ) : col.render ? (
                    col.render(row)
                  ) : (
                    row[col.key]
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <Empty title={empty} />}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  footer,
}: {
  title: React.ReactNode;
  children?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  const t = useText();
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current.showModal();
    return () => {
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id={id}>{title}</h2>
        <button
          className="icon-button"
          type="button"
          aria-label={t("Close dialog", "Tutup dialog")}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </dialog>
  );
}
export function DownloadButton({ filename, rows, children }) {
  const download = () => {
    const csv = rows
      .map((r) =>
        r
          .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
          .join(","),
      )
      .join("\r\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <Button onClick={download}>{children}</Button>;
}
export function errorText(code, t) {
  const messages = {
    "item-in-use": [
      "This item is used by stock, documents, packaging or labels. Deactivate it to stop new use while keeping its history.",
      "Barang sudah dipakai di stok, dokumen, kemasan, atau label. Nonaktifkan agar tidak dipakai untuk dokumen baru dan riwayatnya tetap tersimpan.",
    ],
    credentials: [
      "Email or password is incorrect.",
      "Email atau password belum benar.",
    ],
    csrf: [
      "The session changed. Refresh the page before confirming again.",
      "Sesi berubah. Muat ulang halaman sebelum konfirmasi lagi.",
    ],
    "server-error": [
      "The server could not complete this action. Keep the draft and try again after refreshing.",
      "Server belum bisa menyelesaikan tindakan ini. Pertahankan draf dan coba lagi setelah memuat ulang.",
    ],
    "session-expired": [
      "Your session ended. Sign in again before confirming.",
      "Sesi kamu berakhir. Masuk lagi sebelum konfirmasi.",
    ],
    duplicate: [
      "This code is already in use. Choose a unique code.",
      "Kode ini sudah dipakai. Gunakan kode yang unik.",
    ],
    required: [
      "Complete the required fields before continuing.",
      "Lengkapi bagian wajib sebelum melanjutkan.",
    ],
    image: [
      "The image type or size is not supported. Use a JPEG, PNG or WebP up to 5 MB.",
      "Jenis atau ukuran gambar belum sesuai. Gunakan JPEG, PNG, atau WebP sampai 5 MB.",
    ],
    "storage-unavailable": [
      "Pending storage is unavailable. Keep this draft and restore browser storage before sending.",
      "Penyimpanan pending tidak tersedia. Pertahankan draf dan pulihkan penyimpanan browser sebelum mengirim.",
    ],
    network: [
      "Connection interrupted. Check pending requests before trying again.",
      "Koneksi terputus. Periksa permintaan tertunda sebelum mencoba lagi.",
    ],
    quantity: [
      "Enter a whole quantity greater than zero (zero is allowed for a count).",
      "Isi jumlah bulat lebih dari nol (hasil hitung boleh nol).",
    ],
    source: [
      "The source document or remaining return quantity is not valid.",
      "Dokumen asal atau sisa jumlah retur belum sesuai.",
    ],
    remainder: [
      "Actual quantity exceeds the remaining quantity.",
      "Jumlah aktual melebihi sisa yang tersedia.",
    ],
    "scan-item": [
      "Item not recognized for this task. Scan the correct SKU or barcode.",
      "Barang tidak cocok dengan tugas. Pindai SKU atau barcode yang benar.",
    ],
    "scan-location": [
      "Location does not match. Scan the selected location.",
      "Lokasinya belum cocok. Pindai lokasi yang dipilih.",
    ],
    frozen: [
      "This position is frozen, on hold, or no longer available. Review its latest status.",
      "Posisi ini dibekukan, ditahan, atau tidak tersedia. Cek status terbarunya.",
    ],
    shortage: [
      "There is not enough available stock. No partial allocation was created.",
      "Stok yang tersedia belum cukup. Belum ada alokasi parsial.",
    ],
    "qc-total": [
      "Good and not good quantities must add up to the inspection quantity.",
      "Jumlah bagus dan tidak bagus harus sama dengan jumlah pemeriksaan.",
    ],
    reason: [
      "Add a reason before continuing.",
      "Isi alasan dulu sebelum melanjutkan.",
    ],
    approval: [
      "This action needs an approved document and a different authorized reviewer.",
      "Tindakan ini perlu dokumen yang disetujui dan peninjau berwenang yang berbeda.",
    ],
    "partial-policy": [
      "Partial shipment policy is not configured. Pick the remainder or review the demo policy in Settings.",
      "Aturan kirim parsial belum diatur. Ambil sisanya atau tinjau kebijakan demo di Pengaturan.",
    ],
    order: [
      "This order is unavailable or cancelled.",
      "Order ini tidak tersedia atau sudah dibatalkan.",
    ],
    task: [
      "This task has already been processed or is not available.",
      "Tugas ini sudah diproses atau tidak tersedia.",
    ],
    scope: [
      "This document belongs to a different warehouse.",
      "Dokumen ini milik gudang lain.",
    ],
    denied: [
      "Your current demo role cannot perform this action.",
      "Peran demo kamu belum bisa melakukan tindakan ini.",
    ],
    "pending-owner": [
      "Use the original user and warehouse to check this request.",
      "Gunakan pengguna dan gudang asal untuk memeriksa permintaan ini.",
    ],
    "key-changed": [
      "This request ID already has a different payload. The original request is preserved.",
      "ID permintaan ini sudah dipakai untuk isi yang berbeda. Permintaan asal tetap disimpan.",
    ],
    rejected: [
      "Simulated rejection. Nothing was posted. Review the draft before a new request.",
      "Simulasi penolakan. Belum ada yang dicatat. Tinjau draf sebelum membuat permintaan baru.",
    ],
    conflict: [
      "The record changed. Refresh and review the latest values before confirming again.",
      "Data sudah berubah. Muat ulang dan tinjau nilai terbaru sebelum konfirmasi lagi.",
    ],
    "count-conflict": [
      "Count cannot be posted: check the frozen snapshot and held reservations.",
      "Hasil hitung belum bisa dicatat. Periksa snapshot beku dan reservasi tertahan.",
    ],
    invariant: [
      "This change would create an invalid balance. Nothing was posted.",
      "Perubahan ini membuat saldo tidak sah. Belum ada yang dicatat.",
    ],
  };
  return t(
    ...(messages[code] || [
      "The action could not be completed. Review and try again.",
      "Tindakan belum selesai. Tinjau lalu coba lagi.",
    ]),
  );
}
