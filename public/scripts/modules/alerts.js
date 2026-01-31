(function registerAlertsModule() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const { fetchWithTimeout, updateAlertsVisibility } = core;

  let endpoints = null;

  function configure(options = {}) {
    endpoints = options.endpoints || endpoints;
  }

  function initFlightDelays(airportCode = 'KCLE') {
    if (!endpoints || !fetchWithTimeout) return;
    checkFlightDelays(airportCode);
  }

  function checkFlightDelays(airportCode) {
    if (!endpoints || !fetchWithTimeout) return;
    fetchWithTimeout(`${endpoints.flightDelaysUrl}?airportCode=${airportCode}`, {}, 8000)
      .then((response) => response.text())
      .then((data) => {
        const airportDelays = document.querySelector('.airportDelays');
        const delaysContainer = document.querySelector('.delays-container');
        if (!airportDelays || !delaysContainer) return;
        const trimmed = (data || '').trim();
        if (!trimmed) {
          delaysContainer.style.display = 'none';
          if (updateAlertsVisibility) updateAlertsVisibility();
          return;
        }
        airportDelays.textContent = `✈ ${trimmed}`;
        delaysContainer.style.display = 'block';
        if (updateAlertsVisibility) updateAlertsVisibility();
      })
      .catch((error) => console.error('Error fetching flight delays:', error));
  }

  window.RADARB.modules.alerts = {
    configure,
    initFlightDelays,
    checkFlightDelays,
  };
})();
