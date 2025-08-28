import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import {
  getChannelEmotes,
  sendUserPresence,
  getUserStvProfile
} from './stvAPI'

// Mock axios
vi.mock('axios')

describe('StvAPI', () => {
  const mockAxios = vi.mocked(axios)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getChannelEmotes', () => {
    const mockChannelId = 'test_channel_123'
    
    const mockGlobalEmoteData = {
      id: 'global_set_123',
      name: 'Global Emotes',
      emote_count: 2,
      capacity: 100,
      emotes: [
        {
          id: 'global1',
          actor_id: null,
          flags: 0,
          name: 'GlobalEmote1',
          data: {
            name: 'GlobalEmote1',
            owner: { id: 'owner1', username: 'owner1' },
            host: {
              files: [
                { name: 'emote.webp', width: 28, height: 28 }
              ]
            }
          },
          timestamp: 1640995200000
        },
        {
          id: 'global2',
          actor_id: null,
          flags: 0,
          name: 'GlobalEmote2',
          data: {
            name: 'GlobalEmote2',
            owner: { id: 'owner2', username: 'owner2' },
            host: {
              files: [
                { name: 'emote2.webp', width: 32, height: 32 },
                { name: 'emote2_2x.webp', width: 64, height: 64 }
              ]
            }
          },
          timestamp: 1640995300000
        }
      ]
    }

    const mockChannelEmoteData = {
      user: { id: 'user123', username: 'testuser' },
      emote_set: {
        id: 'channel_set_456',
        name: 'Channel Emotes',
        owner: { id: 'owner3', username: 'channelowner' },
        emote_count: 1,
        capacity: 50,
        emotes: [
          {
            id: 'channel1',
            actor_id: 'user123',
            flags: 2,
            name: 'ChannelEmote1',
            data: {
              name: 'ChannelEmote1',
              owner: { id: 'owner3', username: 'channelowner' },
              host: {
                files: [
                  { name: 'channel_emote.webp', width: 28, height: 28 }
                ]
              }
            },
            timestamp: 1640995400000
          }
        ]
      }
    }

    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should fetch both global and channel emotes successfully', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData }) // Global emotes
        .mockResolvedValueOnce({ status: 200, data: mockChannelEmoteData }) // Channel emotes

      const result = await getChannelEmotes(mockChannelId)

      expect(mockAxios.get).toHaveBeenCalledWith('https://7tv.io/v3/emote-sets/global')
      expect(mockAxios.get).toHaveBeenCalledWith(`https://7tv.io/v3/users/kick/${mockChannelId}`)
      
      expect(result).toHaveLength(2)
      
      // Check global emotes
      const globalSet = result[0]
      expect(globalSet.setInfo.id).toBe('global_set_123')
      expect(globalSet.setInfo.name).toBe('Global Emotes')
      expect(globalSet.type).toBe('global')
      expect(globalSet.emotes).toHaveLength(2)
      expect(globalSet.emotes[0].platform).toBe('7tv')
      expect(globalSet.emotes[0].type).toBe('global')
      expect(globalSet.emotes[0].name).toBe('GlobalEmote1')
      
      // Check channel emotes
      const channelSet = result[1]
      expect(channelSet.setInfo.id).toBe('channel_set_456')
      expect(channelSet.setInfo.name).toBe('Channel Emotes')
      expect(channelSet.type).toBe('channel')
      expect(channelSet.emotes).toHaveLength(1)
      expect(channelSet.emotes[0].platform).toBe('7tv')
      expect(channelSet.emotes[0].type).toBe('channel')
      expect(channelSet.user.username).toBe('testuser')
    })

    it('should return only global emotes when channel request fails', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockRejectedValueOnce(new Error('Channel not found'))

      const result = await getChannelEmotes(mockChannelId)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('global')
      expect(console.error).toHaveBeenCalledWith(
        '[7TV Emotes] Error fetching channel emotes:',
        'Channel not found'
      )
    })

    it('should return empty array when global emotes fail', async () => {
      mockAxios.get.mockRejectedValue(new Error('Global emotes failed'))

      const result = await getChannelEmotes(mockChannelId)

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        '[7TV Emotes] Error fetching channel emotes:',
        'Global emotes failed'
      )
    })

    it('should handle non-200 status for global emotes', async () => {
      mockAxios.get.mockResolvedValue({ status: 404 })

      await expect(getChannelEmotes(mockChannelId)).rejects.toThrow(
        '[7TV Emotes] Error while fetching Global Emotes. Status: 404'
      )
    })

    it('should handle non-200 status for channel emotes', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ status: 404 })

      const result = await getChannelEmotes(mockChannelId)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('global')
    })

    it('should handle missing emote set data', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { user: { id: 'user123' } } // No emote_set field
        })

      const result = await getChannelEmotes(mockChannelId)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('global')
    })

    it('should handle missing emotes in emote set', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ 
          status: 200, 
          data: { 
            emote_set: {
              id: 'empty_set',
              name: 'Empty Set'
              // No emotes field
            }
          } 
        })

      const result = await getChannelEmotes(mockChannelId)

      expect(result).toHaveLength(1)
      expect(result[0].type).toBe('global')
    })

    it('should handle emotes with alias names', async () => {
      const mockChannelData = {
        emote_set: {
          id: 'alias_set',
          name: 'Alias Test',
          emotes: [
            {
              id: 'alias1',
              name: 'AliasName',
              data: {
                name: 'OriginalName', // Different from emote name
                owner: { id: 'owner', username: 'owner' },
                host: { files: [{ name: 'emote.webp' }] }
              },
              timestamp: 1640995500000
            }
          ]
        }
      }

      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ status: 200, data: mockChannelData })

      const result = await getChannelEmotes(mockChannelId)

      const channelEmote = result[1].emotes[0]
      expect(channelEmote.name).toBe('AliasName')
      expect(channelEmote.alias).toBe('OriginalName')
    })

    it('should handle emotes without alias', async () => {
      const mockChannelData = {
        emote_set: {
          id: 'no_alias_set',
          name: 'No Alias Test',
          emotes: [
            {
              id: 'noalias1',
              name: 'SameName',
              data: {
                name: 'SameName', // Same as emote name
                owner: { id: 'owner', username: 'owner' },
                host: { files: [{ name: 'emote.webp' }] }
              },
              timestamp: 1640995500000
            }
          ]
        }
      }

      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ status: 200, data: mockChannelData })

      const result = await getChannelEmotes(mockChannelId)

      const channelEmote = result[1].emotes[0]
      expect(channelEmote.name).toBe('SameName')
      expect(channelEmote.alias).toBeNull()
    })

    it('should handle emotes with missing file data', async () => {
      const mockChannelData = {
        emote_set: {
          id: 'missing_files_set',
          name: 'Missing Files Test',
          emotes: [
            {
              id: 'missing1',
              name: 'MissingFiles',
              data: {
                name: 'MissingFiles',
                owner: { id: 'owner', username: 'owner' },
                host: { files: [] } // Empty files array
              },
              timestamp: 1640995500000
            }
          ]
        }
      }

      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ status: 200, data: mockChannelData })

      const result = await getChannelEmotes(mockChannelId)

      const channelEmote = result[1].emotes[0]
      expect(channelEmote.file).toBeUndefined()
    })

    it('should prefer first file when multiple files exist', async () => {
      const result = await getChannelEmotes(mockChannelId)
      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ status: 200, data: mockChannelEmoteData })

      // Global emote 2 has multiple files - should use first one
      const globalEmote2 = result[0].emotes[1]
      expect(globalEmote2.file.name).toBe('emote2.webp')
      expect(globalEmote2.file.width).toBe(32)
    })

    it('should log channel emote fetching progress', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: mockGlobalEmoteData })
        .mockResolvedValueOnce({ status: 200, data: mockChannelEmoteData })

      await getChannelEmotes(mockChannelId)

      expect(console.log).toHaveBeenCalledWith('[7tv Emotes] Fetching channel emotes for', mockChannelId)
      expect(console.log).toHaveBeenCalledWith('[7tv Emotes] Successfully fetched channel and global emotes')
    })

    it('should handle null/undefined global emote data', async () => {
      mockAxios.get.mockResolvedValueOnce({ status: 200, data: null })

      const result = await getChannelEmotes(mockChannelId)

      expect(result).toEqual([])
    })

    it('should handle malformed global emote data', async () => {
      const malformedData = {
        id: 'global_set',
        name: 'Global',
        emotes: [
          {
            id: 'malformed1',
            // Missing required fields
            data: {}
          }
        ]
      }

      mockAxios.get
        .mockResolvedValueOnce({ status: 200, data: malformedData })
        .mockResolvedValueOnce({ status: 200, data: mockChannelEmoteData })

      const result = await getChannelEmotes(mockChannelId)

      expect(result).toHaveLength(2) // Should still process successfully
      expect(result[0].emotes[0].name).toBeUndefined()
      expect(result[0].emotes[0].owner).toBeUndefined()
    })
  })

  describe('sendUserPresence', () => {
    const mockStvId = 'stv_user_123'
    const mockUserId = 'kick_user_456'

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should send user presence successfully', async () => {
      const mockPresenceData = { success: true }
      mockAxios.post.mockResolvedValue({ status: 200, data: mockPresenceData })

      const result = await sendUserPresence(mockStvId, mockUserId)

      expect(mockAxios.post).toHaveBeenCalledWith(
        `https://7tv.io/v3/users/${mockStvId}/presences`,
        {
          kind: 1,
          passive: true,
          session_id: undefined,
          data: {
            platform: 'KICK',
            id: mockUserId
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )
      expect(result).toEqual(mockPresenceData)
    })

    it('should handle non-200 status responses', async () => {
      mockAxios.post.mockResolvedValue({ status: 400 })

      const result = await sendUserPresence(mockStvId, mockUserId)

      expect(result).toBeUndefined()
      expect(console.error).toHaveBeenCalledWith(
        '[7TV Emotes] Error while sending user presence:',
        '[7TV Emotes] Error while sending user presence: 400'
      )
    })

    it('should handle network errors', async () => {
      const mockError = new Error('Network error')
      mockAxios.post.mockRejectedValue(mockError)

      const result = await sendUserPresence(mockStvId, mockUserId)

      expect(result).toBeUndefined()
      expect(console.error).toHaveBeenCalledWith(
        '[7TV Emotes] Error while sending user presence:',
        'Network error'
      )
    })

    it('should handle empty user IDs', async () => {
      mockAxios.post.mockResolvedValue({ status: 200, data: { success: true } })

      await sendUserPresence('', '')

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://7tv.io/v3/users//presences',
        expect.objectContaining({
          data: {
            platform: 'KICK',
            id: ''
          }
        }),
        expect.any(Object)
      )
    })

    it('should send correct presence payload', async () => {
      mockAxios.post.mockResolvedValue({ status: 200, data: {} })

      await sendUserPresence(mockStvId, mockUserId)

      const expectedPayload = {
        kind: 1,
        passive: true,
        session_id: undefined,
        data: {
          platform: 'KICK',
          id: mockUserId
        }
      }

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expectedPayload,
        expect.any(Object)
      )
    })
  })

  describe('getUserStvProfile', () => {
    const mockPlatformId = 'kick_platform_789'

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should fetch user STV profile successfully', async () => {
      const mockGraphQLResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: {
                id: 'stv_user_123',
                emoteSets: [
                  {
                    id: 'personal_set_456',
                    name: 'Personal Emotes',
                    capacity: 25,
                    description: 'User personal emotes',
                    ownerId: 'stv_user_123',
                    kind: 'PERSONAL',
                    emotes: {
                      items: [
                        {
                          id: 'personal1',
                          alias: 'MyEmote',
                          addedAt: '2024-01-01T00:00:00Z',
                          addedById: 'stv_user_123',
                          originSetId: 'personal_set_456',
                          emote: {
                            id: 'emote123',
                            ownerId: 'stv_user_123',
                            defaultName: 'OriginalName',
                            tags: ['tag1', 'tag2'],
                            aspectRatio: 1.0,
                            deleted: false,
                            updatedAt: '2024-01-01T00:00:00Z',
                            owner: {
                              id: 'owner123',
                              stripeCustomerId: null,
                              updatedAt: '2024-01-01T00:00:00Z',
                              searchUpdatedAt: '2024-01-01T00:00:00Z',
                              highestRoleRank: 1,
                              roleIds: []
                            },
                            images: [
                              {
                                url: 'https://7tv.io/emote/123/1x.webp',
                                mime: 'image/webp',
                                size: 1024,
                                scale: 1,
                                width: 28,
                                height: 28
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockGraphQLResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(mockAxios.post).toHaveBeenCalledWith(
        'https://7tv.io/v4/gql',
        expect.objectContaining({
          query: expect.stringContaining('GetUserProfile'),
          variables: { platformId: mockPlatformId }
        }),
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      )

      expect(result).toEqual({
        user_id: 'stv_user_123',
        emoteSets: [
          {
            setInfo: {
              id: 'personal_set_456',
              name: 'Personal Emotes',
              emote_count: 1,
              capacity: 25
            },
            emotes: [
              {
                id: 'personal1',
                actor_id: 'stv_user_123',
                flags: undefined,
                name: 'MyEmote',
                alias: 'OriginalName',
                owner: expect.any(Object),
                file: {
                  name: 'webp',
                  static_name: 'webp_static.webp',
                  width: 28,
                  height: 28,
                  frame_count: undefined,
                  size: 1024,
                  url: 'https://7tv.io/emote/123/1x.webp'
                },
                added_timestamp: expect.any(Number),
                platform: '7tv',
                type: 'personal'
              }
            ],
            type: 'personal'
          }
        ]
      })
    })

    it('should handle user without emote sets', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: {
                id: 'stv_user_123'
                // No emoteSets field
              }
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result).toEqual({
        user_id: 'stv_user_123',
        emoteSets: []
      })
    })

    it('should return null when user not found', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: null
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result).toBeNull()
    })

    it('should return null when user has no ID', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: {
                // No id field
                emoteSets: []
              }
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result).toBeNull()
    })

    it('should handle non-200 status responses', async () => {
      mockAxios.post.mockResolvedValue({ status: 400 })

      const result = await getUserStvProfile(mockPlatformId)

      expect(result).toBeUndefined()
      expect(console.error).toHaveBeenCalledWith(
        '[7TV Emotes] Error while fetching user STV ID:',
        '[7TV Emotes] Error while fetching user STV ID: 400'
      )
    })

    it('should handle network errors', async () => {
      const mockError = new Error('GraphQL error')
      mockAxios.post.mockRejectedValue(mockError)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result).toBeUndefined()
      expect(console.error).toHaveBeenCalledWith(
        '[7TV Emotes] Error while fetching user STV ID:',
        'GraphQL error'
      )
    })

    it('should handle emotes without images', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: {
                id: 'stv_user_123',
                emoteSets: [
                  {
                    id: 'test_set',
                    name: 'Test Set',
                    kind: 'PERSONAL',
                    emotes: {
                      items: [
                        {
                          id: 'no_image_emote',
                          alias: 'NoImage',
                          addedAt: '2024-01-01T00:00:00Z',
                          emote: {
                            id: 'emote_no_img',
                            defaultName: 'NoImage',
                            images: [] // Empty images array
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result.emoteSets[0].emotes[0].file).toEqual({
        name: undefined,
        static_name: 'undefined_static.webp',
        width: undefined,
        height: undefined,
        frame_count: undefined,
        size: undefined,
        url: undefined
      })
    })

    it('should handle emote alias same as default name', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: {
                id: 'stv_user_123',
                emoteSets: [
                  {
                    id: 'test_set',
                    name: 'Test Set',
                    kind: 'PERSONAL',
                    emotes: {
                      items: [
                        {
                          id: 'same_name_emote',
                          alias: 'SameName',
                          addedAt: '2024-01-01T00:00:00Z',
                          emote: {
                            id: 'emote_same',
                            defaultName: 'SameName', // Same as alias
                            images: [
                              {
                                url: 'https://7tv.io/emote.webp',
                                mime: 'image/webp'
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result.emoteSets[0].emotes[0].name).toBe('SameName')
      expect(result.emoteSets[0].emotes[0].alias).toBeNull()
    })

    it('should correctly transform timestamp', async () => {
      const testDate = '2024-01-01T12:00:00Z'
      const mockResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: {
                id: 'stv_user_123',
                emoteSets: [
                  {
                    id: 'test_set',
                    name: 'Test Set',
                    kind: 'PERSONAL',
                    emotes: {
                      items: [
                        {
                          id: 'timestamp_test',
                          alias: 'TimestampTest',
                          addedAt: testDate,
                          emote: {
                            id: 'emote_timestamp',
                            defaultName: 'TimestampTest',
                            images: [{ url: 'test.webp', mime: 'image/webp' }]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result.emoteSets[0].emotes[0].added_timestamp).toBe(
        new Date(testDate).getTime()
      )
    })

    it('should handle mime type processing correctly', async () => {
      const mockResponse = {
        status: 200,
        data: {
          data: {
            users: {
              userByConnection: {
                id: 'stv_user_123',
                emoteSets: [
                  {
                    id: 'test_set',
                    name: 'Test Set',
                    kind: 'PERSONAL',
                    emotes: {
                      items: [
                        {
                          id: 'mime_test',
                          alias: 'MimeTest',
                          addedAt: '2024-01-01T00:00:00Z',
                          emote: {
                            id: 'emote_mime',
                            defaultName: 'MimeTest',
                            images: [
                              {
                                url: 'test.gif',
                                mime: 'image/gif',
                                width: 32,
                                height: 32
                              }
                            ]
                          }
                        }
                      ]
                    }
                  }
                ]
              }
            }
          }
        }
      }

      mockAxios.post.mockResolvedValue(mockResponse)

      const result = await getUserStvProfile(mockPlatformId)

      const emoteFile = result.emoteSets[0].emotes[0].file
      expect(emoteFile.name).toBe('gif')
      expect(emoteFile.static_name).toBe('gif_static.webp')
    })

    it('should include GraphQL query with correct structure', async () => {
      mockAxios.post.mockResolvedValue({ 
        status: 200, 
        data: { data: { users: { userByConnection: null } } } 
      })

      await getUserStvProfile(mockPlatformId)

      const call = mockAxios.post.mock.calls[0]
      const requestBody = call[1]
      
      expect(requestBody.query).toContain('GetUserProfile')
      expect(requestBody.query).toContain('userByConnection')
      expect(requestBody.query).toContain('platform: KICK')
      expect(requestBody.query).toContain('emoteSets')
      expect(requestBody.query).toContain('emotes')
      expect(requestBody.query).toContain('images')
      expect(requestBody.variables).toEqual({ platformId: mockPlatformId })
    })

    it('should handle malformed GraphQL response', async () => {
      const malformedResponse = {
        status: 200,
        data: {
          // Missing nested data structure
          users: null
        }
      }

      mockAxios.post.mockResolvedValue(malformedResponse)

      const result = await getUserStvProfile(mockPlatformId)

      expect(result).toBeNull()
    })
  })

  describe('Edge Cases and Error Handling', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should handle axios timeout errors', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.code = 'ECONNABORTED'
      mockAxios.get.mockRejectedValue(timeoutError)

      const result = await getChannelEmotes('timeout_test')

      expect(result).toEqual([])
      expect(console.error).toHaveBeenCalledWith(
        '[7TV Emotes] Error fetching channel emotes:',
        'Request timeout'
      )
    })

    it('should handle rate limiting responses', async () => {
      const rateLimitError = new Error('Rate limited')
      rateLimitError.response = { status: 429 }
      mockAxios.get.mockRejectedValue(rateLimitError)

      const result = await getChannelEmotes('rate_limited')

      expect(result).toEqual([])
    })

    it('should handle empty string channel ID', async () => {
      mockAxios.get.mockRejectedValue(new Error('Bad request'))

      const result = await getChannelEmotes('')

      expect(result).toEqual([])
    })

    it('should handle null/undefined parameters gracefully', async () => {
      mockAxios.post.mockResolvedValue({ status: 200, data: {} })

      await expect(sendUserPresence(null, undefined)).resolves.not.toThrow()
      await expect(getUserStvProfile(null)).resolves.not.toThrow()
    })

    it('should handle very large emote sets', async () => {
      const largeEmoteData = {
        id: 'large_set',
        name: 'Large Set',
        emote_count: 1000,
        emotes: Array.from({ length: 1000 }, (_, i) => ({
          id: `emote_${i}`,
          name: `Emote${i}`,
          data: {
            name: `Emote${i}`,
            owner: { id: 'owner', username: 'owner' },
            host: { files: [{ name: `emote${i}.webp` }] }
          },
          timestamp: Date.now()
        }))
      }

      mockAxios.get.mockResolvedValue({ status: 200, data: largeEmoteData })

      const result = await getChannelEmotes('large_channel')

      expect(result[0].emotes).toHaveLength(1000)
    })
  })
})