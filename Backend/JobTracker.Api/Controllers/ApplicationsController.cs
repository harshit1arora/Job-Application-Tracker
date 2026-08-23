using JobTracker.Api.Models;
using JobTracker.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace JobTracker.Api.Controllers;

/// <summary>
/// CRUD endpoints for job applications.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ApplicationsController : ControllerBase
{
    private readonly IApplicationRepository _repository;

    public ApplicationsController(IApplicationRepository repository)
    {
        _repository = repository;
    }

    private string GetUserId()
    {
        if (Request.Headers.TryGetValue("X-User-Id", out var userId) && !string.IsNullOrWhiteSpace(userId))
        {
            return userId.ToString();
        }

        if (Request.Query.TryGetValue("userId", out var queryUserId) && !string.IsNullOrWhiteSpace(queryUserId))
        {
            return queryUserId.ToString();
        }

        return "test-user-123";
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Application>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? applicationSource,
        [FromQuery] string? search)
    {
        var results = await _repository.GetAllAsync(
            GetUserId(), status, applicationSource, search);

        return Ok(results);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Application>> GetById(string id)
    {
        var app = await _repository.GetByIdAsync(GetUserId(), id);

        if (app is null) return NotFound(new { message = "Application not found" });

        return Ok(app);
    }

    [HttpPost]
    public async Task<ActionResult<Application>> Create(
        [FromBody] CreateApplicationRequest request)
    {
        var app = await _repository.CreateAsync(GetUserId(), request);
        return CreatedAtAction(nameof(GetById), new { id = app.Id }, app);
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<Application>> Update(
        string id, [FromBody] UpdateApplicationRequest request)
    {
        var app = await _repository.UpdateAsync(GetUserId(), id, request);

        if (app is null) return NotFound(new { message = "Application not found" });

        return Ok(app);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var deleted = await _repository.DeleteAsync(GetUserId(), id);
        if (!deleted) return NotFound(new { message = "Application not found" });

        return NoContent();
    }

    [HttpGet("stats")]
    [HttpGet("/api/dashboard/stats")]
    public async Task<ActionResult<object>> GetDashboardStats()
    {
        var userId = GetUserId();
        var allApps = await _repository.GetAllAsync(userId, null, null, null);
        var today = DateTime.UtcNow.ToString("yyyy-MM-dd");

        var byStatus = new Dictionary<string, int>
        {
            ["saved"] = allApps.Count(a => string.Equals(a.Status, "Saved", StringComparison.OrdinalIgnoreCase)),
            ["applied"] = allApps.Count(a => string.Equals(a.Status, "Applied", StringComparison.OrdinalIgnoreCase)),
            ["underReview"] = allApps.Count(a => string.Equals(a.Status, "Under Review", StringComparison.OrdinalIgnoreCase)),
            ["interview"] = allApps.Count(a => string.Equals(a.Status, "Interview", StringComparison.OrdinalIgnoreCase)),
            ["offer"] = allApps.Count(a => string.Equals(a.Status, "Offer", StringComparison.OrdinalIgnoreCase)),
            ["rejected"] = allApps.Count(a => string.Equals(a.Status, "Rejected", StringComparison.OrdinalIgnoreCase))
        };

        var recentApplications = allApps.Take(5).ToList();
        var upcomingFollowUps = allApps
            .Where(a => !string.IsNullOrEmpty(a.FollowUpDate) && string.Compare(a.FollowUpDate, today, StringComparison.Ordinal) >= 0)
            .OrderBy(a => a.FollowUpDate)
            .Take(5)
            .ToList();

        return Ok(new
        {
            totalApplications = allApps.Count,
            byStatus,
            recentApplications,
            upcomingFollowUps
        });
    }
}