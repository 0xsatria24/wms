# Tool QA gratis lokal

Pemasangan 1 November 2026. Tidak menggunakan SonarQube Cloud, trial edisi komersial, atau CodeRabbit. CodeRabbit CLI yang sempat selesai dipasang sebelum koreksi pengguna sudah dicabut kembali beserta entri PATH barunya.

| Tool | Versi | Lokasi / penggunaan |
| --- | --- | --- |
| Lighthouse CLI | 13.6.0 | Instalasi npm global; `lighthouse --version` |
| axe CLI / axe-core | 4.14.0 | Instalasi npm global; `scripts/audit-accessibility.ps1` memakai ChromeDriver lokal |
| ChromeDriver | 156.0.8078.80 | `.tools/chromedriver/chromedriver-win64/`; sesuai build Chrome lokal 156.0.8078 |
| SonarQube Community Build | 26.10.0.133078 | `.tools/sonarqube/`; server lokal, bukan layanan Cloud |
| SonarQube MCP | 1.19.0.2785 | JAR lokal; terdaftar sebagai `sonarqube` dalam konfigurasi Codex, masih nonaktif sampai token lokal tersedia |
| SonarScanner for .NET | 12.0.0 | `.tools/diagnostics/dotnet-sonarscanner.exe`; memakai runtime .NET portable proyek |

Java Temurin 21 menjadi runtime SonarQube. Binary, hasil unduhan dan laporan verifikasi berada di `.tools/` / `.runtime/`, yang sudah dikecualikan dari Git.

## Audit frontend

Jalankan dari root proyek. Ganti URL sesuai aplikasi lokal yang ingin diperiksa:

```powershell
New-Item -ItemType Directory -Path '.runtime/qa-reports' -Force
lighthouse http://127.0.0.1:4174 --chrome-flags="--headless=new" --output=html --output-path='.runtime/qa-reports/lighthouse.html'
./scripts/audit-accessibility.ps1 http://127.0.0.1:4174 --chrome-path 'C:/Program Files/Google/Chrome/Application/chrome.exe' --chrome-options=--headless=new --exit --save axe.json --dir '.runtime/qa-reports'
```

Untuk perbandingan performa, gunakan build produksi lokal dan kondisi yang sama sebelum/sesudah perubahan. Laporan halaman login hanya menilai halaman login; halaman yang memerlukan sesi perlu diperiksa dengan konteks login yang benar. Lighthouse dan axe memberi temuan teknis, sementara kritik alur/estetika tetap membutuhkan review desain.

## SonarQube lokal

```powershell
./scripts/start-sonarqube.ps1
```

Server menggunakan `http://127.0.0.1:9001`, tidak dipasang sebagai layanan Windows atau dijalankan otomatis ketika Windows menyala. Database bawaan hanya untuk penggunaan lokal ini; database Inventory/WMS tidak digunakan.

Pada login pertama, selesaikan sendiri penggantian password admin di browser. Setelah itu buat token pengguna lokal dan simpan sebagai environment variable pengguna Windows `SONARQUBE_TOKEN`. Jangan masukkan token ke chat atau file yang dilacak Git.

MCP memakai `scripts/sonarqube-mcp.ps1`, endpoint lokal yang sama dan mode baca saja. Aktifkan `enabled = true` pada bagian `[mcp_servers.sonarqube]` di `C:/Users/muham/.codex/config.toml` setelah token tersedia, lalu muat ulang Codex. Keberadaan entri MCP tidak berarti plugin akan muncul di menu `@`.

Analisis .NET dijalankan lewat SonarScanner dengan urutan begin, build, end setelah project key dan token lokal tersedia. Pemasangan ini belum melakukan scan kode aplikasi atau mengirim laporan analisis.

Sebelum memanggil executable scanner langsung, arahkan host ke runtime portable proyek pada sesi terminal tersebut:

```powershell
$env:DOTNET_ROOT = Join-Path (Get-Location) '.tools/dotnet'
```

## Bukti verifikasi pemasangan

- Lighthouse mengembalikan versi 13.6.0 dan berhasil memuat daftar audit (`.runtime/qa-tool-verification/lighthouse-audits.json`).
- axe-core 4.14.0 berhasil menjalankan Chrome headless dengan driver lokal, memeriksa satu HTML terisolasi dan menyimpan hasil (`.runtime/qa-tool-verification/install-check.json`). Hasil halaman uji tersebut bukan audit aksesibilitas aplikasi.
- Manifest JAR MCP mengonfirmasi versi 1.19.0.2785 dan kelas utama server. Koneksi MCP ke akun lokal belum diverifikasi karena token belum dibuat.
- Daftar tool .NET mengonfirmasi SonarScanner 12.0.0. Profiler .NET dan k6 yang dipasang sebelumnya tetap tersedia.
- SonarQube Community Build 26.10.0.133078 sudah mencapai status `UP` di `http://127.0.0.1:9001/api/system/status`; hasilnya disimpan di `.runtime/sonarqube/verified-status.json`. Log aplikasi mengonfirmasi `SonarQube is operational`. Login/password admin dan token MCP tetap menjadi langkah pengguna.
- ZIP 949.978.521 byte berhasil dirakit, seluruh 932 entri diekstrak dengan pemeriksaan CRC ZIP, kemudian ZIP dan potongan unduhan sementara dihapus. JDK/JRE Temurin 21.0.13 tersedia; MCP lokal menggunakan JRE dan server menggunakan JDK.

Sumber pemasangan: [Lighthouse](https://github.com/GoogleChrome/lighthouse), [axe-core](https://github.com/dequelabs/axe-core), [SonarQube Community Build gratis](https://www.sonarsource.com/products/sonarqube/downloads/), [SonarQube MCP](https://github.com/SonarSource/sonarqube-mcp-server).
