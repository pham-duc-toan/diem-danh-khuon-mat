import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Select,
  Space,
  message,
  Popconfirm,
  Tag,
  Drawer,
  List,
  Typography,
  Badge,
} from "antd";
import {
  PlusOutlined,
  StopOutlined,
  DeleteOutlined,
  EyeOutlined,
  CameraOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import api from "../../services/api";

export default function AttendanceSessionsManagement() {
  const [sessions, setSessions] = useState([]);
  const [classSessions, setClassSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedClassSession, setSelectedClassSession] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionDetail, setSessionDetail] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, classRes] = await Promise.all([
        api.get("/attendancesessions"),
        api.get("/classsessions"),
      ]);
      setSessions(sessionsRes.data);
      setClassSessions(classRes.data);
    } catch (err) {
      message.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedClassSession) {
      message.warning("Vui lòng chọn tiết học");
      return;
    }
    try {
      await api.post("/attendancesessions", {
        classSessionId: selectedClassSession,
      });
      message.success("Mở phiên điểm danh thành công");
      setModalOpen(false);
      loadData();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi");
    }
  };

  const handleClose = async (id) => {
    try {
      await api.put(`/attendancesessions/${id}/close`);
      message.success("Đã đóng phiên điểm danh");
      loadData();
    } catch (err) {
      message.error("Lỗi");
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/attendancesessions/${id}`);
      message.success("Xóa thành công");
      loadData();
    } catch (err) {
      message.error("Lỗi");
    }
  };

  const viewDetail = async (id) => {
    try {
      const res = await api.get(`/attendancesessions/${id}`);
      setSessionDetail(res.data);
      setDrawerOpen(true);
    } catch (err) {
      message.error("Lỗi");
    }
  };

  const statusColors = {
    Active: "green",
    Closed: "default",
    Pending: "orange",
  };

  const statusLabels = {
    Active: "Đang mở",
    Closed: "Đã đóng",
    Pending: "Chờ",
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "Môn học", dataIndex: "subjectName" },
    { title: "Phòng", dataIndex: "room" },
    {
      title: "Bắt đầu",
      dataIndex: "startTime",
      render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Kết thúc",
      dataIndex: "endTime",
      render: (v) => (v ? dayjs(v).format("DD/MM/YYYY HH:mm") : "-"),
    },
    {
      title: "Trạng thái",
      dataIndex: "status",
      render: (status) => (
        <Tag color={statusColors[status]}>{statusLabels[status] || status}</Tag>
      ),
    },
    {
      title: "Điểm danh",
      render: (_, record) => (
        <Badge count={record.attendanceCount} showZero>
          <Tag>
            {record.attendanceCount}/{record.totalStudents}
          </Tag>
        </Badge>
      ),
    },
    {
      title: "Hành động",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EyeOutlined />}
            onClick={() => viewDetail(record.id)}
            size="small"
          />
          {record.status === "Active" && (
            <>
              <Button
                icon={<CameraOutlined />}
                type="primary"
                size="small"
                onClick={() => navigate(`/admin/take-attendance/${record.id}`)}
              >
                Điểm danh
              </Button>
              <Popconfirm
                title="Đóng phiên điểm danh?"
                onConfirm={() => handleClose(record.id)}
              >
                <Button icon={<StopOutlined />} size="small" danger />
              </Popconfirm>
            </>
          )}
          <Popconfirm
            title="Xóa phiên này?"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2>Quản lý phiên điểm danh</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setModalOpen(true)}
        >
          Mở phiên mới
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={sessions}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="Mở phiên điểm danh mới"
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleCreate}
      >
        <p>Chọn tiết học để mở phiên điểm danh:</p>
        <Select
          style={{ width: "100%" }}
          placeholder="Chọn tiết học"
          onChange={setSelectedClassSession}
          value={selectedClassSession}
        >
          {classSessions.map((cs) => (
            <Select.Option key={cs.id} value={cs.id}>
              {cs.subjectName} - {cs.room} (
              {dayjs(cs.startTime).format("DD/MM HH:mm")})
            </Select.Option>
          ))}
        </Select>
      </Modal>

      <Drawer
        title={`Chi tiết phiên điểm danh #${sessionDetail?.id || ""}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
      >
        {sessionDetail && (
          <>
            <p>
              <strong>Môn học:</strong> {sessionDetail.subjectName}
            </p>
            <p>
              <strong>Phòng:</strong> {sessionDetail.room}
            </p>
            <p>
              <strong>Trạng thái:</strong>{" "}
              <Tag color={statusColors[sessionDetail.status]}>
                {statusLabels[sessionDetail.status]}
              </Tag>
            </p>
            <p>
              <strong>Đã điểm danh:</strong> {sessionDetail.attendanceCount}/
              {sessionDetail.totalStudents}
            </p>

            <h4>Danh sách điểm danh</h4>
            <List
              dataSource={sessionDetail.attendances || []}
              renderItem={(att) => (
                <List.Item>
                  <List.Item.Meta
                    title={`${att.studentName} (${att.studentCode || "N/A"})`}
                    description={`Thời gian: ${dayjs(att.checkInTime).format("HH:mm:ss")} | Độ tin cậy: ${(att.faceConfidence * 100).toFixed(1)}%`}
                  />
                </List.Item>
              )}
              locale={{ emptyText: "Chưa có sinh viên nào điểm danh" }}
            />
          </>
        )}
      </Drawer>
    </div>
  );
}
