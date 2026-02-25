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
public class UsersController : ControllerBase
{
  private readonly AppDbContext _context;

  public UsersController(AppDbContext context)
  {
    _context = context;
  }

  [HttpGet]
  public async Task<IActionResult> GetAll([FromQuery] string? role)
  {
    var query = _context.Users.AsQueryable();
    if (!string.IsNullOrEmpty(role) && Enum.TryParse<UserRole>(role, true, out var r))
      query = query.Where(u => u.Role == r);

    var users = await query.OrderBy(u => u.FullName)
        .Select(u => new UserDto
        {
          Id = u.Id,
          Username = u.Username,
          FullName = u.FullName,
          StudentCode = u.StudentCode,
          Email = u.Email,
          Role = u.Role.ToString()
        }).ToListAsync();

    return Ok(users);
  }

  [HttpGet("{id}")]
  public async Task<IActionResult> GetById(int id)
  {
    var user = await _context.Users.FindAsync(id);
    if (user == null) return NotFound();

    return Ok(new UserDto
    {
      Id = user.Id,
      Username = user.Username,
      FullName = user.FullName,
      StudentCode = user.StudentCode,
      Email = user.Email,
      Role = user.Role.ToString()
    });
  }

  [HttpPut("{id}")]
  public async Task<IActionResult> Update(int id, [FromBody] RegisterRequest request)
  {
    var user = await _context.Users.FindAsync(id);
    if (user == null) return NotFound();

    user.FullName = request.FullName;
    user.StudentCode = request.StudentCode;
    user.Email = request.Email;
    if (!string.IsNullOrEmpty(request.Password))
      user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password);

    await _context.SaveChangesAsync();
    return Ok(new { message = "Cập nhật thành công" });
  }

  [HttpDelete("{id}")]
  public async Task<IActionResult> Delete(int id)
  {
    var user = await _context.Users.FindAsync(id);
    if (user == null) return NotFound();

    _context.Users.Remove(user);
    await _context.SaveChangesAsync();
    return Ok(new { message = "Xóa thành công" });
  }
}
