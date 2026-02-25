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
public class ClassSessionsController : ControllerBase
{
  private readonly AppDbContext _context;

  public ClassSessionsController(AppDbContext context)
  {
    _context = context;
  }

  [HttpGet]
  public async Task<IActionResult> GetAll([FromQuery] int? subjectId)
  {
    var query = _context.ClassSessions
        .Include(cs => cs.Subject)
        .Include(cs => cs.AttendanceSessions)
        .AsQueryable();

    if (subjectId.HasValue)
      query = query.Where(cs => cs.SubjectId == subjectId.Value);

    // If student, only show their enrolled subjects
    var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
    if (role == "Student")
    {
      var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
      var enrolledSubjectIds = await _context.StudentSubjects
          .Where(ss => ss.StudentId == userId)
          .Select(ss => ss.SubjectId)
          .ToListAsync();
      query = query.Where(cs => enrolledSubjectIds.Contains(cs.SubjectId));
    }

    var sessions = await query.OrderByDescending(cs => cs.StartTime)
        .Select(cs => new ClassSessionDto
        {
          Id = cs.Id,
          SubjectId = cs.SubjectId,
          SubjectName = cs.Subject.Name,
          SubjectCode = cs.Subject.Code,
          Room = cs.Room,
          StartTime = cs.StartTime,
          EndTime = cs.EndTime,
          HasActiveAttendance = cs.AttendanceSessions.Any(a => a.Status == AttendanceSessionStatus.Active)
        }).ToListAsync();

    return Ok(sessions);
  }

  [HttpGet("{id}")]
  public async Task<IActionResult> GetById(int id)
  {
    var cs = await _context.ClassSessions
        .Include(c => c.Subject)
        .Include(c => c.AttendanceSessions)
        .FirstOrDefaultAsync(c => c.Id == id);
    if (cs == null) return NotFound();

    return Ok(new ClassSessionDto
    {
      Id = cs.Id,
      SubjectId = cs.SubjectId,
      SubjectName = cs.Subject.Name,
      SubjectCode = cs.Subject.Code,
      Room = cs.Room,
      StartTime = cs.StartTime,
      EndTime = cs.EndTime,
      HasActiveAttendance = cs.AttendanceSessions.Any(a => a.Status == AttendanceSessionStatus.Active)
    });
  }

  [HttpPost]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Create([FromBody] ClassSessionCreateDto dto)
  {
    var subject = await _context.Subjects.FindAsync(dto.SubjectId);
    if (subject == null)
      return BadRequest(new { message = "Môn học không tồn tại" });

    var session = new ClassSession
    {
      SubjectId = dto.SubjectId,
      Room = dto.Room,
      StartTime = dto.StartTime,
      EndTime = dto.EndTime,
      CreatedAt = DateTime.UtcNow
    };

    _context.ClassSessions.Add(session);
    await _context.SaveChangesAsync();

    return Ok(new ClassSessionDto
    {
      Id = session.Id,
      SubjectId = session.SubjectId,
      SubjectName = subject.Name,
      SubjectCode = subject.Code,
      Room = session.Room,
      StartTime = session.StartTime,
      EndTime = session.EndTime
    });
  }

  [HttpPut("{id}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Update(int id, [FromBody] ClassSessionCreateDto dto)
  {
    var session = await _context.ClassSessions.FindAsync(id);
    if (session == null) return NotFound();

    session.SubjectId = dto.SubjectId;
    session.Room = dto.Room;
    session.StartTime = dto.StartTime;
    session.EndTime = dto.EndTime;

    await _context.SaveChangesAsync();
    return Ok(new { message = "Cập nhật thành công" });
  }

  [HttpDelete("{id}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Delete(int id)
  {
    var session = await _context.ClassSessions.FindAsync(id);
    if (session == null) return NotFound();

    _context.ClassSessions.Remove(session);
    await _context.SaveChangesAsync();
    return Ok(new { message = "Xóa thành công" });
  }
}
