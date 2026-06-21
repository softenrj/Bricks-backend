// Copyright (c) 2025 Raj
// See LICENSE for details.

import mongoose, { Document, Schema } from "mongoose";

export enum WebTech {
  VITE = "VITE",
  NEXT = "NEXT", // future reference
}

export enum TechLanguage {
  JS = "JS",
  TS = "TS",
}

export interface IProject {
  userId: mongoose.Types.ObjectId;
  name: string;
  description: string;
  web_technology: WebTech;
  tech_language: TechLanguage;
  archived: boolean;
  starred: boolean;
  createdAt: Date;
  updatedAt: Date;
  markDelete: boolean;
}

const ProjectSchema = new Schema<IProject>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "user", required: true },
    name: { type: String, required: true },
    description: { type: String, required: false },
    web_technology: { type: String, enum: Object.values(WebTech), required: true },
    tech_language: { type: String, enum: Object.values(TechLanguage), required: true },
    archived: { type: Boolean, default: false },
    starred: { type: Boolean, default: false },
    markDelete: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Project = mongoose.model<IProject>("Project", ProjectSchema);
