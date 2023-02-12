// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();


// const functions = require("firebase-functions");
const axios = require('axios');
const cors = require('cors')({ origin: true });

exports.getCameraData = functions.https.onRequest(async (req, res) => {
  const API_URL = "https://publicapi.ohgo.com/api/v1/cameras?map-bounds-sw=41.46,-81.83&map-bounds-ne=41.49,-81.75";
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
      res.status(500).send({ error: "Error retrieving data" });
    }
  });
});

exports.getSensorData = functions.https.onRequest(async (req, res) => {
  const API_URL = "https://publicapi.ohgo.com/api/v1/weather-sensor-sites?map-bounds-sw=41.213,-81.9&map-bounds-ne=41.506,-81.69";
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