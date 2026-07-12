const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8765;
const ROOT = "C:/Users/Prince/Documents/padayon testing";

const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".pdf": "application/pdf",
};

http
  .createServer((req, res) => {
    const filePath = path.normalize(path.join(ROOT, decodeURIComponent(req.url || "/")));
    const rootNormalized = path.normalize(ROOT);
    if (!filePath.startsWith(rootNormalized)) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }
    fs.readFile(filePath, (err, data) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      if (err) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
      res.end(data);
    });
  })
  .listen(PORT, () => {
    console.log(`Test file server running on http://localhost:${PORT}`);
  });
