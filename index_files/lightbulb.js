////////////////////////////////////////////////////////
//
// lightbulb.js
//
// Javascript helper code for the
// light bulb brightness demo
//
////////////////////////////////////////////////////////


////////////////////////////////////////////////////////
//
// Globals
//
////////////////////////////////////////////////////////

var connectFailCount = 0;

var bulbState = {
  "brightness": 0,
  "boost": "no"
}

////////////////////////////////////////////////////////
//
// CONFIGURATION
//
////////////////////////////////////////////////////////

var config = {};
config.COGNITO_IDENTITY_POOL_ID = "us-east-1:1f830420-0d29-48aa-8868-05451ec0ac89";
config.COGNITO_REGION           = "us-east-1";
config.IOT_BROKER_ENDPOINT      = "a2lpay21edflee.iot.us-east-1.amazonaws.com";
config.IOT_BROKER_REGION        = "us-east-1";
config.IOT_THING_NAME           = "Flame";
config.IS_MASTER_DEVICE         = false;

////////////////////////////////////////////////////////
//
// Main entry point
//
////////////////////////////////////////////////////////

$(document).ready(function() {
  $("#infoLabel").text("Obtendo Id Cognito");

  var params = {
    IdentityPoolId: config.COGNITO_IDENTITY_POOL_ID
  }

  ////////////////////////////////////////////////
  //
  // Get credentials from Cognito
  //
  ////////////////////////////////////////////////

  AWS.config.region = config.COGNITO_REGION;
  AWS.config.credentials = new AWS.CognitoIdentityCredentials(params);
  AWS.config.credentials.get(function(err) {
    if (!err) {
      $("#infoLabel").text("Conectando ao AWS IoT");
      console.log("Cognito Identity Id: " + AWS.config.credentials.identityId);

      var ws = new WebSocketService();
      ws.Connect(config.IOT_BROKER_ENDPOINT, config.IOT_BROKER_REGION, config.IOT_THING_NAME, function(succeeded)
        // callbackConnect
        {
          if (succeeded) {
            //
            // Subscribe to known topics to receive updates
            //
						console.log("Subscribing...");
						ws.Subscribe('$aws/things/' + config.IOT_THING_NAME + '/shadow/get/accepted', function() {
              console.log("Subscribed. Getting current state...");
              ws.Publish('$aws/things/' + config.IOT_THING_NAME + '/shadow/get', JSON.stringify({}));
            });
            ws.Subscribe('$aws/things/' + config.IOT_THING_NAME + '/shadow/update/accepted');

            $("#infoLabel").text("Conectado!");
          } else {
            connectFailCount++;
            if (connectFailCount++ > 5)
              window.location.reload();
          }
        },
        // callbackUpdate
        function(jsonMsg) {
          //
          // Attempt to get the desired brightness
          //
          var brightness = jsonMsg.brightness;
          var colour = jsonMsg.colour;

          console.log("brightness: " + brightness);

          if (brightness != null) {
            brightness = ~~brightness;
            setFireBright(brightness, colour);
          }

          setLocalBulbStateForPercentage(brightness);
        });
    } else {
      console.log("Cognito Error: " + err);
    }
  });
});

function setLocalBulbStateForPercentage(percentage) {
  var value = ~~(percentage / 10);
  $('#imgBulb').attr("src", "images/bulb" + (value * 10) + ".jpg");

  bulbState.brightness = percentage;
  $("#infoLabel").text("Brilho " + percentage);

  $('#bulbBrightness').val(percentage);
  $('#txt_bulbBrightness').html(percentage + "%");
}

////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
//
// MQTT helpers - connection, subscription, etc
//
////////////////////////////////////////////////////////
///////////////////////////////////////////////

