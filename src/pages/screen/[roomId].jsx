import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://stream-director-backend-production.up.railway.app';
const LK_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL || 'wss://stream-director-13gpu9p5.livekit.cloud';

export default function ScreenPage() {
      const router = useRouter();
      const { roomId } = router.query;
      const [status, setStatus] = useState('connecing');
      const [selected, setSelected] = useState(null);
      const roomRef = useRef(null);
      const videoRef = useRef(null);
      const currentTrackRef = useRef(null);

  useEffect(() => {
          if (!roomId) return;
          let room;
          let pollInterval;

                async function connect() {
                          try {
                                      const res = await fetch(BACKEND + '/api/token/screen', {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ roomId }),
                                      });
                                      if (!res.ok) throw new Error('Error obteniendo token');
                                      const { token } = await res.json();

                            room = new Room();
                                      roomRef.current = room;

                            room.on(RoomEvent.TrackSubscribed, (track, pub, participant) => {
                                          checkAndAttach(room);
                            });
                                      room.on(RoomEvent.TrackUnsubscribed, () => {
                                                    checkAndAttach(room);
                                      });
                                      room.on(RoomEvent.ParticipantDisconnected, () => {
                                                    checkAndAttach(room);
                                      });
                                      room.on(RoomEvent.DataReceived, (payload) => {
                                                    try {
                                                                    const data = JSON.parse(new TextDecoder().decode(payload));
                                                                    if (data.type === 'selected') {
                                                                                      setSelected(data.participantIdentity);
                                                                                      setTimeout(() => checkAndAttach(room), 500);
                                                                    }
                                                    } catch (e) {}
                                      });

                            await room.connect(LK_URL, token);
                                      setStatus('connected');

                            pollInterval = setInterval(async () => {
                                          try {
                                                          const r = await fetch(BACKEND + '/api/rooms/' + roomId + '/selected');
                                                          const { selected } = await r.json();
                                                          if (selected) {
                                                                            setSelected(selected);
                                                                            checkAndAttach(room, selected);
                                                          }
                                          } catch (e) {}
                            }, 3000);

                            checkAndAttach(room);
                          } catch (e) {
                                      setStatus('error: ' + e.message);
                          }
                }

                function checkAndAttach(room, forcedSelected) {
                          const participants = Array.from(room.remoteParticipants.values());
                          let target = null;

            if (forcedSelected) {
                        target = participants.find(({ identity }) => identity === forcedSelected);
            } else {
                        setSelected((prev) => {
                                      const sel = prev;
                                      target = participants.find(({ identity }) => identity === sel);
                                      return prev;
                        });
            }

            if (!target) {
                        target = participants.length ? participants[0] : null;
            }

            if (!target) {
                        if (videoRef.current) videoRef.current.srcObject = null;
                        return;
            }

            const camPub = target.getTrackPublication(Track.Source.Camera);
                          if (camPub && camPub.track && camPub.track !== currentTrackRef.current) {
                                      currentTrackRef.current = camPub.track;
                                      camPub.track.attach(videoRef.current);
                          }
                }

                connect();

                return () => {
                          if (pollInterval) clearInterval(pollInterval);
                          if (room) room.disconnect();
                };
  }, [roomId]);

  return (
          <div
                    style={{
                                width: '100vw',
                                height: '100vh',
                                background: '#000',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                    }}
                  >
                <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
          
              {status !== 'connected' && (
                              <div
                                            style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: 'white',
                                                            fontSize: '18px',
                                                            textAlign: 'center',
                                            }}
                                          >
                                        <p>{status === 'connecting' ? 'Conectando...' : status}</p>
                                        <p style={{ color: '#666', fontSize: '14px' }}>Sala: {roomId}</p>
                              </div>
                )}
          
              {status === 'connected' && !selected && (
                              <div
                                            style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                            color: '#666',
                                                            fontSize: '18px',
                                                            textAlign: 'center',
                                            }}
                                          >
                                        <p>Esperando seleccion...</p>
                              </div>
                )}
          
              {selected && (
                              <div
                                            style={{
                                                            position: 'absolute',
                                                            bottom: '16px',
                                                            left: '16px',
                                                            background: 'rgba(0,0,0,0.6)',
                                                            color: 'white',
                                                            padding: '6px 16px',
                                                            borderRadius: '20px',
                                                            fontSize: '13px',
                                            }}
                                          >
                                  {selected}
                              </div>
                )}
          </div>
        );
}
