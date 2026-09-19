import { randomUUID } from "node:crypto";
import { v2 as cloudinary } from "cloudinary";
import { ENV } from "../config/env.js";
import AppError from "../utils/AppError.js";
import { HTTP_STATUS } from "../constants/http.js";

// The only module that talks to the image host, so changing provider is a change
// to this file rather than to every service that owns an image.
cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key: ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
  secure: true,
});

export type StoredImage = {
  url: string;
  publicId: string;
};

/**
 * Where an upload lands. `name` stays stable per record (an item's id, a user's
 * id) so the record's assets are findable in the media library, and `maxEdgePx`
 * is the longest edge a client is ever asked to download.
 */
export type ImageTarget = {
  folder: string;
  name: string;
  maxEdgePx: number;
};

const uploadFailedError = () =>
  new AppError(
    "Could not upload the image, please try again",
    HTTP_STATUS.BAD_GATEWAY
  );

const deliveryUrl = (publicId: string, version: number, maxEdgePx: number) =>
  cloudinary.url(publicId, {
    secure: true,
    version: String(version),
    crop: "limit",
    width: maxEdgePx,
    height: maxEdgePx,
    // Cloudinary then serves WebP or AVIF at a quality it picks per image, so a
    // phone downloads a tuned file instead of the original upload.
    fetch_format: "auto",
    quality: "auto",
  });

/**
 * Resolves with the two things a record has to keep: the URL to hand to clients
 * and the public id that can delete or replace the asset later.
 */
export const uploadImage = (
  buffer: Buffer,
  target: ImageTarget
): Promise<StoredImage> =>
  new Promise((resolve, reject) => {
    // A fresh public id per upload, so a replaced photo gets a new URL and cannot
    // be served back from a browser cache.
    const publicId = `${target.name}-${randomUUID().slice(0, 8)}`;

    const upload = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: target.folder,
        resource_type: "image",
      },
      (error, result) => {
        // The SDK reports failures through this argument instead of rejecting,
        // so an unchecked upload looks successful and leaves the record pointing
        // at an image that was never stored.
        if (error || !result) {
          console.error("Failed to upload an image:", { publicId, error });
          reject(uploadFailedError());
          return;
        }

        resolve({
          url: deliveryUrl(result.public_id, result.version, target.maxEdgePx),
          publicId: result.public_id,
        });
      }
    );

    upload.end(buffer);
  });

/**
 * Best effort by design: it resolves whether or not the asset was still there,
 * because by the time it runs the caller's own change is already committed, and
 * an unreferenced asset is a smaller problem than a failed request.
 */
export const deleteImage = async (publicId: string): Promise<void> => {
  try {
    const { result } = await cloudinary.uploader.destroy(publicId, {
      resource_type: "image",
      invalidate: true,
    });

    // "not found" is the outcome that was wanted; anything else is worth a look.
    if (result !== "ok" && result !== "not found") {
      console.error("Unexpected response when deleting an image:", {
        publicId,
        result,
      });
    }
  } catch (error) {
    console.error("Failed to delete an image:", { publicId, error });
  }
};

/**
 * The full replace-a-photo flow for any record: store the new image, let the
 * caller write it, then drop the asset the record no longer points at.
 *
 * The order matters both ways. Deleting the previous asset only after the write
 * commits means a failed write never destroys the image still in use, and
 * deleting the *new* asset when the write fails means a failure never leaves
 * bytes behind that nothing can find again.
 */
export const replaceImage = async <T>({
  target,
  file,
  previousPublicId,
  save,
}: {
  target: ImageTarget;
  file: Buffer;
  previousPublicId: string | null;
  save: (image: StoredImage) => Promise<T>;
}): Promise<T> => {
  const uploaded = await uploadImage(file, target);

  try {
    const saved = await save(uploaded);

    if (previousPublicId) {
      await deleteImage(previousPublicId);
    }

    return saved;
  } catch (error) {
    await deleteImage(uploaded.publicId);
    throw error;
  }
};
