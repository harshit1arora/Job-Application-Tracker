using System.ComponentModel.DataAnnotations;

namespace JobTracker.Api.Models;

/// <summary>
/// Partial update. The main use is marking a reminder complete,
/// which is why isCompleted is here — types.ts defines the field
/// but no input type for changing it.
/// </summary>
public class UpdateReminderRequest
{
    public bool? IsCompleted { get; set; }

    public string? ReminderDate { get; set; }

    [AllowedValues(
        ReminderValues.FollowUp, ReminderValues.Interview,
        ReminderValues.Deadline, ReminderValues.ApplicationUpdate,
        ErrorMessage = "Please select a valid reminder type")]
    public string? Type { get; set; }

    [MaxLength(500, ErrorMessage = "Message must be 500 characters or fewer")]
    public string? Message { get; set; }
}