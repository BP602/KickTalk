# KickTalk Architecture Overview

## Application Structure

KickTalk is an Electron-based desktop chat client for Kick.com, built with electron-vite, React, and comprehensive OpenTelemetry observability.

## High-Level Architecture

### Process Architecture

KickTalk follows Electron's multi-process architecture with enhanced telemetry and monitoring:

- **Main Process**: Node.js process managing application lifecycle, window management, system integration, and telemetry collection
- **Renderer Process**: Chromium process running the React frontend with isolated preload bridge
- **Preload Bridge**: Secure IPC communication layer with context isolation

### Core Technology Stack

- **Framework**: Electron with electron-vite for build tooling
- **Frontend**: React 18 with functional components and hooks
- **State Management**: Zustand for chat state, React Context for settings
- **Styling**: SCSS with component-scoped stylesheets
- **Real-time Communication**: WebSocket (Pusher protocol) for Kick.com integration
- **Observability**: OpenTelemetry with Grafana Cloud integration
- **Build System**: Vite for fast development and optimized builds

## Detailed Architecture Components

### 1. Frontend (Renderer Process)

#### Component Hierarchy

The application uses a single-page architecture without routing:

```text
App
├── ErrorBoundary
├── Loader
├── SettingsProvider
│   ├── ChatHistorySettingsSync
│   └── ChatPage
│       ├── TitleBar
│       ├── chatWrapper
│       │   ├── Navbar (Chatroom Tabs)
│       │   └── chatContent
│       │       ├── PanelGroup (Resizable Panels)
│       │       │   ├── Panel (Main Chat)
│       │       │   │   ├── Chat Component
│       │       │   │   │   ├── StreamerInfo
│       │       │   │   │   ├── MessagesHandler
│       │       │   │   │   ├── Input
│       │       │   │   │   ├── Pin
│       │       │   │   │   ├── Poll
│       │       │   │   │   └── Predictions
│       │       │   │   └── Mentions Dialog
│       │       │   └── Panel[] (Split Pane Chats)
│       │       │       └── SplitPaneChat
```

#### State Management

- **ChatProvider (Zustand)**: Global chat state, chatroom management, message handling
- **SettingsProvider (React Context)**: User preferences, theme settings, feature flags
- **CosmeticsProvider (React Context)**: 7TV emotes, BTTV integration, custom cosmetics

#### Key Components

