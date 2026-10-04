// How often the clock is read. The time left comes from the deadline, not from
// counting ticks, so a throttled background tab shows the right time when it
// wakes. Reading four times a second keeps the shown second from lagging. The
// clock is `performance.now()`, which never goes back, so a changed system
// time can't lengthen the wait.
const TICK_MS = 250;

// A countdown in whole seconds, for a hint such as "Send a new code in 0:42"
// (#255). It only tells time: whatever it hints at is gated by the server.
// `start` is for the browser; on the server nothing ticks.
export class Countdown {
  // Whole seconds left, rounded up, so it reads 0 only once the time is up.
  remaining = $state(0);
  // The length of the countdown last started. It does not tick, so a screen
  // reader announcement built from it changes only when a countdown starts.
  total = $state(0);
  // True once a countdown that was started has run out.
  finished = $state(false);

  #deadline = 0;
  #timer: ReturnType<typeof setInterval> | undefined;

  // Counts down from `seconds`, replacing any countdown running. Zero or less
  // just stops it.
  start(seconds: number) {
    this.stop();
    this.total = Math.max(0, seconds);
    this.remaining = this.total;
    this.finished = false;
    if (this.total === 0) return;
    this.#deadline = performance.now() + this.total * 1000;
    this.#timer = setInterval(() => this.#tick(), TICK_MS);
  }

  stop() {
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  #tick() {
    this.remaining = Math.max(0, Math.ceil((this.#deadline - performance.now()) / 1000));
    if (this.remaining === 0) {
      this.stop();
      this.finished = true;
    }
  }
}

// 42 → "0:42", 60 → "1:00".
export function formatClock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
