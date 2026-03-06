import { useRef, useEffect, useState } from "react";
import {
  Button,
  Card,
  Select,
  Space,
  message,
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
  const [cameraActive, setCameraActive] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [capturedCount, setCapturedCount] = useState(0);
  const streamRef = useRef(null);

  const isAdmin = user?.role === "Admin";

  useEffect(() => {
    if (isAdmin) {
      loadStudents();
    } else {
      setSelectedStudent(user.id);
    }
    return () => stopCamera();
  }, []);

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

  const captureFace = async () => {
    if (!videoRef.current) return;

    setCapturing(true);
    try {
      // Capture frame as base64
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = videoRef.current.videoWidth || 640;
      tempCanvas.height = videoRef.current.videoHeight || 480;
      tempCanvas.getContext("2d").drawImage(videoRef.current, 0, 0);
      const imageBase64 = tempCanvas.toDataURL("image/jpeg", 0.8);

      // Send image to backend - backend will detect face and extract descriptor
      await api.post("/facedata/register", {
        studentId: selectedStudent,
        imageBase64,
      });

      setCapturedCount((prev) => prev + 1);
      message.success(`Đã chụp và lưu mẫu ${capturedCount + 1}`);
    } catch (err) {
      message.error(
        err.response?.data?.message || "Lỗi khi chụp mẫu khuôn mặt",
      );
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div>
      <h2>Đăng ký khuôn mặt</h2>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <Card style={{ flex: "1 1 500px" }}>
          {isAdmin && (
            <Select
              style={{ width: "100%", marginBottom: 16 }}
              placeholder="Chọn sinh viên"
              onChange={(val) => {
                setSelectedStudent(val);
                setCapturedCount(0);
              }}
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
              >
                Bật Camera
              </Button>
            ) : (
              <>
                <Button onClick={stopCamera}>Tắt Camera</Button>
                <Button
                  type="primary"
                  icon={<CameraOutlined />}
                  onClick={captureFace}
                  loading={capturing}
                  disabled={!selectedStudent}
                >
                  Chụp mẫu ({capturedCount}/5)
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
              "5. Mỗi lần chụp sẽ tự động lưu vào hệ thống",
            ]}
            renderItem={(item) => <List.Item>{item}</List.Item>}
          />
          {capturedCount > 0 && (
            <Alert
              message={`Đã chụp và lưu ${capturedCount} mẫu`}
              type="success"
              style={{ marginTop: 16 }}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
