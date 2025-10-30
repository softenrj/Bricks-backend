import mongoose, { Document } from "mongoose";

export interface IBricksMessage extends Document {
  _id: mongoose.Types.ObjectId;
  chatId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
  updatedAt: Date;
}

const BricksMessages = new mongoose.Schema<IBricksMessage>(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "bricks-chats", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', require: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Project", index: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IBricksMessage>("bricks-messages", BricksMessages);
