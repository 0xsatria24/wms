using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;

namespace Wms.Modules.Reporting;

public static partial class ExportFileWriter
{
    private static readonly HashSet<string> Numbers = new(StringComparer.OrdinalIgnoreCase)
    { "OnHand", "Reserved", "Available", "QuantityDelta", "ConversionFactor", "Expected", "Counted", "Difference", "Quantity", "Actual", "Ordered", "Received", "Remaining", "Sent", "Shipped", "Picked", "Prepared", "InTransit", "Delta", "Count", "OrderedOrSent", "Selisih", "Dihitung", "Dipesan", "Tersedia", "Fisik", "Jumlah" };
    private static readonly Dictionary<string, string> Indonesian = new(StringComparer.OrdinalIgnoreCase)
    {
        ["WarehouseId"] = "ID gudang", ["WarehouseName"] = "Nama gudang", ["PositionId"] = "ID posisi", ["SKU"] = "SKU", ["ItemName"] = "Nama barang", ["Location"] = "Lokasi", ["Condition"] = "Kondisi", ["Hold"] = "Penahanan", ["Frozen"] = "Dibekukan", ["Pickable"] = "Dapat diambil", ["OnHand"] = "Stok fisik", ["Reserved"] = "Dipesan", ["Available"] = "Tersedia", ["Unit"] = "Satuan", ["LastPostedMovementAt"] = "Mutasi terakhir tercatat", ["EntryId"] = "ID entri", ["TransactionId"] = "ID transaksi", ["SourceReference"] = "Referensi sumber", ["MovementType"] = "Jenis mutasi", ["QuantityDelta"] = "Perubahan jumlah", ["ConversionFactor"] = "Faktor konversi", ["OccurredAt"] = "Waktu kejadian", ["PostedAt"] = "Waktu pembukuan", ["ActorId"] = "ID pelaku", ["ActorName"] = "Nama pelaku", ["Reason"] = "Alasan", ["Expected"] = "Saldo saat pembekuan", ["Counted"] = "Hasil hitung", ["Difference"] = "Selisih", ["Quantity"] = "Jumlah", ["Actual"] = "Aktual", ["Ordered"] = "Jumlah pesanan", ["Received"] = "Diterima", ["Remaining"] = "Sisa", ["Sent"] = "Dikirim", ["Shipped"] = "Telah dikirim", ["Picked"] = "Diambil", ["Prepared"] = "Disiapkan", ["InTransit"] = "Dalam perjalanan", ["OrderedOrSent"] = "Dipesan atau dikirim", ["Status"] = "Status", ["DocumentId"] = "ID dokumen", ["TaskId"] = "ID tugas", ["Counter"] = "Penghitung", ["CounterId"] = "ID penghitung", ["ApprovedAt"] = "Waktu persetujuan", ["SubmittedAt"] = "Waktu pengajuan", ["CompletedAt"] = "Waktu selesai", ["ExportId"] = "ID ekspor", ["ReportType"] = "Jenis laporan", ["TemplateVersion"] = "Versi template", ["Company"] = "Perusahaan", ["CompanyName"] = "Nama perusahaan", ["SnapshotAtUTC"] = "Waktu snapshot UTC", ["GeneratedAtUTC"] = "Waktu pembuatan UTC", ["WarehouseTimeZone"] = "Zona waktu gudang", ["Scope"] = "Lingkup", ["Locale"] = "Bahasa", ["RowCount"] = "Jumlah baris", ["DocumentVersion"] = "Versi dokumen", ["SourceVersion"] = "Versi sumber", ["GeneratedBy"] = "Dibuat oleh", ["From"] = "Dari", ["To"] = "Sampai", ["Query"] = "Pencarian", ["Field"] = "Kolom", ["Value"] = "Nilai", ["Reference"] = "Referensi", ["Description"] = "Keterangan", ["Source"] = "Sumber", ["Type"] = "Jenis", ["Version"] = "Versi", ["CountedBy"] = "Dihitung oleh", ["ApprovedBy"] = "Disetujui oleh", ["AdjustmentReference"] = "Referensi penyesuaian", ["ScheduledDate"] = "Tanggal rencana", ["DocumentDate"] = "Tanggal dokumen"
    };
    private static readonly Dictionary<string, string> ExtraIndonesian = new()
    {
        ["Receipt"] = "Penerimaan", ["ReceiptHeader"] = "Dokumen penerimaan", ["Line"] = "Baris penerimaan", ["Task"] = "Tugas", ["Order"] = "Pesanan", ["Document"] = "Dokumen", ["Counter"] = "Penghitung", ["Approver"] = "Penyetuju", ["Date"] = "Tanggal", ["Count"] = "Hitungan fisik", ["FromWarehouse"] = "Gudang asal", ["ToWarehouse"] = "Gudang tujuan", ["SourceStatus"] = "Status dokumen", ["PeriodFrom"] = "Periode dari", ["PeriodTo"] = "Periode sampai", ["Sort"] = "Urutan", ["Descending"] = "Urutan menurun", ["CumulativeAtSnapshot"] = "Total pada snapshot", ["RemainingAtSnapshot"] = "Sisa pada snapshot", ["TransactionIds"] = "Referensi transaksi", ["Signatures"] = "Pengesahan"
    };
    private static string Label(string value, bool id) => id && (Indonesian.TryGetValue(value, out var translated) || ExtraIndonesian.TryGetValue(value, out translated)) ? translated : System.Text.RegularExpressions.Regex.Replace(value, "(?<=[a-z])(?=[A-Z])", " ");

