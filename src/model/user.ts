import mongoose, { Document } from "mongoose";

interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    firebaseId: string;
    username: string;
    email: string;
}

const userSchema = new mongoose.Schema<IUser>({
    username: { type: String },
    firebaseId: { type: String, required: true },
    email: { type: String, required: true }
})

export default mongoose.model<IUser>("users", userSchema);