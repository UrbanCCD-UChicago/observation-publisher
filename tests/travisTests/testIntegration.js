//@ts-check

const assert = require('assert');
const chai = require('chai');  
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

describe('handler', function() {
    it('should publish data in the right formats to firehose and redis', function() {
        const context = {
            stubs: {
                postgres: pgClient,
                firehose: firehoseClient,
                redisPublisher: redisClient
            }
        };
        const callback = console.log;
        handler(event, context, callback);

    })


    // describe('#handler()', function() {
    //     it('should publish to redis',function() {
    //       const redisSpy = {publish: sinon.spy()};
    //       const shouldBeCalled = sinon.spy();
    //       const stubs = {redis: {publish: shouldBeCalled}};
    //       handler(fixtureEvent, {stubs}, makeAssertions);
    //       function makeAssertions() {
    //         assert(shouldBeCalled.called);
    //       }
    //     })  
    // });
});