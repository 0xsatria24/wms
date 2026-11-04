# Desain alur: pekerjaan stok dalam satu konteks

Tanggal: 4 November 2026. Status: draft desain untuk review, belum diimplementasikan.

Pendamping: [PRD](../../planning/2026-11-04-stock-workspace-prd.md), [audit](../../planning/2026-11-04-workflow-audit.md), [papan visual](../../../artifacts/ux-audit-20261104/design.html).

## Intent dan keputusan

Pengguna ingin melihat barang lalu menjalankan tindakan yang relevan di halaman yang sama. Setelah membuat master, user harus tahu cara mencatat barang datang dan meneruskannya ke QC. Penerimaan manual boleh tanpa PO. Barang baru harus bisa didaftarkan/diajukan saat penerimaan, tanpa meninggalkan pekerjaan asal.

Pilihan pengguna: **panel samping**, tabel dan form tetap terlihat bersama di desktop. Pertahankan fungsi yang efektif. Arah visual Clear Operations tetap menjadi acuan; tidak mengganti brand, tabel berkelompok atau seluruh sistem komponen.

Mode surface: **Operate**. Design Read: ruang kerja operator/supervisor gudang, Clear Operations yang sudah ada, ENERGY 1 / RHYTHM 1 / MOTION 1. Fokus desain adalah objek yang dipilih, tindakan berikutnya dan hasil server yang jelas.

## Pendekatan yang dipertimbangkan

| Pendekatan | Kelebihan | Trade-off | Keputusan |
|---|---|---|---|
| Panel samping dari Posisi stok | Barang, saldo dan form terlihat bersama; konteks tabel bertahan | Lebar tabel perlu ditangani; dirty selection perlu guard | Dipilih pengguna |
| Form melebar di bawah baris | Dekat dengan item dan lebar form besar | Mendorong baris lain turun, posisi scroll berubah dan form panjang | Tidak dipilih |
| Mempertahankan perpindahan antarhalaman sebagai jalur utama | Perubahan kecil pada layout | User tetap mengingat menu dan mencari dokumen lagi | Tidak memenuhi masalah utama; rute lama hanya entry point alternatif |

Desain ini menyatukan penyajian tindakan, bukan menyatukan efek domain yang berbeda. QC, approval, release, reserve, pick dan ship tetap mempunyai kewenangan dan konfirmasi masing-masing.

## Prinsip interaksi

1. Pilih objek dahulu, lalu tindakan. Parent SKU dengan beberapa posisi tidak berarti posisi pertama dipilih diam-diam.
2. Judul panel menjawab sedang mengerjakan apa dan untuk barang/dokumen mana.
3. Satu aksi utama yang sah pada state sekarang; aksi lain tetap dapat dipahami lewat menu berlabel.
4. Input aktual, hasil QC, alasan dan scan tetap nyata. Isi dari master boleh digunakan ulang; observasi bukan konfirmasi stok.
5. Hambatan ditulis di dekat tindakan yang terhalang, dengan jalan pemulihan yang benar.
6. Konfirmasi berisi dampak sebelum/sesudah. Sukses baru tampil ketika hasil server diketahui.
7. Draf dan return context bertahan saat membuka subview kecil, meninjau, lalu kembali.

## Struktur dan jalur lama

| Ruang kerja baru | Isi dan hubungan | Rute lama / fungsi yang tetap tersedia |
|---|---|---|
| Persediaan | Posisi stok, detail barang/posisi, riwayat dan pintu aksi | stock; master tetap katalog administrasi; tracking/movements menjadi tab investigasi dan rute alternatif |
| Barang masuk | Katalog receipt; panel Terima, QC, Simpan ke rak, Riwayat | receiving, quality dan putaway menjadi filter entry point dengan deep link tugas |
| Barang keluar | Katalog order; panel permintaan sampai kirim | orders, reservations, picking, shipping; cancellation di order/tugas kembali |
| Operasi gudang | Transfer, retur, opname | Dokumen sumber dan aturan fisik tetap terpisah |
| Kontrol | Pending, kasus ERP, monitoring, pilot RFID | Check/retry request dan retry event ERP tidak disamakan |
| Administrasi / Pengaturan | Master, kemasan/perangkat, pengguna, perusahaan/gudang, policy | Wizard admin dan undangan identitas yang sudah disetujui tidak diganti |

