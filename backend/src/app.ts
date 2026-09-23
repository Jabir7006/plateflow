import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";
import authRoutes from "./modules/auth/auth.routes.js";
import staffRoutes from "./modules/staff/staff.routes.js";
import menuRoutes from "./modules/menu/menu.routes.js";
import tableRoutes from "./modules/table/table.routes.js";
import dinerRoutes from "./modules/diner/diner.routes.js";
import orderRoutes from "./modules/order/order.routes.js";
import { ENV } from "./config/env.js";

const app = express();

app.use(
  cors({
    origin: ENV.APP_URL,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.set("trust proxy", 1);

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

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
