# UsahaKu Authentication Testing
1. Register a new user with POST `/api/auth/register` and verify a 30-day `TRIAL_ACTIVE` status.
2. Login with POST `/api/auth/login`, verify the httpOnly access cookie, and call `/api/auth/me`.
3. Verify invalid credentials return 401 and no password is returned.
4. Verify website and product endpoints reject requests without authentication and isolate ownership.
5. Verify the seeded admin can access `/api/admin/overview`, while a normal user receives 403.