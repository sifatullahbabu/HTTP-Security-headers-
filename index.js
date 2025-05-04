const express = require("express");
const mongoose = require("mongoose");
const axios = require("axios");
const path = require("path");
const app = express();
const PORT = 3000;
const savetoDB = require("./controller/portal.controller.js");
const multer = require("multer"); // For handling file uploads
const csv = require("csv-parser"); // For parsing CSV files
const fs = require("fs"); // For file system operations
require("dotenv").config();
const helmet = require("helmet"); // Import helmet
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const { spawnSync } = require("child_process"); // ✅ Added for ML automation

// List of security headers to check
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

// Connect to MongoDB
mongoose
  .connect(
    "mongodb://sifat0162:sifatlamiya@cluster-0-shard-00-00.9ggdq.mongodb.net:27017,cluster-0-shard-00-01.9ggdq.mongodb.net:27017,cluster-0-shard-00-02.9ggdq.mongodb.net:27017/?replicaSet=atlas-ampeh7-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster-0"
  )
  .then(() => {
    console.log("Database connected");
  })
  .catch((error) => {
    console.error("Database connection failed", error);
  });

// Middleware to parse JSON request body
// Customized helmet configuration
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
  console.log("Serving index.html");
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api", (req, res) => {
  console.log("API route accessed");
  res.json({ message: "Welcome to the API!" });
});

app.post("/api/headers", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "Please provide a valid URL." });
  }

  try {
    const response = await axios.head(url, { validateStatus: () => true });

    const headersReport = {};
    securityHeaders.forEach((header) => {
      headersReport[header] =
        response.headers[header.toLowerCase()] || "missing";
    });

    const ok = savetoDB({ portalName: url, headerStatus: headersReport });

    return res.json({ url, headers: headersReport });
  } catch (error) {
    console.error("Error fetching headers:", error.message);
    return res.status(500).json({ error: "Failed to fetch headers" });
  }
});

// ✅ ✅ ✅ ONLY THIS ROUTE BELOW IS UPDATED
app.post("/api/upload-csv", upload.single("csvFile"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No CSV file uploaded." });
  }

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

          if (
            !response ||
            !response.headers ||
            Object.keys(response.headers).length === 0
          ) {
            console.warn(`No headers returned for: ${url}`);
            continue;
          }

          const headersReport = {};
          let hasAtLeastOneHeader = false;

          securityHeaders.forEach((header) => {
            const isPresent = response.headers[header.toLowerCase()] ? 1 : 0;
            headersReport[header] = isPresent;
            if (isPresent === 1) hasAtLeastOneHeader = true;
          });

          if (hasAtLeastOneHeader) {
            savetoDB({ portalName: url, headerStatus: headersReport });
            processedData.push({ url, ...headersReport });
          } else {
            console.warn(`No security headers found for ${url}, skipping.`);
          }
        } catch (error) {
          console.warn(`Failed to fetch headers for ${url}:`, error.message);
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
        const path = require("path");
        const { spawnSync } = require("child_process");
        
        console.log("⏳ Running ML prediction...");
        
        // Ensure we're using Python 3
        const python = "python3";
        
        // Define the correct working directory
        const mlDirectory = path.join(__dirname, "ml"); // Ensure this is where 'predict.py' is located
        
        // Run the Python script to generate predictions
        const ml = spawnSync(python, ["predict.py"], {
          cwd: mlDirectory,  // Set correct working directory
          encoding: "utf-8",
        });
        
        // Check for errors and log the output or error
        if (ml.error) {
          console.error("❌ ML prediction failed:", ml.error.message);
          return res.status(500).json({ error: "ML prediction failed." });
        }
        if (ml.stderr) {
          console.error("⚠️ ML stderr:", ml.stderr);
        }
        console.log("✅ ML output:\n", ml.stdout);
        
        // You can serve the predictions after this step
        
     
      return res.json(processedData);
    })
    .on("error", (error) => {
      console.error("Error processing CSV:", error);
      return res.status(500).json({ error: "Failed to process CSV file." });
    });
});

app.post("/api/deepseek", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

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

// ✅ ✅ ✅ Added route to download predictions_results.csv
app.get("/download/predictions", (req, res) => {
  const filePath = path.join(__dirname, "predictions_results.csv");
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).send("Prediction results not found.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
