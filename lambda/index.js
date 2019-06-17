/** 
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.
This node.js Lambda function code creates certificate, attaches an IoT policy, IoT thing . 
It also activates the certificate. 
**/
const config = require('./config');
const applyModel = require("app");

/* 
    You should submit your device credentials to Lambda function through API Gateway for authenticating in DynamoDB.
    eg: {"serialNumber":"YOUR_DEVICE_SERIAL_NUMBER","deviceToken":"TOKEN"}
*/
exports.handler = async (payload) => {
    var event = payload['queryStringParameters'] || JSON.parse(payload['body'])

    console.log("EVENT: " + JSON.stringify(event));
    
    const DYNAMODB_ERROR = 'Service error: 500!';
    const Device_ERROR = 'Access Deny!';
    const INTERNAL_ERROR = 'Identical serial number error!';
    const GET_ROOT_CA_ERROR = 'Can not get Get VeriSign Class 3 Public Primary G5 root CA certificate! ';
    
    // Get device credentials
    var serialNumber = event.serialNumber;
    var deviceToken = event.deviceToken;
    
    // Verify device legality
    var verifyDevice = new Promise((resolve, reject) => {
        applyModel.findDataBySerialNumber( serialNumber, ( err,data ) => {        
            if( err ) {
                console.log( err );
                reject( DYNAMODB_ERROR );
            }
            // No device exists!
            else if ( data.Count == 0) {
                reject( Device_ERROR );
            }
            // You should replace equipment certificate according to demand in production.
            else if ( data.Count == 1) {            
                //  then verify Token
                if(data.Items[0].deviceToken!=deviceToken) {
                    console.log( 'device token different' )
                    reject( Device_ERROR );
                } else if (data.Items[0].certinfo) {
                    console.log( 'device token has cert info' )
                    reject( Device_ERROR );
                } else {
                    // After the verification is complete, you can apply for a certificate for the device.
                    applyModel.applycert( serialNumber, ( err, certData ) => {
                        // In order to be safe, you should write the certificate ID/Arn, indicating that the device has applied for a certificate.
                        applyModel.putCertinfo( certData.certificateArn, serialNumber, ( err, putSuccess ) => {                            
                            if(err) { 
                                console.log( err );
                                reject( INTERNAL_ERROR );
                            } else {
                                // Don't forget to return CA certificate
                                applyModel.getIoTRootCA( ( err,rootca ) => {                                    
                                    if ( err ) {
                                        console.log( err );
                                        reject( GET_ROOT_CA_ERROR );
                                    } else {
                                        var returnValues = certData;
                                        returnValues.RootCA = rootca;
                                        console.log( 'saved certificate', certData.certificateArn );                                    
                                        resolve( returnValues );
                                    }
                                })

                            }                            
                        });
                    });
                }
            }
            // Else count > 1 
            else {
                console.log(data);
                reject( INTERNAL_ERROR );
            }
        });
    })

    // Return the status code and body
    return verifyDevice.then( returnValues => {
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(returnValues, null, "\t")
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