Ini penyederhanaan menu yang diusulkan. Semuanya tetap dapat ditelusuri dalam matriks audit. Tidak ada kebutuhan dashboard metrik baru, ilustrasi atau kartu promosi.

## Anatomi panel bersama

**Header tetap:** judul tindakan, nama barang, SKU lengkap, gudang, nomor sumber/tugas jika ada, tutup/kembali. Untuk dokumen multi-line, judul adalah receipt/order dan item ditampilkan pada baris aktif.

**Area konteks:** asal yang terpilih, kondisi/hold terpisah, fisik/dipesan/tersedia dan waktu relevan jika user berhak melihatnya. Blind count dapat mengharuskan sebagian area tidak ada; jangan kirim data terlarang ke client.

**Body:** form tindakan saat ini, atau daftar child task bila lebih dari satu. Detail lanjutan dan bukti lama dapat dilipat tanpa menyembunyikan informasi yang menentukan konfirmasi.

**Footer:** Simpan draf jika relevan dan satu tindakan utama spesifik, misalnya Tinjau perpindahan. Status draf terlihat sebagai Belum tersimpan, Menyimpan, Tersimpan, atau Gagal menyimpan. Footer tidak menutupi form dan dapat dijangkau keyboard.

**Review:** menggunakan panel yang sama. Body merangkum barang, sumber, tujuan, actual/unit, perubahan saldo dan konsekuensi. Tombol Kembali mengembalikan isian; Konfirmasi menyatakan transaksi yang dilakukan, bukan tombol generik Lanjut.

**Hasil:** ID server lengkap, timestamp posting dan delta. Berikutnya Buka tugas QC / Simpan ke rak / Kembali ke stok sesuai hasil nyata. Unknown menampilkan Periksa hasil dan identitas request, tanpa berpura-pura sukses/gagal.

### Perilaku pemilihan dan keluar

- Membuka nama barang membuka detail; tombol Proses barang membuka daftar aksi. Checkbox tetap pemilihan batch yang terpisah.
- Parent multi-posisi menunjukkan pilih sumber sebelum jumlah. Detail yang terlihat mencakup posisi yang sedang diizinkan/filter, bukan seluruh gudang tersembunyi.
- Jika form kotor dan user memilih item/aksi/gudang lain: tampilkan pilihan Simpan draf lalu pindah, Buang perubahan, atau Tetap di sini. Save harus benar-benar selesai sebelum context switch.
- Menutup panel yang bersih mengembalikan fokus pada pemicu. Menutup panel kotor meminta keputusan yang sama. Error field tidak menghapus isian.
- Search/sort/page dan scroll asal pulih ketika kembali. Seleksi bulk tetap mengikuti aturan scope/filter/page yang sudah ada; pemulihan halaman tidak menghidupkan seleksi usang.
- Back browser mengembalikan subview/panel dan konteks yang sah, tidak mengeksekusi transaksi. URL/link mengandung canonical ID dan action/view, tidak menyimpan payload sensitif mentah.

## S01. Posisi stok dan pemilihan aksi

Pertahankan tabel grouped SKU, posisi yang dapat dibuka, alignment dan spacing yang sudah dipilih. Di header ada **Terima barang**. Aksi per item berlabel **Proses barang**; di dalamnya tampil Pindah rak, Transfer gudang, Buat permintaan keluar, QC/penempatan yang terkait, Riwayat dan Label sesuai capability/status.

Di state kosong utamakan “Belum ada stok di gudang ini” dan “Catat penerimaan barang untuk memulai”, dengan Terima barang. Transfer masuk menjadi jalur sekunder jika relevan. Filter/pagination kosong yang tidak membantu tidak mengambil mayoritas layar.

Master tanpa posisi tidak diberi lokasi atau saldo fiktif. Setelah master disimpan: “Barang terdaftar. Belum ada stok yang diterima.” → Terima barang. Bila pencarian stok menemukan master tanpa stok, tampilkan kandidat berlabel Belum ada stok dan pintu receipt, tanpa menciptakan stock position nol palsu.

