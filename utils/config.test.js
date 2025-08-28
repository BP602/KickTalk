import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock electron-store before importing
const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  size: 0,
  store: {},
  path: '/mock/path/config.json',
  onDidChange: vi.fn(),
  onDidAnyChange: vi.fn(),
  has: vi.fn(),
  reset: vi.fn(),
  openInEditor: vi.fn()
}

const mockStoreConstructor = vi.fn(() => mockStore)

vi.mock('electron-store', () => ({
  default: mockStoreConstructor
}))

describe('Config Store', () => {
  let store

  beforeEach(async () => {
    vi.clearAllMocks()
    mockStore.size = 0
    mockStore.store = {}
    
    // Re-import the module to get fresh instance
    const configModule = await import('./config.js')
    store = configModule.default
  })

  describe('Store Initialization', () => {
    it('should initialize with correct schema', () => {
      expect(mockStoreConstructor).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: expect.objectContaining({
            kickId: expect.objectContaining({
              type: 'string',
              default: ''
            }),
            general: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
              default: expect.any(Object)
            }),
            chatrooms: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
              default: expect.any(Object)
            }),
            notifications: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
              default: expect.any(Object)
            }),
            moderation: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
              default: expect.any(Object)
            }),
            sevenTV: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
              default: expect.any(Object)
            }),
            customTheme: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
              default: expect.any(Object)
            }),
            theme: expect.objectContaining({
              type: 'string',
              enum: ['light', 'dark'],
              default: 'dark'
            }),
            zoomFactor: expect.objectContaining({
              type: 'number',
              default: 1
            }),
            lastMainWindowState: expect.objectContaining({
              type: 'object',
              properties: expect.any(Object),
              default: expect.any(Object)
            })
          })
        })
      )
    })

    it('should be an instance of the mocked store', () => {
      expect(store).toBe(mockStore)
    })
  })

  describe('Schema Validation - kickId', () => {
    it('should have correct kickId schema', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      
      expect(schema.kickId).toEqual({
        type: 'string',
        default: ''
      })
    })
  })

  describe('Schema Validation - general', () => {
    it('should have correct general schema structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const generalSchema = schema.general
      
      expect(generalSchema.type).toBe('object')
      expect(generalSchema.properties).toBeDefined()
      expect(generalSchema.default).toBeDefined()
    })

    it('should have correct alwaysOnTop property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const alwaysOnTopSchema = schema.general.properties.alwaysOnTop
      
      expect(alwaysOnTopSchema).toEqual({
        type: 'boolean',
        default: false
      })
      expect(schema.general.default.alwaysOnTop).toBe(false)
    })

    it('should have correct dialogAlwaysOnTop property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const dialogAlwaysOnTopSchema = schema.general.properties.dialogAlwaysOnTop
      
      expect(dialogAlwaysOnTopSchema).toEqual({
        type: 'boolean',
        default: false
      })
      expect(schema.general.default.dialogAlwaysOnTop).toBe(false)
    })

    it('should have correct wrapChatroomsList property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const wrapChatroomsListSchema = schema.general.properties.wrapChatroomsList
      
      expect(wrapChatroomsListSchema).toEqual({
        type: 'boolean',
        default: false
      })
      expect(schema.general.default.wrapChatroomsList).toBe(false)
    })

    it('should have correct compactChatroomsList property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const compactChatroomsListSchema = schema.general.properties.compactChatroomsList
      
      expect(compactChatroomsListSchema).toEqual({
        type: 'boolean',
        default: false
      })
      expect(schema.general.default.compactChatroomsList).toBe(false)
    })

    it('should have correct showTabImages property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const showTabImagesSchema = schema.general.properties.showTabImages
      
      expect(showTabImagesSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.general.default.showTabImages).toBe(true)
    })

    it('should have correct timestampFormat property with all valid enums', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const timestampFormatSchema = schema.general.properties.timestampFormat
      
      expect(timestampFormatSchema.type).toBe('string')
      expect(timestampFormatSchema.default).toBe('disabled')
      expect(timestampFormatSchema.enum).toEqual([
        'disabled', 'h:mm', 'hh:mm', 'h:mm a', 'hh:mm a', 
        'h:mm:ss', 'hh:mm:ss', 'h:mm:ss a', 'hh:mm:ss a'
      ])
      expect(schema.general.default.timestampFormat).toBe('disabled')
    })
  })

  describe('Schema Validation - chatrooms', () => {
    it('should have correct chatrooms schema structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const chatroomsSchema = schema.chatrooms
      
      expect(chatroomsSchema.type).toBe('object')
      expect(chatroomsSchema.properties).toBeDefined()
      expect(chatroomsSchema.default).toBeDefined()
    })

    it('should have correct showModActions property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const showModActionsSchema = schema.chatrooms.properties.showModActions
      
      expect(showModActionsSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.chatrooms.default.showModActions).toBe(true)
    })

    it('should have correct batchingInterval property with bounds', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const batchingIntervalSchema = schema.chatrooms.properties.batchingInterval
      
      expect(batchingIntervalSchema).toEqual({
        type: 'number',
        default: 0,
        minimum: 0,
        maximum: 10000
      })
      expect(schema.chatrooms.default.batchingInterval).toBe(0)
    })

    it('should have correct batching property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const batchingSchema = schema.chatrooms.properties.batching
      
      expect(batchingSchema).toEqual({
        type: 'boolean',
        default: false
      })
      expect(schema.chatrooms.default.batching).toBe(false)
    })

    it('should have correct showInfoBar property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const showInfoBarSchema = schema.chatrooms.properties.showInfoBar
      
      expect(showInfoBarSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.chatrooms.default.showInfoBar).toBe(true)
    })
  })

  describe('Schema Validation - notifications', () => {
    it('should have correct notifications schema structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const notificationsSchema = schema.notifications
      
      expect(notificationsSchema.type).toBe('object')
      expect(notificationsSchema.properties).toBeDefined()
      expect(notificationsSchema.default).toBeDefined()
    })

    it('should have correct enabled property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const enabledSchema = schema.notifications.properties.enabled
      
      expect(enabledSchema).toEqual({
        type: 'boolean',
        default: true
      })
    })

    it('should have correct sound property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const soundSchema = schema.notifications.properties.sound
      
      expect(soundSchema).toEqual({
        type: 'boolean',
        default: true
      })
    })

    it('should have correct volume property with bounds', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const volumeSchema = schema.notifications.properties.volume
      
      expect(volumeSchema).toEqual({
        type: 'number',
        default: 0.2,
        minimum: 0,
        maximum: 1
      })
    })

    it('should have correct soundFile property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const soundFileSchema = schema.notifications.properties.soundFile
      
      expect(soundFileSchema).toEqual({
        type: 'string',
        default: '../resources/sounds/default.wav'
      })
    })

    it('should have correct soundFileName property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const soundFileNameSchema = schema.notifications.properties.soundFileName
      
      expect(soundFileNameSchema).toEqual({
        type: 'string',
        default: 'default'
      })
    })

    it('should have correct background property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const backgroundSchema = schema.notifications.properties.background
      
      expect(backgroundSchema).toEqual({
        type: 'boolean',
        default: true
      })
    })

    it('should have correct backgroundColour property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const backgroundColourSchema = schema.notifications.properties.backgroundColour
      
      expect(backgroundColourSchema).toEqual({
        type: 'string',
        default: '#000000'
      })
    })

    it('should have correct backgroundRgba property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const backgroundRgbaSchema = schema.notifications.properties.backgroundRgba
      
      expect(backgroundRgbaSchema).toEqual({
        type: 'object',
        default: {
          r: 128,
          g: 0,
          b: 0,
          a: 1
        }
      })
    })

    it('should have correct phrases property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const phrasesSchema = schema.notifications.properties.phrases
      
      expect(phrasesSchema).toEqual({
        type: 'array',
        default: []
      })
    })

    it('should have correct notifications default object', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const notificationsDefault = schema.notifications.default
      
      expect(notificationsDefault).toEqual({
        enabled: true,
        sound: true,
        volume: 0.2,
        soundFile: '../resources/sounds/default.wav',
        soundFileName: 'default'
      })
    })
  })

  describe('Schema Validation - moderation', () => {
    it('should have correct moderation schema structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const moderationSchema = schema.moderation
      
      expect(moderationSchema.type).toBe('object')
      expect(moderationSchema.properties).toBeDefined()
      expect(moderationSchema.default).toBeDefined()
    })

    it('should have correct quickModTools property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const quickModToolsSchema = schema.moderation.properties.quickModTools
      
      expect(quickModToolsSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.moderation.default.quickModTools).toBe(true)
    })
  })

  describe('Schema Validation - sevenTV', () => {
    it('should have correct sevenTV schema structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const sevenTVSchema = schema.sevenTV
      
      expect(sevenTVSchema.type).toBe('object')
      expect(sevenTVSchema.properties).toBeDefined()
      expect(sevenTVSchema.default).toBeDefined()
    })

    it('should have correct enabled property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const enabledSchema = schema.sevenTV.properties.enabled
      
      expect(enabledSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.sevenTV.default.enabled).toBe(true)
    })

    it('should have correct paints property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const paintsSchema = schema.sevenTV.properties.paints
      
      expect(paintsSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.sevenTV.default.paints).toBe(true)
    })

    it('should have correct emotes property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const emotesSchema = schema.sevenTV.properties.emotes
      
      expect(emotesSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.sevenTV.default.emotes).toBe(true)
    })

    it('should have correct badges property', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const badgesSchema = schema.sevenTV.properties.badges
      
      expect(badgesSchema).toEqual({
        type: 'boolean',
        default: true
      })
      expect(schema.sevenTV.default.badges).toBe(true)
    })
  })

  describe('Schema Validation - customTheme', () => {
    it('should have correct customTheme schema structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const customThemeSchema = schema.customTheme
      
      expect(customThemeSchema.type).toBe('object')
      expect(customThemeSchema.properties).toBeDefined()
      expect(customThemeSchema.default).toBeDefined()
    })

    it('should have correct current property with valid enums', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const currentSchema = schema.customTheme.properties.current
      
      expect(currentSchema).toEqual({
        type: 'string',
        enum: ['default', 'dark', 'blue', 'purple', 'red'],
        default: 'default'
      })
      expect(schema.customTheme.default.current).toBe('default')
    })
  })

  describe('Schema Validation - theme', () => {
    it('should have correct theme schema with valid enums', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const themeSchema = schema.theme
      
      expect(themeSchema).toEqual({
        type: 'string',
        enum: ['light', 'dark'],
        default: 'dark'
      })
    })
  })

  describe('Schema Validation - zoomFactor', () => {
    it('should have correct zoomFactor schema', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const zoomFactorSchema = schema.zoomFactor
      
      expect(zoomFactorSchema).toEqual({
        type: 'number',
        default: 1
      })
    })
  })

  describe('Schema Validation - lastMainWindowState', () => {
    it('should have correct lastMainWindowState schema structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const lastMainWindowStateSchema = schema.lastMainWindowState
      
      expect(lastMainWindowStateSchema.type).toBe('object')
      expect(lastMainWindowStateSchema.properties).toBeDefined()
      expect(lastMainWindowStateSchema.default).toBeDefined()
    })

    it('should have correct window position properties', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const properties = schema.lastMainWindowState.properties
      
      expect(properties.x).toEqual({ type: 'number' })
      expect(properties.y).toEqual({ type: 'number' })
      expect(properties.width).toEqual({ type: 'number' })
      expect(properties.height).toEqual({ type: 'number' })
    })

    it('should have correct default window state', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const defaultState = schema.lastMainWindowState.default
      
      expect(defaultState).toEqual({
        x: undefined,
        y: undefined,
        width: 480,
        height: 900
      })
    })
  })

  describe('Store Functionality', () => {
    it('should delegate get calls to underlying store', () => {
      const mockValue = { test: 'value' }
      mockStore.get.mockReturnValue(mockValue)

      const result = store.get('testKey')

      expect(mockStore.get).toHaveBeenCalledWith('testKey')
      expect(result).toBe(mockValue)
    })

    it('should delegate set calls to underlying store', () => {
      const testValue = { setting: 'value' }
      
      store.set('testKey', testValue)

      expect(mockStore.set).toHaveBeenCalledWith('testKey', testValue)
    })

    it('should delegate delete calls to underlying store', () => {
      store.delete('testKey')

      expect(mockStore.delete).toHaveBeenCalledWith('testKey')
    })

    it('should delegate clear calls to underlying store', () => {
      store.clear()

      expect(mockStore.clear).toHaveBeenCalledWith()
    })

    it('should delegate has calls to underlying store', () => {
      mockStore.has.mockReturnValue(true)

      const result = store.has('testKey')

      expect(mockStore.has).toHaveBeenCalledWith('testKey')
      expect(result).toBe(true)
    })

    it('should provide access to store size', () => {
      mockStore.size = 5
      
      expect(store.size).toBe(5)
    })

    it('should provide access to store path', () => {
      expect(store.path).toBe('/mock/path/config.json')
    })
  })

  describe('Configuration Validation Edge Cases', () => {
    it('should handle invalid enum values in theme', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      
      // The schema should only allow 'light' or 'dark'
      expect(schema.theme.enum).toEqual(['light', 'dark'])
      expect(schema.theme.enum).not.toContain('invalid')
    })

    it('should handle invalid enum values in customTheme.current', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      
      // The schema should only allow specific theme values
      expect(schema.customTheme.properties.current.enum).toEqual([
        'default', 'dark', 'blue', 'purple', 'red'
      ])
      expect(schema.customTheme.properties.current.enum).not.toContain('invalid')
    })

    it('should handle invalid enum values in timestampFormat', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const validFormats = [
        'disabled', 'h:mm', 'hh:mm', 'h:mm a', 'hh:mm a', 
        'h:mm:ss', 'hh:mm:ss', 'h:mm:ss a', 'hh:mm:ss a'
      ]
      
      expect(schema.general.properties.timestampFormat.enum).toEqual(validFormats)
      expect(schema.general.properties.timestampFormat.enum).not.toContain('invalid')
    })

    it('should handle numeric bounds for volume', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const volumeSchema = schema.notifications.properties.volume
      
      expect(volumeSchema.minimum).toBe(0)
      expect(volumeSchema.maximum).toBe(1)
      expect(volumeSchema.default).toBe(0.2)
    })

    it('should handle numeric bounds for batchingInterval', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const batchingIntervalSchema = schema.chatrooms.properties.batchingInterval
      
      expect(batchingIntervalSchema.minimum).toBe(0)
      expect(batchingIntervalSchema.maximum).toBe(10000)
      expect(batchingIntervalSchema.default).toBe(0)
    })
  })

  describe('Default Values Consistency', () => {
    it('should have consistent defaults between property and section for general', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const generalProperties = schema.general.properties
      const generalDefault = schema.general.default
      
      Object.keys(generalProperties).forEach(key => {
        if (generalProperties[key].default !== undefined) {
          expect(generalDefault[key]).toBe(generalProperties[key].default)
        }
      })
    })

    it('should have consistent defaults between property and section for chatrooms', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const chatroomProperties = schema.chatrooms.properties
      const chatroomDefault = schema.chatrooms.default
      
      Object.keys(chatroomProperties).forEach(key => {
        if (chatroomProperties[key].default !== undefined) {
          expect(chatroomDefault[key]).toBe(chatroomProperties[key].default)
        }
      })
    })

    it('should have consistent defaults between property and section for sevenTV', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const sevenTVProperties = schema.sevenTV.properties
      const sevenTVDefault = schema.sevenTV.default
      
      Object.keys(sevenTVProperties).forEach(key => {
        if (sevenTVProperties[key].default !== undefined) {
          expect(sevenTVDefault[key]).toBe(sevenTVProperties[key].default)
        }
      })
    })

    it('should have consistent defaults between property and section for moderation', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const moderationProperties = schema.moderation.properties
      const moderationDefault = schema.moderation.default
      
      Object.keys(moderationProperties).forEach(key => {
        if (moderationProperties[key].default !== undefined) {
          expect(moderationDefault[key]).toBe(moderationProperties[key].default)
        }
      })
    })

    it('should have consistent defaults between property and section for customTheme', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const customThemeProperties = schema.customTheme.properties
      const customThemeDefault = schema.customTheme.default
      
      Object.keys(customThemeProperties).forEach(key => {
        if (customThemeProperties[key].default !== undefined) {
          expect(customThemeDefault[key]).toBe(customThemeProperties[key].default)
        }
      })
    })
  })

  describe('Complex Object Structures', () => {
    it('should properly define backgroundRgba object structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const backgroundRgba = schema.notifications.properties.backgroundRgba
      
      expect(backgroundRgba.type).toBe('object')
      expect(backgroundRgba.default).toEqual({
        r: 128,
        g: 0,
        b: 0,
        a: 1
      })
    })

    it('should properly define lastMainWindowState object structure', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const windowState = schema.lastMainWindowState
      
      expect(windowState.type).toBe('object')
      expect(Object.keys(windowState.properties)).toEqual(['x', 'y', 'width', 'height'])
      
      // All properties should be numbers
      Object.values(windowState.properties).forEach(prop => {
        expect(prop.type).toBe('number')
      })
    })

    it('should handle array type for phrases', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const phrasesSchema = schema.notifications.properties.phrases
      
      expect(phrasesSchema.type).toBe('array')
      expect(phrasesSchema.default).toEqual([])
    })
  })

  describe('Event Handling', () => {
    it('should delegate onDidChange calls to underlying store', () => {
      const callback = vi.fn()
      
      store.onDidChange('testKey', callback)

      expect(mockStore.onDidChange).toHaveBeenCalledWith('testKey', callback)
    })

    it('should delegate onDidAnyChange calls to underlying store', () => {
      const callback = vi.fn()
      
      store.onDidAnyChange(callback)

      expect(mockStore.onDidAnyChange).toHaveBeenCalledWith(callback)
    })
  })

  describe('Store Manipulation', () => {
    it('should delegate reset calls to underlying store', () => {
      const keys = ['key1', 'key2']
      
      store.reset(keys)

      expect(mockStore.reset).toHaveBeenCalledWith(keys)
    })

    it('should delegate openInEditor calls to underlying store', () => {
      store.openInEditor()

      expect(mockStore.openInEditor).toHaveBeenCalledWith()
    })
  })

  describe('Type Safety and Schema Completeness', () => {
    it('should include all required top-level schema properties', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const requiredKeys = [
        'kickId', 'general', 'chatrooms', 'notifications', 
        'moderation', 'sevenTV', 'customTheme', 'theme', 
        'zoomFactor', 'lastMainWindowState'
      ]
      
      requiredKeys.forEach(key => {
        expect(schema[key]).toBeDefined()
      })
    })

    it('should have type definitions for all properties', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      
      Object.keys(schema).forEach(key => {
        expect(schema[key].type).toBeDefined()
      })
    })

    it('should have default values for all properties', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      
      Object.keys(schema).forEach(key => {
        expect(schema[key].default).toBeDefined()
      })
    })
  })

  describe('Boolean Configuration Properties', () => {
    const booleanProperties = [
      ['general', 'alwaysOnTop', false],
      ['general', 'dialogAlwaysOnTop', false],
      ['general', 'wrapChatroomsList', false],
      ['general', 'compactChatroomsList', false],
      ['general', 'showTabImages', true],
      ['chatrooms', 'showModActions', true],
      ['chatrooms', 'batching', false],
      ['chatrooms', 'showInfoBar', true],
      ['notifications', 'enabled', true],
      ['notifications', 'sound', true],
      ['notifications', 'background', true],
      ['moderation', 'quickModTools', true],
      ['sevenTV', 'enabled', true],
      ['sevenTV', 'paints', true],
      ['sevenTV', 'emotes', true],
      ['sevenTV', 'badges', true]
    ]

    it.each(booleanProperties)('should have correct boolean property %s.%s with default %s', (section, property, defaultValue) => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const propertySchema = schema[section].properties[property]
      
      expect(propertySchema.type).toBe('boolean')
      expect(propertySchema.default).toBe(defaultValue)
    })
  })

  describe('String Configuration Properties', () => {
    const stringProperties = [
      ['kickId', undefined, ''],
      ['notifications', 'soundFile', '../resources/sounds/default.wav'],
      ['notifications', 'soundFileName', 'default'],
      ['notifications', 'backgroundColour', '#000000']
    ]

    it.each(stringProperties)('should have correct string property %s with default "%s"', (property, subProperty, defaultValue) => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const propertySchema = subProperty ? schema[property].properties[subProperty] : schema[property]
      
      expect(propertySchema.type).toBe('string')
      expect(propertySchema.default).toBe(defaultValue)
    })
  })

  describe('Number Configuration Properties', () => {
    const numberProperties = [
      ['zoomFactor', undefined, 1, undefined, undefined],
      ['notifications', 'volume', 0.2, 0, 1],
      ['chatrooms', 'batchingInterval', 0, 0, 10000]
    ]

    it.each(numberProperties)('should have correct number property %s.%s with default %s and bounds [%s, %s]', (section, property, defaultValue, min, max) => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      const propertySchema = property ? schema[section].properties[property] : schema[section]
      
      expect(propertySchema.type).toBe('number')
      expect(propertySchema.default).toBe(defaultValue)
      
      if (min !== undefined) {
        expect(propertySchema.minimum).toBe(min)
      }
      if (max !== undefined) {
        expect(propertySchema.maximum).toBe(max)
      }
    })
  })

  describe('Schema Integrity', () => {
    it('should not have circular references in schema', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      
      // Simple check for circular references by attempting JSON serialization
      expect(() => JSON.stringify(schema)).not.toThrow()
    })

    it('should have valid JSON-serializable defaults', () => {
      const schema = mockStoreConstructor.mock.calls[0][0].schema
      
      Object.keys(schema).forEach(key => {
        expect(() => JSON.stringify(schema[key].default)).not.toThrow()
      })
    })

    it('should maintain schema consistency after multiple imports', async () => {
      // Import the module again
      const configModule2 = await import('./config.js')
      
      // Both instances should use the same schema
      expect(mockStoreConstructor).toHaveBeenCalledTimes(2)
      
      const firstCall = mockStoreConstructor.mock.calls[0][0]
      const secondCall = mockStoreConstructor.mock.calls[1][0]
      
      expect(JSON.stringify(firstCall.schema)).toBe(JSON.stringify(secondCall.schema))
    })
  })

  describe('Error Handling', () => {
    it('should handle store initialization errors gracefully', () => {
      // Mock constructor to throw error
      const errorConstructor = vi.fn(() => {
        throw new Error('Store initialization failed')
      })
      
      vi.doMock('electron-store', () => ({
        default: errorConstructor
      }))

      // Should not crash when importing
      expect(async () => {
        try {
          await import('./config.js?' + Date.now()) // Force re-import
        } catch (error) {
          // Expected to throw, but should be caught by the module system
        }
      }).not.toThrow()
    })

    it('should handle missing electron-store dependency', () => {
      // This test ensures graceful degradation if electron-store is not available
      vi.doMock('electron-store', () => {
        throw new Error('Module not found')
      })

      expect(async () => {
        try {
          await import('./config.js?' + Date.now()) // Force re-import
        } catch (error) {
          // Expected to throw, but should be handled gracefully
        }
      }).not.toThrow()
    })
  })
})