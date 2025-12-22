import mongoose from "mongoose";

export enum EffectEnum {
    CHRISTMAS = "christmas",
    NEW_YEAR = "new_year",
    DIWALI = "diwali",
    NONE = "none"
}

export interface IEvent {
    _id: mongoose.Types.ObjectId;
    name: string;
    description: string;
    status: 'upcoming' | 'live' | 'expire'
    thumbnail: string; 
    audio?: string;
    effect?: EffectEnum;
    liked: number;
    updatedAt: Date;
    createdAt: Date;
}

const EventSchema = new mongoose.Schema<IEvent>(
  {
    name: { type: String, required: true },
    description: { type: String },
    status: { type: String, required: true, default: 'live'},
    thumbnail: { type: String, required: true },
    audio: { type: String },
    liked: { type: Number, default: 0 },
    effect: {
      type: String,
      enum: Object.values(EffectEnum),
      default: EffectEnum.NONE,
    },
  },
  { timestamps: true }
);


export const BricksEvent = mongoose.model<IEvent>('events', EventSchema);