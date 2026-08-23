using JobTracker.Api.Models;

namespace JobTracker.Api.Services;

public interface IDocumentRepository
{
    Task<IReadOnlyList<DocumentMetadata>> GetAllAsync(string userId, string? applicationId);

    Task<DocumentMetadata?> GetByIdAsync(string userId, string id);

    Task<DocumentMetadata> CreateAsync(string userId, CreateDocumentRequest request);

    /// <summary>Returns false if the document doesn't exist or isn't the user's.</summary>
    Task<bool> DeleteAsync(string userId, string id);
}