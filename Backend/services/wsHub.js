const clients = new Set();

function attachWebSocketServer(wss) {
  wss.on("connection", (ws) => {
    clients.add(ws);
    ws.on("close", () => clients.delete(ws));
    ws.on("error", () => clients.delete(ws));
  });
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  clients.forEach((ws) => {
    if (ws.readyState === 1) ws.send(msg);
  });
}

module.exports = { attachWebSocketServer, broadcast };
