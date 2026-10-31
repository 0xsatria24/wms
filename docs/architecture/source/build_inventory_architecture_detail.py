from pathlib import Path
import math
import json
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader

BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / 'arsitektur-inventory-wms.pdf'
W, H = landscape(A4)
M, CW = 44, W - 88
INK, SECONDARY, RULE = '#202729', '#515B60', '#7B8589'
PAPER, ACCENT, ACCENT_BG = '#F3F4F2', '#98432E', '#F6EEE8'
pdfmetrics.registerFont(TTFont('Body', r'C:\Windows\Fonts\calibri.ttf'))
pdfmetrics.registerFont(TTFont('BodyBold', r'C:\Windows\Fonts\calibrib.ttf'))
pdfmetrics.registerFont(TTFont('Heading', r'C:\Windows\Fonts\cambria.ttc', subfontIndex=0))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='Body', boldItalic='BodyBold')
c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Arsitektur Sistem Persediaan dan Gudang - Rancangan Detail')
c.setSubject('Modul, data, alur transaksi, integrasi, serta skenario dan kriteria penerimaan')
c.setAuthor('')
page_number = 0
text_bounds, table_bounds = [], []


def p(text, x, top, width, size=11, color=INK, bold=False, leading=None, align=0, heading=False):
    style = ParagraphStyle('text', fontName='Heading' if heading else ('BodyBold' if bold else 'Body'),
                           fontSize=size, leading=leading or size*1.27,
                           textColor=HexColor(color), alignment=align)
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, H)
    assert x >= M-1 and x+width <= W-M+1, (page_number, text, x, width)
    assert top >= 20 and top+height <= H-20, (page_number, text, top, height)
    paragraph.drawOn(c, x, H-top-height)
    text_bounds.append((page_number, x, top, width, height, text))
    return height


def rule(x1, top1, x2, top2, color=RULE, weight=.8):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(weight)
    c.line(x1, H-top1, x2, H-top2)


def panel(x, top, width, height, fill=None, stroke=RULE, weight=.8):
    c.setLineWidth(weight); c.setStrokeColor(HexColor(stroke))
    if fill: c.setFillColor(HexColor(fill))
    c.rect(x, H-top-height, width, height, stroke=1, fill=int(fill is not None))


def arrow(points, color=RULE, weight=1, start=False):
    for a, b in zip(points, points[1:]): rule(*a, *b, color, weight)
    def head(a, b):
        angle=math.atan2(b[1]-a[1], b[0]-a[0])
        for delta in [-.48,.48]:
            end=(b[0]-5*math.cos(angle+delta), b[1]-5*math.sin(angle+delta))
            rule(*b,*end,color,weight)
    head(points[-2],points[-1])
    if start: head(points[1],points[0])


def node(x, top, width, height, title, desc='', accent=False, size=11.5):
    panel(x,top,width,height,ACCENT_BG if accent else PAPER,ACCENT if accent else RULE,1 if accent else .8)
    p(title,x+9,top+8,width-18,size,ACCENT if accent else INK,True,align=1)
    if desc: p(desc,x+9,top+26,width-18,10,SECONDARY,align=1)


def begin(title, intro):
    global page_number
    page_number += 1
    p(title,M,36,CW,26,heading=True,leading=30)
    p(intro,M,79,CW,11.4,SECONDARY)


def finish(section):
    rule(M,557,W-M,557,RULE,.6)
    p('Usulan rancangan  /  Persediaan & gudang',M,563,380,9,SECONDARY)
    p(f'{section}  /  {page_number:02d}',W-M-300,563,300,9,SECONDARY,align=2)
    c.showPage()


def table(x, top, widths, header, rows, size=10.3, pad=7, bottom=542):
    y=top
    for index,row in enumerate([header]+rows):
        is_header=index==0
        paragraphs=[]
        for j,text in enumerate(row):
            style=ParagraphStyle('cell',fontName='BodyBold' if is_header or j==0 else 'Body',
                                 fontSize=size,leading=size*1.25,textColor=HexColor(INK if is_header or j==0 else SECONDARY))
            cell=Paragraph(text,style)
            _,hh=cell.wrap(widths[j]-2*pad,H)
            paragraphs.append((cell,hh))
        height=max(hh for _,hh in paragraphs)+2*pad
        assert y+height <= bottom,(page_number,'table overflow',row,y,height,bottom)
        if is_header:
            c.setFillColor(HexColor(PAPER)); c.rect(x,H-y-height,sum(widths),height,stroke=0,fill=1)
        xx=x
        for j,((cell,hh),width) in enumerate(zip(paragraphs,widths)):
            cell.drawOn(c,xx+pad,H-y-pad-hh)
            text_bounds.append((page_number,xx+pad,y+pad,width-2*pad,hh,row[j]))
            xx+=width
        rule(x,y+height,x+sum(widths),y+height,RULE,.5)
        y+=height
    table_bounds.append((page_number,top,y))
    return y


