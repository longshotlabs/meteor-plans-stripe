Package.describe({
  name: "aldeed:plans-stripe",
  summary: "Stripe service add-on for aldeed:plans package",
  version: "0.0.5",
  git: "https://github.com/aldeed/meteor-plans-stripe"
});

Npm.depends({ stripe: '4.12.0' });

Package.onUse(function(api) {
  api.use('underscore@1.0.1');
  api.use('check@1.0.3');
  api.use('templating@1.0.0');

  api.use('aldeed:plans@0.0.2');
  api.imply('aldeed:plans');

  api.addFiles([
    'head.html',
    'plans-stripe-client.js',
  ], 'client');
  api.addFiles('plans-stripe-server.js', 'server');
});

Package.onTest(function(api) {
  api.use('aldeed:plans-stripe');
  api.use('accounts-password');
  api.use('tracker');
  api.use('tinytest');

  api.addFiles('plans-stripe-tests.js', ['client', 'server']);
});
