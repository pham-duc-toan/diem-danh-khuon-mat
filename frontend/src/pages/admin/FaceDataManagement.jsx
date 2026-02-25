import { useEffect, useState } from "react";
import { Table, Button, message, Popconfirm, Tag, Image } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import api from "../../services/api";

export default function FaceDataManagement() {
  const [faceData, setFaceData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/facedata");
      setFaceData(res.data);
    } catch (err) {
      message.error("Lỗi khi tải dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/facedata/${id}`);
      message.success("Xóa thành công");
      loadData();
    } catch (err) {
      message.error("Lỗi khi xóa");
    }
  };

  const columns = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "Sinh viên", dataIndex: "studentName" },
    {
      title: "Ảnh",
      dataIndex: "imagePath",
      render: (path) =>
        path ? (
          <Image
            src={path}
            width={60}
            height={60}
            style={{ objectFit: "cover", borderRadius: 4 }}
          />
        ) : (
          <Tag>Không có ảnh</Tag>
        ),
    },
    {
      title: "Descriptor",
      dataIndex: "faceDescriptor",
      render: (desc) => {
        try {
          const arr = JSON.parse(desc);
          return <Tag color="blue">{arr.length} dimensions</Tag>;
        } catch {
          return <Tag color="red">Invalid</Tag>;
        }
      },
    },
    {
      title: "Ngày tạo",
      dataIndex: "createdAt",
      render: (v) => dayjs(v).format("DD/MM/YYYY HH:mm"),
    },
    {
      title: "Hành động",
      render: (_, record) => (
        <Popconfirm
          title="Xóa dữ liệu khuôn mặt này?"
          onConfirm={() => handleDelete(record.id)}
        >
          <Button icon={<DeleteOutlined />} danger size="small" />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <h2>Quản lý dữ liệu khuôn mặt</h2>
      <Table
        columns={columns}
        dataSource={faceData}
        rowKey="id"
        loading={loading}
      />
    </div>
  );
}
