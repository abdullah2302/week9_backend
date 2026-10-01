import jwt from "jsonwebtoken";


export function generateToken(userId, role) {
    return jwt.sign({ id: userId, role: role }, process.env.JWT_SECRET, {
        expiresIn: "5m",
    });
}