- **Chat/**: Main chat interface with message rendering, input handling, and streamer information
- **Messages/**: Message components for different types (chat, donations, subscriptions, system)
- **Dialogs/**: Modal dialogs for mentions, settings, user profiles, auth
- **Navbar/**: Channel navigation with tab management
- **Cosmetics/**: Emote rendering, badges, custom chat enhancements

### 2. Backend (Main Process)

#### Core Services

The main process provides comprehensive services through IPC handlers:

- **Window Management**: Multiple dialog windows (settings, user profiles, auth, search, reply threads)
- **Data Persistence**: Electron-store integration for settings and authentication
- **System Integration**: System tray, notifications, auto-updater
- **External Tools**: Streamlink integration for stream playback
- **Chat Logging**: Persistent chat history with search capabilities
- **Telemetry**: OpenTelemetry metrics collection and export

#### Telemetry Architecture

Comprehensive observability system with multiple specialized modules:

- **Core Metrics** (`telemetry/metrics.js`): Application performance and usage metrics
- **Distributed Tracing** (`telemetry/tracing.js`): Request tracing across components
- **Error Monitoring** (`telemetry/error-monitoring.js`): Error tracking with recovery strategies
- **SLO Monitoring** (`telemetry/slo-monitoring.js`): Service Level Objective tracking
- **User Analytics** (`telemetry/user-analytics.js`): User behavior and engagement tracking
- **Performance Budget** (`telemetry/performance-budget.js`): Performance threshold monitoring

### 3. Real-time Communication Layer

#### WebSocket Services

- **Shared Kick Pusher** (`utils/services/kick/sharedKickPusher.js`): Primary WebSocket service handling multiple chatrooms through a single connection
- **Individual Kick Pusher** (`utils/services/kick/kickPusher.js`): Legacy per-chatroom connections
- **7TV WebSocket** (`utils/services/seventv/sharedStvWebSocket.js`): Real-time emote and cosmetic updates
- **Connection Manager** (`utils/services/connectionManager.js`): Orchestrates all WebSocket connections

#### API Integration

- **Kick API** (`utils/services/kick/kickAPI.js`): Complete REST API integration for user actions, moderation, channel data
- **7TV API**: Emote sets, user cosmetics, and badges integration

### 4. IPC Bridge (Preload)

Secure communication bridge between main and renderer processes with:

- **Context Isolation**: Prevents direct Node.js access from renderer
- **Type Safety**: Structured API surface with parameter validation
- **Error Handling**: Graceful degradation when services are unavailable
- **Telemetry Integration**: IPC method tracking and performance monitoring

## Data Flow Architecture

### Chat Message Flow

1. **WebSocket Receipt**: Pusher receives message from Kick servers
2. **Event Processing**: Message parsed and validated in connection service
3. **State Update**: ChatProvider updates Zustand store
4. **UI Render**: React components re-render with new message data
5. **Persistence**: Message logged to main process storage
6. **Telemetry**: Message metrics recorded for analytics

### User Action Flow

1. **UI Interaction**: User triggers action in React component
2. **IPC Call**: Renderer calls main process via preload bridge
3. **Service Execution**: Main process executes action (API call, system integration)
4. **Response Handling**: Success/error response sent back to renderer
5. **State Update**: UI state updated based on response
6. **Telemetry**: Action performance and success metrics recorded

## Security Architecture

### Process Isolation

- **Context Isolation**: Renderer process cannot access Node.js APIs directly
- **Secure IPC**: All communication through controlled preload bridge
- **CSP Headers**: Content Security Policy prevents code injection
- **Sandbox Mode**: Renderer runs in sandboxed environment

### Data Protection

- **Token Storage**: Secure storage of authentication tokens using electron-store encryption
- **Request Validation**: All API requests validated and sanitized
- **Error Sanitization**: Sensitive data stripped from error messages
- **HTTPS Enforcement**: All external communications use HTTPS

## Performance Architecture

### Optimization Strategies

- **Code Splitting**: Vite-based dynamic imports for reduced bundle size
- **Virtual Scrolling**: Efficient rendering of large message lists
- **Connection Pooling**: Shared WebSocket connections reduce overhead
- **Memory Management**: Automatic message cleanup and garbage collection
- **Telemetry-Driven**: Performance monitoring guides optimization decisions

### Performance Budgets

Monitored performance thresholds:

- **UI Interaction**: <100ms good, <250ms acceptable
- **Component Render**: <16ms for smooth 60fps
- **Memory Usage**: <200MB good, <500MB acceptable
- **WebSocket Latency**: <50ms good, <100ms acceptable
- **Bundle Size**: <1MB good, <2MB acceptable

## Deployment Architecture

### Development

- **electron-vite**: Fast development server with HMR
- **Source Maps**: Full debugging support
- **Live Reload**: Automatic recompilation and reload
- **Telemetry Testing**: Local telemetry collection for development

### Production

- **Electron Builder**: Multi-platform desktop app packaging
- **Auto-Updater**: Seamless application updates
- **Error Reporting**: Production error collection via telemetry
- **Performance Monitoring**: Real-time performance tracking in production

## Directory Structure

```text
src/
├── main/                    # Main process (Node.js)
│   ├── index.js            # Application entry point and IPC handlers
│   └── utils/              # Main process utilities
├── preload/                # IPC bridge layer
│   └── index.js            # Secure API exposure to renderer
├── renderer/               # Frontend (React)
│   └── src/
│       ├── components/     # React components
│       ├── providers/      # State management contexts
│       ├── pages/          # Page-level components
│       ├── telemetry/      # Frontend telemetry helpers
│       └── utils/          # Frontend utilities
└── telemetry/              # Shared telemetry services
    ├── metrics.js          # Core metrics collection
    ├── tracing.js          # Distributed tracing
    ├── user-analytics.js   # User behavior analytics
    └── performance-budget.js # Performance monitoring

utils/                      # Shared utilities and services
├── services/               # External service integrations
│   ├── kick/              # Kick.com API and WebSocket
│   ├── seventv/           # 7TV integration
│   └── connectionManager.js # Connection orchestration
└── helpers/               # Utility functions

docs/                      # Documentation
├── kick-websocket-channels.md # WebSocket integration guide
├── Phase4-UserAnalytics-Guide.md # Analytics implementation
└── Release-notes-*.md     # Version release notes
```

## Integration Points

### External Services

- **Kick.com**: Primary chat platform integration
- **7TV**: Custom emotes and cosmetics
- **Grafana Cloud**: Telemetry data export and monitoring
- **Streamlink**: External stream viewing integration

### System Integration

- **Operating System**: Native window management, system tray, notifications
- **File System**: Chat logging, settings persistence, cache management
- **Network**: WebSocket connections, HTTP API calls, telemetry export

This architecture provides a robust, observable, and maintainable foundation for KickTalk's desktop chat client functionality.
