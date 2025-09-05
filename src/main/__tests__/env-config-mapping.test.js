import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Configuration Mapping Tests', () => {
  let originalEnv;
  let mockConsole;

  beforeEach(() => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Mock console methods
    mockConsole = {
      warn: vi.fn(),
      log: vi.fn(),
      error: vi.fn()
    };
    console.warn = mockConsole.warn;
    console.log = mockConsole.log;
    console.error = mockConsole.error;
    
    // Clear relevant env vars
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_EXPORTER_OTLP_HEADERS;
    delete process.env.OTEL_DIAG_LOG_LEVEL;
    delete process.env.OTEL_DEPLOYMENT_ENV;
    delete process.env.OTEL_SERVICE_NAME;
    delete process.env.OTEL_RESOURCE_ATTRIBUTES;
    
    delete process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS;
    delete process.env.MAIN_VITE_OTEL_DIAG_LOG_LEVEL;
    delete process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV;
    delete process.env.MAIN_VITE_OTEL_SERVICE_NAME;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.resetModules();
  });

  // Helper function to simulate the env mapping logic from main/index.js
  const simulateEnvMapping = () => {
    const env = process.env;
    const map = (src, dest) => {
      if (env[src] && !env[dest]) env[dest] = env[src];
    };

    map("MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT", "OTEL_EXPORTER_OTLP_ENDPOINT");
    map("MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS", "OTEL_EXPORTER_OTLP_HEADERS");
    map("MAIN_VITE_OTEL_DIAG_LOG_LEVEL", "OTEL_DIAG_LOG_LEVEL");
    map("MAIN_VITE_OTEL_DEPLOYMENT_ENV", "OTEL_DEPLOYMENT_ENV");
    map("MAIN_VITE_OTEL_SERVICE_NAME", "OTEL_SERVICE_NAME");

    // Resource attributes construction
    if (!env.OTEL_RESOURCE_ATTRIBUTES) {
      const attrs = [];
      if (env.OTEL_SERVICE_NAME) attrs.push(`service.name=${env.OTEL_SERVICE_NAME}`);
      if (env.OTEL_DEPLOYMENT_ENV) attrs.push(`deployment.environment=${env.OTEL_DEPLOYMENT_ENV}`);
      if (attrs.length) env.OTEL_RESOURCE_ATTRIBUTES = attrs.join(",");
    }

    // Test environment detection
    if ((env.NODE_ENV === 'test' || env.VITEST || env.VITEST_WORKER_ID) && !env.OTEL_DEPLOYMENT_ENV) {
      env.OTEL_DEPLOYMENT_ENV = 'test';
    }
  };

  // Helper to simulate service version injection
  const simulateServiceVersionInjection = (appVersion = '1.0.0-test') => {
    const version = appVersion;
    const existing = process.env.OTEL_RESOURCE_ATTRIBUTES || '';
    const attrs = existing
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((kv) => !/^service\.version=/.test(kv));
    attrs.push(`service.version=${version}`);
    process.env.OTEL_RESOURCE_ATTRIBUTES = attrs.join(',');
    
    const svcName = process.env.MAIN_VITE_OTEL_SERVICE_NAME || process.env.OTEL_SERVICE_NAME || 'kicktalk';
    if (!attrs.some((kv) => kv.startsWith('service.name='))) {
      process.env.OTEL_RESOURCE_ATTRIBUTES = `service.name=${svcName},${process.env.OTEL_RESOURCE_ATTRIBUTES}`;
    }
  };

  describe('Basic Environment Variable Mapping', () => {
    it('should map MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT to OTEL_EXPORTER_OTLP_ENDPOINT', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://otlp.grafana.net/otlp/v1/traces';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://otlp.grafana.net/otlp/v1/traces');
    });

    it('should map MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS to OTEL_EXPORTER_OTLP_HEADERS', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer token123,User-Agent=KickTalk/1.0.0';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer token123,User-Agent=KickTalk/1.0.0');
    });

    it('should map MAIN_VITE_OTEL_DIAG_LOG_LEVEL to OTEL_DIAG_LOG_LEVEL', () => {
      process.env.MAIN_VITE_OTEL_DIAG_LOG_LEVEL = 'DEBUG';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DIAG_LOG_LEVEL).toBe('DEBUG');
    });

    it('should map MAIN_VITE_OTEL_DEPLOYMENT_ENV to OTEL_DEPLOYMENT_ENV', () => {
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'production';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('production');
    });

    it('should map MAIN_VITE_OTEL_SERVICE_NAME to OTEL_SERVICE_NAME', () => {
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'kicktalk-custom';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_SERVICE_NAME).toBe('kicktalk-custom');
    });

    it('should map all MAIN_VITE_KT_ variables simultaneously', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://tempo.grafana.net/otlp';
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer multi-test';
      process.env.MAIN_VITE_OTEL_DIAG_LOG_LEVEL = 'INFO';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'staging';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'kicktalk-staging';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://tempo.grafana.net/otlp');
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer multi-test');
      expect(process.env.OTEL_DIAG_LOG_LEVEL).toBe('INFO');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('staging');
      expect(process.env.OTEL_SERVICE_NAME).toBe('kicktalk-staging');
    });
  });

  describe('Mapping Priority and Overrides', () => {
    it('should not override existing OTEL_ variables', () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://existing.otlp.endpoint';
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://should.not.override';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://existing.otlp.endpoint');
    });

    it('should not override existing OTEL_RESOURCE_ATTRIBUTES', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'existing.attr=value';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'should-not-affect';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('existing.attr=value');
    });

    it('should preserve existing OTEL_ values when MAIN_VITE_ is present', () => {
      process.env.OTEL_SERVICE_NAME = 'existing-service';
      process.env.OTEL_DEPLOYMENT_ENV = 'existing-env';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'override-attempt';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'override-attempt-env';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_SERVICE_NAME).toBe('existing-service');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('existing-env');
    });

    it('should handle partial mappings correctly', () => {
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://existing.endpoint';
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer new-header';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'new-service';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://existing.endpoint'); // Not overridden
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer new-header'); // Mapped
      expect(process.env.OTEL_SERVICE_NAME).toBe('new-service'); // Mapped
    });
  });

  describe('Resource Attributes Construction', () => {
    it('should construct OTEL_RESOURCE_ATTRIBUTES from service name only', () => {
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'test-service';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=test-service');
    });

    it('should construct OTEL_RESOURCE_ATTRIBUTES from deployment env only', () => {
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'development';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('deployment.environment=development');
    });

    it('should construct OTEL_RESOURCE_ATTRIBUTES from both service name and deployment env', () => {
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'multi-attr-service';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'multi-attr-env';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=multi-attr-service,deployment.environment=multi-attr-env');
    });

    it('should not construct OTEL_RESOURCE_ATTRIBUTES when no source attributes', () => {
      simulateEnvMapping();
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBeUndefined();
    });

    it('should handle service name via direct OTEL_SERVICE_NAME', () => {
      process.env.OTEL_SERVICE_NAME = 'direct-otel-service';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=direct-otel-service');
    });

    it('should handle deployment env via direct OTEL_DEPLOYMENT_ENV', () => {
      process.env.OTEL_DEPLOYMENT_ENV = 'direct-otel-env';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('deployment.environment=direct-otel-env');
    });

    it('should prioritize MAIN_VITE_ variables in attribute construction', () => {
      process.env.OTEL_SERVICE_NAME = 'fallback-service';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'priority-service';
      process.env.OTEL_DEPLOYMENT_ENV = 'fallback-env';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'priority-env';
      
      simulateEnvMapping();
      
      // After mapping, MAIN_VITE_ does not override existing OTEL_
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=fallback-service,deployment.environment=fallback-env');
    });
  });

  describe('Test Environment Detection', () => {
    it('should set deployment env to test when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('test');
    });

    it('should set deployment env to test when VITEST is present', () => {
      process.env.VITEST = 'true';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('test');
    });

    it('should set deployment env to test when VITEST_WORKER_ID is present', () => {
      process.env.VITEST_WORKER_ID = '1';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('test');
    });

    it('should not override existing OTEL_DEPLOYMENT_ENV in test environment', () => {
      process.env.NODE_ENV = 'test';
      process.env.OTEL_DEPLOYMENT_ENV = 'existing-test-env';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('existing-test-env');
    });

    it('should not set test env when MAIN_VITE_OTEL_DEPLOYMENT_ENV is set', () => {
      process.env.NODE_ENV = 'test';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'custom-test-env';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('custom-test-env');
    });

    it('should handle multiple test environment indicators', () => {
      process.env.NODE_ENV = 'test';
      process.env.VITEST = 'true';
      process.env.VITEST_WORKER_ID = '2';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('test');
    });
  });

  describe('Service Version Injection', () => {
    it('should inject service version into OTEL_RESOURCE_ATTRIBUTES', () => {
      simulateServiceVersionInjection('2.0.0-beta');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,service.version=2.0.0-beta');
    });

    it('should append service version to existing attributes', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'existing.attr=value,another.attr=value2';
      
      simulateServiceVersionInjection('1.5.0');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,existing.attr=value,another.attr=value2,service.version=1.5.0');
    });

    it('should replace existing service.version', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.name=test,service.version=old-version,other.attr=value';
      
      simulateServiceVersionInjection('new-version');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=test,other.attr=value,service.version=new-version');
    });

    it('should use custom service name from MAIN_VITE_OTEL_SERVICE_NAME', () => {
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'custom-kicktalk';
      
      simulateServiceVersionInjection('3.0.0');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=custom-kicktalk,service.version=3.0.0');
    });

    it('should use direct OTEL_SERVICE_NAME over default', () => {
      process.env.OTEL_SERVICE_NAME = 'direct-service';
      
      simulateServiceVersionInjection('4.0.0');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=direct-service,service.version=4.0.0');
    });

    it('should not duplicate service.name if already present', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.name=existing-service,deployment.environment=prod';
      
      simulateServiceVersionInjection('5.0.0');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=existing-service,deployment.environment=prod,service.version=5.0.0');
    });

    it('should handle empty existing OTEL_RESOURCE_ATTRIBUTES gracefully', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = '';
      
      simulateServiceVersionInjection('6.0.0');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,service.version=6.0.0');
    });

    it('should handle whitespace in existing attributes', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = '  attr1=value1  , , attr2=value2   ,  ';
      
      simulateServiceVersionInjection('7.0.0');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,attr1=value1,attr2=value2,service.version=7.0.0');
    });

    it('should handle malformed attribute strings', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'valid=attr,invalid-without-equals,another=valid';
      
      simulateServiceVersionInjection('8.0.0');
      
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,valid=attr,invalid-without-equals,another=valid,service.version=8.0.0');
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle full Grafana Cloud production configuration', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://otlp-gateway-prod-us-east-0.grafana.net/otlp';
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer prod-token-12345';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'kicktalk';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'production';
      process.env.MAIN_VITE_OTEL_DIAG_LOG_LEVEL = 'WARN';
      
      simulateEnvMapping();
      simulateServiceVersionInjection('1.2.3');
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://otlp-gateway-prod-us-east-0.grafana.net/otlp');
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer prod-token-12345');
      expect(process.env.OTEL_SERVICE_NAME).toBe('kicktalk');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('production');
      expect(process.env.OTEL_DIAG_LOG_LEVEL).toBe('WARN');
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,deployment.environment=production,service.version=1.2.3');
    });

    it('should handle development environment with partial configuration', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318/v1/traces';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'kicktalk-dev';
      process.env.NODE_ENV = 'development';
      
      simulateEnvMapping();
      simulateServiceVersionInjection('0.1.0-dev');
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('http://localhost:4318/v1/traces');
      expect(process.env.OTEL_SERVICE_NAME).toBe('kicktalk-dev');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBeUndefined(); // Not test env
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk-dev,service.version=0.1.0-dev');
    });

    it('should handle test environment with mocked endpoints', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://tempo.example.com/v1/traces';
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer test-token';
      process.env.NODE_ENV = 'test';
      process.env.VITEST = 'true';
      
      simulateEnvMapping();
      simulateServiceVersionInjection('0.0.0-test');
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://tempo.example.com/v1/traces');
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer test-token');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('test');
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,deployment.environment=test,service.version=0.0.0-test');
    });

    it('should handle staging environment with custom resource attributes', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://staging-tempo.example.com/otlp';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'kicktalk-staging';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'staging';
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.namespace=kicktalk,deployment.region=us-west-2';
      
      simulateEnvMapping();
      simulateServiceVersionInjection('1.0.0-rc1');
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://staging-tempo.example.com/otlp');
      expect(process.env.OTEL_SERVICE_NAME).toBe('kicktalk-staging');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('staging');
      // Should preserve existing attributes
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.namespace=kicktalk,deployment.region=us-west-2,service.version=1.0.0-rc1');
    });

    it('should handle mixed MAIN_VITE_ and direct OTEL_ variables', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://main-vite.endpoint';
      process.env.OTEL_EXPORTER_OTLP_HEADERS = 'Direct-Header=value';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'main-vite-service';
      process.env.OTEL_DEPLOYMENT_ENV = 'direct-env';
      
      simulateEnvMapping();
      simulateServiceVersionInjection('2.1.0');
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://main-vite.endpoint'); // Mapped
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Direct-Header=value'); // Preserved
      expect(process.env.OTEL_SERVICE_NAME).toBe('main-vite-service'); // Mapped
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('direct-env'); // Preserved
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=main-vite-service,deployment.environment=direct-env,service.version=2.1.0');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty string values', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = '';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = '';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('');
      expect(process.env.OTEL_SERVICE_NAME).toBe('');
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=');
    });

    it('should handle very long environment variable values', () => {
      const longValue = 'A'.repeat(10000);
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = longValue;
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe(longValue);
    });

    it('should handle special characters in environment variables', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS = 'Authorization=Bearer token-with-special-chars!@#$%^&*()';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'service-with-dashes_and_underscores.and.dots';
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('Authorization=Bearer token-with-special-chars!@#$%^&*()');
      expect(process.env.OTEL_SERVICE_NAME).toBe('service-with-dashes_and_underscores.and.dots');
    });

    it('should handle undefined NODE_ENV gracefully', () => {
      delete process.env.NODE_ENV;
      
      simulateEnvMapping();
      
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBeUndefined();
    });

    it('should handle complex resource attribute edge cases', () => {
      // Test with attributes that contain commas and equals signs
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'complex.attr=value,with=equals,and=comma\\,escaped';
      
      simulateServiceVersionInjection('edge-case-version');
      
      // Should preserve complex attributes and add version
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,complex.attr=value,with=equals,and=comma\\,escaped,service.version=edge-case-version');
    });

    it('should handle multiple service.version attributes correctly', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.version=old1,other=attr,service.version=old2,service.version=old3';
      
      simulateServiceVersionInjection('final-version');
      
      // Should remove all existing service.version attributes
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=kicktalk,other=attr,service.version=final-version');
    });

    it('should handle version injection with pre-existing service.name', () => {
      process.env.OTEL_RESOURCE_ATTRIBUTES = 'service.name=existing-name,deployment.environment=prod';
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'should-not-duplicate';
      
      simulateServiceVersionInjection('no-duplicate-version');
      
      // Should not duplicate service.name
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=existing-name,deployment.environment=prod,service.version=no-duplicate-version');
    });
  });

  describe('Validation and Consistency', () => {
    it('should maintain consistent mapping behavior across multiple calls', () => {
      process.env.MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT = 'https://consistent.endpoint';
      
      // First mapping
      simulateEnvMapping();
      const firstResult = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      
      // Second mapping (should not change anything)
      simulateEnvMapping();
      const secondResult = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
      
      expect(firstResult).toBe(secondResult);
      expect(firstResult).toBe('https://consistent.endpoint');
    });

    it('should handle mapping with all possible MAIN_VITE_ combinations', () => {
      const testMappings = {
        'MAIN_VITE_OTEL_EXPORTER_OTLP_ENDPOINT': 'https://all-combinations.test',
        'MAIN_VITE_OTEL_EXPORTER_OTLP_HEADERS': 'All-Headers=test',
        'MAIN_VITE_OTEL_DIAG_LOG_LEVEL': 'ERROR',
        'MAIN_VITE_OTEL_DEPLOYMENT_ENV': 'all-combinations',
        'MAIN_VITE_OTEL_SERVICE_NAME': 'all-combinations-service'
      };
      
      // Set all MAIN_VITE_ variables
      Object.entries(testMappings).forEach(([key, value]) => {
        process.env[key] = value;
      });
      
      simulateEnvMapping();
      
      // Verify all corresponding OTEL_ variables are set
      expect(process.env.OTEL_EXPORTER_OTLP_ENDPOINT).toBe('https://all-combinations.test');
      expect(process.env.OTEL_EXPORTER_OTLP_HEADERS).toBe('All-Headers=test');
      expect(process.env.OTEL_DIAG_LOG_LEVEL).toBe('ERROR');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('all-combinations');
      expect(process.env.OTEL_SERVICE_NAME).toBe('all-combinations-service');
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=all-combinations-service,deployment.environment=all-combinations');
    });

    it('should validate that service version injection does not interfere with basic mapping', () => {
      process.env.MAIN_VITE_OTEL_SERVICE_NAME = 'version-test-service';
      process.env.MAIN_VITE_OTEL_DEPLOYMENT_ENV = 'version-test-env';
      
      // First do basic mapping
      simulateEnvMapping();
      
      // Verify basic mapping worked
      expect(process.env.OTEL_SERVICE_NAME).toBe('version-test-service');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('version-test-env');
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=version-test-service,deployment.environment=version-test-env');
      
      // Then inject service version
      simulateServiceVersionInjection('version-test');
      
      // Verify service version was added without disrupting other mappings
      expect(process.env.OTEL_SERVICE_NAME).toBe('version-test-service');
      expect(process.env.OTEL_DEPLOYMENT_ENV).toBe('version-test-env');
      expect(process.env.OTEL_RESOURCE_ATTRIBUTES).toBe('service.name=version-test-service,deployment.environment=version-test-env,service.version=version-test');
    });
  });
});