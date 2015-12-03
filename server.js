//Setup web server and socket
var twitter    = require('twitter');
var express    = require('express');
var app        = express();
var http       = require('http');
var server     = http.createServer(app);
var io         = require('socket.io').listen(server);
var mysql      = require('mysql');
var AlchemyAPI = require('alchemy-api');
var AWS        = require('aws-sdk');
var SNSClient = require('aws-snsclient');
// var trendstwit      = require('twit')

var awsRegion = 'us-west-2';

AWS.config.update({
  accessKeyId: '',
  secretAccessKey: '',
  region: awsRegion
});

var alchemyapi = new AlchemyAPI('0283916aabb94ec2a1a42963b87e512ab52caacd');


dbconnection = mysql.createConnection({
  host     : 'geotweets.cncbo1roiupx.us-east-1.rds.amazonaws.com',
  user     : 'mdt2125',
  password : 'qwerty123',
  port     : '3306',
  database : 'geotweets'
});
dbconnection.connect();

//Setup twitter stream api
var twit = new twitter({
  consumer_key: 'ICsjVwqwMS2YCVsT3xqAETuxQ',
  consumer_secret: 'DfHEa2M0ZccimRrbXPbZfEM8TH599Wo91DrgI6LVYsdTd4mz86',
  access_token_key: '29206858-Gj7BLDf6ezYnAQPS53lA6ZaRrHLimQLUGWJPoo5k2',
  access_token_secret: 'QUBBRe0u0JtKscENwYZXIdKDBokg4fbtrdurcWpxRW8WI'
}),


// var T = new trendstwit({
//     consumer_key:         'ICsjVwqwMS2YCVsT3xqAETuxQ'
//   , consumer_secret:      'DfHEa2M0ZccimRrbXPbZfEM8TH599Wo91DrgI6LVYsdTd4mz86'
//   , access_token:         'Gj7BLDf6ezYnAQPS53lA6ZaRrHLimQLUGWJPoo5k2'
//   , access_token_secret:  'QUBBRe0u0JtKscENwYZXIdKDBokg4fbtrdurcWpxRW8WI'
// });

stream = null;
cat = "all";

console.log('server up');

//Use the default port (for beanstalk) or default to 8081 locally
server.listen(process.env.PORT || 8081);

//Setup routing for app
app.use(express.static(__dirname + '/public'));

// var auth_post = {
//   verify:false
// };

// var subscriptionToken;
// var sns_client = SNSClient(auth_post, function(err, message) {
//   if (err) {
//     console.log('sns client err');
//   } else {
//     console.log('sns client message:' + message);
//     console.log('sns client message:' + message.Token);
//     subscriptionToken = message.Token;
//   }
// });

// app.post('/tweetsent', sns_client);