### Pilihan yang sah

Panel menu menampilkan tindakan yang lazim tetapi belum dapat dikerjakan sebagai baris nonaktif dengan sebab jika sebabnya relevan dan datanya boleh dibaca. Contoh: “Pindah rak: barang masih menunggu QC”. Tindakan di luar kewenangan boleh tidak ditampilkan, disertai status “Pemeriksaan dilakukan supervisor” pada tugas yang memang boleh dilihat.

Jangan menawarkan dropdown bebas untuk mengganti current location ke QC/Staging sambil mengubah status. “Proses ke QC” berarti membuka tugas inspeksi dari penerimaan yang sah. “Simpan ke rak” berarti putaway. “Kirim” memerlukan order dan tahap fisik yang benar.

## S02. Pindah rak

1. Asal menampilkan gudang, item, posisi, kondisi dan jumlah belum dipesan. Bila beberapa posisi, pengguna memilih salah satunya.
2. Tujuan hanya storage gudang yang sama. Tampilkan kode/nama rak, eligibility dan alasan nonaktif. Asal=tujuan tidak sah.
3. Actual qty memakai unit asli, batas bebas terkini dan precision. Verifikasi item/lokasi sesuai kontrak; placeholder bukan scan yang sudah dilakukan.
4. Tinjau menampilkan A-01: 24 → 19, A-02: 0 → 5, fisik gudang tetap. Angka hanya dari preview yang dihitung untuk contoh/tindakan tersebut, diverifikasi ulang server pada confirm.
5. Confirm memanggil command relokasi baru. Conflict/frozen/perubahan komitmen membuka review ulang tanpa menimpa maksud pengguna. Hasil pasti memperbarui posisi dan menautkan ledger.

V1 tidak memindahkan reserved/held stock lewat relokasi umum. Tampilkan Buka order / Lihat hold untuk mengikuti workflow pemilik. Multi-item mass posting belum menjadi aksi checkbox default.

## S03. Penerimaan manual / dari PO

Pintu yang sama tersedia dari header stok, hasil simpan master, atau Barang masuk → Penerimaan baru. Item terpilih menjadi baris awal; user tidak memilih ulang warehouse/SKU.

Di body pilih Manual atau Dari PO. Dari PO mempunyai picker PO sah dan sisa; Manual menampilkan asal barang, referensi bila ada, alasan tanpa PO dan waktu penerimaan. Source fields yang relevan berubah; tidak menyebut kuantitas manual sebagai ordered/remainder.

Baris penerimaan: cari/scan barang, nama/SKU, unit, actual dan status identitas. Tambah baris mempertahankan baris lain. Luaskan ke subview dokumen ketika banyak baris tidak lagi nyaman di panel, tetap dalam konteks dan bukan pemilihan ulang modul. Form multi-item memerlukan model header/lines sebagaimana PRD, bukan sekadar array form yang disubmit sebagai beberapa mutasi tersembunyi.

Footer Tinjau penerimaan menampilkan “Setelah dikonfirmasi: fisik diterima di Receiving, menunggu QC, belum tersedia untuk pengeluaran.” Konfirmasi menulis aktual; Simpan draf tidak menulis stok. Hasil memiliki tombol Buka QC untuk task yang benar, atau status menunggu supervisor.

## S04. Barang belum dikenal di penerimaan

Di bawah pencarian: “Barang ‘[nilai pencarian]’ belum ditemukan.” Pilihan Cari master yang sudah ada dan Tambah barang baru/Ajukan barang baru memakai capability saat itu.

Tambah ringkas adalah subview panel, dengan breadcrumb Kembali ke penerimaan. Tidak ada modal di dalam modal. Isian utama: nama, SKU, satuan, barcode yang diketahui atau pilihan Buat kode internal. Kategori opsional. Detail tambahan menampung dimensi/berat/foto.

