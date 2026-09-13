const { createProxyMiddleware } = require("http-proxy-middleware");

// Hanya dipakai oleh dev server. Di production, nginx.conf meneruskan /api.
// Karena browser selalu memanggil origin aktif, ganti domain tidak memerlukan
// perubahan source code maupun konfigurasi cookie lintas-domain.
module.exports = function setupProxy(app) {
  const target = (process.env.DEV_API_PROXY_TARGET || "http://127.0.0.1:8000").replace(/\/$/, "");

  app.use(
    "/api",
    createProxyMiddleware({
      target,
      changeOrigin: true,
      xfwd: true,
      logLevel: "warn",
    })
  );
};
