using Microsoft.EntityFrameworkCore;
using Backend.Models;

namespace Backend.Data;

public class AppDbContext : DbContext
{
  public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

  public DbSet<User> Users => Set<User>();
  public DbSet<Subject> Subjects => Set<Subject>();
  public DbSet<StudentSubject> StudentSubjects => Set<StudentSubject>();
  public DbSet<ClassSession> ClassSessions => Set<ClassSession>();
  public DbSet<AttendanceSession> AttendanceSessions => Set<AttendanceSession>();
  public DbSet<Attendance> Attendances => Set<Attendance>();
  public DbSet<FaceData> FaceDataSet => Set<FaceData>();

  protected override void OnModelCreating(ModelBuilder modelBuilder)
  {
    base.OnModelCreating(modelBuilder);

    modelBuilder.Entity<User>(entity =>
    {
      entity.HasIndex(e => e.Username).IsUnique();
      entity.HasIndex(e => e.StudentCode).IsUnique().HasFilter("\"StudentCode\" IS NOT NULL");
      entity.Property(e => e.Role).HasConversion<string>();
    });

    modelBuilder.Entity<Subject>(entity =>
    {
      entity.HasIndex(e => e.Code).IsUnique();
    });

    modelBuilder.Entity<StudentSubject>(entity =>
    {
      entity.HasIndex(e => new { e.StudentId, e.SubjectId }).IsUnique();
    });

    modelBuilder.Entity<AttendanceSession>(entity =>
    {
      entity.Property(e => e.Status).HasConversion<string>();
    });

    modelBuilder.Entity<Attendance>(entity =>
    {
      entity.HasIndex(e => new { e.AttendanceSessionId, e.StudentId }).IsUnique();
    });

    // Seed admin user (password: admin123)
    modelBuilder.Entity<User>().HasData(new User
    {
      Id = 1,
      Username = "admin",
      PasswordHash = "$2a$11$KzeeAqEJOUESk2yg34M2sO0OjmZP0VjRzOysEZh/yymQK9O3BFKpa",
      FullName = "System Administrator",
      Role = UserRole.Admin,
      CreatedAt = new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc)
    });
  }
}
