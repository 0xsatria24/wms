using System.IO.Compression;
using System.Text;
using System.Xml.Linq;
using Wms.Modules.Reporting;
using Xunit;

namespace Wms.Tests;

public sealed class ExportFileWriterTests
{
    [Fact]
    public void CsvMetadataCannotOverwriteBusinessActorOrPositionLocation()
    {
        var csv = Encoding.UTF8.GetString(ExportFileWriter.Csv(["ActorId", "Location"], [["operator", "A-01"]], new() { ["ActorId"] = "admin", ["Location"] = "" }))[1..];
        Assert.StartsWith("\"ActorId\",\"Location\",\"ExportMetadataActorId\",\"ExportMetadataLocation\"", csv);
        Assert.Contains("\"operator\",\"A-01\",\"admin\",\"\"", csv);
    }
    [Fact]
    public void CsvNeutralizesTextFormulasWithoutChangingRealNegativeDeltas()
    {
        var result = ExportFileWriter.Csv(["SKU", "ItemName", "QuantityDelta"], [["000123", " \t=HYPERLINK(\"x\")", "-2.5"], ["ABC", "café,\"quoted\"\nline", "0"]], new() { ["ExportId"] = "-unsafe" });
        Assert.Equal(new byte[] { 0xef, 0xbb, 0xbf }, result[..3]);
        var csv = Encoding.UTF8.GetString(result[3..]);
        Assert.Contains("\"000123\"", csv);
        Assert.Contains("\"' \t=HYPERLINK(\"\"x\"\")\"", csv);
        Assert.Contains("\"-2.5\"", csv);
        Assert.DoesNotContain("\"'-2.5\"", csv);
        Assert.Contains("\"'-unsafe\"", csv);
        Assert.Contains("café,\"\"quoted\"\"\r\nline", csv);
    }

    [Fact]
    public void WorkbookKeepsIdentifiersAndHighPrecisionAsTextAndSafeAmountsNumeric()
    {
        var result = ExportFileWriter.Xlsx(["SKU", "QuantityDelta", "OnHand", "ItemName"], [["000123", "-2.5", "123456789012.123456", "=SUM(1,1)"]], new() { ["ExportId"] = "ABCDEFGHIJKLMNOP" });
        using var archive = new ZipArchive(new MemoryStream(result));
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var sheet = XDocument.Load(archive.GetEntry("xl/worksheets/sheet2.xml")!.Open());
        var cells = sheet.Descendants(ns + "c").ToDictionary(c => c.Attribute("r")!.Value);
        Assert.Equal("inlineStr", cells["A7"].Attribute("t")!.Value);
        Assert.Equal("000123", cells["A7"].Value);
        Assert.Null(cells["B7"].Attribute("t"));
        Assert.Equal("-2.5", cells["B7"].Value);
        Assert.Equal("inlineStr", cells["C7"].Attribute("t")!.Value);
        Assert.Equal("123456789012.123456", cells["C7"].Value);
        Assert.Equal("=SUM(1,1)", cells["D7"].Value);
        Assert.Empty(sheet.Descendants(ns + "f"));
        Assert.NotNull(sheet.Root!.Element(ns + "autoFilter"));
        Assert.NotNull(sheet.Descendants(ns + "pane").Single());
        Assert.Contains("Metadata", Read(archive, "xl/workbook.xml"));
        Assert.Contains("ABCDEFGHIJKLMNOP", Read(archive, "xl/worksheets/sheet1.xml"));
        var artifact = Environment.GetEnvironmentVariable("WMS_EXPORT_TEST_ARTIFACT");
        if (!string.IsNullOrEmpty(artifact)) File.WriteAllBytes(Path.ChangeExtension(artifact, ".xlsx"), result);
    }

