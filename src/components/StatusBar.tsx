import { useState } from 'react';
import type { FirebaseStatus } from '../lib/firebase';
import type { RemoteConfigValues } from '../types';
import {
  checkOnDeviceAvailability,
  ensureDeviceModelReady,
  type OnDeviceAvailability,
} from '../lib/ai';

interface Props {
  online: boolean;
  firebaseStatus: FirebaseStatus;
  remoteConfig: RemoteConfigValues;
  onDevice: OnDeviceAvailability;
  onRefreshOnDevice: () => void;
}

const ON_DEVICE_LABEL: Record<OnDeviceAvailability, string> = {
  available: 'On-device model ready (Gemini Nano)',
  downloading: 'On-device model downloading…',
  downloadable: 'On-device model downloadable',
  unavailable: 'On-device model unavailable — cloud fallback',
  unsupported: 'Prompt API not detected — cloud fallback',
};

export default function StatusBar({
  online,
  firebaseStatus,
  remoteConfig,
  onDevice,
  onRefreshOnDevice,
}: Props) {
  const [preparing, setPreparing] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [prepareMsg, setPrepareMsg] = useState<string | null>(null);

  async function prepareOnDevice() {
    setPreparing(true);
    setProgress(0);
    setPrepareMsg(null);
    const ok = await ensureDeviceModelReady((p) => setProgress(p));
    setPreparing(false);
    setPrepareMsg(
      ok
        ? 'On-device model initialised.'
        : 'On-device model could not start — summaries will use the cloud fallback.',
    );
    onRefreshOnDevice();
  }

  return (
    <header className="statusbar">
      <div className="pills">
        <span className={`pill ${online ? 'pill-ok' : 'pill-warn'}`} title="Browser connectivity">
          {online ? '● Online' : '● Offline — notes saved locally'}
        </span>
        <span
          className={`pill ${firebaseStatus.configured ? 'pill-ok' : 'pill-demo'}`}
          title={firebaseStatus.configNote}
        >
          {firebaseStatus.configured
            ? `Firebase connected${firebaseStatus.uid ? ` · anon ${firebaseStatus.uid.slice(0, 6)}…` : ''}`
            : 'Demo mode — no Firebase config'}
        </span>
        <span
          className={`pill ${onDevice === 'available' ? 'pill-ok' : 'pill-info'}`}
          title="Chrome Prompt API / Gemini Nano availability"
        >
          {ON_DEVICE_LABEL[onDevice]}
        </span>
        {firebaseStatus.configured && (
          <span className="pill pill-info" title="Firebase App Check">
            App Check {firebaseStatus.appCheckReady ? 'on' : 'not configured'}
          </span>
        )}
      </div>

      <div className="status-actions">
        {firebaseStatus.configured && onDevice !== 'available' && (
          <button
            className="btn btn-small"
            onClick={prepareOnDevice}
            disabled={preparing}
            title="Download / initialise the on-device Gemini Nano model (needs a click — Chrome requirement)"
          >
            {preparing
              ? `Preparing on-device model…${progress !== null ? ` ${Math.round(progress * 100)}%` : ''}`
              : 'Prepare on-device model'}
          </button>
        )}
        <button className="btn btn-small btn-ghost" onClick={onRefreshOnDevice}>
          Re-check AI engine
        </button>
      </div>

      {prepareMsg && <p className="status-note">{prepareMsg}</p>}

      <details className="rc-details">
        <summary>
          Remote Config — summary length: <strong>{remoteConfig.summaryLength}</strong>
          {' · '}cloud analysis:{' '}
          <strong>{remoteConfig.cloudAnalysisEnabled ? 'on' : 'off'}</strong>
          {' · '}hybrid mode: <strong>{remoteConfig.hybridMode}</strong>
        </summary>
        <p>
          These values are served by Firebase Remote Config
          {firebaseStatus.configured
            ? ' (fetched live; change them in the console without redeploying).'
            : ' — showing local defaults because no Firebase project is configured.'}
        </p>
      </details>
    </header>
  );
}

// Re-exported so App can probe availability on load.
export { checkOnDeviceAvailability };
