import { describe, it, expect } from "vitest";
import { SCHEMA_VERSION } from "@/data/schema.js";

describe("тулчейн", () => {
  it("резолвит алиас @ и читает версию схемы", () => {
    expect(SCHEMA_VERSION).toBe(1);
  });
});
