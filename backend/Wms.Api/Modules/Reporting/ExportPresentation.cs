using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml.Linq;

namespace Wms.Modules.Reporting;

public static partial class ExportFileWriter
{
    private static string ReportTitle(Dictionary<string, string> meta, bool id) => meta.GetValueOrDefault("ReportType") switch
    {
        "stock" => id ? "Posisi stok" : "Stock positions",
        "ledger" => id ? "Kartu stok" : "Stock movements",
        "count-review" => id ? "Hasil stock opname" : "Stock count results",
        _ => id ? "Laporan operasional" : "Operational report"
    };

    public static byte[] Xlsx(string[] headers, List<string[]> rows, Dictionary<string, string> metadata)
    {
        using var output = new MemoryStream();
        using (var zip = new ZipArchive(output, ZipArchiveMode.Create, true))
        {
            Write("[Content_Types].xml", "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\"><Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/><Default Extension=\"xml\" ContentType=\"application/xml\"/><Override PartName=\"/xl/workbook.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml\"/><Override PartName=\"/xl/styles.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml\"/><Override PartName=\"/xl/worksheets/sheet1.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/><Override PartName=\"/xl/worksheets/sheet2.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml\"/></Types>");
            Write("_rels/.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"xl/workbook.xml\"/></Relationships>");
            Write("xl/workbook.xml", "<workbook xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\" xmlns:r=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships\"><bookViews><workbookView activeTab=\"0\"/></bookViews><sheets><sheet name=\"Data\" sheetId=\"2\" r:id=\"rId2\"/><sheet name=\"Metadata\" sheetId=\"1\" r:id=\"rId1\"/></sheets><definedNames><definedName name=\"_xlnm.Print_Titles\" localSheetId=\"0\">'Data'!$1:$6</definedName></definedNames></workbook>");
            Write("xl/_rels/workbook.xml.rels", "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\"><Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet1.xml\"/><Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet\" Target=\"worksheets/sheet2.xml\"/><Relationship Id=\"rId3\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles\" Target=\"styles.xml\"/></Relationships>");
            var id = metadata.GetValueOrDefault("Locale") == "id";
            Write("xl/styles.xml", WorkbookStyles());
            Write("xl/worksheets/sheet1.xml", Sheet(["Field", "Value"], metadata.Select(x => new[] { Label(x.Key, id), x.Value }).ToList(), false, id, metadata));
            Write("xl/worksheets/sheet2.xml", Sheet(headers, rows, true, id, metadata));
            void Write(string path, string content) { using var writer = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false)); writer.Write(content); }
        }
        return output.ToArray();
    }

    private static string WorkbookStyles() => """
        <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00####;[Red](#,##0.00####);0"/><numFmt numFmtId="165" formatCode="#,##0;[Red](#,##0);0"/></numFmts>
          <fonts count="4">
            <font><sz val="11"/><color rgb="FF182536"/><name val="Arial"/></font>
            <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font>
            <font><b/><sz val="16"/><color rgb="FF182536"/><name val="Arial"/></font>
            <font><sz val="10"/><color rgb="FF53647A"/><name val="Arial"/></font>
          </fonts>
          <fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF214E78"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5FA"/><bgColor indexed="64"/></patternFill></fill></fills>
          <borders count="2"><border/><border><bottom style="thin"><color rgb="FFDCE4EC"/></bottom></border></borders>
          <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
          <cellXfs count="10">
            <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf>
            <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
            <xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>
            <xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center" wrapText="1"/></xf>
            <xf numFmtId="49" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="left" indent="1" vertical="center" wrapText="1"/></xf>
            <xf numFmtId="49" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="left" indent="1" vertical="center" wrapText="1"/></xf>
            <xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>
            <xf numFmtId="164" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>
            <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>
            <xf numFmtId="165" fontId="0" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFill="1" applyBorder="1"><alignment horizontal="right" indent="1" vertical="center"/></xf>
          </cellXfs>
          <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
        </styleSheet>
        """;

    private static string Sheet(string[] headers, List<string[]> rows, bool business, bool id, Dictionary<string, string> meta)
    {
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var data = new XElement(ns + "sheetData");
        XElement Cell(string value, int column, int row, int style, bool number = false)
        {
            var c = new XElement(ns + "c", new XAttribute("r", Column(column) + row), new XAttribute("s", style));
            if (number) c.Add(new XElement(ns + "v", value));
            else { c.Add(new XAttribute("t", "inlineStr")); c.Add(new XElement(ns + "is", new XElement(ns + "t", new XAttribute(XNamespace.Xml + "space", "preserve"), CleanXml(value)))); }
            return c;
        }
        void Intro(int index, string value, int style, int height) => data.Add(new XElement(ns + "row", new XAttribute("r", index), new XAttribute("ht", height), new XAttribute("customHeight", 1), Cell(value, 0, index, style)));
        var start = business ? 6 : 1;
        if (business)
        {
            Intro(2, ReportTitle(meta, id), 2, 28);
            Intro(3, string.Join("  |  ", new[] { meta.GetValueOrDefault("Company"), meta.GetValueOrDefault("WarehouseName"), (id ? "Jumlah baris: " : "Rows: ") + rows.Count }.Where(v => !string.IsNullOrWhiteSpace(v))), 3, 24);
            Intro(4, (id ? "Data per: " : "As of: ") + Display("SnapshotAtUTC", meta.GetValueOrDefault("SnapshotAtUTC", ""), meta, id), 3, 22);
        }
        var widths = headers.Select((h, i) => business ? Math.Clamp(Math.Max(Label(h, id).Length + 3, rows.Take(500).Select(r => r[i].Length + 2).DefaultIfEmpty(12).Max()), Numbers.Contains(h) ? 15 : 18, h == "ItemName" || h == "Reason" ? 48 : 34) : i == 0 ? 30d : 84d).ToArray();
        foreach (var (row, ri) in new[] { headers }.Concat(rows).Select((r, i) => (r, i)))
        {
            var wrappedLines = row.Select((v, ci) => Math.Max(1, (int)Math.Ceiling((v?.Length ?? 0) / widths[ci]))).Max();
            var element = new XElement(ns + "row", new XAttribute("r", start + ri), new XAttribute("ht", ri == 0 ? 34 : Math.Max(24, wrappedLines * 15 + 8)), new XAttribute("customHeight", 1));
            foreach (var (raw, ci) in row.Select((v, i) => (v ?? "", i)))
            {
                var numeric = business && ri > 0 && IsNumber(headers[ci], raw);
                element.Add(Cell(ri == 0 ? Label(raw, id) : raw, ci, start + ri, ri == 0 ? 1 : (numeric ? decimal.Parse(raw, CultureInfo.InvariantCulture) % 1 == 0 ? 8 : 6 : 4) + (ri % 2 == 0 ? 1 : 0), numeric));
            }
            data.Add(element);
        }
        var root = new XElement(ns + "worksheet",
            new XElement(ns + "sheetPr", new XElement(ns + "pageSetUpPr", new XAttribute("fitToPage", 1))),
            new XElement(ns + "sheetViews", new XElement(ns + "sheetView", new XAttribute("workbookViewId", 0), new XAttribute("showGridLines", 0), new XElement(ns + "pane", new XAttribute("ySplit", start), new XAttribute("topLeftCell", "A" + (start + 1)), new XAttribute("activePane", "bottomLeft"), new XAttribute("state", "frozen")))),
            new XElement(ns + "cols", widths.Select((w, i) => new XElement(ns + "col", new XAttribute("min", i + 1), new XAttribute("max", i + 1), new XAttribute("width", w), new XAttribute("customWidth", 1)))), data,
            new XElement(ns + "autoFilter", new XAttribute("ref", $"A{start}:{Column(headers.Length - 1)}{rows.Count + start}")));
        if (business && headers.Length > 1) root.Add(new XElement(ns + "mergeCells", Enumerable.Range(2, 3).Select(r => new XElement(ns + "mergeCell", new XAttribute("ref", $"A{r}:{Column(headers.Length - 1)}{r}")))));
        root.Add(new XElement(ns + "pageMargins", new XAttribute("left", 0.3), new XAttribute("right", 0.3), new XAttribute("top", 0.5), new XAttribute("bottom", 0.5), new XAttribute("header", 0.2), new XAttribute("footer", 0.2)),
            new XElement(ns + "pageSetup", new XAttribute("paperSize", 9), new XAttribute("orientation", headers.Length > 6 ? "landscape" : "portrait"), new XAttribute("fitToWidth", 1), new XAttribute("fitToHeight", 0)),
            new XElement(ns + "headerFooter", new XElement(ns + "oddFooter", "&L" + meta.GetValueOrDefault("ExportId", "") + "&R&P / &N")));
        return new XDocument(root).ToString();
    }

    private static string Display(string key, string value, Dictionary<string, string> meta, bool id)
    {
        if (string.IsNullOrWhiteSpace(value)) return "-";
        if ((key.EndsWith("At") || key.EndsWith("AtUTC")) && DateTimeOffset.TryParse(value, CultureInfo.InvariantCulture, DateTimeStyles.None, out var date))
        {
            try { date = key.EndsWith("UTC") ? date.ToUniversalTime() : TimeZoneInfo.ConvertTime(date, TimeZoneInfo.FindSystemTimeZoneById(meta.GetValueOrDefault("WarehouseTimeZone", "UTC"))); }
            catch (TimeZoneNotFoundException) { date = date.ToUniversalTime(); }
            return date.ToString("dd MMM yyyy, HH:mm:ss zzz", CultureInfo.GetCultureInfo(id ? "id-ID" : "en-GB"));
        }
        if ((key.EndsWith("Date") || key == "Date") && DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day)) return day.ToString("dd MMM yyyy", CultureInfo.GetCultureInfo(id ? "id-ID" : "en-GB"));
        if (Numbers.Contains(key) && decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount)) return amount.ToString("#,##0.######", CultureInfo.GetCultureInfo(id ? "id-ID" : "en-GB"));
        if (key == "Scope") return value switch { "all" => id ? "Semua hasil filter" : "All matching results", "selected" => id ? "Pilihan eksplisit" : "Selected records", _ => value };
        if (key is not ("Condition" or "Hold" or "Status" or "SourceStatus" or "Frozen" or "Pickable" or "Descending")) return value;
        return value switch { "true" or "True" => id ? "Ya" : "Yes", "false" or "False" => id ? "Tidak" : "No", "complete" => id ? "Selesai" : "Complete", "partial" => id ? "Sebagian" : "Partial", "closed" => id ? "Ditutup" : "Closed", "good" => id ? "Bagus" : "Good", "bad" => id ? "Tidak bagus" : "Not good", "unassessed" => id ? "Belum diperiksa" : "Not assessed", "awaiting-qc" => id ? "Menunggu QC" : "Awaiting QC", "good / no hold" => id ? "Bagus / tanpa penahanan" : "Good / no hold", "none" => id ? "Tidak ada" : "None", _ => value };
    }

    public static byte[] Pdf(string title, string[] headers, List<string[]> rows, Dictionary<string, string> metadata)
    {
        var fontPath = Environment.GetEnvironmentVariable("WMS_EXPORT_FONT") ?? new[] { Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Fonts), "arial.ttf"), "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf" }.FirstOrDefault(File.Exists);
        if (fontPath is null || !File.Exists(fontPath)) throw new InvalidOperationException("export-font-unavailable: install an Unicode TrueType font or configure WMS_EXPORT_FONT");
        var font = new TrueType(File.ReadAllBytes(fontPath));
        var id = metadata.GetValueOrDefault("Locale") == "id";
        const int width = 595, height = 842;
        const double margin = 36, bottom = 790, lineHeight = 12;
        var pages = new List<StringBuilder>(); StringBuilder page = null!; double y = 0;
        string ink = "0.09 0.15 0.22", muted = "0.32 0.39 0.48", blue = "0.13 0.31 0.47";
        double Measure(string value, double size) => value.EnumerateRunes().Sum(r => font.Width(r.Value) * size / 1000d);
        void Text(string value, double x, double top, double size = 9, string? color = null) => page.Append(CultureInfo.InvariantCulture, $"{color ?? ink} rg BT /F1 {size} Tf 1 0 0 1 {x:0.##} {height - top:0.##} Tm <{font.Encode(value)}> Tj ET\n");
        void Box(double x, double top, double w, double h, string color) => page.Append(CultureInfo.InvariantCulture, $"{color} rg {x:0.##} {height - top - h:0.##} {w:0.##} {h:0.##} re f\n");
        void Rule(double top) => Box(margin, top, width - margin * 2, 0.6, "0.83 0.87 0.91");
        string[] Wrap(string value, double available, double size = 9)
        {
            var lines = new List<string>();
            foreach (var paragraph in value.Replace("\r", "").Split('\n'))
            {
                var line = "";
                foreach (var word in paragraph.Split(' '))
                {
                    var candidate = line.Length > 0 ? line + " " + word : word;
                    if (Measure(candidate, size) <= available) { line = candidate; continue; }
                    if (line.Length > 0) { lines.Add(line); line = ""; }
                    foreach (var rune in word.EnumerateRunes())
                    {
                        if (line.Length > 0 && Measure(line + rune, size) > available) { lines.Add(line); line = ""; }
                        line += rune;
                    }
                }
                lines.Add(line);
            }
            return lines.ToArray();
        }
        void NewPage()
        {
            page = new StringBuilder(); pages.Add(page);
            Text(metadata.GetValueOrDefault("Company", "") is { Length: > 0 } company ? company : "Inventory / WMS", margin, 40, 10, blue);
            y = 70;
            foreach (var line in Wrap(title, width - margin * 2, 19)) { Text(line, margin, y, 19); y += 24; }
            Text(metadata.GetValueOrDefault("WarehouseName", ""), margin, y + 2, 10, muted);
            Rule(y + 16); y += 34;
        }
        void Ensure(double needed) { if (y + needed > bottom) NewPage(); }
        void Heading(string name) { Ensure(42); Text(name, margin, y, 11, blue); y += 20; }
        void Pairs(IEnumerable<KeyValuePair<string, string>> values)
        {
            var items = values.ToArray(); var colWidth = (width - margin * 2 - 24) / 2;
            for (var i = 0; i < items.Length; i += 2)
            {
                var pair = items.Skip(i).Take(2).ToArray();
                var lines = pair.Select(p => Wrap(Display(p.Key, p.Value, metadata, id), colWidth)).ToArray();
                var max = lines.Max(l => l.Length);
                for (var start = 0; start < max;)
                {
                    Ensure(38); var count = Math.Min(max - start, (int)((bottom - y - 18) / lineHeight));
                    for (var c = 0; c < pair.Length; c++)
                    {
                        var x = margin + c * (colWidth + 24);
                        Text(Label(pair[c].Key, id), x, y, 8, muted);
                        for (var l = 0; l < count && start + l < lines[c].Length; l++) Text(lines[c][start + l], x, y + 15 + l * lineHeight);
                    }
                    y += 18 + count * lineHeight + 10; start += count;
                }
            }
        }
        void Table(int[] indices, List<string[]> source)
        {
            var weights = indices.Select(i => headers[i] == "ItemName" || headers[i] == "Description" ? 2.8 : Numbers.Contains(headers[i]) ? 1d : 1.6).ToArray();
            var sizes = weights.Select(w => (width - margin * 2) * w / weights.Sum()).ToArray();
            void Header()
            {
                string TableLabel(string key) => key switch { "Expected" => id ? "Saldo beku" : "Frozen balance", "Counted" => id ? "Fisik" : "Counted", "OrderedOrSent" => id ? "Pesanan / kirim" : "Ordered / sent", _ => Label(key, id) };
                var labels = indices.Select((i, c) => Wrap(TableLabel(headers[i]), sizes[c] - 14, 8)).ToArray();
                var h = labels.Max(l => l.Length) * 11 + 16;
                Box(margin, y - 11, width - margin * 2, h, blue);
                double x = margin;
                for (var c = 0; c < indices.Length; c++) { for (var l = 0; l < labels[c].Length; l++) Text(labels[c][l], x + 7, y + l * 11, 8, "1 1 1"); x += sizes[c]; }
                y += h;
            }
            Ensure(90); Header();
            for (var rowIndex = 0; rowIndex < source.Count; rowIndex++)
            {
                var row = source[rowIndex];
                var cells = indices.Select((i, c) => Wrap(Display(headers[i], row[i], metadata, id), sizes[c] - 14)).ToArray();
                var lines = cells.Max(c => c.Length); var rowHeight = lines * lineHeight + 14;
                if (y + rowHeight > bottom && rowHeight < bottom - 145) { NewPage(); Header(); }
                for (var start = 0; start < lines;)
                {
                    if (y + 26 > bottom) { NewPage(); Header(); }
                    var count = Math.Min(lines - start, Math.Max(1, (int)((bottom - y - 14) / lineHeight)));
                    var h = count * lineHeight + 14;
                    if (rowIndex % 2 == 0) Box(margin, y - 11, width - margin * 2, h, "0.95 0.97 0.99");
                    double x = margin;
                    for (var c = 0; c < cells.Length; c++)
                    {
                        for (var l = 0; l < count && start + l < cells[c].Length; l++)
                        {
                            var value = cells[c][start + l];
                            Text(value, Numbers.Contains(headers[indices[c]]) ? x + sizes[c] - 7 - Measure(value, 9) : x + 7, y + l * lineHeight);
                        }
                        x += sizes[c];
                    }
                    y += h; start += count; Rule(y - 11);
                }
            }
            y += 16;
        }
        NewPage();
        var contextKeys = new[] { "SourceReference", "DocumentDate", "TransactionId", "SourceStatus", "FromWarehouse", "ToWarehouse" };
        Pairs(contextKeys.Where(metadata.ContainsKey).Where(k => !string.IsNullOrWhiteSpace(metadata[k])).Select(k => KeyValuePair.Create(k, metadata[k])));
        if (headers.Length <= 6) Table(Enumerable.Range(0, headers.Length).ToArray(), rows);
        else
        {
            var businessKeys = new HashSet<string>(["SKU", "ItemName", "Location", "Expected", "Counted", "Difference", "Quantity", "Actual", "Ordered", "Prepared", "Received", "Remaining", "Sent", "Shipped", "OrderedOrSent", "Unit", "Count"]);
            var main = Enumerable.Range(0, headers.Length).Where(i => businessKeys.Contains(headers[i])).ToArray();
            if (main.Length > 7) main = main.Take(6).Append(Array.IndexOf(headers, "Unit")).Where(i => i >= 0).Distinct().ToArray();
            if (main.Length == 0) main = Enumerable.Range(0, Math.Min(5, headers.Length)).ToArray();
            for (var r = 0; r < rows.Count; r++)
            {
                Heading((id ? "Rincian barang" : "Item details") + (rows.Count > 1 ? $" {r + 1}" : ""));
                Table(main, [rows[r]]);
                Pairs(Enumerable.Range(0, headers.Length).Where(i => !main.Contains(i)).Select(i => KeyValuePair.Create(headers[i], rows[r][i])));
            }
        }
        if (metadata.TryGetValue("Signatures", out var signatures) && !string.IsNullOrWhiteSpace(signatures))
        {
            Ensure(106); Heading(id ? "Pengesahan / serah terima" : "Approval / handover");
            foreach (var line in Wrap(signatures, width - margin * 2)) { Text(line, margin, y + 36); y += lineHeight; }
            y += 54;
        }
        Heading(id ? "Informasi ekspor" : "Export information");
        var audit = metadata.Where(p => !contextKeys.Contains(p.Key) && p.Key != "Signatures" && !string.IsNullOrWhiteSpace(p.Value));
        var auditText = string.Join("  |  ", audit.Select(p => Label(p.Key, id) + ": " + Display(p.Key, p.Value, metadata, id)));
        foreach (var line in Wrap(auditText, width - margin * 2, 7.5)) { Ensure(12); Text(line, margin, y, 7.5, muted); y += 11; }
        for (var i = 0; i < pages.Count; i++)
        {
            page = pages[i]; Rule(806);
            Text((id ? "ID ekspor: " : "Export ID: ") + metadata.GetValueOrDefault("ExportId", ""), margin, 821, 7.5, muted);
            var number = $"{i + 1} / {pages.Count}"; Text(number, width - margin - Measure(number, 8), 821, 8, muted);
        }
        return font.BuildPdf(pages, width, height);
    }
}