- **Simpan berhasil:** master canonical dikembalikan ke baris asal. Sumber dan actual yang pernah diketik tetap ada; user memeriksa ulang identitas/scan sebelum receipt confirm.
- **Duplikat:** tampil kandidat yang sama dan Pilih barang ini, tanpa menambah duplikasi.
- **Batal:** kembali ke isian pencarian semula, draf lain utuh.
- **Tidak berhak membuat master:** Ajukan barang baru mengirim proposal sesuai scope. Receipt bertanda Menunggu pendaftaran barang; tidak ada stok yang diposting. Keputusan reviewer menautkan master baru/existing lalu memberi tindakan lanjut.
- **Barcode baru untuk master existing:** jangan mengganti mapping utama diam-diam. Pengguna memilih master sah dan menjalankan verifikasi yang benar atau meminta perubahan mapping berwenang.

## S05. QC dan simpan ke rak

Header mempertahankan receipt/line/task. Ringkasan menunjukkan jumlah yang harus diperiksa dan sumber. Form good/bad menampilkan total yang diklasifikasikan serta sisa. Sisa bukan nol atau jumlah negatif/over tidak boleh masuk review. Alasan wajib jika tidak bagus >0. Copy menjelaskan bahwa posting QC menyelesaikan seluruh sisa task; mengisi sebagian hanya menyimpan draf.

Operator melihat “Menunggu pemeriksaan supervisor/admin” dan status dokumen yang sah, bukan instruksi mengganti akun demo. Reviewer melihat aksi sesuai kewenangan aktual. Viewer tidak diberi tombol submit yang pasti ditolak.

Good result membuat task putaway; rejected result tetap hold dengan sumber/alasan. Panel menampilkan dua cabang dan kuantitas, bukan satu badge selesai yang menyiratkan semua tersedia. Klik Simpan ke rak membuka child task yang tepat, destination picker sah, actual, scan dan review. Partial putaway tetap didukung; yang belum ditempatkan tetap terlihat. Selesai tidak menghilangkan riwayat receipt.

## S06. Order sampai kirim

Header order menampilkan kebutuhan, dialokasikan, picked, shipped dan sisa dengan unit. Tahap aktif ditunjukkan dari state server, bukan hanya tab yang diklik.

| State | Aksi utama / isi | Yang tidak dilakukan otomatis |
|---|---|---|
| Draft | Edit lalu Ajukan untuk review | Approve / reserve |
| Perlu revisi | Alasan reviewer, Perbaiki lalu ajukan ulang | Membuat order duplikat |
| Menunggu review | Lihat status; reviewer sah meninjau | Pembuat tidak approve sendiri |
| Approved | Supervisor/admin dapat Release | Release bukan reserve |
| Released | Tinjau rencana alokasi dari beberapa rak | Preview bukan lock stok |
| Allocated | Buka tugas ambil per rak | Actual bukan qty otomatis |
| Picked/Staging | Periksa paket dan Tinjau pengiriman | Packing plan bukan keberangkatan |
| Shipped | Hasil, bukti, riwayat, retur sumber | Tidak mengubah ERP business result menjadi accepted |

Shortage yang diketahui ditampilkan di order: “[barang] membutuhkan [x unit]. Tersedia [y unit]. Kekurangan [z unit].” Angka tidak diketahui tetap tidak diketahui. Pemulihan mengikuti kebijakan: pilih rencana yang masih sah, tunggu receipt, atau parsial bila policy mengizinkan. Tidak menyiratkan partial sudah dibuat ketika request ditolak.

## S07. Transfer, retur, opname dan investigasi

- **Transfer:** dimulai dari posisi terpilih, pilih gudang tujuan yang diizinkan; send dan receive terpisah, in-transit terlihat, incoming receive membuat QC. Jangan membolehkan user mengklaim gudang target sudah menerima lewat panel asal.
- **Retur pelanggan:** pilih shipment canonical dan remaining returnable; terima ke Receiving/QC. **Retur supplier:** pilih sumber rejected/hold yang sah dan actual yang boleh keluar. Referensi diketik bukan satu-satunya cara menemukan source.
- **Pembatalan:** tampil dampak pada allocation dan tugas kembali ke rak. Picked stock tetap berkomitmen sampai pengembalian fisik yang diwajibkan dikonfirmasi.
- **Opname:** pertahankan freeze, blind input dan reviewer independen. Panel yang muncul dari stok tidak membocorkan expected balance, termasuk melalui aggregate, history, action preview atau ekspor.
- **Investigasi:** tab posisi/riwayat pada barang tetap berfungsi saat qty nol. Search item terpisah dari filter movement. Page history dan total scope jelas; buka sumber membuka dokumen tepat dan bisa kembali ke filter asal.

