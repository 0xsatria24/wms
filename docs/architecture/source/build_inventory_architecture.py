from pathlib import Path
import math
import json

from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.colors import HexColor, white
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader


BASE = Path(__file__).resolve().parent.parent
OUTPUT = BASE / 'arsitektur-inventory-wms.pdf'
W, H = landscape(A4)
M = 44
CW = W - 2 * M

pdfmetrics.registerFont(TTFont('Body', r'C:\Windows\Fonts\calibri.ttf'))
pdfmetrics.registerFont(TTFont('BodyBold', r'C:\Windows\Fonts\calibrib.ttf'))
pdfmetrics.registerFont(TTFont('Heading', r'C:\Windows\Fonts\cambria.ttc', subfontIndex=0))
pdfmetrics.registerFontFamily('Body', normal='Body', bold='BodyBold', italic='Body', boldItalic='BodyBold')

INK = '#202729'
SECONDARY = '#515B60'
RULE = '#7B8589'
FAINT = '#E5E8E7'
PAPER = '#F3F4F2'
ACCENT = '#98432E'
ACCENT_BG = '#F6EEE8'

c = canvas.Canvas(str(OUTPUT), pagesize=(W, H), pageCompression=1)
c.setTitle('Arsitektur Sistem Persediaan dan Gudang')
c.setSubject('Usulan rancangan: alur operasional, kontrol stok, integrasi, dan implementasi')
c.setAuthor('')
all_text = []
text_bounds = []


def p(text, x, top, width, size=11, color=INK, bold=False, leading=None, align=0, heading=False):
    style = ParagraphStyle('text', fontName='Heading' if heading else ('BodyBold' if bold else 'Body'),
                           fontSize=size, leading=leading or size*1.28,
                           textColor=HexColor(color), alignment=align)
    paragraph = Paragraph(text, style)
    _, height = paragraph.wrap(width, H)
    assert x >= M-1 and x+width <= W-M+1, (text, x, width)
    assert top >= 20 and top+height <= H-20, (text, top, height)
    paragraph.drawOn(c, x, H-top-height)
    all_text.append(text)
    text_bounds.append((page_number, x, top, width, height, text))
    return height


def rule(x1, top1, x2, top2, color=RULE, weight=.8):
    c.setStrokeColor(HexColor(color))
    c.setLineWidth(weight)
    c.line(x1, H-top1, x2, H-top2)


def panel(x, top, width, height, fill=None, stroke=RULE, weight=.8):
    c.setLineWidth(weight)
    c.setStrokeColor(HexColor(stroke))
    if fill:
        c.setFillColor(HexColor(fill))
    c.rect(x, H-top-height, width, height, stroke=1, fill=int(fill is not None))


def arrow(points, color=RULE, weight=1, start=False):
    for a, b in zip(points, points[1:]):
        rule(*a, *b, color, weight)
    def head(a, b):
        angle = math.atan2(b[1]-a[1], b[0]-a[0])
        for d in [-.48, .48]:
            end = (b[0]-5*math.cos(angle+d), b[1]-5*math.sin(angle+d))
            rule(*b, *end, color, weight)
    head(points[-2], points[-1])
    if start:
        head(points[1], points[0])


def footer(section):
    rule(M, 557, W-M, 557, RULE, .6)
    p('Usulan rancangan  /  Persediaan & gudang', M, 563, 380, 9, SECONDARY)
    p(f'{section}  /  {page_number}', W-M-240, 563, 240, 9, SECONDARY, align=2)


def page(title, intro):
    p(title, M, 39, CW, 27, heading=True, leading=31)
    p(intro, M, 83, CW, 11.4, SECONDARY)


page_number = 1
p('Arsitektur sistem\npersediaan & gudang'.replace('\n','<br/>'), M, 36, 500,
  28, heading=True, leading=30)
p('Ringkasan untuk pembahasan klien', 575, 42, CW-531, 10.3, SECONDARY, align=2)
p('Barang masuk, barang keluar, lokasi penyimpanan, dan riwayat stok dicatat dalam satu sistem. '
  'Rancangan ini mencakup beberapa gudang, scan barcode, dan koneksi ke ERP.', M, 110, CW, 11.4, SECONDARY)

