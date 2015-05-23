var Stripe;

AppPlans.registerService('stripe', {
  subscribe: function (options) {
    var customer, subscription, token, subscriptionId, customerId;

    if (options.customerId) {
      // Call the Stripe API to assign this customer
      // to an additional plan.
      try {
        subscription = Stripe.customers.createSubscriptionSync(
          options.customerId,
          {
            plan: options.plan
          }
        );
      } catch (error) {
        console.log(error.stack);
        throw new Error('AppPlans: There was a problem adding a subscription for Stripe customer: ' + error.message);
      }

      if (!subscription) {
        throw new Error('AppPlans: There was an unknown problem adding a subscription for Stripe customer');
      }

      subscriptionId = subscription.id;
      customerId = options.customerId;

    } else {
      token = options.token;

      if (!token) {
        throw new Error('AppPlans: A token is required when adding a subscription and an external customer has not yet been created.');
      }

      // Call the Stripe API to create a new customer
      // in their system and assign them to the plan.
      try {
        customer = Stripe.customers.createSync({
          email: token.email,
          plan: options.plan,
          source: token.id,
          metadata: {
            userId: options.userId
          }
        });
      } catch (error) {
        console.log(error.stack);
        throw new Error('AppPlans: There was a problem creating Stripe customer: ' + error.message);
      }

      if (!customer) {
        throw new Error('AppPlans: There was an unknown problem creating Stripe customer');
      }

      subscriptionId = customer.subscriptions.data[0].id;
      customerId = customer.id;
    }

    return {
      subscriptionId: subscriptionId,
      customerId: customerId
    };
  },
  unsubscribe: function (options) {

    // Call the Stripe API to cancel the plan for the user
    try {
      Stripe.customers.cancelSubscriptionSync(options.customerId, options.subscriptionId);
    } catch (error) {
      console.log(error.stack);
      throw new Meteor.Error('AppPlans: There was a problem canceling stripe subscription:', error.message);
    }
  },
  isSubscribed: function (options) {
    var result;

    // Call the Stripe API to check a plan for the user
    try {
      result = Stripe.customers.retrieveSubscriptionSync(options.customerId, options.subscriptionId);
    } catch (error) {
      console.log(error.stack);
      throw new Meteor.Error('AppPlans: There was a problem retrieving stripe subscription:', error.message);
    }

    return result && _.contains(['active', 'trialing'], result.status);
  },
  // NOTE THIS ONE IS NOT YET USED
  getExternalPlansStatus: function (options) {
    var result;

    // Call the Stripe API to get all plans for the user
    try {
      result = Stripe.customers.listSubscriptionsSync(options.customerId);
    } catch (error) {
      console.log(error.stack);
      throw new Meteor.Error('AppPlans: There was a problem listing stripe subscriptions:', error.message);
    }

    var list = result && result.data || [];
    var planHash = {};
    _.each(list, function (sub) {
      var planId = sub.plan.id;
      // If a plan is listed multiple times, we want to record `true`
      // if any of them have "active" status.
      if (!_.has(planHash, planId) || planHash[planId] === false) {
        planHash[planId] = (sub.status === 'active');
      }
    });

    return planHash;
  }
});

/*
 * Here we will create and configure the `Stripe` object
 * immediately after the Meteor server starts up
 */

// After the Meteor server starts up
Meteor.startup(function () {

  // If Stripe secret key is configured in the Meteor settings JSON file
  if (Meteor.settings.Stripe && Meteor.settings.Stripe.secretKey) {

    // Configure the Stripe server API
    // StripeAPI is an object that is defined in the mrgalaxy:stripe package.
    // It simply exposes Stripe's API documented here:
    // https://stripe.com/docs/checkout
    // It does this by wrapping a Node.js package
    Stripe = StripeAPI(Meteor.settings.Stripe.secretKey);

    // Make synchronous versions of the functions we need
    Stripe.customers.createSync =
      Meteor.wrapAsync(Stripe.customers.create, Stripe.customers);
    Stripe.customers.createSubscriptionSync =
      Meteor.wrapAsync(Stripe.customers.createSubscription, Stripe.customers);
    Stripe.customers.cancelSubscriptionSync =
      Meteor.wrapAsync(Stripe.customers.cancelSubscription, Stripe.customers);
    Stripe.customers.listSubscriptionsSync =
      Meteor.wrapAsync(Stripe.customers.listSubscriptions, Stripe.customers);
    Stripe.customers.retrieveSubscriptionSync =
      Meteor.wrapAsync(Stripe.customers.retrieveSubscription, Stripe.customers);


  } // END if

}); // END Meteor.startup
