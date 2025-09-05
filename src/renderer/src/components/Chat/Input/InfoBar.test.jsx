import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import InfoBar from './InfoBar.jsx'

// Ensure SVG asset import resolves cleanly (vite ?asset query)
vi.mock('../../../assets/icons/info-fill.svg?asset', () => ({ default: 'info-icon.svg' }))

describe('InfoBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.innerHTML = ''
  })

  it('renders nothing when no modes are enabled', () => {
    render(<InfoBar chatroomInfo={{}} initialChatroomInfo={null} />)
    expect(screen.queryByClassName('chatInfoBar')).toBeNull()
  })

  it('shows Followers Only with duration from chatroomInfo and toggles tooltip', async () => {
    const minutes = 10
    const chatroomInfo = {
      followers_mode: { enabled: true, min_duration: minutes },
      subscribers_mode: { enabled: false },
      account_age: { enabled: false },
      emotes_mode: { enabled: false },
      slow_mode: { enabled: false },
    }

    render(<InfoBar chatroomInfo={chatroomInfo} initialChatroomInfo={null} />)

    // Header text
    const bar = screen.getByClassName('chatInfoBar')
    expect(bar).toBeInTheDocument()
    // The label includes a human readable duration; assert core prefix
    expect(bar).toHaveTextContent('Followers Only Mode')

    // Tooltip initially hidden
    const tooltipContent = screen.getByClassName('chatInfoBarIconTooltipContent')
    expect(tooltipContent.className).not.toContain('show')

    // Hover to show
    const hoverTarget = screen.getByClassName('chatInfoBarIconTooltip')
    fireEvent.mouseOver(hoverTarget)
    expect(tooltipContent.className).toContain('show')
    expect(screen.getByText('Followers Only Mode Enabled')).toBeInTheDocument()

    // Unhover to hide
    fireEvent.mouseLeave(hoverTarget)
    expect(tooltipContent.className).not.toContain('show')
  })

  it('prefers initialChatroomInfo when chatroomInfo is absent', () => {
    const initialChatroomInfo = {
      chatroom: {
        followers_mode: false,
        subscribers_mode: true,
        emotes_mode: false,
        slow_mode: false,
        message_interval: 0,
        following_min_duration: 0,
      }
    }

    render(<InfoBar chatroomInfo={null} initialChatroomInfo={initialChatroomInfo} />)

    const bar = screen.getByClassName('chatInfoBar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveTextContent('Subscribers Only Mode')
  })

  it('renders correct labels for Account Age and Slow Mode', () => {
    const chatroomInfo = {
      followers_mode: { enabled: false },
      subscribers_mode: { enabled: false },
      account_age: { enabled: true, min_duration: 60 }, // minutes
      emotes_mode: { enabled: false },
      slow_mode: { enabled: true, message_interval: 30 }, // seconds
    }

    render(<InfoBar chatroomInfo={chatroomInfo} initialChatroomInfo={null} />)

    const bar = screen.getByClassName('chatInfoBar')
    expect(bar).toBeInTheDocument()
    expect(bar).toHaveTextContent('Account Age Mode')
    expect(bar).toHaveTextContent('Slow Mode')

    // Show tooltip and verify both items appear
    fireEvent.mouseOver(screen.getByClassName('chatInfoBarIconTooltip'))
    expect(screen.getByText(/Account Age Restriction Enabled/)).toBeInTheDocument()
    expect(screen.getByText('Slow Mode Enabled')).toBeInTheDocument()
  })
})