## S08. Pending, ERP dan fungsi pendukung

Pending memakai ringkasan seperti “Penerimaan 30 unit untuk [receipt]”, waktu capture, owner/gudang dan status yang terbaca. Detail teknis/JSON dapat dibuka sebagai tambahan. Offline menawarkan Kirim permintaan asal; unknown menawarkan Periksa hasil dahulu. Retry dari detail tunggal mempunyai review yang sama amannya dengan bulk dan menggunakan maksud asli.

ERP event tetap terpisah: transaksi WMS, pengiriman event dan hasil bisnis ERP. Default filter kasus perlu perhatian, lengkap dengan pagination dan source link. Kasus di monitoring dapat ditautkan langsung, termasuk kasus lama di luar 200 terbaru. Memperbaiki ERP tidak memposting stok lagi.

Label satu/multi-item mempunyai alur validasi yang sama. Tampilkan file berhasil dibuat dan history tercatat sebagai dua hasil jika perlu. Jangan menyebut dicetak bila tidak ada printer. Kemasan punya daftar/search/detail, bukan hanya kemasan pertama. Perangkat dan pilot RFID berada di area setup/pilot yang jelas.

Editor akses menampilkan satu baris per gudang: gudang, role saat ini, role yang diusulkan, akses/status dan delta yang akan disimpan. Tidak meratakan role saat user hanya membuka lalu menyimpan. Undangan, first-admin wizard dan password recovery tetap mengikuti alur yang sudah disetujui.

## Copy dan state

| Konteks | Copy yang dituju | Tindakan |
|---|---|---|
| Master berhasil | Barang terdaftar. Belum ada stok yang diterima. | Terima barang |
| Empty stock | Belum ada stok di gudang ini. Catat penerimaan barang untuk memulai. | Terima barang |
| Unknown item | Barang belum ditemukan. Cari master yang sama atau daftarkan barang ini. | Cari / tambah / ajukan |
| Menunggu QC | [qty unit] sudah diterima dan menunggu pemeriksaan. Belum tersedia untuk pengeluaran. | Buka QC / lihat status |
| Barang ditahan | [qty unit] ditahan. Alasan: [alasan sebenarnya]. | Lihat sumber / tindak lanjut |
| No permission | Pemeriksaan ini memerlukan supervisor/admin di [gudang]. | Lihat status tugas |
| Draft tersimpan | Draf tersimpan [waktu hasil nyata]. Stok belum berubah. | Lanjutkan |
| Draft lokal | Draf disimpan pada perangkat ini sesuai kebijakan. Belum dikirim. | Lanjutkan / kirim saat sah |
| Unknown outcome | Hasil konfirmasi belum diketahui. Server mungkin sudah mencatatnya. | Periksa hasil |
| Conflict | Data berubah sejak ditinjau. Periksa perbedaan sebelum mencoba lagi. | Muat perubahan dan tinjau |
| Shortage | Butuh [x], tersedia [y], kurang [z] [unit] untuk [dokumen/barang]. | Pemulihan sesuai aksi |
| Confirmed | [tindakan] tercatat. [ID lengkap], [waktu server]. | Tugas berikutnya / riwayat |

Global banner hanya untuk keadaan global seperti sesi/koneksi atau recovery yang masih relevan. Business error tetap di action context. Menghapus banner tidak menghapus request unknown/pending.

## Responsif dan aksesibilitas

