var https = require('https');
const config = require('./config');
// Load the SDK for JavaScript
const AWS = require('aws-sdk');
// Set the region
console.log(config.DynamoDB_TABLE_NAME);
AWS.config.update({region: `${config.DYNAMODB_TABLE_REGION}`});
// Set the Dynamodb Table
const Device_TABLE_NAME = config.DynamoDB_TABLE_NAME;

// The DocumentClient class allows us to interact with DynamoDB using normal objects.
const dynamoDb = new AWS.DynamoDB.DocumentClient();

// Search User identity information from Dynamodb
let findDataBySerialNumber = ( values,callback ) => {

      dynamoDb.query({
        TableName: Device_TABLE_NAME,
        KeyConditionExpression: "serialNumber = :a",
        ExpressionAttributeValues: {
            ":a": values
        }
      }, (err, data) => {
        if (err) {
          console.log('error', err);
          callback( null, err );
        } else {
          console.log('success', data.Count);
          callback( null, data );
        }
      });
}

// Put IoT cert info into Dynamodb
let putCertinfo = ( iotcert, values,callback ) => {

  dynamoDb.update({
    TableName: Device_TABLE_NAME,
    Key:{
        "serialNumber": values
    },
    UpdateExpression: "set certinfo = :r",
    ExpressionAttributeValues:{
        ":r": iotcert
    },
    ReturnValues:"UPDATED_NEW"
  }, (err, data) => {
    if (err) {
      console.log(err);
      callback( err );
    } else {
      callback( null,data );
    }
  });
}

// Apply cert & Attach thing, policy
let applycert = ( serialNumber, callback ) => {

  AWS.config.update({region: config.region});
  var iot = new AWS.Iot();

  // Create IoT Policy first 
  var params = {
    policyDocument: config.POLICY_DOCUMENT, /* required */
    policyName: serialNumber /* required */
  };
  iot.createPolicy(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else{
      console.log("policydata:");
      console.log(JSON.stringify(data));

      var params = {
        setAsActive: true || false
      };
      // Create cert for policy
      iot.createKeysAndCertificate(params, function(err, certdata) {
        console.log("certdata:");
        console.log(JSON.stringify(certdata));

        if (err) console.log(err, err.stack); // an error occurred
        else{

          // Attach policy for cert
          var params = {
            policyName: serialNumber, /* required */
            target: certdata.certificateArn /* required */
          };
          iot.attachPolicy(params, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else {

              // Create thing for cert
              var params = {
                thingName: serialNumber, /* required */
                attributePayload: {
                  attributes: {
                    'RegistrationWay': 'CVM'
                  },
                  merge: true || false
                }
              };
              iot.createThing(params, function(err, data) {
                if (err) console.log(err, err.stack); // an error occurred
                else {

                  // Attach thing for cert
                  var params = {
                    principal: certdata.certificateArn, /* required */
                    thingName: serialNumber /* required */
                  };

                  iot.attachThingPrincipal(params, function(err, thingdata) {
                    if (err) console.log(err, err.stack); // an error occurred
                    else {
                      callback( null,certdata );
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
}

// Get VeriSign Class 3 Public Primary G5 root CA certificate
let getIoTRootCA = ( callback ) => {
  const RootCA_URL = config.RootCA_URL;
  https.get(RootCA_URL, ( response ) => {

    var body = [];
    //console.log(response.statusCode);
    //console.log(response.headers);
    //console.log(response);

    response.on('data', function (chunk) {
        body.push(chunk);
    });

    response.on('end', function () {
        body = Buffer.concat(body);
        //console.log(body.toString());
        callback( null, body.toString() );
    });

  })
}

module.exports = {

    findDataBySerialNumber,
    putCertinfo,
    getIoTRootCA,
    applycert
}
