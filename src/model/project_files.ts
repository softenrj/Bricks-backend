import mongoose, { Document } from "mongoose";

interface IProjectFiles extends Document {
    projectId: mongoose.Types.ObjectId;

}