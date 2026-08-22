using JobTracker.Api.Models;

namespace JobTracker.Api.Services;

public class InMemoryReminderRepository : IReminderRepository
{
    private readonly List<Reminder> _store = [];
    private readonly object _gate = new();

    public Task<IReadOnlyList<Reminder>> GetAllAsync(
        string userId, string? applicationId, bool? isCompleted)
    {
        lock (_gate)
        {
            var results = _store.Where(r => r.UserId == userId);

            if (!string.IsNullOrWhiteSpace(applicationId))
                results = results.Where(r => r.ApplicationId == applicationId);

            if (isCompleted.HasValue)
                results = results.Where(r => r.IsCompleted == isCompleted.Value);

            // Soonest first — reminders are about what's coming up.
            IReadOnlyList<Reminder> list = results
                .OrderBy(r => r.ReminderDate)
                .ToList();

            return Task.FromResult(list);
        }
    }

    public Task<Reminder?> GetByIdAsync(string userId, string id)
    {
        lock (_gate)
        {
            var reminder = _store.FirstOrDefault(r => r.Id == id && r.UserId == userId);
            return Task.FromResult(reminder);
        }
    }

    public Task<Reminder> CreateAsync(string userId, CreateReminderRequest request)
    {
        var reminder = new Reminder
        {
            Id = Guid.NewGuid().ToString(),
            UserId = userId,
            ApplicationId = request.ApplicationId,
            ReminderDate = request.ReminderDate,
            Type = request.Type,
            Message = request.Message,
            IsCompleted = false,
            CreatedAt = DateTime.UtcNow.ToString("o")
        };

        lock (_gate)
        {
            _store.Add(reminder);
        }

        return Task.FromResult(reminder);
    }

    public Task<Reminder?> UpdateAsync(
        string userId, string id, UpdateReminderRequest request)
    {
        lock (_gate)
        {
            var reminder = _store.FirstOrDefault(r => r.Id == id && r.UserId == userId);
            if (reminder is null) return Task.FromResult<Reminder?>(null);

            if (request.IsCompleted.HasValue) reminder.IsCompleted = request.IsCompleted.Value;
            if (request.ReminderDate is not null) reminder.ReminderDate = request.ReminderDate;
            if (request.Type is not null) reminder.Type = request.Type;
            if (request.Message is not null) reminder.Message = request.Message;

            return Task.FromResult<Reminder?>(reminder);
        }
    }

    public Task<bool> DeleteAsync(string userId, string id)
    {
        lock (_gate)
        {
            var reminder = _store.FirstOrDefault(r => r.Id == id && r.UserId == userId);
            if (reminder is null) return Task.FromResult(false);

            _store.Remove(reminder);
            return Task.FromResult(true);
        }
    }
}