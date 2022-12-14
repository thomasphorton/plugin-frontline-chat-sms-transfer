/* eslint-disable camelcase, import/no-unresolved, func-names */
const JWEValidator = require('twilio-flex-token-validator').functionValidator;
const implementationsPath = Runtime.getFunctions()['implementations'].path;
const { getCustomerName, getFrontlineWorkerName, getFlexWorkerName } = require(implementationsPath);

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

    // SMS specific
    let customerMessageBindingAddress = await getCustomerPhoneNumber(taskAttributes);
    
    try {
      // add the customer to the Frontline conversation
      const customerParticipant = await frontlineClient.conversations.conversations(frontlineConversationSid)
      .participants
      .create({
        'messagingBinding.address': customerMessageBindingAddress
      });

      console.log(`Customer Participant ${customerParticipant.sid} added to conversation ${frontlineConversationSid}`);
    }
    catch (e) {

      // If the error is not 'Group MMS with participant already exists', bubble up the error
      if (e.code != 50438) {
        throw e
      }
      else {
        // If a conversation between the Frontline agent and the customer already exists,
        // parse the existing conversation SID from the error message and send the transfer message to that conversation instead.
        console.log('Conversation between Frontline agent and customer already exists');

        let splitMessage = e.message.split(' ');
        let existingConversationSid = splitMessage[splitMessage.length -1];

        console.log(`Sending transfer message to existing conversation: ${existingConversationSid}`)
        frontlineConversationSid = existingConversationSid;
      }
    }
    finally {

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
      taskAttributes.frontlineTargetWorkerSid = frontlineTaskRouterWorker.sid;
      taskAttributes.frontlineTargetWorkerIdentity = frontlineWorkerIdentity;

      await flexClient.taskrouter
        .workspaces(context.FLEX_WORKSPACE_SID)
        .tasks(taskSid)
        .update({
          attributes: JSON.stringify(taskAttributes),
        });

      console.log(`TaskRouter task updated`);
      console.log(taskAttributes);

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

  }
  catch (e) {

    // We've caught an error! Handle the HTTP error response
    console.error(e.message || e);

    console.log(e);

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

// these Functions help resolve differences between Legacy/
const getCustomerPhoneNumber = async (taskAttributes) => {

  // Conversations Addresses use .from, fall back to .name for Legacy Addresses
  let customerPhoneNumber = taskAttributes.from || taskAttributes.name;
  return customerPhoneNumber
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