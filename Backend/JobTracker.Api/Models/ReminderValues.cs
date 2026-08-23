namespace JobTracker.Api.Models;

/// <summary>
/// Allowed reminder types, mirroring REMINDER_TYPES in types.ts.
/// Note the hyphenated values — they're stored exactly as written here.
/// </summary>
public static class ReminderValues
{
    public const string FollowUp = "follow-up";
    public const string Interview = "interview";
    public const string Deadline = "deadline";
    public const string ApplicationUpdate = "application-update";

    public static readonly IReadOnlyList<string> Types =
        [FollowUp, Interview, Deadline, ApplicationUpdate];
}