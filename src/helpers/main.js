const fs = require("fs");
const path = require("path");

function setupDownloadDirectory() {
  const downloadDir = path.join(__dirname, "downloads");
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " Б";
  else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + " КБ";
  else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + " МБ";
  return (bytes / 1073741824).toFixed(2) + " ГБ";
}

function sanitizeFileName(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, "") // Remove invalid characters
    .replace(/\s+/g, "_") // Replace spaces with underscores
    .substring(0, 255); // Limit length to 255 characters
}

module.exports = { setupDownloadDirectory, formatFileSize, sanitizeFileName };
