# Language settings dan mikrocopy

Default: **English**, locale en. Pilihan kedua: **Bahasa Indonesia (santai)**, locale id-ID. Tidak mengikuti bahasa browser secara otomatis pada kunjungan pertama karena pengguna meminta English sebagai default. Pilihan eksplisit per pengguna disimpan; cakupan persistensi server/perangkat ditetapkan saat implementasi.

Lokasi: Settings → Language. Tampilkan pilihan aktif dan English (default). Perubahan langsung menampilkan preview dalam bahasa terpilih; tidak perlu tombol simpan terpisah. Kegagalan menyimpan preferensi diberitahu dengan jelas tanpa kehilangan input transaksi. Mengubah bahasa tidak mengirim formulir, mereset jumlah, mem-posting transaksi, atau mengubah unit dan zona waktu gudang. Jangan menukar perusahaan/gudang ketika bahasa berubah.

Bahasa Indonesia santai berarti ringkas dan akrab, tanpa bahasa slang yang mengaburkan tanggung jawab. Contoh: Coba lagi, Pilih barang, Barangnya belum dicek. Hindari istilah baku panjang seperti Mohon melakukan penginputan; hindari gua/lu dan lelucon pada pesan transaksi.

| Key | English | Bahasa Indonesia (santai) |
| --- | --- | --- |
| nav.inventory | Inventory | Stok barang |
| nav.receiving | Receiving | Barang masuk |
| nav.shipping | Shipping | Barang keluar |
| nav.transfers | Transfers | Pindah gudang |
| nav.count | Stock count | Hitung stok |
| nav.tracking | Tracking | Lacak barang |
| nav.integrations | Integrations | Integrasi |
| settings.title | Settings | Pengaturan |
| settings.language | Language | Bahasa |
| stock.title | Stock position | Posisi stok |
| stock.item | Item | Barang |
| stock.location | Location | Lokasi |
| stock.condition | Condition | Kondisi |
| stock.good | Good | Bagus |
| stock.notGood | Not good | Tidak bagus |
| stock.notAssessed | Not assessed yet | Belum dicek |
| stock.reserved | Reserved for orders | Dipesan |
| stock.available | Available | Tersedia |
| stock.unit | Unit | Satuan |
| product.specifications | Specifications | Spesifikasi barang |
| product.category | Category | Kategori |
| product.baseUnit | Base unit | Satuan dasar |
| product.dimensions | Dimensions | Ukuran |
| product.unitWeight | Unit weight | Berat per unit |
| product.notSet | Not set | Belum diisi |
| product.addImage | Add image | Tambah gambar |
| product.optionalImage | Optional image | Gambar boleh dikosongkan |
| product.changeImage | Change image | Ganti gambar |
| product.removeImage | Remove image | Hapus gambar |
| product.saveImage | Save image | Simpan gambar |
| product.cancel | Cancel | Batal |
| product.unsaved | Unsaved | Belum disimpan |
| product.uploadFailed | Image upload failed. Retry or continue without an image. | Gambarnya belum berhasil diunggah. Coba lagi atau lanjut tanpa gambar. |
| stock.reservedHelp | Units set aside for existing orders. | Barang yang sudah disisihkan buat pesanan. |
| stock.availableHelp | Units available for new orders. Stock on hold is excluded. | Barang yang bisa dipakai buat pesanan baru. Stok yang ditahan tidak dihitung. |
| trends.title | Item trends | Tren barang |
| trends.shipped | Shipped units | Jumlah dikirim |
| trends.ytd | YTD shipped | Dikirim sejak awal tahun |
| trends.mom | MoM · vs previous month | MoM · dibanding bulan lalu |
| trends.yoy | YoY · vs same month last year | YoY · dibanding bulan yang sama tahun lalu |
| trends.lastMonth | Last complete month | Bulan terakhir yang sudah lengkap |
| trends.partial | Partial | Belum lengkap |
| trends.allLocations | All locations | Semua lokasi |
| trends.noComparison | No comparison data | Data pembanding belum ada |
| trends.notComparable | Not comparable | Belum bisa dibandingkan |
| common.simulation | Simulation data | Data simulasi |
| common.retry | Retry | Coba lagi |
| common.loading | Loading… | Lagi dimuat… |
| common.noResults | No matching items | Barangnya tidak ketemu |
| common.clearFilters | Clear filters | Hapus filter |
| common.pending | Waiting for server confirmation | Menunggu konfirmasi server |
| common.unknown | Transaction outcome unknown. Check its status before retrying. | Hasil transaksinya belum jelas. Cek statusnya dulu sebelum coba lagi. |
| common.rejected | Transaction rejected. Stock was not changed. | Transaksi ditolak. Stok belum berubah. |

Tanggal dan angka mengikuti locale tampilan: English `29 Oct 2026`, `1,100`, `+10.0%`; Indonesia `29 Okt 2026`, `1.100`, `+10,0%`. Nilai data sama. Input jumlah mengikuti parser locale yang jelas; nilai ambigu meminta koreksi. Gunakan label unit master lokal bila tersedia, bukan mengonversi kuantitas ketika bahasa berganti. Dalam fixture satuannya unit/units.

Komponen harus menerima label lebih panjang tanpa pemotongan: maksimal dua baris pada header tabel, panel menambah tinggi, pesan error tidak dipotong. Language selector dapat dijangkau keyboard; state terpilih memakai checkmark dan teks, bukan warna saja. Penggantian bahasa menjaga fokus dan mengumumkan perubahan secara singkat. Nama barang master Product A tidak otomatis berubah menjadi Produk A.
