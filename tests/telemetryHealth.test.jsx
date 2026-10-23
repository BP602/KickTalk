// @vitest-environment node
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import TelemetryHealth from '../src/renderer/src/components/Dialogs/Settings/Sections/TelemetryHealth';

// The existing server-rendered component seam covers initial user-visible
// boundaries. Live exporter recovery and clipboard interaction require the
// isolated Electron acceptance harness, not a mocked DOM or bridge.
describe('initial telemetry health presentation', () => {
  it('presents opt-out as disabled, never an export failure or success', () => {
    const html = renderToStaticMarkup(createElement(TelemetryHealth, { enabled: false }));
    expect(html.match(/<p>Disabled<\/p>/g)).toHaveLength(2);
    expect(html).not.toContain('<p>Receiver accepted</p>');
    expect(html).not.toContain('<p>Export failed</p>');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Run diagnostic<\/button>/);
    expect(html).not.toContain('id="telemetry-synthetic-trace"');
  });

  it('does not claim success or permit a diagnostic before health is known', () => {
    const html = renderToStaticMarkup(createElement(TelemetryHealth, { enabled: true }));
    expect(html.match(/Loading health…/g)).toHaveLength(2);
    expect(html).not.toContain('<p>Receiver accepted</p>');
    expect(html).not.toContain('Backend storage/readback: Verified');
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Run diagnostic<\/button>/);
    expect(html).toContain('Receiver acceptance does not verify backend storage.');
    expect(html).toContain('Opening Settings never runs a diagnostic.');
  });
});
