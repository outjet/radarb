(function registerMeteosModule() {
  window.RADARB = window.RADARB || {};
  window.RADARB.modules = window.RADARB.modules || {};

  const core = window.RADARB.modules.core || {};
  const { clearElement } = core;

  function loadMeteograms(lat, lng) {
    const meteosDiv = document.querySelector('.meteos');
    if (!meteosDiv || lat == null || lng == null) return;
    if (clearElement) clearElement(meteosDiv);

    const urlb =
      '&wfo=CLE&zcode=LEZ146&gset=20&gdiff=6&unit=0&tinfo=EY5&pcmd=10111110111110000000000000000000000000000000000000000000000&lg=en&indu=0!1!1!&dd=&bw=&hrspan=48&pqpfhr=6&psnwhr=6';
    const images = [
      {
        hour: 0,
        src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${lat}&lon=${lng}&ahour=0${urlb}`,
      },
      {
        hour: 48,
        src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${lat}&lon=${lng}&ahour=48${urlb}`,
      },
      {
        hour: 96,
        src: `https://marine.weather.gov/meteograms/Plotter.php?lat=${lat}&lon=${lng}&ahour=96${urlb}`,
      },
    ];

    images.forEach((image) => {
      const img = document.createElement('img');
      img.setAttribute('src', image.src);
      img.setAttribute('alt', `Meteogram for ${image.hour} hours`);
      img.classList.add('meteogram-image');
      meteosDiv.appendChild(img);
    });
  }

  function initMeteograms(lat, lng) {
    setTimeout(() => loadMeteograms(lat, lng), 3000);
  }

  window.RADARB.modules.meteos = {
    initMeteograms,
  };
})();
