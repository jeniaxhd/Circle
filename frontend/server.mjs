import http from "node:http";
import https from "node:https";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const assets = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/app.js", ["app.js", "text/javascript; charset=utf-8"]],
  ["/styles.css", ["styles.css", "text/css; charset=utf-8"]],
]);

export function createAppServer({
  apiTarget = process.env.API_TARGET || "http://127.0.0.1:3000",
} = {}) {
  const target = new URL(apiTarget);
  if (
    !["http:", "https:"].includes(target.protocol) ||
    target.username ||
    target.password
  ) {
    throw new Error(
      "API_TARGET must be an HTTP/HTTPS URL without embedded credentials",
    );
  }
  return http.createServer(async (req, res) => {
    let path;
    try {
      path = new URL(req.url || "/", "http://localhost").pathname;
    } catch {
      res.writeHead(400).end("Invalid URL");
      return;
    }
    if (path === "/api" || path.startsWith("/api/")) {
      const headers = { accept: "application/json" };
      for (const key of ["authorization", "content-type", "content-length"]) {
        if (req.headers[key]) headers[key] = req.headers[key];
      }
      const transport = target.protocol === "https:" ? https : http;
      const upstream = transport.request(
        {
          protocol: target.protocol,
          hostname: target.hostname,
          port: target.port,
          path: target.pathname.replace(/\/$/, "") + (req.url.slice(4) || "/"),
          method: req.method,
          headers,
        },
        (response) => {
          res.writeHead(response.statusCode || 502, {
            "Content-Type":
              response.headers["content-type"] || "application/json",
            "Cache-Control": "no-store",
          });
          response.pipe(res);
        },
      );
      upstream.setTimeout(20000, () => upstream.destroy(new Error("timeout")));
      upstream.on("error", () => {
        if (!res.headersSent) {
          res.writeHead(502, {
            "Content-Type": "application/json; charset=utf-8",
          });
          res.end(
            JSON.stringify({
              message:
                "Backend недоступен. Запусти backend (по умолчанию порт 3000).",
            }),
          );
        } else res.end();
      });
      req.on("aborted", () => upstream.destroy());
      req.pipe(upstream);
      return;
    }
    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405).end();
      return;
    }
    const asset = /^\/invite\/[a-f0-9]{64}\/?$/.test(path)
      ? assets.get("/")
      : assets.get(path);
    if (!asset) {
      res.writeHead(404).end("Not found");
      return;
    }
    try {
      const body = await readFile(new URL(asset[0], import.meta.url));
      res.writeHead(200, {
        "Content-Type": asset[1],
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(500).end("Unable to read frontend asset");
    }
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const port = Number(process.env.PORT || 5173);
  const server = createAppServer();
  server.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () =>
    console.log("Circle test UI: http://127.0.0.1:" + port),
  );
}
