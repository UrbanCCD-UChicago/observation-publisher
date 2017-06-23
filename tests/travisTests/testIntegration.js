//@ts-check
const _ = require('underscore');
const assert = require('assert');
const chai = require('chai');
const {expect} = chai;

const sinon = require('sinon');
const fixtures = require('../fixtures.js');
const handler = require('../../index').handler;

const packageResult = sensor_tree => ({rows: [{sensor_tree}]});

const pgClient = {
    query() {
        const result = {rows: [{sensor_tree: fixtures.sensorTree}]};
        return Promise.resolve(result);
    }
}

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

function extractObjectFromRow(row) {
    let json = /{.+}/.exec(row)[0].replace(/""/g, '"');
    return JSON.parse(json);
}

function testFirehoseRowEquality(expected, observed) {
    expected = extractObjectFromRow(expected);
    observed = extractObjectFromRow(observed);
    expect(expected).to.be.deep.equal(observed);
}

describe('handler', function() {
    it('should publish data in the right formats to firehose and redis', function(done) {
        const context = {
            stubs: {
                postgres: pgClient,
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
                expect(observedRows.length).to.equal(expectedRows.length);
                for (let i = 0; i < observedRows.length; i++) {
                    testFirehoseRowEquality(expectedRows[i], observedRows[i]);
                }

                // Test redis payload was as expected
                const [channel, redisPayload] = redisClient.publishAsync.getCall(0).args;
                console.log(redisPayload);
                const observations = JSON.parse(redisPayload);
                // FIXME: This should not rely on ordering of the observations
                expect(observations).to.deep.equal(fixtures.redisObservations);
                done()
            }
            catch(e) {
                done(e)
            }
            
            
            
        }

        handler(event, context, callback);
    })
});