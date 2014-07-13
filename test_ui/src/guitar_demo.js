var guitarDemo = angular.module("GuitarDemo", ["ngRoute"]);

////////////////////////////////////////////////////////////////////////////////
// DIRECTIVES
////////////////////////////////////////////////////////////////////////////////
/**
 * AngularJS has a problem with src element in object tags
 * here is a fix found at:
 * https://github.com/angular/angular.js/issues/339#issuecomment-19384664
 */
guitarDemo.directive('embedSrc', function () {
  return {
    restrict: 'A',
    link: function (scope, element, attrs) {
      var current = element;
      scope.$watch(function() { return attrs.embedSrc; }, function () {
        var clone = element
                      .clone()
                      .attr('src', attrs.embedSrc);
        current.replaceWith(clone);
        current = clone;
      });
    }
  };
});

////////////////////////////////////////////////////////////////////////////////
//MIDI PubSub router
////////////////////////////////////////////////////////////////////////////////
//TODO add the unsubscribe methods!!!! (not needed for the moment, but should be done later
guitarDemo.service('pubSubMIDI', [function() {
    
    //a simple register in the form: key: [list of callbacks]
    this.self = this;
    this.registerNoteOn = { };
    this.registerNoteOff = { };
    
    this.registerAnyNoteOn = [];
    this.registerAnyNoteOff = [];
    
    this.subscribeAnyNoteOn = function(scope, callback){
        //console.log("registering any note on scope with callback: ", scope,callback)    
        this.registerAnyNoteOn.push([scope, callback]);
    }
    this.subscribeAnyNoteOff = function(scope, callback){
        //console.log("registering any note off scope with callback: ", scope,callback)    
        this.registerAnyNoteOff.push([scope, callback]);
    }
    /*
     * Subscribes to note on event
     * midi_id id in midi notation: int
     * scope: the scope where the function is
     * callback: the name (string) of the function to call (no parameters passed)
     */
    this.subscribeOnNoteOn = function(midi_id, scope, callback){
        //console.log('subscribing to note on: ', midi_id, " ; ", callback );
        //register creation if does not exists
        var reg = this.registerNoteOn[midi_id];
        if (reg === null || reg === undefined || reg === 'undefined'){
            this.registerNoteOn[midi_id] = [];
        }
        //now add the callback
        this.registerNoteOn[midi_id].push([scope, callback]);
    };
    /*
     * Subscribes to note off event
     * midi_id id in midi notation: int
     * scope: the scope where the function is
     * callback: the name (string) of the function to call (no parameters passed)
     */
    this.subscribeOnNoteOff = function(midi_id, scope, callback){
        //console.log('subscribing to note off: ', midi_id, " ; ", callback );
        //register creation if does not exists
        var reg = this.registerNoteOff[midi_id];
        if (reg === null || reg === undefined || reg === 'undefined'){
            this.registerNoteOff[midi_id] = [];
        }
        //now add the callback
        this.registerNoteOff[midi_id].push([scope, callback]);
    };
    this.publishNoteOn = function(midi_id){
        //console.log('publishing note on: ',midi_id);
        var cbacks = this.registerNoteOn[midi_id];
        try{
            //call all the generic ones
            for(var j=0; j< this.registerAnyNoteOn.length; j++){
                var sc = this.registerAnyNoteOn[j];
                sc[0][sc[1]](midi_id);
            }
            //now all the specific calls only for that note
            for(var i=0; i< cbacks.length; i++)
            {
                //callback
                var cback = cbacks[i];
                cback[0][cback[1]](); //scope.function() call
                //console.log("callback called: ", cback[0][cback[1]]);
            }
        }catch(err){
            //nothing to see here ... move along
        }
        
    };
    this.publishNoteOff = function(midi_id){
        //console.log('publishing note off: ',midi_id);
        var cbacks = this.registerNoteOff[midi_id];
        try{
            //call all the generic ones
            for(var j=0; j< this.registerAnyNoteOff.length; j++){
                var sc = this.registerAnyNoteOff[j];
                sc[0][sc[1]](midi_id);
            }
            //now the specifics
            for(var i=0; i< cbacks.length; i++){
                var cback = cbacks[i];
                cback[0][cback[1]](); //scope.function() call
                //console.log("callback called: ", cback[0][cback[1]]);
            }
        }catch(err){
            console.log("error occurred: ", err);
            //nothing to see here ... move along
        }
    };
}]);
////////////////////////////////////////////////////////////////////////////////
//service for audio capture in javascript
//TODO add webworker mode
//TODO add flash fallback (if flash module is available)