def notes(items,x,top,width,size=10.8,gap=13):
    y=top
    for title,text in items:
        p(title,x,y,width,11.8,bold=True)
        hh=p(text,x,y+20,width,size,SECONDARY)
        y+=20+hh+gap
    return y


# 01: System boundaries and the write path are explicit; ERP imports still pass API validation.
begin('Arsitektur sistem persediaan & gudang',
      'Rancangan untuk beberapa gudang, banyak operator, scan barcode, dan integrasi ERP. '
      'Semua perubahan stok melewati satu pusat transaksi.')
LX,LW,RX,RW=44,488,590,W-M-590
for i,(title,desc) in enumerate([
    ('Admin & supervisor','Monitoring dan persetujuan'),
    ('Operator gudang','Scan dan konfirmasi aktual'),
    ('Tim internal','Permintaan barang')]):
    xx=LX+i*LW/3
    p(title,xx,131,LW/3,11.3,bold=True,align=1)
    p(desc,xx,149,LW/3,9.5,SECONDARY,align=1)
    rule(xx+LW/6,168,xx+LW/6,180)
rule(LX+LW/6,180,LX+LW*5/6,180)
arrow([(LX+LW/2,180),(LX+LW/2,198)])
node(LX,198,LW,44,'Backend API / pintu masuk aplikasi',
     'HTTPS, identitas pengguna, akses gudang, dan ID permintaan')
arrow([(LX+LW/2,242),(LX+LW/2,261)])
panel(LX,261,LW,65)
p('Modul operasional',LX+10,267,LW-20,10.2,SECONDARY,align=1)
for i,(a,b) in enumerate([
    ('Inbound & QC','Terima dan simpan barang'),
    ('Outbound & tugas','Reservasi, picking, packing'),
    ('Transfer & kontrol','Retur dan stock opname')]):
    xx=LX+i*LW/3
    p(a,xx+5,286,LW/3-10,11.3,bold=True,align=1)
    p(b,xx+4,305,LW/3-8,9.5,SECONDARY,align=1)
arrow([(LX+LW/2,326),(LX+LW/2,346)])
node(LX,346,LW,54,'Inventory Core / pusat transaksi stok',
     'Validasi stok, reservasi, mutasi, saldo, dan jejak audit',True,12.5)
arrow([(LX+LW/2,400),(LX+LW/2,421)])
node(LX,421,LW,54,'PostgreSQL / database transaksi',
     'Dokumen, posisi stok, mutasi, reservasi, audit, dan outbox')

node(RX,131,RW,49,'SSO / identitas perusahaan','Pengguna dan peran',size=10.9)
arrow([(RX,156),(558,156),(558,214),(LX+LW,214)])
node(RX,219,RW,52,'ERP perusahaan','Master barang, PO, order, keuangan')
node(RX,322,RW,56,'Worker integrasi & antrean','Kirim, terima, retry, dan cek duplikat',size=11)
arrow([(RX+RW/2,271),(RX+RW/2,322)],start=True)
arrow([(RX,337),(572,337),(572,229),(LX+LW,229)])
arrow([(LX+LW,448),(549,448),(549,365),(RX,365)])
node(RX,421,RW,54,'Model baca & laporan','Data operasional untuk pemantauan',size=11.3)
arrow([(RX+RW/2,378),(RX+RW/2,421)])
rule(M,495,W-M,495,RULE,.6)
p('Satu transaksi database',M,506,350,11.8,bold=True)
p('Saldo, mutasi, reservasi, audit, dan antrean terkait tersimpan bersama atau dibatalkan bersama.',M,525,350,10.5,SECONDARY)
p('Integrasi tidak memotong jalur validasi',444,506,CW-400,11.8,bold=True)
p('Dokumen ERP masuk lewat API. Worker mengirim hasil yang sudah tersimpan; laporan dapat sedikit tertunda.',444,525,CW-400,10.5,SECONDARY)
finish('Hubungan komponen')


begin('Pembagian modul dan tanggung jawab',
      'Backend memakai pendekatan modular: satu aplikasi dengan batas tugas yang jelas. '
      'Modul operasional meminta Inventory Core melakukan perubahan persediaan.')
