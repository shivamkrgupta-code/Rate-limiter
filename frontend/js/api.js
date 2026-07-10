const API = {
  // Wake the container on page load
  async health() {
    try { await fetch('/health'); } catch (_) {}
  },

  async fireRequest(algo) {
    const res = await fetch(`/api/${algo}`);
    const data = await res.json();
    return { status: res.status, data };
  },

  // Fire N requests in parallel — for burst mode
  async burst(algo, count) {
    const promises = Array.from({ length: count }, () => this.fireRequest(algo));
    return Promise.all(promises);
  }
};