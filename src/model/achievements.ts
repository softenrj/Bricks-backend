import mongoose, { Document, Schema } from "mongoose";

export enum AchievementEnum {
    KBP = "Knight's Blueprint",
    LU = "Luminal Construction",
    QB = "Quint Blacksmith",
    ER = "Essence Recast",
    FFA = "Fivefold Anvil",
    RF = "Royal Flame",
    LOF = "Lord of the Forge",
    AOP = "Aura of Persistence",
    EKH = "Eternal Knight of Honor",
    SH = "Shield Hero"
}

export interface IAchievement extends Document {
    name: string;
    badge: string;
    description: string;
}

const achievementSchema = new Schema<IAchievement>({
    name: { type: String, required: true, unique: true, trim: true },
    badge: { type: String, required: true },
    description: { type: String, required: true }
}, { timestamps: true });

export const Achievement = mongoose.model<IAchievement>("Achievement", achievementSchema);
