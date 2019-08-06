const https = require('https');
const AWS = require('aws-sdk');
const config = require('./config');

// Set the region
AWS.config.update({region: config.REGION});
// The DocumentClient class allows us to interact with DynamoDB using normal objects.
const dynamoDb = new AWS.DynamoDB.DocumentClient();
// Create the Iot Client
const iot = new AWS.Iot();
const iotdata = new AWS.IotData({
  egion: config.REGION,
  endpoint: config.IOT_DATA_ENDPOINT
});

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

let getShadow = ( serialNumber ) => {
  // Get reported state for thing
  var params = {
    thingName: serialNumber
  }
  return iotdata.getThingShadow(params).promise().then(data => {
    console.log('get payload', data.payload)
    var payload = JSON.parse(data.payload)
    var reported = payload['state']['reported']
    // Filter out keys that are not allowed 
    Object.keys(reported).forEach(key => !config.IOT_SHADOW_ALLOWED_KEYS[key] && delete reported[key])
    return reported
  })
}

let updateShadow = ( serialNumber, desired ) => {
  // Remove keys that are now allowed
  Object.keys(desired).forEach(key => !config.IOT_SHADOW_ALLOWED_KEYS[key] && delete desired[key])
  // Set desired state for thing (only reported state is updated by device)
  var params = {
    thingName: serialNumber,
    payload: Buffer.from(JSON.stringify({ state: { desired: desired } }))
  };
  return iotdata.updateThingShadow(params).promise().then(data => {
    console.log('update payload', data.payload)
    var payload = JSON.parse(data.payload)
    return payload['state']['desired']
  })
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
    getShadow,
    updateShadow,
    getIoTRootCA
}
