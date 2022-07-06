import * as Flex from '@twilio/flex-ui';
import React from 'react';

import TransferButton from '../components/TransferButton';
import CustomDirectory from '../components/CustomDirectory';

/**
 * This appends new content to the Chat Canvas (adds transfer button near end chat button)
 *
 * The if: property here is important, this says only add the transfer button if this is chat-like task
 * and the task has been assigned.
 */
export const setUpComponents = (flex, manager) => {
  flex.TaskCanvasHeader.Content.add(<TransferButton key="chat-transfer-button" />, {
    sortOrder: 1,
    if: (props) => props.channelDefinition.capabilities.has('Chat') && props.task.taskStatus === 'assigned',
  });

  flex.WorkerDirectory.Tabs.Content.add(
    <flex.Tab
      key="custom-directory"
      label="Frontline"
    >
      <CustomDirectory
        runtimeDomain   = { process.env.REACT_APP_SERVERLESS_FUNCTION_DOMAIN }
        getToken        = { () => manager.store.getState().flex.session.ssoTokenPayload.token }
        invokeTransfer  = { (params) => { flex.Actions.invokeAction("TransferTask", params); flex.Actions.invokeAction("HideDirectory")} }
      />
    </flex.Tab>
  , {
    sortOrder: -1
  });

};
