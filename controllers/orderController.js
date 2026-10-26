import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import Notification from "../models/Notification.js";
import { emitNotification } from "../socket.js";

export const createOrder = async (req, res) => {
    try {
        if (req.user.role === "admin") {
            return res.status(403).json({
                message: "Admins can manage orders but cannot place orders",
            });
        }

        const { items, shippingAddress, paymentMethod } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                message: "Your cart is empty",
            });
        }

        const wanted = new Map();
        for (const item of items) {
            const productId = String(item?.product || "");
            const quantity = Number(item?.quantity);
            if (
                !mongoose.Types.ObjectId.isValid(productId) ||
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 100
            ) {
                return res.status(400).json({ message: "Invalid order item" });
            }
            wanted.set(productId, (wanted.get(productId) || 0) + quantity);
        }

        const products = await Product.find({
            _id: { $in: [...wanted.keys()] },
        }).select("name price image inStock stockQuantity");

        if (products.length !== wanted.size) {
            return res.status(400).json({
                message: "One or more products no longer exist",
            });
        }

        const orderItems = [];
        for (const product of products) {
            const quantity = wanted.get(product._id.toString());
            if (
                product.inStock === false ||
                (product.stockQuantity !== undefined &&
                    quantity > product.stockQuantity)
            ) {
                return res.status(400).json({
                    message: `${product.name} is out of stock or unavailable in that quantity`,
                });
            }
            orderItems.push({
                product: product._id,
                name: product.name,
                price: product.price,
                quantity,
                image: product.image,
            });
        }

        const subtotal = Math.round(
            orderItems.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            ) * 100
        ) / 100;
        const shipping = subtotal >= 100 ? 0 : 10;
        const total = Math.round((subtotal + shipping) * 100) / 100;

        const order = await Order.create({
            user: req.user._id,
            items: orderItems,
            shippingAddress,
            paymentMethod: ["card", "cod"].includes(paymentMethod)
                ? paymentMethod
                : "card",
            subtotal,
            shipping,
            total,
            status: "pending",
        });

        const admins = await User.find({ role: "admin" }).select("_id");
        const notifications = await Notification.insertMany(
            admins.map((admin) => ({
                recipient: admin._id,
                type: "new_order",
                message: `New order #${order._id.toString().slice(-8)} received`,
                order: order._id,
            }))
        );
        notifications.forEach(emitNotification);

        res.status(201).json({
            message: "Order placed successfully",
            order,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};




export const getMyOrders = async (req, res) => {
    try {
        const { orders, pagination } = await getPaginatedOrders(
            { user: req.user._id },
            req.query
        );

        res.status(200).json({ orders, pagination });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};



export const getAllOrders = async (req, res) => {
    try {
        const { orders, pagination } = await getPaginatedOrders({}, req.query);

        res.status(200).json({ orders, pagination });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

async function getPaginatedOrders(match, query) {
    const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
    const limit = Math.min(
        Math.max(Number.parseInt(query.limit, 10) || 10, 1),
        50
    );

    const [result] = await Order.aggregate([
        { $match: match },
        {
            $facet: {
                orders: [
                    { $sort: { createdAt: -1 } },
                    { $skip: (page - 1) * limit },
                    { $limit: limit },
                    {
                        $lookup: {
                            from: "users",
                            localField: "user",
                            foreignField: "_id",
                            as: "user",
                        },
                    },
                    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
                    {
                        $project: {
                            "user.password": 0,
                            "user.__v": 0,
                        },
                    },
                ],
                metadata: [{ $count: "total" }],
            },
        },
    ]);

    const total = result.metadata[0]?.total || 0;
    return {
        orders: result.orders,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}




export const updateOrderStatus = async (req, res) => {
    try {
        const { status } = req.body;

        const allowedStatuses = [
            "pending",
            "processing",
            "shipped",
            "delivered",
            "cancelled",
        ];

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                message: "Invalid order status",
            });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            {
                status,
            },
            {
                new: true,
                runValidators: true,
            }
        ).populate("user", "name email");

        if (!order) {
            return res.status(404).json({
                message: "Order not found",
            });
        }

        const notification = await Notification.create({
            recipient: order.user._id,
            type: "order_status",
            message: `Order #${order._id.toString().slice(-8)} is now ${status}`,
            order: order._id,
        });
        emitNotification(notification);

        res.status(200).json({
            message: "Order status updated successfully",
            order,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};
