import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// ProtectedRoute'ga o'xshaydi, lekin qo'shimcha ravishda foydalanuvchi platforma
// admin ekanligini talab qiladi — oddiy tenant xodimlari `/admin` ostidagi
// sahifalarga kira olmasligi kerak (backend tomonida ham PlatformAdminGuard
// bir xil tekshiruvni takrorlaydi, bu faqat UI qulayligi uchun).
export function PlatformAdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-slate-500">Yuklanmoqda...</div>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.isPlatformAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
