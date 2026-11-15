const localWaterKraft = ["localhost", "127.0.0.1"].includes(window.location.hostname) && ["5500", "8080"].includes(window.location.port);
window.WATERKRAFT_API_BASE_URL = localWaterKraft
    ? window.location.protocol + "//" + window.location.hostname + ":3000"
    : window.location.origin;