module_rows=[
    ('Identitas & approval','Login perusahaan, peran, akses gudang, dan alur persetujuan.','Backend memeriksa kewenangan pada setiap tindakan, termasuk akses dokumen langsung.'),
    ('Master data','Barang, barcode, satuan, lokasi, supplier, batch, serial, dan pemilik.','Konversi satuan yang dipakai transaksi lama tetap tersimpan; data referensi memiliki kode unik.'),
    ('Inbound & QC','Rencana datang, penerimaan, selisih PO, inspeksi, dan penempatan.','Stok bertambah dari penerimaan aktual; barang karantina belum dapat dipakai.'),
    ('Outbound','Order, alokasi, pengambilan, packing, dan pengiriman.','Order atau reservasi belum mengurangi stok fisik; pengiriman memerlukan konfirmasi.'),
    ('Tugas gudang','Penugasan operator, lokasi sumber/tujuan, dan konfirmasi scan.','Tugas selesai harus sesuai barang, jumlah, batch/serial, dan lokasi yang dikonfirmasi.'),
    ('Transfer & retur','Pindah lokasi/gudang, barang perjalanan, serta retur dua arah.','Tujuan menerima jumlah aktual; barang retur mengikuti pemeriksaan kondisi.'),
    ('Stock opname','Jadwal hitung, hasil fisik, hitung ulang, selisih, dan approval.','Penyesuaian mengacu hasil hitung yang valid dan batas pergerakan saat penghitungan.'),
    ('Inventory Core','Mutasi, saldo terkini, reservasi, dan validasi ketersediaan.','Satu pintu perubahan stok; semua pembaruan terkait diselesaikan secara atomik.'),
    ('Integrasi','Impor dokumen ERP, ekspor hasil, retry, dan rekonsiliasi.','ID sumber dan versi dokumen mencegah pemrosesan ganda atau pembaruan yang kedaluwarsa.'),
    ('Pelaporan','Kartu stok, riwayat mutasi, lama stok tersimpan, selisih, dan pelacakan.','Keputusan alokasi memakai database utama; angka laporan tidak mengesahkan pengeluaran.')]
y=table(M,127,[126,282,CW-408],['Modul','Tanggung jawab','Batas / aturan utama'],module_rows,size=10.1,pad=6)
p('Operator menjalankan pekerjaan. Supervisor menyetujui pengecualian. Purchasing dan finance mengikuti dokumen sumber; auditor menelusuri riwayat.',
  M,y+12,CW,10.3,SECONDARY)
finish('Modul dan pengguna')


begin('Model data: saldo, reservasi, dan riwayat',
      'Sistem menyimpan dokumen bisnis, posisi barang, dan perubahan jumlah sebagai data yang terpisah namun saling terhubung.')
LEFT=458; RIGHT_X=536; RIGHT_W=W-M-RIGHT_X
p('Empat kelompok data utama',M,130,LEFT,18,heading=True)
data_rows=[
    ('Dokumen','PO acuan, penerimaan, order keluar, pengiriman, transfer, retur, dan opname; setiap dokumen memiliki detail barang.'),
    ('Posisi stok','Kombinasi barang + gudang/lokasi + kondisi + batch/serial. Pemilik ditambahkan untuk konsinyasi atau titipan.'),
    ('Buku mutasi','Catatan jumlah bertambah/berkurang, sumber dan tujuan, nomor dokumen, pengguna, waktu, serta alasan.'),
    ('Saldo & reservasi','Saldo fisik untuk akses cepat dan jumlah yang sudah menjadi komitmen pesanan. Keduanya cocok dengan riwayat terkait.')]
y=table(M,158,[110,LEFT-110],['Kelompok','Isi dan kegunaan'],data_rows,size=10.6,pad=7,bottom=377)
p('Contoh ilustrasi ketersediaan',M,y+20,LEFT,16,heading=True)
p('Ada 100 unit fisik. Sebanyak 5 dikarantina, dan 20 unit dari barang layak sudah dialokasikan untuk pesanan.',M,y+47,LEFT,11,SECONDARY)
p('100 - 5 - 20 = 75 unit bebas',M,y+88,LEFT,22,ACCENT,heading=True)
p('Barang yang sudah diambil untuk packing tetap terikat pesanan. Saat pindah lokasi, komitmennya ikut berpindah sehingga tidak teralokasi dua kali.',M,y+126,LEFT,10.5,SECONDARY)
rule(519,130,519,533,RULE,.6)
p('Pemetaan tabel teknis',RIGHT_X,130,RIGHT_W,18,heading=True)
mapping_end=notes([
    ('items, locations, lots','Referensi barang, satuan, lokasi, batch, dan serial.'),
    ('receipts, orders, shipments','Dokumen dan detail penerimaan, permintaan, serta pengiriman.'),
    ('stock_positions','Identitas posisi stok yang unik menurut dimensinya.'),
    ('stock_movements / entries','Buku perubahan jumlah. Koreksi menambah transaksi baru yang dapat ditelusuri.'),
    ('stock_balances / reservations','Saldo terkini dan komitmen pesanan; diperbarui bersama.'),
    ('audit, outbox, idempotency','Jejak tindakan, antrean integrasi, dan hasil permintaan unik.')],RIGHT_X,162,RIGHT_W,size=10.3,gap=8)
