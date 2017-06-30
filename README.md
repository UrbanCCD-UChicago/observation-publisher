#### Observation Publisher

For an overview of how this fits into Plenario's streaming pipeline, check out [this overview](https://github.com/UrbanCCD-UChicago/socket-server/wiki/Streaming-System-Design-Doc).

#### Overview

This is a Node.js AWS Lambda function that reads sensor records from a Kinesis stream that were published by Beehive. It does some light syntactical validation and pushes the records to Redis and Firehose.

#### Redis Connection

The lambda does not cache client connections across invocations. An early version did. Testing connection time to an AWS Redis Elasticache instance from an EC2 instance in the same region, connection usually took 1 ms and took 15 ms at most. So just opening and closing that connection every time isn't too expensive and it avoids some complexity in checking connection state and attempting resets.