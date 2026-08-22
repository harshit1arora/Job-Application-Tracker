namespace JobTracker.Api.Models;

/// <summary>
/// A job application as stored in Firestore and returned by the API.
/// Property names match the frontend's ApplicationDocument interface.
/// </summary>
public class Application
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;

    public string Company { get; set; } = string.Empty;
    public string JobTitle { get; set; } = string.Empty;
    public string ApplicationSource { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;

    public string? JobDescription { get; set; }
    public string? SalaryRange { get; set; }
    public string? Location { get; set; }
    public string? Notes { get; set; }
    public string? FollowUpDate { get; set; }

    /// <summary>Assigned by the AI module — this API never writes it.</summary>
    public int? MatchScore { get; set; }

    public string CreatedAt { get; set; } = string.Empty;
    public string UpdatedAt { get; set; } = string.Empty;
}