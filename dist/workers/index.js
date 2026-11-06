import { Hono } from "hono";
import indexTemplate from "./template/index.html";

const app = new Hono();

app.get("/js/*", async (c) => {
  const js = await c.env.STATICS.fetch(c.req.url.replace("/js/", "/"));
  if (c.req.header("If-None-Match") == js.headers.get("etag"))
    return c.body(null, 304);
  return c.body(js.body, js.status, {
    // 'Cache-Control': 'public, max-age=604800',
    "Content-Type": "application/javascript",
    "ETag": js.headers.get("etag"),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  });
});

app.get("/t/*", async (c) => {
  const tile = await c.env.STATICS.fetch(
    c.req.url.replace("/t/", "/tiles_unzipped/"),
  );
  if (c.req.header("If-None-Match") == tile.headers.get("etag"))
    return c.body(null, 304);

  return c.body(tile.body, tile.status, {
    "Cache-Control": "public, max-age=604800",
    "Content-Type": "application/x-protobuf",
    "ETag": tile.headers.get("etag"),
  });
});

app.get("*", async (c) => {
  const lastmod = indexTemplate
    .match(/<meta[^>]*revised[^>]*>/)?.[0]
    ?.match(/content="?([^\s"]*)/)?.[1];
  if (c.req.header("If-None-Match") == btoa(lastmod)) return c.body(null, 304);

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
