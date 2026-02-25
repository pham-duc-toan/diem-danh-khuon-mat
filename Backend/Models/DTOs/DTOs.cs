using System.ComponentModel.DataAnnotations;

namespace Backend.Models.DTOs;

// ========== Auth DTOs ==========
public class LoginRequest
{
  [Required] public string Username { get; set; } = string.Empty;
  [Required] public string Password { get; set; } = string.Empty;
}

public class RegisterRequest
{
  [Required, MaxLength(100)] public string Username { get; set; } = string.Empty;
  [Required, MinLength(6)] public string Password { get; set; } = string.Empty;
  [Required, MaxLength(200)] public string FullName { get; set; } = string.Empty;
  [MaxLength(20)] public string? StudentCode { get; set; }
  [MaxLength(100)] public string? Email { get; set; }
  public string Role { get; set; } = "Student";
}

public class AuthResponse
{
  public string Token { get; set; } = string.Empty;
  public UserDto User { get; set; } = null!;
}

public class UserDto
{
  public int Id { get; set; }
  public string Username { get; set; } = string.Empty;
  public string FullName { get; set; } = string.Empty;
  public string? StudentCode { get; set; }
  public string? Email { get; set; }
  public string Role { get; set; } = string.Empty;
}

// ========== Subject DTOs ==========
public class SubjectCreateDto
{
  [Required, MaxLength(200)] public string Name { get; set; } = string.Empty;
  [Required, MaxLength(20)] public string Code { get; set; } = string.Empty;
}

public class SubjectDto
{
  public int Id { get; set; }
  public string Name { get; set; } = string.Empty;
  public string Code { get; set; } = string.Empty;
  public int StudentCount { get; set; }
}

// ========== ClassSession DTOs ==========
public class ClassSessionCreateDto
{
  [Required] public int SubjectId { get; set; }
  [Required, MaxLength(100)] public string Room { get; set; } = string.Empty;
  [Required] public DateTime StartTime { get; set; }
  [Required] public DateTime EndTime { get; set; }
}

public class ClassSessionDto
{
  public int Id { get; set; }
  public int SubjectId { get; set; }
  public string SubjectName { get; set; } = string.Empty;
  public string SubjectCode { get; set; } = string.Empty;
  public string Room { get; set; } = string.Empty;
  public DateTime StartTime { get; set; }
  public DateTime EndTime { get; set; }
  public bool HasActiveAttendance { get; set; }
}

// ========== AttendanceSession DTOs ==========
public class AttendanceSessionCreateDto
{
  [Required] public int ClassSessionId { get; set; }
}

public class AttendanceSessionDto
{
  public int Id { get; set; }
  public int ClassSessionId { get; set; }
  public string SubjectName { get; set; } = string.Empty;
  public string Room { get; set; } = string.Empty;
  public DateTime StartTime { get; set; }
  public DateTime? EndTime { get; set; }
  public string Status { get; set; } = string.Empty;
  public int AttendanceCount { get; set; }
  public int TotalStudents { get; set; }
}

// ========== Attendance DTOs ==========
public class AttendanceCheckInDto
{
  [Required] public int AttendanceSessionId { get; set; }
  [Required] public int StudentId { get; set; }
  [Required] public double FaceConfidence { get; set; }
  public string? ImageBase64 { get; set; }
}

public class AttendanceDto
{
  public int Id { get; set; }
  public int StudentId { get; set; }
  public string StudentName { get; set; } = string.Empty;
  public string? StudentCode { get; set; }
  public DateTime CheckInTime { get; set; }
  public double FaceConfidence { get; set; }
}

// ========== FaceData DTOs ==========
public class FaceDataCreateDto
{
  [Required] public int StudentId { get; set; }
  [Required] public string FaceDescriptor { get; set; } = string.Empty;
  public string? ImageBase64 { get; set; }
}

public class FaceDataDto
{
  public int Id { get; set; }
  public int StudentId { get; set; }
  public string StudentName { get; set; } = string.Empty;
  public string FaceDescriptor { get; set; } = string.Empty;
  public string? ImagePath { get; set; }
  public DateTime CreatedAt { get; set; }
}

// ========== Enrollment DTOs ==========
public class EnrollStudentDto
{
  [Required] public int StudentId { get; set; }
  [Required] public int SubjectId { get; set; }
}

// ========== Dashboard DTOs ==========
public class DashboardStats
{
  public int TotalStudents { get; set; }
  public int TotalSubjects { get; set; }
  public int TotalClassSessions { get; set; }
  public int ActiveAttendanceSessions { get; set; }
  public int TodayAttendanceCount { get; set; }
}