# The left lane contains warehouse transactions; the right lane contains external integration.
LX, LW, RX, RW = M, 522, 626, W-M-626
for i,(title,desc) in enumerate([
    ('Admin & supervisor','Laporan dan persetujuan'),
    ('Operator gudang','Scan dan konfirmasi barang'),
    ('Tim internal','Permintaan barang')]):
    x = LX + i*LW/3
    p(title,x,169,LW/3,11.5,bold=True,align=1)
    p(desc,x,187,LW/3,9.8,SECONDARY,align=1)
    rule(x+LW/6,206,x+LW/6,215)
rule(LX+LW/6,215,LX+LW*5/6,215)
arrow([(LX+LW/2,215),(LX+LW/2,229)])

panel(LX,229,LW,40,fill=PAPER)
p('Layanan aplikasi',LX+12,237,LW-24,12,bold=True,align=1)
p('Login, hak akses, dan validasi permintaan',LX+12,253,LW-24,9.7,SECONDARY,align=1)
arrow([(LX+LW/2,269),(LX+LW/2,287)])

panel(LX,287,LW,56)
p('Modul operasional',LX+12,293,LW-24,10,SECONDARY,align=1)
for i,(a,b) in enumerate([
    ('Penerimaan & QC','Pemeriksaan dan penempatan'),
    ('Pengeluaran','Reservasi, picking, pengiriman'),
    ('Transfer & kontrol','Transfer, retur, stock opname')]):
    x=LX+i*LW/3
    if i: rule(x,310,x,336,FAINT)
    p(a,x+6,310,LW/3-12,11.3,bold=True,align=1)
    p(b,x+5,326,LW/3-10,9.5,SECONDARY,align=1)
arrow([(LX+LW/2,343),(LX+LW/2,361)])

panel(LX,361,LW,46,fill=ACCENT_BG,stroke=ACCENT,weight=1.1)
p('Pusat transaksi stok',LX+12,368,LW-24,13,ACCENT,True,align=1)
p('Saldo, reservasi, mutasi, dan jejak audit mengikuti aturan yang sama.',LX+12,386,LW-24,10.2,INK,align=1)
arrow([(LX+LW/2,407),(LX+LW/2,425)])

panel(LX,425,LW,42,fill=PAPER)
p('Database utama',LX+12,432,LW-24,12,bold=True,align=1)
p('Dokumen, posisi barang, riwayat stok, dan antrean integrasi',LX+12,449,LW-24,10,SECONDARY,align=1)

panel(RX,229,RW,67)
p('ERP perusahaan',RX+10,239,RW-20,12,bold=True)
p('Pembelian, penjualan,<br/>invoice, dan keuangan',RX+10,258,RW-20,10.5,SECONDARY)
arrow([(RX+RW/2,296),(RX+RW/2,355)],start=True)
panel(RX,355,RW,63,fill=PAPER)
p('Worker integrasi',RX+10,364,RW-20,12,bold=True)
p('Proses latar belakang<br/>untuk kirim dan terima data',RX+10,384,RW-20,10.1,SECONDARY)

# Inbound ERP documents are validated by the API; committed outbox events feed the worker.
arrow([(RX,371),(607,371),(607,249),(LX+LW,249)])
arrow([(LX+LW,446),(586,446),(586,402),(RX,402)])

rule(M,494,W-M,494,RULE,.6)
p('Satu pintu perubahan stok',M,506,350,11.8,bold=True)
p('Penerimaan, picking, transfer, dan opname memakai pusat transaksi yang sama.',M,524,350,10.5,SECONDARY)
p('Integrasi dapat dicoba kembali',444,506,CW-400,11.8,bold=True)
p('PO dan order masuk lewat API. Hasil transaksi dikirim ke ERP lewat antrean yang dapat dicoba kembali.',444,524,CW-400,10.5,SECONDARY)
footer('Arsitektur')
c.showPage()


page_number = 2
page('Alur barang dan perubahan stok',
     'Operator mengonfirmasi jumlah aktual pada setiap pekerjaan. Dokumen yang belum selesai tetap menyimpan sisanya.')

