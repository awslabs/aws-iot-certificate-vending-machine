// import Lambda Environment variables
var environment = process.env;

const config = {
  DYNAMODB_TABLE_NAME: environment.DYNAMODB_TABLE_NAME,
  REGION: environment.REGION,
  POLICY_DOCUMENT: 
  `{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": "iot:*",
        "Resource": "*"
      }
    ]
  }`,
  IOT_SHADOW_ALLOWED_KEYS: '.*',
  IOT_DATA_ENDPOINT: environment.IOT_DATA_ENDPOINT,
  ROOT_CA_URL: 'https://www.amazontrust.com/repository/AmazonRootCA1.pem'
};

module.exports = config;