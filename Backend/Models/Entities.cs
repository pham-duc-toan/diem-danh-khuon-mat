using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Backend.Models;

public enum UserRole
{
  Admin,
  Student
}

public class User
{
  [Key]
  public int Id { get; set; }

  [Required, MaxLength(100)]
  public string Username { get; set; } = string.Empty;

  [Required]
  public string PasswordHash { get; set; } = string.Empty;

  [Required, MaxLength(200)]
  public string FullName { get; set; } = string.Empty;

  [MaxLength(20)]
  public string? StudentCode { get; set; }

  [MaxLength(100)]
  public string? Email { get; set; }

  public UserRole Role { get; set; } = UserRole.Student;

  public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

  // Navigation
  public ICollection<FaceData> FaceDataList { get; set; } = new List<FaceData>();
  public ICollection<StudentSubject> StudentSubjects { get; set; } = new List<StudentSubject>();
  public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
}

public class Subject
{
  [Key]
  public int Id { get; set; }

  [Required, MaxLength(200)]
  public string Name { get; set; } = string.Empty;

  [Required, MaxLength(20)]
  public string Code { get; set; } = string.Empty;

  public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

  // Navigation
  public ICollection<ClassSession> ClassSessions { get; set; } = new List<ClassSession>();
  public ICollection<StudentSubject> StudentSubjects { get; set; } = new List<StudentSubject>();
}

public class StudentSubject
{
  [Key]
  public int Id { get; set; }

  public int StudentId { get; set; }
  [ForeignKey("StudentId")]
  public User Student { get; set; } = null!;

  public int SubjectId { get; set; }
  [ForeignKey("SubjectId")]
  public Subject Subject { get; set; } = null!;
}

public class ClassSession
{
  [Key]
  public int Id { get; set; }

  public int SubjectId { get; set; }
  [ForeignKey("SubjectId")]
  public Subject Subject { get; set; } = null!;

  [MaxLength(100)]
  public string Room { get; set; } = string.Empty;

  public DateTime StartTime { get; set; }
  public DateTime EndTime { get; set; }

  public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

  // Navigation
  public ICollection<AttendanceSession> AttendanceSessions { get; set; } = new List<AttendanceSession>();
}

public enum AttendanceSessionStatus
{
  Pending,
  Active,
  Closed
}

public class AttendanceSession
{
  [Key]
  public int Id { get; set; }

  public int ClassSessionId { get; set; }
  [ForeignKey("ClassSessionId")]
  public ClassSession ClassSession { get; set; } = null!;

  public DateTime StartTime { get; set; }
  public DateTime? EndTime { get; set; }

  public AttendanceSessionStatus Status { get; set; } = AttendanceSessionStatus.Pending;

  public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

  // Navigation
  public ICollection<Attendance> Attendances { get; set; } = new List<Attendance>();
}

public class Attendance
{
  [Key]
  public int Id { get; set; }

  public int AttendanceSessionId { get; set; }
  [ForeignKey("AttendanceSessionId")]
  public AttendanceSession AttendanceSession { get; set; } = null!;

  public int StudentId { get; set; }
  [ForeignKey("StudentId")]
  public User Student { get; set; } = null!;

  public DateTime CheckInTime { get; set; } = DateTime.UtcNow;

  public double FaceConfidence { get; set; }

  [MaxLength(500)]
  public string? ImagePath { get; set; }
}

public class FaceData
{
  [Key]
  public int Id { get; set; }

  public int StudentId { get; set; }
  [ForeignKey("StudentId")]
  public User Student { get; set; } = null!;

  /// <summary>
  /// JSON array of 128-dimensional face descriptor from face-api.js
  /// </summary>
  [Required]
  public string FaceDescriptor { get; set; } = string.Empty;

  [MaxLength(500)]
  public string? ImagePath { get; set; }

  public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
