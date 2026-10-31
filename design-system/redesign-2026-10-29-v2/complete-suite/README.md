# Clear Operations — Complete function design draft

21 fungsi memiliki spesifikasi dan papan visual, ditambah tiga layar autentikasi. Status: desain statis, belum implementasi. English default; Indonesia santai dengan label Dipesan.

[Authentication](authentication.md) · [Components and states](components.md) · [Tokens](tokens.json) · [Localization](localization.md) · [Traceability](traceability.md) · [Review](review.md)

| ID | Function specification | Visual sheet / panel |
|---|---|---|
| S01 | [Access and administration](functions/01-akses-dan-lingkup.md) | 01-access-master / 4 |
| S02 | [Item master](functions/02-master-barang-lokasi-satuan.md) | 01-access-master / 5 |
| S03 | [Stock position](functions/03-posisi-stok-dan-saldo-awal.md) | 01-access-master / 6 |
| S04 | [Reservations](functions/04-ketersediaan-dan-reservasi.md) | 02-inbound / 1 |
| S05 | [Receiving](functions/05-penerimaan-aktual.md) | 02-inbound / 2 |
| S06 | [Quality inspection](functions/06-qc-dan-karantina.md) | 02-inbound / 3 |
| S07 | [Putaway](functions/07-penempatan-putaway.md) | 02-inbound / 4 |
| S08 | [Orders and approvals](functions/08-order-dan-persetujuan.md) | 02-inbound / 5 |
| S09 | [Picking and shortages](functions/09-picking-dan-short-pick.md) | 02-inbound / 6 |
| S10 | [Packing and shipment](functions/10-packing-dan-pengiriman.md) | 03-outbound / 1 |
| S11 | [Cancellation and return to stock](functions/11-pembatalan-dan-kembali-stok.md) | 03-outbound / 2 |
| S12 | [Warehouse transfers](functions/12-transfer-dan-perjalanan.md) | 03-outbound / 3 |
| S13 | [Customer and supplier returns](functions/13-retur-pelanggan-supplier.md) | 03-outbound / 4 |
| S14 | [Blind stock count](functions/14-opname-dan-penyesuaian.md) | 03-outbound / 5 |
| S15 | [ERP reconciliation](functions/15-integrasi-erp.md) | 03-outbound / 6 |
| S16 | [Stock movements](functions/16-kartu-stok-dan-laporan.md) | 04-control / 1 |
| S17 | [Pending transactions](functions/17-pending-konflik-dan-retry.md) | 04-control / 2 |
| S18 | [Operations and recovery](functions/18-monitoring-backup-pemulihan.md) | 04-control / 3 |
| S19 | [Item tracking](functions/19-tracker-dan-detail-unit.md) | 04-control / 4 |
| S20 | [Labels packaging and devices](functions/20-label-kemasan-dan-perangkat.md) | 04-control / 5 |
| S21 | [RFID pilot](functions/21-sesi-rfid-pilot.md) | 04-control / 6 |

Auth: board 01 panel 1 Admin login, panel 2 Registration, panel 3 Forgot password.

**Rujukan autentikasi terbaru:** [board05](boards/05-components-responsive.png), panel1–3. Board05 juga memuat state komponen, tablet receiving dan handheld picking. Detail form pada board01 telah disupersede. Semua gambar adalah draft statis; baca temuan pada review sebelum memakai sebagai spesifikasi implementasi.

## Visual index

- [Access, master, stock](boards/01-access-master.png)
- [Reservations through picking](boards/02-inbound.png)
- [Shipment, transfer, count, ERP](boards/03-outbound.png)
- [Ledger, pending, operations, tracking, labels, RFID](boards/04-control.png)
- [Auth refinement, component states, tablet and handheld](boards/05-components-responsive.png)

## Open decisions

D01–D05 dan T01–T08 tetap terbuka. Registration adalah permintaan akses dengan approval; kebijakan invitation/SSO dan reset masih perlu ditetapkan. RFID tetap pilot opsional. Kalender tren, metric shipped units, dan batas foto tetap asumsi desain.
