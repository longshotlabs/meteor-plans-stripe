var stripeAPI = Npm.require('stripe');
var Stripe;

AppPlans.registerService('stripe', {
  /**
   * {String} options.customerId: Provided if the user already has customer record in Stripe
   * {String} options.plan: Plan name
   * {String} options.token: Payment token from the client. Needed if there is no customerId
   * {String} options.email: Email address. Needed if no customerId
   * {String} options.userId: User ID. Needed if no customerId
   */
  subscribe: function (options) {
    var customer, subscription, subscriptionId, customerId;

    if (options.customerId) {
      // If Stripe already has an active subscription for this customer+plan,
      // use that. We can update it with same plan name and quantity 1, and that
      // will turn off any "end of cycle" cancellation that might have been
      // scheduled by calling "unsubscribe".
      var subscriptionList;
      try {
        subscriptionList = Stripe.subscriptions.listSync({
          customer: options.customerId,
          plan: options.plan,
        });
      } catch (error) {
        throw new Error('AppPlans: There was a problem listing subscriptions for Stripe customer: ' + error.message);
      }

      subscription = subscriptionList.data && subscriptionList.data[0];
      if (subscription) {
        try {
          Stripe.subscriptions.updateSync(subscription.id, {
            plan: options.plan,
            quantity: 1,
          });
        } catch (error) {
          throw new Error('AppPlans: There was a problem updating a subscription for Stripe customer: ' + error.message);
        }
      } else {
        // Call the Stripe API to assign this customer
        // to an additional plan.
        try {
          subscription = Stripe.subscriptions.createSync({
            customer: options.customerId,
            plan: options.plan,
          });
        } catch (error) {
          throw new Error('AppPlans: There was a problem adding a subscription for Stripe customer: ' + error.message);
        }
      }

      if (!subscription) {
        throw new Error('AppPlans: There was an unknown problem adding a subscription for Stripe customer');
      }

      subscriptionId = subscription.id;
      customerId = options.customerId;

    } else {

      if (!options.token) {
        throw new Error('AppPlans: A token is required when adding a subscription and an external customer has not yet been created.');
      }

      // Call the Stripe API to create a new customer
      // in their system and assign them to the plan.
      try {
        customer = Stripe.customers.createSync({
          email: options.email,
          plan: options.plan,
          source: options.token,
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
    // XXX To cancel immediately and refund, could change quantity to 0
    var date;
    try {
      var result = Stripe.subscriptions.delSync(options.subscriptionId, { at_period_end: true });
      if (result.cancel_at_period_end && result.current_period_end) {
        date = new Date(result.current_period_end * 1000);
      }
    } catch (error) {
      if (
        error.message.indexOf('does not have a subscription with ID') === -1 &&
        error.message.indexOf('No such subscription') === -1
      ) {
        throw new Meteor.Error('AppPlans: There was a problem canceling stripe subscription:', error.message);
      }
    }

    // We return the date at which the cancelation will happen
    return date;
  },
  isSubscribed: function (options) {
    var result;

    if (!options.subscriptionId) return false;

    // Call the Stripe API to check a plan for the user
    try {
      result = Stripe.subscriptions.retrieveSync(options.subscriptionId);
    } catch (error) {
      if (
        error.message.indexOf('does not have a subscription with ID') === -1 &&
        error.message.indexOf('No such subscription') === -1
      ) {
        throw new Meteor.Error('AppPlans: There was a problem retrieving stripe subscription:', error.message);
      }
      return false;
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
    Stripe = stripeAPI(Meteor.settings.Stripe.secretKey);

    // Make synchronous versions of the functions we need
    Stripe.customers.createSync =
      Meteor.wrapAsync(Stripe.customers.create, Stripe.customers);
    Stripe.subscriptions.createSync =
      Meteor.wrapAsync(Stripe.subscriptions.create, Stripe.subscriptions);
    Stripe.subscriptions.delSync =
      Meteor.wrapAsync(Stripe.subscriptions.del, Stripe.subscriptions);
    Stripe.customers.listSubscriptionsSync =
      Meteor.wrapAsync(Stripe.customers.listSubscriptions, Stripe.customers);
    Stripe.subscriptions.retrieveSync =
      Meteor.wrapAsync(Stripe.subscriptions.retrieve, Stripe.subscriptions);
    Stripe.subscriptions.listSync =
      Meteor.wrapAsync(Stripe.subscriptions.list, Stripe.subscriptions);
    Stripe.subscriptions.updateSync =
      Meteor.wrapAsync(Stripe.subscriptions.update, Stripe.subscriptions);

  } // END if

}); // END Meteor.startup
