import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppLayout } from './layout/AppLayout';
import { NotFound } from './layout/NotFound';
import { SessionProvider } from './session/SessionContext';
import { HomePage } from './pages/home';
import { RecapPage } from './pages/recap';
import { MapPage } from './pages/map';
import { TimelinePage } from './pages/timeline';
import { SearchPage } from './pages/tim-kiem';
import { UploadPage } from './pages/tai-anh';
import { PhotoboothPage } from './pages/photobooth';
import { LoginPage } from './pages/dang-nhap';
import { MucPage } from './pages/muc';
import { MePage } from './pages/me/MePage';
import { TripManagePage } from './pages/me/TripManagePage';

/**
 * Phiên r1 của coder-main (w1:pK) chỉ dùng trong trang `/me`, nên chỉ bọc
 * quanh các route đó — trang r2 tự lấy `/api/me` qua `src/api.ts`.
 */
function SessionLayout() {
  return (
    <SessionProvider>
      <Outlet />
    </SessionProvider>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 9 trang r2 dùng chung khung: header trong suốt + thanh thông báo + drawer. */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/tong-ket/:year" element={<RecapPage />} />
          <Route path="/ban-do" element={<MapPage />} />
          <Route path="/dong-thoi-gian" element={<TimelinePage />} />
          <Route path="/tim-kiem" element={<SearchPage />} />
          <Route path="/tai-anh" element={<UploadPage />} />
          <Route path="/photobooth" element={<PhotoboothPage />} />
          <Route path="/dang-nhap" element={<LoginPage />} />
          {/* Đường dẫn cũ của r1: chuyển thẳng sang trang đăng nhập r2. */}
          <Route path="/login" element={<Navigate to="/dang-nhap" replace />} />
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* /muc/:id của coder-2 (w1:pN): trang tự mang header riêng nên không bọc AppLayout. */}
        <Route path="/muc/:id" element={<MucPage />} />

        {/* /me* do w1:pK dựng trong src/pages/me/ */}
        <Route element={<SessionLayout />}>
          <Route path="/me" element={<MePage />} />
          <Route path="/me/trips/:tripId" element={<TripManagePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
