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
public class FaceDataController : ControllerBase
{
  private readonly AppDbContext _context;
  private readonly IWebHostEnvironment _env;

  public FaceDataController(AppDbContext context, IWebHostEnvironment env)
  {
    _context = context;
    _env = env;
  }

  /// <summary>
  /// Get all face data (for matching on client side)
  /// </summary>
  [HttpGet]
  public async Task<IActionResult> GetAll()
  {
    var faceData = await _context.FaceDataSet
        .Include(f => f.Student)
        .Select(f => new FaceDataDto
        {
          Id = f.Id,
          StudentId = f.StudentId,
          StudentName = f.Student.FullName,
          FaceDescriptor = f.FaceDescriptor,
          ImagePath = f.ImagePath,
          CreatedAt = f.CreatedAt
        }).ToListAsync();

    return Ok(faceData);
  }

  /// <summary>
  /// Get face data for a specific student
  /// </summary>
  [HttpGet("student/{studentId}")]
  public async Task<IActionResult> GetByStudent(int studentId)
  {
    var faceData = await _context.FaceDataSet
        .Where(f => f.StudentId == studentId)
        .Include(f => f.Student)
        .Select(f => new FaceDataDto
        {
          Id = f.Id,
          StudentId = f.StudentId,
          StudentName = f.Student.FullName,
          FaceDescriptor = f.FaceDescriptor,
          ImagePath = f.ImagePath,
          CreatedAt = f.CreatedAt
        }).ToListAsync();

    return Ok(faceData);
  }

  /// <summary>
  /// Register face data for a student
  /// </summary>
  [HttpPost]
  public async Task<IActionResult> Create([FromBody] FaceDataCreateDto dto)
  {
    var student = await _context.Users.FindAsync(dto.StudentId);
    if (student == null || student.Role != UserRole.Student)
      return BadRequest(new { message = "Sinh viên không tồn tại" });

    string? imagePath = null;
    if (!string.IsNullOrEmpty(dto.ImageBase64))
    {
      imagePath = await SaveImage(dto.ImageBase64, $"face_{dto.StudentId}_{DateTime.UtcNow:yyyyMMddHHmmss}");
    }

    var faceData = new FaceData
    {
      StudentId = dto.StudentId,
      FaceDescriptor = dto.FaceDescriptor,
      ImagePath = imagePath,
      CreatedAt = DateTime.UtcNow
    };

    _context.FaceDataSet.Add(faceData);
    await _context.SaveChangesAsync();

    return Ok(new FaceDataDto
    {
      Id = faceData.Id,
      StudentId = faceData.StudentId,
      StudentName = student.FullName,
      FaceDescriptor = faceData.FaceDescriptor,
      ImagePath = faceData.ImagePath,
      CreatedAt = faceData.CreatedAt
    });
  }

  /// <summary>
  /// Delete a face data entry
  /// </summary>
  [HttpDelete("{id}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Delete(int id)
  {
    var faceData = await _context.FaceDataSet.FindAsync(id);
    if (faceData == null) return NotFound();

    _context.FaceDataSet.Remove(faceData);
    await _context.SaveChangesAsync();

    return Ok(new { message = "Xóa thành công" });
  }

  /// <summary>
  /// Delete all face data for a student
  /// </summary>
  [HttpDelete("student/{studentId}")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> DeleteByStudent(int studentId)
  {
    var faceData = await _context.FaceDataSet.Where(f => f.StudentId == studentId).ToListAsync();
    _context.FaceDataSet.RemoveRange(faceData);
    await _context.SaveChangesAsync();

    return Ok(new { message = "Xóa thành công" });
  }

  private async Task<string> SaveImage(string base64, string fileName)
  {
    var uploadsDir = Path.Combine(_env.ContentRootPath, "Uploads", "faces");
    Directory.CreateDirectory(uploadsDir);

    var bytes = Convert.FromBase64String(base64.Contains(",") ? base64.Split(",")[1] : base64);
    var path = Path.Combine(uploadsDir, $"{fileName}.jpg");
    await System.IO.File.WriteAllBytesAsync(path, bytes);

    return $"/uploads/faces/{fileName}.jpg";
  }
}
