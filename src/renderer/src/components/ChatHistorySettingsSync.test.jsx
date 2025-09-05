import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import ChatHistorySettingsSync from './ChatHistorySettingsSync.jsx'

// Dynamic settings object we can mutate per test
let currentSettings = { chatHistory: { chatHistoryLength: 400 } }

// Mock SettingsProvider hook to return our dynamic settings
vi.mock('../providers/SettingsProvider', () => ({
  useSettings: () => ({ settings: currentSettings })
}))

// Mock ChatProvider store to expose updateChatHistorySettings selector
// Use vi.hoisted to avoid "Cannot access before initialization" due to hoisting
const { mockUseChatStore, updateChatHistorySettings } = vi.hoisted(() => {
  const updateChatHistorySettings = vi.fn()
  const mockUseChatStore = (selector) => selector({ updateChatHistorySettings })
  mockUseChatStore.getState = () => ({ updateChatHistorySettings })
  return { mockUseChatStore, updateChatHistorySettings }
})

vi.mock('../providers/ChatProvider', () => ({
  default: mockUseChatStore
}))

describe('ChatHistorySettingsSync', () => {
  beforeEach(() => {
    cleanup()
    vi.clearAllMocks()
    // default settings for each test
    currentSettings = { chatHistory: { chatHistoryLength: 400 } }
  })

  it('syncs chat history settings on mount when available', async () => {
    render(<ChatHistorySettingsSync />)
    // Effect should run after render and call updater with settings.chatHistory
    expect(updateChatHistorySettings).toHaveBeenCalledTimes(1)
    expect(updateChatHistorySettings).toHaveBeenCalledWith({ chatHistoryLength: 400 })
  })

  it('does nothing when chatHistory is missing', async () => {
    currentSettings = {}
    render(<ChatHistorySettingsSync />)
    expect(updateChatHistorySettings).not.toHaveBeenCalled()
  })

  it('re-syncs when chatHistory changes', async () => {
    const { rerender } = render(<ChatHistorySettingsSync />)
    expect(updateChatHistorySettings).toHaveBeenCalledWith({ chatHistoryLength: 400 })
    
    // Change settings reference and value, then rerender
    updateChatHistorySettings.mockClear()
    currentSettings = { chatHistory: { chatHistoryLength: 999 } }
    rerender(<ChatHistorySettingsSync />)
    expect(updateChatHistorySettings).toHaveBeenCalledTimes(1)
    expect(updateChatHistorySettings).toHaveBeenCalledWith({ chatHistoryLength: 999 })
  })
})
