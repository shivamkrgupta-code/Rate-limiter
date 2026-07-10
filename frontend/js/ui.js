const UI = {
  elements: {
    fireBtn:       () => document.getElementById('fire-btn'),
    burstBtn:      () => document.getElementById('burst-btn'),
    progressFill:  () => document.getElementById('progress-fill'),
    statUsed:      () => document.getElementById('stat-used'),
    statRemaining: () => document.getElementById('stat-remaining'),
    statStatus:    () => document.getElementById('stat-status'),
    statHits:      () => document.getElementById('stat-hits'),
    timerContainer:() => document.getElementById('timer-container'),
    timerNumber:   () => document.getElementById('timer-number'),
    timerFill:     () => document.getElementById('timer-fill'),
    log:           () => document.getElementById('log'),
    logEmpty:      () => document.getElementById('log-empty'),
    algoLabel:     () => document.getElementById('algo-label'),
  },

  setAlgoLabel(name) {
    const labels = {
      'fixed-window':   'Fixed Window',
      'sliding-window': 'Sliding Window Log',
      'token-bucket':   'Token Bucket'
    };
    this.elements.algoLabel().textContent = labels[name] || name;
  },

  updateStats(data) {
    const limit = data.limit || 10;
    const used = data.count || 0;
    const remaining = data.remaining !== undefined ? data.remaining : limit - used;
    const allowed = data.allowed;

    this.elements.statUsed().textContent = used;
    this.elements.statRemaining().textContent = remaining;
    this.elements.statRemaining().style.color =
      remaining === 0 ? 'var(--red)' :
      remaining <= 3  ? 'var(--yellow)' : 'var(--green)';

    const statusEl = this.elements.statStatus();
    statusEl.textContent = allowed ? '200' : '429';
    statusEl.style.color = allowed ? 'var(--green)' : 'var(--red)';

    const pct = Math.min((used / limit) * 100, 100);
    this.elements.progressFill().style.width = pct + '%';
    this.elements.progressFill().style.background =
      !allowed    ? 'var(--red)'    :
      pct > 70    ? 'var(--yellow)' : 'var(--green)';
  },

  incrementHits() {
    const el = this.elements.statHits();
    el.textContent = parseInt(el.textContent || '0') + 1;
  },

  resetStats(limit = 10) {
    this.elements.statUsed().textContent = '0';
    this.elements.statRemaining().textContent = limit;
    this.elements.statRemaining().style.color = 'var(--green)';
    this.elements.statStatus().textContent = '200';
    this.elements.statStatus().style.color = 'var(--green)';
    this.elements.progressFill().style.width = '0%';
    this.elements.progressFill().style.background = 'var(--green)';
    this.elements.statHits().textContent = '0';
  },

  showTimer(seconds, remaining) {
    this.elements.timerContainer().style.display = 'block';
    this.elements.timerNumber().textContent = remaining;
    const pct = (remaining / seconds) * 100;
    this.elements.timerFill().style.width = pct + '%';
  },

  hideTimer() {
    this.elements.timerContainer().style.display = 'none';
  },

  lockFireBtn(seconds) {
    const btn = this.elements.fireBtn();
    btn.disabled = true;
    btn.classList.add('locked');
    btn.textContent = `LOCKED · ${seconds}s`;
  },

  updateFireBtnCountdown(remaining) {
    const btn = this.elements.fireBtn();
    btn.textContent = `LOCKED · ${remaining}s`;
  },

  unlockFireBtn() {
    const btn = this.elements.fireBtn();
    btn.disabled = false;
    btn.classList.remove('locked');
    btn.textContent = 'FIRE REQUEST →';
  },

  setFireBtnFiring() {
    const btn = this.elements.fireBtn();
    btn.disabled = true;
    btn.textContent = 'FIRING...';
  },

  appendLog(data, status, isBurst = false) {
    const log = this.elements.log();
    const empty = this.elements.logEmpty();
    if (empty) empty.style.display = 'none';

    const allowed = data.allowed;
    const entry = document.createElement('div');
    entry.className = `log-entry ${allowed ? '' : 'blocked'} ${isBurst ? 'burst' : ''}`;
    entry.innerHTML = `
      <span class="badge ${allowed ? 'allowed' : 'blocked'}">
        ${status} ${allowed ? '✓' : '✗'}
      </span>
      <span class="log-algo">${data.algorithm || ''}</span>
      <span class="log-detail">${data.remaining ?? '?'} left · reset ${data.reset_in ?? '?'}s</span>
      <span class="log-time">${new Date().toLocaleTimeString()}</span>
    `;
    log.prepend(entry);
    while (log.children.length > 30) log.removeChild(log.lastChild);
  },

  clearLog() {
    this.elements.log().innerHTML = '';
    this.elements.logEmpty().style.display = 'block';
  },

  showBurstResults(results) {
    const allowed = results.filter(r => r.data.allowed).length;
    const blocked = results.length - allowed;
    const entry = document.createElement('div');
    entry.className = 'log-entry burst-summary';
    entry.innerHTML = `
      <span class="badge allowed">BURST</span>
      <span class="log-detail">
        ${results.length} fired ·
        <span style="color:var(--green)">${allowed} allowed</span> ·
        <span style="color:var(--red)">${blocked} blocked</span>
      </span>
      <span class="log-time">${new Date().toLocaleTimeString()}</span>
    `;
    this.elements.log().prepend(entry);
  }
};