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
public class SubjectsController : ControllerBase
{
  private readonly AppDbContext _context;

  public SubjectsController(AppDbContext context)
  {
    _context = context;
  }

  [HttpGet]
  public async Task<IActionResult> GetAll()
  {
    var subjects = await _context.Subjects
        .Include(s => s.StudentSubjects)
        .OrderBy(s => s.Name)
        .Select(s => new SubjectDto
        {
          Id = s.Id,
          Name = s.Name,
          Code = s.Code,
          StudentCount = s.StudentSubjects.Count
        }).ToListAsync();

    return Ok(subjects);
  }

  [HttpGet("{id}")]
  public async Task<IActionResult> GetById(int id)
  {
    var subject = await _context.Subjects
        .Include(s => s.StudentSubjects)
        .FirstOrDefaultAsync(s => s.Id == id);
    if (subject == null) return NotFound();

    return Ok(new SubjectDto
    {
      Id = subject.Id,
      Name = subject.Name,
      Code = subject.Code,
      StudentCount = subject.StudentSubjects.Count
    });
  }

  [HttpPost]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Create([FromBody] SubjectCreateDto dto)
  {
    if (await _context.Subjects.AnyAsync(s => s.Code == dto.Code))
      return BadRequest(new { message = "Mã môn học đã tồn tại" });

    var subject = new Subject
    {
      Name = dto.Name,
      Code = dto.Code,
      CreatedAt = DateTime.UtcNow
    };

    _context.Subjects.Add(subject);
    await _context.SaveChangesAsync();

    return Ok(new SubjectDto
    {
      Id = subject.Id,
      Name = subject.Name,
      Code = subject.Code,
      StudentCount = 0
    });
  }

  [HttpPut("{id}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Update(int id, [FromBody] SubjectCreateDto dto)
  {
    var subject = await _context.Subjects.FindAsync(id);
    if (subject == null) return NotFound();

    subject.Name = dto.Name;
    subject.Code = dto.Code;
    await _context.SaveChangesAsync();

    return Ok(new { message = "Cập nhật thành công" });
  }

  [HttpDelete("{id}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Delete(int id)
  {
    var subject = await _context.Subjects.FindAsync(id);
    if (subject == null) return NotFound();

    _context.Subjects.Remove(subject);
    await _context.SaveChangesAsync();
    return Ok(new { message = "Xóa thành công" });
  }

  // ========== Enrollment ==========
  [HttpGet("{id}/students")]
  public async Task<IActionResult> GetStudents(int id)
  {
    var students = await _context.StudentSubjects
        .Where(ss => ss.SubjectId == id)
        .Include(ss => ss.Student)
        .Select(ss => new UserDto
        {
          Id = ss.Student.Id,
          Username = ss.Student.Username,
          FullName = ss.Student.FullName,
          StudentCode = ss.Student.StudentCode,
          Email = ss.Student.Email,
          Role = ss.Student.Role.ToString()
        }).ToListAsync();

    return Ok(students);
  }

  [HttpPost("{id}/enroll")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> EnrollStudent(int id, [FromBody] EnrollStudentDto dto)
  {
    if (await _context.StudentSubjects.AnyAsync(ss => ss.StudentId == dto.StudentId && ss.SubjectId == id))
      return BadRequest(new { message = "Sinh viên đã được ghi danh" });

    _context.StudentSubjects.Add(new StudentSubject
    {
      StudentId = dto.StudentId,
      SubjectId = id
    });
    await _context.SaveChangesAsync();

    return Ok(new { message = "Ghi danh thành công" });
  }

  [HttpDelete("{id}/enroll/{studentId}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> UnenrollStudent(int id, int studentId)
  {
    var enrollment = await _context.StudentSubjects
        .FirstOrDefaultAsync(ss => ss.StudentId == studentId && ss.SubjectId == id);
    if (enrollment == null) return NotFound();

    _context.StudentSubjects.Remove(enrollment);
    await _context.SaveChangesAsync();

    return Ok(new { message = "Hủy ghi danh thành công" });
  }
}
