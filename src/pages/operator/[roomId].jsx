import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Room, RoomEvent } from 'livekit-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://stream-director-backend-production.up.railway.app';
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stream-director-13gpu9p5.livekit.cloud';

export default function OperatorPage() {
    const router = useRouter();
    const { roomId } = router.query;
    const [participants, setParticipants] = useState([]);
    const [selected, setSelected] = useState(null);
    const [status, setStatus] = useState('Conectando...');
    const roomRef = useRef(null);

  useEffect(() => {
        if (!roomId) return;
        async function connect() {
                try {
                          const r = await fetch(BACKEND + '/api/token/operator', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ roomId }),
                          });
                          const { token } = await r.json();
                          const room = new Room();
                          roomRef.current = room;
                          const upd = () => setParticipants(Array.from(room.remoteParticipants.values()));
                          room.on(RoomEvent.ParticipantConnected, upd);
                          room.on(RoomEvent.ParticipantDisconnected, upd);
                          room.on(RoomEvent.DataReceived, (data) => {
                                      try {
                                                    const msg = JSON.parse(new TextDecoder().decode(data));
                                                    if (msg.type === 'selected') setSelected(msg.identity);
                                      } catch (e) {}
                          });
                          await room.connect(LK_URL, token);
                          setStatus('Conectado');
                          upd();
                } catch (e) {
                          setStatus('Error: ' + e.message);
                }
        }
        connect();
        return () => { roomRef.current?.disconnect(); };
  }, [roomId]);

  async function sel(identity) {
        await fetch(BACKEND + '/api/rooms/' + roomId + '/select', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantIdentity: identity }),
        });
        setSelected(identity);
        const room = roomRef.current;
        if (room) {
                const data = new TextEncoder().encode(JSON.stringify({ type: 'selected', identity }));
                room.localParticipant.publishData(data, { reliable: true });
        }
  }

  const streamers = participants.filter(p => p.identity.startsWith('streamer_'));

  return (
        <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                          <div>
                                    <h1 style={{ fontSize: '1.5rem' }}>Panel del Operador</h1>h1>
                                    <p style={{ color: '#aaa' }}>Sala: {roomId} - {status}</p>p>
                          </div>div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                                  <button className="btn" onClick={() => window.open('/join/' + roomId, '_blank')} style={{ width: 'auto' }}>
                                              QR asistentes
                                  </button>button>
                                  <button className="btn" onClick={() => window.open('/screen/' + roomId, '_blank')} style={{ width: 'auto', background: '#00b894' }}>
                                              Abrir pantalla
                                  </button>button>
                        </div>div>
                </div>div>
        
          {streamers.length === 0 ? (
                  <div style={{ textAlign: 'center', marginTop: '4rem', color: '#aaa' }}>
                            <div style={{ fontSize: '3rem' }}>📡</div>div>
                            <p>Esperando asistentes...</p>p>
                  </div>div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                    {streamers.map(p => (
                                <div
                                                key={p.identity}
                                                onClick={() => sel(p.identity)}
                                                style={{
                                                                  border: selected === p.identity ? '2px solid #6c5ce7' : '2px solid #333',
                                                                  borderRadius: '8px',
                                                                  padding: '1rem',
                                                                  cursor: 'pointer',
                                                                  background: selected === p.identity ? '#1a1a2e' : '#111',
                                                }}
                                              >
                                              <p style={{ fontWeight: 'bold' }}>{p.name || p.identity}</p>p>
                                              <p style={{ color: selected === p.identity ? '#a29bfe' : '#aaa', fontSize: '.85rem' }}>
                                                {selected === p.identity ? 'Proyectando' : 'Tap para proyectar'}
                                              </p>p>
                                </div>div>
                              ))}
                  </div>div>
              )}
        </div>div>
      );
}</div>
