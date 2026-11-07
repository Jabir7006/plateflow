import { once } from "node:events";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import type { Request } from "express";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import AppError from "../../../src/utils/AppError.js";
import {
  MENU_ITEM_IMAGE_FIELD,
  menuItemImageUpload,
  requireImageFile,
} from "../../../src/middlewares/upload.middleware.js";

// Exercises the upload middleware the way a browser does: real multipart
// requests, real Multer parsing, no Cloudinary call (the route stops before the
// service). The external host is covered separately in image-storage.test.ts.

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();

  app.post("/upload", menuItemImageUpload, (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/upload-required", menuItemImageUpload, (req, res, next) => {
    try {
      const buffer = requireImageFile(req, MENU_ITEM_IMAGE_FIELD);
      res.json({ bytes: buffer.length });
    } catch (error) {
      next(error);
    }
  });

  app.use(
    (
      error: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      void _next;
      if (error instanceof AppError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      res.status(500).json({ message: "unexpected" });
    }
  );

  server = createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const imageForm = (
  field = MENU_ITEM_IMAGE_FIELD,
  type = "image/png",
  size = 8
) => {
  const form = new FormData();
  form.append(field, new Blob([new Uint8Array(size)], { type }), "photo.png");
  return form;
};

describe("menu item image upload", () => {
  it("accepts a supported image type", async () => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: imageForm(),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects a file that is not an image the provider supports", async () => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: imageForm(MENU_ITEM_IMAGE_FIELD, "text/plain"),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain("JPEG, PNG, WebP or AVIF");
  });

  it("rejects an unexpected file field by name", async () => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: imageForm("photo"),
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toContain(
      'field named "image"'
    );
  });

  it("rejects a file larger than 5MB with a payload-too-large status", async () => {
    const response = await fetch(`${baseUrl}/upload`, {
      method: "POST",
      body: imageForm(
        MENU_ITEM_IMAGE_FIELD,
        "image/png",
        5 * 1024 * 1024 + 1
      ),
    });

    expect(response.status).toBe(413);
    expect((await response.json()).message).toContain("smaller than 5MB");
  });

  it("fails with a field error when the form carried no file", async () => {
    const form = new FormData();
    form.append("note", "no photo attached");

    const response = await fetch(`${baseUrl}/upload-required`, {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toBe("Choose an image to upload");
  });

  it("returns the uploaded bytes to the controller", async () => {
    const response = await fetch(`${baseUrl}/upload-required`, {
      method: "POST",
      body: imageForm(MENU_ITEM_IMAGE_FIELD, "image/png", 32),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ bytes: 32 });
  });

  it("throws, rather than returning undefined, when a controller forgets the file check", () => {
    expect(() => requireImageFile({} as Request, MENU_ITEM_IMAGE_FIELD)).toThrow(
      AppError
    );
  });
});