def timeline(top,title,steps,effects):
    p(title,M,top,CW,19,heading=True)
    width = CW/5
    for i,(name,desc) in enumerate(steps):
        x=M+i*width
        p(str(i+1).zfill(2),x,top+35,width-14,9.5,SECONDARY)
        p(name,x,top+52,width-14,11.7,bold=True)
        p(desc,x,top+73,width-17,10.6,SECONDARY)
    axis=top+112
    arrow([(M,axis),(W-M,axis)])
    for i,effect in enumerate(effects):
        x=M+i*width
        rule(x,axis-3,x,axis+3)
        p(effect,x,axis+11,width-16,9.8,ACCENT if i in (1,4) else SECONDARY)

timeline(131,'Barang masuk',[
    ('Rencana kedatangan','Pilih pesanan pembelian<br/>(PO) atau transfer.'),
    ('Terima & scan','Cocokkan barang,<br/>jumlah, dan satuan.'),
    ('Periksa kualitas','Tentukan jumlah layak,<br/>karantina, atau ditolak.'),
    ('Simpan barang','Arahkan barang ke<br/>rak atau lokasi tujuan.'),
    ('Konfirmasi lokasi','Scan lokasi dan<br/>selesaikan penempatan.')],
    ['Belum menambah stok','Stok fisik bertambah','Kondisi barang tercatat','Lokasi stok berpindah','Stok layak bisa dialokasikan'])

timeline(297,'Barang keluar',[
    ('Permintaan','Pilih order dan jalankan<br/>persetujuan yang berlaku.'),
    ('Reservasi','Alokasikan stok yang<br/>layak untuk pesanan.'),
    ('Ambil barang','Scan lokasi dan barang;<br/>catat jumlah aktual.'),
    ('Periksa & packing','Periksa isi, jumlah,<br/>dan tujuan paket.'),
    ('Kirim barang','Konfirmasi pengiriman<br/>dan dokumen keluarnya.')],
    ['Belum mengurangi stok','Stok bebas berkurang','Masih terikat pesanan','Barang di area packing','Stok fisik berkurang'])

rule(M,462,W-M,462,RULE,.6)
p('Contoh: penerimaan sebagian',M,476,350,12,bold=True)
p('PO 100 unit, baru datang 60. Sistem mencatat 60 unit diterima dan 40 unit masih menunggu.',M,498,350,11,SECONDARY)
p('Contoh: selisih transfer',444,476,CW-400,12,bold=True)
p('Dikirim 50 unit, diterima 48. Sisa 2 unit tetap tercatat dalam perjalanan sampai selisih diselesaikan.',444,498,CW-400,11,SECONDARY)
footer('Operasional')
c.showPage()


page_number = 3
page('Data, kontrol, dan implementasi',
     'Rancangan awal memisahkan saldo fisik, stok yang sudah dialokasikan, dan riwayat transaksi.')

LEFT, GAP = 458, 34
RIGHT_X=M+LEFT+GAP
RIGHT_W=CW-LEFT-GAP
p('Data yang dikelola',M,130,LEFT,18,heading=True)

rows=[
    ('Barang & lokasi','SKU, barcode, satuan, gudang, rak, batch/serial, dan kedaluwarsa sesuai jenis barang.'),
    ('Saldo & reservasi','Stok fisik, kondisi barang, lokasi, serta jumlah yang sudah dialokasikan untuk pesanan.'),
    ('Dokumen & mutasi','Penerimaan, pengiriman, transfer, retur, dan hasil opname beserta perubahan stoknya.'),
    ('Kontrol & laporan','Hak akses, persetujuan, jejak audit, kartu stok, dan laporan pergerakan barang.')]
y=157
for label,desc in rows:
    rule(M,y,M+LEFT,y,RULE,.6)
    p(label,M,y+6,116,11,bold=True)
    height=p(desc,M+126,y+6,LEFT-126,10.6,SECONDARY)
    y+=max(38,height+12)
rule(M,y,M+LEFT,y,RULE,.6)

p('Aturan yang menjaga konsistensi',M,y+15,LEFT,18,heading=True)
controls=[
    'Pembaruan stok dilakukan dalam satu transaksi database agar dua operator tidak memakai stok yang sama.',
    'Konfirmasi memakai ID unik. Permintaan yang dikirim ulang tidak menggandakan pencatatan.',
    'Koreksi stok memakai transaksi penyesuaian dengan alasan dan persetujuan sesuai kebijakan.'
]
cy=y+45
for i,text in enumerate(controls):
    p(str(i+1)+'.',M,cy,16,10.6,ACCENT)
    hh=p(text,M+20,cy,LEFT-20,10.6,SECONDARY)
    cy+=hh+6

