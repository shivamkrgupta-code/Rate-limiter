let currentAlgo = 'fixed-window';
let isFiring = false;

// Wake container on load
window.addEventListener('load', () => API.health());

function setAlgo(name) {
  currentAlgo = name;
  document.querySelectorAll('.algo-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('btn-' + name).classList.add('active');
  UI.setAlgoLabel(name);
  UI.resetStats();
  UI.clearLog();
  Timer.stop();
  UI.hideTimer();
  UI.unlockFireBtn();
}

async function fireRequest() {
  if (isFiring || Timer.isRunning()) return;
  isFiring = true;
  UI.setFireBtnFiring();

  try {
    const { status, data } = await API.fireRequest(currentAlgo);
    UI.updateStats(data);
    UI.incrementHits();
    UI.appendLog(data, status);

    if (!data.allowed) {
      const retryAfter = data.reset_in || 60;
      UI.lockFireBtn(retryAfter);
      Timer.start(
        retryAfter,
        (remaining, total) => {
          UI.showTimer(total, remaining);
          UI.updateFireBtnCountdown(remaining);
        },
        () => {
          UI.hideTimer();
          UI.unlockFireBtn();
          UI.resetStats();
        }
      );
    } else {
      UI.unlockFireBtn();
    }
  } catch (err) {
    UI.appendLog({ allowed: false, algorithm: currentAlgo, remaining: '?', reset_in: '?' }, 500);
    UI.unlockFireBtn();
  } finally {
    isFiring = false;
  }
}

async function burstFire() {
  if (isFiring || Timer.isRunning()) return;
  isFiring = true;

  const burstBtn = document.getElementById('burst-btn');
  burstBtn.disabled = true;
  burstBtn.textContent = 'BURSTING...';

  try {
    const results = await API.burst(currentAlgo, 10);
    // Show last result's stats as the final state
    const last = results[results.length - 1];
    UI.updateStats(last.data);
    UI.showBurstResults(results);
    results.forEach(r => UI.appendLog(r.data, r.status, true));
    UI.incrementHits();

    // Check if any resulted in 429
    const blocked = results.find(r => !r.data.allowed);
    if (blocked) {
      const retryAfter = blocked.data.reset_in || 60;
      UI.lockFireBtn(retryAfter);
      document.getElementById('fire-btn').disabled = true;
      Timer.start(
        retryAfter,
        (remaining, total) => {
          UI.showTimer(total, remaining);
          UI.updateFireBtnCountdown(remaining);
        },
        () => {
          UI.hideTimer();
          UI.unlockFireBtn();
          UI.resetStats();
        }
      );
    }
  } catch (err) {
    console.error('Burst failed:', err);
  } finally {
    isFiring = false;
    burstBtn.disabled = false;
    burstBtn.textContent = 'BURST ×10';
  }
}