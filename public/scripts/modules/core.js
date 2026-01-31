(function registerRadarbCore() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
  }

  function seedRadarProxyImages() {
    const proxyUrl = window.RADARB_CONFIG?.endpoints?.radarProxyUrl;
    if (!proxyUrl) return;
    document.querySelectorAll('img[data-radar-source]').forEach((img) => {
      if (img.getAttribute('data-src')) return;
      const source = img.getAttribute('data-radar-source');
      if (!source) return;
      const proxied = `${proxyUrl}?url=${encodeURIComponent(source)}`;
      img.setAttribute('data-src', proxied);
    });
  }

  function clearElement(element) {
    if (!element) return;
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  }

  function cleanupLegacyForecastCache() {
    try {
      localStorage.removeItem('forecastHtml');
      localStorage.removeItem('forecastHtmlTime');
    } catch (error) {
      console.warn('Forecast cache cleanup failed:', error);
    }
  }

  function appendLine(element, text, className) {
    const line = document.createElement('div');
    if (className) line.className = className;
    line.textContent = text;
    element.appendChild(line);
    return line;
  }

  function appendLink(element, text, href) {
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = text;
    element.appendChild(link);
    return link;
  }

  function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  function formatRelativeTime(seconds) {
    if (seconds < 45) return 'just now';
    const minutes = Math.round(seconds / 60);
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.round(minutes / 60);
    if (hours === 1) return '1 hour ago';
    return `${hours} hours ago`;
  }

  function updateAlertsVisibility() {
    const alertsContainer = document.querySelector('.alerts-container');
    if (!alertsContainer) return;
    const hasDelay = Boolean(document.querySelector('.airportDelays')?.textContent.trim());
    const hasGround = Boolean(document.querySelector('.ground-stops')?.textContent.trim());
    const hasCrosswind = Boolean(document.querySelector('.crosswindAlert')?.textContent.trim());
    const hasHazards = Boolean(document.querySelector('.hazards-container')?.children.length);
    const hasClosings = Boolean(document.querySelector('.closures-container')?.textContent.trim());
    const hasIncidents = Boolean(
      document.querySelector('.incidents-container')?.textContent.trim()
    );

    if (hasDelay || hasGround || hasCrosswind || hasHazards || hasClosings || hasIncidents) {
      alertsContainer.classList.add('is-active');
    } else {
      alertsContainer.classList.remove('is-active');
    }
  }

  window.RADARB.modules.core = {
    fetchWithTimeout,
    seedRadarProxyImages,
    clearElement,
    cleanupLegacyForecastCache,
    appendLine,
    appendLink,
    haversine,
    toRadians,
    formatRelativeTime,
    updateAlertsVisibility,
  };
})();
