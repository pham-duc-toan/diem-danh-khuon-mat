using System.Collections.Concurrent;

namespace Backend.Services;

/// <summary>
/// Singleton service to track which students have been checked in per attendance session.
/// Prevents duplicate check-in attempts during the SignalR streaming loop.
/// </summary>
public class AttendanceSessionTracker
{
  // sessionId -> set of studentIds already checked in
  private readonly ConcurrentDictionary<int, ConcurrentDictionary<int, byte>> _checkedIn = new();

  public void InitSession(int sessionId, IEnumerable<int> studentIds)
  {
    var set = _checkedIn.GetOrAdd(sessionId, _ => new ConcurrentDictionary<int, byte>());
    foreach (var id in studentIds)
      set.TryAdd(id, 0);
  }

  public bool IsCheckedIn(int sessionId, int studentId)
  {
    return _checkedIn.TryGetValue(sessionId, out var set) && set.ContainsKey(studentId);
  }

  public void MarkCheckedIn(int sessionId, int studentId)
  {
    var set = _checkedIn.GetOrAdd(sessionId, _ => new ConcurrentDictionary<int, byte>());
    set.TryAdd(studentId, 0);
  }

  public void RemoveSession(int sessionId)
  {
    _checkedIn.TryRemove(sessionId, out _);
  }
}
