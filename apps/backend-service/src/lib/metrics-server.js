import http from "node:http";
import { registry } from "./metrics.js";

export const startMetricsServer = (port) => {
  const server = http.createServer(async (req, res) => {
    if (req.url !== "/metrics") {
      res.statusCode = 404;
      return res.end();
    }
    res.setHeader("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });
  server.listen(port);
  return server;
};
