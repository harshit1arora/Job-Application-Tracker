using JobTracker.Api.Models;
using JobTracker.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace JobTracker.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DocumentsController : ControllerBase
{
    private readonly IDocumentRepository _repository;

    public DocumentsController(IDocumentRepository repository)
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
    public async Task<ActionResult<IReadOnlyList<DocumentMetadata>>> GetAll(
        [FromQuery] string? applicationId)
    {
        var results = await _repository.GetAllAsync(GetUserId(), applicationId);
        return Ok(results);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<DocumentMetadata>> GetById(string id)
    {
        var doc = await _repository.GetByIdAsync(GetUserId(), id);
        if (doc is null) return NotFound(new { message = "Document not found" });

        return Ok(doc);
    }

    [HttpPost]
    public async Task<ActionResult<DocumentMetadata>> Create(
        [FromBody] CreateDocumentRequest request)
    {
        var doc = await _repository.CreateAsync(GetUserId(), request);
        return CreatedAtAction(nameof(GetById), new { id = doc.Id }, doc);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        var deleted = await _repository.DeleteAsync(GetUserId(), id);
        if (!deleted) return NotFound(new { message = "Document not found" });

        return NoContent();
    }
}