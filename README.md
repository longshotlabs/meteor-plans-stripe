aldeed:plans-stripe
===============

Stripe service add-on for aldeed:plans package.

STATUS: USE AT YOUR OWN RISK. STILL IN DEVELOPMENT

## Installation

In your Meteor app directory:

```bash
$ meteor add aldeed:plans-stripe
```

If you have a `mobile-config` file for Cordova, add this:

```js
App.accessRule("https://*.stripe.com/*");
```

## Example

Let's imagine a case where your app has three plan levels: bronze, silver, and gold. All new users are assigned to the free bronze plan when they register. They may upgrade and downgrade at will.

In our example, our users always have exactly one plan (which includes the features of other plans), so we use the `get` and `set` methods rather than `add` and `remove`.

### Step 1: Create the plans in Stripe

First we will create the plans in stripe, setting the price. We won't create a Stripe plan for "bronze" because it does not require payment, but we'll create one plan with ID "silver" and one with ID "gold".

*Tip: Create test and live plans with the same IDs and make sure all the plan details match.*

### Step 2: Define the plans in your app

In the app, we simply need to define each plan, indicating which Stripe plan it is linked with.

In common code:

```js
AppPlans.define('bronze');

AppPlans.define('silver', {
  services: [
    {
      name: 'stripe', // External plan is on Stripe
      planName: 'silver', // External plan ID is "silver"
      // Options for the Stripe Checkout flow on the client
      payOptions: {
        name: 'Silver Plan',
        description: 'Only $5.00/month',
        amount: 500
      }
    }
  ],
  includedPlans: ['bronze']
});

AppPlans.define('gold', {
  services: [
    {
      name: 'stripe', // External plan is on Stripe
      planName: 'gold', // External plan ID is "silver"
      // Options for the Stripe Checkout flow on the client
      payOptions: {
        name: 'Gold Plan',
        description: 'Only $10.00/month',
        amount: 1000
      }
    }
  ],
  includedPlans: ['bronze, silver']
});
```

The full list of possible `payOptions` for Stripe is:

```js
{
  name: String,
  description: String,
  amount: Number,
  email: Match.Optional(String),
  currency: Match.Optional(String),
  panelLabel: Match.Optional(String),
  zipCode: Match.Optional(Boolean),
  bitcoin: Match.Optional(Boolean)
}
```

If you want a "Remember Me" check box on the Stripe Checkout form, set `Meteor.settings.public.Stripe.rememberMe` to `true`.

### Step 3: Add Stripe credentials to your app

In order to call the Stripe API, this package needs your credentials. Set these in Meteor.settings:

```
{
  "public" : {
    "Stripe" : {
      "publicKey" : "pk_test_5AqRfe1NSDIFUETngWikN3ODm",
    }
  },
  "Stripe" : {
    "secretKey" : "sk_test_LnDJKqZY87FDIOBTmbratiz3M"
  }
}
```

*NOTE: Example keys above are fake. Find your real keys by logging into your Stripe account. Be sure to use your test keys when testing.*

### Step 4: Assign the default plan for new users

In server code:

```js
Accounts.onLogin(function (info) {
  var userId = info.user._id;
  var plan = AppPlans.get({userId: userId});
  if (!plan) {
    AppPlans.set('bronze', {userId: userId});
  }
});
```

No token, customer, or payment info is needed when calling `AppPlans.set('bronze')` because we haven't linked that plan with a Stripe plan.

*NOTE: We use `onLogin` because there is not a hook that runs after user creation.*

### Step 5: Add a plans page where users can change their plans

We'll now add a page with buttons to change your plan. We can use `{{AppPlans.listDefined}}` to get the list of all our plans and `{{AppPlans.get}}` (reactive) to see which plan the user currently has. `{{#if AppPlans.hasAccess 'silver'}}` (reactive) will tell us whether the current user has a plan that includes the features of the "silver" plan (i.e., either the "silver" plan or the "gold" plan).

When the user clicks a button to choose a plan, we set the plan in the click handler:

```js
AppPlans.set('silver', function (error) {
  if (error) {
    console.log(error);
    alert('Sorry, there was a problem signing you up for this plan.');
  }
});
```

When the button is clicked, the plans package will check to see whether we already have a Stripe customer ID with stored payment information for the current user. If so, the app plan and the corresponding Stripe subscription will be changed automatically. If not, the Stripe Checkout payment flow will be shown, allowing the user to enter their credit card information. Once we have a valid payment authorization, the user's app plan and Stripe subscription will be updated.

Note that you can pass override pay options when calling `AppPlans.set`:

```js
AppPlans.set('silver', {payOptions: myOverrideOptions});
```

### Step 6: Ensure our plan stays in sync with the Stripe subscription

Since the credit card could be declined or someone could manually cancel the subscription in Stripe, we will periodically check with Stripe to confirm what plan each user should have. We can do this as often as we want, but in our example, we'll just add it to our `onLogin` hook:

In server code:

```js
Accounts.onLogin(function (info) {
  var userId = info.user._id;

  AppPlans.sync({userId: userId});

  var plan = AppPlans.get({userId: userId});
  if (!plan) {
    AppPlans.set('bronze', {userId: userId});
  }
});
```

## Cancelation

When you remove a user from a plan that is linked with a Stripe subscription, their subscription will be set to cancel at the end of the current billing period. If you then reassign that user to that same plan before it is canceled, that same Stripe subscription will be reenabled. For a plan that is pending cancelation, `AppPlans.has` and `AppPlans.hasAccess` will continue to return `true`. When the user next logs in after Stripe eventually cancels the subscription, the `sync` will remove that plan from the user. After that point, if you assign the user to that plan again, it will create a new subscription in Stripe.

For a plan that is pending cancelation, you can use `AppPlans.endDate(planName)` to get the date at which Stripe will cancel.
