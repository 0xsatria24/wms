import React, { useEffect, useRef, useState } from "react";
import Chart from "chart.js/auto";
import { Empty, Field, Summary, Tag, useText } from "./ui";

function ShipmentChart({ summary, series, locale }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const labels = series.months.map((row) =>
    new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(
      new Date(Date.UTC(summary.year, row.month - 1, 1)),
    ),
  );
  useEffect(() => {
    const dark = document.documentElement.dataset.theme === "dark";
    const chart = new Chart(canvas.current!, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: series.unit,
            data: series.months.map((row) => Number(row.qty)),
            borderColor: dark ? "#85BDFF" : "#005FCC",
            backgroundColor: dark ? "#85BDFF" : "#005FCC",
            borderWidth: 2,
            pointRadius: 3,
            segment: {
              borderDash: (context) =>
                context.p1DataIndex === labels.length - 1 ? [5, 4] : undefined,
            },
          },
        ],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            ticks: { color: dark ? "#BBC9DA" : "#526176" },
            grid: { color: dark ? "#304153" : "#E8EEF5" },
          },
          y: {
            beginAtZero: true,
            ticks: { color: dark ? "#BBC9DA" : "#526176" },
            grid: { color: dark ? "#304153" : "#E8EEF5" },
          },
        },
      },
    });
    return () => chart.destroy();
  }, [summary, series, locale]);
  return (
    <div className="chart-slot">
      <canvas
        ref={canvas}
        role="img"
        aria-label={`${summary.year} · ${series.unit}. ${locale === "en" ? "Confirmed monthly shipments. Data table below." : "Pengiriman bulanan terkonfirmasi. Tabel data di bawah."}`}
      />
    </div>
  );
}

export function ShipmentTrends({ summary, sku, locale }) {
  const t = useText();
  const [unit, setUnit] = useState("");
  const series =
    summary?.sku === sku
      ? summary.units.find((row) => row.unit === unit) || summary.units[0]
      : null;
  const percent = (value) =>
    value == null
      ? t("No comparison data", "Data pembanding belum ada")
      : `${value > 0 ? "+" : ""}${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  return (
    <>
      <div className="panel-heading">
        <h2>{t("Item trends", "Tren barang")}</h2>
        <span className="metric-label">
          {t("Confirmed shipments", "Pengiriman terkonfirmasi")}
        </span>
      </div>
      {!series ? (
        <Empty
          title={t(
            "No confirmed shipment data",
            "Belum ada data pengiriman terkonfirmasi",
          )}
        >
          {summary?.hidden
            ? t(
                "Shipment history is hidden during this blind count.",
                "Riwayat pengiriman disembunyikan selama hitung stok tanpa saldo.",
              )
            : t(
                "Confirmed shipment history for this item and warehouse will appear here.",
                "Riwayat pengiriman terkonfirmasi untuk barang dan gudang ini akan tampil di sini.",
              )}
        </Empty>
      ) : (
        <>
          {summary.units.length > 1 && (
            <Field label={t("Reporting unit", "Satuan laporan")}>
              <select
                value={series.unit}
                onChange={(event) => setUnit(event.target.value)}
              >
                {summary.units.map((row) => (
                  <option key={row.unit}>{row.unit}</option>
                ))}
              </select>
            </Field>
          )}
          <div className="trend-summary">
            <div>
              <span>{t("YTD shipped", "Terkirim YTD")}</span>
              <strong>
                {Number(series.ytd).toLocaleString(locale)} {series.unit}
              </strong>
              <small>
                {summary.year} · {t("Through", "Sampai")}{" "}
                {new Date(summary.asOf).toLocaleDateString(locale, {
                  timeZone: "Asia/Bangkok",
                })}
              </small>
            </div>
            <div>
              <b>{percent(series.ytdChange)}</b>
              <small>
                {t("vs same period last year", "vs periode sama tahun lalu")}
              </small>
            </div>
          </div>
          <div className="panel-heading chart-heading">
            <h3>{t("Monthly shipped units", "Unit terkirim per bulan")}</h3>
            <Tag>
              {t("Current month is partial", "Bulan berjalan belum lengkap")}
            </Tag>
          </div>
          <ShipmentChart
            key={document.documentElement.dataset.theme}
            summary={summary}
            series={series}
            locale={locale}
          />
          <Summary
            items={[
              [
                t("MoM, last complete month", "MoM, bulan terakhir lengkap"),
                percent(series.mom),
              ],
              [
                t("YoY, last complete month", "YoY, bulan terakhir lengkap"),
                percent(series.yoy),
              ],
              [
                t("Last complete month", "Bulan terakhir lengkap"),
                series.lastMonth,
              ],
            ]}
          />
          <details className="chart-data">
            <summary>{t("View chart data", "Lihat data grafik")}</summary>
            <table className="data-table">
              <caption>
                {summary.year} · {series.unit}
              </caption>
              <tbody>
                {series.months.map((row) => (
                  <tr key={row.month}>
                    <th scope="row">
                      {summary.year}-{String(row.month).padStart(2, "0")}
                    </th>
                    <td>{Number(row.qty).toLocaleString(locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </>
      )}
    </>
  );
}
