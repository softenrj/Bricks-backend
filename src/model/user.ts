import mongoose, { Document } from "mongoose";

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    firebaseId: string;
    username: string;
    email: string;
    token: string;
    authType: string;
}

export enum AuthType {
    EMAIL_PASS = "EMAIL",
    GOOGLE = "GOOGLE",
    GITHUB = "GITHUB"
}

const userSchema = new mongoose.Schema<IUser>({
    username: { type: String },
    firebaseId: { type: String, required: true },
    email: { type: String, required: true },
    token: { type: String, required: true },
    authType: { type: String, enum: AuthType , required: true }
})

export default mongoose.model<IUser>("users", userSchema);