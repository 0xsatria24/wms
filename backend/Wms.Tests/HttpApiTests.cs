extern alias WmsApi;

using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Wms.Infrastructure;
using Xunit;

namespace Wms.Tests;

[Collection("PostgreSQL")]
public sealed partial class HttpApiTests(PostgresFixture postgres)
{
    private const string Warehouse = "Main Warehouse";
    private const string SnapshotPath = "/api/workspaces/Main%20Warehouse/snapshot";

    private async Task<ApiFactory> Factory()
    {
        var options = await postgres.Database();
        await using var db = new WmsDb(options);
        return new ApiFactory(db.Database.GetConnectionString()!);
    }

    private static async Task<JsonElement> Read(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"HTTP {(int)response.StatusCode}: {text}");
        return JsonSerializer.Deserialize<JsonElement>(text);
    }

    private static async Task Token(HttpClient client)
    {
        var session = await Read(await client.GetAsync("/api/session"));
        client.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        client.DefaultRequestHeaders.Add("X-XSRF-TOKEN", session.GetProperty("csrfToken").GetString());
    }

    private static async Task<HttpClient> Login(ApiFactory factory, string account)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://127.0.0.1"), AllowAutoRedirect = false });
        await Token(client);
        var response = await client.PostAsJsonAsync("/api/dev/login", new
        {
            account,
            password = "demo123"
        });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        await Token(client);
        return client;
    }

    private static async Task<HttpResponseMessage> Edit(HttpClient client, string type, object payload) =>
        await client.PostAsJsonAsync("/api/edit", new
        {
            type,
            warehouse = Warehouse,
            payload
        });

    private static async Task<HttpResponseMessage> Command(HttpClient client, string principalId, string type, long version, object payload, string? key = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/commands");
        request.Headers.Add("Idempotency-Key", key ?? Guid.NewGuid().ToString());
        request.Content = JsonContent.Create(new
        {
            type,
            warehouse = Warehouse,
            principalId,
            expectedVersion = version,
            payload
        });
        return await client.SendAsync(request);
    }

    [Fact]
    public async Task SessionAndCsrfProtectAnonymousRequests()
    {
        await using var factory = await Factory();
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(SnapshotPath)).StatusCode);
        var sessionResponse = await client.GetAsync("/api/session");
        var session = await Read(sessionResponse);
        Assert.Equal("development-demo", session.GetProperty("mode").GetString());
        Assert.Equal(JsonValueKind.Null, session.GetProperty("user").ValueKind);
        Assert.True(sessionResponse.Headers.CacheControl!.NoStore);
        var response = await client.PostAsJsonAsync("/api/dev/login", new
        {
            account = "admin",
            password = "demo123"
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("csrf", (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task CurrentWarehouseAccessAndLogoutAreEnforcedByHttpPipeline()
    {
        await using var factory = await Factory();
        using var client = await Login(factory, "operator");
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(SnapshotPath)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/workspaces/Secondary%20Warehouse/snapshot")).StatusCode);
        using var admin = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "access", new
        {
            id = "operator",
            status = "revoked",
            role = "operator",
            warehouses = new[] { Warehouse },
            reason = "HTTP access revocation test"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(SnapshotPath)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.PostAsJsonAsync("/api/logout", new
        {
        })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(SnapshotPath)).StatusCode);
    }

    [Fact]
    public async Task ItemCreationAndDeletionUseRealAuthCsrfVersionAndAudit()
    {
        await using var factory = await Factory();
        using var client = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(client, "master", new
        {
            sku = "SKU-HTTP",
            name = "HTTP test item",
            barcode = "00000789",
            unit = "units",
            factor = "1",
            active = true
        })).StatusCode);
        var snapshot = await Read(await client.GetAsync(SnapshotPath));
        var item = snapshot.GetProperty("products").EnumerateArray().Single(row => row.GetProperty("sku").GetString() == "SKU-HTTP");
        Assert.Equal("00000789", item.GetProperty("barcode").GetString());
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(client, "delete-master", new
        {
            sku = "SKU-HTTP",
            version = item.GetProperty("version").GetInt64(),
            reason = "Unused HTTP test record"
        })).StatusCode);
        var after = await Read(await client.GetAsync(SnapshotPath));
        Assert.DoesNotContain(after.GetProperty("products").EnumerateArray(), row => row.GetProperty("sku").GetString() == "SKU-HTTP");
        Assert.Contains(after.GetProperty("audit").EnumerateArray(), row => row.GetProperty("type").GetString() == "delete-master" && row.GetProperty("payload").GetProperty("DeletedItem").GetProperty("Barcode").GetString() == "00000789");
    }

    [Fact]
    public async Task ReceiptRetryAndStatusLookupReturnTheSameJsonContract()
    {
        await using var factory = await Factory();
        using var client = await Login(factory, "operator");
        var key = Guid.NewGuid().ToString();
        var first = await Read(await Command(client, "operator", "receive", 0, new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "60"
        }, key));
        var retry = await Read(await Command(client, "operator", "receive", 0, new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "60"
        }, key));
        var lookupResponse = await client.GetAsync($"/api/requests/receive/{key}?warehouse=Main%20Warehouse");
        var lookup = await Read(lookupResponse);
        Assert.True(lookupResponse.Headers.CacheControl!.NoStore);
        Assert.Equal(first.GetProperty("id").GetString(), retry.GetProperty("id").GetString());
        Assert.Equal(first.GetProperty("id").GetString(), lookup.GetProperty("id").GetString());
        Assert.Equal(first.EnumerateObject().Select(property => property.Name), lookup.EnumerateObject().Select(property => property.Name));
        var snapshot = await Read(await client.GetAsync(SnapshotPath));
        var po = snapshot.GetProperty("receipts").EnumerateArray().Single(row => row.GetProperty("id").GetString() == "PO-SIM-100");
        Assert.Equal("60", po.GetProperty("received").GetString());
        Assert.Single(snapshot.GetProperty("ledger").EnumerateArray(), row => row.GetProperty("kind").GetString() == "receive");
        using var admin = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync($"/api/requests/receive/{key}?warehouse=Main%20Warehouse")).StatusCode);
    }

    [Fact]
    public async Task CommandRejectsAnotherPrincipalAndAnAlreadyUsedItemCannotBeDeleted()
    {
        await using var factory = await Factory();
        using var client = await Login(factory, "admin");
        var denied = await Command(client, "operator", "receive", 0, new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "1"
        });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        var deletion = await Edit(client, "delete-master", new
        {
            sku = "SKU-A",
            version = 0,
            reason = "Must retain used item"
        });
        Assert.Equal(HttpStatusCode.Conflict, deletion.StatusCode);
        Assert.Equal("item-in-use", (await deletion.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task OrderApprovalReservationPickingAndShipmentWorkThroughHttp()
    {
        await using var factory = await Factory();
        using var operatorClient = await Login(factory, "operator");
        using var supervisorClient = await Login(factory, "supervisor");
        const string order = "SO-HTTP-001";
        async Task<JsonElement> CurrentOrder(HttpClient client)
        {
            var snapshot = await Read(await client.GetAsync(SnapshotPath));
            return snapshot.GetProperty("orders").EnumerateArray().Single(row => row.GetProperty("id").GetString() == order);
        }
        async Task Apply(HttpClient client, string actor, string type, object payload)
        {
            var current = await CurrentOrder(client);
            await Read(await Command(client, actor, type, current.GetProperty("version").GetInt64(), payload));
        }
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(operatorClient, "create-order", new
        {
            id = order,
            sku = "SKU-A",
            qty = "10"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(operatorClient, "submit-order", new
        {
            id = order,
            version = (await CurrentOrder(operatorClient)).GetProperty("version").GetInt64()
        })).StatusCode);
        var version = (await CurrentOrder(operatorClient)).GetProperty("version").GetInt64();
        Assert.Equal(HttpStatusCode.Forbidden, (await Command(operatorClient, "operator", "approve-order", version, new
        {
            order
        })).StatusCode);
        await Apply(supervisorClient, "supervisor", "approve-order", new
        {
            order
        });
        await Apply(supervisorClient, "supervisor", "release-order", new
        {
            order
        });
        await Apply(operatorClient, "operator", "reserve", new
        {
            order,
            location = "A-01",
            qty = "10"
        });
        await Apply(operatorClient, "operator", "pick", new
        {
            order,
            location = "A-01",
            locationScan = "A-01",
            scan = "SKU-A",
            qty = "10"
        });
        var beforeShipment = await Read(await operatorClient.GetAsync(SnapshotPath));
        Assert.Equal(128m, beforeShipment.GetProperty("positions").EnumerateArray().Sum(position => decimal.Parse(position.GetProperty("qty").GetString()!, System.Globalization.CultureInfo.InvariantCulture)));
        await Apply(operatorClient, "operator", "ship", new
        {
            order,
            scan = "SKU-A",
            qty = "10",
            packingVerified = true
        });
        var shipped = await CurrentOrder(operatorClient);
        Assert.Equal("10", shipped.GetProperty("picked").GetString());
        Assert.Equal("10", shipped.GetProperty("shipped").GetString());
        var final = await Read(await operatorClient.GetAsync(SnapshotPath));
        Assert.Equal(118m, final.GetProperty("positions").EnumerateArray().Sum(position => decimal.Parse(position.GetProperty("qty").GetString()!, System.Globalization.CultureInfo.InvariantCulture)));
        Assert.Single(final.GetProperty("ledger").EnumerateArray(), row => row.GetProperty("kind").GetString() == "ship" && row.GetProperty("source").GetString() == order);
    }

    [Fact]
    public async Task AdminCreatesOnePendingUserAndDeletesItWithAnAuditTrail()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(admin, "create-user", new
        {
            name = "New user",
            email = "new.user@example.test",
            reason = ""
        })).StatusCode);
        var attempts = await Task.WhenAll(
            Edit(admin, "create-user", new
            {
                name = " New user ",
                email = " NEW.USER@example.test ",
                reason = "Warehouse team onboarding"
            }),
            Edit(admin, "create-user", new
            {
                name = "New user",
                email = "new.user@example.test",
                reason = "Duplicate submission"
            }));
        Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.NoContent);
        Assert.Single(attempts, response => response.StatusCode == HttpStatusCode.Conflict);
        var snapshot = await Read(await admin.GetAsync(SnapshotPath));
        var added = Assert.Single(snapshot.GetProperty("users").EnumerateArray(), row => row.GetProperty("email").GetString() == "new.user@example.test");
        var id = added.GetProperty("id").GetString();
        Assert.Equal("New user", added.GetProperty("name").GetString());
        Assert.Equal("pending", added.GetProperty("status").GetString());
        Assert.False(added.GetProperty("verified").GetBoolean());
        Assert.Empty(added.GetProperty("warehouses").EnumerateArray());
        var approval = await Edit(admin, "access", new
        {
            id,
            status = "active",
            role = "operator",
            warehouses = new[] { Warehouse },
            reason = "Must verify first"
        });
        Assert.Equal(HttpStatusCode.BadRequest, approval.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(admin, "delete-user", new
        {
            id,
            reason = ""
        })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "delete-user", new
        {
            id,
            reason = "Onboarding cancelled"
        })).StatusCode);
        var after = await Read(await admin.GetAsync(SnapshotPath));
        Assert.DoesNotContain(after.GetProperty("users").EnumerateArray(), row => row.GetProperty("id").GetString() == id);
        Assert.Single(after.GetProperty("audit").EnumerateArray(), row => row.GetProperty("type").GetString() == "create-user" && row.GetProperty("payload").GetProperty("Target").GetString() == id);
        Assert.Single(after.GetProperty("audit").EnumerateArray(), row => row.GetProperty("type").GetString() == "delete-user" && row.GetProperty("payload").GetProperty("Target").GetString() == id);
        Assert.Equal(HttpStatusCode.Conflict, (await Edit(admin, "create-user", new
        {
            name = "Replacement",
            email = "new.user@example.test",
            reason = "Must not replace a removed identity"
        })).StatusCode);
    }

    [Fact]
    public async Task DeletedUserLosesCurrentAccessAndLoginWhileHistoryRemains()
    {
        await using var factory = await Factory();
        using var admin = await Login(factory, "admin");
        using var employee = await Login(factory, "operator");
        var key = Guid.NewGuid().ToString();
        var transaction = await Read(await Command(employee, "operator", "receive", 0, new
        {
            document = "PO-SIM-100",
            scan = "SKU-A",
            qty = "1"
        }, key));
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(admin, "delete-user", new
        {
            id = "operator",
            reason = "Employee access ended"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync(SnapshotPath)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await employee.GetAsync($"/api/requests/receive/{key}?warehouse=Main%20Warehouse")).StatusCode);
        using var signIn = factory.CreateClient();
        await Token(signIn);
        var login = await signIn.PostAsJsonAsync("/api/dev/login", new
        {
            account = "operator",
            password = "demo123"
        });
        Assert.Equal(HttpStatusCode.Forbidden, login.StatusCode);
        Assert.Equal("account-unavailable", (await login.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Conflict, (await Edit(admin, "access", new
        {
            id = "operator",
            status = "active",
            role = "operator",
            warehouses = new[] { Warehouse },
            reason = "Stale review cannot restore a deleted user"
        })).StatusCode);
        var snapshot = await Read(await admin.GetAsync(SnapshotPath));
        Assert.DoesNotContain(snapshot.GetProperty("users").EnumerateArray(), row => row.GetProperty("id").GetString() == "operator");
        Assert.Contains(snapshot.GetProperty("ledger").EnumerateArray(), row => row.GetProperty("transaction").GetString() == transaction.GetProperty("id").GetString() && row.GetProperty("user").GetString() == "operator");
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
        Assert.Equal("deleted", (await db.Principals.SingleAsync(row => row.Id == "operator")).Status);
        Assert.False(await db.AccessGrants.AnyAsync(row => row.PrincipalId == "operator"));
        Assert.True(await db.Documents.AnyAsync(row => row.Creator == "operator"));
        Assert.True(await db.Audit.AnyAsync(row => row.PrincipalId == "operator" && row.Action == "receive"));
    }

    [Fact]
    public async Task AdminCannotDeleteSelfOrAUserOutsideTheirAdministrativeScope()
    {
        await using var factory = await Factory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            (await db.AccessGrants.SingleAsync(row => row.PrincipalId == "supervisor" && row.WarehouseId == "main")).Role = "admin";
            await db.SaveChangesAsync();
        }
        using var limitedAdmin = await Login(factory, "supervisor");
        var self = await Edit(limitedAdmin, "delete-user", new
        {
            id = "supervisor",
            reason = "Self deletion must fail"
        });
        Assert.Equal(HttpStatusCode.Forbidden, self.StatusCode);
        Assert.Equal("self-user", (await self.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        var outside = await Edit(limitedAdmin, "delete-user", new
        {
            id = "admin",
            reason = "Target also administers Secondary Warehouse"
        });
        Assert.Equal(HttpStatusCode.Forbidden, outside.StatusCode);
        Assert.Equal("user-scope", (await outside.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("code").GetString());
        using var verifyScope = factory.Services.CreateScope();
        var verify = verifyScope.ServiceProvider.GetRequiredService<WmsDb>();
        Assert.Equal("active", (await verify.Principals.SingleAsync(row => row.Id == "admin")).Status);
        Assert.Equal(2, await verify.AccessGrants.CountAsync(row => row.PrincipalId == "admin"));
        Assert.False(await verify.Audit.AnyAsync(row => row.Action == "delete-user"));
    }

    [Theory]
    [InlineData("operator")]
    [InlineData("supervisor")]
    public async Task UserAdministrationRequiresAnAdministrator(string account)
    {
        await using var factory = await Factory();
        using var client = await Login(factory, account);
        Assert.Equal(HttpStatusCode.Forbidden, (await Edit(client, "create-user", new
        {
            name = "Not authorized",
            email = "blocked@example.test",
            reason = "Role test"
        })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Edit(client, "delete-user", new
        {
            id = "admin",
            reason = "Role test"
        })).StatusCode);
        var snapshot = await Read(await client.GetAsync(SnapshotPath));
        Assert.DoesNotContain(snapshot.GetProperty("audit").EnumerateArray(), row => row.GetProperty("type").GetString() is "create-user" or "delete-user");
    }

    [Fact]
    public async Task PublicEnrollmentStopsAtQuotaAndDoesNotGrowDirectory()
    {
        await using var factory = await Factory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            db.Principals.AddRange(Enumerable.Range(0, 100).Select(i => new Principal { Id = $"pending-{i}", Subject = $"request:{i}", Issuer = "access-request", Email = $"pending{i}@example.test", Name = "Pending" }));
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await Token(client);
        var response = await client.PostAsJsonAsync("/api/access/request", new { name = "Extra", email = "extra@example.test" });
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        using var verify = factory.Services.CreateScope();
        Assert.False(await verify.ServiceProvider.GetRequiredService<WmsDb>().Principals.AnyAsync(p => p.Email == "extra@example.test"));
    }

    [Fact]
    public async Task PublicEnrollmentHasABoundedGlobalRequestRate()
    {
        await using var factory = await Factory();
        using var client = factory.CreateClient();
        await Token(client);
        var replies = new List<HttpResponseMessage>();
        for (var i = 0; i < 12; i++)
            replies.Add(await client.PostAsJsonAsync("/api/access/request", new { name = "Applicant", email = "same@example.test" }));
        Assert.Contains(replies, r => r.StatusCode == HttpStatusCode.Accepted);
        Assert.Contains(replies, r => r.StatusCode == HttpStatusCode.TooManyRequests && r.Headers.RetryAfter is not null);
    }

    [Fact]
    public async Task SupportingRecordsRejectOversizeAndDeriveActorMetadata()
    {
        await using var factory = await Factory();
        using var client = await Login(factory, "operator");
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(client, "followups", new { note = new string('x', 20000) })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(client, "followups", new { note = "Check receipt", user = "admin", warehouse = "other", stamp = "fake" })).StatusCode);
        var snapshot = await Read(await client.GetAsync(SnapshotPath));
        var note = Assert.Single(snapshot.GetProperty("followups").EnumerateArray());
        Assert.Equal("operator", note.GetProperty("user").GetString());
        Assert.Equal(Warehouse, note.GetProperty("warehouse").GetString());
        Assert.NotEqual("fake", note.GetProperty("stamp").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(client, "followups", new { note = "Valid", extra = new { nested = "not allowed" } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(client, "labelHistory", new { sku = "SKU-A", action = "replace", code = "fake" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(client, "labelHistory", new { sku = "SKU-A", action = "download", code = "fake", user = "admin" })).StatusCode);
        var after = await Read(await client.GetAsync(SnapshotPath));
        var label = Assert.Single(after.GetProperty("labelHistory").EnumerateArray());
        Assert.Equal("operator", label.GetProperty("user").GetString());
        Assert.NotEqual("fake", label.GetProperty("code").GetString());
    }

    [Fact]
    public async Task PublicEnrollmentQuotaIsAtomicAcrossHosts()
    {
        var options = await postgres.Database();
        string connection;
        await using (var db = new WmsDb(options))
        {
            connection = db.Database.GetConnectionString()!;
            var pending = await db.Principals.CountAsync(p => p.Status == "pending");
            db.Principals.AddRange(Enumerable.Range(0, 99 - pending).Select(i => new Principal { Id = $"quota-{i}", Subject = $"quota:{i}", Issuer = "access-request", Email = $"quota{i}@example.test", Name = "Pending" }));
            await db.SaveChangesAsync();
        }
        await using var hostA = new ApiFactory(connection);
        await using var hostB = new ApiFactory(connection);
        using var a = hostA.CreateClient();
        using var b = hostB.CreateClient();
        await Token(a);
        await Token(b);
        var replies = await Task.WhenAll(a.PostAsJsonAsync("/api/access/request", new { name = "A", email = "a-new@example.test" }), b.PostAsJsonAsync("/api/access/request", new { name = "B", email = "b-new@example.test" }));
        Assert.Single(replies, r => r.StatusCode == HttpStatusCode.Accepted);
        Assert.Single(replies, r => r.StatusCode == HttpStatusCode.TooManyRequests);
        await using var verify = new WmsDb(options);
        Assert.Equal(100, await verify.Principals.CountAsync(p => p.Status == "pending"));
    }

    [Fact]
    public async Task FollowupPagesDoNotDisplaceOperationalPackages()
    {
        await using var factory = await Factory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            db.SupportingRecords.AddRange(Enumerable.Range(0, 55).Select(i => new SupportingRecord { Id = $"followups|{i:D3}", WarehouseId = "main", Kind = "followups", PayloadJson = JsonSerializer.Serialize(new { note = $"Note {i}" }) }));
            db.SupportingRecords.Add(new SupportingRecord { Id = "package|regression", WarehouseId = "main", Kind = "packages", PayloadJson = "{\"id\":\"regression\",\"items\":[]}" });
            await db.SaveChangesAsync();
        }
        using var client = await Login(factory, "operator");
        var first = await Read(await client.GetAsync(SnapshotPath + "?view=monitoring"));
        Assert.Equal(25, first.GetProperty("followups").GetArrayLength());
        Assert.Equal(55, first.GetProperty("supportingPage").GetProperty("total").GetInt32());
        Assert.Contains(first.GetProperty("packages").EnumerateArray(), p => p.GetProperty("id").GetString() == "regression");
        var third = await Read(await client.GetAsync(SnapshotPath + "?view=monitoring&supportingPage=3"));
        Assert.Equal(5, third.GetProperty("followups").GetArrayLength());
    }

    [Fact]
    public async Task SupportingLimitUsesStoredJsonRepresentation()
    {
        await using var factory = await Factory();
        using var client = await Login(factory, "admin");
        var empty = JsonSerializer.Serialize(new { name = "small-unit", factor = "1", padding = "" });
        var padding = new string('x', 16384 - System.Text.Encoding.UTF8.GetByteCount(empty));
        Assert.Equal(HttpStatusCode.BadRequest, (await Edit(client, "unitMaster", new { name = "small-unit", factor = "1", padding })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Edit(client, "unitMaster", new { name = "small-unit", factor = "1" })).StatusCode);
        var snapshot = await Read(await client.GetAsync(SnapshotPath));
        Assert.Contains(snapshot.GetProperty("unitMaster").EnumerateArray(), row => row.GetProperty("name").GetString() == "small-unit");
    }

    [Fact]
    public async Task SnapshotBoundsUsersAndDoesNotMaterializeLegacyHugeHistory()
    {
        await using var factory = await Factory();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<WmsDb>();
            db.Principals.AddRange(Enumerable.Range(0, 70).Select(i => new Principal { Id = $"page-{i:D3}", Subject = $"page:{i}", Issuer = "access-request", Email = $"page{i}@example.test", Name = "Paged" }));
            db.SupportingRecords.Add(new SupportingRecord { Id = "followups|legacy", WarehouseId = "main", Kind = "followups", PayloadJson = JsonSerializer.Serialize(new { note = new string('x', 100000) }) });
            db.Audit.Add(new AuditRecord { TransactionId = "legacy-huge-edit", PrincipalId = "operator", WarehouseId = "main", Action = "followups", DetailJson = JsonSerializer.Serialize(new { reason = new string('x', 100000) }), PostedAt = DateTimeOffset.UtcNow });
            await db.SaveChangesAsync();
        }
        using var client = await Login(factory, "admin");
        var first = await Read(await client.GetAsync(SnapshotPath + "?view=access&status=pending"));
        Assert.Equal(25, first.GetProperty("users").GetArrayLength());
        Assert.True(first.GetProperty("supportingRecordsWarning").GetBoolean());
        Assert.Empty(first.GetProperty("followups").EnumerateArray());
        Assert.DoesNotContain(first.GetProperty("audit").EnumerateArray(), row => row.GetProperty("id").GetString() == "legacy-huge-edit");
        var second = await Read(await client.GetAsync(SnapshotPath + "?view=access&status=pending&usersPage=2"));
        Assert.Equal(2, second.GetProperty("userPage").GetProperty("page").GetInt32());
        Assert.DoesNotContain(second.GetProperty("users").EnumerateArray(), row => row.GetProperty("id").GetString() == first.GetProperty("users")[0].GetProperty("id").GetString());
    }

    private sealed class ApiFactory(string connection) : WebApplicationFactory<WmsApi::Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.UseSetting("ConnectionStrings:Wms", connection);
            builder.UseSetting("Development:EnableDemoAuth", "true");
            builder.UseSetting("Database:MigrateOnStartup", "false");
            builder.ConfigureServices(services => services.AddSingleton<IStartupFilter>(new LoopbackTestTransport()));
        }
    }

    private sealed class LoopbackTestTransport : IStartupFilter
    {
        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Loopback;
                return nextMiddleware(context);
            });
            next(app);
        };
    }
}