////////////////////////////////////////////////////////////////////////////////
guitarDemo.service('micCaptureService', ['$timeout', function($timeout) {

    /*
    For this service ONLY
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
    
    //store 
    self.MAX_LEN_NOTES_BUFFER = 1;
    self.notesBuffer = [0];

    ////////////////////////////////////////////////////////////////////////////////
    //constants TODO make this parametrable
    ////////////////////////////////////////////////////////////////////////////////

    self.buflen = 2048;
    self.buf = new Uint8Array( buflen );

    self.MINVAL = 134;  // 128 == zero.  MINVAL is the "minimum detected signal" level.
    //self.MIN_CONFIDENCE = 10;  //confidence in the detection
    self.MIN_CONFIDENCE = 30;  //confidence in the detection
    self.MIN_RMS = 0.01;
    self.MIN_BEST_CORR = 0.01;

    self.callback = null;
    //reister a callback to make on each detection
    this.registerCallback = function(scope, callback){
        console.log("registering callback");
        self.callback = scope[callback];
    };
    
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
     	    //console.log("no confidence for pitch: ", self.currentPitch);
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
            //console.log("detected note is: ", ret);
            //TODO finish this, is for avoiding jitter in the detection
            //console.log("pushing note to the buffer and keep it with the max lenght");
            if (self.notesBuffer.push(note) > self.MAX_LEN_NOTES_BUFFER){
                
                //console.log('popping', self.notesBuffer, self.notesBuffer.length);
                self.notesBuffer.shift();
            }
            
            var send = true;
            //TODO see here, this are arbitrary values that might work well for a guitar
            if ( note >= 85 || note <= 35){
                send = false;                
            }
            if (send){
                for(var i = 0; i < self.notesBuffer.length; i++){
                    if (self.notesBuffer[i] !== note){
                        //console.log('not send', self.notesBuffer[i], note);
                        send = false;
                        break;
                    }
                }
            }
            if (send){
                //console.log("calling back");
                self.callback(ret);
            }
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
        //console.log("setting up audio context");
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
////////////////////////////////////////////////////////////////////////////////
guitarDemo.service('midiService', ['pubSubMIDI', function(pubSubMIDI) {
    //console.log("creating midiService");
    ////////////////////
    //TODO take this hardcoded thing away and add the possibility to change keyboard layout!
    this.self = this;
    this.notesStatus = []
    
    //nice loader circle thing
	Event.add("body", "ready", function() {
		MIDI.loader = new widgets.Loader("Loading Piano Sounds");
	});
    //init midi
    this.init = function(){
        //load midi
	    MIDI.loadPlugin({
		    soundfontUrl: "../assets/soundfonts/",
		    instrument: "acoustic_grand_piano",
		    callback: function() {
			    MIDI.loader.stop();
			    //TODO erase loader
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

////////////////////////////////////////////////////////////////////////////////
// midi recording service
////////////////////////////////////////////////////////////////////////////////
guitarDemo.service('midiRecorderService', ['pubSubMIDI', function(pubSubMIDI) {
    this.self = this;
    this.recording = [];
    //this.state (playing/recording/etc)
    //FUTURE
    //this.saveAs = function(file_name, file_extension){};
    //
    this.startRecording = function(){
        //TODO
    };
    
    //Stop the play recording
    this.stopRecording = function(){
        //set recording flag to nothing   
    }
    
    //reset state to clean slate
    this.reset = function(){
        //TODO set clean slate
    }
    
    //received a note ON event
    this.noteOn = function(midi_id){
        //TODO
    }
    
    //received a note OFF event
    this.noteOff = function(midi_id){
        //TODO
    }
    //register services
    //console.log(pubSubMIDI);
    pubSubMIDI.subscribeAnyNoteOn(this, "noteOn");
    pubSubMIDI.subscribeAnyNoteOff(this, "noteOff");
}]);


////////////////////////////////////////////////////////////////////////////////
// CONTROLLERS
////////////////////////////////////////////////////////////////////////////////
  
guitarDemo.controller('guitarGameController', ['$scope', '$timeout', 'pubSubMIDI', 'micCaptureService', function($scope, $timeout, pubSubMIDI, micService) {
    ////////////////////
    console.log("guitar game controller starting");
    //sound state:
    $scope.micAllowed = false;
    
    //game states
    $scope.screens = {
                    0: 'greetings',
                    1: 'game',
                    2: 'fail',
                    3: 'success'
                    };
            
    $scope.screen = 'greetings';
    /*
    $scope.states = {
                        $scope.screens[0] : {
                            
                        },
                        $scope.screens[1] : {
                        
                        },
                        $scope.screens[2] : {
                        
                        },
                        $scope.screens[3] : {
                        
                        }
                    };
    */
    $scope.challengeAccepted = false;
    $scope.state = '';
    
    //this function decides what to do in the game state dynamics
    //result: is extra data that will help the function to decide what state follows
    $scope.nextState = function(result){
        if($scope.screen === "greetings"){
            $scope.screen = 'game';
            //
        }else if($scope.screen === "game"){
            //TODO   
        }else if($scope.screen === "fail"){
            //TODO   
        }else if($scope.screen === "success"){
            //TODO   
        }
    };
    //function to setup as callback to the micService
    $scope.micReceiverCallback = function(note){
        if(! $scope.micAllowed){
            $scope.micAllowed = true;
        }else if($scope.challengeAccepted && $scope.screen === "greetings"){
            $scope.nextState();
        }else if($scope.screen === "game"){
            //TODO   
            //if state is recording mic input, forward the input to the recorder
            //if the state is another, do nothing
        }
        console.log("received note = ", note)
    };
    console.log("starting mic service");
    console.log(micService);

    micService.registerCallback($scope, 'micReceiverCallback');
    micService.start();
    
    $scope.acceptChallenge = function(){
        $scope.challengeAccepted = true;
        
    };
/*
    //received a note ON event
    //TODO make this happen in the next iteration of the game, when times are taken in account
    $scope.noteOn = function(midi_id){
        //TODO
        //measure time from the beginning
        //save in cache (note, start_time, some other info?)
        //the following is a basic functionality to be changed when the more advanced one is implemented
    }
    
    //received a note OFF event
    $scope.noteOff = function(midi_id){
        //TODO
        //find the note that was being played,
        //measure duration
        //save in record (note, start_time, end_time, duration, some other info?)
        //console.log("recording in game note: ", midi_id);

        if( $scope.state == "recording"){
            $scope.recording.push(midi_id);
            $scope.currentIndex +=1;
            //update game status (if the user is OK, won or 
            $scope.gameStatus = $scope.evaluate(midi_id);
        }
        //console.log("end recording");
    }
    //register services
    //console.log(pubSubMIDI);
    //TODO reconnect when more advanced features taken in account (tempo for example)
    //pubSubMIDI.subscribeAnyNoteOn($scope, "noteOn");
    pubSubMIDI.subscribeAnyNoteOff($scope, "noteOff");
*/    
}]);


