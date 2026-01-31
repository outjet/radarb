(function registerTimeModule() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const { formatRelativeTime } = core;

  let lastRefreshTimestamp = Date.now();
  let isFirstRefresh = true;

  function initRefreshTimer() {
    updateRefreshTimer();
    setInterval(updateRefreshTimer, 30000);
  }

  function markRefresh() {
    lastRefreshTimestamp = Date.now();
    updateRefreshTimer();
  }

  function updateRefreshTimer() {
    const timerElement = document.getElementById('refresh-timer');
    if (!timerElement) return;
    const elapsedSeconds = Math.floor((Date.now() - lastRefreshTimestamp) / 1000);
    if (isFirstRefresh) {
      isFirstRefresh = false;
    }
    timerElement.textContent = formatRelativeTime(elapsedSeconds);
  }

  function updateTime() {
    const localTime = new Date().toLocaleString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    const timeEl = document.getElementById('local-time');
    if (timeEl) timeEl.textContent = localTime;
  }

  function initClock() {
    updateTime();
    setInterval(updateTime, 1000);
  }

  window.RADARB.modules.time = {
    initClock,
    initRefreshTimer,
    markRefresh,
  };
})();
