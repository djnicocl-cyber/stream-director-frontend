import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://stream-director-backend-production.up.railway.app';
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stream-director-13gpu9p5.livekit.cloud';

const ROOM_OPTIONS = { adaptiveStream: true, dynacast: true };

export default function ScreenPage() {
          const router = useRouter();
          const { roomId } = router.query;
          const [status, setStatus] = useState('connecting');
          const roomRef = useRef(null);
          const videoRef = useRef(null);
          const currentTrackRef = useRef(null);
          const selectedRef = useRef(null);
          const reconnectRef = useRef(null);

  useEffect(() => {
              if (!roomId) return;
              let pollInterval;

                async function getToken() {
                              const res = await fetch(BACKEND + '/api/token/screen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }) });
                              if (!res.ok) throw new Error('token error');
                              const { token } = await res.json();
                              return token;
                }

                function attachBestTrack(room) {
                              const parts = Array.from(room.remoteParticipants.values());
                              let target = parts.find(p => p.identity === selectedRef.current);
                              if (!target) target = parts.find(p => p.identity.startsWith('streamer_')) || null;
                              if (!target) { if (videoRef.current) videoRef.current.srcObject = null; currentTrackRef.current = null; return; }
                              const pub = target.getTrackPublication(Track.Source.Camera);
                              if (pub && pub.track && pub.track !== currentTrackRef.current) { currentTrackRef.current = pub.track; if (videoRef.current) pub.track.attach(videoRef.current); }
                }

                async function connect() {
                              try {
                                              const token = await getToken();
                                              const room = new Room(ROOM_OPTIONS);
                                              roomRef.current = room;
                                              room.on(RoomEvent.DataReceived, (payload) => {
                                                                try { const d = JSON.parse(new TextDecoder().decode(payload)); if (d.type === 'selected') { selectedRef.current = d.identity; attachBestTrack(room); } } catch (e) {}
                                              });
                                              room.on(RoomEvent.TrackSubscribed, () => attachBestTrack(room));
                                              room.on(RoomEvent.TrackUnsubscribed, () => attachBestTrack(room));
                                              room.on(RoomEvent.ParticipantDisconnected, () => attachBestTrack(room));
                                              room.on(RoomEvent.Reconnecting, () => setStatus('reconnecting'));
                                              room.on(RoomEvent.Reconnected, () => { setStatus('connected'); attachBestTrack(room); });
                                              room.on(RoomEvent.Disconnected, () => { setStatus('reconnecting'); reconnectRef.current = setTimeout(async () => { try { await connect(); } catch (e) { setStatus('error'); } }, 3000); });
                                              await room.connect(LK_URL, token);
                                              setStatus('connected');
                                              try { const r = await fetch(BACKEND + '/api/rooms/' + roomId + '/selected'); if (r.ok) { const { selected } = await r.json(); if (selected) selectedRef.current = selected; } } catch (e) {}
                                              attachBestTrack(room);
                                              pollInterval = setInterval(async () => {
                                                                try { const r = await fetch(BACKEND + '/api/rooms/' + roomId + '/selected'); if (r.ok) { const { selected } = await r.json(); if (selected && selected !== selectedRef.current) { selectedRef.current = selected; attachBestTrack(room); } } } catch (e) {}
                                              }, 10000);
                              } catch (e) { setStatus('error'); }
                }

                connect();
              return () => { if (pollInterval) clearInterval(pollInterval); if (reconnectRef.current) clearTimeout(reconnectRef.current); if (roomRef.current) roomRef.current.disconnect(); };
  }, [roomId]);

  return (
              <div style={{ width: '100vw', height: '100vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      {status === 'connecting' && (
                              <div style={{ position: 'absolute', color: 'white', fontSize: '18px', textAlign: 'center' }}>
                                                <p>Conectando...</p>p>
                                        <p style={{ color: '#666', fontSize: '14px' }}>Sala: {roomId}</p>p>
                              </div>div>
                    )}
                      {status === 'reconnecting' && (
                              <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(234,179,8,0.9)', color: 'black', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' }}>
                                        Reconectando...
                              </div>div>
                    )}
                      {status === 'connected' && !selectedRef.current && (
                              <div style={{ position: 'absolute', color: '#666', fontSize: '18px' }}>
                                        <p>Esperando seleccion...</p>p>
                              </div>div>
                    )}
              </div>div>
            );
}</p>