    [Fact]
    public void WorkbookOpensOnBusinessDataWithReadableColumnsAndPrintableFrozenHeaders()
    {
        var result = ExportFileWriter.Xlsx(["SKU", "ItemName", "Quantity", "Unit"], [["000123", "A warehouse item with a descriptive name", "9.5", "kg"]], new() { ["ReportType"] = "stock", ["WarehouseName"] = "Main Warehouse", ["Locale"] = "id" });
        using var archive = new ZipArchive(new MemoryStream(result));
        XNamespace ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
        var workbook = XDocument.Parse(Read(archive, "xl/workbook.xml"));
        Assert.Equal("Data", workbook.Descendants(ns + "sheet").First().Attribute("name")!.Value);
        Assert.Contains("Print_Titles", workbook.ToString());
        var sheet = XDocument.Parse(Read(archive, "xl/worksheets/sheet2.xml"));
        Assert.Equal("A6:D7", sheet.Descendants(ns + "autoFilter").Single().Attribute("ref")!.Value);
        Assert.Equal("6", sheet.Descendants(ns + "pane").Single().Attribute("ySplit")!.Value);
        Assert.Contains("Posisi stok", sheet.ToString());
        Assert.Contains("Main Warehouse", sheet.ToString());
        Assert.True(sheet.Descendants(ns + "col").Select(x => x.Attribute("width")!.Value).Distinct().Count() > 1);
        Assert.NotNull(sheet.Root!.Element(ns + "pageSetup"));
        var styles = XDocument.Parse(Read(archive, "xl/styles.xml"));
        Assert.NotEmpty(styles.Descendants(ns + "b"));
        Assert.NotEmpty(styles.Descendants(ns + "numFmt"));
        Assert.Contains(styles.Descendants(ns + "patternFill"), x => (string?)x.Attribute("patternType") == "solid");
    }

    [Fact]
    public void IndonesianWorkbookLocalizesLabelsButRetainsNumericTypesAndSourceValues()
    {
        var result = ExportFileWriter.Xlsx(["OnHand", "OrderedOrSent", "WarehouseName"], [["2.5", "10", "Main Warehouse"]], new() { ["Locale"] = "id" });
        using var archive = new ZipArchive(new MemoryStream(result));
        var data = Read(archive, "xl/worksheets/sheet2.xml");
        Assert.Contains("Stok fisik", data);
        Assert.Contains("Dipesan atau dikirim", data);
        Assert.Contains("Main Warehouse", data);
        Assert.Contains("<v>2.5</v>", data);
    }

    [Fact]
    public void PdfEmbedsUnicodeFontAndPaginatesAllRowsWithAnExtractionMap()
    {
        var rows = Enumerable.Range(0, 100).Select(i => new[] { $"ROW-{i:000}", i == 0 ? "complete" : "café Ω Ж " + new string('x', 110) }).ToList();
        var result = ExportFileWriter.Pdf("Bukti penerimaan", ["Reference", "Description"], rows, new() { ["ExportId"] = "ABCDEFGHIJKLMNOP", ["Status"] = "Posted" });
        var pdf = Encoding.Latin1.GetString(result);
        Assert.StartsWith("%PDF-1.7", pdf);
        Assert.EndsWith("%%EOF\n", pdf);
        Assert.Contains("/FontFile2", pdf);
        Assert.Contains("/CIDToGIDMap", pdf);
        Assert.Contains("/ToUnicode", pdf);
        Assert.Contains("<00E9>", pdf);
        Assert.Contains("<03A9>", pdf);
        Assert.Contains("<0416>", pdf);
        Assert.True(System.Text.RegularExpressions.Regex.Matches(pdf, @"/Type /Page /Parent").Count > 1);
        var artifact = Environment.GetEnvironmentVariable("WMS_EXPORT_TEST_ARTIFACT");
        if (!string.IsNullOrEmpty(artifact)) File.WriteAllBytes(artifact, result);
    }

    private static string Read(ZipArchive archive, string path) { using var reader = new StreamReader(archive.GetEntry(path)!.Open()); return reader.ReadToEnd(); }

