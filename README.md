# Hệ Thống Điểm Danh Sinh Viên Bằng Nhận Diện Khuôn Mặt

Ứng dụng web điểm danh sinh viên sử dụng nhận diện khuôn mặt realtime qua camera.

## Công nghệ sử dụng

| Thành phần          | Công nghệ                   |
| ------------------- | --------------------------- |
| Backend             | ASP.NET Core 9 Web API      |
| Frontend            | React (Vite) + Ant Design   |
| Database            | PostgreSQL 16 (Docker)      |
| Nhận diện khuôn mặt | face-api.js (TensorFlow.js) |
| Authentication      | JWT Bearer Token            |

## Kiến trúc

```
chuyendehttt/
├── docker-compose.yml          # PostgreSQL database
├── Backend/                    # ASP.NET Core Web API
│   ├── Controllers/            # API Controllers
│   ├── Models/                 # Entity models & DTOs
│   ├── Data/                   # DbContext & migrations
│   ├── Services/               # Business logic
│   └── Uploads/                # Stored images
└── frontend/                   # React SPA
    ├── src/
    │   ├── components/         # Layout, ProtectedRoute
    │   ├── contexts/           # AuthContext
    │   ├── pages/
    │   │   ├── admin/          # Admin pages
    │   │   ├── student/        # Student pages
    │   │   └── shared/         # Face registration
    │   └── services/           # Axios API client
    └── public/models/          # face-api.js model files
```

## Tính năng

### Admin

- Dashboard thống kê tổng quan
- Quản lý tài khoản (sinh viên, admin)
- Quản lý môn học + ghi danh sinh viên
- Quản lý tiết học (lịch học)
- Tạo & quản lý phiên điểm danh
- Đăng ký khuôn mặt cho sinh viên
- Điểm danh realtime bằng nhận diện khuôn mặt qua camera
- Xem chi tiết kết quả điểm danh

### Sinh viên

- Xem lịch học
- Xem lịch sử điểm danh
- Tự đăng ký khuôn mặt

## Cài đặt & Chạy

### Yêu cầu

- Docker Desktop
- .NET 9 SDK
- Node.js 18+

### Bước 1: Khởi động Database

```bash
docker-compose up -d
```

### Bước 2: Chạy Backend

```bash
cd Backend
dotnet run
```

Backend chạy tại: http://localhost:5000

### Bước 3: Tải model nhận diện (chỉ lần đầu)

```bash
cd frontend
npm run download-models
```

### Bước 4: Chạy Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend chạy tại: http://localhost:5173

## Sử dụng

### Đăng nhập

- **Admin**: `admin` / `admin123`

### Quy trình điểm danh

1. **Admin** tạo môn học → thêm sinh viên vào môn
2. **Admin** tạo tiết học cho môn
3. **Admin/Sinh viên** đăng ký khuôn mặt (chụp 3-5 mẫu từ camera)
4. **Admin** mở phiên điểm danh cho tiết học
5. **Admin** nhấn "Điểm danh" → bật camera → hệ thống tự nhận diện & điểm danh sinh viên
6. **Admin** đóng phiên khi xong

### Cách nhận diện khuôn mặt hoạt động

- Sử dụng thư viện **face-api.js** (miễn phí, chạy trên trình duyệt)
- Model: SSD MobileNet V1 (detect) + Face Landmarks 68 points + Face Recognition
- Khi đăng ký: chụp descriptor 128 chiều cho mỗi khuôn mặt
- Khi điểm danh: so khớp descriptor realtime với database
- Ngưỡng matching: Euclidean distance < 0.5

## API Endpoints

| Method   | Endpoint                           | Mô tả                   |
| -------- | ---------------------------------- | ----------------------- |
| POST     | /api/auth/login                    | Đăng nhập               |
| POST     | /api/auth/register                 | Tạo tài khoản (Admin)   |
| GET      | /api/users                         | Danh sách tài khoản     |
| GET/POST | /api/subjects                      | Quản lý môn học         |
| POST     | /api/subjects/{id}/enroll          | Ghi danh sinh viên      |
| GET/POST | /api/classsessions                 | Quản lý tiết học        |
| GET/POST | /api/attendancesessions            | Quản lý phiên điểm danh |
| PUT      | /api/attendancesessions/{id}/close | Đóng phiên              |
| POST     | /api/attendance/checkin            | Điểm danh               |
| GET      | /api/attendance/student/{id}       | Lịch sử điểm danh       |
| GET/POST | /api/facedata                      | Dữ liệu khuôn mặt       |
| GET      | /api/dashboard/stats               | Thống kê                |
