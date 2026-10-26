import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";

function validateProductId(productId) {
    return mongoose.Types.ObjectId.isValid(productId);
}

function validateQuantity(qty) {
    return Number.isInteger(qty) && qty >= 1;
}

// @route GET /api/cart
export async function getCart(req, res, next) {
    try {
        const cart = await Cart.findOne({ user: req.user._id }).populate(
            "items.product",
            "name category price image inStock stockQuantity"
        );
        if (!cart) {
            return res.json({ items: [] });
        }

        const validItems = cart.items.filter((item) => item.product);
        if (validItems.length !== cart.items.length) {
            cart.items = validItems;
            await cart.save();
        }

        res.json(cart);
    } catch (err) {
        next(err);
    }
}

// @route POST /api/cart   body: { productId, qty? }
export async function addToCart(req, res, next) {
    try {
        const { productId, qty = 1 } = req.body;
        if (!validateProductId(productId) || !validateQuantity(qty)) {
            res.status(400);
            throw new Error("A valid productId and positive integer quantity are required");
        }

        const product = await Product.findById(productId);

        if (!product) {
            res.status(404);
            throw new Error("Product not found");
        }

        const hasStock = product.inStock !== false && (
            product.stockQuantity === undefined || product.stockQuantity > 0
        );
        if (!hasStock) {
            res.status(400);
            throw new Error("Product is out of stock");
        }

        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) cart = await Cart.create({ user: req.user._id, items: [] });

        const existing = cart.items.find(
            (item) => item.product.toString() === productId
        );

        if (existing) {
            if (product.stockQuantity !== undefined && existing.qty + qty > product.stockQuantity) {
                res.status(400);
                throw new Error("Requested quantity exceeds available stock");
            }
            existing.qty += qty;
        } else {
            if (product.stockQuantity !== undefined && qty > product.stockQuantity) {
                res.status(400);
                throw new Error("Requested quantity exceeds available stock");
            }
            cart.items.push({ product: productId, qty });
        }

        await cart.save();
        await cart.populate(
            "items.product",
            "name category price image inStock stockQuantity"
        );
        res.status(201).json(cart);
    } catch (err) {
        next(err);
    }
}

// @route PUT /api/cart/:productId   body: { qty }
export async function updateCartItem(req, res, next) {
    try {
        const { qty } = req.body;
        if (!validateProductId(req.params.productId)) {
            res.status(400);
            throw new Error("Invalid product id");
        }

        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            res.status(404);
            throw new Error("Cart not found");
        }

        const item = cart.items.find(
            (i) => i.product.toString() === req.params.productId
        );
        if (!item) {
            res.status(404);
            throw new Error("Item not in cart");
        }

        if (!Number.isInteger(qty)) {
            res.status(400);
            throw new Error("Quantity must be an integer");
        }

        if (qty < 1) {
            cart.items = cart.items.filter(
                (i) => i.product.toString() !== req.params.productId
            );
        } else {
            const product = await Product.findById(req.params.productId);
            if (!product) {
                res.status(404);
                throw new Error("Product not found");
            }
            if (product.inStock === false || (product.stockQuantity !== undefined && qty > product.stockQuantity)) {
                res.status(400);
                throw new Error("Requested quantity exceeds available stock");
            }
            item.qty = qty;
        }

        await cart.save();
        await cart.populate(
            "items.product",
            "name category price image inStock stockQuantity"
        );
        res.json(cart);
    } catch (err) {
        next(err);
    }
}

// @route DELETE /api/cart/:productId
export async function removeFromCart(req, res, next) {
    try {
        if (!validateProductId(req.params.productId)) {
            res.status(400);
            throw new Error("Invalid product id");
        }

        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            res.status(404);
            throw new Error("Cart not found");
        }

        cart.items = cart.items.filter(
            (i) => i.product.toString() !== req.params.productId
        );

        await cart.save();
        await cart.populate(
            "items.product",
            "name category price image inStock stockQuantity"
        );
        res.json(cart);
    } catch (err) {
        next(err);
    }
}

// @route DELETE /api/cart
export async function clearCart(req, res, next) {
    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (cart) {
            cart.items = [];
            await cart.save();
        }
        res.json(cart || { items: [] });
    } catch (err) {
        next(err);
    }
}