rule(RIGHT_X-17,130,RIGHT_X-17,452,RULE,.6)
p('Komponen teknis',RIGHT_X,130,RIGHT_W,18,heading=True)
technical=[
    ('Backend modular','Satu aplikasi dengan modul operasional yang terpisah jelas.'),
    ('PostgreSQL','Database utama untuk saldo, dokumen, mutasi, dan reservasi.'),
    ('Worker & antrean','Kirim data ERP, laporan, dan notifikasi; simpan status dan retry.'),
    ('Dokumen & operasional','Penyimpanan foto/file, monitoring, backup, dan uji pemulihan.')]
ty=160
for label,desc in technical:
    p(label,RIGHT_X,ty,RIGHT_W,11.1,bold=True)
    hh=p(desc,RIGHT_X,ty+17,RIGHT_W,10.5,SECONDARY)
    ty+=17+hh+7

p('Koneksi scanner',RIGHT_X,ty+2,RIGHT_W,11.1,bold=True)
p('Saat jaringan putus, scan bisa disimpan sebagai pending. Konfirmasi stok menunggu server. '
  'Operasi offline penuh memerlukan rancangan tambahan.',RIGHT_X,ty+21,RIGHT_W,10.5,SECONDARY)

rule(M,462,W-M,462,RULE,.6)
p('Urutan pembangunan',M,475,LEFT,11.6,bold=True)
p('Master data & pusat transaksi stok, lalu operasional gudang, dilanjutkan integrasi ERP dan pengujian.',M,493,LEFT,10.5,SECONDARY)
p('Disepakati sebelum implementasi',RIGHT_X,475,RIGHT_W,11.6,bold=True)
p('Gudang, pengguna, volume transaksi, aturan approval, kebutuhan offline, dan ERP.',RIGHT_X,493,RIGHT_W,10.5,SECONDARY)

p('Referensi: '
  '<link href="https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-management-overview">Microsoft WMS</link>'
  '  /  <link href="https://www.postgresql.org/docs/current/explicit-locking.html">PostgreSQL locking</link>'
  '  /  <link href="https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html">AWS transactional outbox</link>',
  M,535,CW,9,SECONDARY)
footer('Kontrol & implementasi')
c.save()

overlaps=[]
for index,a in enumerate(text_bounds):
    for b in text_bounds[index+1:]:
        if a[0] != b[0]:
            continue
        horizontal=min(a[1]+a[3],b[1]+b[3])-max(a[1],b[1])
        vertical=min(a[2]+a[4],b[2]+b[4])-max(a[2],b[2])
        if horizontal > .5 and vertical > .5:
            overlaps.append((a[0],a[5],b[5]))
assert not overlaps, overlaps

reader=PdfReader(str(OUTPUT))
assert len(reader.pages)==3
plain='\n'.join(page.extract_text() for page in reader.pages)
assert not any(ch in plain for ch in ['\u2014','\u2013','\ufffd'])
assert all(page.mediabox.width > page.mediabox.height for page in reader.pages)
assert len([a for page in reader.pages for a in page.get('/Annots',[])])==3

def luminance(hex_value):
    values=[int(hex_value.lstrip('#')[i:i+2],16)/255 for i in (0,2,4)]
    linear=[v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4 for v in values]
    return sum(a*b for a,b in zip(linear,[.2126,.7152,.0722]))

def contrast(a,b):
    x,y=sorted((luminance(a),luminance(b)))
    return (y+.05)/(x+.05)

ratios={f'{fg} on {bg}':round(contrast(fg,bg),2)
        for fg,bg in [(INK,'#FFFFFF'),(SECONDARY,'#FFFFFF'),(SECONDARY,PAPER),(ACCENT,ACCENT_BG),(ACCENT,'#FFFFFF')]}
assert min(ratios.values()) >= 4.5, ratios
summary={
    'pages':len(reader.pages),
    'words_per_page':[len(p.extract_text().split()) for p in reader.pages],
    'contrast_ratios':ratios,
    'links':3,
    'overlapping_text_blocks':len(overlaps),
    'output':str(OUTPUT),
    'size_bytes':OUTPUT.stat().st_size,
}
(BASE/'source'/'validation.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print(json.dumps(summary,indent=2))
