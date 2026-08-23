using JobTracker.Api.Data;
using JobTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JobTracker.Api.Services;

public class PostgresDocumentRepository : IDocumentRepository
{
    private readonly AppDbContext _db;

    public PostgresDocumentRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<DocumentMetadata>> GetAllAsync(string userId, string? applicationId)
    {
        var query = _db.Documents.Where(d => d.UserId == userId);

        if (!string.IsNullOrWhiteSpace(applicationId))
            query = query.Where(d => d.ApplicationId == applicationId);

        return await query.OrderByDescending(d => d.CreatedAt).ToListAsync();
    }

    public async Task<DocumentMetadata?> GetByIdAsync(string userId, string id)
    {
        return await _db.Documents
            .FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId);
    }

    public async Task<DocumentMetadata> CreateAsync(string userId, CreateDocumentRequest request)
    {
        var now = DateTime.UtcNow.ToString("o");
        var doc = new DocumentMetadata
        {
            Id = $"doc-{Guid.NewGuid():N}"[..16],
            UserId = userId,
            ApplicationId = request.ApplicationId,
            FileName = request.FileName,
            FileType = request.FileType,
            FileSize = request.FileSize,
            StorageRef = request.StorageRef ?? string.Empty,
            DisplayName = request.DisplayName,
            CreatedAt = now
        };

        _db.Documents.Add(doc);
        await _db.SaveChangesAsync();
        return doc;
    }

    public async Task<bool> DeleteAsync(string userId, string id)
    {
        var doc = await _db.Documents
            .FirstOrDefaultAsync(d => d.Id == id && d.UserId == userId);

        if (doc is null) return false;

        _db.Documents.Remove(doc);
        await _db.SaveChangesAsync();
        return true;
    }
}
