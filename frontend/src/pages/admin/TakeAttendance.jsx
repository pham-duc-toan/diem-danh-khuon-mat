import { useRef, useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
  Badge,
  Spin,
} from "antd";
import {
  CameraOutlined,
  StopOutlined,
  CheckCircleOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import api from "../../services/api";
import dayjs from "dayjs";

const MATCH_THRESHOLD = 0.5; // Lower is better for Euclidean distance
const AUTO_CHECKIN_CONFIDENCE = 0.7; // 70% confidence to auto check-in

export default function TakeAttendance() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const matcherRef = useRef(null);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState(null);
  const [checkedIn, setCheckedIn] = useState([]);
  const [faceDataLoaded, setFaceDataLoaded] = useState(false);
  const [lastDetection, setLastDetection] = useState(null);

  // Prevent duplicate check-in during detection loop
  const checkedInIdsRef = useRef(new Set());

  useEffect(() => {
    loadModels();
    loadSessionInfo();
    loadFaceData();
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
      message.error("Lỗi khi tải model nhận diện");
    }
  };

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

  const loadFaceData = async () => {
    try {
      const res = await api.get("/facedata");
      const faceDataList = res.data;

      if (faceDataList.length === 0) {
        message.warning("Chưa có dữ liệu khuôn mặt nào được đăng ký");
        setFaceDataLoaded(true);
        return;
      }

      // Group descriptors by studentId
      const studentDescriptors = {};
      for (const fd of faceDataList) {
        const desc = new Float32Array(JSON.parse(fd.faceDescriptor));
        if (!studentDescriptors[fd.studentId]) {
          studentDescriptors[fd.studentId] = {
            label: `${fd.studentId}|${fd.studentName}`,
            descriptors: [],
          };
        }
        studentDescriptors[fd.studentId].descriptors.push(desc);
      }

      const labeledDescriptors = Object.values(studentDescriptors).map(
        (sd) => new faceapi.LabeledFaceDescriptors(sd.label, sd.descriptors),
      );

      matcherRef.current = new faceapi.FaceMatcher(
        labeledDescriptors,
        MATCH_THRESHOLD,
      );
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startDetection = () => {
    if (!matcherRef.current) {
      message.warning("Chưa có dữ liệu khuôn mặt để so khớp");
      return;
    }
    setDetecting(true);
    detectLoop();
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

        // Draw box
        ctx.strokeStyle = isUnknown ? "#ff4d4f" : "#52c41a";
        ctx.lineWidth = 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Draw label
        const label = isUnknown
          ? "Không nhận diện được"
          : match.label.split("|")[1];
        const confidence = isUnknown ? 0 : 1 - match.distance;

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
        if (!isUnknown && confidence >= AUTO_CHECKIN_CONFIDENCE) {
          const studentId = parseInt(match.label.split("|")[0]);
          if (!checkedInIdsRef.current.has(studentId)) {
            checkedInIdsRef.current.add(studentId);
            performCheckIn(studentId, confidence);
          }
        }
      }

      setLastDetection(new Date().toLocaleTimeString());
    }

    animFrameRef.current = requestAnimationFrame(detectLoop);
  }, []);

  // Need to use useEffect to update detectLoop when detecting changes
  useEffect(() => {
    if (detecting) {
      detectLoop();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [detecting]);

  const performCheckIn = async (studentId, confidence) => {
    try {
      const res = await api.post("/attendance/checkin", {
        attendanceSessionId: parseInt(sessionId),
        studentId,
        faceConfidence: confidence,
      });
      setCheckedIn((prev) => [...prev, res.data]);
      message.success(`✅ ${res.data.studentName} đã điểm danh!`);
    } catch (err) {
      // Could be already checked in, ignore
      console.log("Check-in failed:", err.response?.data?.message);
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

      {!modelsLoaded && <Spin tip="Đang tải model nhận diện..." />}
      {!faceDataLoaded && modelsLoaded && (
        <Spin tip="Đang tải dữ liệu khuôn mặt..." />
      )}

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
                  Nhấn "Bật Camera" để bắt đầu
                </Typography.Text>
              </div>
            )}
          </div>

          {detecting && lastDetection && (
            <Alert
              message={`Đang quét liên tục... Lần quét gần nhất: ${lastDetection}`}
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