p('Status dipisahkan',RIGHT_X,mapping_end+6,RIGHT_W,11.8,bold=True)
p('Dokumen: diproses / selesai.<br/>Barang: layak / karantina.<br/>Reservasi: aktif / selesai.<br/>Integrasi: menunggu / terkirim.',
  RIGHT_X,mapping_end+27,RIGHT_W,10.2,SECONDARY)
finish('Struktur data')


begin('Barang masuk: validasi sampai penempatan',
      'Jumlah fisik bertambah saat penerimaan dikonfirmasi. Stok baru dapat dialokasikan setelah kondisi dan lokasi memenuhi kebijakan gudang.')
node(44,137,166,44,'PO / rencana masuk','Dokumen asal kedatangan',size=11)
node(244,137,210,44,'Scan barang & jumlah','Satuan, batch/serial, kondisi')
arrow([(210,159),(244,159)])
node(244,205,210,54,'Sesuai dokumen & toleransi?','Cek barang, sisa PO, dan batas lebih',size=10.7)
arrow([(349,181),(349,205)])
node(44,205,166,54,'Tahan penerimaan','Koreksi data / minta persetujuan',size=10.8)
arrow([(244,232),(210,232)])
p('Tidak',214,214,29,9,SECONDARY)
node(244,290,210,52,'Konfirmasi penerimaan','Catat stok di area receiving',True,11.2)
arrow([(349,259),(349,290)])
p('Ya',360,267,34,9.5,SECONDARY)
node(244,376,210,50,'Lolos pemeriksaan kualitas?','QC menetapkan jumlah per kondisi',size=10.8)
arrow([(349,342),(349,376)])
node(44,376,166,50,'Karantina / ditolak','Catat jumlah dan alasan',size=10.8)
arrow([(244,401),(210,401)])
p('Tidak',214,383,29,9,SECONDARY)
node(244,462,210,52,'Simpan & konfirmasi lokasi','Scan rak; stok layak siap dialokasi',size=10.7)
arrow([(349,426),(349,462)])
p('Ya',360,438,34,9.5,SECONDARY)
RIGHT_X=536; RIGHT_W=W-M-RIGHT_X
p('Data setiap penerimaan',RIGHT_X,132,RIGHT_W,18,heading=True)
p('Referensi PO, barang, jumlah dan satuan, batch/serial, kondisi, lokasi receiving, operator, serta waktu konfirmasi.',RIGHT_X,164,RIGHT_W,11,SECONDARY)
p('Contoh: menerima 100 unit',RIGHT_X,235,RIGHT_W,16,heading=True)
table(RIGHT_X,266,[90,RIGHT_W-90],['Tahap','Hasil pencatatan'],[
    ('Terima 100','Fisik +100 pada area receiving; belum menjadi stok bebas.'),
    ('QC lolos 95','95 unit layak, 5 tetap karantina. Jumlah total fisik tetap 100.'),
    ('Simpan 95','Lokasi berganti ke rak tujuan. 95 unit dapat dialokasikan sesuai kebijakan.')],size=10.5,pad=7,bottom=445)
p('Penerimaan sebagian',RIGHT_X,458,RIGHT_W,12,bold=True)
p('Jika dari PO 100 baru datang 60, sisa 40 tetap terbuka. Kedatangan berikutnya menjadi penerimaan baru dengan referensi PO yang sama.',RIGHT_X,480,RIGHT_W,10.6,SECONDARY)
p('Tolak validasi: tidak ada penambahan stok. Penerimaan yang sudah dibukukan dikoreksi melalui transaksi yang dapat ditelusuri.',M,527,460,10.2,SECONDARY)
finish('Proses inbound')


begin('Barang keluar: reservasi sampai pengiriman',
      'Reservasi mengamankan stok untuk pesanan. Picking memindahkan barang ke area packing; stok fisik berkurang saat pengiriman dikonfirmasi.')
