import { Hono } from "hono";
import indexTemplate from "./template/index.html";

const app = new Hono();

app.get("*", async (c) => {
  const lastmod = indexTemplate
    .match(/<meta[^>]*revised[^>]*>/)?.[0]
    ?.match(/content="?([^\s"]*)/)?.[1];
  return c.html(indexTemplate, 200, {
    "Cache-Control": "public, max-age=0, s-maxage=86400",
    "Content-Type": "text/html; charset=UTF-8",
    "Last-Modified": lastmod,
    "ETag": btoa(lastmod),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  });
});

export default app;
