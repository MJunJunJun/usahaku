import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import "./App.css";
import Landing from "./pages/Landing";
import VerifyWA from "./pages/VerifyWA";
import { AuthPage, ForgotPassword, ResetPassword } from "./pages/Auth";
import { UserShell, AdminShell } from "./lib/shared";
import { Dashboard, WebsiteList, CreateWebsite, WebsiteDetail, ManualEdit, Notifications } from "./pages/Dashboard";
import { SectionManager } from "./pages/Sections";
import { Subscription, PaymentFlow, PaymentDetail } from "./pages/Subscription";
import { PublicRoute, OwnerAccess } from "./pages/PublicSite";
import { AdminOverview, AdminUsers, AdminUserDetail, AdminPayments, AdminPaymentDetail, AdminPlans, AdminActivity, AdminSettings, AdminWebsites, AdminGeneratorTemplates } from "./pages/Admin";
import { UserCoupons, AdminCoupons } from "./pages/Coupons";
import { WaCenter, WaContacts } from "./pages/WaAdmin";
import { AdminArticles, AdminBuildzaArticles, PublicArticle, PublicArticleCategory, PublicBuildzaArticle, PublicBuildzaArticles, PublicWebsiteArticles, WebsiteArticles } from "./pages/Articles";
import { SEO_PAGE_KEYS, SeoLandingPage } from "./pages/SeoPages";
import { loadTemplateCatalog } from "./lib/generatorTemplateCatalog";
import { NoIndex } from "./lib/seo";
import { PUBLIC_SITE_DOMAIN } from "./lib/config";

const TemplateCatalogBootstrap = ({ children }) => {
  const [, setVersion] = useState(0);
  useEffect(() => { loadTemplateCatalog().then(() => setVersion((v) => v + 1)).catch(() => {}); }, []);
  return children;
};

// DNS/proxy points *.situska.com to this SPA.  Resolve the first hostname
// label so a visitor at kopi-senja.situska.com sees that business directly.
const HostedWebsite = () => {
  const host = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  const suffix = `.${PUBLIC_SITE_DOMAIN}`;
  const slug = host.endsWith(suffix) ? host.slice(0, -suffix.length) : "";
  return slug && !slug.includes(".") && slug !== "www" ? <PublicRoute hostedSlug={slug} /> : <Landing />;
};

const hostedSlug = () => {
  const host = typeof window === "undefined" ? "" : window.location.hostname.toLowerCase();
  const suffix = `.${PUBLIC_SITE_DOMAIN}`;
  const slug = host.endsWith(suffix) ? host.slice(0, -suffix.length) : "";
  return slug && !slug.includes(".") && slug !== "www" ? slug : "";
};
const HostedArticleIndex = () => {
  const slug = hostedSlug();
  return slug ? <PublicWebsiteArticles hostedSlug={slug} /> : <PublicBuildzaArticles />;
};
const HostedArticle = () => {
  const slug = hostedSlug();
  return slug ? <PublicArticle hostedSlug={slug} /> : <PublicBuildzaArticle />;
};
const LegacyPlatformArticle = () => {
  const { articleSlug } = useParams();
  return <Navigate replace to={`/${articleSlug}`} />;
};

export default function App() {
  return (
    <BrowserRouter>
      <TemplateCatalogBootstrap><Routes>
        <Route path="/" element={<HostedWebsite />} />
        <Route path="/login" element={<><NoIndex /><AuthPage /></>} />
        <Route path="/register" element={<><NoIndex /><AuthPage register /></>} />
        <Route path="/forgot-password" element={<><NoIndex /><ForgotPassword /></>} />
        <Route path="/reset-password" element={<><NoIndex /><ResetPassword /></>} />
        <Route path="/verify-wa" element={<><NoIndex /><VerifyWA /></>} />
        <Route path="/artikel" element={<HostedArticleIndex />} />
        <Route path="/artikel/kategori/:categorySlug" element={<PublicArticleCategory />} />
        <Route path="/artikel/:articleSlug" element={<PublicBuildzaArticle />} />
        {SEO_PAGE_KEYS.map((pageKey) => <Route key={pageKey} path={`/${pageKey}`} element={<SeoLandingPage pageKey={pageKey} />} />)}
        <Route path="/site/:slug/artikel/:articleSlug" element={<PublicArticle />} />
        <Route path="/site/:slug/artikel" element={<PublicWebsiteArticles />} />
        <Route path="/site/:slug" element={<PublicRoute />} />
        <Route path="/artikel/:articleSlug" element={<LegacyPlatformArticle />} />
        <Route path="/:articleSlug" element={<HostedArticle />} />
        <Route path="/owner-access/:slug" element={<><NoIndex /><OwnerAccess /></>} />

        <Route path="/dashboard" element={<UserShell><Dashboard /></UserShell>} />
        <Route path="/dashboard/websites" element={<UserShell><WebsiteList /></UserShell>} />
        <Route path="/dashboard/websites/create" element={<UserShell><CreateWebsite /></UserShell>} />
        <Route path="/dashboard/websites/:id" element={<UserShell><WebsiteDetail /></UserShell>} />
        <Route path="/dashboard/websites/:id/edit" element={<UserShell><ManualEdit /></UserShell>} />
        <Route path="/dashboard/websites/:id/sections" element={<UserShell><SectionManager /></UserShell>} />
        <Route path="/dashboard/websites/:id/articles" element={<UserShell><WebsiteArticles /></UserShell>} />
        <Route path="/dashboard/subscription" element={<UserShell><Subscription /></UserShell>} />
        <Route path="/dashboard/subscription/pay" element={<UserShell><PaymentFlow /></UserShell>} />
        <Route path="/dashboard/subscription/payment/:pid" element={<UserShell><PaymentDetail /></UserShell>} />
        <Route path="/dashboard/notifications" element={<UserShell><Notifications /></UserShell>} />
        <Route path="/dashboard/coupons" element={<UserShell><UserCoupons /></UserShell>} />

        <Route path="/admin" element={<AdminShell><AdminOverview /></AdminShell>} />
        <Route path="/admin/users" element={<AdminShell><AdminUsers /></AdminShell>} />
        <Route path="/admin/users/:id" element={<AdminShell><AdminUserDetail /></AdminShell>} />
        <Route path="/admin/websites" element={<AdminShell><AdminWebsites /></AdminShell>} />
        <Route path="/admin/articles" element={<AdminShell><AdminArticles /></AdminShell>} />
        <Route path="/admin/buildza-articles" element={<AdminShell><AdminBuildzaArticles /></AdminShell>} />
        <Route path="/admin/payment-requests" element={<AdminShell><AdminPayments /></AdminShell>} />
        <Route path="/admin/payment-requests/:id" element={<AdminShell><AdminPaymentDetail /></AdminShell>} />
        <Route path="/admin/plans" element={<AdminShell><AdminPlans /></AdminShell>} />
        <Route path="/admin/generator-templates" element={<AdminShell><AdminGeneratorTemplates /></AdminShell>} />
        <Route path="/admin/coupons" element={<AdminShell><AdminCoupons /></AdminShell>} />
        <Route path="/admin/wa-contacts" element={<AdminShell><WaContacts /></AdminShell>} />
        <Route path="/admin/whatsapp" element={<AdminShell><WaCenter /></AdminShell>} />
        <Route path="/admin/activity-logs" element={<AdminShell><AdminActivity /></AdminShell>} />
        <Route path="/admin/settings" element={<AdminShell><AdminSettings /></AdminShell>} />

        <Route path="*" element={<Navigate to="/" />} />
      </Routes></TemplateCatalogBootstrap>
    </BrowserRouter>
  );
}
