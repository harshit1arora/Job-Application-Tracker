namespace JobTracker.Api.Models;

/// <summary>
/// A reminder attached to a job application.
/// Unlike documents, applicationId is required — every reminder
/// belongs to exactly one application.
/// </summary>
public class Reminder
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string ApplicationId { get; set; } = string.Empty;

    /// <summary>ISO 8601 datetime, e.g. "2026-09-01T09:00".</summary>
    public string ReminderDate { get; set; } = string.Empty;

    public string Type { get; set; } = string.Empty;
    public string? Message { get; set; }
    public bool IsCompleted { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}