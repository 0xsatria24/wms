"""Produce static design documents and vector/raster artboards, never app source."""
from pathlib import Path
from html import escape
import json
import re
import hashlib
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont
from design_data import SCREENS, LIGHT, DARK

ROOT = Path(__file__).resolve().parents[1]
BOARDS = ROOT / "boards"
SPECS = ROOT / "functions"
QA = ROOT / "qa"
FONT = Path("C:/Windows/Fonts/segoeui.ttf")
BOLD = Path("C:/Windows/Fonts/segoeuib.ttf")
for folder in (BOARDS, SPECS, QA):
    folder.mkdir(parents=True, exist_ok=True)

NAV = ["Persediaan", "Barang masuk", "Barang keluar", "Transfer dan retur", "Opname", "Penelusuran", "Antrean", "Integrasi", "Pengaturan"]
FONT_CACHE = {}

def font(size, bold=False):
    key = (size, bold)
    if key not in FONT_CACHE:
        FONT_CACHE[key] = ImageFont.truetype(str(BOLD if bold else FONT), size)
    return FONT_CACHE[key]

class Board:
    def __init__(self, name, width, height, colors=LIGHT, title=""):
        self.name, self.w, self.h, self.c = name, width, height, colors
        self.im = Image.new("RGB", (width, height), colors["canvas"])
        self.draw = ImageDraw.Draw(self.im)
        self.svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc"><title id="title">{escape(title or name)}</title><desc id="desc">Rancangan statis Inventory WMS. Semua angka, kode dan keadaan operasional merupakan data simulasi; kontrol tidak interaktif.</desc>']
        self.items, self.controls = [], []
        self.rect(0,0,width,height,colors["canvas"])

    def rect(self,x,y,w,h,fill=None,stroke=None,r=0):
        fill = fill or self.c["surface"]
        if r:
            self.draw.rounded_rectangle((x,y,x+w,y+h),r,fill=fill,outline=stroke,width=1)
        else:
            self.draw.rectangle((x,y,x+w,y+h),fill=fill,outline=stroke,width=1)
        self.svg.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"'+(f' stroke="{stroke}"' if stroke else '')+'/>')
        self.items.append(dict(type="shape",x=x,y=y,w=w,h=h))

    def line(self,x1,y1,x2,y2,color=None,width=1):
        color=color or self.c["rule"]
        self.draw.line((x1,y1,x2,y2),fill=color,width=width)
        self.svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"/>')

    def text(self,x,y,text,size=14,color=None,bold=False,width=None,lineheight=None,align="left"):
        color = color or self.c["ink"]
        ff=font(size,bold); ascent,descent=ff.getmetrics(); lh=lineheight or size+7
        lines=[]
        for paragraph in str(text).split("\n"):
            words=paragraph.split(" "); current=""
            for word in words:
                candidate=(current+" "+word).strip()
                if width and ff.getlength(candidate)>width and current:
                    lines.append(current);current=word
                else:current=candidate
            lines.append(current)
        for i,s in enumerate(lines):
            tw=ff.getlength(s)
            xx=x-tw if align=="right" else x
            baseline=y+i*lh+ascent
            self.draw.text((xx,baseline),s,font=ff,fill=color,anchor="ls")
            self.svg.append(f'<text x="{xx:.2f}" y="{baseline}" font-family="Segoe UI, Arial, sans-serif" font-size="{size}" font-weight="{700 if bold else 400}" fill="{color}">{escape(s)}</text>')
            self.items.append(dict(type="text",x=round(xx,2),y=y+i*lh,w=round(tw,2),h=ascent+descent,text=s))
        return len(lines)*lh

    def button(self,x,y,w,label,primary=False,h=44,disabled=False):
        fill=self.c['alt'] if disabled else self.c['action'] if primary else self.c['surface']
        stroke=self.c['line'] if disabled or not primary else None
        fg=self.c['muted'] if disabled else self.c['on_action'] if primary else self.c['ink']
        self.rect(x,y,w,h,fill,stroke,4)
        self.text(x+14,y+(h-22)//2,label,14,fg,True,width=w-28)
        self.controls.append(dict(label=label,x=x,y=y,w=w,h=h,static=True,disabled=disabled))

    def field(self,x,y,w,label,value,focus=False,h=48,input_size=14):
        self.text(x,y,label,14,bold=True)
        self.rect(x,y+28,w,h,self.c["surface"],self.c["focus"] if focus else self.c["line"],4)
        if focus:
            self.svg.append(f'<rect x="{x-4}" y="{y+24}" width="{w+8}" height="{h+8}" rx="5" fill="none" stroke="{self.c["focus"]}" stroke-width="3"/>')
            self.draw.rounded_rectangle((x-4,y+24,x+w+4,y+32+h),5,outline=self.c["focus"],width=3)
        self.text(x+12,y+40,value,input_size,self.c["muted"],width=w-24)
        self.controls.append(dict(label=label,x=x,y=y+28,w=w,h=h,static=True))

    def save(self):
        self.svg.append('</svg>')
        svg_path=BOARDS/(self.name+'.svg');png_path=BOARDS/(self.name+'.png')
        svg_path.write_text('\n'.join(self.svg),encoding='utf-8')
        self.im.save(png_path)
        bad=[i for i in self.items if i['x']<-.1 or i['y']<-.1 or i['x']+i['w']>self.w+.1 or i['y']+i['h']>self.h+.1]
        small=[i for i in self.controls if min(i['w'],i['h'])<44]
        ET.parse(svg_path)
        return dict(file=png_path.name,width=self.w,height=self.h,text_runs=sum(i['type']=='text' for i in self.items),out_of_canvas=bad,small_controls=small,controls=self.controls)

def shell(b,s):
    c=b.c
    b.rect(0,0,b.w,32,c['ink'])
    b.text(20,6,"DESAIN STATIS / Data simulasi / Kontrol berupa gambar, bukan aplikasi",12,c['surface'])
    b.rect(0,32,208,b.h-32,c['surface'])
    b.text(24,57,"Inventory / WMS",18,bold=True)
    b.text(24,88,"Rancangan kerja gudang",12,c['muted'])
    b.line(24,126,184,126)
    y=150
    for nav in NAV:
        active=nav==s['group']
        if active:b.rect(12,y-4,184,44,c['selection'],r=4)
        b.text(24,y+6,nav,14,bold=active)
        y+=52
    b.line(24,b.h-140,184,b.h-140)
    b.text(24,b.h-120,"[Pengguna sesuai akses]",12,c['muted'],width=164)
    b.text(24,b.h-72,s['id']+" / usulan desain",12,c['muted'])
    b.rect(209,32,b.w-209,86,c['surface'])
    b.text(232,47,s['group']+" / "+s['title'],14,c['muted'])
    b.text(232,75,s['context'],18,bold=True,width=865)
    b.text(b.w-24,57,"[Perusahaan] / [Gudang]",13,c['muted'],align="right")
    b.text(232,145,s['title'],24,bold=True)
    b.text(232,184,s['job'],14,c['muted'],width=b.w-480)
    b.text(b.w-24,150,s['id']+" · "+s['phase'],12,c['muted'],align="right")
    b.text(232,b.h-26,"29 Oktober 2026 · Blueprint Ledger · "+s['id']+" · Semua contoh operasional bersifat simulasi",12,c['muted'])

def summary(b,s,x,y,w):
    c=b.c
    b.rect(x,y,w,118,c['alt'],r=6)
    b.text(x+20,y+13,s['metric'][0],13,c['muted'])
    b.text(x+20,y+38,s['metric'][1],28,bold=True,width=w-40)
    b.text(x+20,y+83,s['metric'][2],13,c['muted'],width=w-40)

def table(b,s,x,y,w,rowheight=62):
    c=b.c; widths=[.43,.33,.24]
    numeric_cols={'S03':[1,2],'S04':[1],'S05':[1,2],'S09':[1,2],'S10':[1],'S12':[1,2],'S21':[1]}.get(s['id'],[])
    b.rect(x,y,w,42,c['alt'])
    offsets=[0,w*widths[0],w*(widths[0]+widths[1])]
    for j,label in enumerate(s['cols']):
        tx=x+offsets[j]+w*widths[j]-14 if j in numeric_cols else x+offsets[j]+14
        b.text(tx,y+10,label,13,c['muted'],True,width=w*widths[j]-28,align='right' if j in numeric_cols else 'left')
    y+=42
    for i,row in enumerate(s['rows']):
        for j,value in enumerate(row):
            numeric=j in numeric_cols and re.match(r'^[+\-]?\d',value)
            tx=x+offsets[j]+w*widths[j]-14 if numeric else x+offsets[j]+14
            b.text(tx,y+12,value,14,c['ink'] if j<2 else c['muted'],bold=j==0,width=w*widths[j]-28,align='right' if numeric else 'left')
        b.line(x,y+rowheight,x+w,y+rowheight)
        y+=rowheight
    return y

def desktop(s,colors=LIGHT,suffix=""):
    b=Board(s['slug']+suffix,1440,1080,colors,s['title']);c=b.c;shell(b,s)
    wide=s['pattern'] in ('ledger','table')
    if wide:
        x=232;w=1184
        b.rect(x,234,w,744,c['surface'],r=6)
        b.text(x+24,254,s['heading'],18,bold=True)
        labels=s['left']
        for i,(label,value) in enumerate(labels):
            xx=x+24+i*286
            b.text(xx,299,label,13,c['muted'])
            b.rect(xx,324,268,46,c['surface'],c['line'],4)
            b.text(xx+12,337,value,13,width=244)
            b.controls.append(dict(label=label,x=xx,y=324,w=268,h=46,static=True))
        end=table(b,s,x+24,402,w-48,70)
        b.text(x+24,end+24,s['note'],14,c['muted'],width=w-48)
        b.line(x+24,826,x+w-24,826)
        b.text(x+24,847,s['metric'][0],13,c['muted'])
        b.text(x+24,871,s['metric'][1],25,bold=True)
        b.text(x+24,912,s['metric'][2],14,c['muted'],width=600)
        b.button(x+w-304,888,280,s['action'],True)
        b.button(x+w-500,888,180,s['secondary'])
    else:
        lx=232;lw=272;x=524;w=892
        b.rect(lx,234,lw,744,c['surface'],r=6)
        b.text(lx+20,255,s['left_title'],18,bold=True,width=lw-40)
        yy=308
        for i,(label,value) in enumerate(s['left']):
            if i==0 and s['id']=='S05':b.rect(lx+12,yy-8,lw-24,94,c['selection'],r=4)
            b.text(lx+24,yy,label+(' · Dipilih' if i==0 and s['id']=='S05' else ''),14,bold=True,width=lw-48)
            b.text(lx+24,yy+27,value,14,c['muted'],width=lw-48)
            if i>0:b.line(lx+20,yy+85,lx+lw-20,yy+85)
            yy+=126
        b.rect(x,234,w,744,c['surface'],r=6)
        b.text(x+24,254,s['heading'],18,bold=True,width=w-48)
        if s['pattern'] in ('quantity','scan'):
            b.field(x+24,303,w-48,"Scan barang / identitas" if s['pattern']=='quantity' else "Scan lokasi tujuan","[Field scan aktif sesuai konteks]",True)
            summary(b,s,x+24,406,w-48)
            end=table(b,s,x+24,548,w-48,62)
        elif s['pattern']=='form':
            summary(b,s,x+24,303,w-48)
            for i,row in enumerate(s['rows']):
                xx=x+24+(i%2)*430;yy=448+(i//2)*136
                b.field(xx,yy,406,row[0],row[1])
                b.text(xx,yy+86,row[2],13,c['muted'],width=406)
            end=735
        elif s['pattern']=='timeline':
            summary(b,s,x+24,303,w-48)
            yy=452
            for i,row in enumerate(s['rows']):
                b.line(x+36,yy+12,x+36,yy+80,c['line'])
                b.rect(x+31,yy+7,10,10,c['surface'],c['line'],2)
                b.text(x+60,yy,row[0],16,bold=True,width=w-100)
                b.text(x+60,yy+28,row[1],14,width=480)
                b.text(x+w-24,yy+28,row[2],13,c['muted'],align='right')
                yy+=88
            end=yy
        elif s['pattern']=='blind':
            summary(b,s,x+24,303,w-48)
            b.field(x+24,450,w-48,"Barang / batch / serial","[Scan identitas yang akan dihitung]",True)
            b.field(x+24,560,406,"Aktual fisik","[Isi hasil hitung]")
            b.field(x+454,560,414,"Satuan","[Satuan yang sah]")
            b.text(x+24,666,"Hasil hitung belum mengubah saldo.",16,bold=True)
            b.text(x+24,700,"Saldo pembanding dan selisih hanya tersedia pada varian peninjau.",14,c['muted'],width=w-48)
            end=764
        else:
            summary(b,s,x+24,303,w-48)
            end=table(b,s,x+24,450,w-48,62)
        note_y=max(790,min(end+22,842))
        b.text(x+24,note_y,s['note'],14,c['muted'],width=w-48)
        b.line(x+24,876,x+w-24,876)
        primary_w=max(230,min(360,int(font(14,True).getlength(s['action']))+32))
        secondary_w=max(180,min(340,int(font(14,True).getlength(s['secondary']))+32))
        b.button(x+24,904,secondary_w,s['secondary'])
        b.button(x+w-24-primary_w,904,primary_w,s['action'],True,disabled=s['id']=='S04')
        b.text(x+24,955,"Review scope, identitas dan aktual sebelum konfirmasi. Efek sesuai spesifikasi "+s['id']+".",12,c['muted'],width=w-48)
    return b.save()

def mobile(s):
    b=Board(s['slug']+'-handheld',390,1120,title=s['title']+' handheld');c=b.c
    b.rect(0,0,390,52,c['ink'])
    b.text(16,8,"DESAIN STATIS / DATA SIMULASI",12,c['surface'],True)
    b.text(16,27,"Kontrol berupa gambar",12,c['surface'])
    b.rect(0,52,390,66,c['surface'])
    b.button(16,63,78,"Menu")
    b.text(112,66,"Inventory / WMS",16,bold=True)
    b.text(112,89,"[Perusahaan] / [Gudang]",12,c['muted'])
    b.text(16,138,s['title'],22,bold=True,width=358)
    b.text(16,205,s['context'],14,c['muted'],width=358)
    b.line(16,260,374,260)
    b.text(16,279,s['heading'],18,bold=True,width=358)
    if s['id']=='S14':
        b.field(16,345,358,"Scan barang","[Identitas yang dihitung]",True,h=52,input_size=16)
        b.field(16,447,358,"Aktual fisik / satuan","[Isi hasil hitung dan satuan]",h=52,input_size=16)
    elif s['id']=='S17':
        b.rect(16,345,358,190,c['warning_soft'],r=6)
        b.text(32,362,"Hasil belum pasti",18,c['warning'],True)
        b.text(32,398,"Server mungkin sudah mencatat. Periksa hasil ini sebelum membuat konfirmasi baru.",16,c['warning'],width=326)
        b.text(32,485,"Aktual tetap sampai hasil diketahui.",14,c['warning'],width=326)
    elif s['id']=='S21':
        b.rect(16,345,358,190,c['alt'],r=6)
        for i,label in enumerate(["Expected 10 · Matched 9","Missing 1 · Unexpected 1","Unknown 1 · Periksa fisik"]):
            b.text(32,364+i*48,label,16,bold=i==0,width=326)
    else:
        inputs={
            'S05':('Scan barang','[SKU-A] · Produk A','Aktual penerimaan (unit)','60'),
            'S07':('Scan lokasi tujuan','[SIM-A-01]','Aktual penempatan (unit)','60'),
            'S09':('Scan barang, asal A-01','[SKU-A] · Produk A','Aktual ditemukan (unit)','8'),
            'S10':('Verifikasi barang siap kirim','[SKU-A] · Produk A','Aktual pengiriman (unit)','8')
        }
        scan_label,scan_value,qty_label,qty_value=inputs[s['id']]
        b.field(16,345,358,scan_label,scan_value,True,h=52,input_size=16)
        b.field(16,447,358,qty_label,qty_value,h=52,input_size=16)
    b.rect(16,562,358,142,c['surface'],r=6)
    b.text(32,579,s['metric'][0],14,c['muted'],width=326)
    b.text(32,612,s['metric'][1],28,bold=True,width=326)
    b.text(32,661,s['metric'][2],14,c['muted'],width=326)
    yy=731
    details={
        'S05':[('Barang','[SKU-A] · Produk A'),('Lokasi / kondisi awal','Receiving · QC sesuai kebijakan')],
        'S07':[('Asal','[SIM-RECEIVING] · Produk A'),('Tujuan yang dipindai','[SIM-A-01] · Belum disahkan')],
        'S09':[('Asal / barang','[SIM-A-01] · Produk A'),('Tujuan / sisa','Staging · 2 unit masih terbuka')],
        'S10':[('Order / barang','[SIM-ORDER-A] · Produk A'),('Lokasi / sisa','Staging · 2 unit belum dipenuhi')],
        'S14':[('Lokasi','[SIM-A-01] · Freeze server'),('Peran','Penghitung · Tanpa pembanding')],
        'S17':[('Dokumen','[SIM-SHIP-A]'),('Lingkup maksud','[Gudang / pengguna asal]')],
        'S21':[('Reader / area','[Reader / area sah]'),('Dokumen','[SIM-ORDER-A] · Lingkup tetap')]
    }
    for label,value in details[s['id']]:
        b.text(16,yy,label,14,c['muted'])
        b.text(16,yy+24,value,16,bold=True,width=358)
        yy+=76
    b.text(16,890,s['note'],14,c['muted'],width=358)
    b.line(0,984,390,984)
    b.rect(0,985,390,135,c['surface'])
    b.button(16,1001,358,s['action'],True,52)
    b.text(16,1069,"Footer disisihkan dari isi; keyboard perlu uji perangkat.",12,c['muted'],width=358)
    return b.save()

def tablet(s):
    b=Board(s['slug']+'-tablet',900,1100,title='Receiving rentang menengah');c=b.c
    b.rect(0,0,900,32,c['ink']);b.text(24,6,"DESAIN STATIS / Data simulasi / Layout menengah",12,c['surface'])
    b.rect(0,32,900,76,c['surface']);b.button(24,48,84,"Menu")
    b.text(132,54,"Inventory / WMS",18,bold=True)
    b.text(876,58,"[Perusahaan] / [Gudang]",13,c['muted'],align='right')
    b.text(24,132,s['title'],24,bold=True)
    b.text(24,175,"Daftar dokumen menjadi pemilih, bukan sidebar sempit.",14,c['muted'])
    b.field(24,222,852,"Dokumen dan lokasi","[SIM-PO-A] / [SIM-RECEIVING]")
    b.rect(24,326,852,660,c['surface'],r=6)
    b.text(48,347,s['heading'],18,bold=True)
    b.field(48,398,804,"Scan barang","[Scan aktif dengan mode input jumlah]",True)
    summary(b,s,48,503,804)
    end=table(b,s,48,649,804,62)
    b.text(48,end+16,s['note'],14,c['muted'],width=804)
    b.button(48,932,170,"Ubah aktual")
    b.button(578,932,274,s['action'],True)
    b.text(24,1032,"Scope, aktual, satuan dan sisa tetap terlihat. Ukuran adalah hipotesis desain.",14,c['muted'])
    return b.save()

def foundation():
    b=Board('00-foundation',1600,1400,title='Fondasi desain Ledger Inventory WMS');c=b.c
    b.text(48,30,"Inventory / WMS",18,bold=True)
    b.text(1552,35,"29 Oktober 2026 / Rancangan statis",13,c['muted'],align='right')
    b.text(48,90,"Ruang kerja yang mengikuti barang dan dokumen",34,bold=True)
    b.text(48,143,"Fondasi visual dari referensi ERP, disesuaikan dengan aturan Inventory + WMS.",18,c['muted'])
    b.text(48,187,"ENERGY 1 / RHYTHM 1 / MOTION 1 · Ledger · Tanpa logo atau ilustrasi referensi",14,c['muted'])
    b.line(48,232,1552,232)
    b.text(48,259,"01 / Warna dan peran",22,bold=True)
    tokens=[('Canvas','canvas'),('Permukaan','surface'),('Teks','ink'),('Aksi utama','action'),('Perhatian','warning'),('Error','danger')]
    for i,(label,key) in enumerate(tokens):
        x=48+i*252;b.rect(x,310,228,84,c[key],c['rule'] if key in ('canvas','surface') else None,6)
        b.text(x,410,label,16,bold=True);b.text(x,437,c[key].upper(),14,c['muted'])
    b.text(48,489,"02 / Tipografi dan angka",22,bold=True)
    b.text(48,540,"Penerimaan aktual",28,bold=True)
    b.text(48,585,"Produk A · [SKU-A]",18,bold=True)
    b.text(48,619,"Segoe UI / Label 14 / Isi 14 / Judul 24",14,c['muted'])
    b.text(48,654,"Fisik 100   Komitmen 24   Bebas 76 unit",20,bold=True)
    b.text(48,693,"Data simulasi. Satuan dan dimensi selalu menyertai angka.",14,c['muted'])
    b.text(840,489,"03 / Kontrol dan batas",22,bold=True)
    b.field(840,538,712,"Aktual diterima","[Isi aktual]",True)
    b.button(840,653,252,"Konfirmasi penerimaan",True)
    b.button(1112,653,180,"Ubah aktual")
    b.text(840,715,"44px desktop / 52px scanner / fokus 3px + offset 3px",14,c['muted'])
    b.line(48,771,1552,771)
    b.text(48,797,"04 / Informasi yang tidak boleh bercampur",22,bold=True)
    boxes=[('Stok','Fisik / komitmen / bebas'),('Konfirmasi','Pending / belum pasti / tercatat'),('Identitas','Deteksi / posisi terkonfirmasi'),('Integrasi','WMS tercatat / hasil ERP')]
    for i,(title,body) in enumerate(boxes):
        x=48+(i%2)*776;y=850+(i//2)*108
        b.text(x,y,title,16,bold=True)
        b.text(x,y+33,body,18,c['muted'],width=728)
    b.line(48,1077,1552,1077)
    b.text(48,1104,"05 / Bentuk yang punya fungsi",22,bold=True)
    b.text(48,1152,"Radius 4 / 6 / 8",18,bold=True)
    b.text(48,1188,"Field, panel dan dialog dibedakan; permukaan normal datar.",16,c['muted'],width=680)
    b.text(840,1152,"Lebar / menengah / sempit",18,bold=True)
    b.text(840,1188,"Tabel perbandingan, pemilih tugas, lalu record vertikal pada scanner.",16,c['muted'],width=712)
    b.text(48,1312,"Acuan visual untuk ditinjau. Tidak ada implementasi aplikasi, data produksi atau hasil UAT pada paket ini.",14,c['muted'])
    return b.save()

def state_board():
    b=Board('00-states',1600,1120,title='Keadaan UI dan cara pemulihan');c=b.c
    b.text(48,32,"Keadaan layar dan pemulihan",30,bold=True)
    b.text(48,84,"DESAIN STATIS / Data simulasi / Tindakan di bawah merupakan kontrak desain",14,c['muted'])
    states=[('Belum ada tugas','Belum ada tugas picking di gudang ini. Minta penugasan supervisor.','Lihat lingkup','alt','ink'),('Filter tanpa hasil','Tidak ada dokumen yang cocok. Filter aktif tetap terlihat.','Hapus filter','alt','ink'),('Memuat penerimaan','Memuat dokumen dan sisa terbaru untuk gudang terpilih.','Tunggu hasil','alt','ink'),('Scan pending','Permintaan belum terkirim. Stok belum dikonfirmasi.','Buka pending','warning_soft','warning'),('Hasil belum pasti','Server mungkin sudah commit. Pertahankan kunci dan isi asli.','Periksa hasil','warning_soft','warning'),('Ditolak: kondisi berubah','Barang kini karantina. Pengiriman ditahan sampai masalah selesai.','Tinjau konflik','danger_soft','danger')]
    for i,(title,body,action,bg,fg) in enumerate(states):
        x=48+(i%3)*510;y=149+(i//3)*415
        b.rect(x,y,484,370,c['surface'],r=6)
        b.rect(x+20,y+20,444,226,c[bg],r=4)
        b.text(x+40,y+40,title,20,c[fg],True,width=404)
        b.text(x+40,y+101,body,17,c[fg],width=404)
        if i==2:b.text(x+22,y+280,"Tidak ada submit saat data belum siap.",14,c['muted'],width=440)
        else:b.button(x+20,y+278,444,action)
    b.text(48,1022,"Sukses WMS memperlihatkan nomor transaksi dan aktual; status ERP dilaporkan terpisah.",16,c['muted'])
    return b.save()

def confirmation_board():
    b=Board('00-confirmation-review',1600,1080,title='Kontrak review sebelum konfirmasi stok');c=b.c
    b.rect(0,0,1600,38,c['ink'])
    b.text(24,9,'DESAIN STATIS / Data simulasi / Contoh komponen review penerimaan',14,c['surface'])
    b.text(48,76,'Review yang menjelaskan dampak fisik',28,bold=True)
    b.text(48,124,'Satu maksud bisnis, satu isi yang ditinjau. Perubahan aktual menuntut review baru.',16,c['muted'])
    b.rect(48,188,1016,808,c['surface'],c['line'],8)
    b.text(80,215,'Konfirmasi penerimaan',24,bold=True)
    b.text(80,257,'[Perusahaan] / [Gudang] / PO [SIM-PO-A]',16,c['muted'])
    b.line(80,308,1032,308)
    sections=[('Barang','[SKU-A] · Produk A'),('Lokasi tujuan','[SIM-RECEIVING]'),('Aktual dan satuan','60 unit × faktor 1 = 60 unit dasar'),('Kondisi awal','Karantina jika QC diwajibkan'),('Sisa dokumen','100 unit sebelum / 40 unit setelah'),('Identitas wajib','[Batch / serial sesuai kebijakan barang]')]
    for i,(label,value) in enumerate(sections):
        x=80+(i%2)*476;y=336+(i//2)*112
        b.text(x,y,label,14,c['muted'])
        b.text(x,y+29,value,18,bold=True,width=444)
    b.rect(80,696,952,128,c['alt'],r=6)
    b.text(104,716,'Dampak setelah server mengesahkan',16,bold=True)
    b.text(104,750,'Receiving bertambah 60 unit. Sisa PO 40 unit tetap terbuka.',18,width=904)
    b.text(104,787,'Hasil WMS dan status ERP dilaporkan terpisah.',14,c['muted'])
    b.line(80,854,1032,854)
    b.button(80,882,240,'Kembali ubah aktual')
    b.button(736,882,296,'Konfirmasi penerimaan',True)
    b.text(80,952,'Contoh komponen S05. Tidak ada transaksi yang dikirim dari gambar ini.',13,c['muted'])
    b.text(1112,210,'Kontrak perilaku',20,bold=True,width=440)
    notes=[('Sebelum kirim','Scope, barang, aktual, satuan dan tujuan harus terbaca.'),('Saat mengirim','Cegah klik ganda; jelaskan bahwa hasil sedang diperiksa.'),('Respons terputus','Tampilkan hasil belum pasti; periksa konfirmasi yang sama.'),('Keyboard','Fokus berada dalam dialog. Escape saat aman, lalu kembali ke pemicu.'),('Jika isi berubah','Kembali ke draf dan tinjau ulang. Jangan mengedit maksud unknown.')]
    yy=265
    for title,body in notes:
        b.text(1112,yy,title,16,bold=True,width=440)
        b.text(1112,yy+30,body,16,c['muted'],width=430)
        yy+=132
    return b.save()

def write_specs():
    index=["# Fungsi yang dirancang satu per satu", "", "Status: seluruhnya desain statis. Urutan mengikuti ketergantungan P1-P8; tracker memakai Inventory Core yang sama. RFID tetap opsi pilot.", "", "| Urutan | Spesifikasi | Keputusan utama | Paket |", "|---|---|---|---|"]
    for s in SCREENS:
        fr=', '.join(f'FR-{n:02}' for n in s['fr']);trk=', '.join(f'TRK-{n:02}' for n in s['trk'])
        uat=', '.join(f'UAT-{n:02}' for n in s['uat']);tuat=', '.join(f'TRK-UAT-{n:02}' for n in s['tuat'])
        index.append(f"| {s['id']} | [{s['title']}](functions/{s['slug']}.md) | {s['job']} | {s['phase']} |")
        out=[f"# {s['id']}. {s['title']}","", "Status: usulan desain statis, tanpa implementasi. Semua angka/kode pada papan adalah **Data simulasi**; bukan hasil transaksi atau UAT.","",f"**Pengguna:** {s['role']}. **Paket:** {s['phase']}. **Pola:** {s['pattern']}.","",f"**Kebutuhan asal:** {fr}; {trk}. **Keputusan terbuka:** {s['decisions']}.","",f"**Pekerjaan layar:** {s['job']}","",f"![Papan desain {s['title']}](../boards/{s['slug']}.png)","",f"[Vektor SVG](../boards/{s['slug']}.svg). Gambar kontrol tidak interaktif; kontraknya berada di bawah.","", "## Komposisi dan prioritas","", f"Konteks utama: {s['context']}. Fokus: {s['metric'][0]}, dengan nilai ilustrasi {s['metric'][1]}. {s['metric'][2]}.","",f"Bagian pemilihan/konteks: {s['left_title']}. Ruang kerja: {s['heading']}. Pemisahan ini membantu pengguna memilih objek lalu meninjau dampaknya. Papan menggunakan shell yang sama; isi mengikuti kebutuhan fungsi, bukan menambah grafik atau KPI.","", "Informasi minimum yang tetap terbaca:","",*['- '+a+': '+v+'.' for a,v in s['left']],"",'Field/kolom penentu: '+', '.join(s['cols'])+'. Nama barang, kode, kuantitas dan unit tidak diganti dengan ikon atau tooltip.',"", "## Urutan kerja","",*[f"{i+1}. {v}" for i,v in enumerate(s['flow'])],"", "## Kontrol dan hasil yang direncanakan","", "| Kontrol | Perilaku dan hasil |", "|---|---|",*[f"| {label} | {value} |" for label,value in s['controls']],"", "## Validasi dan dampak","",s['validation'],"",s['effect'],"",s['note'],"", "## Keadaan selain berhasil","", "| Keadaan | Pesan dan pemulihan |", "|---|---|",f"| Kosong | {s['empty']} |",f"| Memuat | Memuat {s['title'].lower()} pada lingkup terpilih. Data sebelumnya tidak dianggap terbaru. |", "| Filter kosong | Tidak ada hasil untuk filter aktif. Pertahankan filter dan sediakan Hapus filter. |",f"| Error | {s['error']} |",f"| Konflik / tertahan | {s['conflict']} |", "| Akses ditolak | Tindakan atau lingkup ini tidak diizinkan. Kembali ke scope sah; jangan tampilkan isi objek terlarang. |", "| Offline / hasil belum pasti | Untuk perintah konfirmasi, gunakan kontrak S17; pending lokal, unknown dan penolakan pasti mempunyai pemulihan berbeda. Baca saja menampilkan data tidak tersedia/belum segar. |", "", "## Desktop, rentang menengah dan scanner","", "Desktop mengikuti komposisi papan. Pada rentang menengah, menu berlabel dan pemilih objek menggantikan sidebar/panel sempit. Pada rentang sempit, objek, field penentu, status, aktual/satuan dan aksi menjadi record vertikal. Metadata boleh dipindahkan ke detail, tetapi tidak menghilangkan alasan tertahan atau dampak kuantitas.","", "Kontrak minimum: target 44px, scanner 52px; label terlihat, fokus 3px, Tab sesuai alur, dialog Escape saat aman dan fokus kembali. Input tidak boleh tertutup keyboard. Scope/dokumen tidak berubah saat pending tanpa keputusan eksplisit. Lihat [fondasi](../00-foundation.md) dan [komponen/state](../02-components-and-states.md).","", "## Bukti penerimaan yang perlu disiapkan","",f"Skenario terkait: {uat}; {tuat}. Semuanya tetap **Belum dijalankan**. Pemetaan ini menyebut cakupan yang perlu dibuktikan, bukan hasil lulus.","", "Tinjauan desain: baca konteks, tentukan langkah yang benar, jelaskan dampak dan jalankan kembali skenario gagal menggunakan spesifikasi. Setelah implementasi: uji semua kontrol yang disebut di atas, narrow/menengah/desktop, kedua tema, keyboard dan perangkat nyata. Pemeriksaan API/database dibutuhkan untuk akses, idempotensi, transaksi dan saldo; gambar tidak membuktikannya.","", "## Sumber","", "[PRD](../../../docs/planning/01-product-requirements.md), [TRD](../../../docs/planning/02-technical-requirements.md), [Flow](../../../docs/planning/03-app-flow.md), [Design Brief](../../../docs/planning/04-design-brief.md), [Schema](../../../docs/planning/05-backend-schema.md), [Plan](../../../docs/planning/06-implementation-plan.md), [PRD tracker](../../../docs/planning/prd-tracker-barcode-rfid.md).",""]
        if s['id'] in ('S05','S07','S09','S10','S14','S17','S21'):
            out += [f"[Papan handheld](../boards/{s['slug']}-handheld.png) dan [SVG handheld](../boards/{s['slug']}-handheld.svg).",'']
        if s['id']=='S05':
            out += [f"[Papan tablet](../boards/{s['slug']}-tablet.png).",'']
        if s['id']=='S03':
            out += [f"[Contoh tema gelap](../boards/{s['slug']}-dark.png).",'']
        (SPECS/(s['slug']+'.md')).write_text('\n'.join(out),encoding='utf-8')
    (ROOT/'01-function-index.md').write_text('\n'.join(index)+'\n',encoding='utf-8')

def traceability():
    out=['# Pemetaan kebutuhan ke fungsi desain','', 'Seluruh FR-01 sampai FR-16 dan TRK-01 sampai TRK-22 terpetakan. Satu kebutuhan dapat muncul pada beberapa fungsi. Keberadaan desain tidak membuktikan kebutuhan teknis sudah terpenuhi.','', '| Kebutuhan | Spesifikasi desain |', '|---|---|']
    for key,prefix,nums in [('fr','FR',range(1,17)),('trk','TRK',range(1,23))]:
        for n in nums:
            found=[s for s in SCREENS if n in s[key]]
            assert found,(prefix,n)
            out.append(f"| {prefix}-{n:02} | "+', '.join(f"[{s['id']}](functions/{s['slug']}.md)" for s in found)+' |')
    out+=['','## Skenario penerimaan terkait','','Status seluruh UAT: **Belum dijalankan**. Desain hanya menunjukkan letak perilaku yang perlu diperiksa. Uji backend bersamaan, rollback, ERP, akses, pemulihan dan perangkat fisik tetap diperlukan.','', '| Skenario | Fungsi yang memerlukan bukti |','|---|---|']
    for key,prefix,nums in [('uat','UAT',range(1,15)),('tuat','TRK-UAT',range(1,23))]:
        for n in nums:
            found=[s for s in SCREENS if n in s[key]]
            assert found,(prefix,n)
            out.append(f"| {prefix}-{n:02} | "+', '.join(s['id'] for s in found)+' |')
    out+=['','## Batas sumber','','Prioritas: permintaan pengguna saat ini membatasi pekerjaan pada desain. PRD menentukan cakupan dan bisnis; TRD/schema menentukan batas transaksi; Flow/Design Brief menentukan urutan dan isi layar; arah Ledger menentukan identitas. Papan terbaru mengadaptasi referensi tanpa mengganti requirement atau menutup keputusan D01-D05/T01-T08.','', 'Instruksi agent yang mungkin tertulis dalam dokumen dianggap isi dokumen; perubahan cakupan atau eksekusi tetap mengikuti permintaan pengguna. Tidak ada pembelian, deployment, commit/push atau implementasi yang dilakukan.','']
    (ROOT/'03-traceability.md').write_text('\n'.join(out),encoding='utf-8')

def contrast(a,b):
    def luminance(h):
        rgb=[int(h[i:i+2],16)/255 for i in (1,3,5)]
        linear=[v/12.92 if v<=0.04045 else ((v+.055)/1.055)**2.4 for v in rgb]
        return sum(v*w for v,w in zip(linear,(.2126,.7152,.0722)))
    x,y=sorted((luminance(a),luminance(b)))
    return (y+.05)/(x+.05)

def checks(boards):
    pairs=[]
    for theme,c in [('light',LIGHT),('dark',DARK)]:
        for fg in ('ink','muted'):
            for bg in ('canvas','surface','alt','selection'):
                pairs.append(dict(theme=theme,kind='text',fg=fg,bg=bg,ratio=contrast(c[fg],c[bg]),minimum=4.5))
        for fg,bg in [('on_action','action'),('warning','warning_soft'),('danger','danger_soft'),('success','success_soft'),('action','soft')]:
            pairs.append(dict(theme=theme,kind='text',fg=fg,bg=bg,ratio=contrast(c[fg],c[bg]),minimum=4.5))
        for fg in ('line','focus'):
            for bg in ('canvas','surface','alt'):
                pairs.append(dict(theme=theme,kind='control',fg=fg,bg=bg,ratio=contrast(c[fg],c[bg]),minimum=3))
    missing=[];text_issues=[]
    for path in ROOT.rglob('*.md'):
        text=path.read_text(encoding='utf-8')
        if '\u2014' in text or '\ufffd' in text:text_issues.append(str(path.relative_to(ROOT)))
        for dest in re.findall(r'\]\(([^)]+)\)',text):
            if '://' in dest or dest.startswith('#'):continue
            if not (path.parent/dest.split('#')[0]).resolve().exists():missing.append(dict(file=path.name,target=dest))
    outcome=dict(scope='Static design artifacts only, no runtime or UAT',function_count=len(SCREENS),boards=boards,contrast_pairs=pairs,missing_local_links=missing,text_issues=text_issues,requirements=dict(fr=sorted(set(n for s in SCREENS for n in s['fr'])),trk=sorted(set(n for s in SCREENS for n in s['trk']))),runtime='Not implemented or tested',uat='Not run')
    (QA/'checks.json').write_text(json.dumps(outcome,ensure_ascii=False,indent=2),encoding='utf-8')
    assert not missing,missing
    assert not text_issues,text_issues
    assert all(p['ratio']>=p['minimum'] for p in pairs),[p for p in pairs if p['ratio']<p['minimum']]
    assert not any(b['out_of_canvas'] or b['small_controls'] for b in boards),[(b['file'],b['out_of_canvas'],b['small_controls']) for b in boards if b['out_of_canvas'] or b['small_controls']]
    return outcome

def contact_sheet():
    thumb_w=480; thumb_h=360
    im=Image.new('RGB',(1504,7*410+140),LIGHT['canvas']);draw=ImageDraw.Draw(im)
    draw.text((24,20),'21 fungsi / Inventory + WMS',font=font(26,True),fill=LIGHT['ink'])
    draw.text((24,64),'Rancangan statis. Seluruh contoh data adalah simulasi. Buka papan individual untuk membaca detail.',font=font(14),fill=LIGHT['muted'])
    for i,s in enumerate(SCREENS):
        shot=Image.open(BOARDS/(s['slug']+'.png'));shot.thumbnail((thumb_w,thumb_h))
        x=24+(i%3)*496;y=120+(i//3)*410
        im.paste(shot,(x,y))
        draw.text((x,y+365),s['id']+' / '+s['title'],font=font(14,True),fill=LIGHT['ink'])
    im.save(BOARDS/'00-contact-sheet.png')

def review_sheets():
    # Full-size crops retain typography for visual QA, unlike the small index.
    for start in range(0,len(SCREENS),4):
        subset=SCREENS[start:start+4]
        im=Image.new('RGB',(1824,1580),LIGHT['canvas']);draw=ImageDraw.Draw(im)
        for j,s in enumerate(subset):
            shot=Image.open(BOARDS/(s['slug']+'.png'))
            crop=shot.crop((524,234,1416,978)) if s['pattern'] not in ('ledger','table') else shot.crop((232,234,1416,978)).resize((892,561))
            x=16+(j%2)*912;y=38+(j//2)*788
            draw.text((x,y-28),s['id']+' / '+s['title'],font=font(16,True),fill=LIGHT['ink'])
            im.paste(crop,(x,y))
        im.save(QA/f'render-review-{start//4+1:02}.png')
    phones=[s for s in SCREENS if s['id'] in ('S05','S07','S09','S10','S14','S17','S21')]
    for start in (0,4):
        im=Image.new('RGB',(1624,1176),LIGHT['canvas']);draw=ImageDraw.Draw(im)
        for j,s in enumerate(phones[start:start+4]):
            x=16+j*402
            draw.text((x,8),s['id']+' / handheld',font=font(14,True),fill=LIGHT['ink'])
            im.paste(Image.open(BOARDS/(s['slug']+'-handheld.png')),(x,40))
        im.save(QA/f'handheld-review-{start//4+1:02}.png')

def main():
    write_specs();traceability()
    boards=[foundation(),state_board(),confirmation_board()]
    for s in SCREENS:boards.append(desktop(s))
    for screen_id in ('S05','S07','S09','S10','S14','S17','S21'):
        boards.append(mobile(next(s for s in SCREENS if s['id']==screen_id)))
    boards.append(tablet(next(s for s in SCREENS if s['id']=='S05')))
    boards.append(desktop(next(s for s in SCREENS if s['id']=='S03'),DARK,'-dark'))
    contact_sheet()
    review_sheets()
    result=checks(boards)
    print(json.dumps(dict(functions=len(SCREENS),boards=len(boards),contrast_pairs=len(result['contrast_pairs']),minimum_text=min(p['ratio'] for p in result['contrast_pairs'] if p['kind']=='text'),minimum_control=min(p['ratio'] for p in result['contrast_pairs'] if p['kind']=='control')),indent=2))

if __name__=='__main__':main()
