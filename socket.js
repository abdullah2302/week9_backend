import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "./models/User.js";
import Product from "./models/Product.js";
import ChatMessage from "./models/ChatMessage.js";

let io;
const onlineUsers = new Map();

function serializeChatMessage(message, sender, recipientId) {
    return {
        id: message._id.toString(),
        sender: {
            id: sender._id.toString(),
            name: sender.name,
            role: sender.role,
        },
        recipientId,
        text: message.text,
        product: message.product
            ? {
                  id: message.product.id.toString(),
                  name: message.product.name,
                  price: message.product.price,
                  image: message.product.image,
              }
            : null,
        createdAt: message.createdAt,
        read: true,
    };
}

function broadcastPresence() {
    const adminsOnline = [...onlineUsers.values()].some((entry) => entry.role === "admin");
    io.emit("chat:presence", {
        adminsOnline,
        onlineUserIds: [...onlineUsers.entries()]
            .filter(([, entry]) => entry.role === "user")
            .map(([id]) => id),
    });
}

export function configureSocket(socketServer) {
    io = socketServer;

    io.use(async (socket, next) => {
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error("Authentication required"));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET, {
                maxAge: "5m",
            });
            const user = await User.findById(decoded.id).select("-password");

            if (!user) {
                return next(new Error("User no longer exists"));
            }

            socket.user = user;
            next();
        } catch {
            next(new Error("Invalid authentication token"));
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.user._id.toString();
        const existingPresence = onlineUsers.get(userId);
        onlineUsers.set(userId, {
            role: socket.user.role,
            connections: (existingPresence?.connections || 0) + 1,
        });
        socket.join(`user:${userId}`);
        socket.emit("chat:presence", {
            adminsOnline: [...onlineUsers.values()].some((entry) => entry.role === "admin"),
            onlineUserIds: [...onlineUsers.entries()]
                .filter(([, entry]) => entry.role === "user")
                .map(([id]) => id),
        });
        broadcastPresence();

        if (socket.user.role === "admin") {
            socket.join("role:admin");
        }

        socket.on("chat:typing", ({ isTyping } = {}) => {
            if (socket.user.role === "admin") return;
            io.to("role:admin").emit("chat:typing", {
                customerId: userId,
                isTyping: Boolean(isTyping),
            });
        });

        const sentAt = [];
        socket.on("chat:send", async ({ recipientId, productId, text } = {}, callback = () => {}) => {
            const now = Date.now();
            while (sentAt[0] && now - sentAt[0] > 10000) sentAt.shift();
            if (sentAt.length >= 10) {
                return callback({ error: "Too many messages. Please wait a moment." });
            }

            const message = typeof text === "string" ? text.trim() : "";

            if (!message || message.length > 1000) {
                return callback({ error: "Message must be between 1 and 1000 characters" });
            }

            const sender = {
                id: userId,
                name: socket.user.name,
                role: socket.user.role,
            };

            let product;
            if (productId) {
                try {
                    product = await Product.findById(productId).select("name price image");
                } catch {
                    return callback({ error: "Invalid product reference" });
                }

                if (!product) {
                    return callback({ error: "Product not found" });
                }
            }

            let recipient;
            if (socket.user.role === "admin") {
                if (!recipientId || recipientId === userId) {
                    return callback({ error: "A customer recipient is required" });
                }
                if (!mongoose.Types.ObjectId.isValid(recipientId)) {
                    return callback({ error: "Invalid customer id" });
                }
                recipient = await User.findOne({ _id: recipientId, role: "user" }).select("_id name role");
                if (!recipient) return callback({ error: "Customer not found" });
            }

            sentAt.push(now);
            const savedMessage = await ChatMessage.create({
                sender: socket.user._id,
                recipient: recipient?._id || null,
                recipientRole: socket.user.role === "user" ? "admin" : null,
                text: message,
                product: product
                    ? {
                          id: product._id,
                          name: product.name,
                          price: product.price,
                          image: product.image,
                      }
                    : null,
                readBy: [socket.user._id],
            });

            const chatMessage = serializeChatMessage(
                savedMessage,
                socket.user,
                recipient?._id?.toString() || "role:admin"
            );
            const recipientMessage = { ...chatMessage, read: false };

            if (socket.user.role === "admin") {
                io.to(`user:${recipient._id.toString()}`).emit("chat:message", recipientMessage);
            } else {
                io.to("role:admin").emit("chat:message", recipientMessage);
            }

            socket.emit("chat:message", chatMessage);
            callback({ ok: true });
        });

        socket.on("disconnect", () => {
            const presence = onlineUsers.get(userId);
            if (presence?.connections > 1) {
                onlineUsers.set(userId, { ...presence, connections: presence.connections - 1 });
            } else {
                onlineUsers.delete(userId);
            }
            broadcastPresence();
        });
    });
}

export function emitNotification(notification) {
    if (!io || !notification?.recipient) return;

    io.to(`user:${notification.recipient.toString()}`).emit(
        "notification:new",
        notification
    );
}