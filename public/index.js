async function checkHeaders() {
  const url = document.getElementById("url").value;
  const reportContainer = document.getElementById("report");
  const presentScoreElement = document.getElementById("presentScore");
  const missingScoreElement = document.getElementById("missingScore");
  const gradeBox = document.getElementById("gradeBox");
  const scoreSection = document.getElementById("scoreSection");

  const mainHeaders = [
    "X-Frame-Options",
    "Strict-Transport-Security",
    "Content-Security-Policy",
    "X-Content-Type-Options",
    "Referrer-Policy",
    "X-XSS-Protection",
  ];

  // Clear previous results
  reportContainer.innerHTML = "";
  presentScoreElement.textContent = "0%";
  missingScoreElement.textContent = "0%";
  gradeBox.textContent = "Grade: -";

  if (!url) {
    alert("Please enter a valid URL.");
    return;
  }

  try {
    const response = await fetch("/api/headers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: url }),
    });

    if (response.ok) {
      const data = await response.json();
      const headers = data.headers;
      console.log(headers);
      let mainPresentCount = 0;
      let otherPresentCount = 0;
      let reportHTML = "";

      Object.keys(headers).forEach((header) => {
        const status = headers[header];
        const isMainHeader = mainHeaders.includes(header);

        if (status !== "missing") {
          if (isMainHeader) mainPresentCount++;
          else otherPresentCount++;
        }

        const cardClass = status === "missing" ? "missing" : "present";
        reportHTML += `
                  <div class="report-card ${cardClass}">
                      <div class="d-flex justify-content-between align-items-center">
                          <h5>${header}</h5>
                          <span>${status.toUpperCase()}</span>
                      </div>
                  </div>
              `;
      });

      reportContainer.innerHTML = reportHTML;

      const totalMainHeaders = mainHeaders.length;
      const totalOtherHeaders = Object.keys(headers).length - totalMainHeaders;

      const mainScore = (mainPresentCount / totalMainHeaders) * 90;
      const otherScore = (otherPresentCount / totalOtherHeaders) * 10;

      const totalScore = Math.round(mainScore + otherScore);
      const missingScore = 100 - totalScore;

      presentScoreElement.textContent = `${totalScore}%`;
      missingScoreElement.textContent = `${missingScore}%`;

      let grade = "F";
      if (totalScore >= 60) grade = "A";
      else if (totalScore >= 50) grade = "B";
      else if (totalScore >= 40) grade = "C";
      else if (totalScore >= 30) grade = "D";
      else if (totalScore >= 10) grade = "F";

      gradeBox.textContent = `Grade: ${grade}`;

      scoreSection.style.display = "block";
    } else {
      alert("Failed to fetch headers. Please try again.");
    }
  } catch (error) {
    console.error("Error:", error);
    alert("An error occurred. Please try again later.");
  }
}

document.querySelectorAll(".box-header").forEach((header) => {
  header.addEventListener("click", () => {
    const content = header.nextElementSibling;
    const arrow = header.querySelector(".arrow");
    content.classList.toggle("show");
    arrow.classList.toggle("rotate");
  });
});

async function streamResponse() {
  const responseContainer = document.getElementById("response-container");
  responseContainer.innerHTML = ""; // Clear previous content

  const response = await puter.ai.chat(
    "Explain the theory of relativity in detail",
    { stream: true }
  );

  for await (const part of response) {
    responseContainer.innerHTML += part?.text; // Append streamed response
  }
}