    [Theory]
    [InlineData("manual-receive")]
    [InlineData("count-report")]
    [InlineData("packing")]
    [InlineData("count-sheet")]
    public void OperationalDocumentsRetainPortraitLayoutAndProducePreviewFixtures(string type)
    {
        string[] headers; List<string[]> rows;
        var title = "Bukti penerimaan manual";
        if (type == "count-report")
        {
            title = "Berita acara opname";
            headers = ["Task", "SKU", "ItemName", "Location", "Condition", "Expected", "Counted", "Difference", "Unit", "Counter", "Status", "Reason", "SubmittedAt", "Approver", "TransactionId", "ApprovedAt"];
            rows = [["COUNT-0000000001", "000123", "Bahan kilogram", "A-01", "good / no hold", "125.5", "124", "-1.5", "kg", "operator", "Disetujui; lokasi masih dibekukan", "Kemasan rusak saat pengecekan fisik.", "2026-11-05T02:00:00Z", "supervisor", "TX-000000000001", "2026-11-05T03:00:00Z"]];
        }
        else if (type == "packing")
        {
            title = "Rencana packing - bukan bukti pengiriman";
            headers = ["Order", "SKU", "ItemName", "Ordered", "Prepared", "Shipped", "Remaining", "Unit"];
            rows = [["ORDER-0000000001", "000123", "Bahan kilogram", "100", "25.5", "0", "100", "kg"]];
        }
        else if (type == "count-sheet")
        {
            title = "Lembar hitung tanpa saldo";
            headers = ["Task", "SKU", "ItemName", "Location", "Condition", "Unit", "Count", "Counter", "Date"];
            rows = [["COUNT-0000000001", "000123", "Bahan kilogram", "A-01", "good / no hold", "kg", "", "", ""]];
        }
        else
        {
            headers = ["Receipt", "Line", "TransactionId", "SKU", "ItemName", "Location", "Quantity", "Unit", "Condition", "PostedAt", "ActorId", "Reason"];
            rows = [["6IhiTTshV9Q9kSaz", "LAwOvG1eJumlg-0s", "NHji4Nf40JUNUBlB", "A-01", "Bahan kilogram", "Receiving", "9.5", "kg", "good", "2026-11-04T18:27:27Z", "admin", "Penerimaan dicatat manual."]];
        }
        var meta = new Dictionary<string, string> { ["ReportType"] = type, ["Locale"] = "id", ["Company"] = "Perusahaan Demo - Data simulasi", ["WarehouseName"] = "Main Warehouse", ["WarehouseId"] = "main", ["WarehouseTimeZone"] = "Asia/Bangkok", ["ExportId"] = "DEMO000000000001", ["SourceReference"] = "LAwOvG1eJumlg-0s", ["SourceVersion"] = "0", ["DocumentDate"] = "2026-11-05", ["SourceStatus"] = "complete", ["GeneratedBy"] = "Demo admin", ["SnapshotAtUTC"] = "2026-11-04T18:27:27Z", ["GeneratedAtUTC"] = "2026-11-04T18:27:27Z", ["TemplateVersion"] = "2", ["RowCount"] = "1", ["Query"] = "" };
        if (type != "count-sheet" && type != "packing") meta["Signatures"] = "Disiapkan: __________________    Diterima: __________________    Tanggal: __________";
        var result = ExportFileWriter.Pdf(title, headers, rows, meta);
        Assert.Contains("/MediaBox [0 0 595 842]", Encoding.Latin1.GetString(result));
        var directory = Environment.GetEnvironmentVariable("WMS_EXPORT_PREVIEW_DIR");
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
            File.WriteAllBytes(Path.Combine(directory, type + ".pdf"), result);
            if (type == "count-report") File.WriteAllBytes(Path.Combine(directory, "count-review.xlsx"), ExportFileWriter.Xlsx(headers, rows, new(meta) { ["ReportType"] = "count-review" }));
            if (type == "manual-receive") File.WriteAllBytes(Path.Combine(directory, "stock.xlsx"), ExportFileWriter.Xlsx(["SKU", "ItemName", "Location", "Condition", "OnHand", "Reserved", "Available", "Unit"], [["000123", "Bahan kilogram", "A-01", "good", "125.5", "25", "100.5", "kg"], ["000124", "Barang contoh", "B-02", "good", "80", "0", "80", "unit"]], new(meta) { ["ReportType"] = "stock", ["RowCount"] = "2" }));
        }
    }
}
