using JobTracker.Api.Models;

namespace JobTracker.Api.Services;

public class InMemoryDocumentRepository : IDocumentRepository
{
    private readonly List<DocumentMetadata> _store = [];
    private readonly object _gate = new();

    public Task<IReadOnlyList<DocumentMetadata>> GetAllAsync(string userId, string? applicationId)
    {
        lock (_gate)
        {
            var results = _store.Where(d => d.UserId == userId);

            if (!string.IsNullOrWhiteSpace(applicationId))
                results = results.Where(d => d.ApplicationId == applicationId);

            IReadOnlyList<DocumentMetadata> list = results
                .OrderByDescending(d => d.CreatedAt)
                .ToList();

            return Task.FromResult(list);
        }
    }

    public Task<DocumentMetadata?> GetByIdAsync(string userId, string id)
    {
        lock (_gate)
        {
            var doc = _store.FirstOrDefault(d => d.Id == id && d.UserId == userId);
            return Task.FromResult(doc);
        }
    }

    public Task<DocumentMetadata> CreateAsync(string userId, CreateDocumentRequest request)
    {
        var doc = new DocumentMetadata
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            ApplicationId = request.ApplicationId,
            FileName = request.FileName,
            FileType = request.FileType,
            FileSize = request.FileSize,
            StorageRef = request.StorageRef,
            DisplayName = request.DisplayName,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };

        lock (_gate)
        {
            _store.Add(doc);
        }

        return Task.FromResult(doc);
    }

    public Task<bool> DeleteAsync(string userId, string id)
    {
        lock (_gate)
        {
            var doc = _store.FirstOrDefault(d => d.Id == id && d.UserId == userId);
            if (doc is null) return Task.FromResult(false);

            _store.Remove(doc);
            return Task.FromResult(true);
        }
    }
}