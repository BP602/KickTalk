import React, { useEffect, useRef, useState } from "react";

const states = {
  disabled: "Disabled",
  not_configured: "Not configured",
  no_data: "No export result yet",
  accepted: "Receiver accepted",
  failed: "Export failed",
};
const reasons = {
  configuration_missing: "No receiver is configured.",
  configuration_invalid: "Receiver configuration is invalid.",
  receiver_rejected: "The receiver rejected the export.",
  receiver_unavailable: "The receiver could not be reached.",
  export_error: "The export could not be completed.",
  restart_required: "Restart KickTalk to initialize telemetry after enabling it.",
};
const timestamp = (value) => typeof value === "number" && Number.isFinite(value) && value > 0 &&
  Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : "None";

const TelemetryHealth = ({ enabled }) => {
  const [health, setHealth] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [running, setRunning] = useState(false);
  const [diagnostic, setDiagnostic] = useState(null);
  const [notice, setNotice] = useState("");
  const mounted = useRef(false);
  const busy = useRef(false);
  const traceInput = useRef(null);

  useEffect(() => {
    mounted.current = true;
    let current = true;
    let changed = false;
    const api = window.telemetry;
    const update = (next) => {
      if (!current) return;
      changed = true;
      setHealth(next);
      setUnavailable(false);
    };
    let unsubscribe;
    try {
      unsubscribe = api?.onHealthChange?.(update);
      Promise.resolve(api?.getHealth?.()).then((next) => {
        if (!current || changed) return;
        if (next) setHealth(next);
        else setUnavailable(true);
      }).catch(() => { if (current && !changed) setUnavailable(true); });
    } catch {
      setUnavailable(true);
    }
    return () => {
      current = false;
      mounted.current = false;
      unsubscribe?.();
    };
  }, []);

  const runDiagnostic = async () => {
    if (!enabled || busy.current) return;
    busy.current = true;
    setRunning(true);
    setDiagnostic(null);
    setNotice("Running synthetic diagnostic.");
    try {
      const result = await window.telemetry.runDiagnostic();
      if (!mounted.current) return;
      setDiagnostic({
        traceId: typeof result?.traceId === "string" && /^[a-f0-9]{32}$/i.test(result.traceId) && !/^0+$/.test(result.traceId) ? result.traceId : null,
        receiver: ["accepted", "rejected", "unavailable", "not_run"].includes(result?.receiver) ? result.receiver : "unavailable",
        readback: ["available", "unavailable", "not_run"].includes(result?.readback) ? result.readback : "unavailable",
      });
      setNotice("Diagnostic finished.");
    } catch {
      if (mounted.current) setNotice("Diagnostic unavailable. No storage verification was obtained.");
    } finally {
      busy.current = false;
      if (mounted.current) setRunning(false);
    }
  };

  const copyTrace = async () => {
    try {
      await navigator.clipboard.writeText(diagnostic.traceId);
      if (mounted.current) setNotice("Synthetic trace ID copied.");
    } catch {
      if (!mounted.current) return;
      traceInput.current?.focus();
      traceInput.current?.select();
      setNotice("Clipboard unavailable. The synthetic trace ID is selected; copy it manually.");
    }
  };

  const blocked = !enabled || !health || unavailable ||
    [health.main, health.renderer].some((entry) => !entry || ["disabled", "not_configured"].includes(entry.state));

  return (
    <section className="telemetryHealth" aria-label="Telemetry health">
      <h5>Telemetry health</h5>
      <p>Receiver acceptance does not verify backend storage. Opening Settings never runs a diagnostic.</p>
      <div aria-live="polite" aria-atomic="true">
        {["main", "renderer"].map((process) => {
          const entry = health?.[process];
          const state = !enabled ? "disabled" : entry?.state;
          return (
            <div key={process} className="telemetryHealthProcess" data-process={process}>
              <h6>{process === "main" ? "Main process" : "Renderer process"}</h6>
              <p>{Object.hasOwn(states, state) ? states[state] : unavailable ? "Health unavailable" : "Loading health…"}</p>
              {state !== "disabled" && Object.hasOwn(reasons, entry?.reason) && <p>{reasons[entry.reason]}</p>}
              <dl>
                <dt>Last result</dt><dd>{timestamp(entry?.lastResultAt)}</dd>
                <dt>Last failure</dt><dd>{timestamp(entry?.lastFailureAt)}</dd>
              </dl>
            </div>
          );
        })}
      </div>
      <p>Diagnostics require telemetry opt-in and valid configuration. They send only a synthetic trace when requested.</p>
      <button type="button" onClick={runDiagnostic} disabled={blocked || running} aria-busy={running}>
        {running ? "Running diagnostic…" : "Run diagnostic"}
      </button>
      {diagnostic && (
        <div className="telemetryDiagnostic" aria-label="Diagnostic result" aria-live="polite" aria-atomic="true">
          <p>Receiver acceptance: {{ accepted: "Accepted", rejected: "Rejected", unavailable: "Unavailable", not_run: "Not run" }[diagnostic.receiver]}</p>
          <p>Backend storage/readback: {{ available: "Verified", unavailable: "Unavailable — storage not verified", not_run: "Not run — storage not verified" }[diagnostic.readback]}</p>
          {diagnostic.traceId && <>
            <label htmlFor="telemetry-synthetic-trace">Synthetic trace ID</label>
            <input id="telemetry-synthetic-trace" ref={traceInput} value={diagnostic.traceId} readOnly spellCheck={false} />
            <button type="button" onClick={copyTrace}>Copy synthetic trace ID</button>
          </>}
        </div>
      )}
      <p role="status" aria-live="polite" aria-atomic="true">{notice}</p>
    </section>
  );
};

export default TelemetryHealth;
