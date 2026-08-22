using System.ComponentModel.DataAnnotations;

namespace JobTracker.Api.Models;

public class CreateReminderRequest
{
    [Required(ErrorMessage = "Application ID is required")]
    public string ApplicationId { get; set; } = string.Empty;

    [Required(ErrorMessage = "Reminder date is required")]
    public string ReminderDate { get; set; } = string.Empty;

    [Required]
    [AllowedValues(
        ReminderValues.FollowUp, ReminderValues.Interview,
        ReminderValues.Deadline, ReminderValues.ApplicationUpdate,
        ErrorMessage = "Please select a valid reminder type")]
    public string Type { get; set; } = string.Empty;

    [MaxLength(500, ErrorMessage = "Message must be 500 characters or fewer")]
    public string? Message { get; set; }
}