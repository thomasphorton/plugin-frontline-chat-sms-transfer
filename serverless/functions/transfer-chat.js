/* eslint-disable camelcase, import/no-unresolved, func-names */
const JWEValidator = require('twilio-flex-token-validator').functionValidator;

exports.handler = JWEValidator(async function (context, event, callback) {
 
  // set up twilio client (Flex)
  const client = context.getTwilioClient();

  // set up twilio client (Frontline)
  const accountSid = process.env.FRONTLINE_ACCOUNT_SID;
  const authToken = process.env.FRONTLINE_AUTH_TOKEN;
  const frontlineClient = require('twilio')(accountSid, authToken);

  // setup a response object
  const response = new Twilio.Response();
  const responseBody = {
    success: false,
    payload: {
      errors: []
    }
  }

  // parse data form the incoming http request
  const { taskSid, flexWorker, frontlineWorker } = event;

  // retrieve task attributes
  const task = await client.taskrouter.workspaces(context.WORKSPACE_SID).tasks(taskSid).fetch();
  let taskAttributes = JSON.parse(task.attributes);

  var frontlineConversation;

  try {
    // create a new frontline conversation
    frontlineConversation = await frontlineClient.conversations.conversations.create({
      friendlyName: taskAttributes.customerAddress
    });

    //get proxy phone number for selected frontline worker
    const frontlinePhoneNumber = (await frontlineClient.incomingPhoneNumbers.list({limit: 1})).pop().phoneNumber;

    // add the selected frontline worker to the conversation
    const frontlineAgentParticipant = await frontlineClient.conversations.conversations(frontlineConversation.sid)
    .participants
    .create({
        'identity': frontlineWorker.friendlyName,
        'messagingBinding.projectedAddress': frontlinePhoneNumber
      });

    // add the customer to the conversation
    const customerParticipant = await frontlineClient.conversations.conversations(frontlineConversation.sid)
    .participants
    .create({
        'messagingBinding.address': taskAttributes.customerAddress
      });

    // send a message to the customer and the frontline agent on the new conversation that provides some context to the frontline agent about the transfer
    const message2 = await frontlineClient.conversations.conversations(frontlineConversation.sid)
      .messages
      .create({
        author: frontlineWorker.friendlyName,
        body: 'Hi ' + taskAttributes.customerName + '! ' + flexWorker.identity + ' told me that you were looking for assistance. How can I help you today?'
      });

    // update the task to link to the new conversation in Frontline  
    taskAttributes.frontlineConversationSid = frontlineConversation.sid;

    await client.taskrouter
      .workspaces(context.WORKSPACE_SID)
      .tasks(taskSid)
      .update({
        attributes: JSON.stringify(taskAttributes),
      });

    // send a message to the customer on the original conversation to let them know that they should expect a communication from the frontline agent at a specific number
    const message1 = await client.conversations.conversations(taskAttributes.conversationSid)
    .messages
    .create({
      author: frontlineWorker.friendlyName,
      body: 'Thank you ' + taskAttributes.customerName + '. You should expect to hear from ' + frontlineWorker.friendlyName + ' on '  + frontlinePhoneNumber
    });

    responseBody.success = true;
    responseBody.payload.conversationSid = frontlineConversation.sid;  

  }
  catch (e) {

    // We've caught an error! Handle the HTTP error response
    console.error(e.message || e);

    response.setStatusCode(e.status || 500);

    responseBody.success = false;
    responseBody.payload.errors = responseBody.payload.errors || [];
    responseBody.payload.errors.push({ code: e.code || 500, message: e.message });

    //if the new frontline conversation was created, delete it
    if (frontlineConversation) {
      await frontlineClient.conversations.conversations(frontlineConversation.sid)
      .remove();
    }

  }
    
  response.setBody(responseBody);

  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type, X-Twilio-Signature');

  return callback(null, response);
});
