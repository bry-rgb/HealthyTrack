const fs = require("node:fs");
const path = require("node:path");

const apiBaseUrl = process.env.API_BASE_URL;
if (!apiBaseUrl) {
    throw new Error("API_BASE_URL não foi configurada no serviço frontend do Render.");
}

const parsedUrl = new URL(apiBaseUrl);
if (parsedUrl.protocol !== "https:") {
    throw new Error("API_BASE_URL deve usar HTTPS no deploy público.");
}

const normalizedUrl = apiBaseUrl.replace(/\/+$/, "");
const content = `window.WATERKRAFT_API_BASE_URL = ${JSON.stringify(normalizedUrl)};\n`;
fs.writeFileSync(path.join(__dirname, "api-config.js"), content);
