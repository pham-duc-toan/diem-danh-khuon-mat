import { useEffect, useState } from "react";
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  message,
  Popconfirm,
  Tag,
  Drawer,
  List,
  Select,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  UserDeleteOutlined,
} from "@ant-design/icons";
import api from "../../services/api";

export default function SubjectsManagement() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState(null);
  const [form] = Form.useForm();

  // Enrollment drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  useEffect(() => {
    loadSubjects();
  }, []);

  const loadSubjects = async () => {
    setLoading(true);
    try {
      const res = await api.get("/subjects");
      setSubjects(res.data);
    } catch (err) {
      message.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSubject(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (subject) => {
    setEditingSubject(subject);
    form.setFieldsValue({ name: subject.name, code: subject.code });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/subjects/${id}`);
      message.success("Xóa thành công");
      loadSubjects();
    } catch (err) {
      message.error("Lỗi khi xóa");
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingSubject) {
        await api.put(`/subjects/${editingSubject.id}`, values);
        message.success("Cập nhật thành công");
      } else {
        await api.post("/subjects", values);
        message.success("Tạo môn học thành công");
      }
      setModalOpen(false);
      loadSubjects();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi");
    }
  };

  const openEnrollDrawer = async (subject) => {
    setSelectedSubject(subject);
    setDrawerOpen(true);
    try {
      const [studentsRes, enrolledRes] = await Promise.all([
        api.get("/users?role=Student"),
        api.get(`/subjects/${subject.id}/students`),
      ]);
      setAllStudents(studentsRes.data);
      setEnrolledStudents(enrolledRes.data);
    } catch (err) {
      message.error("Lỗi khi tải dữ liệu");
    }
  };

  const handleEnroll = async (studentId) => {
    try {
      await api.post(`/subjects/${selectedSubject.id}/enroll`, {
        studentId,
        subjectId: selectedSubject.id,
      });
      message.success("Ghi danh thành công");
      const res = await api.get(`/subjects/${selectedSubject.id}/students`);
      setEnrolledStudents(res.data);
      loadSubjects();
    } catch (err) {
      message.error(err.response?.data?.message || "Lỗi");
    }
  };

  const handleUnenroll = async (studentId) => {
    try {
      await api.delete(`/subjects/${selectedSubject.id}/enroll/${studentId}`);
      message.success("Hủy ghi danh thành công");
      const res = await api.get(`/subjects/${selectedSubject.id}/students`);
      setEnrolledStudents(res.data);
      loadSubjects();
    } catch (err) {
      message.error("Lỗi");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "Mã môn", dataIndex: "code" },
    { title: "Tên môn học", dataIndex: "name" },
    {
      title: "Sinh viên",
      dataIndex: "studentCount",
      render: (count) => <Tag color="blue">{count} SV</Tag>,
    },
    {
      title: "Hành động",
      render: (_, record) => (
        <Space>
          <Button
            icon={<TeamOutlined />}
            onClick={() => openEnrollDrawer(record)}
            size="small"
          >
            Ghi danh
          </Button>
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

  const unenrolledStudents = allStudents.filter(
    (s) => !enrolledStudents.find((e) => e.id === s.id),
  );

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <h2>Quản lý môn học</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Thêm môn học
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={subjects}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingSubject ? "Sửa môn học" : "Thêm môn học"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="code"
            label="Mã môn học"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="name"
            label="Tên môn học"
            rules={[{ required: true }]}
          >
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`Ghi danh sinh viên - ${selectedSubject?.name || ""}`}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={500}
      >
        <h4>Thêm sinh viên</h4>
        {unenrolledStudents.length > 0 ? (
          <Select
            style={{ width: "100%", marginBottom: 16 }}
            placeholder="Chọn sinh viên để ghi danh"
            onChange={handleEnroll}
            value={null}
          >
            {unenrolledStudents.map((s) => (
              <Select.Option key={s.id} value={s.id}>
                {s.fullName} ({s.studentCode || s.username})
              </Select.Option>
            ))}
          </Select>
        ) : (
          <p style={{ color: "#999" }}>Tất cả sinh viên đã được ghi danh</p>
        )}

        <h4>Danh sách đã ghi danh ({enrolledStudents.length})</h4>
        <List
          dataSource={enrolledStudents}
          renderItem={(student) => (
            <List.Item
              actions={[
                <Popconfirm
                  key="unenroll"
                  title="Hủy ghi danh sinh viên này?"
                  onConfirm={() => handleUnenroll(student.id)}
                >
                  <Button icon={<UserDeleteOutlined />} danger size="small" />
                </Popconfirm>,
              ]}
            >
              <List.Item.Meta
                title={student.fullName}
                description={student.studentCode || student.username}
              />
            </List.Item>
          )}
        />
      </Drawer>
    </div>
  );
}
