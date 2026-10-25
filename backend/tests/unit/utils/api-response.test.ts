import { describe, expect, it, vi } from "vitest";
import { sendResponse } from "../../../src/utils/ApiResponse.js";

function mockResponse() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

describe("sendResponse", () => {
  it("reports success for a 2xx status and carries the data", () => {
    const res = mockResponse();

    sendResponse(res as never, 201, { id: "order_1" }, "Order placed");

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Order placed",
      data: { id: "order_1" },
    });
  });

  it("reports failure for a non-2xx status", () => {
    const res = mockResponse();

    sendResponse(res as never, 400, null);

    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Success",
      data: null,
    });
  });
});
