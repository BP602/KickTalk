import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'

// Components under test
import ContextMenu from './ContextMenu'
import Mentions from './Mentions'
import ReplyThread from './ReplyThread'
import Settings from './Settings'
import AboutSection from './Settings/Sections/About'
import ModerationSection from './Settings/Sections/Moderation'

// Minimal asset and style mocks (global setup may already handle these)
vi.mock('../../assets/styles/dialogs/UserDialog.scss', () => ({}))
vi.mock('../../assets/styles/dialogs/mentions.scss', () => ({}))
vi.mock('../../assets/icons/arrow-up-right-bold.svg', () => ({ default: 'arrow.svg' }))
vi.mock('../../assets/icons/arrow-up-right-bold.svg?asset', () => ({ default: 'arrow.svg' }))
vi.mock('../../assets/icons/trash-fill.svg?asset', () => ({ default: 'trash.svg' }))
vi.mock('../../assets/icons/caret-down-fill.svg?asset', () => ({ default: 'caret.svg' }))
vi.mock('../../assets/icons/x-bold.svg?asset', () => ({ default: 'x.svg' }))

// Dropdown used in Mentions
vi.mock('../Shared/Dropdown', () => ({
  DropdownMenu: ({ children }) => <div data-testid="dropdown">{children}</div>,
  DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }) => (
    <button className={className} onClick={onClick}>{children}</button>
  ),
}))

// MessageParser used by ReplyThread and Mentions
vi.mock('../../utils/MessageParser', () => ({
  MessageParser: ({ message }) => <span data-testid="msg">{JSON.stringify(message) || ''}</span>
}))

// Badges used by Mentions
vi.mock('../Cosmetics/Badges', () => ({
  KickBadges: () => <span data-testid="badges" />
}))

// Settings/provider mocks
const mockSettingsProvider = { settings: { general: { wrapChatroomsList: false, compactChatroomsList: false, showTabImages: false } } }
vi.mock('../../providers/SettingsProvider', () => ({ useSettings: () => mockSettingsProvider }))

// Chat store mock
const mockStore = {
  mentions: [],
  getAllMentions: vi.fn(() => []),
  getChatroomMentions: vi.fn(() => []),
  getUnreadMentionCount: vi.fn(() => 0),
  getChatroomUnreadMentionCount: vi.fn(() => 0),
  markAllMentionsAsRead: vi.fn(),
  markChatroomMentionsAsRead: vi.fn(),
  clearAllMentions: vi.fn(),
  clearChatroomMentions: vi.fn(),
  chatrooms: [],
}
vi.mock('../../providers/ChatProvider', () => ({
  __esModule: true,
  default: (selector) => selector(mockStore),
}))

// window.app stubs for dialogs using preload bridges
beforeEach(() => {
  global.window.app = {
    contextMenu: { onData: (cb) => { /* no-op */ return () => {} } },
    utils: { openExternal: vi.fn() },
    replyThreadDialog: { onData: (cb) => { /* no-op */ return () => {} }, close: vi.fn() },
    replyLogs: { onUpdate: (cb) => { /* no-op */ return () => {} } },
  }
})

describe('Dialogs (smoke)', () => {
  it('renders ContextMenu without crashing', () => {
    expect(() => render(<ContextMenu />)).not.toThrow()
  })

  it('renders Mentions with minimal store state', () => {
    expect(() => render(<Mentions setActiveChatroom={vi.fn()} chatroomId={null} />)).not.toThrow()
  })

  it('renders ReplyThread with minimal window.app stubs', () => {
    expect(() => render(<ReplyThread />)).not.toThrow()
  })

  it('renders Settings dialog (top-level)', () => {
    expect(() => render(<Settings />)).not.toThrow()
  })

  it('renders About and Moderation sections with minimal props', () => {
    expect(() => render(<AboutSection appInfo={{ appVersion: '1.0.0', electronVersion: 'x', chromeVersion: 'y', nodeVersion: 'z' }} />)).not.toThrow()
    expect(() => render(<ModerationSection settingsData={{}} onChange={vi.fn()} />)).not.toThrow()
  })
})