function WebSocketService() {
  var service = {};

  service.disconnectRef = 0;
  service.mqttClient = null;
  service.iotEndpoint = "";
  service.iotRegion = "";
  service.iotThingName = "";
  service.Connect = conn;
  service.Subscribe = sub;
  service.Publish = pub;
  service.Disconnect = disc;
  service.callbackUpdate = null;

  return service;


  function conn(iotEndpoint, iotRegion, thingName, callbackConnect, callbackUpdate) {
    console.log("WebSocketService::Initiating WebSockets connection...");

    if (iotEndpoint != null)
      service.iotEndpoint = iotEndpoint;
    if (iotRegion != null)
      service.iotRegion = iotRegion;
    if (thingName != null)
      service.iotThingName = thingName;
    if (callbackUpdate != null)
      service.callbackUpdate = callbackUpdate;
    if (callbackConnect != null)
      service.callbackConnect = callbackConnect;

    if (service.mqttClient == null) {
      var requestUrl = prepareWebsocketUrl({
        host: service.iotEndpoint,
        region: service.iotRegion,
        debug: false
      }, AWS.config.credentials.accessKeyId, AWS.config.credentials.secretAccessKey, AWS.config.credentials.sessionToken);
      service.mqttClient = new Paho.MQTT.Client(requestUrl, service.iotThingName + "_" + new Date().getTime());
      service.mqttClient.onMessageArrived = function(message) {
        //console.log("msg inbound: topic: " + message.destinationName);
        checkUpdate(message.destinationName, message.payloadString);
      };
      service.mqttClient.onMessageDelivered = function(message) {
        //console.log("msg delivered to topic: " + message.destinationName + ' payload: ' + message.payloadString);
      }

      service.mqttClient.onConnectionLost = function(err) {
        console.log("lost connection: error code:" + err.errorCode + ' error message: ' + err.errorMessage);
        service.mqttClient = null;

        if (--service.disconnectRef >= 0) {
          console.log("Skipping autoconnect " + service.disconnectRef);
        } else {
          service.Connect();
          service.disconnectRef = 0;
        }
      }
    }
    service.mqttClient.connect({
      onSuccess: function() {
        if (service.callbackConnect)
          service.callbackConnect(true);

        if (AWS && AWS.config && AWS.config.credentials && AWS.config.credentials.identityId) {
          console.log('connected with ' + AWS.config.credentials.identityId + ' to ' + service.iotEndpoint);
        } else {
          console.log('connected to ' + service.iotEndpoint);
        }
      },
      useSSL: true,
      timeout: 3,
      mqttVersion: 4,
      onFailure: function() {
        if (service.callbackConnect)
          service.callbackConnect(false);

        console.log('failed to connect to ' + service.iotThingName + " @ " + service.iotEndpoint);

        service.Connect();
      }
    });
  }

  function disc() {
    if (service.mqttClient == null) {
      console.log('service.mqttClient not initialized');
      return;
    }
    service.disconnectRef++;
    service.mqttClient.disconnect();
    service.mqttClient = null;
  }

  function sub(topic, callback) {
    if (service.mqttClient == null) {
      console.log('SUB: not connected');
      return;
    }
    service.mqttClient.subscribe(topic, {
      onSuccess: function() {
        if (callback)
          callback(topic);
      },
      onFailure: function() {
        console.log('failed to subscribed to ' + topic);
      }
    });
  }

  function pub(topic, payload) {
    if (service.mqttClient == null) {
      console.log('PUB: not connected');
      return;
    }
    var message = new Paho.MQTT.Message(payload);
    message.destinationName = topic;
    message.qos = 1;
    service.mqttClient.send(message);
  }

  function prepareWebsocketUrl(options, awsAccessId, awsSecretKey, sessionToken) {
    if (options.debug) {
      console.log('options = ' + JSON.stringify(options));
      console.log('awsAccessId = ' + awsAccessId);
      console.log('awsSecretKey = ' + awsSecretKey);
      console.log('sessionToken =' + sessionToken);
    }

    var now = getDateTimeString();
    var today = getDateString(now);
    var path = '/mqtt';
    var awsServiceName = 'iotdevicegateway';

    var queryParams = 'X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=' +
      awsAccessId + '%2F' +
      today + '%2F' +
      options.region + '%2F' +
      awsServiceName + '%2Faws4_request' +
      '&X-Amz-Date=' + now +
      '&X-Amz-SignedHeaders=host';

    var signedUrl = signUrl(
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

    if (sessionToken) {
      return signedUrl + '&X-Amz-Security-Token=' + encodeURIComponent(sessionToken);
    } else {
      return signedUrl;
    }
  }

  function getDateTimeString() {
    var d = new Date();
    //
    // The additional ''s are used to force JavaScript to interpret the
    // '+' operator as string concatenation rather than arithmetic.
    //
    return d.getUTCFullYear() + '' +
      makeTwoDigits(d.getUTCMonth() + 1) + '' +
      makeTwoDigits(d.getUTCDate()) + 'T' +
      makeTwoDigits(d.getUTCHours()) + '' +
      makeTwoDigits(d.getUTCMinutes()) + '' +
      makeTwoDigits(d.getUTCSeconds()) + 'Z';
  }

  function getDateString(dateTimeString) {
    return dateTimeString.substring(0, dateTimeString.indexOf('T'));
  }

  function makeTwoDigits(n) {
    if (n > 9) {
      return n;
    } else {
      return '0' + n;
    }
  }

  function getSignatureKey(key, dateStamp, regionName, serviceName) {
    var kDate = AWS.util.crypto.hmac('AWS4' + key, dateStamp, 'buffer');
    var kRegion = AWS.util.crypto.hmac(kDate, regionName, 'buffer');
    var kService = AWS.util.crypto.hmac(kRegion, serviceName, 'buffer');
    var kSigning = AWS.util.crypto.hmac(kService, 'aws4_request', 'buffer');

    return kSigning;
  }

  function signUrl(method,
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
  ) {
    var signedHeaders = 'host';
    var canonicalHeaders = 'host:' + hostname + '\n';

    var canonicalRequest = method + '\n' +
      path + '\n' +
      queryParams + '\n' +
      canonicalHeaders + '\n' +
      signedHeaders + '\n' +
      AWS.util.crypto.sha256(payload, 'hex');

    var hashedCanonicalRequest = AWS.util.crypto.sha256(canonicalRequest, 'hex');

    var stringToSign = 'AWS4-HMAC-SHA256\n' +
      now + '\n' +
      today + '/' +
      region + '/' +
      serviceName +
      '/aws4_request\n' +
      hashedCanonicalRequest;

    var signingKey = getSignatureKey(secretKey, today, region, serviceName);
    var signature = AWS.util.crypto.hmac(signingKey, stringToSign, 'hex');
    var finalParams = queryParams + '&X-Amz-Signature=' + signature;
    var url = scheme + hostname + path + '?' + finalParams;

    if (debug === true) {
      console.log('signing key: ' + signingKey + '\n');
      console.log('canonical request: ' + canonicalRequest + '\n');
      console.log('hashed canonical request: ' + hashedCanonicalRequest + '\n');
      console.log('string to sign: ' + stringToSign + '\n');
      console.log('signature: ' + signature + '\n');
      console.log('url: ' + url + '\n');

    }

    return url;
  }

  function checkUpdate(topic, message) {
		console.log("checkUpdate");

    var jsonMsg = JSON.parse(message);

    if (service.callbackUpdate != null && (topic.indexOf('/shadow/update/accepted') != -1 || topic.indexOf('/shadow/get/accepted') != -1)) {
      //
      // Attempt to get the desired brightness
      //
      if (jsonMsg.state.reported != null) {
        service.callbackUpdate(jsonMsg.state.reported);
      } else
      if (jsonMsg.state.desired != null) {
        service.callbackUpdate(jsonMsg.state.desired);
      } else {
				console.log("Invalid shadow data");
			}
    }
  }
}
