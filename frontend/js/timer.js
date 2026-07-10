const Timer = {
  _interval: null,

  start(seconds, onTick, onComplete) {
    this.stop();
    let remaining = seconds;
    onTick(remaining, seconds);

    this._interval = setInterval(() => {
      remaining -= 1;
      onTick(remaining, seconds);
      if (remaining <= 0) {
        this.stop();
        onComplete();
      }
    }, 1000);
  },

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  },

  isRunning() {
    return this._interval !== null;
  }
};