////////////////////////////////////////////////////////////////////////////
  
guitarDemo.directive('simonsGame', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/simons_game.html"
    };
  }]);

guitarDemo.directive('simonsStartScreen', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/start_screen.html"
    };
  }]);

guitarDemo.directive('simonsEndScreen', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/end_screen.html"
    };
  }]);


guitarDemo.directive('simonsSelectLevel', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/level_select.html"
    };
  }]);
  
guitarDemo.directive('simonsGameStatus', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/game_status.html"
    };
  }]);
////////////////////////////////////////////////////////////////////////////
  
guitarDemo.directive('keyboard', ['$compile', function($compile) {
    //console.log("starting keyboard");
    //console.log("scope keys = ", $scope.keys);
    //var language = window.navigator.userLanguage || window.navigator.language;
    //alert(language); //works IE/SAFARI/CHROME/FF

    function link(scope, element, attrs) {
        //get the computer keyboard layout
        //console.log("starting keyboard link");
        //var language = window.navigator.userLanguage || window.navigator.language;
        //alert(language); //works IE/SAFARI/CHROME/FF
        //get the beginning and end of the keyboard
        //generate the keyboard
    }

    return {
      link: link,
      //replace: true,
      templateUrl: "templates/keyboard.html"
    };
  }]);
guitarDemo.directive('key', ['$compile', function($compile) {
    //console.log("starting key");
    function link(scope, element, attrs) {
        
        //console.log("element ", element);
        //console.log("attrs = ", attrs);
        //console.log(scope.key);
        width = scope.key.key_color == LeosPiano.Notes.WHITE ? 40 : 30;
        height = scope.key.key_color == LeosPiano.Notes.WHITE ? 200 : 120;
        element.width(width);
        element.height(height);
        var offset = element.parent().offset();
        
        //console.log(scope.key.position)
        //setup position to make it look like a piano
        element.css("position", "absolute")
               .css("top", scope.key.position.top + offset.top)
               .css("left", scope.key.position.left + offset.left)
               ;
        //on mouse over -> shade
        
        //
        
    }

    return {
        
        link: link,
        restrict: 'AE',
        templateUrl: "templates/key.html"
    };
  }]);




