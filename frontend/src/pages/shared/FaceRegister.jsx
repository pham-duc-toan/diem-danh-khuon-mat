import { useRef, useEffect, useState, useCallback } from "react";
import * as faceapi from "face-api.js";
import {
  Button,
  Card,
  Select,
  Space,
  message,
  Spin,
  Alert,
  List,
  Typography,
} from "antd";
import { CameraOutlined, UserAddOutlined } from "@ant-design/icons";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function FaceRegister() {
  const { user } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [capturedDescriptors, setCapturedDescriptors] = useState([]);
  const streamRef = useRef(null);

  const isAdmin = user?.role === "Admin";

  useEffect(() => {
    loadModels();
    if (isAdmin) {
      loadStudents();
    } else {
      setSelectedStudent(user.id);
    }
    return () => stopCamera();
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
      console.error("Error loading models:", err);
      message.error(
        "Lỗi khi tải model nhận diện khuôn mặt. Hãy đảm bảo đã tải model vào thư mục public/models/",
      );
    }
  };

  const loadStudents = async () => {
    try {
      const res = await api.get("/users?role=Student");
      setStudents(res.data);
    } catch (err) {
      console.error(err);
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureDescriptor = async () => {
    if (!videoRef.current || !modelsLoaded) return;

    setCapturing(true);
    try {
      const detection = await faceapi
        .detectSingleFace(videoRef.current)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        message.warning(
          "Không phát hiện khuôn mặt. Hãy nhìn thẳng vào camera.",
        );
        setCapturing(false);
        return;
      }

      // Draw detection on canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const dims = faceapi.matchDimensions(canvas, videoRef.current, true);
        const resizedDetection = faceapi.resizeResults(detection, dims);
        canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
        faceapi.draw.drawDetections(canvas, [resizedDetection]);
        faceapi.draw.drawFaceLandmarks(canvas, [resizedDetection]);
      }

      const descriptor = Array.from(detection.descriptor);
      setCapturedDescriptors((prev) => [...prev, descriptor]);
      message.success(`Đã chụp mẫu ${capturedDescriptors.length + 1}`);
    } catch (err) {
      message.error("Lỗi khi nhận diện");
    } finally {
      setCapturing(false);
    }
  };

  const saveDescriptors = async () => {
    if (capturedDescriptors.length === 0) {
      message.warning("Chưa có mẫu nào được chụp");
      return;
    }

    if (!selectedStudent) {
      message.warning("Vui lòng chọn sinh viên");
      return;
    }

    try {
      // Get a snapshot image from video
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = videoRef.current.videoWidth;
      tempCanvas.height = videoRef.current.videoHeight;
      tempCanvas.getContext("2d").drawImage(videoRef.current, 0, 0);
      const imageBase64 = tempCanvas.toDataURL("image/jpeg", 0.8);

      // Save each descriptor
      for (const descriptor of capturedDescriptors) {
        await api.post("/facedata", {
          studentId: selectedStudent,
          faceDescriptor: JSON.stringify(descriptor),
          imageBase64,
        });
      }

      message.success(`Đã lưu ${capturedDescriptors.length} mẫu khuôn mặt`);
      setCapturedDescriptors([]);
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi khi lưu");
    }
  };

  return (
    <div>
      <h2>Đăng ký khuôn mặt</h2>

      {!modelsLoaded && (
        <Alert
          message="Đang tải model nhận diện..."
          description="Vui lòng đợi trong giây lát. Nếu lỗi, hãy đảm bảo đã tải model files vào public/models/"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 500px" }}>
          {isAdmin && (
            <Select
              style={{ width: "100%", marginBottom: 16 }}
              placeholder="Chọn sinh viên"
              onChange={setSelectedStudent}
              value={selectedStudent}
              showSearch
              optionFilterProp="children"
            >
              {students.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.fullName} ({s.studentCode || s.username})
                </Select.Option>
              ))}
            </Select>
          )}

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
                }}
              >
                <Typography.Text type="secondary">
                  Camera chưa bật
                </Typography.Text>
              </div>
            )}
          </div>

          <Space>
            {!cameraActive ? (
              <Button
                type="primary"
                icon={<CameraOutlined />}
                onClick={startCamera}
                disabled={!modelsLoaded}
              >
                Bật Camera
              </Button>
            ) : (
              <>
                <Button onClick={stopCamera}>Tắt Camera</Button>
                <Button
                  type="primary"
                  icon={<CameraOutlined />}
                  onClick={captureDescriptor}
                  loading={capturing}
                  disabled={!selectedStudent}
                >
                  Chụp mẫu ({capturedDescriptors.length}/5)
                </Button>
                <Button
                  type="primary"
                  icon={<UserAddOutlined />}
                  onClick={saveDescriptors}
                  disabled={capturedDescriptors.length === 0}
                  style={{ background: "#52c41a", borderColor: "#52c41a" }}
                >
                  Lưu dữ liệu
                </Button>
              </>
            )}
          </Space>
        </Card>

        <Card title="Hướng dẫn" style={{ flex: "0 1 300px" }}>
          <List
            size="small"
            dataSource={[
              "1. Chọn sinh viên cần đăng ký",
              "2. Bật camera và nhìn thẳng vào camera",
              "3. Chụp ít nhất 3-5 mẫu khuôn mặt",
              "4. Xoay nhẹ đầu giữa mỗi lần chụp",
              '5. Nhấn "Lưu dữ liệu" để hoàn tất',
            ]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
          {capturedDescriptors.length > 0 && (
            <Alert
              message={`Đã chụp ${capturedDescriptors.length} mẫu`}
              type="success"
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
