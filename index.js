const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const app = express();
const PORT = 3000;
const savetoDB = require('./controller/portal.controller.js');const multer = require('multer'); // For handling file uploads
const csv = require('csv-parser'); // For parsing CSV files
const fs = require('fs'); // For file system operations

// Expanded list of security headers to check
const securityHeaders = [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "X-XSS-Protection",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "Cross-Origin-Opener-Policy",
    "Permissions-Policy",
    "Set-Cookie Attributes",
    "Cache-Control"
];

// Connect to MongoDB
try {
    mongoose.connect('mongodb://localhost:27017/Project', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    }).then(() => {
        console.log("Database connected");
    });
} catch (error) {
    console.error("Database connection failed", error);
}

// Middleware to parse JSON request body
app.use(express.json());
app.use(express.static(path.join(__dirname, "/public")));
const upload = multer({ dest: 'uploads/' }); // Files will be temporarily stored in the 'uploads/' folder
// Serve the frontend
app.get("/api", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
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





// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});


// Add these imports at the top of your file
//const multer = require('multer'); // For handling file uploads
//const csv = require('csv-parser'); // For parsing CSV files
//const fs = require('fs'); // For file system operations

// Add this after your existing middleware setup
//const upload = multer({ dest: 'uploads/' });



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



// Endpoint to check security headers using securityheaders.com
app.post('/api/check-security-headers', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: 'Please provide a valid URL.' });
    }

    try {
        // Fetch the security headers report from securityheaders.com
        const response = await axios.get(`https://securityheaders.com/?q=${url}&followRedirects=on`);

        // Extract the grade and other details from the response
        const grade = response.data.match(/<span class="grade-[A-F]">([A-F])<\/span>/)?.[1] || 'N/A';
        const report = response.data.match(/<div class="report">([\s\S]*?)<\/div>/)?.[1] || 'No report available.';

        // Return the grade and report
        return res.json({ url, grade, report });
    } catch (error) {
        console.error('Error fetching security headers:', error.message);
        return res.status(500).json({ error: 'Failed to fetch security headers.' });
    }
});




