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
                // Apply split function so that JSON in last column is parsed.
                // That way the equality test doesn't depend on key ordering
                expect(observedRows.map(splitJSONFromRow)).to.deep.equal(expectedRows.map(splitJSONFromRow));

                // Test redis payload was as expected
                const [channel, redisPayload] = redisClient.publishAsync.getCall(0).args;
                
                const observedObservations = _.pluck(JSON.parse(redisPayload), 'attributes');
                const expectedObservations = _.pluck(fixtures.redisObservations, 'attributes');
                expect(observedObservations.length).to.equal(expectedObservations.length);
                
                // Helper to avoid relying on ordering of the observations
                function extractAndCompare(feature, meta) {
                    const props = {feature, meta_id: meta};
                    const observed = _.findWhere(observedObservations, props);
                    const expected = _.findWhere(expectedObservations, props);
                    expect(observed).to.be.ok;
                    expect(observed).to.deep.equal(expected);
                }
                const pairs = [
                    ['orientation', 1],
                    ['acceleration', 1],
                    ['temperature', 2],
                    ['temperature', 3],
                    ['gas_concentration', 4]
                ]
                for (let [feature, meta] of pairs) {
                    extractAndCompare(feature, meta);
                }
                done()
            }
            catch(e) {
                done(e)
            }
        }
        handler(event, context, callback);
    })
});