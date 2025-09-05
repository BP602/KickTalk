class ElectronStoreMock {
  constructor() {}
  get(key, defValue) {
    if (key === 'telemetry') return { enabled: true };
    return defValue;
  }
  set() {}
  has() { return false }
  delete() {}
  clear() {}
}

module.exports = ElectronStoreMock;