    public static byte[] Csv(string[] headers, List<string[]> rows, Dictionary<string, string> metadata)
    {
        var text = new StringBuilder();
        text.AppendLine(string.Join(',', headers.Concat(metadata.Keys.Select(key => headers.Contains(key, StringComparer.OrdinalIgnoreCase) ? "ExportMetadata" + key : key)).Select(Quote)));
        foreach (var row in rows)
            text.AppendLine(string.Join(',', row.Select((v, i) => Quote(IsNumber(headers[i], v) ? v : SafeText(v))).Concat(metadata.Values.Select(v => Quote(SafeText(v))))));
        return [0xEF, 0xBB, 0xBF, .. Encoding.UTF8.GetBytes(text.ToString().Replace("\r\n", "\n").Replace("\n", "\r\n"))];
    }

    internal static string SafeText(string value)
    {
        var trimmed = value.TrimStart();
        return (trimmed.Length > 0 && "=+-@".Contains(trimmed[0])) || value.StartsWith('\t') || value.StartsWith('\r') || value.StartsWith('\n') ? "'" + value : value;
    }
    private static string Quote(string value) => "\"" + value.Replace("\"", "\"\"") + "\"";
    private static bool IsNumber(string header, string value) => Numbers.Contains(header) && decimal.TryParse(value, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out _) && value.Count(char.IsDigit) <= 15;

    private static string CleanXml(string value) => new(value.Where(c => c >= ' ' || c is '\t' or '\r' or '\n').ToArray());
    private static string Column(int index) { var result = ""; for (index++; index > 0; index = (index - 1) / 26) result = (char)('A' + (index - 1) % 26) + result; return result; }

