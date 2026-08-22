using JobTracker.Api.Models;

namespace JobTracker.Api.Services;

/// <summary>
/// Temporary in-memory storage. Data is lost when the app restarts.
/// Replaced by FirestoreApplicationRepository once credentials are available.
///
/// The list is locked because ASP.NET Core handles requests concurrently on
/// multiple threads, and List&lt;T&gt; is not thread-safe.
/// </summary>
public class InMemoryApplicationRepository : IApplicationRepository
{
    private readonly List<Application> _store = [];
    private readonly object _gate = new();

    public Task<IReadOnlyList<Application>> GetAllAsync(
        string userId, string? status, string? applicationSource, string? search)
    {
        lock (_gate)
        {
            var results = _store.Where(a => a.UserId == userId);

            if (!string.IsNullOrWhiteSpace(status))
                results = results.Where(a => a.Status == status);

            if (!string.IsNullOrWhiteSpace(applicationSource))
                results = results.Where(a => a.ApplicationSource == applicationSource);

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
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            Company = request.Company,
            JobTitle = request.JobTitle,
            ApplicationSource = request.ApplicationSource,
            Status = request.Status,
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
            _store.Add(app);
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
            if (request.JobDescription is not null) app.JobDescription = request.JobDescription;
            if (request.SalaryRange is not null) app.SalaryRange = request.SalaryRange;
            if (request.Location is not null) app.Location = request.Location;
            if (request.Notes is not null) app.Notes = request.Notes;
            if (request.FollowUpDate is not null) app.FollowUpDate = request.FollowUpDate;

            app.UpdatedAt = DateTime.UtcNow.ToString("o");

            return Task.FromResult<Application?>(app);
        }
    }
}