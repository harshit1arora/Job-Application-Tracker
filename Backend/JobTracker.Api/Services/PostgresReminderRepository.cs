using JobTracker.Api.Data;
using JobTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JobTracker.Api.Services;

public class PostgresReminderRepository : IReminderRepository
{
    private readonly AppDbContext _db;

    public PostgresReminderRepository(AppDbContext db)
    {
        _db = db;
    }

    public async Task<IReadOnlyList<Reminder>> GetAllAsync(
        string userId, string? applicationId, bool? isCompleted)
    {
        var query = _db.Reminders.Where(r => r.UserId == userId);

        if (!string.IsNullOrWhiteSpace(applicationId))
            query = query.Where(r => r.ApplicationId == applicationId);

        if (isCompleted.HasValue)
            query = query.Where(r => r.IsCompleted == isCompleted.Value);

        return await query.OrderBy(r => r.ReminderDate).ToListAsync();
    }

    public async Task<Reminder?> GetByIdAsync(string userId, string id)
    {
        return await _db.Reminders
            .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);
    }

    public async Task<Reminder> CreateAsync(string userId, CreateReminderRequest request)
    {
        var now = DateTime.UtcNow.ToString("o");
        var reminder = new Reminder
        {
            Id = $"rem-{Guid.NewGuid():N}"[..16],
            UserId = userId,
            ApplicationId = request.ApplicationId,
            ReminderDate = request.ReminderDate,
            Type = request.Type,
            Message = request.Message,
            IsCompleted = false,
            CreatedAt = now
        };

        _db.Reminders.Add(reminder);
        await _db.SaveChangesAsync();
        return reminder;
    }

    public async Task<Reminder?> UpdateAsync(string userId, string id, UpdateReminderRequest request)
    {
        var reminder = await _db.Reminders
            .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

        if (reminder is null) return null;

        if (request.ReminderDate is not null) reminder.ReminderDate = request.ReminderDate;
        if (request.Type is not null) reminder.Type = request.Type;
        if (request.Message is not null) reminder.Message = request.Message;
        if (request.IsCompleted.HasValue) reminder.IsCompleted = request.IsCompleted.Value;

        await _db.SaveChangesAsync();
        return reminder;
    }

    public async Task<bool> DeleteAsync(string userId, string id)
    {
        var reminder = await _db.Reminders
            .FirstOrDefaultAsync(r => r.Id == id && r.UserId == userId);

        if (reminder is null) return false;

        _db.Reminders.Remove(reminder);
        await _db.SaveChangesAsync();
        return true;
    }
}