node(44,137,166,54,'Order & persetujuan','Permintaan siap diproses',size=10.9)
node(244,137,210,54,'Stok layak mencukupi?','Cek kondisi, batch, expiry, lokasi',size=10.8)
arrow([(210,164),(244,164)])
node(244,228,210,48,'Buat reservasi atomik','Amankan jumlah untuk pesanan',True,11.2)
arrow([(349,191),(349,228)])
p('Ya',360,202,32,9.5,SECONDARY)
node(44,228,166,48,'Tunda sisa / backorder','Proses bagian yang tersedia',size=10.5)
arrow([(267,191),(267,210),(127,210),(127,228)])
p('Kurang / sisa',44,194,95,9.5,SECONDARY)
node(244,314,210,48,'Picking: konfirmasi aktual','Scan lokasi dan barang')
arrow([(349,276),(349,314)])
node(44,314,166,48,'Tangani short pick','Cari alternatif / buka sisa order',size=10.7)
arrow([(244,338),(210,338)])
p('Jika jumlah kurang',44,292,166,9.5,SECONDARY)
node(244,396,210,43,'Packing & verifikasi','Cocokkan isi dan tujuan',size=11.1)
arrow([(349,362),(349,396)])
node(244,470,210,43,'Konfirmasi pengiriman','Catat fisik keluar dan hasil order',size=10.9)
arrow([(349,439),(349,470)])
p('Jika pesanan dibatalkan',44,392,166,12,bold=True)
p('Sebelum picking: lepas reservasi.<br/>Sesudah picking: konfirmasi barang kembali ke lokasi.<br/>Sesudah kirim: jalankan proses retur.',44,416,166,10.5,SECONDARY)
RIGHT_X=536; RIGHT_W=W-M-RIGHT_X
p('Contoh komitmen 20 unit',RIGHT_X,132,RIGHT_W,18,heading=True)
table(RIGHT_X,164,[83,RIGHT_W-83],['Tahap','Fisik / komitmen / bebas'],[
    ('Awal','100 fisik, 0 komitmen, 100 bebas.'),
    ('Reservasi 20','100 fisik, 20 komitmen, 80 bebas.'),
    ('Picking 20','100 fisik di seluruh gudang; 20 tetap terikat pesanan di area packing.'),
    ('Kirim 20','80 fisik, komitmen pesanan selesai; stok bebas tetap 80.')],size=10.4,pad=7,bottom=390)
notes([
    ('Hanya ditemukan 8 dari 10','Catat 8 aktual. Sisa 2 tetap terbuka; alokasi dan reservasinya ditangani ulang, bukan dianggap terkirim.'),
    ('Kelayakan diperiksa kembali','Jika barang menjadi karantina atau kedaluwarsa, picking/pengiriman ditahan dan pesanan diarahkan ke stok lain.')],RIGHT_X,402,RIGHT_W,size=10.5,gap=12)
p('Perpindahan ke area packing mengikuti barang dan reservasinya. Barang tersebut tidak boleh muncul kembali sebagai stok bebas.',M,527,460,10.2,SECONDARY)
finish('Proses outbound')


begin('Transfer, retur, dan penghitungan fisik',
      'Ketiga proses memakai pusat transaksi yang sama. Dokumen sumber, jumlah aktual, lokasi, dan alasan perubahan tetap tersambung.')
gap=28; col=(CW-2*gap)/3
flows=[
    ('Transfer antar gudang',[
        ('Siapkan transfer','Tetapkan gudang asal, tujuan, barang, dan jumlah yang disetujui.'),
        ('Kirim dari asal','Contoh: asal -50, lokasi virtual dalam perjalanan +50.'),
        ('Terima di tujuan','Jika aktual 48: perjalanan -48, tujuan +48.'),
        ('Selesaikan selisih','Sisa 2 tetap dalam perjalanan sampai hasil pemeriksaan disetujui.')],
     'Total barang tetap terlacak selama pemiliknya sama. Transfer antar perusahaan memerlukan aturan kepemilikan dan dokumen tambahan.'),
    ('Retur barang',[
        ('Hubungkan dokumen','Retur pelanggan atau supplier mengacu pengiriman/penerimaan asal.'),
        ('Terima / siapkan barang','Retur masuk dicatat di QC; retur supplier dipisahkan untuk proses kirim.'),
        ('Tentukan keputusan','Barang layak, perlu perbaikan, ditolak, atau dibuang sesuai otorisasi.'),
        ('Bukukan hasil aktual','Mutasi mengikuti penerimaan atau pengiriman aktual; hasil diteruskan ke ERP.')],
     'Retur masuk belum menjadi stok layak. Retur supplier mengurangi stok saat pengiriman dikonfirmasi; batch/serial tetap terlacak.'),
    ('Stock opname',[
        ('Tetapkan batas hitung','Selesaikan tugas terkait dan tahan perpindahan baru pada lokasi hitung.'),
        ('Hitung fisik','Operator menghitung tanpa melihat saldo sistem; hitung ulang jika perlu.'),
        ('Tinjau selisih','Bandingkan dengan saldo pada batas waktu yang sama dan periksa penyebab.'),
        ('Setujui penyesuaian','Bukukan selisih yang disetujui, simpan alasan, lalu buka kembali lokasi.')],
     'Hitung sambil barang terus bergerak memerlukan mekanisme cutoff dan rekonsiliasi tambahan. Cycle counting dapat dijadwalkan per lokasi.')]
