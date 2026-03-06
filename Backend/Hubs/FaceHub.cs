using System.Collections.Concurrent;
using System.Security.Claims;
using System.Text.Json;
using Backend.Data;
using Backend.Models;
using Backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Backend.Hubs;

/// <summary>
/// SignalR hub for real-time face recognition attendance.
/// Frontend streams camera frames → backend detects faces via Node face-service →
/// matches against stored descriptors → auto check-in → sends results back.
/// </summary>
[Authorize]
public class FaceHub : Hub
{
  private readonly FaceDetectionService _faceDetection;
  private readonly AttendanceSessionTracker _tracker;
  private readonly IServiceProvider _serviceProvider;
  private readonly ILogger<FaceHub> _logger;

  private const double MATCH_THRESHOLD = 0.5;         // Euclidean distance threshold

  // Track which session each connection is streaming for
  private static readonly ConcurrentDictionary<string, ConnectionInfo> _connections = new();

  public FaceHub(
      FaceDetectionService faceDetection,
      AttendanceSessionTracker tracker,
      IServiceProvider serviceProvider,
      ILogger<FaceHub> logger)
  {
    _faceDetection = faceDetection;
    _tracker = tracker;
    _serviceProvider = serviceProvider;
    _logger = logger;
  }

  /// <summary>
  /// Client joins an attendance session for face streaming.
  /// </summary>
  public async Task JoinSession(int sessionId)
  {
    var userId = GetUserId();
    var userRole = GetUserRole();

    // Create a scoped DbContext
    using var scope = _serviceProvider.CreateScope();
    var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

    // Verify session exists and is active
    var session = await context.AttendanceSessions.FindAsync(sessionId);
    if (session == null || session.Status != AttendanceSessionStatus.Active)
    {
      await Clients.Caller.SendAsync("Error", "Phiên điểm danh không hợp lệ hoặc đã đóng");
      return;
    }

    // Initialize tracker with already-checked-in students
    var checkedInIds = await context.Attendances
        .Where(a => a.AttendanceSessionId == sessionId)
        .Select(a => a.StudentId)
        .ToListAsync();
    _tracker.InitSession(sessionId, checkedInIds);

    // Store connection info
    _connections[Context.ConnectionId] = new ConnectionInfo
    {
      SessionId = sessionId,
      UserId = userId,
      UserRole = userRole
    };

    await Groups.AddToGroupAsync(Context.ConnectionId, $"session_{sessionId}");
    await Clients.Caller.SendAsync("SessionJoined", new { sessionId, alreadyCheckedIn = checkedInIds.Count });

    _logger.LogInformation("User {UserId} ({Role}) joined session {SessionId}", userId, userRole, sessionId);
  }

  /// <summary>
  /// Client sends a camera frame for face detection and matching.
  /// Returns detection results directly (request-response pattern for flow control).
  /// </summary>
  public async Task<List<FaceDetectionResult>> SendFrame(string base64Image)
  {
    if (!_connections.TryGetValue(Context.ConnectionId, out var connInfo))
    {
      return new List<FaceDetectionResult>();
    }

    try
    {
      // 1. Call the Node.js face-service to detect faces and extract descriptors
      await Clients.Caller.SendAsync("PipelineStatus", new { step = "face_service_call", message = "Đang gửi ảnh đến Face Service..." });
      var detectedFaces = await _faceDetection.DetectFacesAsync(base64Image);
      await Clients.Caller.SendAsync("PipelineStatus", new { step = "face_service_done", message = $"Face Service trả về {detectedFaces.Count} khuôn mặt", count = detectedFaces.Count });

      if (detectedFaces.Count == 0)
      {
        await Clients.Caller.SendAsync("PipelineStatus", new { step = "no_faces", message = "Không phát hiện khuôn mặt nào" });
        return new List<FaceDetectionResult>();
      }

      // 2. Load stored face data for comparison
      await Clients.Caller.SendAsync("PipelineStatus", new { step = "load_stored", message = "Đang tải dữ liệu khuôn mặt đã lưu..." });
      using var scope = _serviceProvider.CreateScope();
      var context = scope.ServiceProvider.GetRequiredService<AppDbContext>();

      List<StoredFace> storedFaces;

      if (connInfo.UserRole == "Student")
      {
        // Student mode: only compare against own face data
        storedFaces = await context.FaceDataSet
            .Where(f => f.StudentId == connInfo.UserId)
            .Select(f => new StoredFace
            {
              StudentId = f.StudentId,
              StudentName = f.Student.FullName,
              StudentCode = f.Student.StudentCode,
              DescriptorJson = f.FaceDescriptor
            })
            .ToListAsync();
      }
      else
      {
        // Admin mode: compare against ALL face data
        storedFaces = await context.FaceDataSet
            .Select(f => new StoredFace
            {
              StudentId = f.StudentId,
              StudentName = f.Student.FullName,
              StudentCode = f.Student.StudentCode,
              DescriptorJson = f.FaceDescriptor
            })
            .ToListAsync();
      }

      // Parse stored descriptors
      var parsedStored = storedFaces.Select(sf =>
      {
        sf.Descriptor = JsonSerializer.Deserialize<double[]>(sf.DescriptorJson) ?? Array.Empty<double>();
        return sf;
      }).Where(sf => sf.Descriptor.Length == 128).ToList();

      await Clients.Caller.SendAsync("PipelineStatus", new { step = "loaded_stored", message = $"Đã tải {parsedStored.Count} mẫu khuôn mặt để so sánh", count = parsedStored.Count });

      // 3. Match each detected face against stored data
      await Clients.Caller.SendAsync("PipelineStatus", new { step = "matching", message = "Đang so khớp khuôn mặt..." });
      var results = new List<FaceDetectionResult>();

      foreach (var face in detectedFaces)
      {
        if (face.Descriptor.Length != 128) continue;

        double bestDistance = double.MaxValue;
        StoredFace? bestMatch = null;

        foreach (var stored in parsedStored)
        {
          var distance = EuclideanDistance(face.Descriptor, stored.Descriptor);
          if (distance < bestDistance)
          {
            bestDistance = distance;
            bestMatch = stored;
          }
        }

        bool isUnknown = bestDistance > MATCH_THRESHOLD || bestMatch == null;
        double confidence = isUnknown ? 0 : 1.0 - bestDistance;
        bool checkedIn = false;

        if (!isUnknown && bestMatch != null)
        {
          await Clients.Caller.SendAsync("PipelineStatus", new { step = "match_found", message = $"Nhận diện: {bestMatch.StudentName} (confidence: {confidence:P0})" });
        }

        // 4. Auto check-in if matched
        if (!isUnknown && bestMatch != null)
        {
          if (!_tracker.IsCheckedIn(connInfo.SessionId, bestMatch.StudentId))
          {
            await Clients.Caller.SendAsync("PipelineStatus", new { step = "checkin_attempt", message = $"Đang điểm danh cho {bestMatch.StudentName}..." });
            checkedIn = await TryCheckIn(context, connInfo.SessionId, bestMatch.StudentId, confidence);
            if (checkedIn)
            {
              await Clients.Caller.SendAsync("PipelineStatus", new { step = "checkin_success", message = $"✅ Điểm danh thành công: {bestMatch.StudentName}" });
            }
          }
        }

        results.Add(new FaceDetectionResult
        {
          StudentId = isUnknown ? null : bestMatch?.StudentId,
          StudentName = isUnknown ? null : bestMatch?.StudentName,
          StudentCode = isUnknown ? null : bestMatch?.StudentCode,
          Confidence = confidence,
          Box = face.Box,
          IsUnknown = isUnknown,
          CheckedIn = checkedIn
        });
      }

      await Clients.Caller.SendAsync("PipelineStatus", new { step = "done", message = $"Hoàn tất xử lý: {results.Count} khuôn mặt" });
      return results;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error processing frame for connection {ConnectionId}", Context.ConnectionId);
      await Clients.Caller.SendAsync("PipelineStatus", new { step = "error", message = $"Lỗi xử lý frame: {ex.Message}" });
      return new List<FaceDetectionResult>();
    }
  }

