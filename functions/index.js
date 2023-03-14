// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
const functions = require('firebase-functions');

const fetch = require('node-fetch');
// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const client = new SecretManagerServiceClient();

const axios = require('axios');
const cors = require('cors')({ origin: true });

exports.getCameraData = functions.https.onRequest(async (req, res) => {
  const [version] = await client.accessSecretVersion({
    name: 'projects/358874041676/secrets/ohgo-api/versions/latest',
  });
  const ohgoApiKey = version.payload.data.toString();
  cors(req, res, async () => {
    try {
      const latsw = req.query.latsw;
      const lngsw = req.query.lngsw;
      const latne = req.query.latne;
      const lngne = req.query.lngne;

      const API_URL = `https://publicapi.ohgo.com/api/v1/cameras?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;

      const response = await axios.get(API_URL, {
        headers: {
          "Authorization": `APIKEY ${ohgoApiKey}`
        }
      });

      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
      res.send(response.data);
      console.log(`ohGoAPI is: ${ohgoApiKey} and response is ${response.data}`);
    } catch (error) {
      res.status(500).send({ error: "Error retrieving data" });
    }
  });
});


exports.getSensorData = functions.https.onRequest(async (req, res) => {
  const [version] = await client.accessSecretVersion({
    name: 'projects/358874041676/secrets/ohgo-api/versions/latest',
  });
  const ohgoApiKey = version.payload.data.toString();
  const latsw = req.query.latsw;
  const lngsw = req.query.lngsw;
  const latne = req.query.latne;
  const lngne = req.query.lngne;
  
  const API_URL = `https://publicapi.ohgo.com/api/v1/weather-sensor-sites?map-bounds-sw=${latsw},${lngsw}&map-bounds-ne=${latne},${lngne}`;
  const API_KEY = `APIKEY ${ohgoApiKey}`;

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

exports.getFlightDelays = functions.https.onRequest(async (req, res) => {
  const [version] = await client.accessSecretVersion({
    name: 'projects/358874041676/secrets/aeroapi/versions/latest',
  });
  const aeroApiKey = version.payload.data.toString();
  cors(req, res, () => {
    res.set("Access-Control-Allow-Origin", "*");
    if (req.method === "OPTIONS") {
      res.set("Access-Control-Allow-Methods", "GET");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.status(204).send("");
    } else {
      const airportCode = req.query.airportCode;
      const apiUrl = `https://aeroapi.flightaware.com/aeroapi/airports/delays?airport_code=${airportCode}`;
      const headers = {
        'x-apikey': aeroApiKey
      };

      axios.get(apiUrl, { headers })
        .then(response => response.data)
        .then(data => {
          const delays = data.delays.filter(delay => delay.airport === airportCode);
          if (delays.length > 0) {
            const delayReasons = delays.map(delay => delay.reasons.map(reason => reason.reason)).flat();
            res.status(200).send(delayReasons.join(" | "));
          } else {
            res.status(200).send("");
          }
        })
        .catch(error => {
          console.error(error);
          res.status(500).send("Error retrieving flight delays.");
        });
    }
  });
});

exports.getGroundStopInfo = functions.https.onRequest((req, res) => {
  cors(req, res, () => {
    res.set("Access-Control-Allow-Origin", "*");
    const apiUrl =
      "https://soa.smext.faa.gov/asws/api/airport/status/cle"; 
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    axios.get(apiUrl)
      .then((response) => {
        const data = response.data;
        if (!data.Delay && data.Status[0].Reason === "No known delays for this airport") {
          res.set('Access-Control-Allow-Origin', '*');
          res.status(200).send("");
        } else {
          res.set('Access-Control-Allow-Origin', '*');
          res.status(200).send(data.Status);
        }
      })
      .catch((error) => {
        console.error("Error fetching ground stop information", error);
        res.status(500).send("Error fetching ground stop information");
      });
  });
});

exports.getCityName = functions.https.onRequest(async (req, res) => {
  cors(req, res, async () => {
    try {
      const [version] = await client.accessSecretVersion({
        name: 'projects/358874041676/secrets/google-maps-api/versions/latest',
      });

      const apiKey = version.payload.data.toString();

      const lat = req.query.lat;
      const lng = req.query.lng;

      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

      const response = await fetch(url);
      const data = await response.json();

      const addressComponents = data.results[0].address_components;
      const formattedAddress = data.results[0].formatted_address;
      // const locationType = data.results[0].geometry.location_type;
      const premiseType = data.results[0].types[0];

      res.set('Access-Control-Allow-Origin', '*');
      res.send({
        address: formattedAddress,
        premiseType: premiseType,
        address_components: addressComponents,
      });
    } catch (error) {
      console.error(error);
      res.status(500).send('Error retrieving city name.');
    }
  });
});

