using JobTracker.Api.Data;
using JobTracker.Api.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull;
    });

// Enable CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// --- Storage: PostgreSQL (production) or InMemory (local dev fallback) ---
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

if (!string.IsNullOrWhiteSpace(databaseUrl))
{
    // Parse postgres:// URL provided by Render
    // Format: postgres://user:password@host:port/dbname
    string connectionString;
    try
    {
        var uri = new Uri(databaseUrl.Replace("postgres://", "postgresql://"));
        var userInfo = uri.UserInfo.Split(':', 2);
        var host = uri.Host;
        var port = uri.Port > 0 ? uri.Port : 5432;
        var db = uri.AbsolutePath.TrimStart('/');
        var user = Uri.UnescapeDataString(userInfo[0]);
        var pass = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";

        // Use SslMode=Prefer for Render internal connections (avoids native SSL crash)
        connectionString =
            $"Host={host};Port={port};Database={db};Username={user};Password={pass};" +
            "SSL Mode=Prefer;Trust Server Certificate=true;Include Error Detail=true";

        Console.WriteLine($"[Startup] Connecting to PostgreSQL at {host}:{port}/{db}");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Failed to parse DATABASE_URL: {ex.Message}");
        throw;
    }

    builder.Services.AddDbContext<AppDbContext>(opt =>
        opt.UseNpgsql(connectionString,
            npgsql => npgsql.CommandTimeout(60)));

    builder.Services.AddScoped<IApplicationRepository, PostgresApplicationRepository>();
    builder.Services.AddScoped<IDocumentRepository, PostgresDocumentRepository>();
    builder.Services.AddScoped<IReminderRepository, PostgresReminderRepository>();

    Console.WriteLine("[Startup] Using PostgreSQL repositories.");
}
else
{
    builder.Services.AddSingleton<IApplicationRepository, InMemoryApplicationRepository>();
    builder.Services.AddSingleton<IDocumentRepository, InMemoryDocumentRepository>();
    builder.Services.AddSingleton<IReminderRepository, InMemoryReminderRepository>();

    Console.WriteLine("[Startup] DATABASE_URL not set — using InMemory storage (local dev mode).");
}

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Auto-apply EF migrations on startup (only in PostgreSQL mode)
if (!string.IsNullOrWhiteSpace(databaseUrl))
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Console.WriteLine("[Startup] Applying database migrations...");
        db.Database.Migrate();
        Console.WriteLine("[Startup] Database migrations applied successfully.");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[Startup] Migration failed: {ex.Message}");
        Console.WriteLine($"[Startup] StackTrace: {ex.StackTrace}");
        throw;
    }
}

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "JobTracker API v1");
    c.RoutePrefix = "swagger";
});

app.UseCors("AllowAll");
app.UseAuthorization();
app.MapControllers();

app.MapGet("/", () => Results.Ok(new
{
    service = "JobTracker.Api",
    status = "healthy",
    version = "1.0.0",
    docs = "/swagger",
    storage = string.IsNullOrWhiteSpace(Environment.GetEnvironmentVariable("DATABASE_URL"))
        ? "in-memory (local dev)"
        : "postgresql",
    endpoints = new[] { "/api/applications", "/api/documents", "/api/reminders", "/api/dashboard/stats" }
}));

var appPort = Environment.GetEnvironmentVariable("PORT") ?? "10000";
Console.WriteLine($"[Startup] Binding to port {appPort}");
app.Run($"http://0.0.0.0:{appPort}");
