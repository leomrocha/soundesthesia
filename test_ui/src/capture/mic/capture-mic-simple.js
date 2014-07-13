
/*
For this file and service ONLY
The MIT License (MIT)

Copyright (c) 2014 Chris Wilson

Copyleft (c) Leonardo M. Rocha, 
Heavily modified from the original example and made a lib to use with angularjs as a service

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
var micCaptureService = angular.module("capture.mic.service", ["midi.pubsub.service"]);
////////////////////////////////////////////////////////////////////////////////
//service for audio capture in javascript
//TODO add webworker mode -> not possible for web workers do not allow capturing AudioContext
//TODO add flash fallback (if flash module is available)

////////////////////////////////////////////////////////////////////////////////
micCaptureService.service('micCaptureService', ['$timeout', 'pubSubMIDI', function($timeout, pubSubMIDI) {

    console.log("seting up micCaptureService");
   
    //rename this for avoiding conflicts later
    this.self = this;
    //
    self.audioContext = null;    
    //timer
    self.timeoutObj = null;
    //status
    self.running = false;
    //
    self.analyser = null;

    //current detection's state
    self.confidence = 0;
    self.currentPitch = 0;
    self.curentMidiId = 0;
    
    //current midi states:
    self.notesStatus = [];

    ////////////////////////////////////////////////////////////////////////////////
    //constants TODO make this parametrable
    ////////////////////////////////////////////////////////////////////////////////

    self.buflen = 2048;
    self.buf = new Uint8Array( buflen );

    self.MINVAL = 134;  // 128 == zero.  MINVAL is the "minimum detected signal" level.
    self.MIN_CONFIDENCE = 10;  //confidence in the detection
    self.MIN_RMS = 0.01;
    self.MIN_BEST_CORR = 0.01;


    //TODO change this for a better description (use the one in my AS3 code)
    self.noteStrings = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];


    //things to be able to play
    //TODO make the calls more general, although for the moment this works
    self.playNote= function(midi_id){
        console.log("calling midi service note on: ", midi_id);
        if(! self.notesStatus[midi_id] === true){
            self.notesStatus[midi_id] = true;
            MIDI.noteOn(0, midi_id, 127, 0);
        }
    };
    
    self.stopNote= function(midi_id){
        console.log("calling midi service note off from pitch detector: ", midi_id);
        if(self.notesStatus[midi_id] === true){
            self.notesStatus[midi_id] = false;
            MIDI.noteOff(0, midi_id, 0);
        }
        
    };
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
        if ((rms > self.MIN_RMS)&&(best_correlation > self.MIN_BEST_CORR)) {
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
     	    console.log("no confidence for pitch: ", self.currentPitch);
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
            console.log("playing note");
            self.playNote(note);
        }
        //this periodic call MUST be called from here
        self.timeoutObj = $timeout(self.updatePitch, 50);
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
        self.getUserMedia({audio:true}, self.gotStream);
        //self.timeoutObj = $timeout(self.updatePitch, 50);
        self.running = true;
    };
    //stop processing
    self.stopCapturing = function(){
        ///
        $timeout.cancel(setf.timeoutObj);
        self.getUserMedia({audio:false});
        self.running = false;
    };

    // this is not working on a web worker...
    self.init = function(){
        console.log("setting up audio context");
        window.AudioContext = window.AudioContext || window.webkitAudioContext;

        self.audioContext = new AudioContext();
        
        //TODO all the other things that need to be started
    };

    
    
    this.start = function(){
        console.log("starting  from the service");
        //TODO check that it actualy is ready, or wait ... use $q.defer
        self.startCapturing();
        
    };
    
    this.stop = function(){
        self.stopCapturing();
        
    };
    
    //start audio context
    self.init();
}]);


////////////////////////////////////////////////////////////////////////////////
//service wrapper for MIDI.js
//TODO see how to add the MIDI.js dependence
////////////////////////////////////////////////////////////////////////////////
pianoApp.service('midiService', ['pubSubMIDI', function(pubSubMIDI) {
    //console.log("creating midiService");
    ////////////////////
    //TODO take this hardcoded thing away and add the possibility to change keyboard layout!
    this.self = this;
    this.notesStatus = []
    
    //nice loader thing
	Event.add("body", "ready", function() {
		MIDI.loader = new widgets.Loader("Loading Leo's Piano");
	});
    //init midi
    this.init = function(){
        //load midi
	    MIDI.loadPlugin({
		    soundfontUrl: "./assets/soundfonts/",
		    instrument: "acoustic_grand_piano",
		    callback: function() {
			    MIDI.loader.stop();
		    }
	    });    
    };
    
    //things to be able to play
    //TODO make the calls more general, although for the moment this works
    this.playNote= function(midi_id){
        console.log("calling midi service note on: ", midi_id);
        if(! this.notesStatus[midi_id] === true){
            this.notesStatus[midi_id] = true;
            MIDI.noteOn(0, midi_id, 127, 0);
        }
    };
    
    this.stopNote= function(midi_id){
        console.log("calling midi service note off: ", midi_id);
        if(this.notesStatus[midi_id] === true){
            this.notesStatus[midi_id] = false;
            MIDI.noteOff(0, midi_id, 0);
        }
        
    };
    //
    //register services
    //console.log(pubSubMIDI);
    pubSubMIDI.subscribeAnyNoteOn(this, "playNote");
    pubSubMIDI.subscribeAnyNoteOff(this, "stopNote");
    this.init();
}]);

