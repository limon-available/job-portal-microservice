import { describe, expect, it, vi } from "vitest";
import { initializeAuthApp } from "../bootstrap.js";

vi.mock("../app.js", () => ({ default: "auth-app" }));

describe("auth application bootstrap", () => {
  it("connects Redis before loading the app and its rate-limit stores", async () => {
    let redisReady = false;
    const connectRedis = vi.fn(async () => {
      redisReady = true;
    });
    const loadApp = vi.fn(async () => {
      if (!redisReady) throw new Error("Redis must be connected before app initialization");
      return import("../app.js");
    });

    const app = await initializeAuthApp(connectRedis, loadApp);

    expect(connectRedis).toHaveBeenCalledOnce();
    expect(loadApp).toHaveBeenCalledOnce();
    expect(app).toBe("auth-app");
  });

  it("fails startup without loading the app when Redis connection fails", async () => {
    const connectionError = new Error("Redis connection failed");
    const connectRedis = vi.fn().mockRejectedValue(connectionError);
    const loadApp = vi.fn(async () => import("../app.js"));

    await expect(initializeAuthApp(connectRedis, loadApp)).rejects.toBe(connectionError);
    expect(loadApp).not.toHaveBeenCalled();
  });
});
