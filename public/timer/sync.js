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
    let conn = null;
    let peer = null;
    let destroyed = false;

    const host = {
      code,
      send(data) {
        if (conn?.open) conn.send(data);
      },
      destroy() {
        destroyed = true;
        peer?.destroy();
        peer = null;
        conn = null;
      },
    };

    // Mostra o código imediatamente — não espera o servidor PeerJS
    callbacks.onReady?.(code);

    if (typeof Peer === "undefined") {
      callbacks.onError?.(new Error("PeerJS não carregou. Verifique sua conexão."));
      return host;
    }

    function startPeer() {
      if (destroyed) return;
      peer?.destroy();
      peer = new Peer(PREFIX + code);

      peer.on("open", () => {
        callbacks.onSignalingReady?.();
      });

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

      peer.on("error", (err) => {
        callbacks.onError?.(err);
        if (!destroyed && err?.type !== "unavailable-id") {
          window.setTimeout(startPeer, 3000);
        }
      });
    }

    startPeer();
    return host;
  }

  function connect(code, callbacks) {
    let conn = null;
    let peer = null;
    const target = PREFIX + normalizeCode(code);

    const client = {
      send(data) {
        if (conn?.open) conn.send(data);
      },
      destroy() {
        peer?.destroy();
        peer = null;
        conn = null;
      },
    };

    if (typeof Peer === "undefined") {
      callbacks.onError?.(new Error("PeerJS não carregou."));
      return client;
    }

    peer = new Peer();

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

    return client;
  }

  window.WodSync = { createHost, connect, normalizeCode, PREFIX };
})();
