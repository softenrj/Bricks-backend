// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { NextFunction, Request, Response } from "express";

const storage = multer.memoryStorage();

interface CloudinaryImage {
  url: string;
  public_id: string;
}

interface CloudinaryAudio {
  url: string;
  public_id: string;
}

declare global {
  namespace Express {
    interface Request {
      cloudinaryImage: CloudinaryImage;
      cloudinaryAudio?: CloudinaryAudio;
    }
  }
}

const FileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("You can only upload images"));
  }
};

export const upLoad = multer({
  storage: storage,
  fileFilter: FileFilter,
  limits: {
    fileSize: 32 * 1024 * 1024,
  },
}).single("image");

export const uploadFiles = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/") || file.mimetype.startsWith("audio/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image and audio files allowed"));
    }
  },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

const audioFileFilter: multer.Options["fileFilter"] = (req, file, cb) => {
  if (file.mimetype.startsWith("audio/")) {
    cb(null, true);
  } else {
    cb(new Error("Only audio files are allowed"));
  }
};

export const uploadAudio = multer({
  storage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
}).single("audio");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export const uploadSingleImageToCloudnary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      next();
      return;
    }

    const stream = cloudinary.uploader.upload_stream({ folder: "Bricks" }, (error, result) => {
      if (error || !result) {
        res.status(500).json({ success: false, error: error?.message });
        return;
      }

      req.cloudinaryImage = {
        url: result.secure_url,
        public_id: result.public_id,
      };

      next();
    });

    stream.end(req.file.buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const uploadToCloudnary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as {
      image?: Express.Multer.File[];
    };

    if (!files || !files.image) {
      next();
      return;
    }

    const imageFile = files.image[0];

    const stream = cloudinary.uploader.upload_stream({ folder: "Bricks" }, (error, result) => {
      if (error || !result) {
        res.status(500).json({ success: false, error: error?.message });
        return;
      }

      req.cloudinaryImage = {
        url: result.secure_url,
        public_id: result.public_id,
      };

      next();
    });

    stream.end(imageFile.buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const uploadAudioToCloudinary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const files = req.files as {
      audio?: Express.Multer.File[];
    };

    if (!files || !files.audio) {
      next();
      return;
    }

    const audioFile = files.audio[0];

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "Bricks/audio",
        resource_type: "video",
      },
      (error, result) => {
        if (error || !result) {
          res.status(500).json({ success: false, error: error?.message });
          return;
        }

        req.cloudinaryAudio = {
          url: result.secure_url,
          public_id: result.public_id,
        };

        next();
      }
    );

    stream.end(audioFile.buffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