  /// <summary>
  /// Client leaves the session.
  /// </summary>
  public async Task LeaveSession()
  {
    if (_connections.TryRemove(Context.ConnectionId, out var connInfo))
    {
      await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"session_{connInfo.SessionId}");
    }
  }

  public override Task OnDisconnectedAsync(Exception? exception)
  {
    _connections.TryRemove(Context.ConnectionId, out _);
    return base.OnDisconnectedAsync(exception);
  }

  /// <summary>
  /// Try to check in a student. Returns true if successful.
  /// </summary>
  private async Task<bool> TryCheckIn(AppDbContext context, int sessionId, int studentId, double confidence)
  {
    try
    {
      // Verify session is still active
      var session = await context.AttendanceSessions.FindAsync(sessionId);
      if (session == null || session.Status != AttendanceSessionStatus.Active)
        return false;

      // Check not already in DB (double-check)
      var exists = await context.Attendances
          .AnyAsync(a => a.AttendanceSessionId == sessionId && a.StudentId == studentId);
      if (exists)
      {
        _tracker.MarkCheckedIn(sessionId, studentId);
        return false;
      }

      var attendance = new Attendance
      {
        AttendanceSessionId = sessionId,
        StudentId = studentId,
        CheckInTime = DateTime.UtcNow,
        FaceConfidence = confidence
      };

      context.Attendances.Add(attendance);
      await context.SaveChangesAsync();

      _tracker.MarkCheckedIn(sessionId, studentId);

      // Notify ALL clients in the session about the new check-in
      var student = await context.Users.FindAsync(studentId);
      await Clients.Group($"session_{sessionId}").SendAsync("StudentCheckedIn", new
      {
        studentId,
        studentName = student?.FullName,
        studentCode = student?.StudentCode,
        checkInTime = attendance.CheckInTime,
        faceConfidence = confidence
      });

      _logger.LogInformation("Student {StudentId} checked in to session {SessionId} (confidence: {Confidence:F2})",
          studentId, sessionId, confidence);

      return true;
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error during check-in for student {StudentId} in session {SessionId}", studentId, sessionId);
      return false;
    }
  }

  private int GetUserId()
  {
    var claim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
    return int.TryParse(claim, out var id) ? id : 0;
  }

  private string GetUserRole()
  {
    return Context.User?.FindFirst(ClaimTypes.Role)?.Value ?? "Student";
  }

  private static double EuclideanDistance(double[] a, double[] b)
  {
    double sum = 0;
    for (int i = 0; i < Math.Min(a.Length, b.Length); i++)
    {
      double diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.Sqrt(sum);
  }
}

// --- Helper classes ---

public class ConnectionInfo
{
  public int SessionId { get; set; }
  public int UserId { get; set; }
  public string UserRole { get; set; } = string.Empty;
}

public class FaceDetectionResult
{
  public int? StudentId { get; set; }
  public string? StudentName { get; set; }
  public string? StudentCode { get; set; }
  public double Confidence { get; set; }
  public FaceBox Box { get; set; } = new();
  public bool IsUnknown { get; set; }
  public bool CheckedIn { get; set; }
}

public class StoredFace
{
  public int StudentId { get; set; }
  public string StudentName { get; set; } = string.Empty;
  public string? StudentCode { get; set; }
  public string DescriptorJson { get; set; } = string.Empty;
  public double[] Descriptor { get; set; } = Array.Empty<double>();
}
