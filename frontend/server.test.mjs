import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { createAppServer } from "./server.mjs";

async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return "http://127.0.0.1:" + server.address().port;
}
async function stop(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

test("serves public assets and invitations, never private project files", async () => {
  const server = createAppServer();
  const origin = await listen(server);
  try {
    const page = await fetch(origin);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Circle/);
    assert.equal((await fetch(origin + "/app.js")).status, 200);
    assert.equal(
      (await fetch(origin + "/invite/" + "a".repeat(64))).status,
      200,
    );
    for (const path of [
      "/server.mjs",
      "/package.json",
      "/.env",
      "/../backend/.env",
    ]) {
      assert.equal((await fetch(origin + path)).status, 404);
    }
    assert.equal((await fetch(origin + "/", { method: "POST" })).status, 405);
  } finally {
    await stop(server);
  }
});

test("forwards API path, query, body and bearer token", async () => {
  const backend = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        path: req.url,
        method: req.method,
        token: req.headers.authorization,
        body: JSON.parse(body),
      }),
    );
  });
  const target = await listen(backend);
  const server = createAppServer({ apiTarget: target });
  const origin = await listen(server);
  try {
    const response = await fetch(origin + "/api/circles/1/posts?test=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-token",
      },
      body: JSON.stringify({ text: "Hello" }),
    });
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      path: "/circles/1/posts?test=1",
      method: "POST",
      token: "Bearer test-token",
      body: { text: "Hello" },
    });
  } finally {
    await stop(server);
    await stop(backend);
  }
});

test("reports an unavailable backend as a readable 502", async () => {
  const backend = http.createServer();
  const target = await listen(backend);
  await stop(backend);
  const server = createAppServer({ apiTarget: target });
  const origin = await listen(server);
  try {
    const response = await fetch(origin + "/api/circles");
    assert.equal(response.status, 502);
    assert.match((await response.json()).message, /Backend/);
  } finally {
    await stop(server);
  }
});
