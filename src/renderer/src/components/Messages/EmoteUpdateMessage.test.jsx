import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import EmoteUpdateMessage from './EmoteUpdateMessage.jsx'

// Mock static assets
vi.mock('../../assets/logos/stvLogo.svg?asset', () => ({ 
  default: 'stv-logo.svg' 
}))

describe('EmoteUpdateMessage Component', () => {
  const baseMessage = {
    id: 'update-msg-1',
    type: 'stvEmoteSetUpdate',
    created_at: '2024-01-01T10:00:00Z',
    data: {
      setType: 'channel',
      authoredBy: {
        id: 'author123',
        display_name: 'EmoteAdmin'
      }
    }
  }

  const sampleEmote = {
    id: 'emote123',
    name: 'TestEmote',
    owner: {
      id: 'owner123',
      display_name: 'EmoteCreator'
    }
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Added Emotes', () => {
    it('should render added emote message', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithAdded} />)

      expect(screen.getByText('Channel')).toBeInTheDocument()
      expect(screen.getByText('Added')).toBeInTheDocument()
      expect(screen.getByText('TestEmote')).toBeInTheDocument()
      expect(screen.getByText('Made by: EmoteCreator')).toBeInTheDocument()
      expect(screen.getByText('EmoteAdmin')).toBeInTheDocument()
    })

    it('should render multiple added emotes', () => {
      const messageWithMultipleAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [
            sampleEmote,
            {
              id: 'emote456',
              name: 'AnotherEmote',
              owner: {
                id: 'owner456',
                display_name: 'AnotherCreator'
              }
            }
          ]
        }
      }

      render(<EmoteUpdateMessage message={messageWithMultipleAdded} />)

      expect(screen.getByText('TestEmote')).toBeInTheDocument()
      expect(screen.getByText('AnotherEmote')).toBeInTheDocument()
      expect(screen.getByText('Made by: EmoteCreator')).toBeInTheDocument()
      expect(screen.getByText('Made by: AnotherCreator')).toBeInTheDocument()

      // Should have 2 added emote containers
      const addedContainers = document.querySelectorAll('.emoteSetUpdateMessage.added')
      expect(addedContainers).toHaveLength(2)
    })

    it('should render personal emote set type for added emotes', () => {
      const personalEmoteMessage = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          setType: 'personal',
          added: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={personalEmoteMessage} />)

      expect(screen.getByText('Personal')).toBeInTheDocument()
      expect(screen.getByText('Added')).toBeInTheDocument()
    })

    it('should render correct emote image URL for added emotes', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithAdded} />)

      const emoteImage = screen.getByAltText('TestEmote')
      expect(emoteImage).toHaveAttribute('src', 'https://cdn.7tv.app/emote/emote123/1x.webp')
      expect(emoteImage).toHaveClass('emoteSetUpdateEmote')
    })

    it('should render 7TV logo for added emotes', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithAdded} />)

      const stvLogo = screen.getByAltText('7TV Logo')
      expect(stvLogo).toHaveAttribute('src', 'stv-logo.svg')
      expect(stvLogo).toHaveClass('emoteSetUpdateLogo')
    })

    it('should handle added emotes without owner', () => {
      const emoteWithoutOwner = {
        id: 'emote789',
        name: 'NoOwnerEmote'
        // No owner property
      }

      const messageWithAddedNoOwner = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [emoteWithoutOwner]
        }
      }

      render(<EmoteUpdateMessage message={messageWithAddedNoOwner} />)

      expect(screen.getByText('NoOwnerEmote')).toBeInTheDocument()
      expect(screen.getByText('Made by:')).toBeInTheDocument() // Should still render "Made by:" text
    })

    it('should handle added emotes without authoredBy', () => {
      const messageWithoutAuthor = {
        ...baseMessage,
        data: {
          setType: 'channel',
          added: [sampleEmote]
          // No authoredBy property
        }
      }

      render(<EmoteUpdateMessage message={messageWithoutAuthor} />)

      expect(screen.getByText('TestEmote')).toBeInTheDocument()
      expect(screen.queryByText('EmoteAdmin')).not.toBeInTheDocument()
    })

    it('should render correct CSS classes for added emotes', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [sampleEmote]
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithAdded} />)

      const messageContainer = container.querySelector('.emoteSetUpdateMessage.added')
      expect(messageContainer).toBeInTheDocument()

      const addedLabel = container.querySelector('.emoteSetUpdateLabel.added')
      expect(addedLabel).toBeInTheDocument()

      const addedItem = container.querySelector('.emoteSetUpdateItem.added')
      expect(addedItem).toBeInTheDocument()
    })
  })

  describe('Removed Emotes', () => {
    it('should render removed emote message', () => {
      const messageWithRemoved = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          removed: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithRemoved} />)

      expect(screen.getByText('Channel')).toBeInTheDocument()
      expect(screen.getByText('Removed')).toBeInTheDocument()
      expect(screen.getByText('TestEmote')).toBeInTheDocument()
      expect(screen.getByText('Made by: EmoteCreator')).toBeInTheDocument()
    })

    it('should render multiple removed emotes', () => {
      const messageWithMultipleRemoved = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          removed: [
            sampleEmote,
            {
              id: 'emote456',
              name: 'RemovedEmote',
              owner: {
                id: 'owner456',
                display_name: 'RemovedCreator'
              }
            }
          ]
        }
      }

      render(<EmoteUpdateMessage message={messageWithMultipleRemoved} />)

      expect(screen.getByText('TestEmote')).toBeInTheDocument()
      expect(screen.getByText('RemovedEmote')).toBeInTheDocument()
      
      // Should have 2 removed emote containers
      const removedContainers = document.querySelectorAll('.emoteSetUpdateMessage.removed')
      expect(removedContainers).toHaveLength(2)
    })

    it('should render personal emote set type for removed emotes', () => {
      const personalEmoteMessage = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          setType: 'personal',
          removed: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={personalEmoteMessage} />)

      expect(screen.getByText('Personal')).toBeInTheDocument()
      expect(screen.getByText('Removed')).toBeInTheDocument()
    })

    it('should render correct CSS classes for removed emotes', () => {
      const messageWithRemoved = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          removed: [sampleEmote]
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithRemoved} />)

      const messageContainer = container.querySelector('.emoteSetUpdateMessage.removed')
      expect(messageContainer).toBeInTheDocument()

      const removedLabel = container.querySelector('.emoteSetUpdateLabel.removed')
      expect(removedLabel).toBeInTheDocument()

      const removedItem = container.querySelector('.emoteSetUpdateItem.removed')
      expect(removedItem).toBeInTheDocument()
    })

    it('should handle removed emotes without owner display name', () => {
      const emoteWithoutDisplayName = {
        id: 'emote789',
        name: 'NoDisplayNameEmote',
        owner: {
          id: 'owner789'
          // No display_name property
        }
      }

      const messageWithRemovedNoDisplay = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          removed: [emoteWithoutDisplayName]
        }
      }

      render(<EmoteUpdateMessage message={messageWithRemovedNoDisplay} />)

      expect(screen.getByText('NoDisplayNameEmote')).toBeInTheDocument()
      expect(screen.getByText('Made by:')).toBeInTheDocument()
    })
  })

  describe('Updated/Renamed Emotes', () => {
    const updatedEmote = {
      id: 'emote123',
      oldName: 'OldEmoteName',
      newName: 'NewEmoteName'
    }

    it('should render updated/renamed emote message', () => {
      const messageWithUpdated = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          updated: [updatedEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithUpdated} />)

      expect(screen.getByText('Channel')).toBeInTheDocument()
      expect(screen.getByText('Renamed')).toBeInTheDocument()
      expect(screen.getByText('OldEmoteName')).toBeInTheDocument()
      expect(screen.getByText('NewEmoteName')).toBeInTheDocument()
      expect(screen.getByText('→')).toBeInTheDocument()
    })

    it('should render multiple updated emotes', () => {
      const messageWithMultipleUpdated = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          updated: [
            updatedEmote,
            {
              id: 'emote456',
              oldName: 'AnotherOldName',
              newName: 'AnotherNewName'
            }
          ]
        }
      }

      render(<EmoteUpdateMessage message={messageWithMultipleUpdated} />)

      expect(screen.getByText('OldEmoteName')).toBeInTheDocument()
      expect(screen.getByText('NewEmoteName')).toBeInTheDocument()
      expect(screen.getByText('AnotherOldName')).toBeInTheDocument()
      expect(screen.getByText('AnotherNewName')).toBeInTheDocument()
      
      // Should have 2 updated emote containers
      const updatedContainers = document.querySelectorAll('.emoteSetUpdateMessage.updated')
      expect(updatedContainers).toHaveLength(2)
    })

    it('should render personal emote set type for updated emotes', () => {
      const personalEmoteMessage = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          setType: 'personal',
          updated: [updatedEmote]
        }
      }

      render(<EmoteUpdateMessage message={personalEmoteMessage} />)

      expect(screen.getByText('Personal')).toBeInTheDocument()
      expect(screen.getByText('Renamed')).toBeInTheDocument()
    })

    it('should render correct emote image URL for updated emotes', () => {
      const messageWithUpdated = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          updated: [{ ...updatedEmote, newName: 'UpdatedEmote' }]
        }
      }

      render(<EmoteUpdateMessage message={messageWithUpdated} />)

      const emoteImage = screen.getByAltText('UpdatedEmote')
      expect(emoteImage).toHaveAttribute('src', 'https://cdn.7tv.app/emote/emote123/1x.webp')
      expect(emoteImage).toHaveClass('emoteSetUpdateEmote')
    })

    it('should render correct CSS classes for updated emotes', () => {
      const messageWithUpdated = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          updated: [updatedEmote]
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithUpdated} />)

      const messageContainer = container.querySelector('.emoteSetUpdateMessage.updated')
      expect(messageContainer).toBeInTheDocument()

      const updatedLabel = container.querySelector('.emoteSetUpdateLabel.updated')
      expect(updatedLabel).toBeInTheDocument()

      const updatedItem = container.querySelector('.emoteSetUpdateItem.updated')
      expect(updatedItem).toBeInTheDocument()

      const updatedInfo = container.querySelector('.emoteSetUpdateEmoteInfo.updated')
      expect(updatedInfo).toBeInTheDocument()
    })

    it('should handle updated emotes with missing names', () => {
      const incompleteUpdatedEmote = {
        id: 'emote789'
        // Missing oldName and newName
      }

      const messageWithIncompleteUpdated = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          updated: [incompleteUpdatedEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithIncompleteUpdated} />)

      expect(screen.getByText('Renamed')).toBeInTheDocument()
      expect(screen.getByText('→')).toBeInTheDocument()
      
      // Should still render structure even with missing names
      const updatedContainer = document.querySelector('.emoteSetUpdateMessage.updated')
      expect(updatedContainer).toBeInTheDocument()
    })
  })

  describe('Mixed Update Types', () => {
    it('should render all update types when present', () => {
      const mixedMessage = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [sampleEmote],
          removed: [{ ...sampleEmote, id: 'removed123', name: 'RemovedEmote' }],
          updated: [{ id: 'updated123', oldName: 'OldName', newName: 'NewName' }]
        }
      }

      render(<EmoteUpdateMessage message={mixedMessage} />)

      expect(screen.getByText('Added')).toBeInTheDocument()
      expect(screen.getByText('Removed')).toBeInTheDocument()
      expect(screen.getByText('Renamed')).toBeInTheDocument()
      
      expect(screen.getByText('TestEmote')).toBeInTheDocument()
      expect(screen.getByText('RemovedEmote')).toBeInTheDocument()
      expect(screen.getByText('OldName')).toBeInTheDocument()
      expect(screen.getByText('NewName')).toBeInTheDocument()
    })

    it('should maintain correct order of update types (added, removed, updated)', () => {
      const mixedMessage = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [{ ...sampleEmote, name: 'AddedEmote' }],
          removed: [{ ...sampleEmote, id: 'removed123', name: 'RemovedEmote' }],
          updated: [{ id: 'updated123', oldName: 'OldName', newName: 'NewName' }]
        }
      }

      const { container } = render(<EmoteUpdateMessage message={mixedMessage} />)

      const updateMessages = container.querySelectorAll('.emoteSetUpdateMessage')
      expect(updateMessages).toHaveLength(3)
      
      // Check order
      expect(updateMessages[0]).toHaveClass('added')
      expect(updateMessages[1]).toHaveClass('removed')
      expect(updateMessages[2]).toHaveClass('updated')
    })
  })

  describe('Empty or Missing Data', () => {
    it('should handle empty added array', () => {
      const messageWithEmptyAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: []
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithEmptyAdded} />)

      expect(container.querySelector('.emoteSetUpdateMessage.added')).not.toBeInTheDocument()
    })

    it('should handle empty removed array', () => {
      const messageWithEmptyRemoved = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          removed: []
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithEmptyRemoved} />)

      expect(container.querySelector('.emoteSetUpdateMessage.removed')).not.toBeInTheDocument()
    })

    it('should handle empty updated array', () => {
      const messageWithEmptyUpdated = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          updated: []
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithEmptyUpdated} />)

      expect(container.querySelector('.emoteSetUpdateMessage.updated')).not.toBeInTheDocument()
    })

    it('should handle missing arrays entirely', () => {
      const messageWithNoArrays = {
        ...baseMessage,
        data: {
          setType: 'channel',
          authoredBy: {
            display_name: 'TestUser'
          }
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithNoArrays} />)

      expect(container.querySelector('.emoteSetUpdateMessage')).not.toBeInTheDocument()
    })

    it('should handle message with no data', () => {
      const messageWithoutData = {
        id: 'no-data',
        type: 'stvEmoteSetUpdate'
        // No data property
      }

      expect(() => {
        render(<EmoteUpdateMessage message={messageWithoutData} />)
      }).not.toThrow()
    })

    it('should render nothing when no update types are present', () => {
      const emptyMessage = {
        ...baseMessage,
        data: {
          setType: 'channel'
          // No added, removed, or updated arrays
        }
      }

      const { container } = render(<EmoteUpdateMessage message={emptyMessage} />)

      expect(container.firstChild).toBeNull()
    })
  })

  describe('Key Generation and Rendering', () => {
    it('should generate unique keys for multiple items of same type', () => {
      const messageWithDuplicateIds = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [
            { id: 'same-id', name: 'Emote1' },
            { id: 'same-id', name: 'Emote2' }
          ]
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithDuplicateIds} />)

      const addedContainers = container.querySelectorAll('.emoteSetUpdateMessage.added')
      expect(addedContainers).toHaveLength(2)
      
      // Each should have unique key (added-same-id-0, added-same-id-1)
      expect(screen.getByText('Emote1')).toBeInTheDocument()
      expect(screen.getByText('Emote2')).toBeInTheDocument()
    })

    it('should handle emotes without IDs in key generation', () => {
      const messageWithoutIds = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [
            { name: 'EmoteWithoutId1' },
            { name: 'EmoteWithoutId2' }
          ]
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithoutIds} />)

      const addedContainers = container.querySelectorAll('.emoteSetUpdateMessage.added')
      expect(addedContainers).toHaveLength(2)
      
      expect(screen.getByText('EmoteWithoutId1')).toBeInTheDocument()
      expect(screen.getByText('EmoteWithoutId2')).toBeInTheDocument()
    })
  })

  describe('Image Loading and Alt Text', () => {
    it('should have proper alt text for emote images', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [{ ...sampleEmote, name: 'KEKW' }]
        }
      }

      render(<EmoteUpdateMessage message={messageWithAdded} />)

      const emoteImage = screen.getByAltText('KEKW')
      expect(emoteImage).toBeInTheDocument()
    })

    it('should handle emotes with special characters in names', () => {
      const specialCharEmote = {
        id: 'special123',
        name: 'Émote_Spéciàl-123!',
        owner: { display_name: 'Creator' }
      }

      const messageWithSpecialChar = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [specialCharEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithSpecialChar} />)

      const emoteImage = screen.getByAltText('Émote_Spéciàl-123!')
      expect(emoteImage).toBeInTheDocument()
      expect(screen.getByText('Émote_Spéciàl-123!')).toBeInTheDocument()
    })

    it('should use correct CDN URL format', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [{ ...sampleEmote, id: 'test-emote-id-123' }]
        }
      }

      render(<EmoteUpdateMessage message={messageWithAdded} />)

      const emoteImage = screen.getByAltText('TestEmote')
      expect(emoteImage).toHaveAttribute(
        'src',
        'https://cdn.7tv.app/emote/test-emote-id-123/1x.webp'
      )
    })
  })

  describe('Accessibility', () => {
    it('should have proper alt text for 7TV logo', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithAdded} />)

      const logos = screen.getAllByAltText('7TV Logo')
      expect(logos.length).toBeGreaterThan(0)
      logos.forEach(logo => {
        expect(logo).toHaveAttribute('src', 'stv-logo.svg')
      })
    })

    it('should have semantic HTML structure', () => {
      const messageWithUpdated = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          updated: [{
            id: 'emote123',
            oldName: 'OldName',
            newName: 'NewName'
          }]
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithUpdated} />)

      // Check for proper paragraph tags for emote names
      const emoteNames = container.querySelectorAll('.emoteSetUpdateEmoteName')
      expect(emoteNames).toHaveLength(2) // Old and new names
      
      // Check for arrow separator
      expect(screen.getByText('→')).toHaveClass('emoteSetUpdateEmoteNameSeparator')
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null message gracefully', () => {
      expect(() => {
        render(<EmoteUpdateMessage message={null} />)
      }).not.toThrow()
    })

    it('should handle undefined message gracefully', () => {
      expect(() => {
        render(<EmoteUpdateMessage message={undefined} />)
      }).not.toThrow()
    })

    it('should handle message with null data', () => {
      const messageWithNullData = {
        id: 'null-data',
        data: null
      }

      expect(() => {
        render(<EmoteUpdateMessage message={messageWithNullData} />)
      }).not.toThrow()
    })

    it('should handle emote with very long names', () => {
      const longNameEmote = {
        id: 'long123',
        name: 'A'.repeat(200), // Very long name
        owner: { display_name: 'Creator' }
      }

      const messageWithLongName = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [longNameEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithLongName} />)

      expect(screen.getByText('A'.repeat(200))).toBeInTheDocument()
    })

    it('should handle emote with empty name', () => {
      const emptyNameEmote = {
        id: 'empty123',
        name: '',
        owner: { display_name: 'Creator' }
      }

      const messageWithEmptyName = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [emptyNameEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithEmptyName} />)

      const emoteImage = screen.getByAltText('')
      expect(emoteImage).toBeInTheDocument()
    })

    it('should handle missing setType', () => {
      const messageWithoutSetType = {
        ...baseMessage,
        data: {
          authoredBy: { display_name: 'TestUser' },
          added: [sampleEmote]
          // No setType
        }
      }

      render(<EmoteUpdateMessage message={messageWithoutSetType} />)

      // Should still render the message
      expect(screen.getByText('TestEmote')).toBeInTheDocument()
      expect(screen.getByText('Added')).toBeInTheDocument()
    })

    it('should handle unknown setType values', () => {
      const messageWithUnknownSetType = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          setType: 'unknown_type',
          added: [sampleEmote]
        }
      }

      render(<EmoteUpdateMessage message={messageWithUnknownSetType} />)

      // Should render "unknown_type" as the label
      expect(screen.getByText('unknown_type')).toBeInTheDocument()
      expect(screen.getByText('TestEmote')).toBeInTheDocument()
    })
  })

  describe('Performance Considerations', () => {
    it('should handle large arrays of emotes efficiently', () => {
      // Create 100 emotes for each type
      const manyEmotes = Array.from({ length: 100 }, (_, i) => ({
        id: `emote${i}`,
        name: `Emote${i}`,
        owner: { display_name: `Creator${i}` }
      }))

      const messageWithManyEmotes = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: manyEmotes,
          removed: manyEmotes.map(e => ({ ...e, id: `removed${e.id}` })),
          updated: manyEmotes.map((e, i) => ({
            id: `updated${e.id}`,
            oldName: `Old${e.name}`,
            newName: `New${e.name}`
          }))
        }
      }

      const { container } = render(<EmoteUpdateMessage message={messageWithManyEmotes} />)

      // Should render all emotes without performance issues
      const updateMessages = container.querySelectorAll('.emoteSetUpdateMessage')
      expect(updateMessages).toHaveLength(300) // 100 added + 100 removed + 100 updated
    })

    it('should not cause memory leaks with repeated renders', () => {
      const messageWithAdded = {
        ...baseMessage,
        data: {
          ...baseMessage.data,
          added: [sampleEmote]
        }
      }

      const { rerender } = render(<EmoteUpdateMessage message={messageWithAdded} />)

      // Multiple re-renders should not cause issues
      for (let i = 0; i < 100; i++) {
        rerender(<EmoteUpdateMessage message={messageWithAdded} />)
      }

      expect(screen.getByText('TestEmote')).toBeInTheDocument()
    })
  })
})