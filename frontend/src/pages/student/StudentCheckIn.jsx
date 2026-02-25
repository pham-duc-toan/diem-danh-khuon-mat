import { useRef, useEffect, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
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
} from "@ant-design/icons";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import dayjs from "dayjs";

const MATCH_THRESHOLD = 0.5;
const AUTO_CHECKIN_CONFIDENCE = 0.7; // 70% confidence to auto check-in

export default function StudentCheckIn() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const matcherRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [activeSessions, setActiveSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [faceDataLoaded, setFaceDataLoaded] = useState(false);
  const [checkInResult, setCheckInResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alreadyCheckedIn, setAlreadyCheckedIn] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);
  const checkedInRef = useRef(false);
  const selectedSessionRef = useRef(null);

  useEffect(() => {
    loadModels();
    loadActiveSessions();
    loadMyFaceData();
    return () => {
      stopCamera();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const loadModels = async () => {
    try {
      const MODEL_URL = "/models";
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    } catch (err) {
      message.error("Lỗi khi tải model nhận diện khuôn mặt");
    }
  };

  const loadActiveSessions = async () => {
    try {
      const res = await api.get("/attendancesessions?status=Active");
      setActiveSessions(res.data);
      if (res.data.length === 1) {
        setSelectedSession(res.data[0].id);
        selectedSessionRef.current = res.data[0].id;
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMyFaceData = async () => {
    try {
      const res = await api.get(`/facedata/student/${user.id}`);
      const faceDataList = res.data;

      if (faceDataList.length === 0) {
        setFaceDataLoaded(true);
        return;
      }

      const descriptors = faceDataList.map(
        (fd) => new Float32Array(JSON.parse(fd.faceDescriptor)),
      );

      const labeled = new faceapi.LabeledFaceDescriptors(
        `${user.id}|${user.fullName}`,
        descriptors,
      );
      matcherRef.current = new faceapi.FaceMatcher([labeled], MATCH_THRESHOLD);
      setFaceDataLoaded(true);
    } catch (err) {
      console.error(err);
      message.error("Lỗi khi tải dữ liệu khuôn mặt");
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      message.error("Không thể truy cập camera");
    }
  };

  const stopCamera = () => {
    setDetecting(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startDetection = () => {
    if (!matcherRef.current) {
      message.warning("Bạn chưa đăng ký khuôn mặt. Vui lòng đăng ký trước.");
      return;
    }
    if (!selectedSession) {
      message.warning("Vui lòng chọn phiên điểm danh");
      return;
    }
    checkedInRef.current = false;
    setAlreadyCheckedIn(false);
    setCheckInResult(null);
    setDetecting(true);
  };

  const stopDetection = () => {
    setDetecting(false);
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  };

  const detectLoop = useCallback(async () => {
    if (!videoRef.current || !matcherRef.current) return;

    const detections = await faceapi
      .detectAllFaces(videoRef.current)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const canvas = canvasRef.current;
    if (canvas && videoRef.current) {
      const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
      const resized = faceapi.resizeResults(detections, dims);
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const detection of resized) {
        const match = matcherRef.current.findBestMatch(detection.descriptor);
        const box = detection.detection.box;
        const isUnknown = match.label === "unknown";
        const confidence = isUnknown ? 0 : 1 - match.distance;

        // Draw box
        ctx.strokeStyle = isUnknown ? "#ff4d4f" : "#52c41a";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw label
        const label = isUnknown
          ? "Không nhận diện được"
          : match.label.split("|")[1];

        ctx.fillStyle = isUnknown ? "#ff4d4f" : "#52c41a";
        ctx.fillRect(box.x, box.y - 24, box.width, 24);
        ctx.fillStyle = "#fff";
        ctx.font = "14px sans-serif";
        ctx.fillText(
          `${label} (${(confidence * 100).toFixed(0)}%)`,
          box.x + 4,
          box.y - 6,
        );

        // Auto check-in if recognized with >= 70% confidence
        if (
          !isUnknown &&
          confidence >= AUTO_CHECKIN_CONFIDENCE &&
          !checkedInRef.current
        ) {
          checkedInRef.current = true;
          performCheckIn(confidence);
        }
      }

      setLastDetection(new Date().toLocaleTimeString());
    }

    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, []);

  useEffect(() => {
    if (detecting) {
      detectLoop();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [detecting]);

  const performCheckIn = async (confidence) => {
    try {
      const res = await api.post("/attendance/checkin", {
        attendanceSessionId: selectedSessionRef.current,
        studentId: user.id,
        faceConfidence: confidence,
      });
      setCheckInResult(res.data);
      message.success("✅ Điểm danh thành công!");
    } catch (err) {
      const msg = err.response?.data?.message || "Lỗi khi điểm danh";
      if (msg.includes("đã điểm danh")) {
        setAlreadyCheckedIn(true);
        message.info("Bạn đã điểm danh rồi!");
      } else {
        message.error(msg);
        checkedInRef.current = false; // Allow retry
      }
    }
  };

  const hasFaceData = matcherRef.current !== null;

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
          {!hasFaceData && faceDataLoaded && (
            <Alert
              message="Chưa đăng ký khuôn mặt"
              description='Bạn cần đăng ký khuôn mặt trước khi điểm danh. Vào mục "Đăng ký khuôn mặt" trong menu bên trái.'
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          {!modelsLoaded && <Spin tip="Đang tải model nhận diện..." />}
          {!faceDataLoaded && modelsLoaded && (
            <Spin tip="Đang tải dữ liệu khuôn mặt..." />
          )}

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <Card style={{ flex: "1 1 500px" }}>
              {/* Session selector */}
              <div style={{ marginBottom: 16 }}>
                <Typography.Text strong>Chọn phiên điểm danh: </Typography.Text>
                <Select
                  style={{ width: "100%", marginTop: 8 }}
                  placeholder="Chọn phiên điểm danh"
                  value={selectedSession}
                  onChange={(val) => {
                    setSelectedSession(val);
                    selectedSessionRef.current = val;
                    // Reset check-in state when switching session
                    checkedInRef.current = false;
                    setCheckInResult(null);
                    setAlreadyCheckedIn(false);
                  }}
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
                      Nhấn "Bật Camera" để bắt đầu
                    </Typography.Text>
                  </div>
                )}
              </div>

              {/* Detection info */}
              {detecting && lastDetection && (
                <Alert
                  message={`Đang quét liên tục... Lần quét gần nhất: ${lastDetection}`}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              {/* Controls — same layout as admin */}
              <Space wrap>
                {!cameraActive ? (
                  <Button
                    type="primary"
                    icon={<CameraOutlined />}
                    onClick={startCamera}
                    disabled={!modelsLoaded || !faceDataLoaded}
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
                        disabled={!selectedSession || !hasFaceData}
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
                    Bật camera, chọn phiên và bắt đầu nhận diện. Khi độ tin cậy
                    ≥ 70%, hệ thống sẽ tự động điểm danh cho bạn.
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
