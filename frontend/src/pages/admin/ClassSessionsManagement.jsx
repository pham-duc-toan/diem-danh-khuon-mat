import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Select,
  Input,
  DatePicker,
  Space,
  message,
  Popconfirm,
  Tag,
} from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../services/api";

export default function ClassSessionsManagement() {
  const [sessions, setSessions] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sessionsRes, subjectsRes] = await Promise.all([
        api.get("/classsessions"),
        api.get("/subjects"),
      ]);
      setSessions(sessionsRes.data);
      setSubjects(subjectsRes.data);
    } catch (err) {
      message.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSession(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (session) => {
    setEditingSession(session);
    form.setFieldsValue({
      subjectId: session.subjectId,
      room: session.room,
      startTime: dayjs(session.startTime),
      endTime: dayjs(session.endTime),
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/classsessions/${id}`);
      message.success("Xóa thành công");
      loadData();
    } catch (err) {
      message.error("Lỗi khi xóa");
    }
  };

  const handleSubmit = async (values) => {
    const data = {
      subjectId: values.subjectId,
      room: values.room,
      startTime: values.startTime.toISOString(),
      endTime: values.endTime.toISOString(),
    };
    try {
      if (editingSession) {
        await api.put(`/classsessions/${editingSession.id}`, data);
        message.success("Cập nhật thành công");
      } else {
        await api.post("/classsessions", data);
        message.success("Tạo tiết học thành công");
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
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
      title: "Điểm danh",
      dataIndex: "hasActiveAttendance",
      render: (v) =>
        v ? <Tag color="green">Đang mở</Tag> : <Tag>Chưa mở</Tag>,
    },
    {
      title: "Hành động",
      render: (_, record) => (
        <Space>
          <Button
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Popconfirm
            title="Bạn chắc chắn?"
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
        <h2>Quản lý tiết học</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Thêm tiết học
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={sessions}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingSession ? "Sửa tiết học" : "Thêm tiết học"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="subjectId"
            label="Môn học"
            rules={[{ required: true }]}
          >
            <Select placeholder="Chọn môn học">
              {subjects.map((s) => (
                <Select.Option key={s.id} value={s.id}>
                  {s.code} - {s.name}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="room" label="Phòng" rules={[{ required: true }]}>
            <Input placeholder="VD: A101" />
          </Form.Item>
          <Form.Item
            name="startTime"
            label="Thời gian bắt đầu"
            rules={[{ required: true }]}
          >
            <DatePicker
              showTime
              format="DD/MM/YYYY HH:mm"
              style={{ width: "100%" }}
            />
          </Form.Item>
          <Form.Item
            name="endTime"
            label="Thời gian kết thúc"
            rules={[{ required: true }]}
          >
            <DatePicker
              showTime
              format="DD/MM/YYYY HH:mm"
              style={{ width: "100%" }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
