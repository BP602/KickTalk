import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import {
  getSelfInfo,
  getKickTalkBadges,
  getKickTalkDonators,
  getUserKickId,
  getLinkThumbnail,
  getKickEmotes,
  sendMessageToChannel,
  sendReplyToChannel,
  getSilencedUsers,
  getSilenceUser,
  getUnsilenceUser,
  getChannelInfo,
  getChannelChatroomInfo,
  getUserChatroomInfo,
  getSelfChatroomInfo,
  getInitialChatroomMessages,
  getUserChatroomStatus,
  getPinMessage,
  getUnpinMessage,
  getInitialPollInfo,
  getSubmitPollVote,
  getChatroomViewers,
  getUpdateTitle,
  getClearChatroom,
  getUpdateSlowmode,
  getModerateUser,
  getUnmoderateUser,
  getVipUser,
  getUnvipUser,
  getOGUser,
  getUnogUser,
  getBanUser,
  getUnbanUser,
  getTimeoutUser,
  getDeleteMessage,
  getKickAuthForEvents
} from './kickAPI'

// Mock axios
vi.mock('axios')

describe('KickAPI', () => {
  const mockAxios = vi.mocked(axios)
  
  // Test data
  const mockSessionCookie = 'test_session_token'
  const mockKickSession = 'test_kick_session'
  const mockChannelName = 'testchannel'
  const mockUsername = 'testuser'
  const mockChatroomId = '12345'
  const mockMessageId = '67890'
  const mockUserId = 'user123'

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset rate limiting
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('KickTalk API Functions', () => {
    describe('getKickTalkDonators', () => {
      it('should fetch donators successfully', async () => {
        const mockDonators = [{ id: 1, name: 'donor1' }, { id: 2, name: 'donor2' }]
        mockAxios.get.mockResolvedValue({ data: mockDonators })

        const result = await getKickTalkDonators()

        expect(mockAxios.get).toHaveBeenCalledWith('https://api.kicktalk.app/v1/donators')
        expect(result).toEqual(mockDonators)
      })

      it('should handle API errors', async () => {
        const mockError = new Error('API Error')
        mockAxios.get.mockRejectedValue(mockError)

        await expect(getKickTalkDonators()).rejects.toThrow('API Error')
      })
    })

    describe('getKickTalkBadges', () => {
      it('should fetch badges successfully', async () => {
        const mockBadges = [{ id: 1, name: 'badge1' }]
        mockAxios.get.mockResolvedValue({ status: 200, data: mockBadges })

        const result = await getKickTalkBadges()

        expect(mockAxios.get).toHaveBeenCalledWith('https://api.kicktalk.app/badges')
        expect(result).toEqual(mockBadges)
      })

      it('should return empty array when status is not 200', async () => {
        mockAxios.get.mockResolvedValue({ status: 404, data: null })

        const result = await getKickTalkBadges()

        expect(result).toEqual([])
      })

      it('should handle API errors', async () => {
        mockAxios.get.mockRejectedValue(new Error('Network Error'))

        await expect(getKickTalkBadges()).rejects.toThrow('Network Error')
      })
    })
  })

  describe('Authentication and Authorization', () => {
    describe('getKickAuthForEvents', () => {
      it('should get auth token successfully', async () => {
        const mockAuthData = { auth: 'auth_token_123' }
        const eventChannelName = 'private-user.123'
        const socketId = 'socket_456'

        mockAxios.post.mockResolvedValue({ data: mockAuthData })

        const result = await getKickAuthForEvents(eventChannelName, socketId, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          'https://kick.com/broadcasting/auth',
          {
            socket_id: socketId,
            channel_name: eventChannelName,
          },
          expect.objectContaining({
            headers: expect.objectContaining({
              accept: 'application/json, text/plain, */*',
              authorization: `Bearer ${mockSessionCookie}`,
            }),
          })
        )
        expect(result).toEqual(mockAuthData)
      })

      it('should handle auth errors and log them', async () => {
        const mockError = new Error('Auth failed')
        mockAxios.post.mockRejectedValue(mockError)
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(getKickAuthForEvents('channel', 'socket', mockSessionCookie, mockKickSession))
          .rejects.toThrow('Auth failed')

        expect(consoleSpy).toHaveBeenCalledWith(
          '[KickAPI]: Auth Token Retrieval Failed:',
          mockError
        )

        consoleSpy.mockRestore()
      })
    })

    describe('getUserKickId', () => {
      it('should get user Kick ID successfully', async () => {
        const mockUserData = { id: 12345 }
        mockAxios.get.mockResolvedValue({ data: mockUserData })

        const result = await getUserKickId(mockSessionCookie, mockKickSession)

        expect(mockAxios.get).toHaveBeenCalledWith(
          'https://kick.com/api/v1/user',
          expect.objectContaining({
            headers: expect.objectContaining({
              authorization: `Bearer ${mockSessionCookie}`,
              'x-xsrf-token': mockKickSession,
            }),
          })
        )
        expect(result).toBe(12345)
      })

      it('should return null when no data', async () => {
        mockAxios.get.mockResolvedValue({ data: null })

        const result = await getUserKickId(mockSessionCookie, mockKickSession)

        expect(result).toBeNull()
      })
    })
  })

  describe('Channel Information', () => {
    describe('getChannelInfo', () => {
      it('should fetch channel info successfully', async () => {
        const mockChannelData = { id: 123, name: 'testchannel', slug: 'testchannel' }
        mockAxios.get.mockResolvedValue({ data: mockChannelData })

        const result = await getChannelInfo(mockChannelName)

        expect(mockAxios.get).toHaveBeenCalledWith(`https://kick.com/api/v2/channels/${mockChannelName}`)
        expect(result).toEqual(mockChannelData)
      })

      it('should handle underscore to dash transformation', async () => {
        const channelWithUnderscore = 'test_channel'
        const transformedChannel = 'test-channel'
        
        mockAxios.get
          .mockRejectedValueOnce(new Error('Channel not found'))
          .mockResolvedValueOnce({ data: { id: 123 } })

        const result = await getChannelInfo(channelWithUnderscore)

        expect(mockAxios.get).toHaveBeenCalledTimes(2)
        expect(mockAxios.get).toHaveBeenNthCalledWith(1, `https://kick.com/api/v2/channels/${channelWithUnderscore}`)
        expect(mockAxios.get).toHaveBeenNthCalledWith(2, `https://kick.com/api/v2/channels/${transformedChannel}`)
        expect(result).toEqual({ id: 123 })
      })

      it('should throw error when both original and transformed names fail', async () => {
        mockAxios.get.mockRejectedValue(new Error('Channel not found'))

        await expect(getChannelInfo('test_channel')).rejects.toThrow('Channel not found')
      })
    })

    describe('getChannelChatroomInfo', () => {
      it('should fetch chatroom info with correct headers', async () => {
        const mockResponse = { data: { chatroom: { id: 123 } } }
        mockAxios.get.mockResolvedValue(mockResponse)

        const result = await getChannelChatroomInfo(mockChannelName)

        expect(mockAxios.get).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}`,
          expect.objectContaining({
            referrer: 'https://kick.com/',
            referrerPolicy: 'strict-origin-when-cross-origin',
            method: 'GET',
            mode: 'cors',
            credentials: 'include',
          })
        )
        expect(result).toEqual(mockResponse)
      })
    })

    describe('getUserChatroomInfo', () => {
      it('should fetch user chatroom info successfully', async () => {
        const mockUserInfo = { id: 123, username: 'testuser' }
        mockAxios.get.mockResolvedValue({ data: mockUserInfo })

        const result = await getUserChatroomInfo(mockChannelName, mockUsername)

        expect(mockAxios.get).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/users/${mockUsername}`,
          expect.objectContaining({
            referrer: `https://kick.com/${mockChannelName}`,
          })
        )
        expect(result).toEqual({ data: mockUserInfo })
      })

      it('should handle channel name transformation', async () => {
        const channelWithUnderscore = 'test_channel'
        mockAxios.get
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce({ data: { id: 123 } })

        await getUserChatroomInfo(channelWithUnderscore, mockUsername)

        expect(mockAxios.get).toHaveBeenCalledTimes(2)
        expect(mockAxios.get).toHaveBeenNthCalledWith(2, 
          'https://kick.com/api/v2/channels/test-channel/users/testuser',
          expect.any(Object)
        )
      })
    })
  })

  describe('Message Operations', () => {
    describe('sendMessageToChannel', () => {
      beforeEach(() => {
        vi.useFakeTimers()
      })

      afterEach(() => {
        vi.useRealTimers()
      })

      it('should send message successfully', async () => {
        const mockMessage = 'Hello world'
        const mockResponse = { data: { id: 'msg123' } }
        mockAxios.post.mockResolvedValue(mockResponse)

        const result = await sendMessageToChannel(mockChatroomId, mockMessage, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/messages/send/${mockChatroomId}`,
          { content: mockMessage, type: 'message' },
          expect.objectContaining({
            headers: {
              Authorization: `Bearer ${mockSessionCookie}`,
            },
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should implement rate limiting', async () => {
        // Send 9 messages rapidly
        for (let i = 0; i < 9; i++) {
          mockAxios.post.mockResolvedValue({ data: { id: `msg${i}` } })
          await sendMessageToChannel(mockChatroomId, `message ${i}`, mockSessionCookie, mockKickSession)
        }

        // 10th message should trigger rate limit
        try {
          await sendMessageToChannel(mockChatroomId, 'rate limited message', mockSessionCookie, mockKickSession)
        } catch (error) {
          expect(error).toEqual({ code: 'CHAT_RATE_LIMIT_ERROR' })
        }
      })

      it('should reset rate limit after cooldown period', async () => {
        // Trigger rate limit
        for (let i = 0; i < 9; i++) {
          mockAxios.post.mockResolvedValue({ data: { id: `msg${i}` } })
          await sendMessageToChannel(mockChatroomId, `message ${i}`, mockSessionCookie, mockKickSession)
        }

        // This should trigger rate limit and return undefined
        const rateLimitedResult = await sendMessageToChannel(mockChatroomId, 'rate limited', mockSessionCookie, mockKickSession)
        expect(rateLimitedResult).toBeUndefined()

        // Advance time by cooldown period (5 seconds)
        vi.advanceTimersByTime(5000)

        // Should be able to send again
        mockAxios.post.mockResolvedValue({ data: { id: 'after_cooldown' } })
        const result = await sendMessageToChannel(mockChatroomId, 'after cooldown', mockSessionCookie, mockKickSession)
        expect(result.data.id).toBe('after_cooldown')
      })
    })

    describe('sendReplyToChannel', () => {
      it('should send reply with metadata', async () => {
        const mockMessage = 'This is a reply'
        const mockMetadata = { reply_to: 'original_msg_id', username: 'original_user' }
        const mockResponse = { data: { id: 'reply123' } }
        mockAxios.post.mockResolvedValue(mockResponse)

        const result = await sendReplyToChannel('unique_chatroom_id', mockMessage, mockMetadata, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          'https://kick.com/api/v2/messages/send/unique_chatroom_id',
          { content: mockMessage, type: 'reply', metadata: mockMetadata },
          expect.objectContaining({
            headers: {
              Authorization: `Bearer ${mockSessionCookie}`,
            },
          })
        )
        expect(result).toEqual(mockResponse)
      })

      it('should handle empty metadata', async () => {
        mockAxios.post.mockResolvedValue({ data: { id: 'reply123' } })

        await sendReplyToChannel('unique_chatroom_id_2', 'reply message', {}, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          'https://kick.com/api/v2/messages/send/unique_chatroom_id_2',
          expect.objectContaining({
            metadata: {}
          }),
          expect.any(Object)
        )
      })
    })

    describe('getInitialChatroomMessages', () => {
      it('should fetch initial messages', async () => {
        const mockMessages = { data: [{ id: 'msg1' }, { id: 'msg2' }] }
        mockAxios.get.mockResolvedValue(mockMessages)

        const result = await getInitialChatroomMessages(mockChatroomId)

        expect(mockAxios.get).toHaveBeenCalledWith(`https://kick.com/api/v2/channels/${mockChatroomId}/messages`)
        expect(result).toEqual(mockMessages)
      })
    })
  })

  describe('Moderation Actions', () => {
    describe('getBanUser', () => {
      it('should ban user successfully', async () => {
        const mockBanData = { banned_user: { username: mockUsername } }
        mockAxios.post.mockResolvedValue({ data: mockBanData })

        const result = await getBanUser(mockChannelName, mockUsername, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/bans`,
          {
            banned_username: mockUsername,
            permanent: true,
          },
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: '*/*',
              Authorization: `Bearer ${mockSessionCookie}`,
              'X-XSRF-TOKEN': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockBanData)
      })

      it('should handle channel name transformation on error', async () => {
        mockAxios.post
          .mockRejectedValueOnce(new Error('Channel not found'))
          .mockResolvedValueOnce({ data: { success: true } })

        const result = await getBanUser('test_channel', mockUsername, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledTimes(2)
        expect(mockAxios.post).toHaveBeenNthCalledWith(2,
          'https://kick.com/api/v2/channels/test-channel/bans',
          expect.any(Object),
          expect.any(Object)
        )
        expect(result).toEqual({ success: true })
      })
    })

    describe('getUnbanUser', () => {
      it('should unban user successfully', async () => {
        mockAxios.delete.mockResolvedValue({ status: 200 })

        const result = await getUnbanUser(mockChannelName, mockUsername, mockSessionCookie, mockKickSession)

        expect(mockAxios.delete).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/bans/${mockUsername}`,
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: '*/*',
              Authorization: `Bearer ${mockSessionCookie}`,
              'X-XSRF-TOKEN': mockKickSession,
            }),
          })
        )
        expect(result).toBe(200)
      })
    })

    describe('getTimeoutUser', () => {
      it('should timeout user with duration', async () => {
        const banDuration = 600 // 10 minutes
        const mockTimeoutData = { banned_user: { username: mockUsername, duration: banDuration } }
        mockAxios.post.mockResolvedValue({ data: mockTimeoutData })

        const result = await getTimeoutUser(mockChannelName, mockUsername, banDuration, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/bans`,
          {
            banned_username: mockUsername,
            duration: banDuration,
            permanent: false,
          },
          expect.any(Object)
        )
        expect(result).toEqual(mockTimeoutData)
      })
    })

    describe('getDeleteMessage', () => {
      it('should delete message successfully', async () => {
        const mockDeleteResponse = { success: true }
        mockAxios.delete.mockResolvedValue({ data: mockDeleteResponse })

        const result = await getDeleteMessage(mockChatroomId, mockMessageId, mockSessionCookie, mockKickSession)

        expect(mockAxios.delete).toHaveBeenCalledWith(
          `https://kick.com/api/v2/chatrooms/${mockChatroomId}/messages/${mockMessageId}`,
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: '*/*',
              Authorization: `Bearer ${mockSessionCookie}`,
              'X-XSRF-TOKEN': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockDeleteResponse)
      })

      it('should log and throw errors', async () => {
        const mockError = new Error('Delete failed')
        mockAxios.delete.mockRejectedValue(mockError)
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(getDeleteMessage(mockChatroomId, mockMessageId, mockSessionCookie, mockKickSession))
          .rejects.toThrow('Delete failed')

        expect(consoleSpy).toHaveBeenCalledWith(
          `[KickAPI]: Failed to delete message ${mockMessageId} in chatroom ${mockChatroomId}:`,
          mockError
        )

        consoleSpy.mockRestore()
      })
    })
  })

  describe('Broadcaster Actions', () => {
    describe('getModerateUser', () => {
      it('should moderate user successfully', async () => {
        const mockModData = { moderator: { username: mockUsername } }
        mockAxios.post.mockResolvedValue({ data: mockModData })

        const result = await getModerateUser(mockChannelName, mockUsername, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/internal/v1/channels/${mockChannelName}/community/moderators`,
          { username: mockUsername },
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: '*/*',
              Authorization: `Bearer ${mockSessionCookie}`,
              'X-XSRF-TOKEN': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockModData)
      })
    })

    describe('getVipUser', () => {
      it('should VIP user successfully', async () => {
        const mockVipData = { vip: { username: mockUsername } }
        mockAxios.post.mockResolvedValue({ data: mockVipData })

        const result = await getVipUser(mockChannelName, mockUsername, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/internal/v1/channels/${mockChannelName}/community/vip`,
          { username: mockUsername }
        )
        expect(result).toEqual(mockVipData)
      })
    })

    describe('getOGUser', () => {
      it('should make user OG successfully', async () => {
        const mockOGData = { og: { username: mockUsername } }
        mockAxios.post.mockResolvedValue({ data: mockOGData })

        const result = await getOGUser(mockChannelName, mockUsername, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/internal/v1/channels/${mockChannelName}/community/ogs`,
          { username: mockUsername }
        )
        expect(result).toEqual(mockOGData)
      })
    })
  })

  describe('Channel Commands', () => {
    describe('getUpdateTitle', () => {
      it('should update channel title successfully', async () => {
        const newTitle = 'New Stream Title'
        const mockTitleData = { title: newTitle }
        mockAxios.post.mockResolvedValue({ data: mockTitleData })

        const result = await getUpdateTitle(mockChannelName, newTitle, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/chatroom`,
          { title: newTitle },
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: '*/*',
              Authorization: `Bearer ${mockSessionCookie}`,
              'X-XSRF-TOKEN': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockTitleData)
      })
    })

    describe('getClearChatroom', () => {
      it('should clear chatroom successfully', async () => {
        const mockClearData = { success: true }
        mockAxios.post.mockResolvedValue({ data: mockClearData })

        const result = await getClearChatroom(mockChannelName, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/chat-commands`,
          { command: 'clear' },
          expect.any(Object)
        )
        expect(result).toEqual(mockClearData)
      })
    })

    describe('getUpdateSlowmode', () => {
      it('should update slowmode successfully', async () => {
        const slowmodeOptions = { slow: 5 }
        const mockSlowmodeData = { slow: 5 }
        mockAxios.post.mockResolvedValue({ data: mockSlowmodeData })

        const result = await getUpdateSlowmode(mockChannelName, slowmodeOptions, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/chatroom`,
          slowmodeOptions,
          expect.any(Object)
        )
        expect(result).toEqual(mockSlowmodeData)
      })
    })
  })


  describe('Polls', () => {
    describe('getInitialPollInfo', () => {
      it('should fetch poll info successfully', async () => {
        const mockPollData = { data: { polls: [] } }
        mockAxios.get.mockResolvedValue(mockPollData)

        const result = await getInitialPollInfo(mockChannelName, mockSessionCookie, mockKickSession)

        expect(mockAxios.get).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/polls`,
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: '*/*',
              Authorization: `Bearer ${mockSessionCookie}`,
              'X-XSRF-TOKEN': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockPollData)
      })
    })

    describe('getSubmitPollVote', () => {
      it('should submit poll vote successfully', async () => {
        const optionId = 'option123'
        const mockVoteData = { vote_submitted: true }
        mockAxios.post.mockResolvedValue({ data: mockVoteData })

        const result = await getSubmitPollVote(mockChannelName, optionId, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/polls/vote`,
          { id: optionId },
          expect.objectContaining({
            headers: expect.objectContaining({
              Accept: '*/*',
              Authorization: `Bearer ${mockSessionCookie}`,
              'X-XSRF-TOKEN': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockVoteData)
      })

      it('should handle vote submission errors', async () => {
        const mockError = new Error('Vote failed')
        mockAxios.post.mockRejectedValue(mockError)

        await expect(getSubmitPollVote(mockChannelName, 'option123', mockSessionCookie, mockKickSession))
          .rejects.toThrow('Vote failed')
      })
    })
  })

  describe('Emotes', () => {
    describe('getKickEmotes', () => {
      it('should fetch and process emotes successfully', async () => {
        const mockEmoteData = [
          {
            name: 'Global Emotes',
            emotes: [
              { id: 1, name: 'KickEmote1' },
              { id: 2, name: 'KickEmote2' }
            ]
          }
        ]
        mockAxios.get.mockResolvedValue({ data: mockEmoteData })

        const result = await getKickEmotes(mockChannelName)

        expect(mockAxios.get).toHaveBeenCalledWith(`https://kick.com/emotes/${mockChannelName}`)
        
        // Check processing
        expect(result).toHaveLength(1)
        expect(result[0].emotes).toHaveLength(2)
        expect(result[0].emotes[0].platform).toBe('kick')
        expect(result[0].emotes[1].platform).toBe('kick')
      })

      it('should handle channel name with underscore', async () => {
        mockAxios.get
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce({ data: [] })

        await getKickEmotes('test_channel')

        expect(mockAxios.get).toHaveBeenCalledTimes(2)
        expect(mockAxios.get).toHaveBeenNthCalledWith(2, 'https://kick.com/emotes/test-channel')
      })

      it('should handle missing emotes gracefully', async () => {
        const mockEmoteData = [
          {
            name: 'Empty Set',
            emotes: null
          }
        ]
        mockAxios.get.mockResolvedValue({ data: mockEmoteData })

        const result = await getKickEmotes(mockChannelName)

        expect(result).toEqual([{ name: 'Empty Set', emotes: [] }])
      })
    })
  })

  describe('Utility Functions', () => {
    describe('getLinkThumbnail', () => {
      it('should extract kick.com thumbnail and title', async () => {
        const mockUrl = 'https://kick.com/clip/12345'
        const mockHtml = '<meta property="og:image" content="https://kick.com/thumbnail.jpg" /><meta name="description" content="Amazing clip title"/>'
        mockAxios.get.mockResolvedValue({ status: 200, data: mockHtml })

        const result = await getLinkThumbnail(mockUrl)

        expect(mockAxios.get).toHaveBeenCalledWith(
          mockUrl,
          expect.objectContaining({
            referrer: mockUrl,
            referrerPolicy: 'strict-origin-when-cross-origin',
          })
        )
        expect(result).toEqual({
          clipThumbnailUrl: 'https://kick.com/thumbnail.jpg',
          clipTitle: 'Amazing clip title'
        })
      })

      it('should return null for non-kick.com URLs', async () => {
        const mockHtml = `
          <html>
            <head>
              <meta property="og:image" content="https://example.com/image.jpg" />
              <meta name="description" content="Some title" />
            </head>
          </html>
        `
        mockAxios.get.mockResolvedValue({ status: 200, data: mockHtml })

        const result = await getLinkThumbnail('https://example.com')

        expect(result).toBeNull()
      })

      it('should return null for non-200 status', async () => {
        mockAxios.get.mockResolvedValue({ status: 404, data: '' })

        const result = await getLinkThumbnail('https://kick.com/test')

        expect(result).toBeNull()
      })
    })

    describe('getChatroomViewers', () => {
      it('should fetch current viewers successfully', async () => {
        const mockViewersData = { [mockChatroomId]: 150 }
        mockAxios.get.mockResolvedValue({ data: mockViewersData })

        const result = await getChatroomViewers(mockChatroomId)

        expect(mockAxios.get).toHaveBeenCalledWith(
          'https://kick.com/current-viewers',
          expect.objectContaining({
            params: {
              'ids[]': mockChatroomId,
            },
          })
        )
        expect(result).toEqual(mockViewersData)
      })

      it('should handle and log viewer fetch errors', async () => {
        const mockError = new Error('Viewers fetch failed')
        mockAxios.get.mockRejectedValue(mockError)
        
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        await expect(getChatroomViewers(mockChatroomId)).rejects.toThrow('Viewers fetch failed')

        expect(consoleSpy).toHaveBeenCalledWith(
          `[KickAPI]: Failed to get current viewers for chatroom ${mockChatroomId}:`,
          mockError
        )

        consoleSpy.mockRestore()
      })
    })
  })

  describe('Silenced Users', () => {
    describe('getSilencedUsers', () => {
      it('should fetch silenced users successfully', async () => {
        const mockSilencedUsers = { data: [{ id: 1, username: 'silenced1' }] }
        mockAxios.get.mockResolvedValue(mockSilencedUsers)

        const result = await getSilencedUsers(mockSessionCookie, mockKickSession)

        expect(mockAxios.get).toHaveBeenCalledWith(
          'https://kick.com/api/v2/silenced-users',
          expect.objectContaining({
            headers: expect.objectContaining({
              authorization: `Bearer ${mockSessionCookie}`,
              'x-xsrf-token': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockSilencedUsers)
      })
    })

    describe('getSilenceUser', () => {
      it('should silence user successfully', async () => {
        const mockSilenceData = { silenced: true }
        mockAxios.post.mockResolvedValue(mockSilenceData)

        const result = await getSilenceUser(mockUserId, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          'https://kick.com/api/v2/silenced-users',
          { user_id: mockUserId },
          expect.objectContaining({
            headers: expect.objectContaining({
              authorization: `Bearer ${mockSessionCookie}`,
              'x-xsrf-token': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockSilenceData)
      })
    })

    describe('getUnsilenceUser', () => {
      it('should unsilence user successfully', async () => {
        const mockUnsilenceData = { silenced: false }
        mockAxios.delete.mockResolvedValue(mockUnsilenceData)

        const result = await getUnsilenceUser(mockUserId, mockSessionCookie, mockKickSession)

        expect(mockAxios.delete).toHaveBeenCalledWith(
          `https://kick.com/api/v2/silenced-users/${mockUserId}`,
          expect.objectContaining({
            headers: expect.objectContaining({
              authorization: `Bearer ${mockSessionCookie}`,
              'x-xsrf-token': mockKickSession,
            }),
          })
        )
        expect(result).toEqual(mockUnsilenceData)
      })
    })
  })

  describe('Pin Message', () => {
    describe('getPinMessage', () => {
      it('should pin message successfully', async () => {
        const mockMessageData = {
          chatroomName: mockChannelName,
          chatroom_id: mockChatroomId,
          content: 'Pinned message',
          id: mockMessageId,
          sender: { username: 'testuser' }
        }
        const mockPinData = { pinned: true }
        mockAxios.post.mockResolvedValue({ data: mockPinData })

        const result = await getPinMessage(mockMessageData, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/pinned-message`,
          expect.objectContaining({
            duration: 1200,
            message: expect.objectContaining({
              chatroom_id: mockChatroomId,
              content: 'Pinned message',
              id: mockMessageId,
              type: 'message'
            })
          }),
          expect.any(Object)
        )
        expect(result.data).toEqual(mockPinData)
      })

      it('should handle channel name transformation for pin message', async () => {
        const mockMessageData = {
          chatroomName: 'test_channel',
          chatroom_id: mockChatroomId,
          content: 'Test pin',
          id: mockMessageId,
          sender: { username: 'testuser' }
        }
        
        mockAxios.post
          .mockRejectedValueOnce(new Error('Not found'))
          .mockResolvedValueOnce({ data: { success: true } })

        await getPinMessage(mockMessageData, mockSessionCookie, mockKickSession)

        expect(mockAxios.post).toHaveBeenCalledTimes(2)
        expect(mockAxios.post).toHaveBeenNthCalledWith(2,
          'https://kick.com/api/v2/channels/test-channel/pinned-message',
          expect.any(Object),
          expect.any(Object)
        )
      })
    })

    describe('getUnpinMessage', () => {
      it('should unpin message successfully', async () => {
        mockAxios.delete.mockResolvedValue({ status: 200 })

        const result = await getUnpinMessage(mockChannelName, mockSessionCookie, mockKickSession)

        expect(mockAxios.delete).toHaveBeenCalledWith(
          `https://kick.com/api/v2/channels/${mockChannelName}/pinned-message`,
          expect.objectContaining({
            headers: {
              Authorization: `Bearer ${mockSessionCookie}`,
            },
          })
        )
        expect(result).toBe(200)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Network timeout')
      timeoutError.code = 'ECONNABORTED'
      mockAxios.get.mockRejectedValue(timeoutError)

      await expect(getChannelInfo(mockChannelName)).rejects.toThrow('Network timeout')
    })

    it('should handle malformed responses', async () => {
      mockAxios.get.mockResolvedValue({ data: null })

      const result = await getUserKickId(mockSessionCookie, mockKickSession)
      expect(result).toBeNull()
    })

    it('should handle empty channel names', async () => {
      mockAxios.get.mockRejectedValue(new Error('Bad request'))

      await expect(getChannelInfo('')).rejects.toThrow('Bad request')
    })

    it('should handle special characters in usernames', async () => {
      const specialUsername = 'user@#$%'
      mockAxios.get.mockResolvedValue({ data: { username: specialUsername } })

      await getUserChatroomInfo(mockChannelName, specialUsername)

      expect(mockAxios.get).toHaveBeenCalledWith(
        `https://kick.com/api/v2/channels/${mockChannelName}/users/${specialUsername}`,
        expect.any(Object)
      )
    })
  })

  describe('Authentication Edge Cases', () => {
    it('should handle missing session cookies', async () => {
      mockAxios.get.mockRejectedValue(new Error('Unauthorized'))

      await expect(getUserKickId('', '')).rejects.toThrow('Unauthorized')
    })

    it('should handle expired sessions', async () => {
      mockAxios.get.mockRejectedValue({ response: { status: 401 } })

      await expect(getSelfInfo(mockSessionCookie, mockKickSession)).rejects.toEqual({ response: { status: 401 } })
    })
  })
})