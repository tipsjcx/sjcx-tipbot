// Copyright © 2014 tipsjcx
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/countertipper');
var bcrypt = require('bcrypt');

var blockscan = require('./blockscan.js');
bs = new blockscan();

// Setup the ircbot
var ircbot = require('./ircbot.js');
var ircb = new ircbot(bs);

// set up the twitterbot
var twitterbot = require("./twitterbot.js");
var tbot = new twitterbot(bs);

// set up slack bot
var slackbot = require("./slackbot");
var sbot = new slackbot(bs);

// set up the redditbot
var redditbot = require("./redditbot.js");
var rbot = new redditbot(bs);

// The control server
var net = require('net');
var HOST = '127.0.0.1';
var PORT = 5484;

net.createServer(function(sock) {
    sock.on('data', function(data) {
        var str = data.toString()
        var arr = str.split("\r\n"); // if it contains more than one json string split it
        for(var i = 0; i < arr.length; i++) { // and go trough each json string
           var ut = JSON.parse(arr[i]);
           if (ut.type == "addrPool") {
              console.log("Add " + ut.addr + " to pool");
              bs.addAddrPool(ut.addr);
           }

           if (ut.type == "getWithdrawDB") {
               db.get('withdrawDB').find({},{},function(err,data){
                     sock.write(JSON.stringify(data), function() {
                     });
               });
           }

           if (ut.type == "getBackup") {
               db.get('users').find({},{},function(err,data){
                     sock.write(JSON.stringify(data), function() {
                     });
               });
           }

           // update the DB should be done 15min after you tok out money
           if (ut.type == "updateDB") {
              console.log("updating DB");
              db.get('users').find({},{},function(err,data){
                    for (var i = 0; i < data.length; i++) {
                      bs.getBalance(data[i].addr, function() {});
                    }
              });
           }
        }
    });

    sock.on('close', function(data) {
        console.log('CLOSED: ' + sock.remoteAddress +' '+ sock.remotePort);
    });

}).listen(PORT, HOST);
