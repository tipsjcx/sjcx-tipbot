var express = require('express');
var http = require('http');
var path = require('path');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/countertipper');

// Delete this before push
var secret_token = "";

var slackbot = function(bs) {
    var app = express();

    app.set('port', process.env.PORT || 3000);

    // Request body parsing middleware should be above methodOverride
    app.use(bodyParser.urlencoded({
      extended: true
    }));
    app.use(bodyParser.json());
    app.use(methodOverride());


    app.post('/slack', function(req, res){
      if (req.body.token != secret_token) return;

      var arr = req.body.text.split(" ");
      if ((arr[1] == "balance")) handleBalance(req.body.user_id, bs, res);
      if (arr[1] == "register") handleRegister(req.body.user_name, req.body.user_id, bs, res);
      if ((arr[1] == "tip") && (arr.length > 4) && (arr[2].indexOf("<@") == 0)) handleTip(req.body.user_id, arr[2], arr[3], arr[4], bs, res); 
      if ((arr[1] == "withdraw")&&(arr[3] == "sjcx")) handleWithdraw(req.body.user_id, arr[4], arr[2] , bs, res);
    });

    http.createServer(app).listen(app.get('port'), '', function(){
      console.log('Express server listening on port ' + app.get('port'));
    });

    return app;
};

var handleWithdraw = function(from, to, quantity, bs, res) {
    db.get('users').findOne({"slackid":from},{},function(err,data){
        if (err) return;
        if (!data) return;
        console.log("Withdraw " + quantity + " from " + data.addr + " to " + to + "");
        bs.withdraw(data.addr, quantity, to, 0.002, function(status) {
           res.json({ text: status}); 
        });
    });   
}

var handleTip = function(from, to, sjcx, asset, bs, res) {
   to = to.substring(2, to.length-1); // cut away the <@ id >
   if (to == from) return; // don't tip your self
   if (asset != "sjcx") return;
   db.get('users').findOne({"slackid":to},{},function(err,tdata){
      if (err) return;
      if (!tdata) return;
      db.get('users').findOne({"slackid":from},{},function(err,fdata){
          if (err) return;
          if (!fdata) return;
          console.log(fdata.addr + " is tipping " + tdata.addr );
          bs.send(fdata.addr, tdata.addr, "SJCX", sjcx , function(status) {
              res.json({ text: status });
          });
      });
   });
};

var handleBalance = function(from, bs, res) {  
   db.get('users').findOne({"slackid":from},{},function(err,data){
      if (err) return;
      if (!data) return;
        bs.getBalance(data.addr, function(balance) {
          res.json({"text" : "Your balance is " + balance.SJCX +" SJCX " + balance.BTC + " BTC" }); 
      });
   });
}

var handleRegister = function(from, id, bitcoinNode, res) {
  db.get('users').findOne({"slackid":id},{},function(err,data){ // Check that this user is not in the DB
      if (data) return;
      bs.getNewAddress(function(addr)   // get new addres
      {
            if (err) return console.log(err); 
            db.get('users').update({addr: addr}, {$set:{slackid: id, slackun: from}},{}, function(err, result) { // update the address line with user info    
               if (err) return console.log(err); 
               res.json({"text": from + " your new address is " + addr });
            });
     });
  });
};

module.exports = slackbot;