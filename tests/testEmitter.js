/* 
    Mock out everything _except_ for the redis client.
    That will let you use this server to _just_ test interaction with the socket
    server in your laptop dev environment.
*/
const {handler} = require('../index.js');

const {beehiveRecords} = require('./fixtures');

// The lambda calls the firehose client's #putRecordBatch method,
// and expects to chain a "#promise" call.
// It only expects that the #promise call resolves.
const firehoseStub = {
    putRecordBatch(records) {
        return {
            promise() {
                return Promise.resolve();
            }
        }
    }
}

// Try sending a fresh batch of observations every 15 seconds

const recordsAsEvent = {
    Records: beehiveRecords.map(o => ({
        kinesis: {
            data: new Buffer(JSON.stringify(o), 'binary').toString('base64')
        }
    }))
}

function sendABatch() {
    const context = {
        stubs: {
            firehose: firehoseStub
        }
    }
    handler(recordsAsEvent, context, console.log);
}

setInterval(sendABatch, 1000);