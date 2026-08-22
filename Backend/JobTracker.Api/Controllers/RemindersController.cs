using JobTracker.Api.Models;
using JobTracker.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace JobTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class RemindersController : ControllerBase
{
    private readonly IReminderRepository _repository;

    public RemindersController(IReminderRepository repository)
    {
        _repository = repository;
    }

    private const string TempUserId = "test-user-123";

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Reminder>>> GetAll(
        [FromQuery] string? applicationId,
        [FromQuery] bool? isCompleted)
    {
        var results = await _repository.GetAllAsync(TempUserId, applicationId, isCompleted);
        return Ok(results);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Reminder>> GetById(string id)
    {
        var reminder = await _repository.GetByIdAsync(TempUserId, id);
        if (reminder is null) return NotFound(new { message = "Reminder not found" });

        return Ok(reminder);
    }

    [HttpPost]
    public async Task<ActionResult<Reminder>> Create(
        [FromBody] CreateReminderRequest request)
    {
        var reminder = await _repository.CreateAsync(TempUserId, request);
        return CreatedAtAction(nameof(GetById), new { id = reminder.Id }, reminder);
    }

    [HttpPatch("{id}")]
    public async Task<ActionResult<Reminder>> Update(
        string id, [FromBody] UpdateReminderRequest request)
    {
        var reminder = await _repository.UpdateAsync(TempUserId, id, request);
        if (reminder is null) return NotFound(new { message = "Reminder not found" });

        return Ok(reminder);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var deleted = await _repository.DeleteAsync(TempUserId, id);
        if (!deleted) return NotFound(new { message = "Reminder not found" });

        return NoContent();
    }
}