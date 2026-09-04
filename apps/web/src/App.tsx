import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PlatformAdminRoute } from './components/PlatformAdminRoute';
import { LoginPage } from './pages/LoginPage';
import { RegisterTenantPage } from './pages/RegisterTenantPage';
import { PublicBookingPage } from './pages/PublicBookingPage';
import { DashboardPage } from './pages/DashboardPage';
import { RoomsPage } from './pages/RoomsPage';
import { ChannelManagerPage } from './pages/ChannelManagerPage';
import { GuestsPage } from './pages/GuestsPage';
import { MessagingPage } from './pages/MessagingPage';
import { BookingCalendarPage } from './pages/BookingCalendarPage';
import { GroupBookingsPage } from './pages/GroupBookingsPage';
import { AgenciesPage } from './pages/AgenciesPage';
import { FunctionSpacesPage } from './pages/FunctionSpacesPage';
import { NightAuditPage } from './pages/NightAuditPage';
import { WarehousePage } from './pages/WarehousePage';
import { PosPage } from './pages/PosPage';
import { HousekeepingPage } from './pages/HousekeepingPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { InvoicingPage } from './pages/InvoicingPage';
import { CityLedgerPage } from './pages/CityLedgerPage';
import { AccountingPage } from './pages/AccountingPage';
import { PayrollPage } from './pages/PayrollPage';
import { AttendancePage } from './pages/AttendancePage';
import { SegmentReportsPage } from './pages/SegmentReportsPage';
import { GuestRegistrationReportPage } from './pages/GuestRegistrationReportPage';
import { BillingPage } from './pages/BillingPage';
import { StaffPage } from './pages/StaffPage';
import { HelpPage } from './pages/HelpPage';
import { PropertySettingsPage } from './pages/PropertySettingsPage';
import { AdminPage } from './pages/AdminPage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterTenantPage />} />
          <Route path="/book/:subdomain" element={<PublicBookingPage />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/bookings"
            element={
              <ProtectedRoute>
                <BookingCalendarPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/group-bookings"
            element={
              <ProtectedRoute>
                <GroupBookingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/agencies"
            element={
              <ProtectedRoute>
                <AgenciesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/function-spaces"
            element={
              <ProtectedRoute>
                <FunctionSpacesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/rooms"
            element={
              <ProtectedRoute>
                <RoomsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/channel-manager"
            element={
              <ProtectedRoute>
                <ChannelManagerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guests"
            element={
              <ProtectedRoute>
                <GuestsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/messaging"
            element={
              <ProtectedRoute>
                <MessagingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/night-audit"
            element={
              <ProtectedRoute>
                <NightAuditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/warehouse"
            element={
              <ProtectedRoute>
                <WarehousePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/pos"
            element={
              <ProtectedRoute>
                <PosPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/housekeeping"
            element={
              <ProtectedRoute>
                <HousekeepingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/maintenance"
            element={
              <ProtectedRoute>
                <MaintenancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoicing"
            element={
              <ProtectedRoute>
                <InvoicingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/city-ledger"
            element={
              <ProtectedRoute>
                <CityLedgerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute>
                <AccountingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/payroll"
            element={
              <ProtectedRoute>
                <PayrollPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/attendance"
            element={
              <ProtectedRoute>
                <AttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/segment-reports"
            element={
              <ProtectedRoute>
                <SegmentReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/guest-registration-report"
            element={
              <ProtectedRoute>
                <GuestRegistrationReportPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/billing"
            element={
              <ProtectedRoute>
                <BillingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/staff"
            element={
              <ProtectedRoute>
                <StaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/property-settings"
            element={
              <ProtectedRoute>
                <PropertySettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <HelpPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <PlatformAdminRoute>
                <AdminPage />
              </PlatformAdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
