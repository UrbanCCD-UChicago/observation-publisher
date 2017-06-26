const beehiveRecords = [
  // Will be split into two observations with 3 properties each
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
  },
  {
    datetime: "2017-04-07 17:50:51",
    network: "array_of_things_chicago",
    meta_id: 3,
    data: { temperature: 38.43 },
    sensor: "tmp421",
    node_id: "0000001e0610b9e7"
  },
  // Will be one big observation
  {
    datetime: "2017-04-07 17:50:51",
    network: "array_of_things_chicago",
    meta_id: 4,
    data: {
      o3: 367816,
      co: 4410,
      reducing_gases: 77,
      h2s: 24829,
      no2: 2239,
      so2: -362051,
      oxidizing_gases: 34538
    },
    sensor: "chemsense",
    node_id: "0000001e0610b9e7"
  },
  // Invalid observation: nonexistent beehive nickname
  {
    datetime: "2017-04-07 17:50:53",
    network: "array_of_things_chicago",
    meta_id: 5,
    data: { foo: 38.43 },
    sensor: "tmp421",
    node_id: "0000001e0610b9e7"
  },
  // Invalid observation: nonexistent network
  {
    datetime: "2017-04-07 17:50:53",
    network: "array_of_things_pittsburgh",
    meta_id: 6,
    data: { temperature: 38.43 },
    sensor: "tmp421",
    node_id: "0000001e0610b9e7"
  },
  // Invalid observation: nonexistent node
  {
    datetime: "2017-04-07 17:50:53",
    network: "array_of_things_chicago",
    meta_id: 7,
    data: { temperature: 38.43 },
    sensor: "tmp421",
    node_id: "foo"
  },
  // Invalid observation: nonexistent sensor
  {
    datetime: "2017-04-07 17:50:53",
    network: "array_of_things_chicago",
    meta_id: 8,
    data: { temperature: 38.43 },
    sensor: "foo",
    node_id: "0000001e0610b9e7"
  },
  // Malformed observation: missing field (datetime)
  {
    network: "array_of_things_chicago",
    meta_id: 9,
    data: { temperature: 38.43 },
    sensor: "foo",
    node_id: "0000001e0610b9e7"
  }
];

// We should pass all records to firehose
// except those that are malformed.
// `${o.network},${o.node},${o.datetime},${o.meta_id},${o.sensor},'${data}'\n`;
// Key ordering in JSON.stringify not guaranteed, so we need to extract those 
// and use an object deepEqual comparison to make sure we fot what we expected.

const firehoseRows = [
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07T17:50:51,1,bmi160,"{""orient_y"":1,""orient_z"":-1,""accel_z"":30,""orient_x"":3,""accel_y"":981,""accel_x"":-10}"',
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07T17:50:51,2,tmp112,"{""temperature"":23.93}"',
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07T17:50:51,3,tmp421,"{""temperature"":38.43}"',
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07T17:50:51,4,chemsense,"{""o3"":367816,""co"":4410,""reducing_gases"":77,""h2s"":24829,""no2"":2239,""so2"":-362051,""oxidizing_gases"":34538}"',
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07T17:50:53,5,tmp421,"{""foo"":38.43}"',
    'array_of_things_pittsburgh,0000001e0610b9e7,2017-04-07T17:50:53,6,tmp421,"{""temperature"":38.43}"',
    'array_of_things_chicago,foo,2017-04-07T17:50:53,7,tmp421,"{""temperature"":38.43}"',
    'array_of_things_chicago,0000001e0610b9e7,2017-04-07T17:50:53,8,foo,"{""temperature"":38.43}"'
]

const redisRecords = [
  // Will be split into two observations with 3 properties each
  {
    datetime: "2017-04-07T17:50:51",
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
    datetime: "2017-04-07T17:50:51",
    network: "array_of_things_chicago",
    meta_id: 2,
    data: { temperature: 23.93 },
    sensor: "tmp112",
    node: "0000001e0610b9e7"
  },
  {
    datetime: "2017-04-07T17:50:51",
    network: "array_of_things_chicago",
    meta_id: 3,
    data: { temperature: 38.43 },
    sensor: "tmp421",
    node: "0000001e0610b9e7"
  },
  // Will be one big observation
  {
    datetime: "2017-04-07T17:50:51",
    network: "array_of_things_chicago",
    meta_id: 4,
    data: {
      o3: 367816,
      co: 4410,
      reducing_gases: 77,
      h2s: 24829,
      no2: 2239,
      so2: -362051,
      oxidizing_gases: 34538
    },
    sensor: "chemsense",
    node: "0000001e0610b9e7"
  },
  // Invalid observation: nonexistent beehive nickname
  {
    datetime: "2017-04-07T17:50:53",
    network: "array_of_things_chicago",
    meta_id: 5,
    data: { foo: 38.43 },
    sensor: "tmp421",
    node: "0000001e0610b9e7"
  },
  // Invalid observation: nonexistent network
  {
    datetime: "2017-04-07T17:50:53",
    network: "array_of_things_pittsburgh",
    meta_id: 6,
    data: { temperature: 38.43 },
    sensor: "tmp421",
    node: "0000001e0610b9e7"
  },
  // Invalid observation: nonexistent node
  {
    datetime: "2017-04-07T17:50:53",
    network: "array_of_things_chicago",
    meta_id: 7,
    data: { temperature: 38.43 },
    sensor: "tmp421",
    node: "foo"
  },
  // Invalid observation: nonexistent sensor
  {
    datetime: "2017-04-07T17:50:53",
    network: "array_of_things_chicago",
    meta_id: 8,
    data: { temperature: 38.43 },
    sensor: "foo",
    node: "0000001e0610b9e7"
  }
]

exports.beehiveRecords = beehiveRecords;
exports.firehoseRows = firehoseRows;
exports.redisRecords = redisRecords;