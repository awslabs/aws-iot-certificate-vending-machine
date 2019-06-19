const https = require('https');
const config = require('./config');
const AWS = require('aws-sdk');

// Set the region
AWS.config.update({region: config.REGION});
// The DocumentClient class allows us to interact with DynamoDB using normal objects.
const dynamoDb = new AWS.DynamoDB.DocumentClient();
// Create the Iot Client
const iot = new AWS.Iot();

// Search User identity information from Dynamodb
let findDataBySerialNumber = ( serialNumber ) => {
  var queryParams = {
    TableName: config.DYNAMODB_TABLE_NAME,
    KeyConditionExpression: "serialNumber = :a",
    ExpressionAttributeValues: {
        ":a": serialNumber
    }
  }
  return dynamoDb.query(queryParams).promise();
}

// Put IoT cert info into Dynamodb
let putCertinfo = ( serialNumber, certificateArn ) => {
  var updateParams = {
    TableName: config.DYNAMODB_TABLE_NAME,
    Key:{
        "serialNumber": serialNumber
    },
    UpdateExpression: "set certinfo = :r",
    ExpressionAttributeValues:{
        ":r": certificateArn
    },
    ReturnValues:"UPDATED_NEW"
  }
  console.log('update table', updateParams)
  return dynamoDb.update(updateParams).promise();
}

let createCert = ( serialNumber ) => {
  // Create certificate
  var createCertParams = {
    setAsActive: true
  };
  return iot.createKeysAndCertificate(createCertParams).promise().then(certdata => {
    console.log("create certificate:");
    console.log(JSON.stringify(certdata));
    // Attach policy & thing for cert in parallel
    var attachPolicyParams = {
      policyName: serialNumber, 
      target: certdata.certificateArn 
    };
    var attachThingParams = {
      thingName: serialNumber,
      principal: certdata.certificateArn
    };
    return Promise.all([
      iot.attachPolicy(attachPolicyParams).promise(),
      iot.attachThingPrincipal(attachThingParams).promise()
    ]).then(() => {
      console.log('attached policy and thing to certificate')
      return certdata;
    });
  })
}

// Apply cert & Attach thing, policy
let issueCert = ( serialNumber ) => {
  // Create Policy & Thing in parallel
  var createPolicyParams = {
    policyName: serialNumber,
    policyDocument: config.POLICY_DOCUMENT 
  };
  var createThingParams = {
    thingName: serialNumber,
    attributePayload: {
      attributes: {
        'RegistrationWay': 'CVM'
      },
      merge: true
    }
  };
  return Promise.all([
    iot.createPolicy(createPolicyParams).promise(),
    iot.createThing(createThingParams).promise(),
  ]).then(values => {
    console.log('created policy and thing', values)
    return createCert(serialNumber);
  });
}

let reissueCert = ( serialNumber, certificateArn ) => {
  // Detach the certificate Policy and Thing in parallel
  var detachPolicyParams = {
    policyName: serialNumber,
    target: certificateArn
  };
  var detachThingParams = {
    thingName: serialNumber,
    principal: certificateArn
  };
  return Promise.all([
    iot.detachPolicy(detachPolicyParams).promise(),
    iot.detachThingPrincipal(detachThingParams).promise()
  ]).then(() => {
    console.log('detached policy and thing')
    // Update certificate to inactive and delete
    var certificateId = certificateArn.split('/')[1];
    var updateCertParams = {
      certificateId: certificateId,
      newStatus: 'INACTIVE'
    };
    return iot.updateCertificate(updateCertParams).promise().then(() => {
      console.log('updated certificate to inactive')
      var deleteCertParams = {
        certificateId: certificateId,
        forceDelete: false
      };
      return iot.deleteCertificate(deleteCertParams).promise().then(() => {
          console.log('certificate deleted');
          return createCert(serialNumber)
      });
    });
  });
}

// Get VeriSign Class 3 Public Primary G5 root CA certificate
let getIoTRootCA = () => {
  return new Promise((resolve, reject) => {
    // Make an https request 
    https.get(config.ROOT_CA_URL, ( response ) => {
      var body = [];
      response.on('data', function (chunk) {
          body.push(chunk);
      });
      response.on('end', function () {
          body = Buffer.concat(body);
          resolve(body.toString());
      });
      response.on('error', reject);
    })
  });
}

module.exports = {
    findDataBySerialNumber,
    putCertinfo,
    issueCert,
    reissueCert,
    getIoTRootCA,
}
