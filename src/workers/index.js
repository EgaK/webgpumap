import { Hono } from "hono";

const app = new Hono();

app.get("*", async (c) => {
  return c.text("hello from Hono!", 200, {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  });
});

export default app;
