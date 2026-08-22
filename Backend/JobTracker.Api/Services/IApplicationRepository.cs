using JobTracker.Api.Models;

namespace JobTracker.Api.Services;

/// <summary>
/// Storage contract for job applications.
///
/// The controller depends on this interface, not on any concrete storage.
/// Swapping in-memory storage for Firestore means writing a new class that
/// implements this interface and changing one line in Program.cs.
///
/// Every method is async because Firestore calls are network calls.
/// </summary>
public interface IApplicationRepository
{
    Task<IReadOnlyList<Application>> GetAllAsync(
        string userId, string? status, string? applicationSource, string? search);

    Task<Application?> GetByIdAsync(string userId, string id);

    Task<Application> CreateAsync(string userId, CreateApplicationRequest request);

    Task<Application?> UpdateAsync(string userId, string id, UpdateApplicationRequest request);
}