/*
 * In this file we define the Stripe payment configuration for
 * using Stripe to purchase a defined plan, using Stripe Checkout
 * in a browser.
 *
 * App-level configuration:
 * 1. Ensure Meteor.settings.public.Stripe.publicKey is set
 * 2. Optionally set Meteor.settings.public.Stripe.rememberMe to true or false
 *
 */

var stripeCheckout;
var checkoutPlanName;
var addPlanCallback;
var checkoutAddOptions;

AppPlans.registerService('stripe', {
  pay: function (planName, options, addOptions, callback) {
    if (!options) {
      throw Error('payOptions are required either when defining a plan or when calling add/set');
    }

    // Check options
    check(options, {
      name: String,
      description: Match.Optional(String),
      amount: Number,
      email: Match.Optional(String),
      currency: Match.Optional(String),
      panelLabel: Match.Optional(String),
      zipCode: Match.Optional(Boolean),
      bitcoin: Match.Optional(Boolean)
    });

    // Add email if logged in
    if (!options.email) {
      var user = Meteor.user();
      if (user && user.emails && user.emails[0]) {
        options.email = user.emails[0].address;
      }
    }

    // Store the plan name locally so that we have access to
    // it in the stripe checkout `token` callback
    checkoutPlanName = planName;

    // Store the add options locally so that we have access to
    // it in the stripe checkout `token` callback
    checkoutAddOptions = addOptions;

    // Store the callback locally so that we can call it from
    // the stripe checkout `token` callback
    addPlanCallback = callback;

    // Open the stripe checkout modal and begin payment flow.
    // Use the options defined by the plan
    stripeCheckout.open(options);
  }
});

/*
 * Here we will create and configure the `stripeCheckout` object
 * immediately after we've loaded the app into the browser.
 */

// After all code is loaded in browser
Meteor.startup(function () {

  // If Stripe public key is configured in the Meteor settings JSON file
  if (Meteor.settings && Meteor.settings.public.Stripe && Meteor.settings.public.Stripe.publicKey) {

    // Configure Stripe Checkout
    // StripeCheckout is an object that is defined in the mrgalaxy:stripe package.
    // It simply exposes Stripe's checkout API documented here:
    // https://stripe.com/docs/checkout
    stripeCheckout = StripeCheckout.configure({
      key: Meteor.settings.public.Stripe.publicKey,
      // whether to put the 'remember me' checkbox on stripe form
      allowRememberMe: Meteor.settings.public.Stripe.rememberMe || false,
      token: function(token) {
        // Call the server-side function 'AppPlans/add' to create
        // a customer through the Stripe API, based on the token that resulted from
        // the payment form success.
        var options = _.extend(checkoutAddOptions || {}, {service: 'stripe', token: token.id, email: token.email});
        AppPlans.add(checkoutPlanName, options, function (error, result) {
          result = result && {added: result, email: token.email};
          addPlanCallback(error, result);
        });
      }
    });

  } // END if

}); // END Meteor.startup