//Create web sockets connection.
io.sockets.on('connection', function (socket) {
  console.log('socket: on connection');
  
  socket.on("tweets in cat", function(new_cat) {
  console.log('socket: start tweets in cat');
  if (cat != new_cat) {
    cat = new_cat;

    
    dbconnection.query('SELECT * from tweets where sentiment IS NOT NULL and LOWER(text) like \'%' + cat.toLowerCase() + ' %\' ORDER BY last_update DESC LIMIT 100', function(err, rows, fields) {
    if (!err){
      // console.log('The solution is: ' + rows);
      for (var i = rows.length - 1; i >= 0; i--) {
         
         var outputPoint = rows[i];
         socket.emit("twitter-stream", outputPoint);
      }
      console.log("result query: " + rows.length + " items");
    }
    else
      console.log('Error while performing Query. '+err);
    });

    }

  });

  socket.on("start tweets", function() {
  
  console.log('socket: start tweets');

  dbconnection.query('SELECT * from tweets where sentiment IS NOT NULL ORDER BY last_update DESC LIMIT 100', function(err, rows, fields) {
  if (!err){
    //console.log('The solution is: ', rows);
    for (var i = rows.length - 1; i >= 0; i--) {
       
       var outputPoint = rows[i];
       socket.emit("twitter-stream", outputPoint);
    }
    console.log("result query: " + rows.length + " items");
  }
  else
    console.log('Error while performing Query. ' + err);
  });


    if(stream === null) {
      console.log('connecting to a tweeter stream');

      //Connect to twitter stream passing in filter for entire world.
      twit.stream('statuses/filter', {'locations':'-180,-90,180,90',  'language':'en'}, function(stream) {
           
           stream.on('data', function(data) {
              // Does the JSON result have coordinates
              if (data.coordinates){
                if (data.coordinates !== null){

                  //If so then build up some nice json and send out to web sockets
                  var outputPoint = {"lat": data.coordinates.coordinates[0],"lng": data.coordinates.coordinates[1]};

                  //socket.broadcast.emit("twitter-stream", outputPoint);
                  
                  //Send out to web sockets channel.
                  //socket.emit('twitter-stream', outputPoint);
                }
                else if(data.place && data.place.bounding_box === 'Polygon'){
                    // Calculate the center of the bounding box for the tweet
                    var coord, _i, _len;
                    var centerLat = 0;
                    var centerLng = 0;

                    for (_i = 0, _len = coords.length; _i < _len; _i++) {
                      coord = coords[_i];
                      centerLat += coord[0];
                      centerLng += coord[1];
                    }
                    centerLat = centerLat / coords.length;
                    centerLng = centerLng / coords.length;

                    // Build json object and broadcast it
                    var outputPoint = {"lat": centerLat,"lng": centerLng};

                } else {
                  return;
                }

                tweetjs = {"text": data.text.toLowerCase(),
                           "latitude": outputPoint.lat,
                           "longitude": outputPoint.lng,
                           "id": data.id,
                           "screen_name": data.user.name};

                dbconnection.query('insert into tweets set ?', tweetjs, function(error, message) {
                  if (error) {
                    console.log('FAILED sending incoming tweet to DB: '+error);
                  } else {
                    console.log('inserted to DB - sending sqs message: '  +  JSON.stringify(tweetjs));
                    sendSqsMessage(JSON.stringify(tweetjs), socket);
                  }
                });
              }


              stream.on('limit', function(limitMessage) {
                // return console.log(limitMessage);
              });

              stream.on('warning', function(warning) {
                // return console.log(warning);
              });

              stream.on('disconnect', function(disconnectMessage) {
                return console.log(disconnectMessage);
              });
          });
      });
    }
  });
    
    // Emits signal to the client telling them that the
    // they are connected and can `receiving Tweets
    socket.emit("connected");
    console.log('connected');
});

function sendSqsMessage(tweet, socket) {
  'use strict';

  var sqs = new AWS.SQS();

  var params = {
    MessageBody: tweet,
    QueueUrl: 'https://sqs.us-west-2.amazonaws.com/922468305361/tweets',
    DelaySeconds: 0
  };

 
  sqs.sendMessage(params, function (err, data) {
    if (err) {
      // an error occurred
      console.log(err, err.stack);
    } 
    else {
      console.log('Victory, message sent for ' + params + '!');
      readMessage(socket);
    }
    ;
  });
}

