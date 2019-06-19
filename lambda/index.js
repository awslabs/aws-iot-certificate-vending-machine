/** 
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
This node.js Lambda function code creates certificate, attaches an IoT policy, IoT thing . 
It also activates the certificate. 
**/
const config = require('./config');
const applyModel = require('./app');

/* 
    You should submit your device credentials to Lambda function through API Gateway for authenticating in DynamoDB.
    eg: {"serialNumber":"YOUR_DEVICE_SERIAL_NUMBER","deviceToken":"TOKEN"}
*/
exports.handler = async (payload) => {
    var event = payload['queryStringParameters'] || JSON.parse(payload['body'])

    console.log("EVENT: " + JSON.stringify(event));
    
    const DYNAMODB_ERROR = 'Service error';
    const DEVICE_ERROR = 'Access Denied';
    const CERT_ERROR = 'Error issuing certificate!';
    const GET_ROOT_CA_ERROR = 'Can not get Amazon root CA certificate! ';
    
    // Get device credentials
    var serialNumber = event.serialNumber;
    var deviceToken = event.deviceToken;
    
    // Verify device legality
    var verifyDevice = applyModel.findDataBySerialNumber(serialNumber).then(data => {        
        if ( data.Count == 1) {            
            if(data.Items[0].deviceToken != deviceToken) {
                console.log("Device token different")
                throw DEVICE_ERROR;
            }
            // If we have an existing cert then re-issue is issue cert
            var certArn = data.Items[0].certinfo;
            var apply = (certArn) ?
                applyModel.reissueCert(serialNumber, certArn) :
                applyModel.issueCert(serialNumber);
            return apply.then(certData => {
                return applyModel.putCertinfo(serialNumber, certData.certificateArn).then(updateData => {
                    return applyModel.getIoTRootCA().then(rootca => {       
                        console.log("Save certificate", certData.certificateArn );                                    
                        certData.RootCA = rootca;
                        return certData;
                    }).catch(err => {
                        console.log("Error getting root CA", err)
                        throw GET_ROOT_CA_ERROR;
                    }); 
                }).catch(err => {
                    console.log("Error updating DynamoDB", err);
                    throw DYNAMODB_ERROR;
                });
            }).catch(err => {
                console.log("Error issueing cert", err)
                throw CERT_ERROR;
            });
        } else {
            console.log("Device not found")
            throw DEVICE_ERROR;
        }
    }).catch(err => {
        console.log("Error querying DynamoDB", err);
        throw DYNAMODB_ERROR;
    })
    
    // Return the json or plain text response
    return verifyDevice.then(certData => {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(certData, null, "\t")
        };        
    }).catch( err => {
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/plain',
            },
            body: err
        };      
    });
}