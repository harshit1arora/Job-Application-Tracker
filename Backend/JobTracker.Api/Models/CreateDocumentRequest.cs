using System.ComponentModel.DataAnnotations;

namespace JobTracker.Api.Models;

/// <summary>
/// Sent after a file has already been uploaded to Firebase Storage.
/// This endpoint registers the metadata, it does not receive the file.
/// </summary>
public class CreateDocumentRequest
{
    [Required(ErrorMessage = "File name is required")]
    [MaxLength(255)]
    public string FileName { get; set; } = string.Empty;

    [Required]
    [AllowedValues(
        DocumentValues.Pdf, DocumentValues.Doc, DocumentValues.Docx,
        ErrorMessage = "Only PDF and Word documents (.doc, .docx) are supported")]
    public string FileType { get; set; } = string.Empty;

    [Range(1, DocumentValues.MaxFileSizeBytes,
        ErrorMessage = "File size must be 5 MB or smaller")]
    public long FileSize { get; set; }

    [Required(ErrorMessage = "Storage reference is required")]
    public string StorageRef { get; set; } = string.Empty;

    public string? ApplicationId { get; set; }

    [MaxLength(100, ErrorMessage = "Display name must be 100 characters or fewer")]
    public string? DisplayName { get; set; }
}