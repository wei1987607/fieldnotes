import type { ReportAnalysis } from '../types';
import { InferenceBadge } from './NoteCard';

interface Props {
  report: ReportAnalysis | null;
  busy: boolean;
  noteCount: number;
  cloudEnabled: boolean;
  onRun: () => void;
  onClose: () => void;
}

export default function ReportPanel({
  report,
  busy,
  noteCount,
  cloudEnabled,
  onRun,
  onClose,
}: Props) {
  return (
    <section className="report-panel">
      <div className="report-head">
        <h2>📊 Field report — deep analysis</h2>
        <button
          className="btn"
          onClick={onRun}
          disabled={busy || noteCount === 0 || !cloudEnabled}
          title={
            !cloudEnabled
              ? 'Disabled by Remote Config (cloud_analysis_enabled = false)'
              : 'Send all visible notes to the cloud model for themes, action items and cross-note connections'
          }
        >
          {busy ? 'Analysing in the cloud…' : 'Run deep analysis (cloud)'}
        </button>
      </div>
      <p className="report-sub">
        Long documents and cross-note reasoning go to the cloud model (
        {`gemini-3.5-flash-lite`}) — the on-device model is for fast, private,
        single-note summaries. {!cloudEnabled && (
          <strong> Cloud analysis is currently disabled by Remote Config.</strong>
        )}
      </p>

      {report && (
        <div className="report-result">
          <div className="summary-head">
            <InferenceBadge source={report.inferenceSource} />
            <span className="latency">{report.latencyMs} ms</span>
            <span className="model-label">
              {report.modelLabel} · {report.noteCount} notes ·{' '}
              {new Date(report.generatedAt).toLocaleTimeString()}
            </span>
            <button className="btn btn-small btn-ghost" onClick={onClose}>
              Clear
            </button>
          </div>
          <div className="report-cols">
            <div>
              <h3>Themes</h3>
              <ul>
                {report.themes.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Action items</h3>
              <ul>
                {report.actionItems.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Connections between notes</h3>
              <ul>
                {report.connections.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
