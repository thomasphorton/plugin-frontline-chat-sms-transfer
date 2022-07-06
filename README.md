<a  href="https://www.twilio.com">
<img  src="https://static0.twilio.com/marketing/bundles/marketing/img/logos/wordmark-red.svg"  alt="Twilio"  width="250"  />
</a>

# Frontline Chat and SMS Transfers

The Frontline Chat and SMS Transfers plugin helps contact center agents transfer customer Chats and SMS conversations to Frontline workers.

This plugin is based on both the [Chat and SMS Transfers](https://www.twilio.com/docs/flex/solutions-library/chat-and-sms-transfers) plugin from the Twilio Flex solutions library and the [Custom Directory](https://github.com/twilio-professional-services/plugin-custom-directory) plugin. It includes code for [Twilio Functions](https://www.twilio.com/docs/runtime/functions) as well as frontend UI code in the form of a [Flex plugin](https://www.twilio.com/docs/flex/quickstart/getting-started-plugin).

## Status

This project is currently **Feature-Complete**. There is still some testing, polish, and documentation work to do, but all feature requirements have been satisfied. Please refer to the TODO list for details.

### TODO
- [X] Upgrade Flex to latest (UI 2.0)
- [X] Add Serverless structure
- [X] Implement & incorporate Function for pulling Frontline agents 
  - [X] Build Function
  - [X] Incorporate function into the Directory Component
- [ ] Enhancements/Bugfixes
  - [X] Validate Twilio Signature
  - [X] Sort workers alphabetically
  - [X] Tab to front
  - [X] "Directory" --> "Frontline"
  - [ ] Add Flex Signature check
  - [ ] Leverage pre-existing Flex Insights standards if possible for tracking the transfer to Frontline and tie into reporting
  - [ ] Determine the right pattern for selecting the conversation proxy address for the selected Frontline agent
  - [ ] Determine the right pattern for retrieving the "friendly" name for the Flex and Frontline agents
  - [ ] Determine the right pattern for retrieving the customer name
  - [ ] Add logic for updating an existing Frontline conversation instead of creating a new one if a conversation already exists between the customer and the Frontline agent
  - [ ] Remove the "warm transfer" option from the Frontline custom directory UI
  - [ ] Decide if we want to downgrade to Flex UI 1.x or not
  - [ ] FUTURE - Add support for other channels, e.g. voice, WhatsApp, etc.
- [ ] Test
  - [ ] Invalid Signature
  - [ ] Function errors
  - [ ] Transfer failures
- [ ] Flesh out the README
  - [ ] Demo
    - [ ] Media Branch
    - [ ] Recording
  - [ ] Setup/Configuration

## Set up

### Requirements

To deploy this plugin, you will need:

- An active Twilio account with Flex provisioned. Refer to the [Flex Quickstart](https://www.twilio.com/docs/flex/quickstart/flex-basics#sign-up-for-or-sign-in-to-twilio-and-create-a-new-flex-project") to create one.
- npm version 5.0.0 or later installed (type `npm -v` in your terminal to check)
- Node.js version 12 or later installed (type `node -v` in your terminal to check)
- [Twilio CLI](https://www.twilio.com/docs/twilio-cli/quickstart#install-twilio-cli) along with the [Flex CLI Plugin](https://www.twilio.com/docs/twilio-cli/plugins#available-plugins) and the [Serverless Plugin](https://www.twilio.com/docs/twilio-cli/plugins#available-plugins). Run the following commands to install them:
  ```bash
  # Install the Twilio CLI
  npm install twilio-cli -g
  # Install the Serverless and Flex as Plugins
  twilio plugins:install @twilio-labs/plugin-serverless
  twilio plugins:install @twilio-labs/plugin-flex
  ```

### Contributing

All contributions and improvements to this plugin are welcome! To run the tests of the plugin: `npm run test`.

## Plugin Details

The Frontline Chat and SMS Transfers plugin adds a **Transfer** button near the **End Chat** button that comes out of the box with Flex. Clicking this button opens up the standard [WorkerDirectory Flex component](https://www.twilio.com/docs/flex/ui/components#workerdirectory) with Agents and Queues tab.  A new custom directory tab is added to the standard WorkerDirectory component that contains a list of Frontline agents (TaskRouter [Workers](https://www.twilio.com/docs/taskrouter/api/worker)). Upon selecting a Frontline agent from the list and clicking the transfer icon, the plugin will initiate a transfer of the customer chat or SMS conversation to the specified Frontline agent.

**Key Points to Note**

1. Frontline does not use Twilio TaskRouter in the same way as Flex. TaskRouter is only used to store the list of available Frontline agents. Frontline doesn't use Tasks for assigning work to agents. Instead it leverages the Twilio Conversations API. Conversations are assigned to Frontline workers directly via the [Frontline Integration Service](https://www.twilio.com/docs/frontline/frontline-integration-service).

2. Twilio Flex and Frontline cannot share the same Twilio account. As such, for the purposes of this plugin implementation, the concept of "transferring" a conversation from Flex to Frontline entails creating a new Conversation in Frontline and then adding the customer from the original Flex conversation and the Frontline agent as Participants.

3. When creating a new Frontline Conversation between the Frontline agent and customer, the plugin adds an initial message to the conversation that provides some basic context, including the identity of the customer and the Flex agent. The message text should be modified to meet your specific needs. Assuming the customer identity is stored in Frontline's associated CRM system, providing the customer identity in the initial message may not be required, as the Frontline Integration Service logic may associate the incoming Conversation to one of the Frontline agent's existing Customers by default. 

4. In addition to creating the new Frontline Conversation, the plugin will also add a message to the original Flex conversation between the customer and the Flex agent to let the customer know to expect to receive a follow up communication from the Frontline agent on a specific number. The reason for this is to validate the identity of the Frontline agent to the customer. This step is optional but recommended. If taking this approach, the message text should be modified to meet your specific needs.


---

### Local development

After the above requirements have been met:

1. Clone this repository.

    ```bash
    git clone git@github.com:twilio-professional-services/plugin-chat-sms-transfer.git
    ```

2. Install dependencies.

  ```bash
  npm install
  ```

3. [Deploy your Twilio Functions](#twilio-serverless-deployment).

4. Set your environment variables.

    ```bash
    npm run setup
    ```

See [Twilio Account Settings](#twilio-account-settings) to locate the necessary environment variables.

5. Run the application.

    ```bash
    twilio flex:plugins:start
    ```

6. Navigate to [http://localhost:3000](http://localhost:3000).

That's it!

### Twilio Serverless deployment

You need to deploy the function associated with the Chat and SMS Transfers plugin to your Flex instance. The function is called from the plugin you will deploy in the next step and integrates with TaskRouter, passing in required attributes to perform the chat transfer.

#### Pre-deployment Steps

1. Change into the serverless directory and rename `.env.example`.

    ```bash
    cd functions && cp .env.example .env
    ```

2. Open `.env` with your text editor and set the environment variables mentioned in the file.

| Environment&nbsp;Variable | Description                                                                                                                                            |
| :---------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------- |
| ACCOUNT_SID  | Your primary Twilio Flex account identifier - find this [in the Console](https://www.twilio.com/console).                                                   |
| AUTH_TOKEN        | Used to create an API key for future CLI access to your Twilio Flex Account - find this [in the Console](https://www.twilio.com/console).                   |
| WORKSPACE_SID     | Your Flex Task Assignment workspace SID - find this [in the Console TaskRouter Workspaces page](https://www.twilio.com/console/taskrouter/workspaces). |
| FRONTLINE_ACCOUNT_SID  | Your primary Twilio Frontline account identifier - find this [in the Console](https://www.twilio.com/console).                                                   |
| FRONTLINE_AUTH_TOKEN        | Used to create an API key for future CLI access to your Twilio Frontline Account - find this [in the Console](https://www.twilio.com/console).                   |
| FRONTLINE_WORKSPACE_SID     | Your Frontline Task Router Workspace SID - find this [in the Console TaskRouter Workspaces page](https://www.twilio.com/console/taskrouter/workspaces). |


3. Deploy your Twilio Serverless project to your Flex account using the Twilio CLI:
  
    ```bash
    cd functions && twilio serverless:deploy
    
    # Example Output
    # Deploying functions & assets to the Twilio Runtime
    # ⠇ Creating 1 Functions
    # ✔ Serverless project successfully deployed
    
    # Deployment Details
    # Domain: https://plugin-frontline-chat-sms-transfer-functions-xxxx-dev.twil.io
    # Service:
    #    chat-transfer (ZSxxxx)
    # ..
    ```

4. Copy and save the domain returned when you deploy your functions. You will need it in the next step.

If you forget to copy the domain, you can also find it by navigating to [Functions > API](https://www.twilio.com/console/functions/api) in the Twilio Console.

> Debugging Tip: Pass the `-l` or logging flag to review deployment logs.

### Flex Plugin Deployment

Once you have deployed the function, it is time to deploy the plugin to your Flex instance.

You need to modify the source file to include the serverless domain of the function that you deployed previously.

1. In the plugin root directory rename `.env.example`.

    ```bash
    cp .env.example .env
    ```
2. Open `.env` with your text editor and set the environment variables mentioned in the file.

    ```
    # Paste the Function deployment domain
    REACT_APP_SERVERLESS_FUNCTION_DOMAIN='https://plugin-frontline-chat-sms-transfer-functions-xxxx-dev.twil.io';
    ```
3. When you are ready to deploy the plugin, run the following in a command shell:

    ```bash
    twilio flex:plugins:deploy --major --changelog "Initial release" --description "Chat and SMS Transfers to Frontline"
    ```

#### Example Output

```
✔ Validating deployment of plugin plugin-frontline-chat-sms-transfer
⠧ Compiling a production build of plugin-frontline-chat-sms-transferPlugin plugin-frontline-chat-sms-transfer was successfully compiled with some warnings.
✔ Compiling a production build of plugin-frontline-chat-sms-transfer
✔ Uploading plugin-frontline-chat-sms-transfer
✔ Registering plugin plugin-frontline-chat-sms-transfer with Plugins API
✔ Registering version v1.0.0 with Plugins API

🚀 Plugin (private) plugin-frontline-chat-sms-transfer@1.0.0 was successfully deployed using Plugins API

Next Steps:
Run $ twilio flex:plugins:release --plugin plugin-frontline-chat-sms-transfer@1.0.0 --name "Autogenerated Release 1602189036080" --description "The description of this Flex Plugin Configuration" to enable this plugin on your Flex application
```

## View your plugin in the Plugins Dashboard

After running the suggested next step with a meaningful name and description, navigate to the [Plugins Dashboard](https://flex.twilio.com/admin/) to review your recently deployed and released plugin. Confirm that the latest version is enabled for your contact center.

You are all set to test Frontline Chat and SMS transfers in your Flex application!

---

## Changelog

### 1.0.0

**July 6, 2022**

- Initial release


## Disclaimer
This software is to be considered "sample code", a Type B Deliverable, and is delivered "as-is" to the user. Twilio bears no responsibility to support the use or implementation of this software.
