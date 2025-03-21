const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = 3000;
const savetoDB = require('./controller/portal.controller.js');
const multer = require('multer'); // For handling file uploads
const csv = require('csv-parser'); // For parsing CSV files
const fs = require('fs'); // For file system operations
require('dotenv').config();
const helmet = require('helmet'); // Import helmet

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
    "Cross-Origin-Resource-Policy"
];

// Connect to MongoDB
mongoose.connect('mongodb://sifat0162:sifatlamiya@cluster-0-shard-00-00.9ggdq.mongodb.net:27017,cluster-0-shard-00-01.9ggdq.mongodb.net:27017,cluster-0-shard-00-02.9ggdq.mongodb.net:27017/?replicaSet=atlas-ampeh7-shard-0&ssl=true&authSource=admin&retryWrites=true&w=majority&appName=Cluster-0')
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
    // Content Security Policy (CSP)
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], // Allow resources from the same origin
        scriptSrc: [
          "'self'", // Allow scripts from the same origin
          "https://cdn.jsdelivr.net", // Allow Bootstrap JS
          "https://code.jquery.com", // Allow jQuery
          "'unsafe-inline'", // Allow inline scripts (if needed)
        ],
        scriptSrcAttr: ["'unsafe-inline'"], // Allow inline event handlers
        styleSrc: [
          "'self'", // Allow styles from the same origin
          "https://cdn.jsdelivr.net", // Allow Bootstrap CSS
          "https://fonts.googleapis.com", // Allow Google Fonts
          "https://cdnjs.cloudflare.com", // Allow Bootstrap CSS from cdnjs
          "'unsafe-inline'", // Allow inline styles (if needed)
        ],
        styleSrcElem: [
          "'self'", // Allow styles from the same origin
          "https://cdn.jsdelivr.net", // Allow Bootstrap CSS
          "https://fonts.googleapis.com", // Allow Google Fonts
          "https://cdnjs.cloudflare.com", // Allow Bootstrap CSS from cdnjs
          "'unsafe-inline'", // Allow inline styles (if needed)
        ],
        imgSrc: [
          "'self'", // Allow images from the same origin
          "data:", // Allow data URIs for images
          "https://via.placeholder.com", // Example: Allow images from a CDN
        ],
        fontSrc: [
          "'self'", // Allow fonts from the same origin
          "https://fonts.gstatic.com", // Allow Google Fonts
          "https://cdn.jsdelivr.net", // Allow Font Awesome
        ],
        connectSrc: ["'self'"], // Allow AJAX requests to the same origin
        frameSrc: ["'self'"], // Allow iframes from the same origin
      },
    },
    // Strict-Transport-Security (HSTS)
    strictTransportSecurity: {
      maxAge: 31536000, // 1 year in seconds
      includeSubDomains: true, // Apply to subdomains
      preload: true, // Allow preloading in browsers
    },
    // X-XSS-Protection
    xXssProtection: { setOnOldIE: true, mode: 'block' }, // Enable XSS protection
    // X-Frame-Options
    xFrameOptions: { action: 'sameorigin' }, // Prevent Clickjacking
    // X-Content-Type-Options
    xContentTypeOptions: true, // Prevent MIME sniffing
    // Referrer-Policy
    referrerPolicy: { policy: 'no-referrer' }, // Control referrer information
    // Cross-Origin-Opener-Policy
    crossOriginOpenerPolicy: { policy: 'same-origin' }, // Prevent cross-origin attacks
    // Permissions-Policy
    permissionsPolicy: {
      features: {
        geolocation: ["'none'"], // Disable geolocation
        microphone: ["'none'"], // Disable microphone
        camera: ["'none'"], // Disable camera
      },
    },
    // Expect-CT
    expectCt: {
      enforce: true, // Enforce Certificate Transparency
      maxAge: 86400, // 1 day in seconds
    },
    // Cross-Origin-Embedder-Policy
    crossOriginEmbedderPolicy: { policy: 'require-corp' }, // Prevent cross-origin resource loading
    // Cross-Origin-Resource-Policy
    crossOriginResourcePolicy: { policy: 'same-origin' }, // Prevent cross-origin resource embedding
  })
);

app.use(express.json());

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

// Debugging: Log static file serving
app.use((req, res, next) => {
    console.log(`Request URL: ${req.url}`);
    next();
});

const upload = multer({ dest: 'uploads/' }); // Files will be temporarily stored in the 'uploads/' folder

// Serve the frontend (index.html) for the root route
app.get("/", (req, res) => {
    console.log("Serving index.html"); // Debugging log
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

// GET route for /api
app.get("/api", (req, res) => {
    console.log("API route accessed"); // Debugging log
    res.json({ message: "Welcome to the API!" });
});

// Endpoint to check security headers
app.post('/api/headers', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Please provide a valid URL.' });
    }

    try {
        // Perform a HEAD request to fetch headers
        const response = await axios.head(url, { validateStatus: () => true });

        // Prepare the headers report
        const headersReport = {};
        securityHeaders.forEach(header => {
            headersReport[header] = response.headers[header.toLowerCase()] || "missing";
        });

        // Save the result to the database
        const ok = savetoDB({ portalName: url, headerStatus: headersReport });

        // Return the report
        return res.json({ url, headers: headersReport });
    } catch (error) {
        console.error('Error fetching headers:', error.message);
        return res.status(500).json({ error: 'Failed to fetch headers' });
    }
});

// Read and process the uploaded CSV file
app.post('/api/upload-csv', upload.single('csvFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded.' });
    }

    const results = [];

    // Read and process the uploaded CSV file
    fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            const processedData = [];

            // Process each URL in the CSV
            for (const row of results) {
                const url = row.url; // Ensure the CSV has a column named 'url'
                if (url) {
                    try {
                        // Perform a HEAD request to fetch headers
                        const response = await axios.head(url, { validateStatus: () => true });

                        // Prepare the headers report
                        const headersReport = {};
                        securityHeaders.forEach(header => {
                            // Store 1 if header is present, 0 if missing
                            headersReport[header] = response.headers[header.toLowerCase()] ? 1 : 0;
                        });

                        // Save the result to the database
                        const ok = savetoDB({ portalName: url, headerStatus: headersReport });

                        // Add the processed data to the result
                        processedData.push({ url, ...headersReport }); // Include headers in the response
                    } catch (error) {
                        console.error(`Error processing URL ${url}:`, error.message);
                        processedData.push({ url, error: 'Failed to fetch headers' });
                    }
                }
            }

            // Delete the uploaded file after processing
            fs.unlinkSync(req.file.path);

            // Return the processed data
            return res.json(processedData);
        })
        .on('error', (error) => {
            console.error('Error processing CSV:', error);
            return res.status(500).json({ error: 'Failed to process CSV file.' });
        });
});

// Endpoint to call DeepSeek API
app.post('/api/deepseek', async (req, res) => {
    const { message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required.' });
    }

    try {
        const deepseekResponse = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: 'deepseek/deepseek-r1:free',
                messages: [{ role: 'user', content: message }],
            },
            {
                headers: {
                  Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, // Use environment variable for API key
                    'HTTP-Referer': 'https://www.webstylepress.com',
                    'X-Title': 'WebStylePress',
                    'Content-Type': 'application/json',
                },
            }
        );

        const responseText = deepseekResponse.data.choices[0].message.content;
        res.json({ response: responseText });
    } catch (error) {
        console.error('Error calling DeepSeek API:', error.message);
        res.status(500).json({ error: 'Failed to call DeepSeek API.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});