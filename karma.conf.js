module.exports = function (config) {
  var customLaunchers = require('./test/browsers');

  var configuration = {
    frameworks: ['mocha', 'chai'],

    files: [
      'node_modules/jquery/dist/jquery.js',
      'node_modules/lodash/lodash.js',
      'node_modules/backbone/backbone.js',
      'node_modules/idb-wrapper/idbstore.js',
      'dist/backbone-dual-storage.js',
      'test/spec.js'
    ],

    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    reporters: ['mocha', 'saucelabs'],

    plugins: [
      'karma-mocha',
      'karma-chai',
      'karma-mocha-reporter',
      'karma-sauce-launcher'
    ],

    sauceLabs: {
      testName: 'Unit Tests',
      connectOptions: {
        port: 5757,
        logfile: 'sauce_connect.log'
      },
    },
    captureTimeout: 120000,
    customLaunchers: customLaunchers
  };

  if (process.env.TRAVIS) {
    configuration.browsers = Object.keys(customLaunchers);
    configuration.singleRun = true;
  }

  config.set(configuration);
};
