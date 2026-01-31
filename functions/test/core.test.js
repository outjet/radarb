const test = require('node:test');
const assert = require('node:assert/strict');

const { getSecret, __test__ } = require('../lib/core');

test('getSecret memoizes secrets by name', async () => {
  let calls = 0;
  __test__.setSecretClient({
    accessSecretVersion: async ({ name }) => {
      calls += 1;
      return [
        {
          payload: {
            data: Buffer.from(`value-for-${name}`),
          },
        },
      ];
    },
  });
  __test__.clearSecretCache();

  const first = await getSecret('projects/demo/secrets/alpha/versions/latest');
  const second = await getSecret('projects/demo/secrets/alpha/versions/latest');

  assert.equal(first, 'value-for-projects/demo/secrets/alpha/versions/latest');
  assert.equal(second, first);
  assert.equal(calls, 1);
});

test('getSecret caches each secret independently', async () => {
  let calls = 0;
  __test__.setSecretClient({
    accessSecretVersion: async ({ name }) => {
      calls += 1;
      return [
        {
          payload: {
            data: Buffer.from(`value-for-${name}`),
          },
        },
      ];
    },
  });
  __test__.clearSecretCache();

  const first = await getSecret('projects/demo/secrets/alpha/versions/latest');
  const second = await getSecret('projects/demo/secrets/beta/versions/latest');

  assert.equal(first, 'value-for-projects/demo/secrets/alpha/versions/latest');
  assert.equal(second, 'value-for-projects/demo/secrets/beta/versions/latest');
  assert.equal(calls, 2);
});
