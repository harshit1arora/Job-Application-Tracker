namespace JobTracker.Api.Models;

/// <summary>
/// Allowed values for document uploads, mirroring validation.ts.
/// </summary>
public static class DocumentValues
{
    public const string Pdf = "application/pdf";
    public const string Doc = "application/msword";
    public const string Docx =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    public static readonly IReadOnlyList<string> FileTypes = [Pdf, Doc, Docx];

    /// <summary>5 MB, matching MAX_FILE_SIZE_BYTES in the frontend.</summary>
    public const long MaxFileSizeBytes = 5 * 1024 * 1024;
}