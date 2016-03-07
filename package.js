Package.describe({
  name: "aldeed:plans-stripe",
  summary: "Stripe service add-on for aldeed:plans package",
  version: "0.0.3",
  git: "https://github.com/aldeed/meteor-plans-stripe"
});

Package.onUse(function(api) {
  api.use('underscore@1.0.1');
  api.use('check');
  
  api.use('aldeed:plans@0.0.1');
  api.imply('aldeed:plans');
  api.use('mrgalaxy:stripe@2.2.2');

  api.addFiles('plans-stripe-client.js', 'client');
  api.addFiles('plans-stripe-server.js', 'server');
});

Package.onTest(function(api) {
  api.use('aldeed:plans-stripe');
  api.use('accounts-password');
  api.use('tracker');
  api.use('tinytest');

  api.addFiles('plans-stripe-tests.js', ['client', 'server']);
});
