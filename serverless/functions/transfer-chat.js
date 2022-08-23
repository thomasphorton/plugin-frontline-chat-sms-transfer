/* eslint-disable camelcase, import/no-unresolved, func-names */
const JWEValidator = require('twilio-flex-token-validator').functionValidator;

exports.handler = JWEValidator(async function (context, event, callback) {
 
  // set up twilio client (Flex)
  const flexClient = context.getTwilioClient();

  // set up twilio client (Frontline)
  const frontlineAccountSid = process.env.FRONTLINE_ACCOUNT_SID;
  const frontlineApiKey = process.env.FRONTLINE_API_KEY;
  const frontlineApiSecret = process.env.FRONTLINE_API_SECRET;
  const frontlineClient = require('twilio')(frontlineApiKey, frontlineApiSecret, { accountSid: frontlineAccountSid });

  // setup a response object
  const response = new Twilio.Response();
  const responseBody = {
    success: false,
    payload: {
      errors: []
    }
  }

  // parse data form the incoming http request
  const { taskSid, flexWorker, frontlineTaskRouterWorker } = event;

  // retrieve task attributes
  const task = await flexClient.taskrouter.workspaces(context.FLEX_WORKSPACE_SID).tasks(taskSid).fetch();
  let taskAttributes = JSON.parse(task.attributes);

  var frontlineConversation;

  try {

    console.log(taskAttributes);

    let channelType = taskAttributes.channelType;
    console.log(`channelType: ${channelType}`);

    console.log('Creating conversation...');

    let customerName = await getCustomerName(taskAttributes);
    

    let flexWorkerName = await getFlexWorkerName(flexWorker);
    let flexConversationSid = await getFlexConversationSid(taskAttributes);

    let frontlineConversationName = await getFrontlineConversationName(taskAttributes)

    //get proxy phone number for selected frontline worker
    const frontlinePhoneNumber = (await frontlineClient.incomingPhoneNumbers.list({limit: 1})).pop().phoneNumber;
    
    let frontlineWorkerName = await getFrontlineWorkerName(frontlineTaskRouterWorker, frontlineClient)

    // Frontline creates TaskRouter workers with a `friendlyName` set to their SSO identity
    let frontlineWorkerIdentity = frontlineTaskRouterWorker.friendlyName;

    // create a new frontline conversation
    frontlineConversation = await frontlineClient.conversations.conversations.create({
      friendlyName: frontlineConversationName
    });

    let frontlineConversationSid = frontlineConversation.sid;

    console.log(`Conversation ${frontlineConversationSid} created in Frontline Account`);

    // add the selected frontline worker to the conversation
    const frontlineWorkerParticipant = await frontlineClient.conversations.conversations(frontlineConversationSid)
      .participants
      .create({
        'identity': frontlineWorkerIdentity,
        'messagingBinding.projectedAddress': frontlinePhoneNumber
      });

    console.log(`Frontline Worker Participant ${frontlineWorkerParticipant.sid} added to conversation ${frontlineConversationSid}`);

    let customerMessageBindingAddress;

    if (channelType === 'web') {
      console.log('transferring web')
      const customerParticipant = await frontlineClient.conversations.conversations(frontlineConversationSid)
        .participants
        .create({
          identity: taskAttributes.customerAddress
        });

    } else if (channelType === 'sms') {
      console.log('transferring sms');
      customerMessageBindingAddress = await getCustomerPhoneNumber(taskAttributes);
    
      // add the customer to the Frontline conversation
      const customerParticipant = await frontlineClient.conversations.conversations(frontlineConversationSid)
        .participants
        .create({
          'messagingBinding.address': customerMessageBindingAddress
        });

      console.log(`Customer Participant ${customerParticipant.sid} added to conversation ${frontlineConversationSid}`);
    } else {
      console.log(`channelType ${channelType} not supported`);
    }

    // send a message to the customer and the frontline agent on the Frontline conversation that provides some context to the frontline agent about the transfer
    const frontlineTransferMessage = await frontlineClient.conversations.conversations(frontlineConversationSid)
      .messages
      .create({
        author: frontlineWorkerIdentity,
        body: `Hi ${customerName}! ${flexWorkerName} told me that you were looking for assistance. How can I help you today?`
      });

    console.log(`Frontline transfer message sent`);

    // update the task to link to the new conversation in Frontline  
    taskAttributes.frontlineConversationSid = frontlineConversationSid;
    taskAttributes.transferReason = 'Transferred to Frontline Agent';
    taskAttributes.transferTargetSid = 'TODO: PUT WORKER SID HERE';
    taskAttributes.transferTargetIdentity = 'TODO: PUT WORKER IDENTITY HERE';

    await flexClient.taskrouter
      .workspaces(context.FLEX_WORKSPACE_SID)
      .tasks(taskSid)
      .update({
        attributes: JSON.stringify(taskAttributes),
      });

    console.log(`TaskRouter task updated`);

    // send a message to the customer on the original conversation to let them know that they should expect a communication from the frontline agent at a specific number
    const flexTransferMessage = await flexClient.conversations.conversations(flexConversationSid)
      .messages
      .create({
        author: flexWorker.identity,
        body: `Thank you ${customerName}. You should expect to hear from ${frontlineWorkerName} on ${frontlinePhoneNumber}.`
      });

    console.log(`Flex transfer message sent`);

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

const getCustomerName = async (taskAttributes) => {

  // this example will return the customer phone number, but should be configured to
  // request customer information from your CRM.
  // Conversations Addresses use .customerName, fall back to .name for Legacy Addresses
  let customerName = taskAttributes.customerName || taskAttributes.name;
  return customerName;
}

const getCustomerPhoneNumber = async (taskAttributes) => {

  // Conversations Addresses use .from, fall back to .name for Legacy Addresses
  let customerPhoneNumber = taskAttributes.from || taskAttributes.name;
  return customerPhoneNumber
}

// This function can be changed to pull data from your SSO idP for the
// agent's friendly name if desired.
const getFrontlineWorkerName = async (taskRouterWorker, frontlineClient) => {
  try {

    // Frontline creates TaskRouter workers with a `friendlyName` set to the Frontline
    // worker's SSO identity. use that to lookup the Frontline user and get their
    // actual `friendly name` set in the Twilio Console. 
    let frontlineIdentity = taskRouterWorker.friendlyName;
    let user = await frontlineClient.frontlineApi.v1.users(frontlineIdentity)
      .fetch()

    return user.friendlyName;
  }
  catch (e) {
    console.log(e);
  }
}

// Default to the 'identity' property, which is usually an email address and 
// not very friendly. This function can be changed to pull data from your SSO idP
// for the agent's friendly name if desired.
const getFlexWorkerName = async (flexWorker) => {
  return flexWorker.identity;
}

// the Flex Conversation SID is stored in a different field depending on which revision
// of Conversations it is using.
const getFlexConversationSid = async (taskAttributes) => {
  let flexConversationSid = taskAttributes.conversationSid || taskAttributes.channelSid;
  return flexConversationSid;
}

const getFrontlineConversationName = async (taskAttributes) => {
  let friendlyName = taskAttributes.customerName || taskAttributes.name;
  return friendlyName;
}