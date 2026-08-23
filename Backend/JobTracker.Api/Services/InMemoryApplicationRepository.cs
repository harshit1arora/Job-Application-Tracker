using JobTracker.Api.Models;

namespace JobTracker.Api.Services;

/// <summary>
/// In-memory storage with pre-seeded demo applications.
/// Replaced by FirestoreApplicationRepository once credentials are available.
/// </summary>
public class InMemoryApplicationRepository : IApplicationRepository
{
    private readonly List<Application> _store = [];
    private readonly object _gate = new();

    public InMemoryApplicationRepository()
    {
        SeedDemoData();
    }

    private void SeedDemoData()
    {
        var now = DateTime.UtcNow;
        var demoUsers = new[] { "test-user-123", "demo-user", "default-user" };

        foreach (var userId in demoUsers)
        {
            _store.Add(new Application
            {
                Id = $"app-{Guid.NewGuid():N}"[..12],
                UserId = userId,
                Company = "Stripe",
                JobTitle = "Senior Full Stack Engineer",
                ApplicationSource = "LinkedIn",
                Status = "Interview",
                ApplicationUrl = "https://stripe.com/jobs/search",
                JobDescription = "Design and build high-throughput payment infrastructure and developer APIs using React, TypeScript, C#, and distributed systems.",
                SalaryRange = "$175,000 - $210,000",
                Location = "San Francisco, CA (Hybrid)",
                Notes = "Technical screening scheduled for next Tuesday. Review distributed systems & API idempotency.",
                FollowUpDate = now.AddDays(3).ToString("yyyy-MM-dd"),
                MatchScore = 94,
                CreatedAt = now.AddDays(-5).ToString("o"),
                UpdatedAt = now.AddDays(-1).ToString("o")
            });

            _store.Add(new Application
            {
                Id = $"app-{Guid.NewGuid():N}"[..12],
                UserId = userId,
                Company = "OpenAI",
                JobTitle = "Frontend Platform Engineer",
                ApplicationSource = "Company Website",
                Status = "Under Review",
                ApplicationUrl = "https://openai.com/careers/search",
                JobDescription = "Create next-generation intuitive interfaces for foundation model evaluation, canvas interactions, and developer playgrounds.",
                SalaryRange = "$190,000 - $240,000",
                Location = "San Francisco, CA",
                Notes = "Referred by campus alumni. Applied with custom AI project portfolio.",
                FollowUpDate = now.AddDays(5).ToString("yyyy-MM-dd"),
                MatchScore = 91,
                CreatedAt = now.AddDays(-8).ToString("o"),
                UpdatedAt = now.AddDays(-8).ToString("o")
            });

            _store.Add(new Application
            {
                Id = $"app-{Guid.NewGuid():N}"[..12],
                UserId = userId,
                Company = "Vercel",
                JobTitle = "Software Engineer, Core DX",
                ApplicationSource = "Wellfound",
                Status = "Applied",
                ApplicationUrl = "https://vercel.com/careers",
                JobDescription = "Work on next-generation web bundling, edge runtime rendering, and developer experience for millions of frontend developers.",
                SalaryRange = "$160,000 - $195,000",
                Location = "Remote (US/Global)",
                Notes = "Submitted tailored résumé highlighting performance optimization and compiler toolchains.",
                FollowUpDate = now.AddDays(7).ToString("yyyy-MM-dd"),
                MatchScore = 88,
                CreatedAt = now.AddDays(-2).ToString("o"),
                UpdatedAt = now.AddDays(-2).ToString("o")
            });

            _store.Add(new Application
            {
                Id = $"app-{Guid.NewGuid():N}"[..12],
                UserId = userId,
                Company = "Datadog",
                JobTitle = "Backend Systems Engineer",
                ApplicationSource = "Indeed",
                Status = "Saved",
                ApplicationUrl = "https://www.datadoghq.com/careers/detail/?gh_jid=6452109",
                JobDescription = "Build scalable real-time telemetry processing pipelines handling petabytes of metrics per second.",
                SalaryRange = "$165,000 - $200,000",
                Location = "New York, NY (Hybrid)",
                Notes = "Tailor résumé to emphasize observability and high-concurrency architectures.",
                FollowUpDate = now.AddDays(2).ToString("yyyy-MM-dd"),
                MatchScore = 82,
                CreatedAt = now.AddDays(-1).ToString("o"),
                UpdatedAt = now.AddDays(-1).ToString("o")
            });
        }
    }

