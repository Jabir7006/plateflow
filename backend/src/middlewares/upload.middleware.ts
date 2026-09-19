import multer from "multer";
import type { Request, RequestHandler } from "express";
import AppError from "../utils/AppError.js";
import { HTTP_STATUS } from "../constants/http.js";

export const MENU_ITEM_IMAGE_FIELD = "image";

const MAX_IMAGE_MB = 5;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);

const tooLargeMessage = `Image must be smaller than ${MAX_IMAGE_MB}MB`;

const fieldError = (field: string, message: string): AppError =>
  new AppError(message, HTTP_STATUS.BAD_REQUEST, true, [{ field, message }]);

const tooLargeError = (field: string): AppError =>
  new AppError(tooLargeMessage, HTTP_STATUS.PAYLOAD_TOO_LARGE, true, [
    { field, message: tooLargeMessage },
  ]);

const upload = multer({
  // Held in memory because the buffer goes straight to the image host; a temp
  // file would only add cleanup to get wrong.
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_MB * 1024 * 1024,
    files: 1,
    fields: 5,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
      return;
    }

    cb(fieldError(file.fieldname, "Choose a JPEG, PNG, WebP or AVIF image"));
  },
});

/**
 * Turns multer's failures into the API's own error shape: a status the client can
 * act on and a field it can highlight, instead of a MulterError code.
 */
const toUploadError = (error: unknown, field: string): AppError => {
  // Raised by the file filter above, which already says what to fix.
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return tooLargeError(field);
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      return fieldError(
        field,
        `Send the image as a file field named "${field}"`
      );
    }

    // The rest are count limits — parts, fields — and this route takes one image.
    return fieldError(field, "Could not read the uploaded image");
  }

  // Busboy rejects a multipart body that carries no boundary, and multer forwards
  // a request's own stream errors the same way. The original is logged because
  // only some of these are the client's doing.
  console.error("Failed to read an image upload:", { field, error });
  return fieldError(field, "Send the image as a multipart/form-data upload");
};

/**
 * Parses one image and nothing else. Built as a factory so a second upload route
 * reuses this instead of creating a second multer instance with its own limits
 * and its own idea of what an image is.
 */
const singleImage = (field: string): RequestHandler => {
  const parse = upload.single(field);

  return (req, res, next) => {
    parse(req, res, (error?: unknown) => {
      if (error) {
        next(toUploadError(error, field));
        return;
      }

      next();
    });
  };
};

export const menuItemImageUpload = singleImage(MENU_ITEM_IMAGE_FIELD);

/**
 * The bytes of the file the route expects, or a field error. A request without a
 * file part — a JSON body, a form the client never attached the input to — leaves
 * `req.file` undefined, and reading it blindly would turn that into a 500.
 */
export const requireImageFile = (req: Request, field: string): Buffer => {
  if (!req.file) {
    throw fieldError(field, "Choose an image to upload");
  }

  return req.file.buffer;
};
