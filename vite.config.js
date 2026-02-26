// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from "node:fs/promises";
import path from "node:path";

export default defineConfig({
  plugins: [react(),  // Dev-only middleware that appends logs to a file
    {
      name: "local-file-logger",
      configureServer(server) {
        const LOG_PATH = path.resolve(server.config.root, "logs", "success.json");

        server.middlewares.use((req, res, next) => {
          if (req.url !== "/api/log-success" || req.method !== "POST") return next();

          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", async () => {
            try {
              const data = body ? JSON.parse(body) : {};
              await fs.mkdir(path.dirname(LOG_PATH), { recursive: true });

              // read existing array (or start new)
              let arr = [];
              try {
                const existing = await fs.readFile(LOG_PATH, "utf8");
                arr = existing.trim() ? JSON.parse(existing) : [];
                if (!Array.isArray(arr)) arr = [];
              } catch (e) {
                if (e.code !== "ENOENT") throw e;
              }

              const now = new Date();

              const ts_utc = now.toISOString(); // UTC (Z)
              const ts_manila =
                new Intl.DateTimeFormat("sv-SE", {
                  timeZone: "Asia/Manila",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                }).format(now).replace(" ", "T") +
                `.${String(now.getMilliseconds()).padStart(3, "0")}+08:00`;

                const student = data?.studentData;
                const student_min = student
                  ? {
                      id: student.id,
                      displayid: student.displayId,
                      department:student.department,
                      year: student.year,
                      name:student.name,
                      email: student.email,

                    }
                  : null;
                    const vr = data?.verificationResult;
                    const verification_min = vr
                      ? {
                          confidence: vr.confidence,
                          similarity: vr.similarity
                        }
                      : null;

                    arr.push({
                      ts_manila,
                      event: data?.event ?? "verification_success",
                      student: student_min,
                      verificationResult: verification_min,
                    });

              // pretty write
              await fs.writeFile(LOG_PATH, JSON.stringify(arr, null, 2) + "\n", "utf8");

              res.statusCode = 200;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (e) {
              res.statusCode = 400;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });
        });
      },
    }],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})