    public Task<IReadOnlyList<Application>> GetAllAsync(
        string userId, string? status, string? applicationSource, string? search)
    {
        lock (_gate)
        {
            // If user has no applications yet, assign demo seed applications to their userId
            if (!_store.Any(a => a.UserId == userId))
            {
                SeedUserSpecificData(userId);
            }

            var results = _store.Where(a => a.UserId == userId);

            if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
                results = results.Where(a => a.Status.Equals(status, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(applicationSource))
                results = results.Where(a => a.ApplicationSource.Equals(applicationSource, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrWhiteSpace(search))
                results = results.Where(a =>
                    a.Company.Contains(search, StringComparison.OrdinalIgnoreCase) ||
                    a.JobTitle.Contains(search, StringComparison.OrdinalIgnoreCase));

            IReadOnlyList<Application> list = results
                .OrderByDescending(a => a.CreatedAt)
                .ToList();

            return Task.FromResult(list);
        }
    }

    private void SeedUserSpecificData(string userId)
    {
        var now = DateTime.UtcNow;
        _store.Add(new Application
        {
            Id = $"app-{Guid.NewGuid():N}"[..12],
            UserId = userId,
            Company = "Stripe",
            JobTitle = "Senior Full Stack Engineer",
            ApplicationSource = "LinkedIn",
            Status = "Interview",
            ApplicationUrl = "https://stripe.com/jobs/search",
            JobDescription = "Design and build high-throughput payment infrastructure and developer APIs using React, TypeScript, C#, and distributed systems.",
            SalaryRange = "$175,000 - $210,000",
            Location = "San Francisco, CA (Hybrid)",
            Notes = "Technical screening scheduled for next Tuesday. Review distributed systems & API idempotency.",
            FollowUpDate = now.AddDays(3).ToString("yyyy-MM-dd"),
            MatchScore = 94,
            CreatedAt = now.AddDays(-4).ToString("o"),
            UpdatedAt = now.AddDays(-1).ToString("o")
        });

        _store.Add(new Application
        {
            Id = $"app-{Guid.NewGuid():N}"[..12],
            UserId = userId,
            Company = "OpenAI",
            JobTitle = "Frontend Platform Engineer",
            ApplicationSource = "Company Website",
            Status = "Under Review",
            ApplicationUrl = "https://openai.com/careers/search",
            JobDescription = "Create next-generation intuitive interfaces for foundation model evaluation, canvas interactions, and developer playgrounds.",
            SalaryRange = "$190,000 - $240,000",
            Location = "San Francisco, CA",
            Notes = "Referred by campus alumni. Applied with custom AI project portfolio.",
            FollowUpDate = now.AddDays(5).ToString("yyyy-MM-dd"),
            MatchScore = 91,
            CreatedAt = now.AddDays(-7).ToString("o"),
            UpdatedAt = now.AddDays(-7).ToString("o")
        });

        _store.Add(new Application
        {
            Id = $"app-{Guid.NewGuid():N}"[..12],
            UserId = userId,
            Company = "Vercel",
            JobTitle = "Software Engineer, Core DX",
            ApplicationSource = "Wellfound",
            Status = "Applied",
            ApplicationUrl = "https://vercel.com/careers",
            JobDescription = "Work on next-generation web bundling, edge runtime rendering, and developer experience for millions of frontend developers.",
            SalaryRange = "$160,000 - $195,000",
            Location = "Remote (US/Global)",
            Notes = "Submitted tailored résumé highlighting performance optimization and compiler toolchains.",
            FollowUpDate = now.AddDays(7).ToString("yyyy-MM-dd"),
            MatchScore = 88,
            CreatedAt = now.AddDays(-2).ToString("o"),
            UpdatedAt = now.AddDays(-2).ToString("o")
        });
    }

    public Task<Application?> GetByIdAsync(string userId, string id)
    {
        lock (_gate)
        {
            var app = _store.FirstOrDefault(a => a.Id == id && a.UserId == userId);
            return Task.FromResult(app);
        }
    }

    public Task<Application> CreateAsync(string userId, CreateApplicationRequest request)
    {
        var now = DateTime.UtcNow.ToString("o");

        var app = new Application
        {
            Id = $"app-{Guid.NewGuid():N}"[..12],
            UserId = userId,
            Company = request.Company,
            JobTitle = request.JobTitle,
            ApplicationSource = request.ApplicationSource,
            Status = request.Status,
            ApplicationUrl = request.ApplicationUrl,
            JobDescription = request.JobDescription,
            SalaryRange = request.SalaryRange,
            Location = request.Location,
            Notes = request.Notes,
            FollowUpDate = request.FollowUpDate,
            CreatedAt = now,
            UpdatedAt = now
        };

        lock (_gate)
        {
            _store.Insert(0, app);
        }

        return Task.FromResult(app);
    }

    public Task<Application?> UpdateAsync(
        string userId, string id, UpdateApplicationRequest request)
    {
        lock (_gate)
        {
            var app = _store.FirstOrDefault(a => a.Id == id && a.UserId == userId);
            if (app is null) return Task.FromResult<Application?>(null);

            if (request.Company is not null) app.Company = request.Company;
            if (request.JobTitle is not null) app.JobTitle = request.JobTitle;
            if (request.ApplicationSource is not null) app.ApplicationSource = request.ApplicationSource;
            if (request.Status is not null) app.Status = request.Status;
            if (request.ApplicationUrl is not null) app.ApplicationUrl = request.ApplicationUrl;
            if (request.JobDescription is not null) app.JobDescription = request.JobDescription;
            if (request.SalaryRange is not null) app.SalaryRange = request.SalaryRange;
            if (request.Location is not null) app.Location = request.Location;
            if (request.Notes is not null) app.Notes = request.Notes;
            if (request.FollowUpDate is not null) app.FollowUpDate = request.FollowUpDate;

            app.UpdatedAt = DateTime.UtcNow.ToString("o");

            return Task.FromResult<Application?>(app);
        }
    }

    public Task<bool> DeleteAsync(string userId, string id)
    {
        lock (_gate)
        {
            var app = _store.FirstOrDefault(a => a.Id == id && a.UserId == userId);
            if (app is null) return Task.FromResult(false);

            _store.Remove(app);
            return Task.FromResult(true);
        }
    }
}