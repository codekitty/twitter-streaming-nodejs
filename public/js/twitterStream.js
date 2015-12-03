  //Setup heat map and link to Twitter array we will append data to
  var cat = "all";
  var socket;
  var heatmap;
  var markersArray = [];

  var liveTweets = new google.maps.MVCArray();
  heatmap = new google.maps.visualization.HeatmapLayer({
    data: liveTweets,
    radius: 25
  });


function initialize() {
  console.log('initialized');
  //Setup Google Map
  var myLatlng = new google.maps.LatLng(17.7850,-12.4183);
  var light_grey_style = [{"featureType":"landscape","stylers":[{"saturation":-100},{"lightness":65},{"visibility":"on"}]},{"featureType":"poi","stylers":[{"saturation":-100},{"lightness":51},{"visibility":"simplified"}]},{"featureType":"road.highway","stylers":[{"saturation":-100},{"visibility":"simplified"}]},{"featureType":"road.arterial","stylers":[{"saturation":-100},{"lightness":30},{"visibility":"on"}]},{"featureType":"road.local","stylers":[{"saturation":-100},{"lightness":40},{"visibility":"on"}]},{"featureType":"transit","stylers":[{"saturation":-100},{"visibility":"simplified"}]},{"featureType":"administrative.province","stylers":[{"visibility":"off"}]},{"featureType":"water","elementType":"labels","stylers":[{"visibility":"on"},{"lightness":-25},{"saturation":-100}]},{"featureType":"water","elementType":"geometry","stylers":[{"hue":"#ffff00"},{"lightness":-25},{"saturation":-97}]}];
  var myOptions = {
    zoom: 2,
    center: myLatlng,
    mapTypeId: google.maps.MapTypeId.ROADMAP,
    mapTypeControl: true,
    mapTypeControlOptions: {
      style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
      position: google.maps.ControlPosition.LEFT_BOTTOM
    },
    styles: light_grey_style
  };
  var map = new google.maps.Map(document.getElementById("map_canvas"), myOptions);

  
  heatmap.setMap(map); 
  //alert('1');
  //debugger;
  if(io !== undefined) {
    // Storage for WebSocket connections
    socket = io.connect();

    socket.on('trend-update', function (data) {
      var element = document.getElementById(data.city_id);
      element.setInnerHTML(data.top_trend);
    });

    // This listens on the "twitter-steam" channel and data is 
    // received everytime a new tweet is receieved.
    socket.on('twitter-stream', function (data) {

      
   if (data.sentiment == 'positive') {

      var circle ={
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: 'green',
          fillOpacity: .4,
          scale: 4.5,
          strokeColor: 'white',
          strokeWeight: 1
      };
    } else if (data.sentiment == 'negative') {
      var circle ={
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: 'red',
          fillOpacity: .4,
          scale: 4.5,
          strokeColor: 'white',
          strokeWeight: 1
      };      
    } else {
      var circle ={
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: 'yellow',
          fillOpacity: .4,
          scale: 4.5,
          strokeColor: 'white',
          strokeWeight: 1
      };      
    }

      //Add tweet to the heat map array.
      var tweetLocation = new google.maps.LatLng(data.longitude,data.latitude);
      //liveTweets.push(tweetLocation);

      var marker = new google.maps.Marker({
        position: tweetLocation,
        icon:circle,
        map:map
      });
      markersArray.push(marker);

      

      //Flash a dot onto the map quickly
      // var image = "css/small-dot-icon.png";
      // var marker = new google.maps.Marker({
      //   position: tweetLocation,
      //   map: map,
      //   icon: image
      // });
      // setTimeout(function(){
      //   marker.setMap(null);
      // },600);

    });

    // Listens for a success response from the server to 
    // say the connection was successful.
    socket.on("connected", function(r) {

      //Now that we are connected to the server let's tell 
      //the server we are ready to start receiving tweets.
      socket.emit("start tweets");
    });
  }
}

function getTweetInCategory()
{
  // get selected category
  cat = document.getElementById('category').value;
 
  // clear map
  liveTweets.clear();
  //heatmap.setMap(null);

  
  socket.emit("tweets in cat" , cat);

 }
function getTweetInCustom()
{
  // get selected category
  cat = document.getElementById('trend').value;
 
  // clear map
  liveTweets.clear();
  clearOverlays();
  //heatmap.setMap(null);

  
  socket.emit("tweets in cat" , cat);

 }

 function clearOverlays() {
  for (var i = 0; i < markersArray.length; i++ ) {
    markersArray[i].setMap(null);
  }
  markersArray.length = 0;
}
