(function registerMediaModule() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const { seedRadarProxyImages } = core;

  let cameraRefreshIntervalId = null;
  let radarRefreshIntervalId = null;
  let slowRefreshIntervalId = null;

  function refreshImagesWithClass(className) {
    const images = document.querySelectorAll(`img.${className}`);
    images.forEach((img) => {
      if (img.dataset.refreshing === 'true') return;
      const currentSrc = img.getAttribute('src');
      const cleanedSrc = currentSrc
        ? currentSrc.replace(/([?&])t=\d+(&?)/, (match, sep, trailing) => (trailing ? sep : ''))
        : null;
      const baseSrc = img.dataset.baseSrc || cleanedSrc;
      if (!baseSrc) return;
      img.dataset.baseSrc = baseSrc;
      img.dataset.refreshing = 'true';
      const timeoutId = setTimeout(() => {
        img.dataset.refreshing = '';
      }, 15000);
      const cleanup = () => {
        clearTimeout(timeoutId);
        img.dataset.refreshing = '';
      };
      img.addEventListener('load', cleanup, { once: true });
      img.addEventListener('error', cleanup, { once: true });
      img.src = `${baseSrc}?t=${Date.now()}`;
    });
  }

  function refreshCameraImages() {
    refreshImagesWithClass('camera-refresh');
  }

  function refreshRadarImages() {
    refreshImagesWithClass('radar-refresh');
  }

  function refreshSlowImages() {
    refreshImagesWithClass('slow-refresh');
  }

  function startImageRefreshers() {
    clearInterval(cameraRefreshIntervalId);
    clearInterval(radarRefreshIntervalId);
    clearInterval(slowRefreshIntervalId);

    if (document.hidden) return;

    refreshCameraImages();
    refreshRadarImages();
    refreshSlowImages();

    cameraRefreshIntervalId = setInterval(refreshCameraImages, 6000);
    radarRefreshIntervalId = setInterval(refreshRadarImages, 3 * 60 * 1000);
    slowRefreshIntervalId = setInterval(refreshSlowImages, 60 * 60 * 1000);
  }

  function deferMediaLoad() {
    const run = () => {
      const placeholders = document.querySelectorAll('.defer-media[data-src]');
      if (!placeholders.length) {
        startImageRefreshers();
        return;
      }
      placeholders.forEach((img) => {
        img.setAttribute('src', img.getAttribute('data-src'));
        img.removeAttribute('data-src');
        img.addEventListener(
          'load',
          () => {
            const panel = img.closest('.panel-loading');
            if (panel) {
              const pending = panel.querySelectorAll('.defer-media[data-src]').length;
              if (pending === 0) panel.classList.remove('panel-loading');
            }
          },
          { once: true }
        );
      });
      startImageRefreshers();
    };

    if ('requestIdleCallback' in window) {
      requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 800);
    }
  }

  function initMediaRefreshers() {
    if (seedRadarProxyImages) seedRadarProxyImages();
    deferMediaLoad();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearInterval(cameraRefreshIntervalId);
      clearInterval(radarRefreshIntervalId);
      clearInterval(slowRefreshIntervalId);
      return;
    }
    startImageRefreshers();
  });

  window.addEventListener('resumeImageRefresh', startImageRefreshers);

  window.RADARB.modules.media = {
    initMediaRefreshers,
    startImageRefreshers,
    refreshImagesWithClass,
  };
})();
