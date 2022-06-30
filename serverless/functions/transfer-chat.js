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
  /*
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Content-Length, X-Requested-With, User-Agent',
  );
  response.appendHeader('Vary', 'Origin');
  */
  const responseBody = {
    success: false,
    payload: {
      errors: []
    }
  }

  // parse data form the incoming http request
  const taskSid = event.taskSid;
  const { flexWorker } = event;
  const { frontlineWorker } = event;

  // retrieve task attributes
  const task = await client.taskrouter.workspaces(context.TWILIO_WORKSPACE_SID).tasks(taskSid).fetch();
  let taskAttributes = JSON.parse(task.attributes);

  // create a new frontline conversation
  const frontlineConversation = await frontlineClient.conversations.conversations.create({
    friendlyName: taskAttributes.customerAddress
  });

  // add the selected frontline worker to the conversation
  const frontlineAgentParticipant = await frontlineClient.conversations.conversations(frontlineConversation.sid)
  .participants
  .create({
      'identity': frontlineWorker.friendlyName,
      'messagingBinding.projectedAddress': '+17034207373'
    });

  // add the customer to the conversation
  const customerParticipant = await frontlineClient.conversations.conversations(frontlineConversation.sid)
  .participants
  .create({
      'messagingBinding.address': taskAttributes.customerAddress
    });

  // add a message to the conversation with some minimal amount of context
  const message = await frontlineClient.conversations.conversations(frontlineConversation.sid)
    .messages
    .create({
      author: frontlineWorker.friendlyName,
      body: 'Hi ' + taskAttributes.customerAddress + '! ' + flexWorker.identity + ' told me that you were looking for assistance. How can I help you today?'
    });

  /*
   * set up attributes of the new task to link them to
   * the original task in Flex Insights
   */
  /*
  if (!taskAttributes.hasOwnProperty('conversations')) {
    taskAttributes = Object.assign(taskAttributes, {
      conversations: {
        conversation_id: originalTaskSid,
      },
    });
  }
  */


  /*
   * update task attributes to ignore the agent who transferred the task
   * it's possible that the agent who transferred the task is in the queue
   * the task is being transferred to - but we don't want them to
   * receive a task they just transferred. It's also possible the agent
   * is simply transferring to the same queue the task is already in
   * once again, we don't want the transferring agent to receive the task
   */
  //newAttributes.ignoreAgent = workerName;

  /*
   * update task attributes to include the required targetSid on the task
   * this could either be a workerSid or a queueSid
   */
  //newAttributes.targetSid = targetSid;

  // add an attribute that will tell our Workflow if we're transferring to a worker or a queue
  /*
  if (targetSid.startsWith('WK')) {
    newAttributes.transferTargetType = 'worker';
  } else {
    newAttributes.transferTargetType = 'queue';
  }
  */

  /*
  // create New task
  const newTask = await client.taskrouter.workspaces(context.TWILIO_WORKSPACE_SID).tasks.create({
    workflowSid: context.TWILIO_CHAT_TRANSFER_WORKFLOW_SID,
    taskChannel: originalTask.taskChannelUniqueName,
    attributes: JSON.stringify(newAttributes),
  });
  */

  /*
   * Remove the original transferred task's reference to the chat channelSid
   * this prevents Twilio's Janitor service from cleaning up the channel when
   * the original task gets completed.
   */
  //const originalTaskAttributes = JSON.parse(originalTask.attributes);
  //delete originalTaskAttributes.channelSid;

  /*
  // update task and remove channelSid
  await client.taskrouter
    .workspaces(context.TWILIO_WORKSPACE_SID)
    .tasks(originalTaskSid)
    .update({
      attributes: JSON.stringify(originalTaskAttributes),
    });
    */

  /*
  // Close the original Task
  await client.taskrouter
    .workspaces(context.TWILIO_WORKSPACE_SID)
    .tasks(originalTaskSid)
    .update({ assignmentStatus: 'completed', reason: 'task transferred to frontline agent' });
  */
  responseBody.success = true;
  responseBody.payload.conversationSid = frontlineConversation.sid;

  response.setBody(responseBody);

  response.appendHeader('Content-Type', 'application/json');
  response.appendHeader('Access-Control-Allow-Origin', '*');
  response.appendHeader('Access-Control-Allow-Methods', 'OPTIONS, POST, GET');
  response.appendHeader('Access-Control-Allow-Headers', 'Content-Type, X-Twilio-Signature');

  return callback(null, response);
});
