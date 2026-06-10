(function () {
  "use strict";

  const PREFIX = "wod-timer-";

  function randomCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  function normalizeCode(input) {
    return String(input || "")
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 6);
  }

  function createHost(callbacks) {
    const code = randomCode();
    const peer = new Peer(PREFIX + code);
    let conn = null;

    peer.on("open", () => callbacks.onReady?.(code));
    peer.on("connection", (c) => {
      conn = c;
      c.on("open", () => callbacks.onConnect?.());
      c.on("data", (data) => callbacks.onMessage?.(data));
      c.on("close", () => {
        conn = null;
        callbacks.onDisconnect?.();
      });
      c.on("error", (err) => callbacks.onError?.(err));
    });
    peer.on("error", (err) => callbacks.onError?.(err));

    return {
      code,
      send(data) {
        if (conn?.open) conn.send(data);
      },
      destroy() {
        peer.destroy();
      },
    };
  }

  function connect(code, callbacks) {
    const peer = new Peer();
    let conn = null;
    const target = PREFIX + normalizeCode(code);

    peer.on("open", () => {
      conn = peer.connect(target, { reliable: true });
      conn.on("open", () => callbacks.onConnect?.());
      conn.on("data", (data) => callbacks.onMessage?.(data));
      conn.on("close", () => {
        conn = null;
        callbacks.onDisconnect?.();
      });
      conn.on("error", (err) => callbacks.onError?.(err));
    });
    peer.on("error", (err) => callbacks.onError?.(err));

    return {
      send(data) {
        if (conn?.open) conn.send(data);
      },
      destroy() {
        peer.destroy();
      },
    };
  }

  window.WodSync = { createHost, connect, normalizeCode, PREFIX };
})();
