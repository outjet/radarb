const functions = require('firebase-functions');

const ohgo = require('./lib/handlers/ohgo');
const closings = require('./lib/handlers/closings');
const flight = require('./lib/handlers/flight');
const weather = require('./lib/handlers/weather');
const dwml = require('./lib/handlers/dwml');
const pivotal = require('./lib/handlers/pivotal');
const radar = require('./lib/handlers/radar');

exports.getCameraDatav2 = functions.https.onRequest(ohgo.getCameraDatav2);
exports.getSensorDatav2 = functions.https.onRequest(ohgo.getSensorDatav2);
exports.getOhgoIncidentsv1 = functions.https.onRequest(ohgo.getOhgoIncidentsv1);

exports.getSchoolClosingsv1 = functions.https.onRequest(closings.getSchoolClosingsv1);

exports.getFlightDelaysv2 = functions.https.onRequest(flight.getFlightDelaysv2);
exports.getGroundStopInfov2 = functions.https.onRequest(flight.getGroundStopInfov2);
exports.getCityNamev2 = functions.https.onRequest(flight.getCityNamev2);

exports.getWeatherDatav2 = functions.https.onRequest(weather.getWeatherDatav2);
exports.getAmbientWeatherDatav2 = functions.https.onRequest(weather.getAmbientWeatherDatav2);

exports.getNdfdSnowv1 = functions.https.onRequest(dwml.getNdfdSnowv1);
exports.getDwmlForecastv1 = functions.https.onRequest(dwml.getDwmlForecastv1);
exports.getTwilightTimesv1 = functions.https.onRequest(dwml.getTwilightTimesv1);

exports.grabPivotalHRRR6hQPFv2 = functions.https.onRequest(pivotal.grabPivotalHRRR6hQPFv2);

exports.getRadarProxyv1 = functions.https.onRequest(radar.getRadarProxyv1);
