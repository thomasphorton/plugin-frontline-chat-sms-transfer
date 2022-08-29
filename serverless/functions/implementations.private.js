// These functions are example implementations that work with a standard Twilio
// Flex/Frontline implementation, but can be customized to pull data from your
// CRM or another source if needed.

const getCustomerName = async (taskAttributes) => {

    // this example will return the customer phone number, but should be configured to
    // request customer information from your CRM.
    // Conversations Addresses use .customerName, fall back to .name for Legacy Addresses
    let customerName = taskAttributes.customerName || taskAttributes.name;
    return customerName;
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

module.exports = {
    getCustomerName,
    getFrontlineWorkerName,
    getFlexWorkerName,
};