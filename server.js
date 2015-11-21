var serialport = require('serialport');
var portName = process.argv[2];
if( portName == undefined ) {
    console.log("How to use.");
    console.log("\t>node server.js [portName]");
    console.log("\tUnix/Linux\t/dev/tty.usbserial-XXXXXX");
    console.log("\tWindows\tCOM1,COM2...");
    console.log("\tDemo mode\t DEMO");
    console.log("check your serialName.")
    process.exit();
}

sumCheck = function( buffer ) {    
    var sum = 0;
    for(var i=1 ; i<buffer.length ; i+=2 ){
        sum = (sum + parseInt(buffer.slice(i,i+2),16)) & 0xFF;
    }
    return sum;
};

// Tweliteの受信パケット
var TweliteReceievedPacket = function(buffer) {
    this._rawBuffer = buffer;
    this.deviceId = parseInt(buffer.slice(1,3).toString(), 16);
    this.datatype = buffer.slice(3,5).toString();   // fixed 0x81
    this.packetId = buffer.slice(5,7).toString();
    this.protocol = buffer.slice(7,9).toString();
    this.signal = parseInt(buffer.slice(9,11).toString(), 16);
    this.terminalId = parseInt(buffer.slice(11,19).toString(), 16);
    this.toId = parseInt(buffer.slice(19,21).toString(), 16);
    this.timestamp = parseInt(buffer.slice(21,25).toString(), 16);
    this.repeater_flag = parseInt(buffer.slice(25,27).toString(), 16);
    this.battery = parseInt(buffer.slice(27,31).toString(), 16);
    
    var rawDigitalIn = parseInt(buffer.slice(33,35).toString(), 16);
    this.digialIn = [
        (rawDigitalIn >> 0 & 1) ? true : false,
        (rawDigitalIn >> 1 & 1) ? true : false,
        (rawDigitalIn >> 2 & 1) ? true : false,
        (rawDigitalIn >> 3 & 1) ? true : false,
    ];
    
    var rawDigitalChanged = parseInt(buffer.slice(35,37).toString(), 16);
    this.digialChanged = [
        (rawDigitalChanged >> 0 & 1) ? true : false,
        (rawDigitalChanged >> 1 & 1) ? true : false,
        (rawDigitalChanged >> 2 & 1) ? true : false,
        (rawDigitalChanged >> 3 & 1) ? true : false, 
    ]
    this.analogIn = [
        parseInt(buffer.slice(37,39).toString(), 16),
        parseInt(buffer.slice(39,41).toString(), 16),
        parseInt(buffer.slice(41,44).toString(), 16),
        parseInt(buffer.slice(43,45).toString(), 16),
    ]
    this.analogOffset = parseInt(buffer.slice(45,47).toString(), 16);
    this.checksum = parseInt(buffer.slice(47,49).toString(), 16);
    
    if(sumCheck(buffer) == 0){
        this.isValid = true;
    } else {
        this.isValid = false;
    }
};

// Tweliteの送信パケット
var TweliteSendPacket = function() {
    this.toDeviceId = 0x78; // default: target
    this.digialOut = 0x00;
    this.digialOutChanged = 0x00;
    this.pwm = [ 0xFFFF,0xFFFF,0xFFFF,0xFFFF ];
    
    this.toEncoded = function() {
        var buf = ":";
        buf += ("00" + this.toDeviceId.toString(16)).slice(-2);
        buf += '80';    // command fixed
        buf += '01';    // protcol fixed
        buf += ("00" + this.digialOut.toString(16)).slice(-2);
        buf += ("00" + this.digialOutChanged.toString(16)).slice(-2);
        buf += ("0000" + this.pwm[0].toString(16)).slice(-4);
        buf += ("0000" + this.pwm[1].toString(16)).slice(-4);
        buf += ("0000" + this.pwm[2].toString(16)).slice(-4);
        buf += ("0000" + this.pwm[3].toString(16)).slice(-4);
        buf += "X";     // TODO:replace to valid checksum
        return buf.toUpperCase();
    };
    
    /** 
     * index : 0-3
     * value : boolean
     */ 
    this.setDigitalOut = function(index, value) {
        if( value == true ) {
            this.digialOut |= 1 << index;
            this.digialOutChanged |= 1 << index;
        } else {
            this.digialOutChanged |= 1 << index;
        }
    };
    
    /**
     * index : 0 - 3
     * value : 0 - 1024
     */
    this.setPWM = function(index, value) {
        this.pwm[index] = value;
    }
}


