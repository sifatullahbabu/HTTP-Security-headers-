const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");
const app = express();
const PORT = 3000;
const savetoDB = require("./controller/portal.controller.js");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
require("dotenv").config();
const helmet = require("helmet");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { spawn } = require("child_process");

function runPythonPrediction() {
  return new Promise((resolve, reject) => {
    const python = process.platform === "win32" ? "python" : "python3";
    const proc = spawn(python, ["predict.py"], {
      cwd: path.join(__dirname, "ml"),
    });

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    proc.on("close", (code) => {
      if (code !== 0 || stderr) {
        console.error("⚠️ ML stderr:", stderr);
        return reject(stderr || `Process exited with code ${code}`);
      }
      console.log("✅ ML output:", stdout);
      resolve(stdout);
    });
  });
}

const securityHeaders = [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-XSS-Protection",
  "X-Frame-Options",
  "X-Content-Type-Options",
  "Referrer-Policy",
  "Cross-Origin-Opener-Policy",
  "Permissions-Policy",
  "Expect-CT",
  "Cross-Origin-Embedder-Policy",
  "Cross-Origin-Resource-Policy",
];

mongoose
  .connect(
    "mongodb://sifat0162:sifatlamiya@cluster-0-shard-00-00.9ggdq.mongodb.net:27017,cluster-0-shard-00-01.9ggdq.mongodb.net:27017,cluster-0-shard-00-02.9ggdq.mongodb.net:27017/?replicaSet=atlas-ampeh7-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster-0"
  )
  .then(() => console.log("Database connected"))
  .catch((error) => console.error("Database connection failed", error));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://code.jquery.com",
          "'unsafe-inline'",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'",
        ],
        styleSrcElem: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'",
        ],
        imgSrc: ["'self'", "data:", "https://via.placeholder.com"],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdn.jsdelivr.net",
        ],
        connectSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
    strictTransportSecurity: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    xXssProtection: { setOnOldIE: true, mode: "block" },
    xFrameOptions: { action: "sameorigin" },
    xContentTypeOptions: true,
    referrerPolicy: { policy: "no-referrer" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"],
        microphone: ["'none'"],
        camera: ["'none'"],
      },
    },
    expectCt: {
      enforce: true,
      maxAge: 86400,
    },
    crossOriginEmbedderPolicy: { policy: "require-corp" },
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  console.log(`Request URL: ${req.url}`);
  next();
});

const upload = multer({ dest: "uploads/" });

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api", (req, res) => {
  res.json({ message: "Welcome to the API!" });
});

app.get("/download/predictions", (req, res) => {
  const filePath = path.join(__dirname, "predictions_results.csv");
  if (fs.existsSync(filePath)) {
    res.download(filePath, "predictions_results.csv");
  } else {
    res.status(404).send("Prediction file not found.");
  }
});

app.get("/download/processed", (req, res) => {
  const filePath = path.join(__dirname, "processed_results.csv");
  if (fs.existsSync(filePath)) {
    res.download(filePath, "processed_results.csv");
  } else {
    res.status(404).send("Processed file not found.");
  }
});

app.post("/api/headers", async (req, res) => {
  const { url } = req.body;
  if (!url)
    return res.status(400).json({ error: "Please provide a valid URL." });

  try {
    const response = await axios.head(url, { validateStatus: () => true });
    const headersReport = {};
    securityHeaders.forEach((header) => {
      headersReport[header] =
        response.headers[header.toLowerCase()] || "missing";
    });
    savetoDB({ portalName: url, headerStatus: headersReport });
    return res.json({ url, headers: headersReport });
  } catch (error) {
    console.error("Error fetching headers:", error.message);
    return res.status(500).json({ error: "Failed to fetch headers" });
  }
});

app.post("/api/upload-csv", upload.single("csvFile"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No CSV file uploaded." });

  const results = [];
  const processedData = [];

  fs.createReadStream(req.file.path)
    .pipe(csv())
    .on("data", (data) => {
      if (
        data.url &&
        typeof data.url === "string" &&
        data.url.trim().startsWith("http")
      ) {
        results.push(data.url.trim());
      }
    })
    .on("end", async () => {
      for (const url of results) {
        try {
          const response = await axios.head(url, {
            timeout: 5000,
            validateStatus: () => true,
          });
          if (!response || !response.headers) continue;

          const headersReport = {};
          let hasAtLeastOne = false;

          securityHeaders.forEach((header) => {
            const isPresent = response.headers[header.toLowerCase()] ? 1 : 0;
            headersReport[header] = isPresent;
            if (isPresent === 1) hasAtLeastOne = true;
          });

          if (hasAtLeastOne) {
            savetoDB({ portalName: url, headerStatus: headersReport });
            processedData.push({ url, ...headersReport });
          }
        } catch (err) {
          console.warn(`❌ Failed to fetch for ${url}:`, err.message);
        }
      }

      fs.unlinkSync(req.file.path);

      if (processedData.length > 0) {
        const csvWriter = createCsvWriter({
          path: "processed_results.csv",
          header: Object.keys(processedData[0]).map((key) => ({
            id: key,
            title: key,
          })),
        });
        await csvWriter.writeRecords(processedData);
        await runPythonPrediction();
      }

      return res.json(processedData);
    })
    .on("error", (err) => {
      console.error("❌ CSV Read Error:", err.message);
      return res.status(500).json({ error: "Failed to process CSV file." });
    });
});

app.post("/api/deepseek", async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "Message is required." });

  try {
    const deepseekResponse = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "deepseek/deepseek-r1:free",
        messages: [{ role: "user", content: message }],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          "HTTP-Referer": "https://www.webstylepress.com",
          "X-Title": "WebStylePress",
          "Content-Type": "application/json",
        },
      }
    );

    const responseText = deepseekResponse.data.choices[0].message.content;
    res.json({ response: responseText });
  } catch (error) {
    console.error("Error calling DeepSeek API:", error.message);
    res.status(500).json({ error: "Failed to call DeepSeek API." });
  }
});

app.post("/api/predict-single", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required." });

  let response;
  try {
    response = await axios.head(url, {
      timeout: 5000,
      validateStatus: () => true,
    });

    if (!response.headers || Object.keys(response.headers).length === 0) {
      console.warn("⚠️ HEAD gave no headers, trying GET...");
      response = await axios.get(url, {
        timeout: 5000,
        validateStatus: () => true,
      });
    }
  } catch (fetchError) {
    console.error("❌ Fetch failed:", fetchError.message);
    return res.status(500).json({ error: "Failed to fetch headers." });
  }

  try {
    const headersReport = {};
    const row = { url };

    securityHeaders.forEach((header) => {
      const rawValue = response.headers[header.toLowerCase()];
      headersReport[header] = rawValue || "missing";
      row[header] = rawValue ? 1 : 0;
    });

    const csvWriter = createCsvWriter({
      path: "processed_results.csv",
      header: Object.keys(row).map((key) => ({ id: key, title: key })),
    });
    await csvWriter.writeRecords([row]);

    await runPythonPrediction();

    const predictionsPath = path.join(__dirname, "predictions_results.csv");
    if (!fs.existsSync(predictionsPath)) {
      console.error("❌ predictions_results.csv not found.");
      return res.status(500).json({ error: "Prediction output missing." });
    }

    const lines = fs.readFileSync(predictionsPath, "utf-8").split("\n");
    const prediction = lines[1]?.split(",")[1]?.trim() || "Unknown";

    return res.json({
      headers: headersReport,
      prediction,
    });
  } catch (err) {
    console.error("❌ Single prediction error:", err.message);
    return res.status(500).json({ error: "Prediction failed." });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
