using System.Security.Cryptography;

namespace Wms.Shared;

public static class ReferenceId
{
    public static string New() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(12))
        .Replace('+', '-').Replace('/', '_');
}
