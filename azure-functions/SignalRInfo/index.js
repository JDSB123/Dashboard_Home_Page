module.exports = async function (context, req) {
    // Return SignalR connection info to client
    context.res = {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Credentials': 'true'
        },
        body: context.bindings.connectionInfo
    };
};
