import User from "../models/User.js";
import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";
import { generateToken } from "../utils/generateToken.js";

// @route POST /api/auth/signup
export async function signup(req, res, next) {
    try {
        const { name, password } = req.body;
        const { email: rawEmail } = req.body;

        if (
            typeof name !== "string" ||
            typeof rawEmail !== "string" ||
            typeof password !== "string"
        ) {
            res.status(400);
            throw new Error("Name, email and password must be strings");
        }
        const email = rawEmail.trim().toLowerCase();

        if (!name || !email || !password) {
            res.status(400);
            throw new Error("Name, email and password are all required");
        }

        if (password.length < 6) {
            res.status(400);
            throw new Error("Password must be at least 6 characters");
        }

        const existing = await User.findOne({ email });
        if (existing) {
            res.status(409);
            throw new Error("An account with this email already exists");
        }

        const user = await User.create({ name, email, password });

        // Every new user gets an empty cart + wishlist up front.
        await Cart.create({ user: user._id, items: [] });
        await Wishlist.create({ user: user._id, products: [] });

        res.status(201).json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            token: generateToken(user._id),
        });
    } catch (err) {
        next(err);
    }
}

// @route POST /api/auth/login
export async function login(req, res, next) {
    try {
        const { password } = req.body;
        const { email: rawEmail } = req.body;

        if (typeof rawEmail !== "string" || typeof password !== "string") {
            res.status(400);
            throw new Error("Email and password must be strings");
        }
        const email = rawEmail.trim().toLowerCase();

        if (!email || !password) {
            res.status(400);
            throw new Error("Email and password are required");
        }

        const user = await User.findOne({ email });
        if (!user || !(await user.matchPassword(password))) {
            res.status(401);
            throw new Error("Invalid email or password");
        }

        res.json({
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
            },
            token: generateToken(user._id),
        });
    } catch (err) {
        next(err);
    }
}

// @route GET /api/auth/me  (protected)
export async function getMe(req, res) {
    res.json({ user: req.user });
}