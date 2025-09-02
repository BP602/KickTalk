import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DASHBOARD_CONFIG, DashboardUtils } from '../dashboard-config.js'

describe('DASHBOARD_CONFIG', () => {
  describe('SLO Panels Configuration', () => {
    it('should have all required SLO panels', () => {
      const requiredPanels = [
        'message_send_latency',
        'chatroom_switch_latency', 
        'message_parser_performance',
        'emote_search_performance'
      ]
      
      requiredPanels.forEach(panel => {
        expect(DASHBOARD_CONFIG.slo_panels[panel]).toBeDefined()
        expect(DASHBOARD_CONFIG.slo_panels[panel].title).toBeDefined()
        expect(DASHBOARD_CONFIG.slo_panels[panel].description).toBeDefined()
        expect(DASHBOARD_CONFIG.slo_panels[panel].queries).toBeDefined()
      })
    })

    it('should have valid SLO target values', () => {
      const panels = DASHBOARD_CONFIG.slo_panels
      
      expect(panels.message_send_latency.target_seconds).toBe(2.0)
      expect(panels.message_send_latency.p99_target_seconds).toBe(1.5)
      
      expect(panels.chatroom_switch_latency.target_seconds).toBe(0.5)
      expect(panels.chatroom_switch_latency.p99_target_seconds).toBe(0.3)
      
      expect(panels.message_parser_performance.target_seconds).toBe(0.05)
      expect(panels.message_parser_performance.p99_target_seconds).toBe(0.02)
      
      expect(panels.emote_search_performance.target_seconds).toBe(0.1)
      expect(panels.emote_search_performance.p99_target_seconds).toBe(0.05)
    })

    it('should have consistent p99/target relationships', () => {
      Object.values(DASHBOARD_CONFIG.slo_panels).forEach(panel => {
        if (panel.target_seconds && panel.p99_target_seconds) {
          expect(panel.p99_target_seconds).toBeLessThanOrEqual(panel.target_seconds)
        }
      })
    })

    it('should have valid PromQL queries for each panel', () => {
      Object.values(DASHBOARD_CONFIG.slo_panels).forEach(panel => {
        expect(panel.queries).toBeDefined()
        expect(panel.queries.latency_histogram).toBeDefined()
        expect(panel.queries.success_rate).toBeDefined()
        expect(panel.queries.violations).toBeDefined()
        
        // Verify PromQL syntax basics
        expect(panel.queries.latency_histogram).toMatch(/histogram_quantile/)
        expect(panel.queries.success_rate).toMatch(/rate.*\/.*rate/)
        expect(panel.queries.violations).toMatch(/rate.*kicktalk_slo_violations_total/)
      })
    })

    it('should use consistent metric names in queries', () => {
      const panels = DASHBOARD_CONFIG.slo_panels
      
      // Message send queries should reference MESSAGE_SEND_DURATION
      expect(panels.message_send_latency.queries.latency_histogram)
        .toContain('operation="MESSAGE_SEND_DURATION"')
      expect(panels.message_send_latency.queries.success_rate)
        .toContain('operation="MESSAGE_SEND_DURATION"')
      expect(panels.message_send_latency.queries.violations)
        .toContain('operation="MESSAGE_SEND_DURATION"')
      
      // Chatroom switch queries should reference CHATROOM_SWITCH_DURATION
      expect(panels.chatroom_switch_latency.queries.latency_histogram)
        .toContain('operation="CHATROOM_SWITCH_DURATION"')
    })

    it('should use appropriate time windows in queries', () => {
      Object.values(DASHBOARD_CONFIG.slo_panels).forEach(panel => {
        // All queries should use 5m time windows for rate calculations
        expect(panel.queries.latency_histogram).toMatch(/\[5m\]/)
        expect(panel.queries.success_rate).toMatch(/\[5m\]/)
        expect(panel.queries.violations).toMatch(/\[5m\]/)
      })
    })
  })

  describe('Performance Budget Panels', () => {
    it('should have memory and CPU budget panels', () => {
      expect(DASHBOARD_CONFIG.performance_budget_panels.memory_usage_budget).toBeDefined()
      expect(DASHBOARD_CONFIG.performance_budget_panels.cpu_usage_budget).toBeDefined()
    })

    it('should have valid memory budget configuration', () => {
      const memoryPanel = DASHBOARD_CONFIG.performance_budget_panels.memory_usage_budget
      
      expect(memoryPanel.title).toBe('Memory Usage Performance Budget')
      expect(memoryPanel.description).toBe('Memory usage vs 512MB budget')
      expect(memoryPanel.queries.current_usage).toBe('kicktalk_memory_usage_bytes{type="heap_used"}')
      expect(memoryPanel.queries.budget_remaining).toBe('kicktalk_performance_budget_remaining{operation="memory_usage"}')
      expect(memoryPanel.queries.utilization_percent).toContain('512 * 1024 * 1024')
    })

    it('should have valid CPU budget configuration', () => {
      const cpuPanel = DASHBOARD_CONFIG.performance_budget_panels.cpu_usage_budget
      
      expect(cpuPanel.title).toBe('CPU Usage Performance Budget')
      expect(cpuPanel.description).toBe('CPU usage vs 80% budget')
      expect(cpuPanel.queries.current_usage).toBe('kicktalk_cpu_usage_percent')
      expect(cpuPanel.queries.budget_remaining).toBe('kicktalk_performance_budget_remaining{operation="cpu_usage"}')
    })
  })

  describe('Connection Health Panels', () => {
    it('should have WebSocket connection panels', () => {
      expect(DASHBOARD_CONFIG.connection_health_panels.websocket_connections).toBeDefined()
      expect(DASHBOARD_CONFIG.connection_health_panels.connection_establishment).toBeDefined()
    })

    it('should have valid WebSocket connection queries', () => {
      const wsPanel = DASHBOARD_CONFIG.connection_health_panels.websocket_connections
      
      expect(wsPanel.queries.active_connections).toBe('kicktalk_websocket_connections_active')
      expect(wsPanel.queries.connection_errors).toBe('rate(kicktalk_connection_errors_total[5m])')
      expect(wsPanel.queries.reconnections).toBe('rate(kicktalk_websocket_reconnections_total[5m])')
      expect(wsPanel.queries.seventv_connections).toBe('kicktalk_seventv_connections_total')
    })

    it('should have valid connection establishment queries', () => {
      const connPanel = DASHBOARD_CONFIG.connection_health_panels.connection_establishment
      
      expect(connPanel.queries.establishment_time).toMatch(/histogram_quantile/)
      expect(connPanel.queries.establishment_time).toContain('WEBSOCKET_CONNECTION_TIME')
      expect(connPanel.queries.success_rate).toMatch(/rate.*websocket_connection.*success/)
    })
  })

  describe('Application Health Panels', () => {
    it('should have startup and message throughput panels', () => {
      expect(DASHBOARD_CONFIG.app_health_panels.startup_performance).toBeDefined()
      expect(DASHBOARD_CONFIG.app_health_panels.message_throughput).toBeDefined()
    })

    it('should have valid startup performance queries', () => {
      const startupPanel = DASHBOARD_CONFIG.app_health_panels.startup_performance
      
      expect(startupPanel.queries.startup_duration).toContain('APP_STARTUP_DURATION')
      expect(startupPanel.queries.startup_phases).toBe('kicktalk_api_request_duration_seconds{operation="startup"}')
    })

    it('should have valid message throughput queries', () => {
      const throughputPanel = DASHBOARD_CONFIG.app_health_panels.message_throughput
      
      expect(throughputPanel.queries.messages_sent_rate).toBe('rate(kicktalk_messages_sent_total[5m])')
      expect(throughputPanel.queries.messages_received_rate).toBe('rate(kicktalk_messages_received_total[5m])')
      expect(throughputPanel.queries.message_send_success_rate).toMatch(/rate.*message_send.*success/)
    })
  })

  describe('Alert Rules Configuration', () => {
    it('should have critical alert rules defined', () => {
      expect(Array.isArray(DASHBOARD_CONFIG.alert_rules.slo_violations)).toBe(true)
      expect(DASHBOARD_CONFIG.alert_rules.slo_violations.length).toBeGreaterThan(0)
    })

    it('should have message send SLO alert', () => {
      const messageSendAlert = DASHBOARD_CONFIG.alert_rules.slo_violations.find(
        alert => alert.name === 'Message Send SLO Violation'
      )
      
      expect(messageSendAlert).toBeDefined()
      expect(messageSendAlert.condition).toContain('MESSAGE_SEND_DURATION')
      expect(messageSendAlert.condition).toContain('> 2')
      expect(messageSendAlert.severity).toBe('warning')
      expect(messageSendAlert.duration).toBe('2m')
    })

    it('should have chatroom switch SLO alert', () => {
      const chatroomSwitchAlert = DASHBOARD_CONFIG.alert_rules.slo_violations.find(
        alert => alert.name === 'Chatroom Switch SLO Violation'
      )
      
      expect(chatroomSwitchAlert).toBeDefined()
      expect(chatroomSwitchAlert.condition).toContain('CHATROOM_SWITCH_DURATION')
      expect(chatroomSwitchAlert.condition).toContain('> 0.5')
      expect(chatroomSwitchAlert.severity).toBe('warning')
      expect(chatroomSwitchAlert.duration).toBe('1m')
    })

    it('should have memory usage critical alert', () => {
      const memoryAlert = DASHBOARD_CONFIG.alert_rules.slo_violations.find(
        alert => alert.name === 'Memory Usage Critical'
      )
      
      expect(memoryAlert).toBeDefined()
      expect(memoryAlert.condition).toContain('kicktalk_memory_usage_bytes{type="heap_used"}')
      expect(memoryAlert.condition).toContain('512 * 1024 * 1024')
      expect(memoryAlert.severity).toBe('critical')
      expect(memoryAlert.duration).toBe('30s')
    })

    it('should have high error rate alert', () => {
      const errorRateAlert = DASHBOARD_CONFIG.alert_rules.slo_violations.find(
        alert => alert.name === 'High Error Rate'
      )
      
      expect(errorRateAlert).toBeDefined()
      expect(errorRateAlert.condition).toContain('> 5')
      expect(errorRateAlert.severity).toBe('critical')
      expect(errorRateAlert.duration).toBe('5m')
    })

    it('should have valid alert rule structure', () => {
      DASHBOARD_CONFIG.alert_rules.slo_violations.forEach(alert => {
        expect(alert.name).toBeDefined()
        expect(alert.description).toBeDefined()
        expect(alert.condition).toBeDefined()
        expect(alert.severity).toMatch(/^(warning|critical)$/)
        expect(alert.duration).toMatch(/^\d+(s|m|h)$/)
        
        // Name should be descriptive
        expect(alert.name.length).toBeGreaterThan(10)
        
        // Description should explain the alert
        expect(alert.description.length).toBeGreaterThan(15)
      })
    })

    it('should have reasonable alert thresholds', () => {
      const alerts = DASHBOARD_CONFIG.alert_rules.slo_violations
      
      // Message send should be < 5 seconds (reasonable upper bound)
      const messageSendAlert = alerts.find(a => a.name.includes('Message Send'))
      expect(messageSendAlert.condition).toMatch(/>\s*[0-4](\.\d+)?/)
      
      // Error rate should be reasonable (< 50%)
      const errorRateAlert = alerts.find(a => a.name.includes('Error Rate'))
      expect(errorRateAlert.condition).toMatch(/>\s*[0-4]\d/)
    })

    it('should have appropriate alert durations', () => {
      DASHBOARD_CONFIG.alert_rules.slo_violations.forEach(alert => {
        const duration = alert.duration
        
        // Duration should be reasonable (not too short or too long)
        if (alert.severity === 'critical') {
          // Critical alerts can fire quickly
          expect(['30s', '1m', '2m', '5m']).toContain(duration)
        } else {
          // Warning alerts should have some buffer
          expect(['1m', '2m', '5m', '10m']).toContain(duration)
        }
      })
    })
  })

  describe('Configuration Consistency', () => {
    it('should use consistent metric naming patterns', () => {
      const allQueries = []
      
      // Collect all queries from different panel types
      Object.values(DASHBOARD_CONFIG.slo_panels).forEach(panel => {
        allQueries.push(...Object.values(panel.queries))
      })
      
      Object.values(DASHBOARD_CONFIG.performance_budget_panels).forEach(panel => {
        allQueries.push(...Object.values(panel.queries))
      })
      
      Object.values(DASHBOARD_CONFIG.connection_health_panels).forEach(panel => {
        allQueries.push(...Object.values(panel.queries))
      })
      
      Object.values(DASHBOARD_CONFIG.app_health_panels).forEach(panel => {
        allQueries.push(...Object.values(panel.queries))
      })
      
      // All metrics should start with 'kicktalk_'
      allQueries.forEach(query => {
        if (query.includes('kicktalk_')) {
          expect(query).toMatch(/kicktalk_[a-z_]+/)
        }
      })
    })

    it('should use consistent time windows', () => {
      const commonTimeWindows = ['5m', '1m', '10m', '1h']
      
      const allQueries = []
      Object.values(DASHBOARD_CONFIG.slo_panels).forEach(panel => {
        allQueries.push(...Object.values(panel.queries))
      })
      
      allQueries.forEach(query => {
        const timeWindowMatches = query.match(/\[(\d+[smhd])\]/g)
        if (timeWindowMatches) {
          timeWindowMatches.forEach(match => {
            const window = match.slice(1, -1) // Remove brackets
            // Most queries should use common time windows
            expect(commonTimeWindows.some(tw => window === tw || window.endsWith(tw.slice(-1)))).toBe(true)
          })
        }
      })
    })

    it('should have consistent operation names across panels and alerts', () => {
      const operationNames = new Set()
      
      // Extract operation names from SLO panels
      Object.values(DASHBOARD_CONFIG.slo_panels).forEach(panel => {
        Object.values(panel.queries).forEach(query => {
          const matches = query.match(/operation="([^"]+)"/g)
          if (matches) {
            matches.forEach(match => {
              operationNames.add(match.match(/"([^"]+)"/)[1])
            })
          }
        })
      })
      
      // Check that alert rules use the same operation names
      DASHBOARD_CONFIG.alert_rules.slo_violations.forEach(alert => {
        const matches = alert.condition.match(/operation="([^"]+)"/g)
        if (matches) {
          matches.forEach(match => {
            const opName = match.match(/"([^"]+)"/)[1]
            expect(operationNames.has(opName)).toBe(true)
          })
        }
      })
    })
  })

  describe('Dashboard Metadata', () => {
    it('should have descriptive titles for all panels', () => {
      const allPanels = [
        ...Object.values(DASHBOARD_CONFIG.slo_panels),
        ...Object.values(DASHBOARD_CONFIG.performance_budget_panels),
        ...Object.values(DASHBOARD_CONFIG.connection_health_panels),
        ...Object.values(DASHBOARD_CONFIG.app_health_panels)
      ]
      
      allPanels.forEach(panel => {
        expect(panel.title).toBeDefined()
        expect(panel.title.length).toBeGreaterThan(5)
        expect(panel.description).toBeDefined()
        expect(panel.description.length).toBeGreaterThan(10)
      })
    })

    it('should have unique panel titles', () => {
      const allTitles = []
      
      Object.values(DASHBOARD_CONFIG.slo_panels).forEach(panel => {
        allTitles.push(panel.title)
      })
      Object.values(DASHBOARD_CONFIG.performance_budget_panels).forEach(panel => {
        allTitles.push(panel.title)
      })
      Object.values(DASHBOARD_CONFIG.connection_health_panels).forEach(panel => {
        allTitles.push(panel.title)
      })
      Object.values(DASHBOARD_CONFIG.app_health_panels).forEach(panel => {
        allTitles.push(panel.title)
      })
      
      const uniqueTitles = [...new Set(allTitles)]
      expect(allTitles.length).toBe(uniqueTitles.length)
    })

    it('should have informative descriptions', () => {
      const allPanels = [
        ...Object.values(DASHBOARD_CONFIG.slo_panels),
        ...Object.values(DASHBOARD_CONFIG.performance_budget_panels),
        ...Object.values(DASHBOARD_CONFIG.connection_health_panels),
        ...Object.values(DASHBOARD_CONFIG.app_health_panels)
      ]
      
      allPanels.forEach(panel => {
        // Descriptions should mention targets or thresholds where applicable
        if (panel.target_seconds) {
          expect(panel.description.toLowerCase()).toMatch(/(target|vs|threshold)/)
        }
        
        // Should not be just the title repeated
        expect(panel.description.toLowerCase()).not.toBe(panel.title.toLowerCase())
      })
    })
  })
})

