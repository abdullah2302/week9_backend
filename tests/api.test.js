import request from "supertest";
import { jest } from "@jest/globals";

const productStore = {
    distinct: jest.fn(),
    aggregate: jest.fn(),
    findById: jest.fn(),
};

jest.unstable_mockModule("../models/Product.js", () => ({
    default: {
        ...productStore,
        create: jest.fn(),
        findByIdAndUpdate: jest.fn(),
        findByIdAndDelete: jest.fn(),
    },
}));

process.env.JWT_SECRET = "test-secret";
const { app } = await import("../app.js");

describe("API endpoints", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("GET /api/health returns service status", async () => {
        const response = await request(app).get("/api/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            status: "ok",
            database: "disconnected",
        });
    });

    test("GET /api/products returns paginated products", async () => {
        productStore.distinct.mockResolvedValue(["Books", "Games"]);
        productStore.aggregate.mockResolvedValue([{
            products: [{ _id: "p1", name: "Book" }],
            metadata: [{ total: 1 }],
        }]);

        const response = await request(app)
            .get("/api/products?page=2&limit=5&category=Books");

        expect(response.status).toBe(200);
        expect(response.body.pagination).toEqual({
            page: 2,
            limit: 5,
            total: 1,
            totalPages: 1,
        });
        expect(response.body.products).toHaveLength(1);
    });

    test("GET /api/products/:id returns a product", async () => {
        productStore.findById.mockResolvedValue({ _id: "p1", name: "Book" });

        const response = await request(app).get("/api/products/p1");

        expect(response.status).toBe(200);
        expect(response.body.name).toBe("Book");
    });

    test("GET /api/products/:id returns 404 when missing", async () => {
        productStore.findById.mockResolvedValue(null);

        const response = await request(app).get("/api/products/missing");

        expect(response.status).toBe(404);
        expect(response.body.message).toBe("Product not found");
    });

    test("POST /api/products rejects unauthenticated users", async () => {
        const response = await request(app)
            .post("/api/products")
            .send({ name: "Book", category: "Books", price: 10 });

        expect(response.status).toBe(401);
        expect(response.body.message).toBe("Not authorized, no token");
    });

    test("unknown routes return a consistent 404 response", async () => {
        const response = await request(app).get("/api/does-not-exist");

        expect(response.status).toBe(404);
        expect(response.body.message).toContain("Route not found");
    });
});
