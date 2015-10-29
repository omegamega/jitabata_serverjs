var serialport = require("serialport");

var portName = "COM3";
var sp = new serialport.SerialPort(portName, {
	baudRate: 115200,
	dataBits: 8,
	parity: 'none',
	stopBits: 1,
	flowControl: false,
	parser: serialport.parsers.readline("\n")
});

var TweliteReceievedPacket = function(buffer) {
    var DATATYPE_RECEIVE = '81';
    
    this.getRawString = function() {
        return this.data;
    };

    this._rawBuffer = buffer;
    this.fromDeviceId = buffer.slice(1,3).toString();
    this.datatype = buffer.slice(3,5).toString();   // fixed 0x81
    this.packetId = buffer.slice(5,7).toString();
    this.protcol = buffer.slice(7,9).toString();
    this.signal = buffer.slice(9,11).toString();
    this.terminal = buffer.slice(11,19).toString();
    this.toId = buffer.slice(19,21).toString();
    this.timestamp = buffer.slice(21,25).toString();
    this.repeater_flag = buffer.slice(25,27).toString();
    this.battery = buffer.slice(27,31).toString();
    this.digialIn = buffer.slice(33,35).toString();
    this.digialChanged = buffer.slice(35,37).toString();
    this.analogIn = buffer.slice(37,45).toString();
    this.analogOffset = buffer.slice(45,47).toString();
    this.checksum = buffer.slice(47,49).toString();
};

var TweliteSendPacket = function() {
    this.toDeviceId = 0x78; // default: target
    this.command = 0x80;    // fixed
    this.protcol = 0x01;    // fixed
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
            this.digialOut |= 1 >> index;
            this.digialOutChanged |= 1 >> index;
        } else {
            this.digialOutChanged |= 1 >> index;
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

sp.on('data', function(input) {
    var buffer = new Buffer(input, 'utf8');

    try {
        console.log("received:" + buffer);
        data = new TweliteReceievedPacket(buffer);
//        console.log(data);
    } catch(e) {
        console.log("error:"+e);
        return;
    }

});

sp.on('close', function(e) {
    console.log("CLOSED");
    console.log(e);
})



var express = require("express");
var app = express();

app.get('/', function (req, res) {
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
            console.log("PWM" +val);
        }
    }
    sp.write(packet.toEncoded());
    console.log("SEND PACKET");
    console.log(packet.toEncoded());
    
    res.send("SENDED");
});
app.listen(8000);


console.log("server start");
