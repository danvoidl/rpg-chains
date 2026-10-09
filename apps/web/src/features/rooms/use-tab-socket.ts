import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { config } from '@/lib/config';

export interface TabSocket {
  /** The tab's one connection to the server; null until it is created. */
  socket: Socket | null;
  /** Connected right now. */
  connected: boolean;
  /** Lost a connection it had and is trying to get it back (spec §7). */
  reconnecting: boolean;
}

/**
 * The one Socket.IO connection of a tab (Fase 6 plan decision 5): the room lobby and the battle
 * channel share it, so they drop and come back together. Socket.IO reconnects on its own with a
 * backoff; a phone coming back to the tab reconnects at once instead of waiting it out.
 */
export function useTabSocket(): TabSocket {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [everConnected, setEverConnected] = useState(false);

  useEffect(() => {
    const created = io(config.apiUrl, { withCredentials: true });
    const onConnect = () => {
      setConnected(true);
      setEverConnected(true);
    };
    const onDisconnect = () => setConnected(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !created.connected) created.connect();
    };
    created.on('connect', onConnect);
    created.on('disconnect', onDisconnect);
    document.addEventListener('visibilitychange', onVisible);
    setSocket(created);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      created.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, []);

  return { socket, connected, reconnecting: everConnected && !connected };
}
