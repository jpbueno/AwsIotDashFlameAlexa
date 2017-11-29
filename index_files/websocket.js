/**
* WebSocket.js
*
* Functions to sign websocket request url using the credentials
* returned from authorisation from Cognito
*
*/

function prepareWebsocketUrl( options, awsAccessId, awsSecretKey, sessionToken )
{
  
  if ( options.debug )
  {  
    console.log('options = ' + JSON.stringify(options));
    console.log('awsAccessId = ' + awsAccessId);
    console.log('awsSecretKey = ' + awsSecretKey);
    console.log('sessionToken =' + sessionToken);
  }
   
   var now = getDateTimeString();
   var today = getDateString( now );
   var path = '/mqtt';
   var awsServiceName = 'iotdevicegateway';
   
   var queryParams =  'X-Amz-Algorithm=AWS4-HMAC-SHA256' +
                      '&X-Amz-Credential=' + 
                      awsAccessId + '%2F' + 
                      today + '%2F' + 
                      options.region + '%2F' + 
                      awsServiceName + '%2Faws4_request' +
                      '&X-Amz-Date=' + now + 
                      '&X-Amz-SignedHeaders=host';

   var signedUrl =    signUrl(
                          'GET', 
                          'wss://', 
                          options.host, 
                          path, 
                          queryParams, 
                          awsAccessId, 
                          awsSecretKey, 
                          options.region, 
                          awsServiceName, 
                          '', 
                          today, 
                          now, 
                          options.debug 
                        );
                        
   if (sessionToken) 
   {
      return signedUrl + '&X-Amz-Security-Token=' + encodeURIComponent(sessionToken);
   } 
   else 
   {
   	  return signedUrl;
   }
}

function getDateTimeString() 
{
  var d = new Date();
  //
  // The additional ''s are used to force JavaScript to interpret the
  // '+' operator as string concatenation rather than arithmetic.
  //
  return d.getUTCFullYear() + '' +
             makeTwoDigits(d.getUTCMonth()+1) + ''  +
             makeTwoDigits(d.getUTCDate())    + 'T' +
             makeTwoDigits(d.getUTCHours())   + ''  +
             makeTwoDigits(d.getUTCMinutes()) + ''  +
             makeTwoDigits(d.getUTCSeconds()) + 'Z';
}

function getDateString( dateTimeString ) 
{
   return dateTimeString.substring(0, dateTimeString.indexOf('T'));
}

function makeTwoDigits( n ) 
{
   if (n > 9)
   {
      return n;
   }
   else
   {
      return '0' + n;
   }
}

function getSignatureKey(key, dateStamp, regionName, serviceName) 
{
   var kDate    = AWS.util.crypto.hmac('AWS4' + key, dateStamp, 'buffer');
   var kRegion  = AWS.util.crypto.hmac(kDate, regionName, 'buffer');
   var kService = AWS.util.crypto.hmac(kRegion, serviceName, 'buffer');
   var kSigning = AWS.util.crypto.hmac(kService, 'aws4_request', 'buffer');
   
   return kSigning;
}

function signUrl( method, 
                  scheme, 
                  hostname, 
                  path, 
                  queryParams, 
                  accessId, 
                  secretKey, 
                  region, 
                  serviceName, 
                  payload, 
                  today, 
                  now, 
                  debug 
                  ) 
{
   var signedHeaders    = 'host';
   var canonicalHeaders = 'host:' + hostname + '\n';

   var canonicalRequest = method            + '\n' + 
                          path              + '\n' + 
                          queryParams       + '\n' + 
                          canonicalHeaders  + '\n' +
                          signedHeaders     + '\n' + 
                          AWS.util.crypto.sha256(payload, 'hex');

   var hashedCanonicalRequest = AWS.util.crypto.sha256(canonicalRequest, 'hex');

   var stringToSign =   'AWS4-HMAC-SHA256\n' +
                        now + '\n' +
                        today + '/' + 
                        region + '/' + 
                        serviceName + 
                        '/aws4_request\n' +
                        hashedCanonicalRequest;

   var signingKey       = getSignatureKey(secretKey, today, region, serviceName);
   var signature        = AWS.util.crypto.hmac(signingKey, stringToSign, 'hex');
   var finalParams      = queryParams + '&X-Amz-Signature=' + signature;
   var url              = scheme + hostname + path + '?' + finalParams;

   if (debug === true) 
   {
      console.log('signing key: ' + signingKey + '\n');
      console.log('canonical request: ' + canonicalRequest + '\n');
      console.log('hashed canonical request: ' + hashedCanonicalRequest + '\n');
      console.log('string to sign: ' + stringToSign + '\n');
      console.log('signature: ' + signature + '\n');
      console.log('url: ' + url + '\n');
      
   }

   return url;
}
