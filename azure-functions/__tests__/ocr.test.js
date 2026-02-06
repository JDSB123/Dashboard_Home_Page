const makeContext = () => ({
  log: Object.assign(jest.fn(), { error: jest.fn(), info: jest.fn() }),
});

const makeReq = (overrides = {}) => ({
  method: "POST",
  headers: {},
  query: {},
  body: null,
  ...overrides,
});

describe("OCR", () => {
  const OLD_ENV = process.env;
  let ocr;
  let mockAxiosPost;
  let mockAxiosGet;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      REQUIRE_OCR_KEY: "false",
      AZURE_VISION_ENDPOINT: "https://vision.cognitiveservices.azure.com",
      AZURE_VISION_KEY: "test-vision-key",
    };
    mockAxiosPost = jest.fn();
    mockAxiosGet = jest.fn();
    jest.doMock("axios", () => ({
      post: mockAxiosPost,
      get: mockAxiosGet,
      default: { post: mockAxiosPost, get: mockAxiosGet },
    }));
    jest.doMock("form-data", () => jest.fn());
    ocr = require("../OCR");
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  test("returns 405 on non-POST methods", async () => {
    const ctx = makeContext();
    await ocr(ctx, makeReq({ method: "GET" }));
    expect(ctx.res.status).toBe(405);
  });

  test("returns 401 when auth is required and missing", async () => {
    process.env.REQUIRE_OCR_KEY = "true";
    process.env.ORCHESTRATOR_FUNCTIONS_KEY = "secret";
    jest.resetModules();
    jest.doMock("axios", () => ({ post: mockAxiosPost, get: mockAxiosGet }));
    jest.doMock("form-data", () => jest.fn());
    ocr = require("../OCR");

    const ctx = makeContext();
    await ocr(ctx, makeReq());
    expect(ctx.res.status).toBe(401);
  });

  test("returns 500 when Vision credentials are not configured", async () => {
    delete process.env.AZURE_VISION_ENDPOINT;
    delete process.env.AZURE_VISION_KEY;
    jest.resetModules();
    process.env.REQUIRE_OCR_KEY = "false";
    jest.doMock("axios", () => ({ post: mockAxiosPost, get: mockAxiosGet }));
    jest.doMock("form-data", () => jest.fn());
    ocr = require("../OCR");

    const ctx = makeContext();
    await ocr(ctx, makeReq({ body: { image: "base64data" } }));
    expect(ctx.res.status).toBe(500);
  });

  test("returns 400 when no image data is provided", async () => {
    const ctx = makeContext();
    await ocr(ctx, makeReq({ body: {} }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/no image data/i);
  });

  test("processes base64 image and returns extracted text", async () => {
    const opUrl = "https://vision.cognitiveservices.azure.com/vision/v3.2/read/analyzeResults/op1";
    mockAxiosPost.mockResolvedValue({
      headers: { "operation-location": opUrl },
    });
    mockAxiosGet.mockResolvedValue({
      data: {
        status: "succeeded",
        analyzeResult: {
          readResults: [
            {
              lines: [
                { text: "Hello World", words: [{ confidence: 0.99 }], boundingBox: [0, 0, 1, 1] },
              ],
            },
          ],
        },
      },
    });

    const ctx = makeContext();
    await ocr(ctx, makeReq({ body: { imageBase64: "data:image/png;base64,iVBOR" } }));
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.success).toBe(true);
    expect(ctx.res.body.text).toBe("Hello World");
    expect(ctx.res.body.pageCount).toBe(1);
  });

  test("processes raw buffer image", async () => {
    const opUrl = "https://vision.cognitiveservices.azure.com/vision/v3.2/read/analyzeResults/op2";
    mockAxiosPost.mockResolvedValue({
      headers: { "operation-location": opUrl },
    });
    mockAxiosGet.mockResolvedValue({
      data: {
        status: "succeeded",
        analyzeResult: { readResults: [] },
      },
    });

    const ctx = makeContext();
    await ocr(ctx, makeReq({ body: Buffer.from("fake-image") }));
    expect(ctx.res.status).toBe(200);
    expect(ctx.res.body.text).toBe("");
  });

  test("returns 500 when Vision API submit fails with 401", async () => {
    mockAxiosPost.mockRejectedValue({
      response: { status: 401 },
    });

    const ctx = makeContext();
    await ocr(ctx, makeReq({ body: { imageBase64: "iVBOR" } }));
    expect(ctx.res.status).toBe(500);
    expect(ctx.res.body.error).toMatch(/authentication/i);
  });

  test("returns 400 when Vision API rejects image as invalid", async () => {
    mockAxiosPost.mockRejectedValue({
      response: { status: 400, data: { error: { message: "Invalid image" } } },
    });

    const ctx = makeContext();
    await ocr(ctx, makeReq({ body: { imageBase64: "iVBOR" } }));
    expect(ctx.res.status).toBe(400);
    expect(ctx.res.body.error).toMatch(/invalid image/i);
  });
});
