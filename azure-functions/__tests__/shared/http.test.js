describe("shared/http – CORS helpers", () => {
  let getAllowedOrigins, buildCorsHeaders, sendResponse;

  beforeEach(() => {
    jest.resetModules();
    delete process.env.CORS_ALLOWED_ORIGINS;
    ({ getAllowedOrigins, buildCorsHeaders, sendResponse } = require("../../shared/http"));
  });

  describe("getAllowedOrigins", () => {
    test("returns defaults when env var is not set", () => {
      const origins = getAllowedOrigins();
      expect(origins).toContain("https://www.greenbiersportventures.com");
      expect(origins).toContain("http://localhost:3000");
    });

    test("reads from CORS_ALLOWED_ORIGINS env var", () => {
      process.env.CORS_ALLOWED_ORIGINS = "https://a.com,https://b.com";
      const origins = getAllowedOrigins();
      expect(origins).toEqual(["https://a.com", "https://b.com"]);
    });

    test("accepts custom defaults", () => {
      const origins = getAllowedOrigins(["https://custom.io"]);
      expect(origins).toEqual(["https://custom.io"]);
    });
  });

  describe("buildCorsHeaders", () => {
    let defaults;
    beforeEach(() => {
      defaults = getAllowedOrigins();
    });

    test("sets matching origin when request origin is allowed", () => {
      const req = { headers: { origin: "http://localhost:3000" } };
      const h = buildCorsHeaders(req, defaults);
      expect(h["Access-Control-Allow-Origin"]).toBe("http://localhost:3000");
      expect(h["Vary"]).toBe("Origin");
    });

    test("falls back to first allowed origin when request origin is not in list", () => {
      const req = { headers: { origin: "https://evil.com" } };
      const h = buildCorsHeaders(req, defaults);
      expect(h["Access-Control-Allow-Origin"]).toBe(defaults[0]);
    });

    test("includes credentials header when option is set", () => {
      const req = { headers: {} };
      const h = buildCorsHeaders(req, defaults, { credentials: true });
      expect(h["Access-Control-Allow-Credentials"]).toBe("true");
    });

    test("handles wildcard origins", () => {
      const req = { headers: { origin: "https://anything.com" } };
      const h = buildCorsHeaders(req, ["*"]);
      expect(h["Access-Control-Allow-Origin"]).toBe("*");
      expect(h["Vary"]).toBeUndefined();
    });

    test("sets custom methods and headers", () => {
      const req = { headers: {} };
      const h = buildCorsHeaders(req, defaults, {
        methods: "GET",
        headers: "Authorization",
      });
      expect(h["Access-Control-Allow-Methods"]).toBe("GET");
      expect(h["Access-Control-Allow-Headers"]).toBe("Authorization");
    });
  });

  describe("sendResponse", () => {
    test("sets context.res with status, body, and headers", () => {
      const context = { res: null };
      sendResponse(context, {}, 200, { ok: true }, { "X-Custom": "1" }, { Vary: "Origin" });
      expect(context.res.status).toBe(200);
      expect(context.res.body).toEqual({ ok: true });
      expect(context.res.headers["X-Custom"]).toBe("1");
      expect(context.res.headers["Vary"]).toBe("Origin");
    });
  });
});