// シリアルポート接続開始
if(portName != "DEMO"){
    var sp = new serialport.SerialPort(portName, {
        baudRate: 115200,
        dataBits: 8,
        parity: 'none',
        stopBits: 1,
        flowControl: false,
        parser: serialport.parsers.readline("\n")
    });
    
    sp.on('data', function(input) {
        var buffer = new Buffer(input, 'utf8');
    
        try {
            console.log("received:" + buffer);
            packet = new TweliteReceievedPacket(buffer);
            clientStatus.setPacket(packet);
        } catch(e) {
            console.log("error:"+e);
            return;
        }
    
    });
    sp.on('close', function(e) {
        console.log("CONNECTION CLOSED");
    });
    
    console.log("serialport:" + portName);
}else{
    var sp = null;
    console.log("DEMO MODE");
}

var ClientStatus = function(){
    var lastReceivedPackets = [];
    var LOST_CONTACT_TIMEOUT = 5*1000;  // 5sec
    
    this.setPacket = function(packet) {
        var id = packet.deviceId;
        lastReceivedPackets[id] = packet;
        var d = new Date();
        packet.lastUpdate = d.getTime();
        console.log("Client " + id + " updated");
    }
    this.getById = function(id) {
        var packet = lastReceivedPackets[id];
        var d = new Date();
        if(packet && packet.lastUpdate > d.getTime() - LOST_CONTACT_TIMEOUT ) {
            return packet;
        }
    }
    this.getList = function(){
        this.gc();
        return this.lastReceivedPackets;
    }
    this.gc = function(){
        var d = new Date();
        for(id in this.lastReceivedPackets) {
            if(this.lastReceivedPackets[id].lastUpdate < d.getTime() - LOST_CONTACT_TIMEOUT) {
                delete this.lastReceivedPackets[id]
            };
        console.log("Client " + id + " lost");
        }
    }
}
var clientStatus = new ClientStatus();



// APIサーバ
var express = require('express');
var app = express(),
    path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// get API 
app.get('/api/engine', function (req, res) {
    var digitalOut = [
        req.query.d1,
        req.query.d2,
        req.query.d3,
        req.query.d4
    ];
    var pwm = [
        req.query.a1, // PWM 0 - 1024
        req.query.a2,
        req.query.a3,
        req.query.a4
    ];
    
    var packet = new TweliteSendPacket();
    for(var i=0;i<digitalOut.length;i++){
        var val = digitalOut[i];
        if(val == '1' || val == 'H' ) {
            packet.setDigitalOut(i, true);
        }else if(val == '0' || val == 'L') {
            packet.setDigitalOut(i, false);    
        }
    }
    for(var i=0;i<pwm.length;i++){
        var val = pwm[i];
        if(val != undefined ) {
            packet.setPWM(i, parseInt(val));
        }
    }
    if(sp != null) {
        sp.write(packet.toEncoded());
        console.log("SEND PACKET:" + packet.toEncoded());
    }else{
        console.log("DEMO PACKET:" + packet.toEncoded());
    }
    
    var result = {
        "status":"OK",
        "packet":packet.toEncoded(),
    };
    res.send(JSON.stringify(result));
});
app.get('/api/status', function (req, res) {
    var id =  req.query.id;
    if( id == undefined ){
        res.send(JSON.stringify(
            {
                "status":"PARAMERROR",
                "error":"id require"
            }
        ));
        return;
    } 
    if( id.slice(0,2) == "0x") {
        id = parseInt(id, 16);
    } else {
        id = parseInt(id, 10);
    }
    var st = clientStatus.getById(id);
    
    if( st == undefined ) {
        var result = {
            "status":"NOT_FOUND",
            "id":id,
        };
    } else {
        var result = {
            "status":"OK",
            "client":st,
        };
    }
    res.send(JSON.stringify(result));
});
app.get('/api/list', function(req , res) {
     res.send(JSON.stringify(clientStatus.getList()));
});

app.listen(8000);


console.log("server start");