- Desktop split apabila area kerja cukup untuk tabel yang masih dapat dibaca dan panel sekitar 400-480px. Perubahan lebar tidak boleh menimpa atau menutup kolom/tombol tanpa scroll lokal yang jelas.
- Bila split membuat tabel terlalu sempit, detail menjadi subview area kerja. Ponsel memakai layar penuh untuk panel, judul/back/gudang tetap terlihat dan kembali memulihkan daftar.
- Tabel operasional tetap memakai region horizontal berlabel, focusable dan tidak membuat seluruh body melebar. Perilaku ini tidak bergantung pada checkbox. Kontrol mobile sort dipertahankan.
- Desktop panel nonmodal tidak menjebak fokus atau menyembunyikan tabel dari pembaca layar. Subview ponsel mengatur fokus ke judul; modal konfirmasi jika benar-benar dipakai harus native, Escape dan focus return.
- Label permanen, required/format/unit jelas, ringkasan error menautkan field; warna selalu disertai teks. Loading dan outcome diumumkan melalui status/alert yang tepat.
- Token, Source Sans 3, 48px row, 44px header/controls, 12px cell x, 2px cell y dan 8px gaps mengikuti sistem sekarang. Pengecualian pointer Item Master yang sudah disetujui dipertahankan; target sentuh tetap memadai.
- ID lengkap tidak dipotong ellipsis. Placeholder scan tidak menjadi actual scan. Bahasa UI boleh berubah tanpa mengubah SKU, barcode, reference, nama master gudang atau payload.
- Light default dan dark preference tetap. Motion singkat hanya untuk perubahan state, dengan reduced-motion yang tetap menjaga informasi. Tidak ada animasi dekoratif pada daftar kerja.

## Data contoh dan visual yang dilampirkan

Papan visual adalah **mockup statis untuk menilai susunan**, bukan aplikasi yang sudah tersambung. Data diberi label simulasi, tidak ada gambar produk palsu. Contoh perpindahan memakai 24 unit bebas di A-01 dan memindahkan 5 ke A-02; receipt/QC memakai contoh 30 = 24 bagus + 6 ditahan. Nama/angka contoh tidak menjadi data operasional.

Tidak ada klaim seluruh interaksi pada mockup sudah berjalan, produksi sudah siap atau hasil usability sudah terbukti. Layar aplikasi lama ada di folder bukti audit; layar usulan tidak boleh dicampur menjadi bukti perilaku lama.

## Kontrak implementasi dan integrasi

Implementer mengikuti FR/AC PRD, bukan menyelesaikan panel dengan mutasi state client. Kontrak baru diperlukan untuk manual receipt header/lines, proposal master, draft version, task graph, relokasi rak, revisi order dan multi-position allocation. Browser hanya menyusun maksud; server memvalidasi current scope/versi, mengunci, mencatat transaksi dan mengembalikan hasil canonical.

Context envelope minimal: principal, warehouse, entity kind/id, item, position/line/task identity, expected version, action, originating view/filter/page dan draft identity. Payload unknown/pending tetap immutable. Navigation return context tidak menjadi sumber otorisasi.

Koreksi posted documents memakai kompensasi terkontrol. Migrasi mempertahankan ID lama, source ERP, ledger dan audit; rute lama menjadi alias yang dapat ditelusuri sebelum diganti. Penghapusan modul lama hanya setelah fungsi pengganti setara terverifikasi.

## Verifikasi dan ukuran pekerjaan

Ini perubahan lintas perjalanan dan kontrak backend, bukan sekadar tambahan tombol. Jadikan correctness dan compatibility fondasi, kemudian implementasikan panel dan journey bertahap sesuai rollout PRD. Tidak ada estimasi hari yang dibuat tanpa perencanaan implementasi.

Reviewer pembangun memeriksa spesifikasi sebelum handoff akhir. Buktikan AC01-AC36 melalui tes domain/konkurensi/migrasi, browser per peran, kedua tema dan ukuran yang dikirimkan. Gunakan pengguna baru untuk mencoba manual receipt, unknown item, QC, pindah rak dan outbound. Perangkat, ERP klien serta UAT tetap verifikasi tersendiri.

Default desain yang harus diperiksa saat review: relokasi V1 unreserved storage saja; master operator berupa proposal; QC tetap full remainder; header multi-line membutuhkan model baru; retention, presisi bisnis, partial fulfilment dan lot requirements tetap terbuka sebagaimana PRD. Implementer boleh memilih struktur file/endpoint dan pola state internal selama seluruh kontrak ini tetap dipenuhi.
