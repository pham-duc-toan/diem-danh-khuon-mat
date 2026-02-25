import { useEffect, useState } from "react";
import { Table, Tag, message } from "antd";
import dayjs from "dayjs";
import api from "../../services/api";

export default function StudentSchedule() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/classsessions");
      setSessions(res.data);
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
      title: "Bắt đầu",
      dataIndex: "startTime",
      render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Kết thúc",
      dataIndex: "endTime",
      render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Trạng thái",
      render: (_, record) => {
        const now = dayjs();
        const start = dayjs(record.startTime);
        const end = dayjs(record.endTime);

        if (now.isBefore(start)) return <Tag color="blue">Sắp tới</Tag>;
        if (now.isAfter(end)) return <Tag>Đã kết thúc</Tag>;
        return <Tag color="green">Đang diễn ra</Tag>;
      },
    },
    {
      title: "Điểm danh",
      dataIndex: "hasActiveAttendance",
      render: (v) =>
        v ? (
          <Tag color="green">Đang mở</Tag>
        ) : (
          <Tag color="default">Chưa mở</Tag>
        ),
    },
  ];

  return (
    <div>
      <h2>Lịch học của bạn</h2>
      <Table
        columns={columns}
        dataSource={sessions}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  );
}
