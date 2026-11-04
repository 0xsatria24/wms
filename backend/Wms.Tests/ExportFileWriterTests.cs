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
        Assert.Equal("inlineStr", cells["A2"].Attribute("t")!.Value);
        Assert.Equal("000123", cells["A2"].Value);
        Assert.Null(cells["B2"].Attribute("t"));
        Assert.Equal("-2.5", cells["B2"].Value);
        Assert.Equal("inlineStr", cells["C2"].Attribute("t")!.Value);
        Assert.Equal("123456789012.123456", cells["C2"].Value);
        Assert.Equal("=SUM(1,1)", cells["D2"].Value);
        Assert.Empty(sheet.Descendants(ns + "f"));
        Assert.NotNull(sheet.Root!.Element(ns + "autoFilter"));
        Assert.NotNull(sheet.Descendants(ns + "pane").Single());
        Assert.Contains("Metadata", Read(archive, "xl/workbook.xml"));
        Assert.Contains("ABCDEFGHIJKLMNOP", Read(archive, "xl/worksheets/sheet1.xml"));
        var artifact = Environment.GetEnvironmentVariable("WMS_EXPORT_TEST_ARTIFACT");
        if (!string.IsNullOrEmpty(artifact)) File.WriteAllBytes(Path.ChangeExtension(artifact, ".xlsx"), result);
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
        var rows = Enumerable.Range(0, 100).Select(i => new[] { $"ROW-{i:000}", "café Ω Ж " + new string('x', 110) }).ToList();
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
}
