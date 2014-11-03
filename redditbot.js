var rawjs = require('raw.js');
// assign a user-agent name
//  see reddit API rules https://github.com/reddit/reddit/wiki/API
var reddit = new rawjs("tipsjcx/1.0");
var request = require('request');
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/countertipper');

//constructor
function redditbot(bs){
    // with the bot account create a reddit script 'app' and use the appId and secret
    reddit.setupOAuth2("app-id", "app-secret");
    // authenticate with the bots username and password
    reddit.auth({"username": "tipBotUserName", "password": "password"}, function(err, response) {
        if(err) {
            console.log("Unable to authenticate user: " + err);
        }
    });
    var config = {nick:"tipBotUserName"};
    var CommentStream = rawjs.CommentStream;
    var stream = new CommentStream();
    stream.on('comment', function(comment) {
        var isCommentForMe = comment.body.split(" ");
        if (isCommentForMe[0] != "+/u/"+config.nick) return;
        if (isCommentForMe[1] == undefined) return;
        var command = isCommentForMe[1].replace(/(\r\n|\n|\r)/gm,"");
        if (command == "register") handleRegister(comment.author,comment.name,reddit,bs);
        if (command == "balance") handleBalance(comment.author,comment.name,reddit,bs);
        if ((command == "tip") &&(isCommentForMe.length > 2)) handleTip(comment.author, isCommentForMe[2].replace(/(\r\n|\n|\r)/gm,""), comment.parent_id, comment.name, reddit, bs);
        if ((command == "withdraw") && (isCommentForMe.length > 3)) handleWithdraw(comment.author, isCommentForMe[3].replace(/(\r\n|\n|\r)/gm,""), isCommentForMe[2].replace(/(\r\n|\n|\r)/gm,""), comment.name, reddit, bs);

     });
     stream.on('error', function(e) {
        console.log("Error: " + e);
     });
}
var handleRegister = function(from,replyTo,reddit,bs) {
    console.log(from+" is registering..his comment:name is "+replyTo);
    db.get('users').findOne({"reddit": from}, {}, function (err, data) { // Check that this user is not in the DB
        if (data) return;
        bs.getNewAddress(function (addr)   // get new addres
        {
            console.log(addr);
            if (err) return console.log(err);
            db.get('users').update({addr: addr}, {$set: {reddit: from}}, {},function (err, result) { // update the address line with user info
                if (err) return console.log(err);

                reddit.comment(replyTo, "/u/" + from + " your deposit address is: " + addr, function (err) {
                    if (err) return console.log(err);
                });
            });
        });
    });
};
var handleTip = function(from,amount,to,replyTo,reddit,bs){
// get amount of storj and type (kb, mb, gb) , amountOfStorj[0] and amountOfStorj[1]
// example amount = 100kb
// var amountOfStorj = amount.match(/[a-zA-Z]+|[0-9]+/g);
    var toUserName = grabUserNameFromParentId(to,function(toAuthor){
        if (toAuthor == from) return; // don't tip your self
        db.get('users').findOne({reddit:toAuthor},{},function(err,tdata){
            if (err) return;
            if (!tdata) return console.log(toAuthor+" is not registered.");
            db.get('users').findOne({"reddit":from},{},function(err,fdata){
                if (err) return;
                if (!fdata) return;
                console.log(fdata.addr + " is tipping " + tdata.addr);
                console.log(fdata.reddit + " is tipping "+ tdata.reddit);
//                var sendAmount = getMetricAmount(amountOfStorj,function(amount){
//                    console.log(amount);
                bs.send(fdata.addr, tdata.addr, "SJCX", amount, function(status) {
                    reddit.comment(replyTo, "/u/" + from + " " + status, function (err) {
                        if (err) return console.log(err);
                    });
                });
//                });
            });
        });
    });
};
var handleBalance = function(from,replyTo,reddit,bs){
   console.log(from);
   db.get('users').findOne({"reddit":from},{},function(err,data){
      console.log(data);
      if (err) return;
      if (!data) return;
        bs.getBalance(data.addr, function(balance) {
          reddit.comment(replyTo, "/u/" + from + " your balance is " + balance.SJCX + " SJCX" + balance.BTC + " BTC", function(err){
              if (err) return console.log(err);
          });
        });
    });
};
var handleWithdraw = function(from,to,quantity,replyTo,reddit,bs){
    db.get('users').findOne({"reddit":from},{},function(err,data){
        if (err) return;
        if (!data) return;
        console.log("Withdraw " + quantity + " from " + data.addr + " to " + to + "");
        bs.withdraw(data.addr, quantity, to, 0.0025, function(status) {
            reddit.comment(replyTo, "/u/" + from + " " + status, function(err){
                if (err) return console.log(err);
            });
        });
    });
};
// This is where you can set tip amounts in kb, mb, gb, or anything you like :)
//var getMetricAmount = function(amountAndMetric,amount){
//    amount(amountAndMetric[0]);
//    if (amountAndMetric[1] == "kb"){
//        var newAmount = parseInt(amountAndMetric[0]);
//        return newAmount*1000;
//    }
//    if (amountAndMetric[1] == "mb") {
//        var newAmount = parseInt(amountAndMetric[0]);
//        return newAmount*1000000
//    }
//    if (amountAndMetric[1] == "gb"){
//        var newAmount = parseInt(amountAndMetric[0]);
//        return newAmount*1000000000
//    }
//};
var grabUserNameFromParentId = function (parentId,author) {
    request('http://www.reddit.com/api/info.json?id='+parentId, function(error, response, body) {
        if (!error && response.statusCode ==200){
            getRedditName = JSON.parse(body);
            author(getRedditName.data.children[0].data.author);
        }
    })
};

module.exports = redditbot;
