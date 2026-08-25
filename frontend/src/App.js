import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import "@/App.css";
import Landing from "./pages/Landing";
import { AuthPage, ForgotPassword, ResetPassword } from "./pages/Auth";
import { UserShell, AdminShell } from "./lib/shared";
import { Dashboard, WebsiteList, CreateWebsite, WebsiteDetail, ManualEdit, Notifications } from "./pages/Dashboard";
import { Subscription, PaymentFlow, PaymentDetail } from "./pages/Subscription";
import { PublicRoute, OwnerAccess } from "./pages/PublicSite";
import { AdminOverview, AdminUsers, AdminUserDetail, AdminPayments, AdminPaymentDetail, AdminPlans, AdminActivity, AdminSettings, AdminWebsites } from "./pages/Admin";
import { UserCoupons, AdminCoupons } from "./pages/Coupons";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/site/:slug" element={<PublicRoute />} />
        <Route path="/owner-access/:slug" element={<OwnerAccess />} />

        <Route path="/dashboard" element={<UserShell><Dashboard /></UserShell>} />
        <Route path="/dashboard/websites" element={<UserShell><WebsiteList /></UserShell>} />
        <Route path="/dashboard/websites/create" element={<UserShell><CreateWebsite /></UserShell>} />
        <Route path="/dashboard/websites/:id" element={<UserShell><WebsiteDetail /></UserShell>} />
        <Route path="/dashboard/websites/:id/edit" element={<UserShell><ManualEdit /></UserShell>} />
        <Route path="/dashboard/subscription" element={<UserShell><Subscription /></UserShell>} />
        <Route path="/dashboard/subscription/pay" element={<UserShell><PaymentFlow /></UserShell>} />
        <Route path="/dashboard/subscription/payment/:pid" element={<UserShell><PaymentDetail /></UserShell>} />
        <Route path="/dashboard/notifications" element={<UserShell><Notifications /></UserShell>} />
        <Route path="/dashboard/coupons" element={<UserShell><UserCoupons /></UserShell>} />

        <Route path="/admin" element={<AdminShell><AdminOverview /></AdminShell>} />
        <Route path="/admin/users" element={<AdminShell><AdminUsers /></AdminShell>} />
        <Route path="/admin/users/:id" element={<AdminShell><AdminUserDetail /></AdminShell>} />
        <Route path="/admin/websites" element={<AdminShell><AdminWebsites /></AdminShell>} />
        <Route path="/admin/payment-requests" element={<AdminShell><AdminPayments /></AdminShell>} />
        <Route path="/admin/payment-requests/:id" element={<AdminShell><AdminPaymentDetail /></AdminShell>} />
        <Route path="/admin/plans" element={<AdminShell><AdminPlans /></AdminShell>} />
        <Route path="/admin/coupons" element={<AdminShell><AdminCoupons /></AdminShell>} />
        <Route path="/admin/activity-logs" element={<AdminShell><AdminActivity /></AdminShell>} />
        <Route path="/admin/settings" element={<AdminShell><AdminSettings /></AdminShell>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
