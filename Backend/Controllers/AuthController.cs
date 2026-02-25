using Backend.Models;
using Backend.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Backend.Services;

namespace Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
  private readonly IAuthService _authService;

  public AuthController(IAuthService authService)
  {
    _authService = authService;
  }

  [HttpPost("login")]
  public async Task<IActionResult> Login([FromBody] LoginRequest request)
  {
    var result = await _authService.Login(request);
    if (result == null)
      return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng" });
    return Ok(result);
  }

  [HttpPost("register")]
  [Authorize(Roles = "Admin")]
  public async Task<IActionResult> Register([FromBody] RegisterRequest request)
  {
    var result = await _authService.Register(request);
    if (result == null)
      return BadRequest(new { message = "Tên đăng nhập đã tồn tại" });
    return Ok(result);
  }

  [HttpGet("me")]
  [Authorize]
  public IActionResult Me()
  {
    var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
    var username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;
    var role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
    var fullName = User.FindFirst("fullName")?.Value;

    return Ok(new UserDto
    {
      Id = userId,
      Username = username ?? "",
      FullName = fullName ?? "",
      Role = role ?? ""
    });
  }
}