for i,(title,steps,ending) in enumerate(flows):
    xx=M+i*(col+gap)
    if i: rule(xx-gap/2,129,xx-gap/2,537,RULE,.5)
    p(title,xx,129,col,18,heading=True)
    yy=168
    for n,(label,text) in enumerate(steps):
        p(f'{n+1:02d}',xx,yy,23,9.5,ACCENT)
        p(label,xx+30,yy,col-30,11.7,bold=True)
        hh=p(text,xx+30,yy+21,col-30,10.7,SECONDARY)
        if n<3: arrow([(xx+9,yy+21),(xx+9,yy+66)])
        yy+=77
    rule(xx,484,xx+col,484,RULE,.6)
    p(ending,xx,496,col,10.4,SECONDARY)
finish('Proses kontrol stok')


begin('Cara transaksi tetap konsisten saat ramai',
      'Satu transaksi database berarti seluruh perubahan terkait berhasil bersama atau batal bersama. '
      'Kunci permintaan unik melindungi proses saat respons terlambat atau dikirim ulang.')
centers=[125,322,519]
for cx,title in zip(centers,['Scanner / web','Backend & Inventory Core','PostgreSQL']):
    p(title,cx-70,129,140,11.1,bold=True,align=1)
    rule(cx,157,cx,451,RULE,.6)
messages=[
    (0,1,187,'Konfirmasi + ID permintaan',168),
    (1,2,229,'BEGIN: klaim ID, lock stok, validasi',200),
    (1,2,279,'Simpan mutasi, saldo, reservasi,<br/>audit, outbox, dan hasil permintaan',244),
    (2,1,320,'COMMIT: hasil tersimpan',300),
    (1,0,359,'Nomor transaksi + hasil',339),
    (0,1,403,'Retry dengan ID yang sama',383),
    (1,0,445,'Kembalikan hasil sebelumnya',425)]
for source,target,yy,label,lt in messages:
    x1,x2=centers[source],centers[target]
    arrow([(x1,yy),(x2,yy)])
    p(label,min(x1,x2)+8,lt,abs(x2-x1)-16,10,SECONDARY,align=1)
RIGHT_X=590; RIGHT_W=W-M-RIGHT_X
notes([
    ('Mencegah perebutan stok','Backend mengunci baris stok yang dipakai. Transaksi lain menunggu, lalu memeriksa saldo terbaru.'),
    ('Mencegah pencatatan ganda','ID yang sama dan isi sama mengembalikan hasil lama. ID sama dengan isi berbeda ditolak.'),
    ('Menjaga riwayat tetap cocok','Saldo, mutasi, komitmen, dan status dokumen diperbarui pada transaksi yang sama.'),
    ('Konflik ditangani terukur','Urutan lock konsisten; aturan unik di database melindungi posisi stok dan ID transaksi. Konflik dapat diulang secara terbatas.')],RIGHT_X,130,RIGHT_W,size=10.5,gap=11)
rule(M,478,W-M,478,RULE,.6)
p('API mengikuti tindakan bisnis',M,490,CW,12,bold=True)
p('Contoh: POST /receipts/{id}/confirm  |  POST /shipments/{id}/confirm  |  POST /stock-counts/{id}/approve-adjustment',M,511,CW,10.5,SECONDARY)
p('Jumlah disimpan dalam desimal dan satuan dasar. Faktor konversi saat transaksi disimpan; perubahan master satuan tidak mengubah riwayat lama.',M,532,CW,10.2,SECONDARY)
finish('Transaksi dan API')


begin('Integrasi ERP dan operasional sistem',
      'Database utama mengesahkan perubahan stok. Worker menjalankan integrasi di latar belakang; '
      'monitoring dan pemulihan menjadi bagian dari rancangan operasional.')
node(44,133,140,49,'Web / scanner','Pengguna gudang',size=11)
node(234,133,163,49,'API modular','Beberapa instance sesuai beban',size=11)
node(447,133,175,49,'Database utama','PostgreSQL',size=11)
node(672,133,W-M-672,49,'Standby','Replikasi database',size=10.9)
arrow([(184,157),(234,157)])
arrow([(397,157),(447,157)])
arrow([(622,157),(672,157)])
node(234,244,163,51,'Object storage','Foto dan dokumen',size=11)
arrow([(315,182),(315,244)])
node(447,244,175,51,'Worker & outbox','Antrean transaksi tersimpan',size=11)
arrow([(534,182),(534,244)])
node(672,244,W-M-672,51,'ERP','Dokumen dan hasil',size=11)
arrow([(622,269),(672,269)],start=True)
p('Impor ERP tetap masuk melalui validasi API. Replikasi membantu ketersediaan; backup terpisah tetap diperlukan.',M,309,CW,10.6,SECONDARY)
LEFT=360; RIGHT_X=444; RIGHT_W=W-M-RIGHT_X
p('Pembagian kewenangan data',M,345,LEFT,17,heading=True)
y=table(M,375,[77,LEFT-77],['Pemilik','Data yang dikelola'],[
    ('ERP','Master barang/mitra, PO, sales order, invoice, dan nilai persediaan.'),
    ('WMS','Lokasi, kondisi dan jumlah fisik, tugas operator, penerimaan, pengiriman, serta bukti scan.')],size=10.4,pad=6,bottom=481)
