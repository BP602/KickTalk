import ChatPage from "./pages/ChatPage";
import SettingsProvider from "./providers/SettingsProvider";
import ErrorBoundary from "./components/ErrorBoundary";
import Loader from "./pages/Loader";

// Tracing bootstrap moved out of App; loaded at renderer entry to avoid bundling issues.
// See: src/renderer/index.html -> src/main.jsx. Import './telemetry/webTracing' in that entry file.

const App = () => {
  return (
    <ErrorBoundary>
      <Loader />
      <SettingsProvider>
        <ChatPage />
      </SettingsProvider>
    </ErrorBoundary>
  );
};

export default App;
