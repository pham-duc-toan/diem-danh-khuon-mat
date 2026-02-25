import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import AppLayout from "./components/AppLayout";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/admin/Dashboard";
import UsersManagement from "./pages/admin/UsersManagement";
import SubjectsManagement from "./pages/admin/SubjectsManagement";
import ClassSessionsManagement from "./pages/admin/ClassSessionsManagement";
import AttendanceSessionsManagement from "./pages/admin/AttendanceSessionsManagement";
import FaceDataManagement from "./pages/admin/FaceDataManagement";
import TakeAttendance from "./pages/admin/TakeAttendance";
import FaceRegister from "./pages/shared/FaceRegister";
import StudentSchedule from "./pages/student/StudentSchedule";
import StudentAttendanceHistory from "./pages/student/StudentAttendanceHistory";
import StudentCheckIn from "./pages/student/StudentCheckIn";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Admin Routes */}
          <Route
            element={
              <ProtectedRoute roles={["Admin"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/users" element={<UsersManagement />} />
            <Route path="/admin/subjects" element={<SubjectsManagement />} />
            <Route
              path="/admin/class-sessions"
              element={<ClassSessionsManagement />}
            />
            <Route
              path="/admin/attendance-sessions"
              element={<AttendanceSessionsManagement />}
            />
            <Route path="/admin/face-data" element={<FaceDataManagement />} />
            <Route path="/admin/face-register" element={<FaceRegister />} />
            <Route
              path="/admin/take-attendance/:sessionId"
              element={<TakeAttendance />}
            />
          </Route>

          {/* Student Routes */}
          <Route
            element={
              <ProtectedRoute roles={["Student"]}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/student/schedule" element={<StudentSchedule />} />
            <Route path="/student/checkin" element={<StudentCheckIn />} />
            <Route
              path="/student/attendance"
              element={<StudentAttendanceHistory />}
            />
            <Route path="/student/face-register" element={<FaceRegister />} />
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
