# Inventory UI direction

## Acuan aktif implementasi, 30 Oktober 2026

Pengguna meminta implementasi ulang dari mockup pada chat “Rancang sistem desain UI”, lalu menetapkan ASP.NET Core 10, PostgreSQL 18 dan React/TypeScript. **Clear Operations** menggantikan komposisi Ledger lama untuk aplikasi aktif. Source of truth: `design-system/redesign-2026-10-29-v2/complete-suite/`, board05 untuk autentikasi dan `revisions/01-stock-trends/stock-position-en.png` untuk S03. Implementasi: [frontend](prototype/README.md), [backend dan status](docs/implementation/README.md).

Design Read: ruang kerja Inventory/WMS untuk operator, supervisor dan pengelola akses; sidebar putih, workspace abu dingin, panel radius16, pilihan cyan pucat dan aksi deep blue. ENERGY 1 / RHYTHM 1 / MOTION 1. English default; Bahasa Indonesia santai tersedia. Logo klien belum ditentukan.

Bagian di bawah mencatat arah dan batas tahap historis. Pernyataan “tanpa implementasi” pada arsip tidak membatasi permintaan implementasi terbaru.

## Acuan usulan terbaru, 29 Oktober 2026

Permintaan pengguna terbaru membatasi pekerjaan pada desain sistem per fungsi, tanpa implementasi. Referensi laptop/logistik dipakai untuk hierarki panel, kepadatan tabel dan ruang kerja terang, tanpa menyalin logo, ilustrasi truk atau modul ERP. Arah Ledger di bawah tetap menjadi dasar warna, tipografi dan karakter.

[Blueprint 29 Oktober 2026](design-system/blueprint-2026-10-29/README.md) adalah usulan desain terbaru: fondasi, 21 spesifikasi fungsi, papan statis desktop serta contoh handheld, tablet, state dan tema gelap. [Fondasi](design-system/blueprint-2026-10-29/00-foundation.md) mencatat adaptasi referensi, token, alasan dan kontrak perilaku. ENERGY 1 / RHYTHM 1 / MOTION 1 dipertahankan.

Katalog HTML/CSS/JS lama tidak diubah dan tidak menjadi bukti implementasi blueprint ini. Semua kontrol pada papan baru adalah gambar; seluruh contoh operasional diberi label Data simulasi. Keputusan D01-D05/T01-T08 tetap terbuka dan UAT belum dijalankan.

## Catatan arah sebelumnya

Status: revised design proposal following the user's correction. Local implementation remains an unverified draft.

## Source and character

The user supplied an ERP inventory screenshot as inspiration and explicitly rejected copying it. Retain its readable tables, useful density and visible actions. Its navigation placement, plum buttons, cyan selected rows and location-tree composition are not requirements. The user's Ledger selection supplies warm white, graphite and deep teal with a calm, restrained tone. Earlier close-reference layouts are superseded.

Audience: warehouse operators and supervisors reviewing quantities, locations, conditions and reservations. Mood: practical, precise and familiar to users of business software.

Dial: ENERGY 1 / RHYTHM 1 / MOTION 1.

## Visual language

- Light surfaces, graphite text and fine horizontal rules keep the table dominant.
- Deep teal marks the primary transaction action. Secondary actions use neutral outlines so the next step has a clear priority.
- A neutral selected-row fill and checked checkbox identify batch selection without copying the reference's cyan treatment.
- Amber and red carry quality exceptions and errors, always paired with text.
- Segoe UI with system fallbacks serves workstation reading; tabular numerals align quantities.
- Compact rows use 14px text at the default root size. Checkbox labels and controls retain a 44px hit area; handheld layouts use labeled stacked records.
- A left module navigation provides a stable home for each working view. Within the page, a title and primary receiving action precede search, selection and paging controls.
- Location, condition and allocation filters sit above the records in three labeled groups. This keeps the full table width available for comparing quantities.
- Product codes occupy their own line above the name. Physical, committed and free quantities form a repeated reading sequence across the table and transaction review.
- Inline text actions expose frequent row operations. Dialogs review consequential changes with their affected records and quantities.
- Motion is limited to immediate hover, focus and pressed feedback.

## Application content

The first screen is stock availability, using the existing inventory requirements. Automatic replenishment remains outside the accepted application scope. Demo rows and actions are labeled simulation data; generic product placeholders do not imply the client's industry. There are no client identities, fake notifications, avatars, charts or performance claims.

Two appearances share semantic roles. Light is the default for daytime warehouse administration; dark is an optional user preference. Both require browser verification before release.

## Decisions to carry into the product

Distinct labels identify physical, committed and free stock. Quarantine preserves physical quantity and any held commitment while free-for-allocation becomes zero. Selected records remain identifiable at confirmation. Pending capture and unknown outcomes have different messages and retry behavior.

The final product name, company brand, real device constraints and production access policies remain open. This visual reference does not resolve those operational decisions.
