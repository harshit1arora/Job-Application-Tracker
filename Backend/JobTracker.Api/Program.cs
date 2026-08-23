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

// Enable CORS — production URL added; localhost kept for local dev
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
    // Render provides DATABASE_URL in the format:
    // postgres://user:password@host:port/dbname
    // Npgsql needs it converted to a standard connection string.
    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':');
    var connectionString =
        $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};" +
        $"Username={userInfo[0]};Password={userInfo[1]};SSL Mode=Require;Trust Server Certificate=true";

    builder.Services.AddDbContext<AppDbContext>(opt =>
        opt.UseNpgsql(connectionString));

    builder.Services.AddScoped<IApplicationRepository, PostgresApplicationRepository>();
    builder.Services.AddScoped<IDocumentRepository, PostgresDocumentRepository>();
    builder.Services.AddScoped<IReminderRepository, PostgresReminderRepository>();

    Console.WriteLine("[Startup] Using PostgreSQL database.");
}
else
{
    // Local dev — no DATABASE_URL set, fall back to InMemory
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
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    Console.WriteLine("[Startup] Database migrations applied.");
}

// Configure the HTTP request pipeline.
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

var port = Environment.GetEnvironmentVariable("PORT") ?? "5117";
app.Run($"http://0.0.0.0:{port}");
