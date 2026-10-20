// Local development uses local Colyseus; published GitHub Pages uses Render.
export const ONLINE_SERVER=(location.hostname==='localhost'||location.hostname==='127.0.0.1')?'ws://localhost:2567':'wss://factory-card-duel-test.onrender.com';
