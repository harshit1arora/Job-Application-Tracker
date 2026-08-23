using JobTracker.Api.Data;
using JobTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JobTracker.Api.Services;

/// <summary>
/// PostgreSQL-backed implementation of IApplicationRepository using EF Core.
/// Replaces InMemoryApplicationRepository in production.
/// </summary>
public class PostgresApplicationRepository : IApplicationRepository
{
    private readonly AppDbContext _db;

    public PostgresApplicationRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Application>> GetAllAsync(
        string userId, string? status, string? applicationSource, string? search)
    {
        var query = _db.Applications.Where(a => a.UserId == userId);

        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("All", StringComparison.OrdinalIgnoreCase))
            query = query.Where(a => a.Status == status);

        if (!string.IsNullOrWhiteSpace(applicationSource))
            query = query.Where(a => a.ApplicationSource == applicationSource);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(a =>
                a.Company.Contains(search) || a.JobTitle.Contains(search));

        return await query
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync();
    }

    public async Task<Application?> GetByIdAsync(string userId, string id)
    {
        return await _db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);
    }

    public async Task<Application> CreateAsync(string userId, CreateApplicationRequest request)
    {
        var now = DateTime.UtcNow.ToString("o");
        var app = new Application
        {
            Id = $"app-{Guid.NewGuid():N}"[..16],
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

        _db.Applications.Add(app);
        await _db.SaveChangesAsync();
        return app;
    }

    public async Task<Application?> UpdateAsync(string userId, string id, UpdateApplicationRequest request)
    {
        var app = await _db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

        if (app is null) return null;

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
        await _db.SaveChangesAsync();
        return app;
    }

    public async Task<bool> DeleteAsync(string userId, string id)
    {
        var app = await _db.Applications
            .FirstOrDefaultAsync(a => a.Id == id && a.UserId == userId);

        if (app is null) return false;

        _db.Applications.Remove(app);
        await _db.SaveChangesAsync();
        return true;
    }
}
