/* eslint-disable camelcase, import/no-unresolved, func-names */
const JWEValidator = require('twilio-flex-token-validator').functionValidator;

exports.handler = JWEValidator(async function (context, event, callback) {

  console.log(process.env);

  const accountSid = process.env.FRONTLINE_ACCOUNT_SID;
  const authToken = process.env.FRONTLINE_AUTH_TOKEN;
  const client = require('twilio')(accountSid, authToken);

  const response = new Twilio.Response(); // This is what will be in the eventual HTTP response via the callback method
  const responseBody = {
    success: false,
    payload: {
      errors: []
    }
  } // and this will be the Body of the response

  try { 

    // First pull our Frontline workers
    const workers = await client
      .taskrouter
      .workspaces(context.FRONTLINE_WORKSPACE_SID)
      .workers
      .list({ });

    // Now let's define our response Worker objects
    const workerObjects = workers.map((worker) => {
      return {
        sid: worker.sid,
        friendlyName: worker.friendlyName,
        activityName: worker.activityName,
        attributes: JSON.parse(worker.attributes),
        available: worker.available
      }
    });
    responseBody.success = true;
    responseBody.payload.workers = workerObjects;
  } catch (e) {
    // We've caught an error! Handle the HTTP error response
    console.error(e.message || e);

    response.setStatusCode(e.status || 500);

    responseBody.success = false;
    responseBody.payload.errors = responseBody.payload.errors || [];
    responseBody.payload.errors.push({ code: e.code || 500, message: e.message });
  }

  response.setBody(responseBody);

  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type, X-Twilio-Signature');

  return callback(null, response);
});
