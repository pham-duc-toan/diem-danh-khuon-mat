using System.Text.Json;

namespace Backend.Services;

/// <summary>
/// Calls the Node.js face-service to detect faces and extract descriptors from images.
/// </summary>
public class FaceDetectionService
{
  private readonly HttpClient _httpClient;
  private readonly ILogger<FaceDetectionService> _logger;

  public FaceDetectionService(HttpClient httpClient, ILogger<FaceDetectionService> logger)
  {
    _httpClient = httpClient;
    _logger = logger;
  }

  /// <summary>
  /// Send an image to the face-service and get detected faces with 128-dim descriptors.
  /// </summary>
  public async Task<List<DetectedFace>> DetectFacesAsync(string base64Image)
  {
    try
    {
      var payload = JsonSerializer.Serialize(new { image = base64Image });
      var content = new StringContent(payload, System.Text.Encoding.UTF8, "application/json");

      var response = await _httpClient.PostAsync("/detect", content);

      if (!response.IsSuccessStatusCode)
      {
        _logger.LogWarning("Face service returned {StatusCode}", response.StatusCode);
        return new List<DetectedFace>();
      }

      var json = await response.Content.ReadAsStringAsync();
      var result = JsonSerializer.Deserialize<FaceDetectionResponse>(json, new JsonSerializerOptions
      {
        PropertyNameCaseInsensitive = true
      });

      return result?.Faces ?? new List<DetectedFace>();
    }
    catch (Exception ex)
    {
      _logger.LogError(ex, "Error calling face detection service");
      return new List<DetectedFace>();
    }
  }

  /// <summary>
  /// Check if the face-service is healthy and models are loaded.
  /// </summary>
  public async Task<bool> IsHealthyAsync()
  {
    try
    {
      var response = await _httpClient.GetAsync("/health");
      if (!response.IsSuccessStatusCode) return false;
      var json = await response.Content.ReadAsStringAsync();
      var result = JsonSerializer.Deserialize<HealthResponse>(json, new JsonSerializerOptions
      {
        PropertyNameCaseInsensitive = true
      });
      return result?.Status == "ready";
    }
    catch
    {
      return false;
    }
  }
}

// Response models from the Node.js face-service
public class FaceDetectionResponse
{
  public List<DetectedFace> Faces { get; set; } = new();
}

public class DetectedFace
{
  public double[] Descriptor { get; set; } = Array.Empty<double>();
  public FaceBox Box { get; set; } = new();
  public double Score { get; set; }
  public int ImageWidth { get; set; }
  public int ImageHeight { get; set; }
}

public class FaceBox
{
  public double X { get; set; }
  public double Y { get; set; }
  public double Width { get; set; }
  public double Height { get; set; }
}

public class HealthResponse
{
  public string Status { get; set; } = string.Empty;
}
