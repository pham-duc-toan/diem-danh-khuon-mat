import { useEffect, useState } from "react";
import { Table, Tag, message } from "antd";
import dayjs from "dayjs";
import api from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";

export default function StudentAttendanceHistory() {
  const { user } = useAuth();
  const [attendances, setAttendances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) loadAttendances();
  }, [user]);

  const loadAttendances = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/attendance/student/${user.id}`);
      setAttendances(res.data);
    } catch (err) {
      message.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: "Môn học", dataIndex: "subjectName" },
    { title: "Mã môn", dataIndex: "subjectCode" },
    { title: "Phòng", dataIndex: "room" },
    {
      title: "Ngày học",
      dataIndex: "sessionDate",
      render: (v) => dayjs(v).format("DD/MM/YYYY"),
    },
    {
      title: "Giờ điểm danh",
      dataIndex: "checkInTime",
      render: (v) => dayjs(v).format("HH:mm:ss"),
    },
    {
      title: "Độ tin cậy",
      dataIndex: "faceConfidence",
      render: (v) => (
        <Tag color={v > 0.7 ? "green" : v > 0.5 ? "orange" : "red"}>
          {(v * 100).toFixed(1)}%
        </Tag>
      ),
    },
  ];

  return (
    <div>
      <h2>Lịch sử điểm danh</h2>
      <Table
        columns={columns}
        dataSource={attendances}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />
    </div>
  );
}
