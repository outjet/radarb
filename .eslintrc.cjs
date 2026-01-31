module.exports = {
  root: true,
  env: {
    es2022: true
  },
  extends: ['eslint:recommended', 'prettier'],
  ignorePatterns: [
    'node_modules/',
    '.firebase/',
    '.gemini-clipboard/',
    'public/ab/',
    'public/scripts/old-app.js',
    'docs/',
    'google-cloud-sdk/',
    'firepit-log.txt'
  ],
  overrides: [
    {
      files: ['functions/**/*.js'],
      env: { node: true },
      parserOptions: { ecmaVersion: 2022, sourceType: 'script' }
    },
    {
      files: ['public/scripts/**/*.js'],
      env: { browser: true },
      globals: {
        Chart: 'readonly'
      },
      parserOptions: { ecmaVersion: 2022, sourceType: 'script' }
    }
  ]
};
