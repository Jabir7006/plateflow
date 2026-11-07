import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";
import { securityHeaders } from "./middlewares/security.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import staffRoutes from "./modules/staff/staff.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import tableRoutes from "./modules/table/table.routes.js";
import dinerRoutes from "./modules/diner/diner.routes.js";
import orderRoutes from "./modules/order/order.routes.js";
import staffOrderRoutes from "./modules/order/order.staff.routes.js";
import realtimeRoutes from "./modules/realtime/realtime.routes.js";
import { ENV } from "./config/env.js";

const app = express();

// Behind the Next rewrite (and any future load balancer), req.ip is only the
// client's address when Express knows how many proxy hops to trust.
app.set("trust proxy", ENV.TRUST_PROXY);

// Security headers first so even a rejected body or a 4xx carries them.
app.use(securityHeaders);
app.use(
  cors({
    origin: ENV.APP_URL,
    credentials: true,
  })
);
// A request larger than this is rejected by body-parser before any route runs.
// Image uploads use multipart/Multer, whose own 5MB limit is separate.
app.use(express.json({ limit: ENV.JSON_BODY_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: ENV.JSON_BODY_LIMIT }));
app.use(cookieParser());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/menu", menuRoutes);
app.use("/api/v1/tables", tableRoutes);
// Public, no auth: a diner scans a table QR and reads the menu by its token.
app.use("/api/v1/t", dinerRoutes);
// Public and token-scoped too: placing an order and reading its status.
app.use("/api/v1/t", orderRoutes);
// Authenticated staff order surface: the live board and status control.
app.use("/api/v1/orders", staffOrderRoutes);
// Authenticated: mint a short-lived socket.io ticket for the staff session.
app.use("/api/v1/realtime", realtimeRoutes);

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
