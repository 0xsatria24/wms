using System.Globalization;
using Wms.Shared;

namespace Wms.Infrastructure;

public static class WarehouseDates
{
    public static DateOnly? Date(string? value)
    {
        if (string.IsNullOrEmpty(value)) return null;
        Rules.Require(DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var date) && date > DateOnly.MinValue && date < DateOnly.MaxValue, "required", 400);
        return date;
    }
    public static DateTimeOffset Start(DateOnly date, string zone) => new(TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(TimeOnly.MinValue), TimeZoneInfo.FindSystemTimeZoneById(zone)));
}
