//@ts-check
exports.handler = handler;

const _ = require("underscore");

/* Make sure all io-performing libraries return promises */
const Promise = require("bluebird");
// https://aws.amazon.com/blogs/developer/support-for-promises-in-the-sdk/
const aws = require("aws-sdk");
aws.config.setPromisesDependency(Promise);
// https://github.com/NodeRedis/node_redis#promises
const redis = require("redis");
Promise.promisifyAll(redis.RedisClient.prototype);

/* Constants and config */
const FIREHOSE_STREAM_NAME = process.env.FIREHOSE_STREAM_NAME;
const REDIS_CHANNEL_NAME = "plenario_observations";
const REDIS_ENDPOINT = process.env.REDIS_ENDPOINT || "localhost";

/*
  Returns a promise that resolves with a redis client that has established a connection
*/
function getConnectedRedisClient(kinesisCallback) {
  return new Promise((resolve, reject) => {
    const client = redis.createClient({
      host: REDIS_ENDPOINT,
      port: 6379
    });
    // If we encounter a Redis error (like ECONNREFUSED or who knows what else)
    // report an error back to Kinesis.
    // The lambda will keep going until the run loop is empty, so firehose can complete.
    client.on("error", err => {
      client.quit();
      kinesisCallback(err);
    });
    client.on("connect", () => {
      resolve(client);
    });
    // In case the connection hangs, set a timeout to abort after a half second.
    // setTimeout(() => {
    //   client.quit();
    //   reject(new Error("Redis connection timed out"));
    // }, 500);
  });
}

/**
 * Implementation of required handler for an incoming batch of kinesis records.
 * http://docs.aws.amazon.com/lambda/latest/dg/with-kinesis-example-deployment-pkg.html#with-kinesis-example-deployment-pkg-nodejs
 */
function handler(event, context, callback) {
  // Decode and format the incoming records,
  const records = event.Records
    .map(decode)
    // and discard the ones we can't parse.
    .filter(Boolean);

  if (records.length === 0) {
    console.log("No valid records!");
    callback(null, "Early exit: No valid records");
    return;
  }

  // If we're under test, the test will pass in stub clients in context.stubs
  const stubs = context.stubs;

  console.log('records: ' + records);
  console.log(records);
  console.log('stubs: ' + stubs);

  let firehose = null;
  let publisherPromise = null;

  if (stubs) {
    firehose = stubs.firehose;
    publisherPromise = stubs.redisPublisher;
  }

  else {
    firehose = new aws.Firehose();
    publisherPromise = getConnectedRedisClient(callback);
  }

  console.log(firehose);

  // Kick off the publication steps.
  Promise.all([
    pushToFirehose(records, firehose),
    pushToSocketServer(records, publisherPromise)
  ])
    // Claim victory...
    .then(results => {
      // pushToSocketServer resolves with number of observations published
      const msg = `Published ${records.length} records`;
      callback(null, msg);
    })
    // or propagate the error.
    .catch(callback);
}

function pushToSocketServer(records, publisherPromise) {
  return publisherPromise.then(publisher => {
    publisher
      .publishAsync(REDIS_CHANNEL_NAME, JSON.stringify(records))
      // Disconnect on success or failure
      .finally(() => publisher.quit());
  });
}

/**
 * Extract the base64 data encoded in the kinesis record to an object.
 * Return false if it isn't the format we expect.
 * @return {Object}
 */
function decode(record) {
  let data;
  try {
    data = Buffer.from(record.kinesis.data, "base64").toString();
    const parsed = JSON.parse(data);
    const valid = ["network", "node_id", "sensor", "data", "datetime"].every(
      k => parsed[k]
    );
    if (!valid) return false;
    return {
      network: parsed.network,
      meta_id: parsed.meta_id,
      node: parsed.node_id,
      sensor: parsed.sensor.toLowerCase(),
      data: parsed.data,
      // Invalid timestamp format or value [YYYY-MM-DD HH24:MI:SS]
      // Required redshift timestamp format
      datetime: parsed.datetime.replace("T", " ")
    };
  } catch (e) {
    console.log(`Could not decode ${data}: ${e.toString()}`);
    return false;
  }
}

// Returns promise that resolves with number of records published
function pushToFirehose(records, firehose) {
  console.log("records in pushToFirehose: " , records);
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
  //PLASE MAKE NOTE OF NEWLINE AT THE END OF THE RECORD
  //NECESSARY BECAUSE WHEN THE RECORDS ARE BUFFERED TOGETHER, FIREHOSE CONCTANTES THEM TOGETHER
  let row = `${o.network},${o.node},${o.datetime},${o.meta_id},${o.sensor},"${data}"\n`;

  return { Data: row };
}
