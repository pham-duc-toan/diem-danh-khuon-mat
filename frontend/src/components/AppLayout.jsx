import { Layout, Menu, Button, Typography, Avatar, Dropdown } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  BookOutlined,
  ScheduleOutlined,
  CameraOutlined,
  ScanOutlined,
  LogoutOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const { Header, Sider, Content } = Layout;

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdmin = user?.role === "Admin";

  const adminMenuItems = [
    {
      key: "/admin/dashboard",
      icon: <DashboardOutlined />,
      label: "Dashboard",
    },
    { key: "/admin/users", icon: <UserOutlined />, label: "Quản lý tài khoản" },
    { key: "/admin/subjects", icon: <BookOutlined />, label: "Môn học" },
    {
      key: "/admin/class-sessions",
      icon: <ScheduleOutlined />,
      label: "Tiết học",
    },
    {
      key: "/admin/attendance-sessions",
      icon: <CheckCircleOutlined />,
      label: "Phiên điểm danh",
    },
    {
      key: "/admin/face-data",
      icon: <ScanOutlined />,
      label: "Dữ liệu khuôn mặt",
    },
    {
      key: "/admin/face-register",
      icon: <CameraOutlined />,
      label: "Đăng ký khuôn mặt",
    },
  ];

  const studentMenuItems = [
    { key: "/student/schedule", icon: <CalendarOutlined />, label: "Lịch học" },
    {
      key: "/student/checkin",
      icon: <ScanOutlined />,
      label: "Điểm danh",
    },
    {
      key: "/student/attendance",
      icon: <CheckCircleOutlined />,
      label: "Lịch sử điểm danh",
    },
    {
      key: "/student/face-register",
      icon: <CameraOutlined />,
      label: "Đăng ký khuôn mặt",
    },
  ];

  const menuItems = isAdmin ? adminMenuItems : studentMenuItems;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const userMenuItems = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        breakpoint="lg"
        collapsedWidth="80"
        style={{ background: "#001529" }}
      >
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 18,
            fontWeight: "bold",
          }}
        >
          📋 Điểm Danh
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          }}
        >
          <Typography.Title level={4} style={{ margin: 0 }}>
            Hệ thống điểm danh sinh viên
          </Typography.Title>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Button
              type="text"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <Avatar
                icon={<UserOutlined />}
                style={{ backgroundColor: isAdmin ? "#f56a00" : "#1890ff" }}
              />
              <span>
                {user?.fullName} ({user?.role})
              </span>
            </Button>
          </Dropdown>
        </Header>
        <Content
          style={{
            margin: 16,
            padding: 24,
            background: "#fff",
            borderRadius: 8,
            minHeight: 360,
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
