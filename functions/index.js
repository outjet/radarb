// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');
// const { googleMapsApiKey } = require('../config');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();


// const functions = require("firebase-functions");
const axios = require('axios');
const cors = require('cors')({ origin: true });

exports.getCameraData = functions.https.onRequest(async (req, res) => {
  const API_KEY = "APIKEY 756bfc1c-746a-4a04-bc43-6c05521180e8";

  cors(req, res, async () => {
    try {
      const latsw = req.query.latsw;
      const lngsw = req.query.lngsw;
      const latne = req.query.latne;
      const lngne = req.query.lngne;

      const API_URL = `https://publicapi.ohgo.com/api/v1/cameras?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;

      const response = await axios.get(API_URL, {
        headers: {
          "Authorization": API_KEY
        }
      });

      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.send(response.data);
    } catch (error) {
      res.status(500).send({ error: "Error retrieving data" });
    }
  });
});


exports.getSensorData = functions.https.onRequest(async (req, res) => {
  const latsw = req.query.latsw;
  const lngsw = req.query.lngsw;
  const latne = req.query.latne;
  const lngne = req.query.lngne;
  
  const API_URL = `https://publicapi.ohgo.com/api/v1/weather-sensor-sites?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;
  const API_KEY = "APIKEY 756bfc1c-746a-4a04-bc43-6c05521180e8";

  cors(req, res, async () => {
    try {
      const response = await axios.get(API_URL, {
        headers: {
          "Authorization": API_KEY
        }
      });


      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.send(response.data);
    } catch (error) {
      res.status(500).send({error: "Error retrieving data"});
    }
  });
});


// exports.geocode = functions.https.onCall(async (data, context) => {
//   const { lat, lng } = data;
//   const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${googleMapsApiKey}`;
//   const response = await fetch(url);
//   const json = await response.json();
//   return json.results[0].formatted_address;
// });