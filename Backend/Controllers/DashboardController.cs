using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "Admin")]
public class DashboardController : ControllerBase
{
  private readonly AppDbContext _context;

  public DashboardController(AppDbContext context)
  {
    _context = context;
  }

  [HttpGet("stats")]
  public async Task<IActionResult> GetStats()
  {
    var today = DateTime.UtcNow.Date;

    var stats = new DashboardStats
    {
      TotalStudents = await _context.Users.CountAsync(u => u.Role == UserRole.Student),
      TotalSubjects = await _context.Subjects.CountAsync(),
      TotalClassSessions = await _context.ClassSessions.CountAsync(),
      ActiveAttendanceSessions = await _context.AttendanceSessions
            .CountAsync(a => a.Status == AttendanceSessionStatus.Active),
      TodayAttendanceCount = await _context.Attendances
            .CountAsync(a => a.CheckInTime.Date == today)
    };

    return Ok(stats);
  }
}