p('Antrean menyimpan ID event tetap, versi, dan riwayat retry. Penerima mencatat ID yang sudah diproses. '
  'Setelah restore, cocokkan hasil dengan ERP sebelum mengulang pengiriman.',M,y+13,LEFT,10.4,SECONDARY)
p('Akses, monitoring, dan pemulihan',RIGHT_X,345,RIGHT_W,17,heading=True)
notes([
    ('Akses berdasarkan peran & gudang','Operator, supervisor, purchasing, finance, dan auditor memiliki kewenangan berbeda; approval dapat memisahkan pembuat dan penyetuju.'),
    ('Pantau kegagalan yang perlu tindakan','Antrean tertunda, integrasi gagal, konflik stok, selisih saldo, dan tugas yang belum selesai harus terlihat.'),
    ('Sepakati batas pemulihan','Tentukan batas kehilangan data dan waktu pulih yang dapat diterima. Uji restore database, dokumen, dan antrean integrasi.')],RIGHT_X,375,RIGHT_W,size=10.4,gap=8)
finish('Deployment dan integrasi')


begin('Skenario penerimaan: stok dan operasional',
      'Hasil berikut menjadi kriteria penerimaan implementasi. Setiap skenario perlu dibuktikan lewat pengujian dan pemeriksaan riwayat transaksi.')
business_scenarios=[
    ('Dua operator berebut stok terakhir','Total reservasi tidak melebihi stok yang layak. Permintaan yang tidak kebagian mendapat hasil jelas tanpa saldo negatif.','Kirim dua reservasi bersamaan; jumlahkan komitmen dan periksa saldo akhir.'),
    ('PO 100, baru diterima 60','Stok bertambah 60; sisa PO 40 tetap terbuka. Penerimaan lanjutan mengacu PO yang sama.','Terima 60 lalu sisa 40; cocokkan total fisik, dokumen, dan buku mutasi.'),
    ('Stok berubah menjadi karantina','Stok terdampak tidak dapat dipicking/dikirim. Reservasi ditahan atau dialihkan sesuai kebijakan yang disepakati.','Reservasi lalu karantina barang; coba picking dan pengiriman tanpa alokasi pengganti.'),
    ('Picking 10, aktual hanya 8','Hanya 8 tercatat diambil. Sisa 2 tetap terbuka dan reservasinya ditangani ulang; tidak ada jumlah terkirim fiktif.','Konfirmasi short pick; periksa tugas, sisa order, komitmen, dan mutasi lokasi.'),
    ('Order dibatalkan setelah picking','Barang dan komitmen tetap terlacak sampai pengembalian lokasi dikonfirmasi. Stok tidak mendadak menjadi bebas.','Batalkan order lalu konfirmasi barang kembali; periksa mutasi dan pelepasan reservasi.'),
    ('Transfer 50, tujuan menerima 48','Tujuan bertambah 48; sisa 2 tetap dalam perjalanan sampai penyelesaian selisih. Total barang tidak terhitung dua kali.','Cocokkan saldo asal, perjalanan, tujuan, dan dokumen penyelesaian selisih.'),
    ('Opname sistem 30, fisik 28','Penyesuaian -2 hanya dibukukan setelah validasi hitung dan approval. Seluruh perubahan memiliki alasan dan pelaku.','Tahan perpindahan lokasi hitung; uji approval dan telusuri penyesuaian sampai saldo akhir.')]
table(M,128,[169,348,CW-517],['Skenario','Hasil yang harus terjamin','Cara membuktikan'],business_scenarios,size=10.5,pad=8,bottom=535)
finish('Kriteria penerimaan 1')


begin('Skenario penerimaan: gangguan dan pemulihan',
      'Kegagalan jaringan atau integrasi tidak boleh membuat jumlah stok, dokumen, dan hasil transaksi saling bertentangan.')
