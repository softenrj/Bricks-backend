// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose, { Document } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  uid: string;
  profile: string;
  bio: string;
  penname: string;
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
  GITHUB = "GITHUB",
}

const userSchema = new mongoose.Schema<IUser>(
  {
    username: { type: String },
    penname: { type: String, default: "bricks-user" },
    uid: { type: String, required: true, unique: true },
    bio: { type: String, default: "Hello! I am a proud bricks user." },
    profile: {
      type: String,
      default: "https://res.cloudinary.com/dcyn3ewpv/image/upload/v1765213398/149652817_fyg25e.jpg",
    },
    firebaseId: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    token: { type: String, required: true },
    authType: { type: String, enum: AuthType, required: true },
  },
  { timestamps: true }
);

export default mongoose.model<IUser>("users", userSchema);
