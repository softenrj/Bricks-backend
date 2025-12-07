import mongoose, { Document } from "mongoose";

export interface IUser extends Document {
    _id: mongoose.Types.ObjectId;
    uid: string;
    profile: string;
    firebaseId: string;
    username: string;
    email: string;
    token: string;
    authType: string;
    createAt: Date;
    updatedAt: Date;
}

export enum AuthType {
    EMAIL_PASS = "EMAIL",
    GOOGLE = "GOOGLE",
    GITHUB = "GITHUB"
}

const userSchema = new mongoose.Schema<IUser>({
    username: { type: String },
    uid: { type: String, required: true, unique: true },
    profile: { type: String },
    firebaseId: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    token: { type: String, required: true },
    authType: { type: String, enum: AuthType , required: true }
}, { timestamps: true })

export default mongoose.model<IUser>("users", userSchema);