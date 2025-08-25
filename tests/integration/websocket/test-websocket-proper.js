// Test proper WebSocket with real client
const server = Bun.serve({
  port: 4004,
  fetch(req, server) {
    // upgrade the request to a WebSocket
    if (server.upgrade(req)) {
      return; // do not return a Response
    }
    return new Response("Upgrade failed :(", { status: 500 });
  },
  websocket: {
    message(ws, message) {
      ws.send(`Echo: ${message}`);
    },
  },
});

console.log(`WebSocket server running on ws://localhost:4004`);

// Test client
const ws = new WebSocket("ws://localhost:4004");
ws.onopen = () => {
  console.log("✅ WebSocket connected!");
  ws.send("Hello from client!");
};
ws.onmessage = (event) => {
  console.log("📨 Received:", event.data);
  ws.close();
  server.stop();
  console.log("Test completed successfully!");
};
ws.onerror = (error) => {
  console.error("❌ WebSocket error:", error);
};