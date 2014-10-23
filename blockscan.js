// Copyright © 2014 tipsjcx

var request = require("request");
var mongo = require('mongodb');
var monk = require('monk');
var db = monk('localhost:27017/countertipper');
var EventEmitter = require("events").EventEmitter;

var ee = new EventEmitter();
var getAddrLine = []; // get new address que

// Constructor
function blockscan() {
   // event called when a new address is ready
   ee.on("newAddr", function (addr) {   
      var cb = getAddrLine.pop();
      cb(addr);
      if (getAddrLine.length > 0) getAddrFromDB(); // if there are more in line
   });
}

// gets the BTC balance from blockchain.info
var getBTCBalance = function(addr, cb) {
   var url = "http://blockchain.info/address/"+addr+"?format=json&limit=0";
   request({
      url: url,
      json: true
    }, function (error, response, body) {
      if (error && response.statusCode != 200) { console.log("blockchain.info error1");return; }
         if (!body)  {cb(0); return;}
         var balance = body.final_balance;
         if (balance > 0) {
            balance = balance/100000000;
         }
        
         cb(balance);
   });
};

var getblockchainBalance = function(addr, cb) {
  var url = "http://xcp.blockscan.com/api2.aspx?module=balance&address="+addr;
  var sjcxbal = 0;

   request({
      url: url,
      json: true
    }, function (error, response, body) {
      
      if ((!error) && (response.statusCode == 200) && (body) && (body.status == "success")) 
      {        
         body.data.indexOf("SJCX");
      
         for(var i = 0; i < body.data.length;i++){
            if (body.data[i].asset == "SJCX") { // if its sjcx use it
               sjcxbal = parseInt(body.data[i].balance);
            }
         }
      } else
      {} 

      getBTCBalance(addr, function(btcbal) {
         cb({BTC: btcbal, SJCX: sjcxbal});    
      });
      
   });
};

// update the db, balance is the balance in the blockchain
var updateDB = function(addr,cb) {
  getblockchainBalance(addr, function(bal){ 
     db.get('users').findOne({addr: addr},{},function(err,data){
        if (!data) {console.log("updateDB error"); return; }
        if ((bal.SJCX > data.balance) || (bal.BTC > data.BTCbalance)) { // If blockchain balance is bigger than the on in the database funds has been addes
           var added = bal.SJCX-data.balance;
           var BTCadded = bal.BTC-data.BTCbalance;
           var newDBbalace = data.dbbalance+added;
           var newBTCDBbalace = data.dbBTCbalance+BTCadded;
           db.get('users').update({addr: addr}, {$set:{balance:bal.SJCX, dbbalance:newDBbalace, BTCbalance: bal.BTC, dbBTCbalance: newBTCDBbalace}},{}, function(err, result) {
              cb({SJCX: newDBbalace, BTC: newBTCDBbalace});
           });
        } 
           else 
        {
             if ((bal.SJCX < data.balance) || (bal.BTC < data.BTCbalance)) { // if money has gone out, update
                db.get('users').update({addr: addr}, {$set:{balance:bal.SJCX, BTCbalance: bal.BTC}},{}, function(err, result) {});
             }

             cb({SJCX: data.dbbalance, BTC: data.dbBTCbalance});
        }
     });
   });
};

blockscan.prototype.getBalance = function(addr, cb) {
   updateDB(addr, function(bal){  // wait for the DB to update
      cb(bal);
   });
};

blockscan.prototype.send = function(source, destination, asset, quantity , cb) {
 var iquantity = parseInt(quantity);
 updateDB(source, function(){ // update the dbbalance of the source address
    db.get('users').findOne({addr: source},{},function(err,sdata){
       if (sdata.dbbalance < iquantity) {cb("insufficient funds"); return; }
       db.get('users').findOne({addr: destination},{},function(err,ddata){   
          if (err) {cb("error"); return; }
          if (!ddata) {cb("error"); return; }
          db.get('users').update({addr: sdata.addr}, {$set:{dbbalance:(sdata.dbbalance-iquantity)}},{}, function(err, result) {});
          db.get('users').update({addr: ddata.addr}, {$set:{dbbalance:(ddata.dbbalance+iquantity)}},{}, function(err, result) {});
          db.get('log').insert({from: sdata.username, to: ddata.username, quantity: quantity}, function(err, result) {});
          cb("OK");
       });
  });
    
 });
}; 

// Get the address from the seed table
var getAddrFromDB = function() {
      db.get('seedDB').findOne({},{},function(err,data){       
         if (err) {ee.emit("newAddr", "err");  return;}
         if (!data) {ee.emit("newAddr", "err");  return;}
         var addr = data.addr;
       
         db.get('seedDB').remove({addr :addr},{},function(err,data) {
            if (err) ee.emit("newAddr", "err");  
            else {
               db.get('users').insert({addr:addr, balance: 0, dbbalance: 0, BTCbalance: 0, dbBTCbalance: 0}, function (err, doc) {
                 ee.emit("newAddr", addr); // new address ready
               });                   
            }
          }); 
      });
}

blockscan.prototype.getNewAddress = function(cb) {
    getAddrLine.push(cb); // add them to the que. So we don't get the same value twice.
    if (getAddrLine.length == 1) getAddrFromDB();    // you are the only one in line. Initiate the function
};


blockscan.prototype.addAddrPool = function(addr) {
      db.get('seedDB').insert({addr:addr}, function (err, doc) {});
};

blockscan.prototype.withdraw = function(addr, quantity, to, fee, cb) {
  db.get('users').findOne({addr: addr},{},function(err,data){
     if (err) {cb("error"); return; }
     if (!data) {cb("error"); return; }
     if (data.dbbalance < quantity) {cb("insufficient funds"); return; }
     if (data.dbBTCbalance < fee) {cb("insufficient funds"); return; }
     db.get('users').update({addr: addr}, {$set:{dbbalance:(data.dbbalance-quantity), dbBTCbalance: (data.dbBTCbalance-fee) }},{}, function(err, result) {
        if (err) return;
        db.get('withdrawDB').insert({from:addr, quantity: quantity, to: to}, function (err, doc) {
           if (err) return;
           cb("ok");
        });
     });
  });
};

// export the class
module.exports = blockscan;
