import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { notFound, errorHandler } from "./middleware/errorMiddleware.js";
import { configureSocket } from "./socket.js";

import authRoutes from "./routes/authRoute.js";
import productRoutes from "./routes/productRoute.js";
import cartRoutes from "./routes/cartRoute.js";
import wishlistRoutes from "./routes/wishlistRoute.js";
import orderRoutes from "./routes/orderRoute.js";
import notificationRoutes from "./routes/notificationRoute.js";
import chatRoutes from "./routes/chatRoute.js";
import reviewRoutes from "./routes/reviewRoute.js";

import morgan from "morgan";

dotenv.config();

const app = express();



// CORS: the React app runs on a different origin (e.g. localhost:5173)
// than this API (e.g. localhost:5000) — without this, the browser blocks
// every request from the frontend.

const allowedOrigins = [
  process.env.CLIENT_ORIGIN,
];
app.use(
    cors({
        origin: allowedOrigins,
        credentials: true,
    })
);
app.use(express.json());
app.use(morgan("dev"));

app.get("/api/health", (req, res) => res.json({
  status: "ok",
  database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
}));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/reviews", reviewRoutes);

app.use(notFound);
app.use(errorHandler);

export { app };

export async function startServer() {
  await connectDB();

  const PORT = process.env.PORT || 5000;
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  configureSocket(io);
  httpServer.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
  return httpServer;
}

if (process.argv[1] && process.argv[1].endsWith("app.js")) {
  startServer();
}