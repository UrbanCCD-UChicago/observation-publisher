const beehiveRecords = [
  {
    datetime: "2017-04-07 17:50:51",
    network: "array_of_things_chicago",
    meta_id: 1,
    data: {
      orient_y: 1,
      orient_z: -1,
      accel_z: 30,
      orient_x: 3,
      accel_y: 981,
      accel_x: -10
    },
    sensor: "bmi160",
    node_id: "0000001e0610b9e7"
  },
  {
    datetime: "2017-04-07 17:50:51",
    network: "array_of_things_chicago",
    meta_id: 2,
    data: { temperature: 23.93 },
    sensor: "tmp112",
    node_id: "0000001e0610b9e7"
  }
];

// We should pass all records to firehose and redis
// except those that are malformed.

const firehoseRows = [
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07 17:50:51,1,bmi160,"{""orient_y"":1,""orient_z"":-1,""accel_z"":30,""orient_x"":3,""accel_y"":981,""accel_x"":-10}"\n',
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07 17:50:51,2,tmp112,"{""temperature"":23.93}"\n'
]

const redisRecords = [
  {
    datetime: "2017-04-07 17:50:51",
    network: "array_of_things_chicago",
    meta_id: 1,
    data: {
      orient_y: 1,
      orient_z: -1,
      accel_z: 30,
      orient_x: 3,
      accel_y: 981,
      accel_x: -10
    },
    sensor: "bmi160",
    node: "0000001e0610b9e7"
  },
  {
    datetime: "2017-04-07 17:50:51",
    network: "array_of_things_chicago",
    meta_id: 2,
    data: { temperature: 23.93},
    sensor: "tmp112",
    node: "0000001e0610b9e7"
  }];

exports.beehiveRecords = beehiveRecords;
exports.firehoseRows = firehoseRows;
exports.redisRecords = redisRecords;
