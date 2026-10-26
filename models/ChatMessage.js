import mongoose from "mongoose";

const productReferenceSchema = new mongoose.Schema(
    {
        id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        image: { type: String, default: "" },
    },
    { _id: false }
);

const chatMessageSchema = new mongoose.Schema(
    {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
        recipientRole: { type: String, enum: ["admin"], default: null },
        text: { type: String, required: true, trim: true, maxlength: 1000 },
        product: { type: productReferenceSchema, default: null },
        readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    { timestamps: true }
);

chatMessageSchema.index({ sender: 1, recipient: 1, createdAt: -1 });
chatMessageSchema.index({ sender: 1, recipientRole: 1, createdAt: -1 });
chatMessageSchema.index({ recipient: 1, createdAt: -1 });
chatMessageSchema.index({ recipientRole: 1, createdAt: -1 });

export default mongoose.model("ChatMessage", chatMessageSchema);