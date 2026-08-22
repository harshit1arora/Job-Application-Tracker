using JobTracker.Api.Models;
using JobTracker.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace JobTracker.Api.Controllers;

/// <summary>
/// CRUD endpoints for job applications.
///
/// The controller's only jobs are: read the request, call the repository,
/// and turn the result into the right HTTP status code. It holds no
/// storage logic, which is why swapping in Firestore won't touch this file.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class ApplicationsController : ControllerBase
{
    private readonly IApplicationRepository _repository;

    // ASP.NET Core supplies the implementation automatically, based on
    // what's registered in Program.cs. This is constructor injection.
    public ApplicationsController(IApplicationRepository repository)
    {
        _repository = repository;
    }

    // Placeholder until Firebase token verification is added.
    private const string TempUserId = "test-user-123";

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Application>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? applicationSource,
        [FromQuery] string? search)
    {
        var results = await _repository.GetAllAsync(
            TempUserId, status, applicationSource, search);

        return Ok(results);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Application>> GetById(string id)
    {
        var app = await _repository.GetByIdAsync(TempUserId, id);

        // 404 rather than 403 when it belongs to another user — deliberate,
        // and matches the frontend. A 403 would confirm the ID exists.
        if (app is null) return NotFound(new { message = "Application not found" });

        return Ok(app);
    }

    [HttpPost]
    public async Task<ActionResult<Application>> Create(
        [FromBody] CreateApplicationRequest request)
    {
        var app = await _repository.CreateAsync(TempUserId, request);
        return CreatedAtAction(nameof(GetById), new { id = app.Id }, app);
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<Application>> Update(
        string id, [FromBody] UpdateApplicationRequest request)
    {
        var app = await _repository.UpdateAsync(TempUserId, id, request);

        if (app is null) return NotFound(new { message = "Application not found" });

        return Ok(app);
    }
}