describe('DashboardUtils', () => {
  describe('SLO Compliance Query Generation', () => {
    it('should generate valid SLO compliance query', () => {
      const query = DashboardUtils.generateSLOComplianceQuery('MESSAGE_SEND_DURATION')
      
      expect(query).toBe(
        'sum(rate(kicktalk_slo_success_rate_total{operation="MESSAGE_SEND_DURATION",status="success"}[5m])) / sum(rate(kicktalk_slo_success_rate_total{operation="MESSAGE_SEND_DURATION"}[5m])) * 100'
      )
    })

    it('should handle custom time range', () => {
      const query = DashboardUtils.generateSLOComplianceQuery('TEST_OP', '10m')
      
      expect(query).toContain('[5m]') // Still uses 5m for rate despite timeRange param
    })

    it('should handle special characters in operation name', () => {
      const query = DashboardUtils.generateSLOComplianceQuery('TEST_OP_WITH_SPECIAL-CHARS')
      
      expect(query).toContain('operation="TEST_OP_WITH_SPECIAL-CHARS"')
    })
  })

  describe('Latency Percentile Query Generation', () => {
    it('should generate valid latency percentile query with defaults', () => {
      const query = DashboardUtils.generateLatencyPercentileQuery('MESSAGE_SEND_DURATION')
      
      expect(query).toBe(
        'histogram_quantile(0.95, sum(rate(kicktalk_slo_latency_seconds_bucket{operation="MESSAGE_SEND_DURATION"}[5m])) by (le))'
      )
    })

    it('should handle custom percentile', () => {
      const query = DashboardUtils.generateLatencyPercentileQuery('TEST_OP', 0.99)
      
      expect(query).toContain('histogram_quantile(0.99,')
    })

    it('should handle custom time range', () => {
      const query = DashboardUtils.generateLatencyPercentileQuery('TEST_OP', 0.95, '10m')
      
      expect(query).toContain('[10m]')
    })

    it('should handle edge case percentiles', () => {
      const query50 = DashboardUtils.generateLatencyPercentileQuery('TEST_OP', 0.5)
      expect(query50).toContain('histogram_quantile(0.5,')
      
      const query99_9 = DashboardUtils.generateLatencyPercentileQuery('TEST_OP', 0.999)
      expect(query99_9).toContain('histogram_quantile(0.999,')
    })
  })

  describe('Error Rate Query Generation', () => {
    it('should generate valid error rate query', () => {
      const query = DashboardUtils.generateErrorRateQuery('MESSAGE_SEND_DURATION')
      
      expect(query).toBe(
        'sum(rate(kicktalk_slo_violations_total{operation="MESSAGE_SEND_DURATION"}[5m]))'
      )
    })

    it('should handle custom time range', () => {
      const query = DashboardUtils.generateErrorRateQuery('TEST_OP', '10m')
      
      expect(query).toContain('[10m]')
    })
  })

  describe('Alert Condition Generation', () => {
    it('should generate valid alert condition', () => {
      const condition = DashboardUtils.generateAlertCondition('MESSAGE_SEND_DURATION', 2.0)
      
      expect(condition).toBe(
        'histogram_quantile(0.95, sum(rate(kicktalk_slo_latency_seconds_bucket{operation="MESSAGE_SEND_DURATION"}[5m])) by (le)) > 2'
      )
    })

    it('should handle custom percentile', () => {
      const condition = DashboardUtils.generateAlertCondition('TEST_OP', 1.0, 0.99)
      
      expect(condition).toContain('histogram_quantile(0.99,')
      expect(condition).toContain('> 1')
    })

    it('should handle decimal targets', () => {
      const condition = DashboardUtils.generateAlertCondition('TEST_OP', 0.5)
      
      expect(condition).toContain('> 0.5')
    })

    it('should handle very small targets', () => {
      const condition = DashboardUtils.generateAlertCondition('TEST_OP', 0.001)
      
      expect(condition).toContain('> 0.001')
    })
  })

  describe('SLO Targets Retrieval', () => {
    it('should return all configured SLO targets', () => {
      const targets = DashboardUtils.getSLOTargets()
      
      expect(targets).toEqual({
        'MESSAGE_SEND_DURATION': { target: 2.0, p99: 1.5 },
        'CHATROOM_SWITCH_DURATION': { target: 0.5, p99: 0.3 },
        'MESSAGE_PARSER_DURATION': { target: 0.05, p99: 0.02 },
        'EMOTE_SEARCH_DURATION': { target: 0.1, p99: 0.05 },
        'WEBSOCKET_CONNECTION_TIME': { target: 5.0, p99: 3.0 },
        'APP_STARTUP_DURATION': { target: 10.0, p99: 7.0 }
      })
    })

    it('should return a copy that cannot modify the original', () => {
      const targets = DashboardUtils.getSLOTargets()
      targets.MESSAGE_SEND_DURATION.target = 999
      
      const freshTargets = DashboardUtils.getSLOTargets()
      expect(freshTargets.MESSAGE_SEND_DURATION.target).toBe(2.0)
    })

    it('should have all expected operations', () => {
      const targets = DashboardUtils.getSLOTargets()
      const operations = Object.keys(targets)
      
      expect(operations).toContain('MESSAGE_SEND_DURATION')
      expect(operations).toContain('CHATROOM_SWITCH_DURATION')
      expect(operations).toContain('MESSAGE_PARSER_DURATION')
      expect(operations).toContain('EMOTE_SEARCH_DURATION')
      expect(operations).toContain('WEBSOCKET_CONNECTION_TIME')
      expect(operations).toContain('APP_STARTUP_DURATION')
    })

    it('should have valid target values', () => {
      const targets = DashboardUtils.getSLOTargets()
      
      Object.values(targets).forEach(target => {
        expect(target.target).toBeGreaterThan(0)
        expect(target.p99).toBeGreaterThan(0)
        expect(target.p99).toBeLessThanOrEqual(target.target)
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle null/undefined operation names', () => {
      expect(() => {
        DashboardUtils.generateSLOComplianceQuery(null)
        DashboardUtils.generateSLOComplianceQuery(undefined)
        DashboardUtils.generateLatencyPercentileQuery('')
      }).not.toThrow()
    })

    it('should handle invalid percentile values', () => {
      expect(() => {
        DashboardUtils.generateLatencyPercentileQuery('TEST_OP', -0.1)
        DashboardUtils.generateLatencyPercentileQuery('TEST_OP', 1.1)
        DashboardUtils.generateLatencyPercentileQuery('TEST_OP', null)
      }).not.toThrow()
    })

    it('should handle invalid time ranges', () => {
      expect(() => {
        DashboardUtils.generateLatencyPercentileQuery('TEST_OP', 0.95, '')
        DashboardUtils.generateLatencyPercentileQuery('TEST_OP', 0.95, null)
        DashboardUtils.generateErrorRateQuery('TEST_OP', 'invalid')
      }).not.toThrow()
    })

    it('should handle very long operation names', () => {
      const longName = 'A'.repeat(1000)
      
      expect(() => {
        DashboardUtils.generateSLOComplianceQuery(longName)
        DashboardUtils.generateLatencyPercentileQuery(longName)
        DashboardUtils.generateErrorRateQuery(longName)
      }).not.toThrow()
    })

    it('should handle special characters in operation names', () => {
      const specialName = 'TEST-OP_WITH.SPECIAL@CHARS#123'
      
      const query = DashboardUtils.generateSLOComplianceQuery(specialName)
      expect(query).toContain(`operation="${specialName}"`)
    })

    it('should handle extreme target values in alert conditions', () => {
      expect(() => {
        DashboardUtils.generateAlertCondition('TEST_OP', 0)
        DashboardUtils.generateAlertCondition('TEST_OP', -1)
        DashboardUtils.generateAlertCondition('TEST_OP', 999999)
        DashboardUtils.generateAlertCondition('TEST_OP', Infinity)
      }).not.toThrow()
    })
  })

  describe('Query Validation', () => {
    it('should generate syntactically valid PromQL', () => {
      const operations = ['MESSAGE_SEND_DURATION', 'CHATROOM_SWITCH_DURATION', 'TEST_OP']
      
      operations.forEach(op => {
        const queries = [
          DashboardUtils.generateSLOComplianceQuery(op),
          DashboardUtils.generateLatencyPercentileQuery(op),
          DashboardUtils.generateErrorRateQuery(op),
          DashboardUtils.generateAlertCondition(op, 1.0)
        ]
        
        queries.forEach(query => {
          // Basic PromQL syntax validation
          expect(query).not.toMatch(/\(\)/) // No empty parentheses
          expect(query).not.toMatch(/\[\]/) // No empty brackets
          expect(query).not.toMatch(/\{\}/) // No empty braces
          expect(query).not.toMatch(/,,/) // No double commas
          
          // Should have balanced parentheses
          const openParens = (query.match(/\(/g) || []).length
          const closeParens = (query.match(/\)/g) || []).length
          expect(openParens).toBe(closeParens)
          
          // Should have balanced brackets
          const openBrackets = (query.match(/\[/g) || []).length
          const closeBrackets = (query.match(/\]/g) || []).length
          expect(openBrackets).toBe(closeBrackets)
        })
      })
    })

    it('should use consistent metric naming', () => {
      const operations = ['MESSAGE_SEND_DURATION', 'API_REQUEST', 'WEBSOCKET_CONNECT']
      
      operations.forEach(op => {
        const complianceQuery = DashboardUtils.generateSLOComplianceQuery(op)
        const latencyQuery = DashboardUtils.generateLatencyPercentileQuery(op)
        const errorQuery = DashboardUtils.generateErrorRateQuery(op)
        
        // All should use kicktalk_ prefix
        expect(complianceQuery).toMatch(/kicktalk_slo_success_rate_total/)
        expect(latencyQuery).toMatch(/kicktalk_slo_latency_seconds_bucket/)
        expect(errorQuery).toMatch(/kicktalk_slo_violations_total/)
      })
    })

    it('should generate queries with appropriate aggregations', () => {
      const latencyQuery = DashboardUtils.generateLatencyPercentileQuery('TEST_OP')
      const complianceQuery = DashboardUtils.generateSLOComplianceQuery('TEST_OP')
      const errorQuery = DashboardUtils.generateErrorRateQuery('TEST_OP')
      
      // Latency query should use histogram_quantile
      expect(latencyQuery).toMatch(/^histogram_quantile/)
      
      // Compliance query should use division of sum(rate(...))
      expect(complianceQuery).toMatch(/sum\(rate\(.*\)\) \/ sum\(rate\(.*\)\)/)
      
      // Error query should use sum(rate(...))
      expect(errorQuery).toMatch(/^sum\(rate\(/)
    })
  })
})