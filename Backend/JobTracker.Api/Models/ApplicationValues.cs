namespace JobTracker.Api.Models;

/// <summary>
/// Allowed values for application fields, mirroring the value sets
/// in the frontend's types.ts.
///
/// Declared as const so they can be used inside validation attributes,
/// which require compile-time constants. The lists are for runtime
/// checks such as validating query-string filters.
/// </summary>
public static class ApplicationValues
{
    public const string Saved = "Saved";
    public const string Applied = "Applied";
    public const string UnderReview = "Under Review";
    public const string Interview = "Interview";
    public const string Offer = "Offer";
    public const string Rejected = "Rejected";

    public static readonly IReadOnlyList<string> Statuses =
        [Saved, Applied, UnderReview, Interview, Offer, Rejected];

    public const string Greenhouse = "Greenhouse";
    public const string Lever = "Lever";
    public const string Ashby = "Ashby";
    public const string Workday = "Workday";
    public const string LinkedIn = "LinkedIn";
    public const string Other = "Other";

    public static readonly IReadOnlyList<string> Sources =
        [Greenhouse, Lever, Ashby, Workday, LinkedIn, Other];
}