using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
  private readonly AppDbContext _context;
  private readonly IWebHostEnvironment _env;

  public AttendanceController(AppDbContext context, IWebHostEnvironment env)
  {
    _context = context;
    _env = env;
  }

  /// <summary>
  /// Check in a student via face recognition
  /// </summary>
  [HttpPost("checkin")]
  public async Task<IActionResult> CheckIn([FromBody] AttendanceCheckInDto dto)
  {
    var session = await _context.AttendanceSessions.FindAsync(dto.AttendanceSessionId);
    if (session == null || session.Status != AttendanceSessionStatus.Active)
      return BadRequest(new { message = "Phiên điểm danh không hợp lệ hoặc đã đóng" });

    // Check if already checked in
    var existing = await _context.Attendances
        .AnyAsync(a => a.AttendanceSessionId == dto.AttendanceSessionId && a.StudentId == dto.StudentId);
    if (existing)
      return BadRequest(new { message = "Sinh viên đã điểm danh rồi" });

    // Verify student exists
    var student = await _context.Users.FindAsync(dto.StudentId);
    if (student == null || student.Role != UserRole.Student)
      return BadRequest(new { message = "Sinh viên không tồn tại" });

    string? imagePath = null;
    if (!string.IsNullOrEmpty(dto.ImageBase64))
    {
      imagePath = await SaveImage(dto.ImageBase64, $"checkin_{dto.StudentId}_{DateTime.UtcNow:yyyyMMddHHmmss}");
    }

    var attendance = new Attendance
    {
      AttendanceSessionId = dto.AttendanceSessionId,
      StudentId = dto.StudentId,
      CheckInTime = DateTime.UtcNow,
      FaceConfidence = dto.FaceConfidence,
      ImagePath = imagePath
    };

    _context.Attendances.Add(attendance);
    await _context.SaveChangesAsync();

    return Ok(new AttendanceDto
    {
      Id = attendance.Id,
      StudentId = student.Id,
      StudentName = student.FullName,
      StudentCode = student.StudentCode,
      CheckInTime = attendance.CheckInTime,
      FaceConfidence = attendance.FaceConfidence
    });
  }

  /// <summary>
  /// Get attendance history for a student
  /// </summary>
  [HttpGet("student/{studentId}")]
  public async Task<IActionResult> GetStudentAttendance(int studentId)
  {
    var attendances = await _context.Attendances
        .Where(a => a.StudentId == studentId)
        .Include(a => a.AttendanceSession)
            .ThenInclude(s => s.ClassSession)
                .ThenInclude(cs => cs.Subject)
        .OrderByDescending(a => a.CheckInTime)
        .Select(a => new
        {
          a.Id,
          SubjectName = a.AttendanceSession.ClassSession.Subject.Name,
          SubjectCode = a.AttendanceSession.ClassSession.Subject.Code,
          Room = a.AttendanceSession.ClassSession.Room,
          SessionDate = a.AttendanceSession.ClassSession.StartTime,
          a.CheckInTime,
          a.FaceConfidence
        }).ToListAsync();

    return Ok(attendances);
  }

  private async Task<string> SaveImage(string base64, string fileName)
  {
    var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads", "checkins");
    Directory.CreateDirectory(uploadsDir);

    var bytes = Convert.FromBase64String(base64.Contains(",") ? base64.Split(",")[1] : base64);
    var path = Path.Combine(uploadsDir, $"{fileName}.jpg");
    await System.IO.File.WriteAllBytesAsync(path, bytes);

    return $"/uploads/checkins/{fileName}.jpg";
  }
}
