using JobTracker.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace JobTracker.Api.Data;

/// <summary>
/// EF Core DbContext — maps Application, DocumentMetadata, and Reminder
/// to PostgreSQL tables. Column names use snake_case to match Postgres conventions.
/// </summary>
public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Application> Applications => Set<Application>();
    public DbSet<DocumentMetadata> Documents => Set<DocumentMetadata>();
    public DbSet<Reminder> Reminders => Set<Reminder>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // --- Applications ---
        modelBuilder.Entity<Application>(e =>
        {
            e.ToTable("applications");
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).HasColumnName("id").HasMaxLength(50);
            e.Property(a => a.UserId).HasColumnName("user_id").IsRequired().HasMaxLength(128);
            e.Property(a => a.Company).HasColumnName("company").IsRequired().HasMaxLength(100);
            e.Property(a => a.JobTitle).HasColumnName("job_title").IsRequired().HasMaxLength(150);
            e.Property(a => a.ApplicationSource).HasColumnName("application_source").IsRequired().HasMaxLength(50);
            e.Property(a => a.Status).HasColumnName("status").IsRequired().HasMaxLength(50);
            e.Property(a => a.ApplicationUrl).HasColumnName("application_url").HasMaxLength(500);
            e.Property(a => a.JobDescription).HasColumnName("job_description").HasMaxLength(5000);
            e.Property(a => a.SalaryRange).HasColumnName("salary_range").HasMaxLength(50);
            e.Property(a => a.Location).HasColumnName("location").HasMaxLength(100);
            e.Property(a => a.Notes).HasColumnName("notes").HasMaxLength(2000);
            e.Property(a => a.FollowUpDate).HasColumnName("follow_up_date").HasMaxLength(10);
            e.Property(a => a.MatchScore).HasColumnName("match_score");
            e.Property(a => a.CreatedAt).HasColumnName("created_at").IsRequired().HasMaxLength(50);
            e.Property(a => a.UpdatedAt).HasColumnName("updated_at").IsRequired().HasMaxLength(50);
            e.HasIndex(a => a.UserId).HasDatabaseName("ix_applications_user_id");
        });

        // --- Documents ---
        modelBuilder.Entity<DocumentMetadata>(e =>
        {
            e.ToTable("documents");
            e.HasKey(d => d.Id);
            e.Property(d => d.Id).HasColumnName("id").HasMaxLength(50);
            e.Property(d => d.UserId).HasColumnName("user_id").IsRequired().HasMaxLength(128);
            e.Property(d => d.ApplicationId).HasColumnName("application_id").HasMaxLength(50);
            e.Property(d => d.FileName).HasColumnName("file_name").IsRequired().HasMaxLength(255);
            e.Property(d => d.FileType).HasColumnName("file_type").IsRequired().HasMaxLength(100);
            e.Property(d => d.FileSize).HasColumnName("file_size");
            e.Property(d => d.StorageRef).HasColumnName("storage_ref").HasMaxLength(500);
            e.Property(d => d.DisplayName).HasColumnName("display_name").HasMaxLength(255);
            e.Property(d => d.CreatedAt).HasColumnName("created_at").IsRequired().HasMaxLength(50);
            e.HasIndex(d => d.UserId).HasDatabaseName("ix_documents_user_id");
        });

        // --- Reminders ---
        modelBuilder.Entity<Reminder>(e =>
        {
            e.ToTable("reminders");
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).HasColumnName("id").HasMaxLength(50);
            e.Property(r => r.UserId).HasColumnName("user_id").IsRequired().HasMaxLength(128);
            e.Property(r => r.ApplicationId).HasColumnName("application_id").IsRequired().HasMaxLength(50);
            e.Property(r => r.ReminderDate).HasColumnName("reminder_date").IsRequired().HasMaxLength(30);
            e.Property(r => r.Type).HasColumnName("type").IsRequired().HasMaxLength(50);
            e.Property(r => r.Message).HasColumnName("message").HasMaxLength(500);
            e.Property(r => r.IsCompleted).HasColumnName("is_completed");
            e.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired().HasMaxLength(50);
            e.HasIndex(r => r.UserId).HasDatabaseName("ix_reminders_user_id");
        });
    }
}
