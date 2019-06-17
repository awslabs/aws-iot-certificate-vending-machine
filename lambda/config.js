// import Lambda Environment variables
var environment = process.env;
//var environment = {"DynamoDB_TABLE_NAME":"deviceInfo","REGION":"us-west-2"}
// Table name var 
var config = {
    DynamoDB_TABLE_NAME: environment.DynamoDB_TABLE_NAME,
    DYNAMODB_TABLE_REGION: environment.REGION
};


// In actual production, the policy document should be generated dynamically.
config.POLICY_DOCUMENT = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "iot:*",
      "Resource": "*"
    }
  ]
}
`;

// VeriSign Class 3 Public Primary G5 root CA certificateVeriSign Class 3 Public Primary G5 root CA certificate
config.RootCA_URL = 'https://www.amazontrust.com/repository/AmazonRootCA1.pem';
module.exports = config;