failure_scenarios=[
    ('Konfirmasi dikirim berulang','ID dan isi sama menghasilkan satu transaksi. ID yang sama dengan isi berbeda ditolak tanpa mengubah stok.','Ulangi request identik, lalu ubah jumlah dengan ID lama; periksa nomor transaksi dan mutasi.'),
    ('Proses gagal sebelum COMMIT','Seluruh perubahan terkait dibatalkan. Tidak ada sebagian saldo, mutasi, dokumen, atau event integrasi yang tertinggal.','Hentikan proses di tengah transaksi; periksa semua tabel dan pastikan tidak ada event terkirim.'),
    ('COMMIT berhasil, respons hilang','Retry menemukan hasil yang sudah tersimpan dan mengembalikan nomor transaksi yang sama; stok tidak berubah lagi.','Putus respons setelah commit, lalu kirim ulang dengan ID permintaan yang sama.'),
    ('ERP mati / event terkirim ulang','Transaksi lokal tetap tersimpan. Status sinkronisasi terlihat; retry tidak menggandakan hasil ERP dan versi dokumen tetap benar.','Matikan ERP, pulihkan, lalu kirim event berulang dan di luar urutan; periksa deduplikasi dan versi.'),
    ('Scanner kehilangan jaringan','Scan berstatus pending; stok belum dianggap dikonfirmasi. Setelah tersambung, server memvalidasi ulang kondisi terbaru.','Scan saat offline, ubah stok dari perangkat lain, lalu sinkronkan dan periksa penanganan konfliknya.'),
    ('Pengguna mengakses gudang lain','Backend menolak akses atau tindakan di luar kewenangan, walaupun nomor dokumen diketahui atau API dipanggil langsung.','Uji akses baca dan mutasi dengan akun yang tidak memiliki akses gudang tersebut.'),
    ('Pemulihan dari backup','Saldo, mutasi, dokumen, dan antrean sesuai titik pemulihan. Setelah rekonsiliasi ERP, replay ber-ID tetap tidak menggandakan hasil.','Restore database dan file; rekonsiliasi saldo serta ERP sebelum replay sesuai batas pemulihan yang disepakati.')]
y=table(M,125,[169,348,CW-517],['Skenario','Hasil yang harus terjamin','Cara membuktikan'],failure_scenarios,size=10.3,pad=7,bottom=514)
p('Sebelum pembangunan: sepakati jumlah gudang/pengguna, volume transaksi, kebijakan batch/expiry, approval, kebutuhan offline, ERP, dan target pemulihan.',
  M,y+12,CW,10.4,SECONDARY)
p('Tahapan pembangunan: master data & pusat transaksi stok, dilanjutkan operasional gudang, lalu integrasi ERP, pelaporan, dan pengujian skenario.',
  M,y+43,CW,10.4,SECONDARY)
p('Referensi teknis: '
  '<link href="https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-management-overview">Microsoft WMS</link>'
  '  /  <link href="https://www.postgresql.org/docs/current/explicit-locking.html">PostgreSQL locking</link>'
  '  /  <link href="https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html">AWS transactional outbox</link>',
  M,538,CW,9,SECONDARY)
finish('Kriteria penerimaan 2')
c.save()

overlaps=[]
for index,a in enumerate(text_bounds):
    for b in text_bounds[index+1:]:
        if a[0]!=b[0]: continue
        horizontal=min(a[1]+a[3],b[1]+b[3])-max(a[1],b[1])
        vertical=min(a[2]+a[4],b[2]+b[4])-max(a[2],b[2])
        if horizontal>.5 and vertical>.5: overlaps.append((a[0],a[5],b[5]))
assert not overlaps,overlaps
reader=PdfReader(str(OUTPUT))
assert len(reader.pages)==10
plain='\n'.join(pg.extract_text() for pg in reader.pages)
assert not any(ch in plain for ch in ['\u2014','\u2013','\ufffd'])
assert all(pg.mediabox.width>pg.mediabox.height for pg in reader.pages)
annotations=[a for pg in reader.pages for a in pg.get('/Annots',[])]
assert len(annotations)==3
for annotation in annotations:
    assert str(annotation.get_object()['/A']['/URI']).startswith('https://')

def luminance(value):
    rgb=[int(value.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    return sum(a*b for a,b in zip(rgb,[.2126,.7152,.0722]))

def contrast(a,b):
    lo,hi=sorted((luminance(a),luminance(b)))
    return (hi+.05)/(lo+.05)

ratios={f'{fg} on {bg}':round(contrast(fg,bg),2) for fg,bg in [
    (INK,'#FFFFFF'),(SECONDARY,'#FFFFFF'),(SECONDARY,PAPER),(ACCENT,ACCENT_BG),(ACCENT,'#FFFFFF')]}
assert min(ratios.values())>=4.5
summary={
    'pages':len(reader.pages),'words_per_page':[len(pg.extract_text().split()) for pg in reader.pages],
    'contrast_ratios':ratios,'links':len(annotations),'overlapping_text_blocks':len(overlaps),
    'acceptance_scenarios':len(business_scenarios)+len(failure_scenarios),
    'source':str(Path(__file__).resolve()),'output':str(OUTPUT),'size_bytes':OUTPUT.stat().st_size}
(BASE/'source'/'validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
