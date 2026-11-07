import { beforeEach, describe, expect, it, vi } from "vitest";

// The image host is the only external dependency in the menu-item photo flow.
// Mock it so these tests cover our orchestration (upload → save → delete) and
// its failure ordering, not Cloudinary's uptime.
vi.mock("cloudinary", () => {
  const uploader = {
    upload_stream: vi.fn(),
    destroy: vi.fn(),
  };

  return {
    v2: {
      config: vi.fn(),
      url: vi.fn(() => "https://res.cloudinary.com/test/image.webp"),
      uploader,
    },
  };
});

import { v2 as cloudinary } from "cloudinary";
import {
  deleteImage,
  replaceImage,
  uploadImage,
} from "../../../src/lib/image-storage.js";
import { HTTP_STATUS } from "../../../src/constants/http.js";

const uploadStream = cloudinary.uploader.upload_stream as unknown as ReturnType<
  typeof vi.fn
>;
const destroy = cloudinary.uploader.destroy as unknown as ReturnType<typeof vi.fn>;

const target = { folder: "plateflow/items", name: "item-1", maxEdgePx: 800 };
const file = Buffer.from("fake-image-bytes");

function uploadSucceeds(publicId = "plateflow/items/item-1-abc12345") {
  uploadStream.mockImplementation(
    (_options: unknown, callback: (error: unknown, result: unknown) => void) => ({
      end: () =>
        callback(null, {
          public_id: publicId,
          version: 42,
        }),
    })
  );
  return publicId;
}

beforeEach(() => {
  uploadStream.mockReset();
  destroy.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("uploadImage", () => {
  it("uploads into the record's folder and returns a delivery URL + public id", async () => {
    uploadStream.mockImplementation(
      (options: Record<string, unknown>, callback: (error: unknown, result: unknown) => void) => {
        expect(options.folder).toBe(target.folder);
        expect(options.public_id).toMatch(/^item-1-[a-f0-9]{8}$/);
        return {
          end: () => callback(null, { public_id: "plateflow/items/item-1-abc", version: 7 }),
        };
      }
    );

    const result = await uploadImage(file, target);

    expect(result).toEqual({
      url: "https://res.cloudinary.com/test/image.webp",
      publicId: "plateflow/items/item-1-abc",
    });
    expect(cloudinary.url).toHaveBeenCalledWith(
      "plateflow/items/item-1-abc",
      expect.objectContaining({ width: target.maxEdgePx, height: target.maxEdgePx })
    );
  });

  it("turns a provider failure into a 502 instead of an unhandled callback", async () => {
    uploadStream.mockImplementation(
      (_options: unknown, callback: (error: unknown, result: unknown) => void) => ({
        end: () => callback(new Error("provider down"), null),
      })
    );

    await expect(uploadImage(file, target)).rejects.toMatchObject({
      statusCode: HTTP_STATUS.BAD_GATEWAY,
    });
  });
});

describe("deleteImage", () => {
  it("is best-effort: a provider error never fails the request", async () => {
    destroy.mockRejectedValue(new Error("network"));

    await expect(deleteImage("plateflow/items/old")).resolves.toBeUndefined();
  });

  it("treats an already-missing asset as success", async () => {
    destroy.mockResolvedValue({ result: "not found" });

    await expect(deleteImage("plateflow/items/gone")).resolves.toBeUndefined();
  });
});

describe("replaceImage", () => {
  it("saves the new image before deleting the old one", async () => {
    const uploadedId = uploadSucceeds();
    destroy.mockResolvedValue({ result: "ok" });
    const save = vi.fn(async (image: { publicId: string }) => image);

    const saved = await replaceImage({
      target,
      file,
      previousPublicId: "plateflow/items/old",
      save,
    });

    expect(saved.publicId).toBe(uploadedId);
    expect(save).toHaveBeenCalledWith({
      url: "https://res.cloudinary.com/test/image.webp",
      publicId: uploadedId,
    });
    expect(destroy).toHaveBeenCalledWith(
      "plateflow/items/old",
      expect.objectContaining({ resource_type: "image" })
    );
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(
      destroy.mock.invocationCallOrder[0]!
    );
  });

  it("deletes the freshly uploaded asset when the database write fails", async () => {
    const uploadedId = uploadSucceeds("plateflow/items/item-1-new");
    destroy.mockResolvedValue({ result: "ok" });
    const save = vi.fn().mockRejectedValue(new Error("db down"));

    await expect(
      replaceImage({
        target,
        file,
        previousPublicId: "plateflow/items/old",
        save,
      })
    ).rejects.toThrow("db down");

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledWith(uploadedId, expect.anything());
  });

  it("does not delete anything when there was no previous image", async () => {
    uploadSucceeds();
    const save = vi.fn(async (image: unknown) => image);

    await replaceImage({ target, file, previousPublicId: null, save });

    expect(destroy).not.toHaveBeenCalled();
  });
});
