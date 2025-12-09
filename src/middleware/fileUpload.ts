import { v2 as cloudinary } from "cloudinary";
import multer from 'multer';
import { NextFunction, Request, Response } from 'express';

const storage = multer.memoryStorage();

interface CloudinaryImage {
  url: string;
  public_id: string;
}

declare global {
  namespace Express {
    interface Request {
      cloudinaryImage: CloudinaryImage
    }
  }
}

const FileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("You can only upload images"));
  }

}

export const upLoad = multer({
  storage: storage,
  fileFilter: FileFilter,
  limits: {
    fileSize: 32 * 1024 * 1024
  }
}).single("image");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export const uploadToCloudnary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      next();
      return;
    }

    const stream = cloudinary.uploader.upload_stream(
      { folder: "Bricks" },
      (error, result) => {
        if (error || !result) {
          res.status(500).json({ success: false, error: error?.message });
          return;
        }

        req.cloudinaryImage = {
          url: result.secure_url,
          public_id: result.public_id,
        };

        next();
      }
    );

    stream.end(req.file.buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
