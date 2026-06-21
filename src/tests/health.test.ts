// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import request from "supertest";
import app from "../app.js";
import { describe, it } from "node:test";

describe("Health Check Endpoint", () => {
  it("should return 200 and status ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
    });
  });
});
