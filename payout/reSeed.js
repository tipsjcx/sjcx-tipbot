// Copyright © 2014 tipsjcx

var bitcoin = require("node-bitcoin");
btClient = new bitcoin.Client({
  host: 'localhost',
  port: 8332,
  user: 'test',
  pass: '',
  timeout: 30000
});

var net = require('net');

var client = new net.Socket();
  client.connect(5484, '127.0.0.1', function() {
  console.log('Connected to server');
});
 
client.on('close', function() {
console.log('Connection closed');
});


// Send pool addresses
for(var i = 0; i < 10; i++) {
   btClient.getNewAddress("pool",function(err, addr, resHeaders) {
       if (err) return;
       var json = {type: "addrPool", addr: addr};     
       client.write(JSON.stringify(json));
   });
}

