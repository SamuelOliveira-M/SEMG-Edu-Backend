import express from "express";
import request from "supertest";
import { sign } from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ensureAuthenticated } from "../src/middlewares/ensureAuthenticated";
import { errorHandler } from "../src/middlewares/errorHandler";

const key = "local-test-key-with-no-production-access";
const claims = { userId: "synthetic-user", isAdmin: false };
function token(options: object = {}) {
  return sign(claims, key, { subject: claims.userId, expiresIn: "2m", ...options });
}
function app() {
  const api = express();
  api.get("/protected", ensureAuthenticated, (_req, res) => res.json(res.locals.auth));
  return api;
}
beforeEach(() => vi.stubEnv("KEY_TOKEN", key));
afterEach(() => vi.unstubAllEnvs());
describe("JWT authentication over HTTP", () => {
  it("accepts signed Bearer tokens and exposes verified claims", async () => {
    const response = await request(app()).get("/protected").set("Authorization", `Bearer ${token()}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(claims);
  });
  it.each([undefined, "", "Basic abc", "Bearer", "Bearer a b", "not-a-token"])(
    "rejects a missing or malformed header: %s", async (value) => {
      const req = request(app()).get("/protected");
      if (value !== undefined) req.set("Authorization", value);
      expect((await req).status).toBe(401);
    },
  );
  it("rejects tokens signed with another key", async () => {
    const invalid = sign(claims, "another-local-test-key", { subject: claims.userId, expiresIn: "2m" });
    expect((await request(app()).get("/protected").set("Authorization", `Bearer ${invalid}`)).status).toBe(401);
  });
  it("rejects expired tokens", async () => {
    expect((await request(app()).get("/protected").set("Authorization", `Bearer ${token({ expiresIn: -1 })}`)).status).toBe(401);
  });
  it("rejects algorithms outside HS256", async () => {
    expect((await request(app()).get("/protected").set("Authorization", `Bearer ${token({ algorithm: "HS384" })}`)).status).toBe(401);
  });
  it("rejects tokens missing expiration and subject", async () => {
    const invalid = sign(claims, key);
    expect((await request(app()).get("/protected").set("Authorization", `Bearer ${invalid}`)).status).toBe(401);
  });
  it.each(["", " "])("fails closed if KEY_TOKEN is unavailable", async (value) => {
    vi.stubEnv("KEY_TOKEN", value);
    expect((await request(app()).get("/protected")).status).toBe(503);
  });
});
describe("global error responses", () => {
  it("returns 500 without disclosing internal errors", async () => {
    const api = express();
    api.get("/error", () => { throw new Error("private database diagnostic"); });
    api.use(errorHandler);
    const response = await request(api).get("/error");
    expect(response.status).toBe(500);
    expect(response.body).toEqual({ status: "error", message: "Internal server error" });
  });
  it("preserves a valid 4xx status", async () => {
    const api = express();
    api.get("/error", (_req, _res, next) => next(Object.assign(new Error("internal detail"), { status: 413 })));
    api.use(errorHandler);
    expect((await request(api).get("/error")).status).toBe(413);
  });
  it("delegates only when headers have already been sent", () => {
    const next = vi.fn();
    const error = new Error("internal");
    errorHandler(error, {} as never, { headersSent: true } as never, next);
    expect(next).toHaveBeenCalledWith(error);
  });
});
