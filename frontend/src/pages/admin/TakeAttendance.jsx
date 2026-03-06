import { useRef, useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  Space,
  message,
  Alert,
  List,
  Tag,
  Typography,
  Badge,
} from "antd";
import {
  CameraOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
  CloudServerOutlined,
  CodeOutlined,
} from "@ant-design/icons";
import api from "../../services/api";
import { createFaceHubConnection } from "../../services/faceHub";
import dayjs from "dayjs";

export default function TakeAttendance() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const hubRef = useRef(null);
  const detectingRef = useRef(false);
  const frameCanvasRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [checkedIn, setCheckedIn] = useState([]);
  const [lastDetection, setLastDetection] = useState(null);
  const [hubConnected, setHubConnected] = useState(false);
  const [hubStatus, setHubStatus] = useState("Đang kết nối...");
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

  const checkedInIdsRef = useRef(new Set());

  useEffect(() => {
    loadSessionInfo();
    connectHub();
    return () => {
      stopCamera();
      disconnectHub();
    };
  }, []);

  // --- SignalR Hub ---

  const connectHub = async () => {
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
        if (!checkedInIdsRef.current.has(data.studentId)) {
          checkedInIdsRef.current.add(data.studentId);
          setCheckedIn((prev) => [
            ...prev,
            {
              studentId: data.studentId,
              studentName: data.studentName,
              studentCode: data.studentCode,
              checkInTime: data.checkInTime,
              faceConfidence: data.faceConfidence,
            },
          ]);
          message.success(`✅ ${data.studentName} đã điểm danh!`);
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
        connection.invoke("JoinSession", parseInt(sessionId));
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
      await connection.invoke("JoinSession", parseInt(sessionId));
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
    }
  };

  // --- Session Info ---

  const loadSessionInfo = async () => {
    try {
      const res = await api.get(`/attendancesessions/${sessionId}`);
      setSessionInfo(res.data);
      setCheckedIn(res.data.attendances || []);
      checkedInIdsRef.current = new Set(
        (res.data.attendances || []).map((a) => a.studentId),
      );
    } catch (err) {
      message.error("Không tìm thấy phiên điểm danh");
    }
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

  // --- Detection Loop: capture frames → send to backend → draw results ---

  const startDetection = () => {
    if (!hubRef.current || !hubConnected) {
      message.warning("Chưa kết nối đến server nhận diện");
      return;
    }
    detectingRef.current = true;
    setDetecting(true);
    addLog("🚀", "Bắt đầu quét nhận diện khuôn mặt", "success");
    processFrame();
  };

  const stopDetection = () => {
    detectingRef.current = false;
    setDetecting(false);
    addLog("⏹️", "Dừng nhận diện");
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

      // Send frame to backend, get detection results back
      addLog("📤", "[FE] Gửi frame đến Backend qua SignalR...");
      const results = await hubRef.current.invoke("SendFrame", base64);
      addLog("📥", `[FE] Backend trả về ${results?.length || 0} kết quả`);
      drawResults(results);
      setLastDetection(new Date().toLocaleTimeString());
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

      // Scale box coordinates to match video element
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

  const handleCloseSession = async () => {
    try {
      await api.put(`/attendancesessions/${sessionId}/close`);
      message.success("Đã đóng phiên điểm danh");
      navigate(-1);
    } catch (err) {
      message.error("Lỗi");
    }
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          Quay lại
        </Button>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Điểm danh - {sessionInfo?.subjectName || "..."}
        </Typography.Title>
        {sessionInfo && (
          <Tag color={sessionInfo.status === "Active" ? "green" : "default"}>
            {sessionInfo.status === "Active" ? "Đang mở" : sessionInfo.status}
          </Tag>
        )}
      </Space>

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
                    style={{ background: "#52c41a", borderColor: "#52c41a" }}
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
                <Button
                  size="large"
                  onClick={handleCloseSession}
                  danger
                  type="primary"
                >
                  Đóng phiên điểm danh
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
          style={{ flex: "1 1 100%", marginBottom: 0 }}
          extra={
            <Button size="small" onClick={() => setPipelineLogs([])}>
              Xoá log
            </Button>
          }
        >
          <div
            style={{
              maxHeight: 200,
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
              <div style={{ color: "#888", textAlign: "center", padding: 16 }}>
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
                  <span style={{ color: "#888" }}>[{log.time}]</span> {log.icon}{" "}
                  {log.text}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </Card>

        <Card
          title={
            <Badge count={checkedIn.length} showZero>
              <span style={{ paddingRight: 16 }}>Đã điểm danh</span>
            </Badge>
          }
          style={{ flex: "0 1 350px", maxHeight: 600, overflow: "auto" }}
          extra={
            sessionInfo && (
              <Tag color="blue">
                {checkedIn.length}/{sessionInfo.totalStudents}
              </Tag>
            )
          }
        >
          <List
            size="small"
            dataSource={[...checkedIn].reverse()}
            renderItem={(att) => (
              <List.Item>
                <List.Item.Meta
                  avatar={
                    <CheckCircleOutlined
                      style={{ color: "#52c41a", fontSize: 20 }}
                    />
                  }
                  title={`${att.studentName} (${att.studentCode || "N/A"})`}
                  description={`${dayjs(att.checkInTime).format("HH:mm:ss")} | Độ tin cậy: ${(att.faceConfidence * 100).toFixed(1)}%`}
                />
              </List.Item>
            )}
            locale={{ emptyText: "Chưa có sinh viên nào" }}
          />
        </Card>
      </div>
    </div>
  );
}
