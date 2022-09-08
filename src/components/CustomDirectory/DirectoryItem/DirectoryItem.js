import * as React from "react";
import {
  IconButton,
  UserCard,
  templates,
  withTheme
} from '@twilio/flex-ui';
import { ButtonContainer, CallButton, ItemInnerContainer } from '../CustomDirectoryComponents';
import { WorkerMarginPlaceholder } from './DirectoryItemComponents';

class DirectoryItem extends React.Component {
  onColdTransferClick = (e) => {
    this.props.onTransferClick(this.props.item, { mode: "COLD" });
  };

  render() {
    return (
      <ItemInnerContainer className="Twilio-WorkerDirectory-Worker" noGrow noShrink>
        <WorkerMarginPlaceholder noGrow noShrink />
        <UserCard
          className="Twilio-WorkerDirectory-UserCard"
          firstLine={ this.props.item.friendlyName }
          secondLine={this.props.item.activityName}
          isAvailable={this.props.item.available}
          imageUrl={this.props.item.attributes.image_url || ""}
          large
        />
        <ButtonContainer className="Twilio-WorkerDirectory-ButtonContainer">
          <IconButton
            icon="Transfer"
            onClick={this.onColdTransferClick}
            themeOverride={this.props.theme.WorkerDirectory.ItemActionButton}
            title={templates.ColdTransferTooltip()}
          />
        </ButtonContainer>
      </ItemInnerContainer>
    )
  }
}

export default withTheme(DirectoryItem);
