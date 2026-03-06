import { useRef, useEffect, useState, useCallback } from "react";
import {
  Button,
  Card,
  Space,
  message,
  Alert,
  List,
  Tag,
  Typography,
  Spin,
  Empty,
  Select,
} from "antd";
import {
  CameraOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ScanOutlined,
  CloudServerOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import api from "../../services/api";
import { createFaceHubConnection } from "../../services/faceHub";
import { useAuth } from "../../contexts/AuthContext";
import dayjs from "dayjs";

export default function StudentCheckIn() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const hubRef = useRef(null);
  const detectingRef = useRef(false);
  const frameCanvasRef = useRef(null);
  const selectedSessionRef = useRef(null);
  const checkedInRef = useRef(false);

  const [cameraActive, setCameraActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [checkInResult, setCheckInResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);
  const [hubConnected, setHubConnected] = useState(false);
  const [hubStatus, setHubStatus] = useState("Chờ chọn phiên...");
  const [pipelineLogs, setPipelineLogs] = useState([]);
  const logsEndRef = useRef(null);

  const addLog = useCallback((icon, text, type = "info") => {
    const time = new Date().toLocaleTimeString();
    setPipelineLogs((prev) => {
      const next = [
        ...prev,
        { time, icon, text, type, id: Date.now() + Math.random() },
      ];
      return next.length > 80 ? next.slice(-60) : next;
    });
    setTimeout(
      () => logsEndRef.current?.scrollIntoView({ behavior: "smooth" }),
      50,
    );
  }, []);

  useEffect(() => {
    loadActiveSessions();
    return () => {
      stopCamera();
      disconnectHub();
    };
  }, []);

  // --- SignalR Hub ---

  const connectHub = async (sessionId) => {
    // Disconnect previous hub if any
    await disconnectHub();

    try {
      addLog("🔌", "Đang kết nối SignalR Hub...");
      const connection = createFaceHubConnection();

      connection.on("PipelineStatus", (data) => {
        const iconMap = {
          face_service_call: "📤",
          face_service_done: "📥",
          no_faces: "😶",
          load_stored: "💾",
          loaded_stored: "📂",
          matching: "🔍",
          match_found: "✅",
          checkin_attempt: "⏳",
          checkin_success: "🎉",
          done: "✔️",
          error: "❌",
        };
        const typeMap = {
          error: "error",
          checkin_success: "success",
          match_found: "success",
          no_faces: "warning",
        };
        addLog(
          iconMap[data.step] || "ℹ️",
          `[BE] ${data.message}`,
          typeMap[data.step] || "info",
        );
      });

      connection.on("StudentCheckedIn", (data) => {
        if (data.studentId === user.id) {
          setCheckInResult(data);
          message.success("✅ Điểm danh thành công!");
          checkedInRef.current = true;
          // Stop detecting after successful check-in
          detectingRef.current = false;
          setDetecting(false);
        }
      });

      connection.on("SessionJoined", () => {
        setHubStatus("Đã kết nối & sẵn sàng");
        addLog("✅", "Đã tham gia phiên điểm danh", "success");
      });

      connection.on("Error", (msg) => {
        message.error(msg);
        addLog("❌", `Lỗi: ${msg}`, "error");
      });

      connection.onreconnecting(() => {
        setHubStatus("Đang kết nối lại...");
        setHubConnected(false);
        addLog("🔄", "Đang kết nối lại SignalR...", "warning");
      });

      connection.onreconnected(() => {
        setHubStatus("Đã kết nối lại");
        setHubConnected(true);
        addLog("✅", "Đã kết nối lại SignalR", "success");
        if (selectedSessionRef.current) {
          connection.invoke("JoinSession", selectedSessionRef.current);
        }
      });

      connection.onclose(() => {
        setHubStatus("Mất kết nối");
        setHubConnected(false);
        addLog("🔴", "Mất kết nối SignalR", "error");
      });

      await connection.start();
      addLog("✅", "Kết nối SignalR thành công", "success");
      hubRef.current = connection;
      setHubConnected(true);
      addLog("📡", `Đang tham gia phiên #${sessionId}...`);
      await connection.invoke("JoinSession", sessionId);
    } catch (err) {
      console.error("Hub connection error:", err);
      setHubStatus("Lỗi kết nối");
      addLog("❌", `Lỗi kết nối SignalR: ${err.message}`, "error");
      message.error("Không thể kết nối đến server nhận diện");
    }
  };

  const disconnectHub = async () => {
    if (hubRef.current) {
      try {
        await hubRef.current.invoke("LeaveSession");
        await hubRef.current.stop();
      } catch {
        // ignore
      }
      hubRef.current = null;
      setHubConnected(false);
    }
  };

  // --- Load Sessions ---

  const loadActiveSessions = async () => {
    try {
      const res = await api.get("/attendancesessions?status=Active");
      setActiveSessions(res.data);
      if (res.data.length === 1) {
        const sid = res.data[0].id;
        setSelectedSession(sid);
        selectedSessionRef.current = sid;
        connectHub(sid);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSessionChange = (val) => {
    setSelectedSession(val);
    selectedSessionRef.current = val;
    checkedInRef.current = false;
    setCheckInResult(null);
    setAlreadyCheckedIn(false);
    connectHub(val);
  };

  // --- Camera ---

  const startCamera = async () => {
    try {
      addLog("📷", "Đang mở camera...");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
      addLog("📷", "Camera đã sẵn sàng", "success");
    } catch (err) {
      addLog("❌", `Lỗi mở camera: ${err.message}`, "error");
      message.error("Không thể truy cập camera");
    }
  };

  const stopCamera = () => {
    stopDetection();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // --- Detection Loop ---

  const startDetection = () => {
    if (!hubRef.current || !hubConnected) {
      message.warning("Chưa kết nối đến server nhận diện");
      return;
    }
    if (!selectedSession) {
      message.warning("Vui lòng chọn phiên điểm danh");
      return;
    }
    checkedInRef.current = false;
    setAlreadyCheckedIn(false);
    setCheckInResult(null);
    detectingRef.current = true;
    setDetecting(true);
    addLog("🚀", "Bắt đầu quét nhận diện khuôn mặt", "success");
    processFrame();
  };

  const stopDetection = () => {
    detectingRef.current = false;
    setDetecting(false);
  };

  const processFrame = useCallback(async () => {
    if (!detectingRef.current || !videoRef.current || !hubRef.current) return;

    try {
      if (!frameCanvasRef.current) {
        frameCanvasRef.current = document.createElement("canvas");
      }
      const fc = frameCanvasRef.current;
      fc.width = videoRef.current.videoWidth || 640;
      fc.height = videoRef.current.videoHeight || 480;
      fc.getContext("2d").drawImage(videoRef.current, 0, 0);
      const base64 = fc.toDataURL("image/jpeg", 0.7);

      addLog("📤", "[FE] Gửi frame đến Backend qua SignalR...");
      const results = await hubRef.current.invoke("SendFrame", base64);
      addLog("📥", `[FE] Backend trả về ${results?.length || 0} kết quả`);
      drawResults(results);
      setLastDetection(new Date().toLocaleTimeString());

      // Check if backend returned a check-in for already existing record
      if (results) {
        for (const r of results) {
          if (
            !r.isUnknown &&
            r.studentId === user.id &&
            !r.checkedIn
          ) {
            // Might be already checked in
          }
        }
      }
    } catch (err) {
      console.error("Frame error:", err);
      addLog("❌", `[FE] Lỗi xử lý frame: ${err.message}`, "error");
    }

    if (detectingRef.current) {
      setTimeout(processFrame, 100);
    }
  }, []);

  const drawResults = (results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results || results.length === 0) return;

    for (const result of results) {
      const box = result.box;
      if (!box) continue;

      const scaleX =
        canvas.width / (box.imageWidth || result.imageWidth || canvas.width);
      const scaleY =
        canvas.height /
        (box.imageHeight || result.imageHeight || canvas.height);

      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const w = box.width * scaleX;
      const h = box.height * scaleY;

      ctx.strokeStyle = result.isUnknown ? "#ff4d4f" : "#52c41a";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);

      const label = result.isUnknown
        ? "Không nhận diện được"
        : result.studentName;
      const confidence = result.confidence;

      ctx.fillStyle = result.isUnknown ? "#ff4d4f" : "#52c41a";
      ctx.fillRect(x, y - 24, w, 24);
      ctx.fillStyle = "#fff";
      ctx.font = "14px sans-serif";
      ctx.fillText(
        `${label} (${(confidence * 100).toFixed(0)}%)`,
        x + 4,
        y - 6,
      );
    }
  };

  return (
    <div>
      <h2>
        <ScanOutlined /> Điểm danh
      </h2>

      {loading ? (
        <Spin tip="Đang tải..." />
      ) : activeSessions.length === 0 ? (
        <Empty
          description="Hiện không có phiên điểm danh nào đang mở"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <>
          {/* Server connection status */}
          <Alert
            message={
              <Space>
                <CloudServerOutlined />
                <span>Server nhận diện: {hubStatus}</span>
              </Space>
            }
            type={hubConnected ? "success" : "warning"}
            showIcon={false}
            style={{ marginBottom: 16 }}
          />

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Card style={{ flex: "1 1 500px" }}>
              {/* Session selector */}
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>Chọn phiên điểm danh: </Typography.Text>
                <Select
                  style={{ width: "100%", marginTop: 8 }}
                  placeholder="Chọn phiên điểm danh"
                  value={selectedSession}
                  onChange={handleSessionChange}
                  disabled={detecting}
                >
                  {activeSessions.map((s) => (
                    <Select.Option key={s.id} value={s.id}>
                      {s.subjectName} - {s.room} (mở lúc{" "}
                      {dayjs(s.startTime).format("HH:mm DD/MM")})
                    </Select.Option>
                  ))}
                </Select>
              </div>

              {/* Camera */}
              <div style={{ position: "relative", marginBottom: 16 }}>
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: "100%",
                    maxWidth: 640,
                    borderRadius: 8,
                    background: "#000",
                    display: cameraActive ? "block" : "none",
                  }}
                />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    maxWidth: 640,
                    display: cameraActive ? "block" : "none",
                  }}
                />
                {!cameraActive && (
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 640,
                      height: 360,
                      background: "#f0f0f0",
                      borderRadius: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      gap: 8,
                    }}
                  >
                    <CameraOutlined style={{ fontSize: 48, color: "#bbb" }} />
                    <Typography.Text type="secondary">
                      Nhấn &quot;Bật Camera&quot; để bắt đầu
                    </Typography.Text>
                  </div>
                )}
              </div>

              {detecting && lastDetection && (
                <Alert
                  message={`Đang quét liên tục (server-side)... Lần quét gần nhất: ${lastDetection}`}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <Space wrap>
                {!cameraActive ? (
                  <Button
                    type="primary"
                    icon={<CameraOutlined />}
                    onClick={startCamera}
                    disabled={!hubConnected}
                    size="large"
                  >
                    Bật Camera
                  </Button>
                ) : (
                  <>
                    {!detecting ? (
                      <Button
                        type="primary"
                        size="large"
                        onClick={startDetection}
                        icon={<CheckCircleOutlined />}
                        style={{
                          background: "#52c41a",
                          borderColor: "#52c41a",
                        }}
                        disabled={!selectedSession || !hubConnected}
                      >
                        Bắt đầu nhận diện
                      </Button>
                    ) : (
                      <Button
                        size="large"
                        onClick={stopDetection}
                        icon={<StopOutlined />}
                      >
                        Dừng nhận diện
                      </Button>
                    )}
                    <Button size="large" onClick={stopCamera} danger>
                      Tắt Camera
                    </Button>
                  </>
                )}
              </Space>
            </Card>

            {/* Pipeline Logs */}
            <Card
              title={
                <Space>
                  <CodeOutlined />
                  <span>Pipeline Logs</span>
                  <Tag>{pipelineLogs.length}</Tag>
                </Space>
              }
              style={{ flex: "1 1 500px" }}
              extra={
                <Button size="small" onClick={() => setPipelineLogs([])}>
                  Xoá log
                </Button>
              }
            >
              <div
                style={{
                  maxHeight: 220,
                  overflowY: "auto",
                  fontSize: 12,
                  fontFamily: "monospace",
                  background: "#1e1e1e",
                  color: "#d4d4d4",
                  borderRadius: 6,
                  padding: "8px 12px",
                }}
              >
                {pipelineLogs.length === 0 ? (
                  <div
                    style={{ color: "#888", textAlign: "center", padding: 16 }}
                  >
                    Chưa có log nào. Bắt đầu nhận diện để xem pipeline...
                  </div>
                ) : (
                  pipelineLogs.map((log) => (
                    <div
                      key={log.id}
                      style={{
                        padding: "2px 0",
                        color:
                          log.type === "error"
                            ? "#f5222d"
                            : log.type === "success"
                              ? "#52c41a"
                              : log.type === "warning"
                                ? "#faad14"
                                : "#d4d4d4",
                      }}
                    >
                      <span style={{ color: "#888" }}>[{log.time}]</span>{" "}
                      {log.icon} {log.text}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            </Card>

            {/* Result card */}
            <Card title="Kết quả điểm danh" style={{ flex: "0 1 320px" }}>
              {checkInResult ? (
                <div style={{ textAlign: "center" }}>
                  <CheckCircleOutlined
                    style={{ fontSize: 64, color: "#52c41a" }}
                  />
                  <Typography.Title
                    level={4}
                    style={{ color: "#52c41a", marginTop: 16 }}
                  >
                    Điểm danh thành công!
                  </Typography.Title>
                  <List size="small">
                    <List.Item>
                      <strong>Họ tên:</strong> {checkInResult.studentName}
                    </List.Item>
                    <List.Item>
                      <strong>MSSV:</strong>{" "}
                      {checkInResult.studentCode || "N/A"}
                    </List.Item>
                    <List.Item>
                      <strong>Thời gian:</strong>{" "}
                      {dayjs(checkInResult.checkInTime).format(
                        "HH:mm:ss DD/MM/YYYY",
                      )}
                    </List.Item>
                    <List.Item>
                      <strong>Độ tin cậy:</strong>{" "}
                      <Tag color="green">
                        {(checkInResult.faceConfidence * 100).toFixed(1)}%
                      </Tag>
                    </List.Item>
                  </List>
                </div>
              ) : alreadyCheckedIn ? (
                <div style={{ textAlign: "center" }}>
                  <CheckCircleOutlined
                    style={{ fontSize: 64, color: "#1890ff" }}
                  />
                  <Typography.Title
                    level={4}
                    style={{ color: "#1890ff", marginTop: 16 }}
                  >
                    Đã điểm danh rồi!
                  </Typography.Title>
                  <Typography.Text type="secondary">
                    Bạn đã điểm danh cho phiên này trước đó.
                  </Typography.Text>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "40px 0" }}>
                  <ScanOutlined style={{ fontSize: 48, color: "#bbb" }} />
                  <Typography.Paragraph
                    type="secondary"
                    style={{ marginTop: 16 }}
                  >
                    Bật camera, chọn phiên và bắt đầu nhận diện. Khi nhận diện
                    được khuôn mặt, server sẽ tự động điểm danh cho bạn.
                  </Typography.Paragraph>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
