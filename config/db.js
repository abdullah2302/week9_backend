import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();
const MONGO_URI = process.env.MONGO_URI;

export async function connectDB() {
    try {
        if (!MONGO_URI) {
            throw new Error("MONGO_URI is not configured");
        }

        await mongoose.connect(MONGO_URI);
        console.log("MongoDB connected");
    } catch (error) {
        console.log("MongoDB connection error:", error);
        throw error;
    }
}