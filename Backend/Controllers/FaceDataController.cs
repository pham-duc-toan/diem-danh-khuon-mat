using System.Text.Json;
using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;
using Backend.Services;
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
  private readonly FaceDetectionService _faceDetection;

  public FaceDataController(AppDbContext context, IWebHostEnvironment env, FaceDetectionService faceDetection)
  {
    _context = context;
    _env = env;
    _faceDetection = faceDetection;
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
  /// Register face from image - backend detects face and extracts descriptor via face-service.
  /// </summary>
  [HttpPost("register")]
  public async Task<IActionResult> RegisterFace([FromBody] FaceRegisterDto dto)
  {
    var student = await _context.Users.FindAsync(dto.StudentId);
    if (student == null || student.Role != UserRole.Student)
      return BadRequest(new { message = "Sinh viên không tồn tại" });

    // Call face-service to detect face and extract descriptor
    var detectedFaces = await _faceDetection.DetectFacesAsync(dto.ImageBase64);
    if (detectedFaces.Count == 0)
      return BadRequest(new { message = "Không phát hiện khuôn mặt trong ảnh. Hãy nhìn thẳng vào camera." });

    if (detectedFaces.Count > 1)
      return BadRequest(new { message = "Phát hiện nhiều hơn 1 khuôn mặt. Hãy đảm bảo chỉ có 1 người trong khung hình." });

    var face = detectedFaces[0];
    if (face.Descriptor.Length != 128)
      return BadRequest(new { message = "Không thể trích xuất đặc trưng khuôn mặt. Hãy thử lại." });

    string? imagePath = await SaveImage(dto.ImageBase64, $"face_{dto.StudentId}_{DateTime.UtcNow:yyyyMMddHHmmss}");

    var faceData = new FaceData
    {
      StudentId = dto.StudentId,
      FaceDescriptor = JsonSerializer.Serialize(face.Descriptor),
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
