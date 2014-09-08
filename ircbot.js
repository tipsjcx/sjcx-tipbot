// Copyright © 2014 tipsjcx

var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/countertipper');
var bcrypt = require('bcrypt');

var irc = require("irc");

var config = {
	channels: ["#storj"],
	server: "irc.freenode.net",
	botName: "tipsjcx"
};

var accounts = []; // list of everyone who has logged in

var bot = new irc.Client(config.server, config.botName, {channels: config.channels}); // Connect to server and setup the irc object

// Constructor
function ircbot(bs) {
  bot.addListener('error', function(message) {
    console.log('error: ', message);
  });

  // Listen for messages
   bot.addListener("message", function(from, to, text, message) {  
   var arr = text.split(" ");
 
   if ((arr[0] == "tip") && (arr.length > 3)) handleTip(from, arr[1], arr[2], arr[3], to, bs);
   if ((arr[0] == "register")&&(to == config.botName)) handleRegister(from, arr[1], arr[2], bs);
   if ((arr[0] == "login")&&(to == config.botName)) handleLogin(from, arr[1], arr[2]);
   if ((arr[0] == "balance")&&(to == config.botName)) handleBalance(from, bs);
   if ((arr[0] == "help")&&(to == config.botName)) handleHelp(from);
   if ((arr[0] == "withdraw")&&(to == config.botName)&&(arr[2] == "sjcx")) handleWithdraw(from, arr[3], arr[1] , bs);     
});
 

// Listen for people leaving and log them out
   bot.addListener("part", function(channel, nick, reason, message) {
      for(var i = 0; i < accounts.length; i++) {
         if (accounts[i].nick == nick) accounts.splice(i,1);
      }
    });
}

var handleWithdraw = function(from, to, quantity, bs) {
    var addr = "";
    for(var i = 0; i < accounts.length; i++) {
       if (accounts[i].nick == from) {
          addr = accounts[i].addr;
       }
    }
    if (addr == "") {
        bot.say(from, "You are not logged in");
        return;
    }

    console.log("Withdraw " + quantity + " from " + addr + " to " + to + "");

    bs.withdraw(addr, quantity, to, 0.002, function(status) {
      bot.say(from, status);
    });
}


var handleTip = function(from, nick, stck, asset, to, bs) {
   if (asset != "sjcx") return;
   var addr = null;
   var fromaddr = null;

   for(var i = 0; i < accounts.length; i++) {
      if (accounts[i].nick == nick) {
         addr = accounts[i].addr;
      }

       if (accounts[i].nick == from) {
         fromaddr = accounts[i].addr;
       }
   }
   
   if (nick == from) {
      bot.say(to, "You can't tip yourself");
      return;
   } 
  
   if (addr == null) {
      bot.say(to, "I don't know a " + nick);
      return;
   }

    if (fromaddr == null) {
      bot.say(to, "You are not loged in");
      return;
   }
    
  // console.log("tip from " + fromaddr + " to " + addr);
   bs.send(fromaddr, addr, "SJCX", stck , function(status) {
      bot.say(to, status);
    });
  
   
};

var handleRegister = function(from, username, password, bs) {
  db.get('users').findOne({"username":username},{},function(err,data){
     if (data) {bot.say(from, "Username is taken"); return;} // If the user is allready there return
     bs.getNewAddress(function(addr)   
     {
        bcrypt.hash(password, 10, function(err, hash) { // encrypt password
            if (err) return console.log("bcrypt error>" + err); 
        
            db.get('users').update({addr: addr}, {$set:{username: username, password: hash, addr: addr}},{}, function(err, result) { // update the address line with user info                          
               if (err) return console.log(err); 
               bot.say(from, "Your new address is " + addr);
               bot.say(from, "Beta test!!!! Use this at your own risk! Anything might happen to your assets/information at any time.");
               bot.say(from, "There is a 0.002 BTC withdraw fee");
            });
         });     
     });
   });
}

var handleLogin = function(from, username, password) {
   console.log(from + " is logging in with " + username);
   db.get('users').findOne({"username":username},{},function(err,data){
      if (err) { console.log(err); return; }
      if (!data) {return;}
      bcrypt.compare(password, data.password, function(err, res) {
           if (!res) {return;}
           accounts.push({nick: from, addr: data.addr});
           bot.say(from, "You are logged in. Your address is " + data.addr);
      });
   }); 
}

var handleBalance = function(from, bs) {
    var addr = "";
     for(var i = 0; i < accounts.length; i++) {
       if (accounts[i].nick == from) addr = accounts[i].addr;
     }
    
    bs.getBalance(addr, function(balance) {      
       bot.say(from, "Your balance is " + balance.SJCX +" SJCX " + balance.BTC + " BTC"); }
    );
};

var handleHelp = function(from) {
    bot.say(from, "Commands:");
    bot.say(from, "register username password");
    bot.say(from, "login username password");
    bot.say(from, "tip user 100 sjcx");
};


// export the class
module.exports = ircbot;
