# Antislop gate perubahan layout

31 Oktober 2026. Status: **PASS dalam cakupan Stock position, sidebar, katalog Items dan editor**. Gate seluruh 21 fungsi tetap terpisah.

- PASS R01/R04/R06–R14/R19/R22/R29–R31: token, Source Sans 3, radius 16/8 dan gerak kontrol tetap. Ikon menunjukkan cari/edit/halaman. Tabel untuk membandingkan kode/status, dialog untuk menjaga konteks, accordion untuk kepadatan menu. Tidak ada dekorasi atau layout marketing baru.
- PASS R02/R15/R16/R20/R21: copy menyebut aksi, tema mengikuti pilihan, karakter Clear Operations dipertahankan.
- PASS R03/R32/R34/R39/C4: lebar 390/900/1448 tanpa horizontal page overflow; dialog ponsel muat dan bisa discroll, fokus solid terlihat, akhir menu bisa dijangkau, dark/Indonesia diperiksa.
- PASS R17/R18/R23/R36/R38/C5: fixture 10.000 item berlabel sintetis dan tidak menulis database. Tidak ada klaim kapasitas produksi, testimoni, foto atau logo klien yang dikarang.
- PASS R24/R26/R27/R35/C2: search/filter/sort, pagination Next/Previous, page size, empty state, tabs, editor, submit fixture, validasi, draf dan batal diperiksa. Save tanpa perubahan disabled. API bisnis aplikasi utama tetap digunakan.
- PASS R25: 14 pasangan token diperiksa ulang dengan checker antislop-human, minimum 5.36:1. Kontrol baru memakai token tersebut.
- PASS R28/C3: tidak ada FAQ atau section pengisi. Toolbar dan kontrol untuk pencarian atau pemeliharaan master.
- PASS R33/R40: source ditulis langsung, tanpa injeksi runtime/CSS eksternal, media baru atau angka performa tanpa pengukuran.
- PASS liveliness/C1: ENERGY 1 / RHYTHM 1 / MOTION 1; tabel menjadi fokus, accent untuk aksi/pilihan dan whitespace untuk membedakan toolbar/data/editor. Alasan tercatat pada root design-qa.md.

Bukti: `prototype/qa/layout-20261031/`, `tests/item-catalog.test.mjs`, build/test logs, dan root `design-qa.md`. Tidak menyatakan browser E2E seluruh transaksi, pengujian produksi atau compliance keseluruhan aplikasi.
