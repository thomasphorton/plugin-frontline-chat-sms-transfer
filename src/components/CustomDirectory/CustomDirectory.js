import * as React from "react";
import Url from 'url'
import Axios from 'axios';

import { templates, withTaskContext, Manager } from '@twilio/flex-ui';

import DirectoryItem from './DirectoryItem';
import {
  TabContainer, InputContainer, StyledInput, ItemContainer
} from './CustomDirectoryComponents';

class CustomDirectory extends React.Component {
  state = {
    searchTerm: ''
  }

  /**
   * Builtin React Component Method that gets run whenever this component
   * updates. We're using it here to ensure that our directory updates
   * whenever the directory is opened
   */
  componentDidMount() {
    // Every time this component mounts, pull the worker directory from Frontline
    this.getDirectoryEntries();
  }

  /**
   * Pulls the list of all Frontline workers, then updates this
   * component's State with the list
   */
  async getDirectoryEntries() {

    // Build out the config blocks for Axios
    const manager = Manager.getInstance();
    let axiosBody = {
      Token: manager.user.token,
      workerName: manager.user.identity,
    };
    let axiosOptions = {
      headers: {
        'Content-Type': 'application/json',
      }
    };
   let url = Url.resolve(this.props.runtimeDomain, 'get-frontline-workers');
   
    // Make it happen!
    let { data } = await Axios.post(url, axiosBody, axiosOptions);

    console.log(data.payload);

    if (data && data.success && data.payload) {
      this.setState({
        directoryEntries: data.payload.workers || []
      })
    } else {
      console.error("COULD NOT LOAD WORKERS.", data)
    }

  }

  /**
   * Returns a list of workers from this component's State, filtered through
   * the entered search term
   */
  filteredDirectory() {
    if (!this.state.directoryEntries) {
      return []
    }
    const { searchTerm } = this.state;
    return this.state.directoryEntries.filter(worker => {
      if (!searchTerm) {
        return true;
      }
      return worker.name.toLowerCase().includes(searchTerm.toLowerCase());
    }).sort((a, b) => {
      let a_name = a.attributes.full_name || a.attributes.friendlyName;
      let b_name = b.attributes.full_name || b.attributes.friendlyName;
      return (a_name > b_name) ? 1 : -1;
    })
  }

  /**
   * Listener function for changes in the Search field. Updates this component's
   * State with the input search term
   *
   * @param {Event} e - the change event
   */
  onSearchInputChange(e) {
    this.setState({ searchTerm: e.target.value })
  }

  /**
   * Listener function for Transfer Button clicks. Handles both warm and cold
   * transfers via the `options` parameter. For more, see:
   * https://www.twilio.com/docs/flex/ui/actions#agent
   * https://twilio.github.io/twilio-taskrouter.js/Task.html#.TransferOptions
   *
   * @param {object} worker - The worker object to transfer to
   * @param {object} options - A dictionary object send to the "TransferTask" Action as defined by the TaskRouter SDK
   */
  onTransferClick(worker, options) {
    console.log('Transfer clicked');
    console.log('Transfer worker:', worker);
    console.log('Transfer options:', options);
    this.props.invokeTransfer({
      task: this.props.task,
      options: options,
      targetSid: worker.sid,
      targetWorker: worker
    })
  }

  /**
  * Render function
  */
   render() {
    /*if (!this.state.directoryEntries) {
      return <div />
    }*/
    return (
      <TabContainer key="custom-directory-container">
        <InputContainer key="custom-directory-input-container">
          <StyledInput
            key="custom-directory-input-field"
            onChange={this.onSearchInputChange}
            placeholder={templates.WorkerDirectorySearchPlaceholder()}
          />
        </InputContainer>
        <ItemContainer
          key="custom-directory-item-container"
          className="Twilio-WorkerDirectory-Workers"
          vertical
        >
          {console.warn('Directory entries:', this.filteredDirectory())}
          {this.filteredDirectory().map(item => {
            return (
              <DirectoryItem
                item={item}
                key={item.sid}
                onTransferClick={this.onTransferClick.bind(this)}
              />
            );
          })}
        </ItemContainer>
      </TabContainer>
    )
  }
}

export default withTaskContext(CustomDirectory);
