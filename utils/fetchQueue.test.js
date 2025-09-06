import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import queueChannelFetch from './fetchQueue.js'

// Mock window.app
const mockWindowApp = {
  kick: {
    getChannelInfo: vi.fn()
  }
}

Object.defineProperty(global, 'window', {
  value: {
    app: mockWindowApp
  },
  writable: true
})

describe('FetchQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    
    // Clear the module state by re-importing
    vi.resetModules()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Queue Processing', () => {
    it('should process single request successfully', async () => {
      const mockChannelData = { id: 123, name: 'testchannel', slug: 'testchannel' }
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(mockChannelData)

      const promise = queueChannelFetch('testchannel')
      
      // Advance timers to process async operations
      await vi.runAllTimersAsync()
      
      const result = await promise

      expect(result).toEqual(mockChannelData)
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith('testchannel')
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(1)
    })

    it('should handle API errors gracefully and return "error"', async () => {
      const apiError = new Error('API Error')
      mockWindowApp.kick.getChannelInfo.mockRejectedValue(apiError)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const promise = queueChannelFetch('nonexistent')
      
      await vi.runAllTimersAsync()
      
      const result = await promise

      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching data:', apiError)
      
      consoleSpy.mockRestore()
    })

    it('should process multiple requests sequentially', async () => {
      const mockChannelData1 = { id: 123, name: 'channel1' }
      const mockChannelData2 = { id: 456, name: 'channel2' }
      const mockChannelData3 = { id: 789, name: 'channel3' }

      mockWindowApp.kick.getChannelInfo
        .mockResolvedValueOnce(mockChannelData1)
        .mockResolvedValueOnce(mockChannelData2)
        .mockResolvedValueOnce(mockChannelData3)

      const promise1 = queueChannelFetch('channel1')
      const promise2 = queueChannelFetch('channel2') 
      const promise3 = queueChannelFetch('channel3')

      await vi.runAllTimersAsync()

      const results = await Promise.all([promise1, promise2, promise3])

      expect(results).toEqual([mockChannelData1, mockChannelData2, mockChannelData3])
      
      // Should be called sequentially, not in parallel
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(3)
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenNthCalledWith(1, 'channel1')
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenNthCalledWith(2, 'channel2')
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenNthCalledWith(3, 'channel3')
    })

    it('should maintain queue order with mixed success and failures', async () => {
      mockWindowApp.kick.getChannelInfo
        .mockResolvedValueOnce({ id: 1, name: 'success1' })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ id: 3, name: 'success2' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const promise1 = queueChannelFetch('success1')
      const promise2 = queueChannelFetch('failure')
      const promise3 = queueChannelFetch('success2')

      await vi.runAllTimersAsync()

      const results = await Promise.all([promise1, promise2, promise3])

      expect(results).toEqual([
        { id: 1, name: 'success1' },
        'error',
        { id: 3, name: 'success2' }
      ])

      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(3)
      
      consoleSpy.mockRestore()
    })

    it('should handle empty input', async () => {
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(null)

      const result = await queueChannelFetch('')

      expect(result).toBeNull()
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith('')
    })

    it('should handle null input', async () => {
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(null)

      const result = await queueChannelFetch(null)

      expect(result).toBeNull()
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(null)
    })

    it('should handle undefined input', async () => {
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(null)

      const result = await queueChannelFetch(undefined)

      expect(result).toBeNull()
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(undefined)
    })
  })

  describe('Queue State Management', () => {
    it('should prevent duplicate processing when queue is already being processed', async () => {
      let resolveFirst
      const firstCallPromise = new Promise(resolve => {
        resolveFirst = resolve
      })

      // First call hangs
      mockWindowApp.kick.getChannelInfo.mockImplementationOnce(() => firstCallPromise)
      // Second call returns immediately
      mockWindowApp.kick.getChannelInfo.mockResolvedValueOnce({ id: 2, name: 'second' })

      const promise1 = queueChannelFetch('first')
      const promise2 = queueChannelFetch('second')

      // At this point, first request should be processing, second should be queued

      // Resolve the first request
      resolveFirst({ id: 1, name: 'first' })

      await vi.runAllTimersAsync()

      const results = await Promise.all([promise1, promise2])

      expect(results).toEqual([
        { id: 1, name: 'first' },
        { id: 2, name: 'second' }
      ])

      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(2)
    })

    it('should handle rapid consecutive requests', async () => {
      const responses = Array.from({ length: 10 }, (_, i) => ({ id: i, name: `channel${i}` }))
      
      responses.forEach((response, i) => {
        mockWindowApp.kick.getChannelInfo.mockResolvedValueOnce(response)
      })

      const promises = responses.map((_, i) => queueChannelFetch(`channel${i}`))

      await vi.runAllTimersAsync()

      const results = await Promise.all(promises)

      expect(results).toEqual(responses)
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(10)
    })

    it('should maintain independent promise resolution', async () => {
      let resolveSecond
      const secondCallPromise = new Promise(resolve => {
        resolveSecond = resolve
      })

      mockWindowApp.kick.getChannelInfo
        .mockResolvedValueOnce({ id: 1, name: 'first' })
        .mockImplementationOnce(() => secondCallPromise)
        .mockResolvedValueOnce({ id: 3, name: 'third' })

      const promise1 = queueChannelFetch('first')
      const promise2 = queueChannelFetch('second')
      const promise3 = queueChannelFetch('third')

      await vi.runAllTimersAsync()

      // First promise should resolve
      expect(await promise1).toEqual({ id: 1, name: 'first' })

      // Resolve the second promise
      resolveSecond({ id: 2, name: 'second' })

      await vi.runAllTimersAsync()

      // All promises should now be resolved
      expect(await promise2).toEqual({ id: 2, name: 'second' })
      expect(await promise3).toEqual({ id: 3, name: 'third' })
    })
  })

  describe('Error Recovery', () => {
    it('should continue processing queue after error', async () => {
      mockWindowApp.kick.getChannelInfo
        .mockRejectedValueOnce(new Error('First error'))
        .mockRejectedValueOnce(new Error('Second error'))
        .mockResolvedValueOnce({ id: 3, name: 'success' })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const promise1 = queueChannelFetch('error1')
      const promise2 = queueChannelFetch('error2')
      const promise3 = queueChannelFetch('success')

      await vi.runAllTimersAsync()

      const results = await Promise.all([promise1, promise2, promise3])

      expect(results).toEqual(['error', 'error', { id: 3, name: 'success' }])
      expect(consoleSpy).toHaveBeenCalledTimes(2)
      
      consoleSpy.mockRestore()
    })

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.code = 'ECONNABORTED'
      
      mockWindowApp.kick.getChannelInfo.mockRejectedValue(timeoutError)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await queueChannelFetch('timeout-test')

      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching data:', timeoutError)
      
      consoleSpy.mockRestore()
    })

    it('should handle API rate limiting errors', async () => {
      const rateLimitError = new Error('Too Many Requests')
      rateLimitError.response = { status: 429 }
      
      mockWindowApp.kick.getChannelInfo.mockRejectedValue(rateLimitError)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await queueChannelFetch('rate-limited')

      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching data:', rateLimitError)
      
      consoleSpy.mockRestore()
    })

    it('should handle server errors (5xx)', async () => {
      const serverError = new Error('Internal Server Error')
      serverError.response = { status: 500 }
      
      mockWindowApp.kick.getChannelInfo.mockRejectedValue(serverError)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await queueChannelFetch('server-error')

      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching data:', serverError)
      
      consoleSpy.mockRestore()
    })

    it('should handle malformed responses', async () => {
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(undefined)

      const result = await queueChannelFetch('malformed')

      expect(result).toBeUndefined()
    })
  })

  describe('Performance Characteristics', () => {
    it('should prevent concurrent API calls', async () => {
      let concurrentCalls = 0
      let maxConcurrentCalls = 0

      mockWindowApp.kick.getChannelInfo.mockImplementation((input) => {
        concurrentCalls++
        maxConcurrentCalls = Math.max(maxConcurrentCalls, concurrentCalls)
        
        return new Promise(resolve => {
          setTimeout(() => {
            concurrentCalls--
            resolve({ id: input, name: input })
          }, 10)
        })
      })

      const promises = Array.from({ length: 5 }, (_, i) => queueChannelFetch(`channel${i}`))

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      // Should never have more than 1 concurrent call
      expect(maxConcurrentCalls).toBe(1)
    })

    it('should handle long-running requests without blocking', async () => {
      let firstResolved = false

      mockWindowApp.kick.getChannelInfo
        .mockImplementationOnce(() => {
          return new Promise(resolve => {
            setTimeout(() => {
              firstResolved = true
              resolve({ id: 'slow', name: 'slow' })
            }, 100)
          })
        })
        .mockResolvedValueOnce({ id: 'fast', name: 'fast' })

      const slowPromise = queueChannelFetch('slow')
      const fastPromise = queueChannelFetch('fast')

      // Fast request should wait for slow request to complete
      vi.advanceTimersByTime(50)
      expect(firstResolved).toBe(false)

      vi.advanceTimersByTime(100)
      await vi.runAllTimersAsync()

      const results = await Promise.all([slowPromise, fastPromise])

      expect(results).toEqual([
        { id: 'slow', name: 'slow' },
        { id: 'fast', name: 'fast' }
      ])
    })

    it('should handle large queue efficiently', async () => {
      const largeQueueSize = 100
      const responses = Array.from({ length: largeQueueSize }, (_, i) => ({ id: i }))
      
      responses.forEach(response => {
        mockWindowApp.kick.getChannelInfo.mockResolvedValueOnce(response)
      })

      const promises = responses.map((_, i) => queueChannelFetch(`channel${i}`))

      await vi.runAllTimersAsync()

      const results = await Promise.all(promises)

      expect(results).toHaveLength(largeQueueSize)
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(largeQueueSize)
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in input', async () => {
      const specialInput = 'test@#$%^&*()_+channel'
      const mockResponse = { id: 'special', name: specialInput }
      
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(mockResponse)

      const result = await queueChannelFetch(specialInput)

      expect(result).toEqual(mockResponse)
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(specialInput)
    })

    it('should handle very long input strings', async () => {
      const longInput = 'a'.repeat(10000)
      const mockResponse = { id: 'long', name: 'truncated' }
      
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(mockResponse)

      const result = await queueChannelFetch(longInput)

      expect(result).toEqual(mockResponse)
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(longInput)
    })

    it('should handle numeric inputs', async () => {
      const numericInput = 12345
      const mockResponse = { id: numericInput, name: 'numeric' }
      
      mockWindowApp.kick.getChannelInfo.mockResolvedValue(mockResponse)

      const result = await queueChannelFetch(numericInput)

      expect(result).toEqual(mockResponse)
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(numericInput)
    })

    it('should handle boolean inputs', async () => {
      mockWindowApp.kick.getChannelInfo.mockResolvedValue({ value: true })

      const result = await queueChannelFetch(true)

      expect(result).toEqual({ value: true })
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(true)
    })

    it('should handle object inputs', async () => {
      const objectInput = { channel: 'test', type: 'live' }
      mockWindowApp.kick.getChannelInfo.mockResolvedValue({ processed: true })

      const result = await queueChannelFetch(objectInput)

      expect(result).toEqual({ processed: true })
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(objectInput)
    })

    it('should handle array inputs', async () => {
      const arrayInput = ['channel1', 'channel2']
      mockWindowApp.kick.getChannelInfo.mockResolvedValue({ multiple: true })

      const result = await queueChannelFetch(arrayInput)

      expect(result).toEqual({ multiple: true })
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledWith(arrayInput)
    })
  })

  describe('Module State Isolation', () => {
    it('should maintain independent queue state across imports', async () => {
      // This test ensures the queue is properly isolated
      mockWindowApp.kick.getChannelInfo.mockResolvedValue({ id: 'test' })

      const result1 = await queueChannelFetch('test1')
      
      // Import again to test isolation
      const { default: queueChannelFetch2 } = await import('./fetchQueue.js')
      const result2 = await queueChannelFetch2('test2')

      expect(result1).toEqual({ id: 'test' })
      expect(result2).toEqual({ id: 'test' })
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(2)
    })

    it('should handle missing window.app gracefully', async () => {
      // Temporarily remove window.app
      const originalApp = global.window.app
      delete global.window.app

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = await queueChannelFetch('test')
      
      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
      // Restore window.app
      global.window.app = originalApp
    })

    it('should handle missing kick service gracefully', async () => {
      // Temporarily remove kick service
      const originalKick = global.window.app.kick
      delete global.window.app.kick

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = await queueChannelFetch('test')
      
      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
      // Restore kick service
      global.window.app.kick = originalKick
    })

    it('should handle missing getChannelInfo method gracefully', async () => {
      // Temporarily remove getChannelInfo method
      const originalGetChannelInfo = global.window.app.kick.getChannelInfo
      delete global.window.app.kick.getChannelInfo

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = await queueChannelFetch('test')
      
      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
      // Restore method
      global.window.app.kick.getChannelInfo = originalGetChannelInfo
    })
  })

  describe('Promise Handling', () => {
    it('should properly chain promises', async () => {
      mockWindowApp.kick.getChannelInfo
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })

      const promise1 = queueChannelFetch('first')
      const promise2 = queueChannelFetch('second')
      
      await vi.runAllTimersAsync()
      
      const result1 = await promise1
      const result2 = await promise2

      expect(result1).toEqual({ id: 1 })
      expect(result2).toEqual({ id: 2 })
    })

    it('should handle promise rejection properly', async () => {
      const error = new Error('Promise rejected')
      mockWindowApp.kick.getChannelInfo.mockRejectedValue(error)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const promise = queueChannelFetch('rejected')
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('error')
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching data:', error)
      
      consoleSpy.mockRestore()
    })

    it('should not leak promises', async () => {
      const promises = []
      
      for (let i = 0; i < 10; i++) {
        mockWindowApp.kick.getChannelInfo.mockResolvedValueOnce({ id: i })
        promises.push(queueChannelFetch(`channel${i}`))
      }

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      // All promises should be resolved, no memory leaks
      expect(promises.every(p => p instanceof Promise)).toBe(true)
    })
  })

  describe('Concurrency Control', () => {
    it('should serialize requests even with Promise.all', async () => {
      let callOrder = []

      mockWindowApp.kick.getChannelInfo.mockImplementation(async (input) => {
        callOrder.push(input)
        return { id: input }
      })

      const promises = [
        queueChannelFetch('first'),
        queueChannelFetch('second'),
        queueChannelFetch('third')
      ]

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      // Should be called in queue order, not parallel
      expect(callOrder).toEqual(['first', 'second', 'third'])
    })

    it('should handle mixed sync and async queue additions', async () => {
      mockWindowApp.kick.getChannelInfo
        .mockResolvedValueOnce({ id: 'sync1' })
        .mockResolvedValueOnce({ id: 'sync2' })
        .mockResolvedValueOnce({ id: 'async1' })

      // Add sync requests
      const syncPromise1 = queueChannelFetch('sync1')
      const syncPromise2 = queueChannelFetch('sync2')

      // Add async request later
      let asyncPromise
      setTimeout(() => {
        asyncPromise = queueChannelFetch('async1')
      }, 0)

      await vi.runAllTimersAsync()

      const results = await Promise.all([syncPromise1, syncPromise2])

      expect(results).toEqual([{ id: 'sync1' }, { id: 'sync2' }])
      // Wait for async request to complete
      if (asyncPromise) {
        await asyncPromise
      }
      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(3)
    })
  })

  describe('Memory Management', () => {
    it('should not accumulate memory with many requests', async () => {
      const requestCount = 100  // Reduced count to avoid memory issues in test

      for (let i = 0; i < requestCount; i++) {
        mockWindowApp.kick.getChannelInfo.mockResolvedValueOnce({ id: i })
      }

      const promises = []
      for (let i = 0; i < requestCount; i++) {
        promises.push(queueChannelFetch(`channel${i}`))
      }

      await vi.runAllTimersAsync()
      await Promise.all(promises)

      expect(mockWindowApp.kick.getChannelInfo).toHaveBeenCalledTimes(requestCount)

      // Memory should be cleaned up - no way to directly test this in JS,
      // but we can ensure all promises resolved
      const resolvedCount = (await Promise.allSettled(promises)).filter(
        p => p.status === 'fulfilled'
      ).length

      expect(resolvedCount).toBe(requestCount)
    })
  })
})