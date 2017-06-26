/**
 * Imports and constants
 */

//@ts-check
exports.handler = handler;

const _ = require('underscore');

/* Make sure all io-performing libraries return promises */
const Promise = require('bluebird');
// https://aws.amazon.com/blogs/developer/support-for-promises-in-the-sdk/
const aws = require('aws-sdk');
aws.config.setPromisesDependency(Promise);
// https://github.com/NodeRedis/node_redis#promises
const redis = require('redis');
Promise.promisifyAll(redis.RedisClient.prototype);

/* Constants and config */
const FIREHOSE_STREAM_NAME = 'DatabaseStream';
const REDIS_CHANNEL_NAME = 'plenario_observations';
const REDIS_ENDPOINT = process.env.REDIS_ENDPOINT || 'localhost';

/**
 * Objects that survive across invocations
 */

/* Keep references to connections in global scope
   so that we can hold on to connections across function invocations.
   And create the clients lazily in case we don't end up needing them
   (like in unit tests)
*/
const clientCache = {
    get firehose() {
        if (!this._firehoseClient) {
            this._firehoseClient = new aws.Firehose();
        }
        return this._firehoseClient;
    },

    get redisPublisher() {
        if (!this._redisClient) {
            this._redisClient = redis.createClient({
                host: REDIS_ENDPOINT, 
                port: 6379
            });
        }
        return this._redisClient;
    }
};

/**
 * Per-invocation logic
 */

/**
 * Implementation of required handler for an incoming batch of kinesis records.
 * http://docs.aws.amazon.com/lambda/latest/dg/with-kinesis-example-deployment-pkg.html#with-kinesis-example-deployment-pkg-nodejs
 */
function handler(event, context, callback) {
    // Decode and format the incoming records,
    const records = event.Records.map(decode)
    // and discard the ones we can't parse.
    .filter(Boolean);
    
    if (records.length === 0) {
        console.log('No valid records!');
        callback(null, 'Early exit: No valid records');
        return;
    }
    
    // If we're under test, the test will pass in stub clients in context.stubs
    const stubs = context.stubs;
    const redisPublisher = stubs.redisPublisher || clientCache.redisPublisher;
    const firehose = stubs.firehose || clientCache.firehose;

    // Kick off the publication steps.
    Promise.all([
        pushToFirehose(records, firehose),
        redisPublisher.publishAsync(REDIS_CHANNEL_NAME, JSON.stringify(records))
    ])
    // Claim victory...
    .then(results => {
        // pushToSocketServer resolves with number of observations published
        const msg = `Published ${records.length} records`;
        callback(null, msg)
    })
    // or propagate the error.
    .catch(callback);
}

/**
 * Extract the base64 data encoded in the kinesis record to an object.
 * Return false if it isn't the format we expect.
 * @return {Object}
 */
function decode(record) {
    let data;
    try {
        data = Buffer.from(record.kinesis.data, 'base64').toString();
        const parsed = JSON.parse(data);
        // Edge case: if meta_id is 0, it will fail this test.
        const valid = ['network', 'node_id', 'sensor', 'data', 'datetime']
                        .every(k => parsed[k]);
        if (!valid) return false;
        return {
            network: parsed.network,
            meta_id: parsed.meta_id,
            node: parsed.node_id,
            sensor: parsed.sensor.toLowerCase(),
            data: parsed.data,
            datetime: parsed.datetime.replace(' ', 'T')
        }
    } catch (e) {
        console.log(`Could not decode ${data}: ${e.toString()}`);
        return false;
    }
}

// Returns promise that resolves with number of records published
function pushToFirehose(records, firehose) {
    const payload = {
        Records: records.map(prepRecordForFirehose),
        DeliveryStreamName: FIREHOSE_STREAM_NAME
    };
    return firehose.putRecordBatch(payload).promise();
}

function prepRecordForFirehose(o) {
    // Note that the double quote (") is the Redshift quote character.
    // http://docs.aws.amazon.com/redshift/latest/dg/copy-parameters-data-format.html#copy-csv
    // If you put two quote characters back to back, it is interpreted as one literal double quote character.
    // So we need to replace double quotes in stringified JSON with _two_ double quotes.
    const data = JSON.stringify(o.data).replace(/"/g, '""');
    // Note that we wrap stringified JSON in (unescaped) double quotes
    // so that Redshift does not interpret the commas in the object as column delimiters
    let row = `${o.network},${o.node},${o.datetime},${o.meta_id},${o.sensor},"${data}"`;
    return {Data: row};
}