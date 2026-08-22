using System.ComponentModel.DataAnnotations;

namespace JobTracker.Api.Models;

/// <summary>
/// The body a client sends when creating an application (POST).
///
/// Deliberately has no UserId. That value comes from the verified
/// Firebase token, never from the request body — otherwise a caller
/// could create records owned by somebody else.
///
/// The limits mirror the Zod schema in the frontend's validation.ts.
/// </summary>
public class CreateApplicationRequest
{
    [Required(ErrorMessage = "Company name is required")]
    [MaxLength(100, ErrorMessage = "Company name must be 100 characters or fewer")]
    public string Company { get; set; } = string.Empty;

    [Required(ErrorMessage = "Job title is required")]
    [MaxLength(150, ErrorMessage = "Job title must be 150 characters or fewer")]
    public string JobTitle { get; set; } = string.Empty;

    [Required]
    [AllowedValues(
        ApplicationValues.Greenhouse, ApplicationValues.Lever,
        ApplicationValues.Ashby, ApplicationValues.Workday,
        ApplicationValues.LinkedIn, ApplicationValues.Other,
        ErrorMessage = "Please select a valid application source")]
    public string ApplicationSource { get; set; } = string.Empty;

    [Required]
    [AllowedValues(
        ApplicationValues.Saved, ApplicationValues.Applied,
        ApplicationValues.UnderReview, ApplicationValues.Interview,
        ApplicationValues.Offer, ApplicationValues.Rejected,
        ErrorMessage = "Please select a valid application status")]
    public string Status { get; set; } = string.Empty;

    [MaxLength(5000, ErrorMessage = "Job description must be 5000 characters or fewer")]
    public string? JobDescription { get; set; }

    [MaxLength(50, ErrorMessage = "Salary range must be 50 characters or fewer")]
    public string? SalaryRange { get; set; }

    [MaxLength(100, ErrorMessage = "Location must be 100 characters or fewer")]
    public string? Location { get; set; }

    [MaxLength(2000, ErrorMessage = "Notes must be 2000 characters or fewer")]
    public string? Notes { get; set; }

    [RegularExpression(@"^\d{4}-\d{2}-\d{2}$",
        ErrorMessage = "Date must be in YYYY-MM-DD format")]
    public string? FollowUpDate { get; set; }
}