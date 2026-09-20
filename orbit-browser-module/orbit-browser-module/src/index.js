import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { hostname } from "node:os";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { uvPath } from "@titaniumnetwork-dev/ultraviolet";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";
import { epoxyPath } from "@mercuryworkshop/epoxy-transport";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
  allow_udp_streams: false,
});

const app = Fastify({
  serverFactory: (handler) =>
    createServer()
      .on("request", (req, res) => {
        // These headers are used by the official Scramjet/Ultraviolet examples.
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        handler(req, res);
      })
      .on("upgrade", (req, socket, head) => {
        if (req.url?.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
        else socket.end();
      }),
});

// Custom browser UI first.
await app.register(fastifyStatic, {
  root: publicPath,
  decorateReply: true,
});

// Proxy engines + transports.
await app.register(fastifyStatic, { root: scramjetPath, prefix: "/scram/", decorateReply: false });
await app.register(fastifyStatic, { root: uvPath, prefix: "/uv/", decorateReply: false });
await app.register(fastifyStatic, { root: baremuxPath, prefix: "/baremux/", decorateReply: false });
await app.register(fastifyStatic, { root: epoxyPath, prefix: "/epoxy/", decorateReply: false });
await app.register(fastifyStatic, { root: libcurlPath, prefix: "/libcurl/", decorateReply: false });

app.setNotFoundHandler((req, reply) => reply.code(404).type("text/plain").send("Not found"));

const port = Number.parseInt(process.env.PORT || "8080", 10);
await app.listen({ port, host: "0.0.0.0" });

const address = app.server.address();
console.log("Orbit module listening on:");
console.log(`  http://localhost:${address.port}`);
console.log(`  http://${hostname()}:${address.port}`);
