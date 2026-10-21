import { Hono } from "hono";

const app = new Hono();

app.get("*", async (c) => {
  return c.text("hello from Hono!");
});

export default app;
