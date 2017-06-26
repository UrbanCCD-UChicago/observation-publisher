//@ts-check
const _ = require('underscore');
const assert = require('assert');
const chai = require('chai');
const {expect} = chai;

const sinon = require('sinon');
const fixtures = require('../fixtures.js');
const handler = require('../../index').handler;

const redisClient = {
    publishAsync: sinon.stub().returns(Promise.resolve())
}

const firehoseClient = {
    putRecordBatch: sinon.stub().returns({
        promise() {return Promise.resolve();}
    })
}

const event = {
    Records: fixtures.beehiveRecords.map(r => {
        const recordStr = JSON.stringify(r);
        return {
            kinesis: {
                data: Buffer.from(recordStr).toString('base64')
            }
        };
    })
}

function splitJSONFromRow(row) {
    let json = /{.+}/.exec(row)[0].replace(/""/g, '"');
    json = JSON.parse(json);
    const head = row.split(/\"{.+}\"/);
    return [head, json];
}

describe('handler', function() {
    it('should publish data in the right formats to firehose and redis', function(done) {
        const context = {
            stubs: {
                firehose: firehoseClient,
                redisPublisher: redisClient
            }
        };
        function callback() {
            try {
                // Test firehose payload was as expected
                const [firehosePayload] = firehoseClient.putRecordBatch.getCall(0).args;
                const observedRows = _.pluck(firehosePayload.Records, 'Data');
                const expectedRows = fixtures.firehoseRows;
                // Apply split function so that JSON in last column is parsed.
                // That way the equality test doesn't depend on key ordering
                expect(observedRows.map(splitJSONFromRow)).to.deep.equal(expectedRows.map(splitJSONFromRow));

                // Test redis payload was as expected
                const [channel, redisPayload] = redisClient.publishAsync.getCall(0).args;
                expect(JSON.parse(redisPayload)).to.deep.equal(fixtures.redisRecords);

                done()
            }
            catch(e) {
                done(e)
            }
        }
        handler(event, context, callback);
    })
});