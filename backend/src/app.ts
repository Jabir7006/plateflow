import express from "express";
import cors from "cors";
import {
  errorHandler,
  notFoundHandler,
} from "./middlewares/error.middleware.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Error Handling Middleware
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
