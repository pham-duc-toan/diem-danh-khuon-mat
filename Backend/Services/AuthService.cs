using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Backend.Data;
using Backend.Models;
using Backend.Models.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace Backend.Services;

public interface IAuthService
{
  Task<AuthResponse?> Login(LoginRequest request);
  Task<AuthResponse?> Register(RegisterRequest request);
  string GenerateToken(User user);
}

public class AuthService : IAuthService
{
  private readonly AppDbContext _context;
  private readonly IConfiguration _config;

  public AuthService(AppDbContext context, IConfiguration config)
  {
    _context = context;
    _config = config;
  }

  public async Task<AuthResponse?> Login(LoginRequest request)
  {
    var user = await _context.Users.FirstOrDefaultAsync(u => u.Username == request.Username);
    if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
      return null;

    return new AuthResponse
    {
      Token = GenerateToken(user),
      User = MapToDto(user)
    };
  }

  public async Task<AuthResponse?> Register(RegisterRequest request)
  {
    if (await _context.Users.AnyAsync(u => u.Username == request.Username))
      return null;

    var user = new User
    {
      Username = request.Username,
      PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
      FullName = request.FullName,
      StudentCode = request.StudentCode,
      Email = request.Email,
      Role = request.Role == "Admin" ? UserRole.Admin : UserRole.Student,
      CreatedAt = DateTime.UtcNow
    };

    _context.Users.Add(user);
    await _context.SaveChangesAsync();

    return new AuthResponse
    {
      Token = GenerateToken(user),
      User = MapToDto(user)
    };
  }

  public string GenerateToken(User user)
  {
    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

    var claims = new[]
    {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role.ToString()),
            new Claim("fullName", user.FullName)
        };

    var token = new JwtSecurityToken(
        issuer: _config["Jwt:Issuer"],
        audience: _config["Jwt:Audience"],
        claims: claims,
        expires: DateTime.UtcNow.AddHours(24),
        signingCredentials: creds
    );

    return new JwtSecurityTokenHandler().WriteToken(token);
  }

  private static UserDto MapToDto(User user) => new()
  {
    Id = user.Id,
    Username = user.Username,
    FullName = user.FullName,
    StudentCode = user.StudentCode,
    Email = user.Email,
    Role = user.Role.ToString()
  };
}
