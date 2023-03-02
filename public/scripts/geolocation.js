export function getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          position => resolve(position),
          error => reject(error),
          { timeout: 10000 }
        );
      } else {
        reject(new Error("Geolocation is not supported by this browser."));
      }
    });
  }
  