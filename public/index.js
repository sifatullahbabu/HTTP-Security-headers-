
async function checkHeaders() {
    const url = document.getElementById('url').value;
    const reportContainer = document.getElementById('report');
    const presentScoreElement = document.getElementById('presentScore');
    const missingScoreElement = document.getElementById('missingScore');
    const gradeBox = document.getElementById('gradeBox');
    const scoreSection = document.getElementById('scoreSection');

    const mainHeaders = [
        "X-Frame-Options",
        "Strict-Transport-Security",
        "Content-Security-Policy",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
        "X-XSS-Protection",
        "Cache-Control"
    ];

    // Clear previous results
    reportContainer.innerHTML = '';
    presentScoreElement.textContent = "0%";
    missingScoreElement.textContent = "0%";
    gradeBox.textContent = "Grade: -";

    if (!url) {
        alert('Please enter a valid URL.');
        return;
    }

    try {
        const response = await fetch('/api/headers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: url })
        });

        if (response.ok) {
            const data = await response.json();
            const headers = data.headers;
            console.log(headers);
            let mainPresentCount = 0;
            let otherPresentCount = 0;
            let reportHTML = '';

            Object.keys(headers).forEach(header => {
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

            const mainScore = (mainPresentCount / totalMainHeaders) * 99.5;
            const otherScore = (otherPresentCount / totalOtherHeaders) * 0.5;

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
            alert('Failed to fetch headers. Please try again.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred. Please try again later.');
    }
}



document.querySelectorAll('.box-header').forEach(header => {
  header.addEventListener('click', () => {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('.arrow');
    content.classList.toggle('show');
    arrow.classList.toggle('rotate');
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
  const fileInput = document.getElementById('csvFileInput');
  const file = fileInput.files[0];

  if (file) {
      const formData = new FormData();
      formData.append('csvFile', file);

      fetch('/api/upload-csv', {
          method: 'POST',
          body: formData,
      })
          .then(response => response.json())
          .then(data => {
              if (data.length > 0) {
                  // Convert processed data to CSV format
                  const headers = Object.keys(data[0]).join(','); // CSV headers
                  const rows = data.map(row => {
                      return Object.values(row).join(','); // CSV rows
                  }).join('\n');

                  // Combine headers and rows
                  const csvData = `${headers}\n${rows}`;

                  // Store processed data in a global variable
                  window.processedCsvData = csvData;

                  // Show the download button
                  document.getElementById('downloadCsvButton').style.display = 'block';
              } else {
                  alert('No data processed. Please check the CSV file format.');
              }
          })
          .catch(error => {
              console.error('Error:', error);
              alert('Failed to process CSV file. Please try again.');
          });
  } else {
      alert('Please select a CSV file to process.');
  }
}

// Function to download the processed CSV
function downloadCSV() {
  const processedData = window.processedCsvData;
  if (processedData) {
      // Create a Blob with the processed CSV data
      const blob = new Blob([processedData], { type: 'text/csv' });

      // Create a temporary URL for the Blob
      const url = URL.createObjectURL(blob);

      // Create a hidden <a> element to trigger the download
      const a = document.createElement('a');
      a.href = url;
      a.download = 'processed_results.csv'; // Set the file name
      document.body.appendChild(a); // Append the <a> element to the DOM
      a.click(); // Trigger the download
      document.body.removeChild(a); // Remove the <a> element from the DOM

      // Revoke the temporary URL to free up memory
      URL.revokeObjectURL(url);

      // Hide the download button after clicking
      document.getElementById('downloadCsvButton').style.display = 'none';
  } else {
      alert('No processed data available to download.');
  }
}






// Function to check security headers using securityheaders.com
function checkSecurityHeaders() {
    const url = document.getElementById('securityUrlInput').value;

    if (!url) {
        alert('Please enter a valid URL.');
        return;
    }

    fetch('/api/check-security-headers', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
    })
        .then(response => response.json())
        .then(data => {
            // Display the results
            document.getElementById('securityGrade').textContent = data.grade;
            document.getElementById('securityReport').textContent = data.report;
            document.getElementById('securityHeadersResult').style.display = 'block';
        })
        .catch(error => {
            console.error('Error:', error);
            alert('Failed to fetch security headers. Please try again.');
        });
}




