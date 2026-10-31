from pathlib import Path
import ast
import json
import math
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
DOC_ID, REVISION, TOTAL = 'INV-WMS-ARCH-001', '1.0', 13
INK, SECONDARY, RULE = '#20292D', '#4F5C63', '#728087'
PAPER, ACCENT, ACCENT_BG = '#F2F4F4', '#234D45', '#EDF3F1'
pdfmetrics.registerFont(TTFont('Body', r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('Bold', r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='Bold', italic='Body', boldItalic='Bold')
c = canvas.Canvas(str(OUTPUT), pagesize=A4, pageCompression=1)
c.setTitle('Rancangan Arsitektur Sistem Persediaan dan Manajemen Gudang')
c.setSubject('Dokumen rancangan, kontrol operasional, integrasi, dan kriteria penerimaan')
c.setAuthor('')
c.setViewerPreference('DisplayDocTitle', 'true')
W,H = A4
M=54
CW=W-2*M
page_number=0
text_bounds=[]
figure_bounds=[]


def load_literal(name):
    tree=ast.parse((BASE/'source'/'build_inventory_architecture_detail.py').read_text(encoding='utf-8'))
    for item in tree.body:
        if isinstance(item,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in item.targets):
            return ast.literal_eval(item.value)
    raise KeyError(name)


def p(text,x,top,width,size=10.5,color=INK,bold=False,align=0,leading=None):
    paragraph=Paragraph(text,ParagraphStyle('text',fontName='Bold' if bold else 'Body',
        fontSize=size,leading=leading or size*1.38,textColor=HexColor(color),alignment=align))
    _,height=paragraph.wrap(width,H)
    assert x>=M-1 and x+width<=W-M+1,(page_number,'horizontal',text,x,width)
    assert top>=18 and top+height<=H-18,(page_number,'vertical',text,top,height)
    paragraph.drawOn(c,x,H-top-height)
    text_bounds.append((page_number,x,top,width,height,text))
    return height


def line(x1,t1,x2,t2,color=RULE,weight=.65,dashed=False):
    c.setStrokeColor(HexColor(color)); c.setLineWidth(weight)
    c.setDash(3,2) if dashed else c.setDash()
    c.line(x1,H-t1,x2,H-t2)
    c.setDash()


def rect(x,top,width,height,fill=None,stroke=RULE,weight=.7):
    c.setStrokeColor(HexColor(stroke));c.setLineWidth(weight)
    if fill:c.setFillColor(HexColor(fill))
    c.rect(x,H-top-height,width,height,stroke=1,fill=int(fill is not None))


def arrow(points,dashed=False,color=RULE):
    for a,b in zip(points,points[1:]):line(*a,*b,color,1,dashed)
    def head(a,b):
        angle=math.atan2(b[1]-a[1],b[0]-a[0])
        for delta in [-.48,.48]:
            line(*b,b[0]-5*math.cos(angle+delta),b[1]-5*math.sin(angle+delta),color,1)
    head(points[-2],points[-1])


def double_arrow(points,dashed=False):
    arrow(points,dashed)
    a,b=points[1],points[0]
    angle=math.atan2(b[1]-a[1],b[0]-a[0])
    for delta in [-.48,.48]:line(*b,b[0]-5*math.cos(angle+delta),b[1]-5*math.sin(angle+delta),RULE,1)


def node(x,top,width,height,title,desc='',accent=False,size=10.5):
    rect(x,top,width,height,ACCENT_BG if accent else PAPER,ACCENT if accent else RULE,1 if accent else .7)
    th=p(title,x+9,top+8,width-18,size,ACCENT if accent else INK,True,align=1,leading=size*1.22)
    if desc:
        dh=p(desc,x+9,top+10+th,width-18,9.4,SECONDARY,align=1,leading=12)
        assert 10+th+dh<=height-4,(page_number,'node overflow',title,height,th,dh)
    figure_bounds.append((page_number,x,top,width,height))


def decision(x,top,width,height,label):
    path=c.beginPath()
    points=[(x+width/2,top),(x+width,top+height/2),(x+width/2,top+height),(x,top+height/2)]
    path.moveTo(points[0][0],H-points[0][1])
    for xx,tt in points[1:]:path.lineTo(xx,H-tt)
    path.close()
    c.setFillColor(HexColor('#FFFFFF'));c.setStrokeColor(HexColor(RULE));c.setLineWidth(.8)
    c.drawPath(path,stroke=1,fill=1)
    p(label,x+width*.14,top+height/2-13,width*.72,10.1,INK,True,align=1,leading=12)


def section(label,top,x=None,width=None):
    p(label,M if x is None else x,top,CW if width is None else width,12.5,bold=True)


def table(x,top,widths,headers,rows,size=10,pad=7,bottom=None,first_bold=True):
    yy=top
    bottom=H-92 if bottom is None else bottom
    for idx,row in enumerate([headers]+rows):
        head=idx==0
        parts=[]
        for j,txt in enumerate(row):
            cell=Paragraph(txt,ParagraphStyle('cell',fontName='Bold' if head or (j==0 and first_bold) else 'Body',
                fontSize=size,leading=size*1.32,textColor=HexColor(INK if head or j==0 else SECONDARY)))
            _,hh=cell.wrap(widths[j]-2*pad,H)
            parts.append((cell,hh))
        rh=max(hh for _,hh in parts)+2*pad
        assert yy+rh<=bottom,(page_number,'table overflow',row,yy,rh,bottom)
        if head:
            c.setFillColor(HexColor(PAPER));c.rect(x,H-yy-rh,sum(widths),rh,stroke=0,fill=1)
        xx=x
        for (cell,hh),width,txt in zip(parts,widths,row):
            cell.drawOn(c,xx+pad,H-yy-pad-hh)
            text_bounds.append((page_number,xx+pad,yy+pad,width-2*pad,hh,txt))
            xx+=width
        line(x,yy+rh,x+sum(widths),yy+rh,RULE,.45)
        yy+=rh
    return yy


def begin(title,intro,anchor,wide=False):
    global W,H,M,CW,page_number
    W,H=landscape(A4) if wide else A4
    M=44 if wide else 54
    CW=W-2*M
    c.setPageSize((W,H))
    page_number+=1
    c.bookmarkPage(anchor)
    c.addOutlineEntry(title or 'Sampul dan daftar isi',anchor,level=0,closed=False)
    p(DOC_ID,M,22,220,8.5,SECONDARY)
    if page_number>1:
        p('<link href="#cover">Daftar isi</link>',W-M-140,22,140,8.5,SECONDARY,align=2)
    line(M,43,W-M,43,RULE,.55)
    p(title,M,63,CW,22 if not wide else 23,bold=True,leading=27)
    if intro:p(intro,M,104,CW,10.6,SECONDARY,leading=14.7)


def finish():
    bottom=H-(41 if W>H else 49)
    line(M,bottom,W-M,bottom,RULE,.55)
    p(f'Revisi {REVISION}  |  Usulan untuk ditinjau',M,bottom+10,350,8.2,SECONDARY)
    p(f'{page_number:02d} / {TOTAL:02d}',W-M-100,bottom+10,100,8.2,SECONDARY,align=2)
    c.showPage()


def caption(number,text,top):
    p(f'Gambar {number}. {text}',M,top,CW,9.5,SECONDARY)


# Cover and interactive contents form the document control page.
begin('','', 'cover')
p('Rancangan Arsitektur<br/>Sistem Persediaan<br/>dan Manajemen Gudang',M,83,CW,28,bold=True,leading=35)
p('Dokumen rancangan solusi untuk pengelolaan barang masuk, barang keluar, '
  'lokasi penyimpanan, dan integrasi sistem perusahaan.',M,214,CW,11.2,SECONDARY,leading=16)
table(M,282,[133,CW-133],['Informasi dokumen','Keterangan'],[
    ('Nomor dokumen',DOC_ID),('Versi / tanggal','1.0 / 27 Oktober 2026'),
    ('Status','Usulan rancangan untuk pembahasan dan penetapan ruang lingkup.')],size=10,pad=6,bottom=414)
section('Daftar isi',438)
contents=[
    ('1. Ringkasan eksekutif dan ruang lingkup','s1',2),
    ('2. Arsitektur logis solusi','s2',3),
    ('3. Modul fungsional dan batas tanggung jawab','s3',4),
    ('4. Model data dan pengendalian stok','s4',5),
    ('5.1 Proses penerimaan barang','s51',6),
    ('5.2 Proses pengeluaran barang','s52',7),
    ('6. Konsistensi transaksi dan kontrak API','s6',8),
    ('7. Transfer, retur, dan penghitungan fisik','s7',9),
    ('8. Integrasi, akses, dan operasional sistem','s8',10),
    ('9.1 Matriks penerimaan operasional','s91',11),
    ('9.2 Matriks penerimaan gangguan','s92',12),
    ('10. Tahapan implementasi dan keputusan','s10',13)]
for i,(label,anchor,page) in enumerate(contents):
    yy=470+i*21
    p(f'<link href="#{anchor}">{label}</link>',M,yy,CW-40,10.2,INK)
    p(str(page).zfill(2),W-M-30,yy,30,10.2,SECONDARY,align=2)
p('Keputusan yang masih memerlukan kesepakatan tercantum pada Bagian 10. '
  'Kriteria penerimaan pada Bagian 9 harus dibuktikan ketika implementasi diuji.',M,744,CW,9.5,SECONDARY)
finish()


begin('1. Ringkasan eksekutif dan ruang lingkup',
      'Tujuan rancangan adalah menyediakan pencatatan persediaan yang konsisten, '
      'dapat ditelusuri, dan dapat direkonsiliasi dengan kegiatan fisik gudang.','s1')
p('Solusi menghubungkan pekerjaan operator, persetujuan supervisor, serta dokumen pembelian dan penjualan. '
  'Jumlah, lokasi, kondisi, dan komitmen barang dikelola melalui pusat transaksi stok yang sama. '
  'Integrasi dengan ERP berjalan melalui antrean agar gangguan sistem lain tidak menghasilkan pencatatan parsial.',
  M,158,CW,10.7,SECONDARY,leading=15.2)
section('1.1 Cakupan solusi',259)
y=table(M,287,[137,CW-137],['Area','Cakupan rancangan'],[
    ('Operasional gudang','Penerimaan, inspeksi kualitas, penempatan, reservasi, pengambilan, pengepakan, pengiriman, transfer, retur, dan stock opname.'),
    ('Pengendalian data','Master barang dan lokasi, batch/serial, satuan, kondisi barang, saldo, buku mutasi, persetujuan, dan jejak audit.'),
    ('Integrasi perusahaan','Pertukaran master, PO, order, serta hasil penerimaan dan pengiriman dengan ERP. Batas kewenangan data ditetapkan pada Bagian 8.'),
    ('Operasional teknologi','Hak akses, monitoring, antrean integrasi, penyimpanan bukti, backup, serta prosedur pemulihan.')],size=10.3,pad=8,bottom=581)
section('1.2 Prinsip dan asumsi utama',y+24)
p('Database utama menjadi acuan untuk mengesahkan alokasi dan perubahan stok. '
  'Backend dirancang sebagai aplikasi modular agar aturan persediaan dapat dijalankan dalam satu transaksi database. '
  'Laporan dapat menggunakan model baca terpisah dan memiliki jeda pembaruan.',M,y+53,CW,10.7,SECONDARY,leading=15.2)
p('Koneksi ke server diperlukan untuk konfirmasi stok. Kebutuhan operasi penuh tanpa jaringan, '
  'transfer antar perusahaan, serta kebijakan kepemilikan konsinyasi memerlukan penetapan tambahan. '
  'Jumlah server dan target pemulihan ditentukan berdasarkan kebutuhan yang disepakati dan hasil pengujian.',
  M,y+132,CW,10.7,SECONDARY,leading=15.2)
finish()


begin('2. Arsitektur logis solusi',
      'Pemisahan komponen menjaga satu jalur pengesahan transaksi stok, '
      'sementara integrasi dan pelaporan dapat diproses secara terpisah.','s2',True)
LX,LW,RX,RW=44,488,590,W-44-590
for i,(title,desc) in enumerate([('Admin / supervisor','Persetujuan dan monitoring'),('Operator gudang','Scan dan konfirmasi aktual'),('Tim internal','Permintaan barang')]):
    xx=LX+i*LW/3
    p(title,xx,151,LW/3,10.5,bold=True,align=1)
    p(desc,xx,168,LW/3,9.3,SECONDARY,align=1)
    line(xx+LW/6,185,xx+LW/6,193)
line(LX+LW/6,193,LX+LW*5/6,193)
arrow([(LX+LW/2,193),(LX+LW/2,209)])
node(LX,209,LW,43,'Backend API','Koneksi HTTPS, identitas pengguna, akses gudang, dan ID permintaan')
arrow([(LX+LW/2,252),(LX+LW/2,271)])
rect(LX,271,LW,58)
for i,(title,desc) in enumerate([('Penerimaan & QC','Terima, periksa, simpan'),('Pengeluaran & tugas','Reservasi, ambil, kirim'),('Transfer & kontrol','Retur dan stock opname')]):
    xx=LX+i*LW/3
    p(title,xx+5,283,LW/3-10,10.3,bold=True,align=1)
    p(desc,xx+5,305,LW/3-10,9.2,SECONDARY,align=1)
arrow([(LX+LW/2,329),(LX+LW/2,348)])
node(LX,348,LW,51,'Inventory Core / pusat transaksi stok','Validasi ketersediaan, reservasi, mutasi, saldo, dan jejak audit',True,11.4)
arrow([(LX+LW/2,399),(LX+LW/2,421)])
node(LX,421,LW,51,'PostgreSQL / database transaksi','Dokumen, posisi stok, mutasi, saldo, reservasi, audit, dan outbox')
node(RX,151,RW,43,'SSO / identitas perusahaan','Akun dan peran pengguna',size=10)
arrow([(RX,172),(558,172),(558,224),(LX+LW,224)])
node(RX,231,RW,46,'ERP perusahaan','Master, PO, order, dan keuangan')
node(RX,326,RW,53,'Worker integrasi','Kirim, terima, retry, dan deduplikasi')
double_arrow([(RX+RW/2,277),(RX+RW/2,326)],True)
arrow([(RX,339),(572,339),(572,239),(LX+LW,239)])
arrow([(LX+LW,447),(549,447),(549,365),(RX,365)],True)
node(RX,421,RW,51,'Model baca dan laporan','Data untuk pemantauan operasional',size=10.2)
arrow([(RX+RW/2,379),(RX+RW/2,421)],True)
caption('2-1','Komponen logis dan jalur pertukaran data.',490)
p('Garis utuh: permintaan atau respons sinkron. Garis putus: pekerjaan asinkron yang dapat dicoba kembali. '
  'Dokumen dari ERP tetap melewati validasi API; laporan tidak mengesahkan alokasi stok.',M,511,CW,10,SECONDARY)
finish()


begin('3. Modul fungsional dan batas tanggung jawab',
      'Pembagian berikut menetapkan fungsi setiap modul dan aturan yang harus dipertahankan saat solusi dikembangkan.','s3')
modules=[
    ('M01<br/>Master data','Barang, barcode, satuan, supplier, gudang, lokasi, batch, serial, dan pemilik.','Kode referensi unik; konversi satuan transaksi lama tetap tersimpan.'),
    ('M02<br/>Penerimaan & QC','Rencana kedatangan, penerimaan aktual, selisih PO, pemeriksaan kualitas, dan penempatan.','Stok bertambah dari konfirmasi aktual; karantina tidak dapat dialokasikan.'),
    ('M03<br/>Pengeluaran & tugas','Order, reservasi, tugas operator, picking, packing, dan konfirmasi pengiriman.','Komitmen stok mengikuti barang; reservasi belum mengurangi jumlah fisik.'),
    ('M04<br/>Transfer & retur','Perpindahan lokasi/gudang, barang dalam perjalanan, serta retur pelanggan dan supplier.','Tujuan menerima jumlah aktual; selisih tetap terlacak sampai diselesaikan.'),
    ('M05<br/>Stock opname','Rencana hitung, hasil fisik, hitung ulang, selisih, dan penyesuaian yang disetujui.','Gunakan batas penghitungan yang jelas dan alasan penyesuaian.'),
    ('M06<br/>Inventory Core','Validasi stok, buku mutasi, saldo terkini, reservasi, dan perubahan kondisi/lokasi.','Seluruh pembaruan terkait berhasil bersama atau dibatalkan bersama.'),
    ('M07<br/>Integrasi','Impor dokumen, pengiriman hasil, deduplikasi, urutan versi, retry, dan rekonsiliasi.','Gunakan ID sumber/event tetap; status kegagalan dapat ditindaklanjuti.'),
    ('M08<br/>Pelaporan','Kartu stok, pergerakan, lama penyimpanan, selisih, dan pelacakan batch/serial.','Keputusan transaksi menggunakan database utama; jeda laporan terlihat.')]
y=table(M,155,[105,220,CW-325],['Modul','Fungsi utama','Batas pengendalian'],modules,size=9.8,pad=7,bottom=725)
p('Identitas pengguna, otorisasi, persetujuan, dan audit berlaku lintas modul. '
  'Modul operasional memanggil Inventory Core dan tidak memperbarui angka saldo secara langsung.',M,y+18,CW,10.3,SECONDARY)
finish()


begin('4. Model data dan pengendalian stok',
      'Model membedakan dokumen bisnis, identitas posisi barang, riwayat perubahan, saldo terkini, dan komitmen pesanan.','s4')
entities=[
    ('Master dan referensi','items, barcodes, units, locations, lots/serials: kode barang, satuan, lokasi, batch, dan nomor seri.'),
    ('Dokumen dan detail','Penerimaan, order, pengiriman, transfer, retur, dan opname; jumlah rencana dan aktual disimpan per baris.'),
    ('stock_positions','Identitas unik posisi stok: perusahaan, pemilik, barang, lokasi, kondisi, serta batch/serial jika berlaku.'),
    ('stock_movements / entries','Buku mutasi jumlah beserta referensi dokumen, sumber/tujuan, pengguna, waktu, dan alasan.'),
    ('stock_balances','Saldo fisik terkini untuk akses cepat. Saldo harus sesuai penjumlahan mutasi pada dimensi yang sama.'),
    ('reservations','Jumlah yang dialokasikan ke pesanan, posisi sumber, dan status komitmen. Berpindah mengikuti barang saat picking.'),
    ('Kontrol transaksi','Audit, outbox, inbox, dan idempotency: jejak tindakan, antrean, ID event yang diproses, serta hasil permintaan unik.')]
y=table(M,153,[143,CW-143],['Entitas / kelompok','Informasi yang dikelola'],entities,size=10.1,pad=7,bottom=582)
section('4.1 Interpretasi saldo dan ketersediaan',y+22)
p('Contoh ilustrasi: 100 unit fisik, 5 unit karantina, dan 20 unit dari stok layak sudah dialokasikan untuk pesanan. '
  'Jumlah yang masih bebas dipakai adalah 75 unit.',M,y+51,CW,10.5,SECONDARY)
p('100 - 5 - 20 = 75 unit tersedia',M,y+100,CW,16,ACCENT,True)
p('Barang di area packing tetap terikat pesanan. Saat barang berpindah, lokasi dan komitmennya diperbarui bersama. '
  'Jumlah disimpan sebagai desimal dalam satuan dasar; faktor konversi saat transaksi tetap tercatat.',M,y+135,CW,10.4,SECONDARY)
p('Status dipisahkan: dokumen (diproses/selesai), kondisi barang (layak/karantina), '
  'reservasi (aktif/selesai), dan integrasi (menunggu/terkirim).',M,y+205,CW,10.3,SECONDARY)
finish()


begin('5.1 Proses penerimaan barang',
      'Penerimaan dikonfirmasi berdasarkan jumlah aktual. Kelayakan alokasi ditentukan oleh hasil pemeriksaan kualitas dan kebijakan lokasi.','s51',True)
node(44,145,168,43,'Dokumen kedatangan','PO atau rencana transfer')
node(258,145,202,43,'Scan barang dan jumlah','Satuan, batch/serial, kondisi')
arrow([(212,166),(258,166)])
decision(258,207,202,64,'Sesuai PO dan<br/>batas penerimaan?')
arrow([(359,188),(359,207)])
node(44,216,168,46,'Tahan penerimaan','Koreksi atau persetujuan',size=10.2)
arrow([(258,239),(212,239)])
p('Tidak',216,220,36,9.2,SECONDARY)
node(258,295,202,46,'Konfirmasi penerimaan','Stok dicatat di area receiving',True)
arrow([(359,271),(359,295)])
p('Ya',370,276,30,9.2,SECONDARY)
decision(258,365,202,64,'Kualitas memenuhi<br/>ketentuan?')
arrow([(359,341),(359,365)])
node(44,374,168,46,'Karantina / ditolak','Jumlah dan alasan tercatat',size=10.2)
arrow([(258,397),(212,397)])
p('Tidak',216,378,36,9.2,SECONDARY)
node(258,457,202,46,'Simpan dan scan lokasi','Stok layak dapat dialokasikan')
arrow([(359,429),(359,457)])
p('Ya',370,438,30,9.2,SECONDARY)
RX,RW=536,W-M-536
section('Kontrol dan hasil pencatatan',145,RX,RW)
p('Referensi PO, barang, jumlah, satuan, batch/serial, kondisi, lokasi receiving, operator, dan waktu harus dapat ditelusuri.',RX,174,RW,10.3,SECONDARY)
table(RX,234,[86,RW-86],['Contoh','Hasil yang dicatat'],[
    ('Terima 100','Fisik bertambah 100 pada area receiving; belum menjadi stok tersedia.'),
    ('QC lolos 95','95 layak dan 5 karantina. Jumlah fisik keseluruhan tetap 100.'),
    ('Simpan 95','95 unit tercatat pada lokasi tujuan dan dapat dialokasikan sesuai kebijakan.')],size=10,pad=7,bottom=412)
p('Penerimaan sebagian',RX,429,RW,11,bold=True)
p('PO 100 yang baru diterima 60 menyisakan 40 unit terbuka. Kedatangan berikutnya menjadi penerimaan terpisah dengan acuan PO yang sama.',RX,451,RW,10.2,SECONDARY)
caption('5-1','Alur penerimaan, validasi dokumen, dan pengendalian kualitas.',519)
finish()


begin('5.2 Proses pengeluaran barang',
      'Reservasi mengamankan ketersediaan pesanan. Picking memindahkan barang; stok fisik berkurang ketika pengiriman dikonfirmasi.','s52',True)
node(44,146,180,46,'Order dan persetujuan','Permintaan siap diproses')
decision(320,137,180,64,'Stok layak<br/>mencukupi?')
arrow([(224,169),(320,169)])
node(600,146,198,46,'Tunda sisa / backorder','Bagian yang belum terpenuhi')
arrow([(500,169),(600,169)])
p('Tidak / sisa',511,149,80,9.2,SECONDARY)
node(320,229,180,46,'Reservasi atomik','Amankan komitmen pesanan',True)
arrow([(410,201),(410,229)])
p('Ya',421,208,30,9.2,SECONDARY)
node(320,311,180,46,'Picking aktual','Scan lokasi dan barang')
arrow([(410,275),(410,311)])
node(600,311,198,46,'Penanganan short pick','Catat aktual; alokasikan ulang')
arrow([(500,334),(600,334)])
p('Jika kurang',511,314,82,9.2,SECONDARY)
node(320,393,180,46,'Packing dan verifikasi','Periksa isi dan tujuan')
arrow([(410,357),(410,393)])
node(320,467,180,46,'Konfirmasi pengiriman','Catat jumlah fisik keluar')
arrow([(410,439),(410,467)])
section('Ilustrasi alokasi 20 unit',229,44,240)
y_alloc=table(44,259,[69,48,64,59],['Tahap','Fisik','Alokasi','Tersedia'],[
    ('Awal','100','0','100'),('Reservasi','100','20','80'),
    ('Picking','100','20','80'),('Kirim','80','0','80')],size=9.3,pad=5,bottom=438)
p('Asumsi: seluruh stok awal layak. Barang di area packing tetap menjadi komitmen pesanan.',44,y_alloc+17,240,10,SECONDARY)
section('Pembatalan pesanan',386,600,198)
p('Sebelum picking: lepaskan reservasi.<br/>Sesudah picking: konfirmasi barang kembali ke lokasi.<br/>Sesudah pengiriman: proses melalui retur.',600,414,198,10,SECONDARY)
p('Jika barang menjadi karantina atau kedaluwarsa, kelayakan diperiksa kembali sebelum picking/pengiriman.',600,479,198,9.8,SECONDARY)
caption('5-2','Alokasi stok, pemenuhan aktual, dan jalur penanganan pengecualian.',529)
finish()


begin('6. Konsistensi transaksi dan kontrak API',
      'Satu transaksi database menggabungkan perubahan yang saling bergantung. '
      'ID permintaan unik menjaga hasil saat permintaan diulang.','s6')
centers=[125,297,470]
for cx,label in zip(centers,['Scanner / web','Backend / Inventory Core','PostgreSQL']):
    p(label,cx-71,159,142,9.8,bold=True,align=1)
    line(cx,187,cx,515,RULE,.55)
messages=[(0,1,219,'Konfirmasi + ID unik',198),
    (1,2,269,'BEGIN: klaim ID,<br/>lock dan validasi',235),
    (1,2,319,'Mutasi, saldo, reservasi,<br/>audit, outbox, hasil',285),
    (2,1,369,'COMMIT berhasil',348),
    (1,0,419,'Hasil + nomor transaksi',398),
    (0,1,465,'Retry dengan ID sama',444),
    (1,0,511,'Hasil transaksi sebelumnya',490)]
for a,b,yy,label,tt in messages:
    arrow([(centers[a],yy),(centers[b],yy)])
    p(label,min(centers[a],centers[b])+7,tt,abs(centers[b]-centers[a])-14,9.5,SECONDARY,align=1,leading=12)
caption('6-1','Urutan pengesahan transaksi dan penanganan permintaan ulang.',536)
gap=24;col=(CW-gap)/2
for x,title,text in [
    (M,'Transaksi atomik','Saldo, mutasi, dokumen, dan event tersimpan bersama. Kegagalan sebelum commit membatalkan seluruh perubahan terkait.'),
    (M+col+gap,'Idempotensi','ID dan isi sama mengembalikan hasil terdahulu. ID sama dengan isi berbeda ditolak tanpa mengubah stok.')]:
    section(title,572,x,col)
    p(text,x,597,col,10.2,SECONDARY)
for x,title,text in [
    (M,'Akses bersamaan','Baris stok dikunci selama transaksi. Pemeriksaan memakai saldo terbaru; aturan unik melindungi identitas posisi dan transaksi.'),
    (M+col+gap,'API berbasis tindakan','Contoh tindakan:<br/>POST /receipts/{id}/confirm<br/>POST /shipments/{id}/confirm<br/>Akses dan status dokumen divalidasi.')]:
    section(title,681,x,col)
    p(text,x,706,col,10.1,SECONDARY)
finish()


begin('7. Transfer, retur, dan penghitungan fisik',
      'Seluruh proses memakai aturan mutasi dan dokumentasi yang sama. '
      'Jumlah aktual dan penyelesaian selisih menjadi dasar pembukuan.','s7')
section('7.1 Transfer antar gudang',155)
p('Lokasi virtual dalam perjalanan memisahkan barang yang telah dikirim dari barang yang telah diterima. '
  'Contoh berikut mengasumsikan pemilik barang tetap sama.',M,183,CW,10.5,SECONDARY)
y=table(M,232,[175,104,104,CW-383],['Tahap ilustrasi','Asal','Perjalanan','Tujuan'],[
    ('Sebelum kirim','50','0','0'),('Setelah kirim 50','0','50','0'),('Diterima 48','0','2','48')],size=10.2,pad=7,bottom=378)
p('Sisa 2 tetap tercatat dalam perjalanan sampai selisih diselesaikan. Transfer antar perusahaan memerlukan aturan perpindahan kepemilikan dan dokumen tambahan.',M,y+16,CW,10.3,SECONDARY)
section('7.2 Retur pelanggan dan supplier',408)
p('Retur pelanggan mengacu pengiriman asal dan dicatat di area pemeriksaan; barang belum langsung tersedia. '
  'Retur supplier mengacu penerimaan asal, dipisahkan untuk dikirim, dan mengurangi fisik saat pengiriman dikonfirmasi. '
  'Keputusan layak, perbaikan, penolakan, atau pemusnahan mengikuti kewenangan yang disepakati.',M,437,CW,10.5,SECONDARY,leading=15)
section('7.3 Stock opname dan penyesuaian',553)
steps=[
    'Tetapkan lokasi dan batas waktu hitung. Selesaikan tugas terkait dan tahan perpindahan baru pada lokasi tersebut.',
    'Lakukan penghitungan tanpa menampilkan saldo sistem; ulangi hitung bila diperlukan.',
    'Bandingkan jumlah fisik dengan saldo pada batas waktu yang sama dan tinjau penyebab selisih.',
    'Setujui penyesuaian, bukukan mutasi beserta alasan/pelaku, lalu buka kembali lokasi.']
yy=584
for i,text in enumerate(steps):
    p(str(i+1)+'.',M,yy,20,10.3,ACCENT)
    hh=p(text,M+25,yy,CW-25,10.3,SECONDARY)
    yy+=hh+9
p('Penghitungan sambil pergerakan berlangsung memerlukan mekanisme cutoff dan rekonsiliasi tambahan. '
  'Cycle counting adalah penghitungan berkala untuk sebagian lokasi/barang.',M,yy+7,CW,10,SECONDARY)
finish()


begin('8. Integrasi, akses, dan operasional sistem',
      'Kewenangan data dan prosedur penanganan gangguan ditetapkan agar hasil WMS dan ERP dapat direkonsiliasi.','s8')
section('8.1 Kontrak data dengan ERP',152)
y=table(M,180,[104,CW-104],['Pemilik data','Kewenangan pada rancangan ini'],[
    ('ERP','Master barang/mitra, PO, sales order, invoice, dan nilai persediaan.'),
    ('WMS','Lokasi, kondisi dan jumlah fisik, reservasi, tugas operator, penerimaan, pengiriman, dan bukti scan.')],size=10.3,pad=8,bottom=322)
p('Outbox adalah antrean event yang disimpan bersama transaksi stok. Worker mengirimkannya menggunakan ID tetap. '
  'Penerima mencatat ID yang telah diproses dan memeriksa urutan versi. '
  'Kegagalan berulang ditampilkan untuk penanganan dan rekonsiliasi.',M,y+19,CW,10.5,SECONDARY)
section('8.2 Identitas, otorisasi, dan monitoring',y+112)
p('SSO menghubungkan akun perusahaan. Otorisasi backend mengikuti peran, perusahaan, dan gudang. '
  'Operator, supervisor, purchasing, finance, dan auditor memiliki kewenangan berbeda; '
  'persetujuan tertentu memisahkan pembuat dan penyetuju. Pantau antrean tertunda, integrasi gagal, konflik stok, selisih saldo, dan tugas terbuka.',M,y+140,CW,10.4,SECONDARY)
section('8.3 Ketentuan operasional teknologi',y+242)
table(M,y+271,[116,CW-116],['Aspek','Ketentuan rancangan'],[
    ('Jaringan scanner','Scan offline berstatus pending. Konfirmasi menunggu server dan kelayakan divalidasi ulang saat tersambung.'),
    ('Ketersediaan','API dapat dijalankan pada beberapa instance. Standby database mengikuti kebutuhan; replikasi tidak menggantikan backup.'),
    ('Pemulihan','Sepakati RPO (batas kehilangan data) dan RTO (waktu pemulihan). Restore mencakup database, bukti, dan rekonsiliasi ERP sebelum replay.'),
    ('Kapasitas','Sizing, retensi, dan target respons ditetapkan dari volume transaksi serta pengujian beban yang mewakili operasi.')],size=10,pad=7,bottom=772)
finish()


business=load_literal('business_scenarios')
failures=load_literal('failure_scenarios')
business[0]=('Permintaan stok bersamaan',
    'Total reservasi tidak melebihi stok layak. Permintaan yang tidak terpenuhi menerima status kekurangan tanpa saldo negatif.',business[0][2])
business[3]=('Kekurangan aktual saat picking',
    'Hanya 8 dari 10 unit tercatat diambil. Sisa 2 tetap terbuka dan reservasinya ditangani ulang; pengiriman mengikuti jumlah aktual.',business[3][2])
business[4]=(business[4][0],
    'Barang dan komitmen tetap terlacak. Stok kembali tersedia setelah pengembalian lokasi dan pelepasan reservasi dikonfirmasi.',business[4][2])
failures[3]=('ERP tidak tersedia / event berulang',failures[3][1],
    'Simulasikan ERP tidak tersedia, pulihkan, lalu kirim event berulang/tidak berurutan; periksa deduplikasi dan versi.')
begin('9.1 Matriks penerimaan operasional',
      'Matriks mendefinisikan hasil yang wajib dipenuhi dan bukti pengujian yang perlu dikumpulkan. '
      'Status pelaksanaan pengujian dicatat pada tahap implementasi.','s91',True)
table(M,151,[57,155,316,CW-528],['ID','Skenario','Hasil yang harus terjamin','Bukti / pengujian minimum'],[
    (f'UAT-{i+1:02d}',*row) for i,row in enumerate(business)],size=9.8,pad=7,bottom=529)
p('Rujukan: Bagian 5 (penerimaan/pengeluaran), Bagian 6 (transaksi), dan Bagian 7 (transfer/opname).',M,529,CW,9.2,SECONDARY)
finish()

begin('9.2 Matriks penerimaan gangguan',
      'Pengujian mencakup pengiriman ulang, kegagalan transaksi, kehilangan jaringan, akses di luar kewenangan, dan pemulihan.','s92',True)
table(M,151,[57,155,316,CW-528],['ID','Skenario','Hasil yang harus terjamin','Bukti / pengujian minimum'],[
    (f'UAT-{i+8:02d}',*row) for i,row in enumerate(failures)],size=9.6,pad=6.5,bottom=530)
p('Rujukan: Bagian 6 (konsistensi transaksi) dan Bagian 8 (integrasi/pemulihan). Replay mensyaratkan rekonsiliasi ERP.',M,529,CW,9.2,SECONDARY)
finish()


begin('10. Tahapan implementasi dan keputusan',
      'Tahapan berikut menunjukkan urutan ketergantungan pekerjaan. Jadwal, biaya, dan kapasitas ditetapkan setelah kebutuhan rinci disepakati.','s10')
section('10.1 Tahapan dan keluaran utama',151)
y=table(M,180,[77,205,CW-282],['Tahap','Keluaran utama','Dasar penerimaan'],[
    ('F1<br/>Fondasi','Ruang lingkup, master data, saldo awal, model transaksi, satuan, dan kontrol akses.','Ruang lingkup disepakati; saldo awal dan buku mutasi dapat direkonsiliasi.'),
    ('F2<br/>Operasional','Penerimaan/QC, pengeluaran, tugas gudang, transfer, retur, dan stock opname.','Alur aktual dan pengecualian tervalidasi; kriteria UAT-01 sampai UAT-07 terbukti.'),
    ('F3<br/>Integrasi & operasi','ERP, monitoring, backup/restore, prosedur operasional, dan kesiapan pengguna.','Kriteria UAT-08 sampai UAT-14 terbukti; batas pemulihan dan tanggung jawab operasi disepakati.')],size=9.8,pad=7,bottom=441)
section('10.2 Keputusan yang memerlukan kesepakatan',y+22)
y=table(M,y+50,[43,190,CW-233],['ID','Pokok keputusan','Hal yang perlu ditetapkan'],[
    ('D01','Skala dan model operasi','Gudang, pengguna, volume transaksi, jam operasi, retensi, dan kepemilikan barang.'),
    ('D02','Aturan persediaan','Batch/serial, expiry, urutan pengambilan, toleransi lebih/kurang, dan kebijakan QC.'),
    ('D03','Persetujuan dan akses','Batas kewenangan, gudang yang dapat diakses, serta transaksi yang memerlukan approval.'),
    ('D04','Kontrak ERP','Pemilik master, pemetaan dokumen, ID sumber, versi event, dan prosedur rekonsiliasi.'),
    ('D05','Kontinuitas layanan','Kebutuhan offline, target respons, RPO/RTO, backup, pemulihan, dan penanggung jawab.')],size=9.6,pad=6,bottom=694)
section('Referensi teknis',y+20)
refs=[
    ('Microsoft Dynamics 365 - Warehouse management overview','https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-management-overview'),
    ('PostgreSQL - Explicit locking','https://www.postgresql.org/docs/current/explicit-locking.html'),
    ('AWS Prescriptive Guidance - Transactional outbox pattern','https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html')]
for i,(label,url) in enumerate(refs):p(f'<link href="{url}">{label}</link>',M,y+48+i*18,CW,9.2,SECONDARY)
finish()
c.save()

overlaps=[]
for i,a in enumerate(text_bounds):
    for b in text_bounds[i+1:]:
        if a[0]!=b[0]:continue
        dx=min(a[1]+a[3],b[1]+b[3])-max(a[1],b[1])
        dy=min(a[2]+a[4],b[2]+b[4])-max(a[2],b[2])
        if dx>.5 and dy>.5:overlaps.append((a[0],a[5],b[5]))
assert not overlaps,overlaps
reader=PdfReader(str(OUTPUT))
assert len(reader.pages)==TOTAL
text='\n'.join(pg.extract_text() for pg in reader.pages)
assert not any(ch in text for ch in ['\u2014','\u2013','\ufffd'])
annotations=[a.get_object() for pg in reader.pages for a in pg.get('/Annots',[])]
external=[a for a in annotations if a.get('/A',{}).get('/URI')]
assert len(external)==3
assert len(reader.outline)==TOTAL
assert [reader.get_destination_page_number(entry) for entry in reader.outline]==list(range(TOTAL))
page_lookup={pg.indirect_reference.idnum:i for i,pg in enumerate(reader.pages)}
internal=[annotation for annotation in annotations if '/Dest' in annotation]
internal_targets=[page_lookup[annotation['/Dest'][0].idnum] for annotation in internal]
assert len(internal)==24
assert sorted(internal_targets)==[0]*12+list(range(1,TOTAL))
for i in range(1,15):assert f'UAT-{i:02d}' in text

def luminance(value):
    rgb=[int(value.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    rgb=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    return sum(a*b for a,b in zip(rgb,[.2126,.7152,.0722]))

def contrast(a,b):
    lo,hi=sorted([luminance(a),luminance(b)])
    return (hi+.05)/(lo+.05)

ratios={f'{fg} on {bg}':round(contrast(fg,bg),2) for fg,bg in [
    (INK,'#FFFFFF'),(SECONDARY,'#FFFFFF'),(SECONDARY,PAPER),(ACCENT,ACCENT_BG),(ACCENT,'#FFFFFF')]}
assert min(ratios.values())>=4.5
summary={'pages':len(reader.pages),'portrait_pages':[i+1 for i,p in enumerate(reader.pages) if p.mediabox.width<p.mediabox.height],
    'landscape_pages':[i+1 for i,p in enumerate(reader.pages) if p.mediabox.width>p.mediabox.height],
    'words_per_page':[len(pg.extract_text().split()) for pg in reader.pages],
    'outline_entries':len(reader.outline),'link_annotations':len(annotations),'external_links':len(external),
    'verified_internal_links':len(internal),
    'acceptance_scenarios':14,'overlapping_text_blocks':len(overlaps),'contrast_ratios':ratios,
    'source':str(Path(__file__).resolve()),'output':str(OUTPUT),'size_bytes':OUTPUT.stat().st_size}
(BASE/'source'/'validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
