using System.Text.Json.Serialization;

namespace JobTracker.Api.Models;

/// <summary>
/// Metadata for an uploaded file. The binary itself lives in Firebase
/// Storage; this record only describes it.
/// </summary>
public class DocumentMetadata
{
    public string Id { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;

    /// <summary>Optional link to a specific application.</summary>
    public string? ApplicationId { get; set; }

    public string FileName { get; set; } = string.Empty;
    public string FileType { get; set; } = string.Empty;
    public long FileSize { get; set; }

    /// <summary>
    /// Firebase Storage path. [JsonIgnore] keeps it out of API responses —
    /// the frontend's contract says this is internal and the UI receives a
    /// signed download URL instead.
    /// </summary>
    [JsonIgnore]
    public string StorageRef { get; set; } = string.Empty;

    public string? DisplayName { get; set; }
    public string CreatedAt { get; set; } = string.Empty;
}