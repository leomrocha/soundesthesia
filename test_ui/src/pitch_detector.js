/*
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Copyleft (c) Leonardo M. Rocha, 
Heavily modified from the original example and made a lib to use with web workers


Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
////////////////////////////////////////////////////////////////////////////////
//
//This file is meant to be run as a web worker
//
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//vars
////////////////////////////////////////////////////////////////////////////////

//rename this for avoiding conflicts later
this.self = this;

//
self.audioContext = null;    

//
self.analyser = null;

//current detection's state
self.confidence = 0;
self.currentPitch = 0;
self.curentMidiId = 0;

////////////////////////////////////////////////////////////////////////////////
//constants TODO make this parametrable
////////////////////////////////////////////////////////////////////////////////

self.buflen = 2048;
self.buf = new Uint8Array( buflen );

self.MINVAL = 134;  // 128 == zero.  MINVAL is the "minimum detected signal" level.
self.MIN_CONFIDENCE = 10;  //confidence in the detection
self.MIN_RMS = 0.01;


//TODO change this for a better description (use the one in my AS3 code)
self.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

////////////////////////////////////////////////////////////////////////////////
//Capturing mic
////////////////////////////////////////////////////////////////////////////////

//Tries to get the user media, will fail if not latest firefox, opera or chrome
self.getUserMedia = function(dictionary, callback) {
    try {
        navigator.getUserMedia = 
        	navigator.getUserMedia ||
        	navigator.webkitGetUserMedia ||
        	navigator.mozGetUserMedia;
        navigator.getUserMedia(dictionary, callback, self.error);
    } catch (e) {
        //TODO send this to error function
        alert('getUserMedia threw exception :' + e);
    }
}

//callback for the getUserMedia
self.gotStream = function(stream) {
    // Create an AudioNode from the stream.
    var mediaStreamSource = audioContext.createMediaStreamSource(stream);

    // Connect it to the destination.
    self.analyser = audioContext.createAnalyser();
    self.analyser.fftSize = 2048;
    mediaStreamSource.connect( self.analyser );
    //first update
    updatePitch();
};

////////////////////////////////////////////////////////////////////////////////
//DSP
////////////////////////////////////////////////////////////////////////////////
self.noteFromPitch = function( frequency ) {
    var noteNum = 12 * (Math.log( frequency / 440 )/Math.log(2) );
    return Math.round( noteNum ) + 69;
};

self.frequencyFromNoteNumber = function( note ) {
    return 440 * Math.pow(2,(note-69)/12);
};

self.centsOffFromPitch = function( frequency, note ) {
    return ( 1200 * Math.log( frequency / frequencyFromNoteNumber( note ))/Math.log(2) );
};
//
self.autoCorrelate = function( buf, sampleRate ) {
    var MIN_SAMPLES = 4;	// corresponds to an 11kHz signal
    var MAX_SAMPLES = 1000; // corresponds to a 44Hz signal
    var SIZE = 1000;
    var best_offset = -1;
    var best_correlation = 0;
    var rms = 0;

    self.confidence = 0;
    self.currentPitch = 0;

    if (buf.length < (SIZE + MAX_SAMPLES - MIN_SAMPLES))
	    return;  // Not enough data

    for (var i=0;i<SIZE;i++) {
	    var val = (buf[i] - 128)/128;
	    rms += val*val;
    }
    rms = Math.sqrt(rms/SIZE);

    for (var offset = MIN_SAMPLES; offset <= MAX_SAMPLES; offset++) {
	    var correlation = 0;

	    for (var i=0; i<SIZE; i++) {
		    correlation += Math.abs(((buf[i] - 128)/128)-((buf[i+offset] - 128)/128));
	    }
	    correlation = 1 - (correlation/SIZE);
	    if (correlation > best_correlation) {
		    best_correlation = correlation;
		    best_offset = offset;
	    }
    }
    if ((rms> self.MIN_RMS)&&(best_correlation > self.MIN_BEST_CORR)) {
	    self.confidence = best_correlation * rms * 10000;
	    self.currentPitch = sampleRate/best_offset;
	    // console.log("f = " + sampleRate/best_offset + "Hz (rms: " + rms + " confidence: " + best_correlation + ")")
    }
//	var best_frequency = sampleRate/best_offset;
};

self.updatePitch = function( time ) {
    var cycles = new Array;
    self.analyser.getByteTimeDomainData( buf );
    
    // possible other approach to confidence: sort the array, take the median; go through the array and compute the average deviation
    self.autoCorrelate( buf, audioContext.sampleRate );

 	if (self.confidence < self.MIN_CONFIDENCE) {
 	    //ehmm non confident
 	    //TODO do something about it
 	} else {
 	    //TODO post process to filter out errors and peaks
     	var note =  noteFromPitch( self.currentPitch );
	    var detune = centsOffFromPitch( self.currentPitch, note );
 	    //form the response
 	    var ret = {
 	        //"midi_id": self.curentMidiId,
 	        "frequency": self.currentPitch,
 	        "confidence": self.confidence,
 	        "detune": detune,
 	        "note": note
 	        };
        //send signal out of worker
        console.log("detected note is: ", note, self.currentPitch);
        postMessage(ret);
    }

};


////////////////////////////////////////////////////////////////////////////////
//interaction functions
////////////////////////////////////////////////////////////////////////////////
self.error = function() {
    //TODO something else
    //Stop processing 
    //stop all things that bother
    //send message to user
    alert('Stream generation failed.');
};
//start processing
self.startCapturing = function(){
    self.getUserMedia({audio:true}, gotStream);
};
//stop processing
self.stopCapturing = function(){
    ///
    self.getUserMedia({audio:false});
};

/* // this is not working on a web worker...
self.init = function(){
    console.log("setting up audio context");
    window.AudioContext = window.AudioContext || window.webkitAudioContext;

    self.audioContext = new AudioContext();
    
    //TODO all the other things that need to be started
};*/

//self.init();
////////////////////////////////////////////////////////////////////////////////
//Web worker interaction
////////////////////////////////////////////////////////////////////////////////

onmessage = function(e){
    console.log("this is the web worker receiving message: ");
    console.log(e);
    console.log(e.data);
    //TODO
    //if start
    if (e.data === "start"){
        console.log("start processing");
        self.start();
    }else if(e.data === "stop"){
    
    }else if(e.data["function"] === "setContext"){
        //TODO this is not working either, web worker can NOT access AudioContext :/
        console.log("trying to hack up the audiocontext");
        self.audioContext = e.data["audioContext"];
    }
    //else if stop
    //else, NOOOOO
};


