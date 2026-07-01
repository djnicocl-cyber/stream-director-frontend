import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track, VideoPresets } from 'livekit-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://stream-director-backend-production.up.railway.app';
const LK = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stream-director-13gpu9p5.livekit.cloud';

const ROOM_OPTIONS = {
  adaptiveStream: true,
  dynacast: true,
  videoCaptureDefaults: { resolution: VideoPresets.h720.resolution },
  // Sin audioCaptureDefaults para no interferir con permisos de camara
  publishDefaults: {
    videoEncoding: { maxBitrate: 1_200_000, maxFramerate: 30 },
    dtx: false,
    red: false,
    simulcast: true,
    audioPreset: undefined,
  },
};

export default function JoinPage() {
  const router = useRouter();
  const { roomId } = router.query;
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(false);
  const roomRef = useRef(null);
  const videoRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (roomRef.current) roomRef.current.disconnect();
    };
  }, []);

  // Funcion para silenciar y despublicar cualquier track de audio
  async function disableAllAudio(room) {
    try {
      // Desactivar microfono
      await room.localParticipant.setMicrophoneEnabled(false);
    } catch (e) {
      console.warn('setMicrophoneEnabled(false) error:', e);
    }
    // Unpublish cualquier track de audio que se haya publicado automaticamente
    for (const pub of room.localParticipant.audioTrackPublications.values()) {
      try {
        await room.localParticipant.unpublishTrack(pub.track);
      } catch (e) {
        console.warn('unpublishTrack audio error:', e);
      }
    }
  }

  async function connectToRoom(roomId, participantName, token) {
    const room = new Room(ROOM_OPTIONS);
    roomRef.current = room;
    room.on(RoomEvent.DataReceived, (payload) => {
      try { const data = JSON.parse(new TextDecoder().decode(payload)); if (data.type === 'selected') setSelected(data.identity === participantName); } catch (e) {}
    });
    room.on(RoomEvent.Disconnected, () => {
      setStatus('reconnecting'); setMsg('Reconectando...');
      reconnectRef.current = setTimeout(async () => {
        try {
          const res = await fetch(BACKEND + '/api/token/streamer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, participantName }) });
          const { token: newToken } = await res.json();
          await connectToRoom(roomId, participantName, newToken);
        } catch (e) { setStatus('error'); setMsg('Error al reconectar'); }
      }, 3000);
    });
    room.on(RoomEvent.Reconnecting, () => { setStatus('reconnecting'); setMsg('Reconectando a LiveKit...'); });
    room.on(RoomEvent.Reconnected, () => {
      setStatus('connected'); setMsg('Reconectado - esperando ser seleccionado');
      // Asegurar que el audio sigue desactivado despues de reconectar
      disableAllAudio(room);
    });
    // Escuchar si LiveKit activa audio automaticamente y desactivarlo
    room.on(RoomEvent.LocalTrackPublished, (pub) => {
      if (pub.kind === Track.Kind.Audio) {
        console.warn('Audio track publicado automaticamente - despublicando...');
        room.localParticipant.unpublishTrack(pub.track).catch(console.warn);
      }
    });

    await room.connect(LK, token);

    // Deshabilitar todo audio inmediatamente despues de conectar
    await disableAllAudio(room);

    // Solo camara - con manejo de error explicito
    try {
      await room.localParticipant.setCameraEnabled(true);
      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (camPub && camPub.track && videoRef.current) camPub.track.attach(videoRef.current);
    } catch (e) {
      console.error('Error al activar camara:', e);
      setStatus('error');
      setMsg('Error al activar camara: ' + (e?.message || e));
      return;
    }

    setStatus('connected');
    setMsg('Conectado - esperando ser seleccionado');
  }

  async function handleJoin() {
    if (!name.trim() || !roomId) return;
    setStatus('connecting'); setMsg('Obteniendo token...');
    try {
      const res = await fetch(BACKEND + '/api/token/streamer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, participantName: name.trim() }) });
      if (!res.ok) throw new Error('Error obteniendo token');
      const { token } = await res.json();
      setMsg('Conectando...');
      await connectToRoom(roomId, name.trim(), token);
    } catch (e) { setStatus('error'); setMsg('Error: ' + e.message); }
  }

  const isConnected = status === 'connected' || status === 'reconnecting';

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', fontFamily: 'sans-serif' }}>
      {status === 'idle' && (
        <div style={{ background: '#111', border: '1px solid #333', borderRadius: '12px', padding: '40px', maxWidth: '400px', width: '100%', textAlign: 'center' }}>
          <h1 style={{ fontSize: '24px', marginBottom: '8px' }}>Unirse como Streamer</h1>
          <p style={{ color: '#888', marginBottom: '24px' }}>Sala: {roomId}</p>
          <input type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleJoin()} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #333', background: '#0a0a0a', color: 'white', fontSize: '16px', marginBottom: '16px', boxSizing: 'border-box' }} />
          <button onClick={handleJoin} disabled={!name.trim()} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: 'none', background: name.trim() ? '#2563eb' : '#333', color: 'white', fontSize: '16px', cursor: name.trim() ? 'pointer' : 'not-allowed' }}>Unirse</button>
        </div>
      )}
      {status !== 'idle' && (
        <div style={{ width: '100%', maxWidth: '600px', textAlign: 'center' }}>
          <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '8px', background: selected ? '#064e3b' : '#1c1c1e', border: '1px solid ' + (selected ? '#10b981' : '#333'), fontSize: '18px', fontWeight: 'bold' }}>
            {selected ? 'PROYECTANDO EN PANTALLA' : status === 'reconnecting' ? 'Reconectando...' : status === 'error' ? 'Error de conexion' : 'En espera'}
          </div>
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <video ref={videoRef} autoPlay muted playsInline style={{ width: '100%', borderRadius: '12px', background: '#111', border: '2px solid ' + (selected ? '#10b981' : '#333') }} />
            {selected && (
              <div style={{ position: 'absolute', top: '12px', left: '12px', background: '#10b981', color: 'white', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                EN VIVO
              </div>
            )}
          </div>
          <p style={{ color: '#888', fontSize: '14px' }}>{msg}</p>
          <p style={{ color: '#666', fontSize: '12px' }}>Sala: {roomId} | Nombre: {name}</p>
          {isConnected && (
            <button onClick={() => { if (reconnectRef.current) clearTimeout(reconnectRef.current); if (roomRef.current) roomRef.current.disconnect(); setStatus('idle'); setMsg(''); setSelected(false); }} style={{ marginTop: '16px', padding: '8px 24px', borderRadius: '8px', border: '1px solid #555', background: 'transparent', color: '#888', cursor: 'pointer' }}>Salir</button>
          )}
          {status === 'error' && (
            <button onClick={() => { setStatus('idle'); setMsg(''); setSelected(false); }} style={{ marginTop: '16px', padding: '8px 24px', borderRadius: '8px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}>Reintentar</button>
          )}
        </div>
      )}
    </div>
  );
}
