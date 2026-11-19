# NEXA Chrome Companion Extension (Manifest V3)

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this `chrome-extension` folder (or extract the downloaded `nexa-chrome-extension.zip` from NEXA's System & Browser Bridge modal).
4. Click the extension icon in Chrome to verify the relay URL matches your active NEXA instance (`ws://localhost:3000/api/browser-ws?role=extension` for local or `wss://<your-nexa-host>/api/browser-ws?role=extension` for deployed preview).
5. Return to NEXA — the Browser Operator badge will switch to **CHROME EXTENSION CONNECTED**.
