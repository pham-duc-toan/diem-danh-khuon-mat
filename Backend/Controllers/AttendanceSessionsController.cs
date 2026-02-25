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
public class AttendanceSessionsController : ControllerBase
{
  private readonly AppDbContext _context;

  public AttendanceSessionsController(AppDbContext context)
  {
    _context = context;
  }

  [HttpGet]
  public async Task<IActionResult> GetAll([FromQuery] int? classSessionId, [FromQuery] string? status)
  {
    var query = _context.AttendanceSessions
        .Include(a => a.ClassSession).ThenInclude(cs => cs.Subject)
        .Include(a => a.Attendances)
        .AsQueryable();

    if (classSessionId.HasValue)
      query = query.Where(a => a.ClassSessionId == classSessionId.Value);

    if (!string.IsNullOrEmpty(status) && Enum.TryParse<AttendanceSessionStatus>(status, true, out var s))
      query = query.Where(a => a.Status == s);

    var sessions = await query.OrderByDescending(a => a.StartTime)
        .Select(a => new AttendanceSessionDto
        {
          Id = a.Id,
          ClassSessionId = a.ClassSessionId,
          SubjectName = a.ClassSession.Subject.Name,
          Room = a.ClassSession.Room,
          StartTime = a.StartTime,
          EndTime = a.EndTime,
          Status = a.Status.ToString(),
          AttendanceCount = a.Attendances.Count,
          TotalStudents = a.ClassSession.Subject.StudentSubjects.Count
        }).ToListAsync();

    return Ok(sessions);
  }

  [HttpGet("{id}")]
  public async Task<IActionResult> GetById(int id)
  {
    var a = await _context.AttendanceSessions
        .Include(x => x.ClassSession).ThenInclude(cs => cs.Subject).ThenInclude(s => s.StudentSubjects)
        .Include(x => x.Attendances).ThenInclude(att => att.Student)
        .FirstOrDefaultAsync(x => x.Id == id);

    if (a == null) return NotFound();

    return Ok(new
    {
      a.Id,
      a.ClassSessionId,
      SubjectName = a.ClassSession.Subject.Name,
      Room = a.ClassSession.Room,
      a.StartTime,
      a.EndTime,
      Status = a.Status.ToString(),
      AttendanceCount = a.Attendances.Count,
      TotalStudents = a.ClassSession.Subject.StudentSubjects.Count,
      Attendances = a.Attendances.Select(att => new AttendanceDto
      {
        Id = att.Id,
        StudentId = att.StudentId,
        StudentName = att.Student.FullName,
        StudentCode = att.Student.StudentCode,
        CheckInTime = att.CheckInTime,
        FaceConfidence = att.FaceConfidence
      }).OrderBy(att => att.CheckInTime).ToList()
    });
  }

  [HttpPost]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Create([FromBody] AttendanceSessionCreateDto dto)
  {
    var classSession = await _context.ClassSessions
        .Include(cs => cs.Subject)
        .FirstOrDefaultAsync(cs => cs.Id == dto.ClassSessionId);
    if (classSession == null)
      return BadRequest(new { message = "Tiết học không tồn tại" });

    // Check if there's already an active session
    var existing = await _context.AttendanceSessions
        .AnyAsync(a => a.ClassSessionId == dto.ClassSessionId && a.Status == AttendanceSessionStatus.Active);
    if (existing)
      return BadRequest(new { message = "Đã có phiên điểm danh đang hoạt động" });

    var session = new AttendanceSession
    {
      ClassSessionId = dto.ClassSessionId,
      StartTime = DateTime.UtcNow,
      Status = AttendanceSessionStatus.Active,
      CreatedAt = DateTime.UtcNow
    };

    _context.AttendanceSessions.Add(session);
    await _context.SaveChangesAsync();

    return Ok(new AttendanceSessionDto
    {
      Id = session.Id,
      ClassSessionId = session.ClassSessionId,
      SubjectName = classSession.Subject.Name,
      Room = classSession.Room,
      StartTime = session.StartTime,
      Status = session.Status.ToString(),
      AttendanceCount = 0,
      TotalStudents = await _context.StudentSubjects.CountAsync(ss => ss.SubjectId == classSession.SubjectId)
    });
  }

  [HttpPut("{id}/close")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Close(int id)
  {
    var session = await _context.AttendanceSessions.FindAsync(id);
    if (session == null) return NotFound();

    session.Status = AttendanceSessionStatus.Closed;
    session.EndTime = DateTime.UtcNow;
    await _context.SaveChangesAsync();

    return Ok(new { message = "Đã đóng phiên điểm danh" });
  }

  [HttpDelete("{id}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Delete(int id)
  {
    var session = await _context.AttendanceSessions
        .Include(a => a.Attendances)
        .FirstOrDefaultAsync(a => a.Id == id);
    if (session == null) return NotFound();

    _context.Attendances.RemoveRange(session.Attendances);
    _context.AttendanceSessions.Remove(session);
    await _context.SaveChangesAsync();

    return Ok(new { message = "Xóa thành công" });
  }
}
