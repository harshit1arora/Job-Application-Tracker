using JobTracker.Api.Models;

namespace JobTracker.Api.Services;

public interface IReminderRepository
{
    Task<IReadOnlyList<Reminder>> GetAllAsync(
        string userId, string? applicationId, bool? isCompleted);

    Task<Reminder?> GetByIdAsync(string userId, string id);

    Task<Reminder> CreateAsync(string userId, CreateReminderRequest request);

    Task<Reminder?> UpdateAsync(string userId, string id, UpdateReminderRequest request);

    Task<bool> DeleteAsync(string userId, string id);
}