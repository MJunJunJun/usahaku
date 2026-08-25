# UsahaKu — Product Requirements Document

## Original problem statement
Build "UsahaKu" — a complete SaaS product for Indonesian UMKM to build professional websites using AI without coding. Requirements include a public landing page, multi-website architecture, AI website generation via Gemini, AI editing, manual bank transfer payment system, 30-day free trial on signup, subscription management (Free/Premium 1/Premium 3), admin dashboard to approve payments and manage user quotas, public sites with maintenance mode when trial/subscription expires, owner access re-activation flow.

## Personas
- **UMKM Owner (USER)**: Uses UsahaKu to create and manage their business website with AI.
- **Platform Admin (ADMIN)**: Verifies manual bank-transfer payments, manages users, quotas, plans, settings.
- **Public Visitor**: Browses live UMKM websites.

## Core (static) requirements
- Register → 30-day free trial auto-assigned.
- Multi-website per user, quota enforced by backend.
- AI website generation & AI edit command via Gemini 3 Flash (Emergent Universal Key).
- Product management with up to 3 images per product.
- Manual bank transfer payment with proof upload + WhatsApp admin CTA.
- Admin dashboard for full user, payment, plan, settings, activity log management.
- Public site with maintenance mode when owner trial/subscription expires.
- Owner Access page for expired sites (verified via login + ownership).
- Payment approval activates subscription, sets quota, restores public site.
- Data preservation on trial/subscription expiration.

## Architecture / Tech Stack
- **Frontend**: React (react-router, axios, lucide-react)
- **Backend**: FastAPI (motor Mongo async, bcrypt, PyJWT, emergentintegrations)
- **Database**: MongoDB (collections: users, websites, products, plans, payments, notifications, activity_logs, settings, files, password_reset_tokens)
- **Object Storage**: Emergent Object Storage for uploads (images + PDF proofs)
- **AI**: Gemini 3 Flash via Emergent Universal Key (JSON website config)

## Implemented (2026-02-25)
- ✅ Landing page (hero, problem, cara kerja, fitur, contoh, pricing, final CTA)
- ✅ Auth: register, login, logout, forgot-password, reset-password (JWT httponly cookie)
- ✅ 30-day trial auto-init, refresh_status middleware (trial + sub expiry detection)
- ✅ Object storage uploads (jpg/png/webp/pdf)
- ✅ Multi-website CRUD + business info fields + logo/cover upload
- ✅ Products CRUD (max 3 images enforced) with image uploads
- ✅ AI website generation (Gemini 3 Flash) + AI edit command
- ✅ Website preview with device modes (desktop/tablet/mobile)
- ✅ Manual editor: business info, theme colors, hero text, about, products
- ✅ Publish (unique slug) + public site (`/site/:slug`)
- ✅ Public site maintenance mode when owner expired
- ✅ Owner-access verification page (`/owner-access/:slug`)
- ✅ Subscription page: plan selection + additional website counter + total calculator
- ✅ Payment flow: bank info → proof upload → submit → WhatsApp admin CTA
- ✅ Payment history + payment detail
- ✅ User notifications
- ✅ Backend quota enforcement (returns 403 when limit reached)
- ✅ Backend expiration enforcement (block create/generate when expired)
- ✅ Admin dashboard: overview stats, users list/detail, actions (suspend/activate/extend/change plan/add quota/cancel/reset password)
- ✅ Admin payment review: approve/reject with reason (approval activates subscription + sets quota)
- ✅ Admin plans management (edit name/price/limit/features)
- ✅ Admin activity logs
- ✅ Admin settings (platform, WhatsApp, bank info, payment instructions)
- ✅ Admin websites listing

## Backlog / P1
- Business hours per website
- Email notifications (currently in-app only)
- Custom domain support (architecture ready via slug field)
- Trial expiration warning email
- Multi-image gallery on public site (currently first image)

## P2 / Future
- Automatic payment gateway (Stripe/Midtrans)
- Analytics dashboard
- SEO settings per website
- Online ordering module
- Multiple branches per business
- Team members / collaborator role
