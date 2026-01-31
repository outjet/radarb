(function registerClosingsModule() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const { fetchWithTimeout, clearElement, updateAlertsVisibility } = core;

  let endpoints = null;

  function configure(options = {}) {
    endpoints = options.endpoints || endpoints;
  }

  function loadClosings() {
    const container = document.querySelector('.closures-container');
    if (!container || !endpoints || !fetchWithTimeout) return;

    if (!isClosingsSeason()) {
      container.classList.remove('is-active');
      if (updateAlertsVisibility) updateAlertsVisibility();
      return;
    }

    const cached = getCachedClosings();
    if (cached) {
      renderClosings(cached, container);
    }

    fetchWithTimeout(endpoints.closingsUrl, {}, 8000)
      .then((response) => {
        if (response.status === 204) return null;
        return response.json();
      })
      .then((data) => {
        if (!data) return;
        cacheClosings(data);
        renderClosings(data, container);
      })
      .catch((error) => console.error('Error fetching closings:', error));
  }

  function renderClosings(data, container) {
    if (!data || !container || !data.match) {
      clearElement(container);
      container.classList.remove('is-active');
      if (updateAlertsVisibility) updateAlertsVisibility();
      return;
    }
    if (!isClosureStatus(data.match.status)) {
      clearElement(container);
      container.classList.remove('is-active');
      if (updateAlertsVisibility) updateAlertsVisibility();
      return;
    }
    clearElement(container);
    const title = document.createElement('div');
    title.className = 'closure-title';
    title.textContent = 'School Closings';
    container.appendChild(title);

    const status = document.createElement('div');
    status.className = 'closure-status';
    status.textContent = `${data.match.name}: ${data.match.status}`;
    container.appendChild(status);

    container.classList.add('is-active');
    if (updateAlertsVisibility) updateAlertsVisibility();
  }

  function cacheClosings(data) {
    try {
      localStorage.setItem('closingsCache', JSON.stringify({ data, cachedAt: Date.now() }));
    } catch (error) {
      console.warn('Closings cache write failed:', error);
    }
  }

  function getCachedClosings() {
    try {
      const raw = localStorage.getItem('closingsCache');
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (!payload || !payload.data) return null;
      if (Date.now() - payload.cachedAt > 10 * 60 * 1000) return null;
      return payload.data;
    } catch (error) {
      return null;
    }
  }

  function isClosureStatus(status) {
    const normalized = String(status || '').toLowerCase();
    return (
      normalized.includes('closed') ||
      normalized.includes('virtual') ||
      normalized.includes('remote')
    );
  }

  function isClosingsSeason() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(now);
    const month = Number(parts.find((part) => part.type === 'month')?.value || 0);
    const day = Number(parts.find((part) => part.type === 'day')?.value || 0);
    const isBetweenApr15AndDec1 =
      (month > 4 || (month === 4 && day >= 15)) && (month < 12 || (month === 12 && day <= 1));
    return !isBetweenApr15AndDec1;
  }

  window.RADARB.modules.closings = {
    configure,
    loadClosings,
  };
})();
