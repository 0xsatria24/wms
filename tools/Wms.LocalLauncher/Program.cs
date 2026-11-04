using System.Diagnostics;
using System.Net;

internal static class Program
{
    internal const string Origin = "https://127.0.0.1:5444";
    internal static async Task<bool> Ready(CancellationToken cancellation)
    {
        using var handler = new HttpClientHandler { UseProxy = false, AllowAutoRedirect = false };
        using var client = new HttpClient(handler) { Timeout = TimeSpan.FromSeconds(3) };
        while (!cancellation.IsCancellationRequested)
        {
            try
            {
                using var api = await client.GetAsync(Origin + "/health/ready", cancellation);
                using var sso = await client.GetAsync("https://127.0.0.1:8444/realms/wms-test/.well-known/openid-configuration", cancellation);
                if (api.StatusCode == HttpStatusCode.OK && sso.StatusCode == HttpStatusCode.OK) return true;
            }
            catch (HttpRequestException) { }
            catch (OperationCanceledException) when (!cancellation.IsCancellationRequested) { }
            try { await Task.Delay(1000, cancellation); }
            catch (OperationCanceledException) { break; }
        }
        return false;
    }

    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Contains("--probe-only", StringComparer.Ordinal))
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
            try { Environment.ExitCode = Ready(timeout.Token).GetAwaiter().GetResult() ? 0 : 1; }
            catch (OperationCanceledException) { Environment.ExitCode = 1; }
            return;
        }
        ApplicationConfiguration.Initialize();
        Application.Run(new LaunchWindow());
    }
}

internal sealed class LaunchWindow : Form
{
    private readonly Label message = new() { AutoSize = false, Left = 20, Top = 20, Width = 420, Height = 64 };
    private readonly Button retry = new() { Text = "Try again", Left = 262, Top = 105, Width = 85, Visible = false };
    private readonly Button cancel = new() { Text = "Close", Left = 355, Top = 105, Width = 85 };
    private CancellationTokenSource? waiting;

    internal LaunchWindow()
    {
        Text = "Inventory WMS Local Test";
        ClientSize = new Size(460, 150);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        Controls.AddRange([message, retry, cancel]);
        cancel.Click += (_, _) => Close();
        retry.Click += async (_, _) => await OpenWhenReady();
        Shown += async (_, _) => await OpenWhenReady();
        FormClosing += (_, _) => waiting?.Cancel();
    }

    private async Task OpenWhenReady()
    {
        retry.Visible = false;
        message.Text = "Preparing Inventory WMS…\r\nWaiting for the database and sign-in service.";
        waiting?.Dispose();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(90));
        waiting = timeout;
        try
        {
            if (await Program.Ready(timeout.Token))
            {
                Process.Start(new ProcessStartInfo(Program.Origin + "/") { UseShellExecute = true });
                Close();
                return;
            }
        }
        catch (OperationCanceledException) { }
        catch (System.ComponentModel.Win32Exception)
        {
            if (IsDisposed) return;
            message.Text = "Windows could not open your browser.\r\nOpen https://127.0.0.1:5444 manually.";
            retry.Visible = true;
            return;
        }
        finally { waiting = null; }
        if (IsDisposed) return;
        message.Text = "The application is not ready. Ask IT to check the InventoryWmsTest services. Your account and data have not been reset.";
        retry.Visible = true;
    }
}
