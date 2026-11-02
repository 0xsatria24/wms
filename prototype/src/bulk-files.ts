import JsBarcode from "jsbarcode";
import { csvText } from "./bulk-model";

export function downloadFile(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCsv(filename: string, rows: unknown[][]) {
  downloadFile(filename, csvText(rows), "text/csv;charset=utf-8");
}

export function downloadLabelSheet(products: any[], locale = "en") {
  const escape = (value: string) =>
    String(value).replace(
      /[&<>"']/g,
      (char) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[char],
    );
  const labels = products
    .map((product) => {
      const canvas = document.createElement("canvas");
      JsBarcode(canvas, product.barcode, {
        format: "CODE128",
        width: 2,
        height: 70,
        margin: 16,
        displayValue: true,
        fontSize: 16,
      });
      return `<article><strong>${escape(product.name)} · ${escape(product.sku)}</strong><img src="${canvas.toDataURL("image/png")}" width="${canvas.width}" height="${canvas.height}" alt="${escape(product.barcode)}"><small>Internal · Code 128</small></article>`;
    })
    .join("");
  const title = locale === "en" ? "Printable labels" : "Label siap cetak";
  const note =
    locale === "en"
      ? "Use your browser’s Print command to print this sheet. Physical printing is not confirmed."
      : "Gunakan perintah Cetak di browser untuk mencetak lembar ini. Cetak fisik belum dikonfirmasi.";
  downloadFile(
    "item-labels.html",
    `<!doctype html><html lang="${locale === "en" ? "en" : "id"}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{font:16px sans-serif;margin:24px;color:#111;background:#fff}main{display:flex;flex-wrap:wrap;gap:16px}article{break-inside:avoid;border:1px solid #555;padding:16px;display:flex;flex-direction:column;align-items:center;max-width:100%}img{max-width:100%;height:auto}small{font-size:12px}p{max-width:70ch}@media print{header{display:none}body{margin:0}article{page-break-inside:avoid}}</style><header><h1>${title}</h1><p>${note}</p></header><main>${labels}</main></html>`,
    "text/html;charset=utf-8",
  );
}
