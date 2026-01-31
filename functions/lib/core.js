const admin = require('firebase-admin');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

admin.initializeApp();
let secretClient = new SecretManagerServiceClient();
const secretCache = new Map();

async function getSecret(secretName) {
  if (secretCache.has(secretName)) return secretCache.get(secretName);
  const [version] = await secretClient.accessSecretVersion({ name: secretName });
  const secretValue = version.payload.data.toString();
  secretCache.set(secretName, secretValue);
  return secretValue;
}

function setSecretClient(client) {
  secretClient = client;
}

function clearSecretCache() {
  secretCache.clear();
}

function handleCors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

module.exports = {
  getSecret,
  handleCors,
  __test__: {
    setSecretClient,
    clearSecretCache,
  },
};
