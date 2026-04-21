                    import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://stream-director-backend-production.up.railway.app';
const LK = 'wss://stream-director-13gpu9p5.livekit.cloud';

export default function JoinPage() {
    const router = useRouter();
    const { roomId } = router.query;
    const [name, setName] = useState('');
    const [status, setStatus] = useState('idle');
    const [msg, setMsg] = useState('');
    const [selected, setSelected] = useState(false);
    const roomRef = useRef(null);
    const videoRef = useRef(null);

  useEffect(() => {
        return () => { if (roomRef.current) roomRef.current.disconnect(); };
  }, []);

  async function handleJoin() {
        if (!name.trim() || !roomId) return;
        setStatus('connecting');
        setMsg('Obteniendo token...');
        try {
                const res = await fetch(BACKEND + '/api/token/streamer', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ roomId, participantName: name.trim() }),
                });
                if (!res.ok) throw new Error('Error obteniendo token');
                const { token } = await res.json();
                setMsg('Conectando...');
                const room = new Room();
                roomRef.current = room;
                room.on(RoomEvent.DataReceived, (payload) => {
                          try {
                                      const data = JSON.parse(new TextDecoder().decode(payload));
                                      if (data.type === 'selected') setSelected(data.participantIdentity === name.trim());
                          } catch (e) {}
                });
                room.on(RoomEvent.Disconnected, () => { setStatus('disconnected'); setMsg('Desconectado'); });
                await room.connect(LK, token);
                setMsg('Activando camara...');
                await room.localParticipant.setMicrophoneEnabled(true);
                await room.localParticipant.setCameraEnabled(true);
                const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
                if (camPub && camPub.track && videoRef.current) camPub.track.attach(videoRef.current);
                setStatus('connected');
                setMsg('Conectado - esperando ser seleccionado');
                const interval = setInterval(async () => {
                          try {
                                      const r = await fetch(BACKEND + '/api/rooms/' + roomId + '/selected');
                                      if (r.ok) { const d = await r.json(); setSelected(d.selected === name.trim()); }
                          } catch (e) {}
                }, 2000);
                room.on(RoomEvent.Disconnected, () => clearInterval(interval));
        } catch (e) {
                setStatus('error');
                setMsg('Error: ' + e.message);
        }
  }

  return (
        <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
          {status === 'idle' && (
                  <div style={{ background: '#111', border: '1px solid #333', borderRadius: '12px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
                              <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Unirse como Streamer</h1>h1>
                              <p style={{ color: '#888', marginBottom: '24px' }}>Sala: {roomId}</p>p>
                              <input type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#0a0a0a', color: 'white', fontSize: '16px', marginBottom: '16px', boxSizing: 'border-box' }} />
                              <button onClick={handleJoin} disabled={!name.trim()} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: name.trim() ? '#2563eb' : '#333', color: 'white', fontSize: '16px', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Unirse</button>button>
                  </div>div>
                )}
          {status !== 'idle' && (
                  <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
                              <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: selected ? '#064e3b' : '#1c1c1e', border: '1px solid ' + (selected ? '#10b981' : '#333'), fontSize: '18px', fontWeight: 'bold' }}>
                                {selected ? 'PROYECTANDO EN PANTALLA' : 'En espera'}
                              </div>div>
                              <div style={{ position: 'relative', marginBottom: '16px' }}>
                                            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: '12px', background: '#111', border: '2px solid ' + (selected ? '#10b981' : '#333') }} />
                                {selected && <div style={{ position: 'absolute', top: '12px', left: '12px', background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>EN VIVO</div>div>}
                              </div>div>
                              <p style={{ color: '#888', fontSize: '14px' }}>{msg}</p>p>
                              <p style={{ color: '#666', fontSize: '12px' }}>Sala: {roomId} | Nombre: {name}</p>p>
                    {(status === 'connected' || status === 'disconnected') && (
                                <button onClick={() => { if (roomRef.current) roomRef.current.disconnect(); setStatus('idle'); setMsg(''); setSelected(false); }} style={{ marginTop: '16px', padding: '8px 24px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: '#888', cursor: 'pointer' }}>Salir</button>button>
                              )}
                  </div>div>
                )}
        </div>div>
      );
}
