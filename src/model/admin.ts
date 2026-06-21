// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import mongoose from "mongoose";

export interface IAdmin {
  _id: mongoose.Types.ObjectId;
  name: string;
  uid: string;
  uniqueCode: string;
  ADMIN_PRIVATE_KEY: string;
  createdAt: Date;
  updatedAt: Date;
}

const AdminSchema = new mongoose.Schema<IAdmin>(
  {
    name: { type: String, required: true },
    uid: { type: String, required: true, maxlength: 8 },
    uniqueCode: { type: String, required: true, maxlength: 6 },
    ADMIN_PRIVATE_KEY: { type: String, required: true },
  },
  { timestamps: true }
);

export const Admin = mongoose.model<IAdmin>("admin", AdminSchema);
