import { haversine } from "./haversine.js";

export async function getCameraData(latne, lngne, latsw, lngsw) {
  const response = await fetch(`https://us-central1-radarb.cloudfunctions.net/getCameraData?latne=${latne}&lngne=${lngne}&latsw=${latsw}&lngsw=${lngsw}`);
  return await response.json();
}

export function displayCameraData(data, userLat, userLng) {
  const cameraDistances = [];

  // Calculate the distance from the user's location to each camera
  data.results.forEach(camera => {
    const distance = haversine(userLat, userLng, camera.latitude, camera.longitude);
    cameraDistances.push({ camera, distance });
  });

  // Sort the cameras by their distance
  cameraDistances.sort((a, b) => a.distance - b.distance);

// Display the closest four cameras
const imageGrid = document.querySelector(".image-grid");
imageGrid.innerHTML = ""; // clear previous cameras
for (let i = 0; i < Math.min(4, cameraDistances.length); i++) {
  const camera = cameraDistances[i].camera;
  const div = document.createElement("div");
  const img = document.createElement("img");
  img.setAttribute("src", camera.cameraViews[0].smallUrl);
  img.setAttribute("alt", camera.description);
  const caption = document.createElement("div");
  caption.classList.add("caption");
  if (camera.cameraViews[0].mainRoute.includes("Hilliard")) {
    caption.textContent = 'I-90 between Hilliard/Mckinley';
  } else {
    caption.textContent = camera.cameraViews[0].mainRoute;
  }
  div.appendChild(img);
  div.appendChild(caption);
  imageGrid.appendChild(div);
}
};