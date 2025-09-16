const SESSION_ID = 'chat_mode_system';
let sessionStarted = false;

const ensureSession = () => {
  if (typeof window === 'undefined') return;
  if (!window.app?.telemetry?.startUserSession) return;
  if (sessionStarted) return;
  sessionStarted = true;
  try {
    window.app.telemetry.startUserSession(SESSION_ID, null)?.catch?.(() => {});
  } catch {
    // ignore
  }
};

export const recordChatModeFeatureUsage = (featureName, action, context = {}) => {
  if (typeof window === 'undefined') return;
  ensureSession();
  try {
    window.app?.telemetry?.recordFeatureUsage?.(SESSION_ID, featureName, action, context);
  } catch (err) {
    window.app?.telemetry?.recordError?.(err, {
      operation: 'chat_mode_metric',
      feature: featureName,
      action,
    });
  }
};
