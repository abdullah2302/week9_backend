import jwt from "jsonwebtoken";


export function generateToken(userId, role) {
    if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not configured");
    }

    return jwt.sign({ id: userId, role: role }, process.env.JWT_SECRET, {
        expiresIn: "5m",
    });
}