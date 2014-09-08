// Copyright © 2014 tipsjcx

var Twit = require('twit')
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/countertipper');

// Constructor
function twitterbot(bs) {
   var T = new Twit({
    consumer_key:         '',
    consumer_secret:      '',
    access_token:         '',
    access_token_secret:  ''
  });

   var config = {nick: "tipsjcx"};
   
   // get a stream of everything sendt to the bot
   var stream = T.stream('statuses/filter', { track: config.nick})
   
   stream.on('tweet', function (tweet) {      
      var arr = tweet.text.split(" ");
      if (arr[0] != "@"+config.nick) return;
      if (arr[1] == "register") handleRegister(tweet.user.screen_name, bs, T);
      if ((arr[1] == "tip") && (arr.length > 4)) handleTip(tweet.user.screen_name, arr[2], arr[3], arr[4], bs, T);
      if ((arr[1] == "balance")) handleBalance(tweet.user.screen_name, bs, T);
      if ((arr[1] == "withdraw")&&(arr[3] == "sjcx")) handleWithdraw(tweet.user.screen_name, arr[4], arr[2] , bs, T);
   }); 
}


var handleWithdraw = function(from, to, quantity, bs, T) {
    db.get('users').findOne({"twitter":from},{},function(err,data){
        if (err) return;
        if (!data) return;
        console.log("Withdraw " + quantity + " from " + data.addr + " to " + to + "");
        bs.withdraw(data.addr, quantity, to, 0.002, function(status) {
           T.post('statuses/update', { status: "@"+from+" "+status}, function(err, data, response) {}); 
        });
    });   
}

var handleBalance = function(from, bs, T) {
   console.log(from);
   db.get('users').findOne({"twitter":from},{},function(err,data){
      console.log(data);
      if (err) return;
      if (!data) return;
        bs.getBalance(data.addr, function(balance) {  
          T.post('statuses/update', { status: "@"+from+" Your balance is " + balance.SJCX +" SJCX " + balance.BTC + " BTC" }, function(err, data, response) {}); 
      });
      
   });
}

// @tipsjcx tip @tipsjcx 100 sjcx
var handleTip = function(from, to, sjcx, asset, bs, T) {
   if (to == from) return; // don't tip your self
   if (asset != "sjcx") return;
   to = to.substring(1); // cut away the @
   console.log("Looking for " +to );
   db.get('users').findOne({"twitter":to},{},function(err,tdata){
      if (err) return;
      if (!tdata) return;
      db.get('users').findOne({"twitter":from},{},function(err,fdata){
          if (err) return;
          if (!fdata) return;
          console.log(fdata.addr + " is tipping " + tdata.addr );
          bs.send(fdata.addr, tdata.addr, "SJCX", sjcx , function(status) {
              T.post('statuses/update', { status: "@"+from+" "+status }, function(err, data, response) {});
          });
      });
   });
};

var handleRegister = function(from, bitcoinNode, T) {
  db.get('users').findOne({"twitter":from},{},function(err,data){ // Check that this user is not in the DB
      if (data) return;
      bs.getNewAddress(function(addr)   // get new addres
      {
            if (err) return console.log(err); 
            db.get('users').update({addr: addr}, {$set:{twitter: from}},{}, function(err, result) { // update the address line with user info    
               if (err) return console.log(err); 
               T.post('statuses/update', { status: "@"+from+" your new address is " + addr }, function(err, data, response) {});
            });
     });
  });
};

// export the class
module.exports = twitterbot;