function readMessage(socket) {
  //'use strict';

  var awsRegion = 'us-west-2';
  
  AWS.config.update({
    accessKeyId: 'AKIAJOEHZSF2UJHTQFXQ',
    secretAccessKey: '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',
    region: awsRegion
  });

  var sqs = new AWS.SQS();
 
  var params = {
    QueueUrl: 'https://sqs.us-west-2.amazonaws.com/922468305361/tweets',
    MaxNumberOfMessages : 1,
    VisibilityTimeout: 60,
    WaitTimeSeconds: 20
  };

  sqs.receiveMessage(params, function (err, data) {
    var sqs_message_body;
    console.log("RECIEVED SQS MESSAGE: " + data);

    if ((data.Messages) && (typeof data.Messages[0] !== 'undefined' && typeof data.Messages[0].Body !== 'undefined')) {
        //sqs msg body
        //console.log("data.Messages[0].Body: " + data.Messages[0].Body);
        sqs_message_body = JSON.parse(data.Messages[0].Body);
        //console.log("sqs_message_body: " + sqs_message_body);
        //console.log("sqs_message_body.text: " + sqs_message_body.text);

        // get sentiment using alchemyapi
        var tweet = sqs_message_body;
        console.log("recieved sqs - mytext = " + tweet.text);
        alchemyapi.sentiment(tweet.text, {}, function(err, response) {
          if (err) {
            console.log(error);
          } else if (response !== 'undefined' && response && response.docSentiment && response.docSentiment!=='undefined') {
            console.log("Sentiment: " + JSON.stringify(response.docSentiment));
            tweet = sqs_message_body;
            tweet.sentiment = response.docSentiment.type;

            // Save analyzed tweet into the DB
            console.log('updating this tweet: '+JSON.stringify(tweet));
            dbconnection.query("UPDATE tweets set sentiment='" +  tweet.sentiment + "' where id=" +  tweet.id, function(err, msg) {
              if (err) {
                console.log('Failed updating the sentiment in DB for tweetid - '+tweet.id+': ' + err);
                console.log(err.stacktrace());
              } else {
                console.log('Updated sentiment in DB: ' + msg + ' for tweetid - ' + tweet.id);

                
                // Notify SNS Subscribers
                var sns = new AWS.SNS();

                // --- TODO send tweetID in message!!
                var publishParams = { 
                  TopicArn : "arn:aws:sns:us-west-2:922468305361:tweetsent",
                  Message: JSON.stringify(tweet.id)
                };

                console.log("Publishing to SNS");
                sns.publish(publishParams, function(err, data) {
                  if (err){
                    console.log("Error sending a message "+err); 
                  } else {
                    console.log("SNS push success");
                  }
                }); // end of sns publish

              }
            }); // end of db update

            //--- since no one is currecntly listening to the SNS - emit to client NOW :)
            if (cat === "all" || sqs_message_body.text.indexOf(cat) > -1) {
              console.log("emitting tweet: " + JSON.stringify(tweet));
              socket.emit('twitter-stream', tweet);
              console.log("emitted output point");
            } else {
              console.log("filtered output point");
            }
            //---

          }
          }); // end of alchemy api

        
        // delete message from queue
        var deleteparams = {
          QueueUrl: 'https://sqs.us-west-2.amazonaws.com/922468305361/tweets',
          ReceiptHandle : data.Messages[0].ReceiptHandle
        };
        sqs.deleteMessage(deleteparams, function(err, data){});
      }
  });
}

// var sns = new AWS.SNS();

// var topicArn = 'arn:aws:sns:us-west-2:922468305361:tweetsent';

// var pullParams = { 
//   Protocol: 'http',
//   TopicArn : topicArn,
//   Endpoint: 'http://twittersentimentmap.elasticbeanstalk.com/tweetsent'
// };

// console.log("subscribing to SNS");
// sns.subscribe(pullParams, function(err, data) {
//   if (err){
//     console.log(err, err.stack);
//   } else {
//      console.log("RECIEVED SNS!!!");
//      console.log(data);

//     if (data.SubscriptionArn != 'pending confirmation') {
//         //  sentimentAnalysisSubscriptionArn = data.SubscriptionArn;

//         // TODO pull from DB the tweet with tweetID in message and emit to client
//      }

//  }
// });

// var snsConfirmSubscriptionParams = {
// Token: subscriptionToken, 
// TopicArn: topicArn
// };

// sns.confirmSubscription(snsConfirmSubscriptionParams, function(err, data) {
// if (err) console.log(err, err.stack); 
// else     console.log(data);          
// });
