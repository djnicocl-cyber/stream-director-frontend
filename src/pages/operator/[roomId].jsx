import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Room, RoomEvent } from 'livekit-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://stream-director-backend-production.up.railway.app';
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stream-director-13gpu9p5.livekit.cloud';

const ROOM_OPTIONS = { adaptiveStream: true, dynacast: true };

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function waitingTime(joinedAt, now) {
  const secs = Math.floor((now - new Date(joinedAt).getTime()) / 1000);
  if (secs < 60) return secs + 's';
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return mins + 'm ' + rem + 's';
}

export default function OperatorPage() {
  const router = useRouter();
  const { roomId } = router.query;
  const [liveParticipants, setLiveParticipants] = useState(new Set());
  const [queue, setQueue] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState('Conectando...');
  const roomRef = useRef(null);
  const reconnectRef = useRef(null);
  const now = useNow();

  const fetchQueue = useCallback(async () => {
    if (!roomId) return;
    try {
      const r = await fetch(BACKEND + '/api/rooms/' + roomId + '/queue');
      const { queue: q } = await r.json();
      setQueue(q || []);
    } catch (e) {}
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;

    async function connect() {
      try {
        const r = await fetch(BACKEND + '/api/token/operator', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }) });
        const { token } = await r.json();
        const room = new Room(ROOM_OPTIONS);
        roomRef.current = room;

        const upd = () => {
          const ids = new Set(
            Array.from(room.remoteParticipants.values())
              .filter(p => p.identity.startsWith('streamer_'))
              .map(p => p.identity)
          );
          setLiveParticipants(ids);
        };

        room.on(RoomEvent.ParticipantConnected, (p) => {
          upd();
          if (p.identity.startsWith('streamer_')) fetchQueue();
        });
        room.on(RoomEvent.ParticipantDisconnected, (p) => {
          upd();
          if (p.identity.startsWith('streamer_')) {
            fetch(BACKEND + '/api/rooms/' + roomId + '/queue/remove', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ identity: p.identity }),
            }).then(() => fetchQueue()).catch(() => {});
          }
        });
        room.on(RoomEvent.DataReceived, (data) => {
          try { const msg = JSON.parse(new TextDecoder().decode(data)); if (msg.type === 'selected') setSelected(msg.identity); } catch (e) {}
        });
        room.on(RoomEvent.Reconnecting, () => setStatus('Reconectando...'));
        room.on(RoomEvent.Reconnected, () => { setStatus('Conectado'); upd(); fetchQueue(); });
        room.on(RoomEvent.Disconnected, () => {
          setStatus('Reconectando...');
          reconnectRef.current = setTimeout(async () => {
            try { await connect(); } catch (e) { setStatus('Error: ' + e.message); }
          }, 3000);
        });

        await room.connect(LK_URL, token);
        setStatus('Conectado');
        upd();
        await fetchQueue();
      } catch (e) { setStatus('Error: ' + e.message); }
    }

    connect();
    return () => { if (reconnectRef.current) clearTimeout(reconnectRef.current); roomRef.current?.disconnect(); };
  }, [roomId, fetchQueue]);

  async function sel(identity) {
    await fetch(BACKEND + '/api/rooms/' + roomId + '/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ participantIdentity: identity }) });
    setSelected(identity);
    const room = roomRef.current;
    if (room) { const data = new TextEncoder().encode(JSON.stringify({ type: 'selected', identity })); room.localParticipant.publishData(data, { reliable: true }); }
  }

  const orderedQueue = queue.filter(p => liveParticipants.has(p.identity));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', padding: '1.5rem', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.4rem', margin: 0 }}>Panel del Operador</h1>
          <p style={{ color: '#666', margin: '4px 0 0', fontSize: '0.85rem' }}>Sala: {roomId} · {status}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button onClick={() => window.open('/join/' + roomId, '_blank')} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #333', background: '#111', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>🔗 Enlace asistentes</button>
          <button onClick={() => window.open('/screen/' + roomId, '_blank')} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#00b894', color: 'white', cursor: 'pointer', fontSize: '0.85rem' }}>📺 Abrir pantalla</button>
        </div>
      </div>

      {orderedQueue.length > 0 && (
        <div style={{ marginBottom: '1rem', color: '#555', fontSize: '0.82rem' }}>
          {orderedQueue.length} {orderedQueue.length === 1 ? 'asistente en cola' : 'asistentes en cola'} · orden de llegada
        </div>
      )}

      {orderedQueue.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '5rem', color: '#444' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
          <p style={{ fontSize: '1rem' }}>Esperando asistentes...</p>
          <p style={{ fontSize: '0.8rem', color: '#333', marginTop: '0.5rem' }}>Aparecerán aquí en orden de llegada</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxWidth: '600px' }}>
          {orderedQueue.map((p, idx) => {
            const isSelected = selected === p.identity;
            const isFirst = idx === 0 && !isSelected;
            return (
              <div key={p.identity} onClick={() => sel(p.identity)} style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.9rem 1.2rem', borderRadius: '10px', cursor: 'pointer', border: isSelected ? '2px solid #6c5ce7' : isFirst ? '2px solid #3d3d3d' : '2px solid #1e1e1e', background: isSelected ? '#1a1a2e' : '#111', transition: 'border-color 0.15s' }}>
                <div style={{ minWidth: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem', background: isSelected ? '#6c5ce7' : isFirst ? '#2a2a2a' : '#1a1a1a', color: isSelected ? 'white' : isFirst ? '#bbb' : '#555', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1rem', color: isSelected ? '#a29bfe' : 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#555' }}>Esperando {waitingTime(p.joinedAt, now)}</p>
                </div>
                <div style={{ flexShrink: 0 }}>
                  {isSelected ? (
                    <span style={{ background: '#6c5ce7', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 'bold' }}>🎥 EN PANTALLA</span>
                  ) : (
                    <span style={{ color: isFirst ? '#888' : '#444', fontSize: '0.8rem' }}>Tap para proyectar</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