// Add these functions to your existing JavaScript
// Function to process the CSV file
function processCSV() {
  const fileInput = document.getElementById("csvFileInput");
  const file = fileInput.files[0];

  if (file) {
    const formData = new FormData();
    formData.append("csvFile", file);

    document.getElementById("csvSpinner").style.display = "block"; // show spinner

    fetch("/api/upload-csv", {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        document.getElementById("csvSpinner").style.display = "none"; // hide spinner

        // ✅ Filter out rows that contain errors (failed header fetch)
        const validRows = data.filter((row) => !row.error);

        if (validRows.length > 0) {
          // Convert processed data to CSV format
          const headers = Object.keys(validRows[0]).join(","); // CSV headers
          const rows = validRows
            .map((row) => Object.values(row).join(",")) // CSV rows
            .join("\n");

          // Combine headers and rows
          const csvData = `${headers}\n${rows}`;

          // Store processed data in a global variable
          window.processedCsvData = csvData;

          // Show the download button
          document.getElementById("downloadCsvButton").style.display = "block";
          document.getElementById("downloadPredictionButton").style.display =
            "block"; // Show prediction button too
        } else {
          alert("No valid data found in processed results.");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        document.getElementById("csvSpinner").style.display = "none"; // hide spinner

        alert("Failed to process CSV file. Please try again.");
      });
  } else {
    alert("Please select a CSV file to process.");
  }
}

// Function to download the processed CSV
function downloadCSV() {
  const processedData = window.processedCsvData;
  if (processedData) {
    // Create a Blob with the processed CSV data
    const blob = new Blob([processedData], { type: "text/csv" });

    // Create a temporary URL for the Blob
    const url = URL.createObjectURL(blob);

    // Create a hidden <a> element to trigger the download
    const a = document.createElement("a");
    a.href = url;
    a.download = "processed_results.csv"; // Set the file name
    document.body.appendChild(a); // Append the <a> element to the DOM
    a.click(); // Trigger the download
    document.body.removeChild(a); // Remove the <a> element from the DOM

    // Revoke the temporary URL to free up memory
    URL.revokeObjectURL(url);

    // Hide the download button after clicking
    document.getElementById("downloadCsvButton").style.display = "none";
  } else {
    alert("No processed data available to download.");
  }
}

// Function to check security headers using securityheaders.com
function checkSecurityHeaders() {
  const url = document.getElementById("securityUrlInput").value;

  if (!url) {
    alert("Please enter a valid URL.");
    return;
  }

  fetch("/api/check-security-headers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url }),
  })
    .then((response) => response.json())
    .then((data) => {
      // Display the results
      document.getElementById("securityGrade").textContent = data.grade;
      document.getElementById("securityReport").textContent = data.report;
      document.getElementById("securityHeadersResult").style.display = "block";
    })
    .catch((error) => {
      console.error("Error:", error);
      alert("Failed to fetch security headers. Please try again.");
    });
}

// Function to fetch real-time solutions from DeepSeek API
async function fetchRealTimeSolution() {
  const url = document.getElementById("url").value;
  const responseDiv = document.getElementById("deepseek-response");
  responseDiv.innerHTML = "Loading...";

  if (!url) {
    alert("Please enter a valid URL first.");
    return;
  }

  try {
    // Step 1: Fetch headers for the URL
    const headersResponse = await fetch("/api/headers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const headersData = await headersResponse.json();

    // Step 2: Identify missing headers
    const missingHeaders = Object.entries(headersData.headers)
      .filter(([header, status]) => status === "missing")
      .map(([header]) => header);

    if (missingHeaders.length === 0) {
      responseDiv.innerHTML =
        '<div class="alert alert-success">All security headers are present!</div>';
      return;
    }

    // Step 3: Construct the message for DeepSeek API
    const message = `How can I fix missing security headers? Here is the list of missing HTTP security headers: ${missingHeaders.join(
      ", "
    )}`;

    // Step 4: Call DeepSeek API via your backend
    const deepseekResponse = await fetch("/api/deepseek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });

    const deepseekData = await deepseekResponse.json();

    // Step 5: Format and display the solution
    const solutionText = deepseekData.response;
    const formattedSolution = `
    <div class="solution-card">
      <h3>Solution for Missing Headers</h3>
      <p>Here are the steps to fix the missing security headers:</p>
      <div>${marked.parse(solutionText)}</div>
    </div>
  `;

    responseDiv.innerHTML = formattedSolution;
  } catch (error) {
    console.error("Error:", error);
    responseDiv.innerHTML =
      '<div class="alert alert-danger">Failed to fetch real-time solution. Please try again.</div>';
  }
}

// ✅ Function to download predictions_results.csv from server
function downloadPredictionCSV() {
  const a = document.createElement("a");
  a.href = "/download/predictions";
  a.download = "predictions_results.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