    private sealed class TrueType
    {
        private readonly byte[] bytes;
        private readonly Dictionary<string, int> tables = new();
        private readonly Dictionary<int, ushort> cids = new();
        private readonly List<int> characters = [0];
        private readonly int cmap, units, metrics;
        public TrueType(byte[] value)
        {
            bytes = value;
            for (var i = 0; i < U16(4); i++) { var at = 12 + i * 16; tables[Encoding.ASCII.GetString(bytes, at, 4)] = (int)U32(at + 8); }
            if (!tables.ContainsKey("glyf")) throw new InvalidOperationException("export-font-requires-truetype-glyf");
            var start = tables["cmap"]; int selected = 0;
            for (var i = 0; i < U16(start + 2); i++) { var sub = start + (int)U32(start + 4 + i * 8 + 4); var format = U16(sub); if (format == 12 || format == 4 && selected == 0) selected = sub; }
            cmap = selected; units = U16(tables["head"] + 18); metrics = U16(tables["hhea"] + 34);
        }
        private int U16(int at) => (bytes[at] << 8) | bytes[at + 1];
        private uint U32(int at) => ((uint)U16(at) << 16) | (uint)U16(at + 2);
        private int Glyph(int code)
        {
            if (U16(cmap) == 12)
            {
                var groups = (int)U32(cmap + 12);
                for (var i = 0; i < groups; i++) { var at = cmap + 16 + i * 12; if (code >= U32(at) && code <= U32(at + 4)) return (int)(U32(at + 8) + code - U32(at)); }
                return 0;
            }
            var segments = U16(cmap + 6) / 2; var ends = cmap + 14; var starts = ends + 2 * segments + 2; var deltas = starts + 2 * segments; var ranges = deltas + 2 * segments;
            for (var i = 0; i < segments; i++)
            {
                if (code < U16(starts + i * 2) || code > U16(ends + i * 2)) continue;
                var offset = U16(ranges + i * 2); var delta = U16(deltas + i * 2);
                if (offset == 0) return (code + delta) & 65535;
                var glyph = U16(ranges + i * 2 + offset + 2 * (code - U16(starts + i * 2))); return glyph == 0 ? 0 : (glyph + delta) & 65535;
            }
            return 0;
        }
        public int Width(int code) => U16(tables["hmtx"] + Math.Min(Glyph(code), metrics - 1) * 4) * 1000 / units;
        public string Encode(string value)
        {
            var result = new StringBuilder();
            foreach (var rune in value.EnumerateRunes())
            {
                if (!cids.TryGetValue(rune.Value, out var cid)) { cid = checked((ushort)characters.Count); cids[rune.Value] = cid; characters.Add(rune.Value); }
                result.Append(cid.ToString("X4", CultureInfo.InvariantCulture));
            }
            return result.ToString();
        }
        public byte[] BuildPdf(List<StringBuilder> pages, int width, int height)
        {
            var objects = new List<byte[]>();
            int Add(string s) { objects.Add(Encoding.ASCII.GetBytes(s)); return objects.Count; }
            int Stream(byte[] data, string extra = "") { using var ms = new MemoryStream(); ms.Write(Encoding.ASCII.GetBytes($"<< /Length {data.Length} {extra} >>\nstream\n")); ms.Write(data); ms.Write(Encoding.ASCII.GetBytes("\nendstream")); objects.Add(ms.ToArray()); return objects.Count; }
            Add("<< /Type /Catalog /Pages 2 0 R >>"); Add("");
            var fontFile = Stream(bytes, $"/Length1 {bytes.Length}");
            var descriptor = Add($"<< /Type /FontDescriptor /FontName /ExportFont /Flags 32 /FontBBox [-1200 -1200 3000 3000] /ItalicAngle 0 /Ascent 1000 /Descent -300 /CapHeight 700 /StemV 80 /FontFile2 {fontFile} 0 R >>");
            var glyphs = new byte[characters.Count * 2];
            for (var i = 0; i < characters.Count; i++) { var gid = Glyph(characters[i]); glyphs[i * 2] = (byte)(gid >> 8); glyphs[i * 2 + 1] = (byte)gid; }
            var glyphMap = Stream(glyphs);
            var widths = string.Join(' ', characters.Select(Width));
            var cidFont = Add($"<< /Type /Font /Subtype /CIDFontType2 /BaseFont /ExportFont /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor {descriptor} 0 R /CIDToGIDMap {glyphMap} 0 R /W [0 [{widths}]] >>");
            var unicode = new StringBuilder("/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /ExportUnicode def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n");
            for (var start = 1; start < characters.Count; start += 100)
            {
                var end = Math.Min(start + 100, characters.Count); unicode.AppendLine($"{end - start} beginbfchar");
                for (var i = start; i < end; i++) unicode.AppendLine($"<{i:X4}> <{Convert.ToHexString(Encoding.BigEndianUnicode.GetBytes(char.ConvertFromUtf32(characters[i])))}>");
                unicode.AppendLine("endbfchar");
            }
            unicode.Append("endcmap CMapName currentdict /CMap defineresource pop end end");
            var unicodeId = Stream(Encoding.ASCII.GetBytes(unicode.ToString()));
            var fontId = Add($"<< /Type /Font /Subtype /Type0 /BaseFont /ExportFont /Encoding /Identity-H /DescendantFonts [{cidFont} 0 R] /ToUnicode {unicodeId} 0 R >>");
            var pageIds = new List<int>();
            foreach (var page in pages) { var content = Stream(Encoding.ASCII.GetBytes(page.ToString())); pageIds.Add(Add($"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {width} {height}] /Resources << /Font << /F1 {fontId} 0 R >> >> /Contents {content} 0 R >>")); }
            objects[1] = Encoding.ASCII.GetBytes($"<< /Type /Pages /Count {pages.Count} /Kids [{string.Join(' ', pageIds.Select(i => $"{i} 0 R"))}] >>");
            using var result = new MemoryStream(); var offsets = new List<long> { 0 };
            void Put(string value) => result.Write(Encoding.ASCII.GetBytes(value));
            Put("%PDF-1.7\n");
            for (var i = 0; i < objects.Count; i++) { offsets.Add(result.Position); Put($"{i + 1} 0 obj\n"); result.Write(objects[i]); Put("\nendobj\n"); }
            var xref = result.Position; Put($"xref\n0 {objects.Count + 1}\n0000000000 65535 f \n");
            foreach (var offset in offsets.Skip(1)) Put($"{offset:0000000000} 00000 n \n");
            Put($"trailer << /Size {objects.Count + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n");
            return result.ToArray();
        }
    }
}
