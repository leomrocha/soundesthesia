var pianoApp = angular.module("PianoProject", ["ngRoute"]);

////////////////////////////////////////////////////////////////////////////////
// DIRECTIVES
////////////////////////////////////////////////////////////////////////////////
/**
 * AngularJS has a problem with src element in object tags
 * here is a fix found at:
 * https://github.com/angular/angular.js/issues/339#issuecomment-19384664
 */
pianoApp.directive('embedSrc', function () {
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
pianoApp.service('pubSubMIDI', [function() {
    
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
pianoApp.service('micCaptureService', ['$timeout', 'pubSubMIDI', function($timeout, pubSubMIDI) {

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
        console.log("calling midi service note off from pitch detectr: ", midi_id);
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
////////////////////////////////////////////////////////////////////////////////
pianoApp.service('midiService', ['pubSubMIDI', function(pubSubMIDI) {
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
pianoApp.service('midiRecorderService', ['pubSubMIDI', function(pubSubMIDI) {
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
// Simple Player Service
////////////////////////////////////////////////////////////////////////////////
// Tempos: 
// 1 semifusa
// 2 fusa
// 4 semi corchea
// 8 corchea
// 16 negra
// 32 blanca
// 64 redonda
//


pianoApp.service('simplePlayer', ['$timeout', 'pubSubMIDI', function($timeout, pubSubMIDI) {

    this.self = this;
    var self = this;
    //simple player that plays a secuence of notes in the format:
    self.sequence = [];
    //default bpm
    self.bpm = 60;
    //16 is the code for black key
    self.tempoMultiplier = (1000 * self.bpm) / (60 * 16);
    
    self.playNext = function(index){
        console.log("play next: ",index)
        idxOff = index - 1;
        //turn off previous note
        if(idxOff>=0 && idxOff < self.sequence.length){
            pubSubMIDI.publishNoteOff(self.sequence[idxOff][0]);
        }
        
        if(index < self.sequence.length){
            //play note 
            note = self.sequence[index][0];
            playTime = self.sequence[index][2] * self.tempoMultiplier;
            //play next note
            pubSubMIDI.publishNoteOn(note);
            //TODO wait play time
            //note OFF will be called on the callback
            $timeout(function(){
                    //console.log("calling timeout callback: ", $scope);
                    console.log(this)
                    self.playNext(index+1);
                    }, 
                    playTime
                    );
        }else{
            console.log("play sequence finished");
            //finished playing
            //callback to the caller!
            self.callback();
            //$scope.fini        
        }
    };
    
    self.setbpm = function(bpm){
        self.bpm = bpm;
        self.tempoMultiplier = (1000 * self.bpm) / (60 * 16);
    };
    
    self.play = function(sequence, callbackScope, callbackFunctionName){
    //self.play = function(sequence){
        //set sequence
        self.sequence = sequence;
        //set callback
        self.callback = callbackScope[callbackFunctionName];
        self.playNext(0);
    };
    
}]);


////////////////////////////////////////////////////////////////////////////////
//Keyboard mapper sevices
////////////////////////////////////////////////////////////////////////////////
pianoApp.service('keyboardService', ['pubSubMIDI', function(pubSubMIDI) {
    ////////////////////
    //TODO take this hardcoded thing away and add the possibility to change keyboard layout!
    this.self = this;
    var layout = LeosPiano.KeyboardMappings.fr['A'];
    var keys_ids = _.range(45, 72);
    
    this.mappings = {};
    for(var i=0; i < keys_ids.length; i++){
        this.mappings[layout[i]] = keys_ids[i];
        
    }
    
    //console.log('initialized kbservice with mapping: ', this.mappings);
    //END hardcoded
    ////////////////////
    
        this.setLayout= function(layout, beginNoteName, beginMidiId){
            //TODO make the mappings
            //console.log('setting layout: ',layout);
        };
        
        //return the current layout
        this.getLayout= function(){
            //TODO
        };
        
        this.keyPressed= function(event){
            //console.log('key pressed in kbservice: ',event.keyCode);
            //map keyCode to char:
            var keyChar = LeosPiano.KeyCodeMappings[event.keyCode];
            var note = this.mappings[keyChar.toLowerCase()];
            //TODO map to midi_id
            pubSubMIDI.publishNoteOn(note);
        };
        this.keyReleased= function(event){
            //console.log('key released in kbservice: ',event.keyCode);
            var keyChar = LeosPiano.KeyCodeMappings[event.keyCode];
            var note = this.mappings[keyChar.toLowerCase()];
            pubSubMIDI.publishNoteOff(note); //TODO take out the hardcoded
        };
}]);



pianoApp.controller('layoutSelectorController', ['$scope', 'keyboardService', function($scope,  kbService) {
    
    //TODO put current layout
    //TODO on change selection, change the kbService layout!
    
  }]);
  

pianoApp.directive('layoutSelectorDirective', ['keyboardService', function(kbService){
    
    //console.log("starting keyboard Selector");

    /*function link(scope, element, attrs) {
        console.log("starting keyboard selector link");
        //TODO get list of layouts
        //give the predefined options
    }*/

    
    return{
        //link: link,
        templateUrl: 'templates/layoutSelector.html'  //TODO make the template
        }

    }]);
    


////////////////////////////////////////////////////////////////////////////////
// Microphone capture
////////////////////////////////////////////////////////////////////////////////
pianoApp.controller('micCaptureController', ['$scope', 'micCaptureService', function($scope,  micService) {
    
    //TODO put current layout
    //TODO on change selection, change the kbService layout!
    $scope.note = {};
    
    //
    $scope.start = function(){
        console.log("starting service");
        console.log(micService);
        micService.start();
    };
    //
    $scope.stop = function(){
        micService.stop();
    };
    
    //TODO force start for testing, TODO erase this line
    $scope.start();
  }]);
  
pianoApp.directive('micCaptureControlsDirective', ['$scope', function($scope){
    return{
        templateUrl: 'templates/mic_controls.html'  //TODO make the template
        }
    }]);

pianoApp.directive('micCaptureDisplayDirective', ['$scope', function($scope){
    return{
        templateUrl: 'templates/mic_simple_display.html'  //TODO make the template
        }
    }]);

////////////////////////////////////////////////////////////////////////////////
// CONTROLLERS
////////////////////////////////////////////////////////////////////////////////

pianoApp.controller('mainController', ['$scope', '$window', 'keyboardService', 'midiService', function($scope, $window, kbService, midiService) {
    
    //midiService.init();
    angular.element($window).on('keydown', function(e) {
        //console.log("Key down: ", e);
        //TODO call the keyboard processor
        //console.log('kbservice = ', kbService);
        kbService.keyPressed(e);
    });
    angular.element($window).on('keyup', function(e) {
        //console.log("Key up: ", e);
        //TODO call the keyboard processor
        kbService.keyReleased(e);
    });
    
  }]);
  
pianoApp.controller('demoPianoController', ['$scope', function($scope) {
    //console.log('initializing controller: piano');
  }]);
  
//pianoApp.controller('keyboardController', ['$scope', function($scope) {
//    console.log('initializing controller: piano keyboard');
//  }]);
  
pianoApp.controller('keyController', ['$scope', 'pubSubMIDI', function($scope, pubSubMidi) {
    //console.log('initializing controller: piano key');
    //$scope.lang = window.navigator.userLanguage || window.navigator.language;
    //the current key state
    $scope.pressed = false;
    //$scope.hideKey = ;
    $scope.hideKeyName = false;
    $scope.hideKeyLabel = false;
    //functions
    //on key pressed - mouse click
    $scope.keyPressed = function(){
        //console.log('key pressed: ', $scope.key.midi_id);
        var prevState = $scope.pressed;
        $scope.pressed = true;
        //needed in case the update function is called from PubSub callback
        if(!$scope.$$phase) {
            $scope.$apply();
        }
        //avoid infinite call loop
        else{
            //avoid sending duplicate signal
            if(!prevState){ 
                pubSubMidi.publishNoteOn($scope.key.midi_id);
            }
        }

    };
    
    //on key released
    $scope.keyReleased = function(){
    
        //console.log('key released: ', $scope.key.midi_id);
        var prevState = $scope.pressed;
        $scope.pressed = false;
        //needed in case the update function is called from PubSub callback
        if(!$scope.$$phase) {
            $scope.$apply();
        }
        //avoid infinite call loop
        else{
            //avoid sending duplicate signal
            if(prevState){ 
                pubSubMidi.publishNoteOff($scope.key.midi_id);
            }
        }

    };
    /////////////////////////////////////////////////////////////    
    //Register callbacks:
    pubSubMidi.subscribeOnNoteOn($scope.key.midi_id, $scope, "keyPressed");
    pubSubMidi.subscribeOnNoteOff($scope.key.midi_id, $scope, "keyReleased");
    /////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////
  }]);

//TODO make this more generic instead of all hardcoded
pianoApp.controller('keyboardController', ['$scope', function($scope) {
    //////////////////////////////////////
    //TODO take out this hardcoded thing
    //console.log("starting keyboard controller");
    //var keys_ids = _.range(48, 72); //2 octaves
    //var keys_ids = _.range(36, 72); //3 octaves
    var keys_ids = _.range(45, 72); //2 octaves and 3 keys //leave it this way until made generic if not the keyboard layout will break
    $scope.keys = _.map(keys_ids, function(value, key, list){ return LeosPiano.Notes.notes[value];});
    //END todo
    ///////////////////////////////
    
    //get language  // warning, it does not detect the keyboard, but the 
    //computer setup laguage, this should work for most cases but not for all 
    //give user the option to change keyboard layout
    //$scope.lang = window.navigator.userLanguage || window.navigator.language;
    //TODO make this more generic instead of hardcoded
    //default layout is french, and starting in LA, assuming the range (45,72)
    $scope.layout = LeosPiano.KeyboardMappings.fr['A'];

    /*if( $scope.lang.search('en') >= 0 || $scope.lang.search('EN') >= 0 ){
        $scope.layout = LeosPiano.KeyboardMappings.en['A'];
    }else 
    if( $scope.lang.search('fr') >= 0 || $scope.lang.search('FR') >= 0 ){
        $scope.layout = LeosPiano.KeyboardMappings.fr['A'];
    }*/
    //console.log("layout = ", $scope.layout);
    //console.log("lang = ", $scope.lang);
    //console.log('keys =', $scope.keys);
    
    
    ////////////////////////////////////////////////////////////////////////////
    //WARNING this is an ugly hack but I can't see how to do it elsewhere
    ipos = {top: 0, left: 0};
    var xpos = 0;
    var syn = MusicTheory.Synesthesia.data["Steve Zieverink (2004)"];
    
    for(var i=0; i<$scope.keys.length; i++){
        var key = $scope.keys[i];
        //ugly neyboard mapping:
        key.label = $scope.layout[i];
        //ugly synesthesia setup
        var hsl_val = syn[key.number];
        //convert to RGB
        var hsl = {H: hsl_val[0], S: hsl_val[1], L:hsl_val[2]};
        //this transformation is because I've fixed the synesthesic theme already
        //TODO make it more general to be able to change the synesthesic theme
        var rgb = Color.Space.HSL_RGB(hsl);
        rgb = {R:Math.floor(rgb.R), G:Math.floor(rgb.G), B:Math.floor(rgb.B)};
        //console.log("convertion: ", hsl, " to rgb : ", rgb);
        key.synesthesia = rgb;
        //ugly to decide position
        if(key.key_color == LeosPiano.Notes.WHITE){
            
            ipos = {top: 0, left: xpos};
            key.position = ipos;
            xpos = xpos + 40;
        }else{
            //NOTE should NEVER start with a black key, or this will break
            ipos = {top: 0, left: xpos -20};
            key.position = ipos;
        }
     //console.log("keys = ", $scope.keys);
    }
    //END ugly hack
    ////////////////////////////////////////////////////////////////////////////
  }]);
  
pianoApp.controller('simonsGameController', ['$scope', '$timeout', 'pubSubMIDI', 'simplePlayer', function($scope, $timeout, pubSubMIDI, simplePlayer) {
    ////////////////////
    //console.log("starting simons game controller");
    $scope.self = this;
    
    //feedback to the user
    $scope.successMusic = []; //TODO
    $scope.failMusic = []; //TODO
    
    //game configuration
    $scope.bpm = 60;
    //$scope.
    
    //game status
    $scope.recording = [];
    $scope.state = "stopped"; // (playing/recording/stopped)
    $scope.gameState = "start"; //playing/win/loose/idle
    
    //level being played, for the moment is only one note at a time
    // data = (midi_id, start_time, time_to_play)
    //TODO add multi-note support
    $scope.levelData = [
                        [48,0,12],
                        [48,12,4],
                        [50,16,16],
                        [48,32,16],
                        [53,48,16],
                        [52,64,32]
                        ];
    //contains only the midi_ids for the data, this allows for faster and easier evaluation
    $scope.levelDataNotes = [48,48,50,48,53,52];
    //the name of the level
    $scope.levelName = "";
    //current index that is being played until (levels are passed sequentially)
    $scope.currentIndex = 0;
    $scope.currentLength = 1;
    //set level data
    $scope.setLevelData = function(levelData){
        $scope.levelData = levelData;
        //extract data notes only in midi_id:
        for(var i=0; i< levelData.length; i++){
            $scope.levelDataNotes.push(levelData[i][0]);
        }
    };
    
    $scope.playFinished = function(){
        //TODO change state to recording and start the game
        console.log("callback ok");
        $scope.state = "recording";
        $scope.gameState = "playing";
    };

    $scope.play = function(dataLength){
        //console.log("playing melody");
        $scope.state = "playing";
        $scope.gameState = "playing";
        //take in account to play everything
        if (dataLength === null || dataLength === undefined || dataLength === "undefined"){
            //console.log("setting length because of null");
            //console.log($scope.levelData);
            dataLength = $scope.levelData.length;
            //console.log(dataLength);
        }
        
        var pattern = $scope.levelData.slice(0, dataLength);
        simplePlayer.play(pattern, $scope, "playFinished");

        
    };
    //starts the game
    $scope.start = function(){
        //TODO
        console.log("starting game");
        //play current level
        $scope.play(1);
        //wait for user input
    };
    //setup everything for when the exercise starts
    $scope.record = function(){
        $scope.state = "recording";
    }
    //Stop the play recording
    $scope.stopRecording = function(){
        //set recording flag to nothing   
        $scope.state = "stopped";
        $scope.gameState = "idle";
    }
    
    //reset recording to clean slate
    $scope.reset = function(){
        $scope.recording = [];
        $scope.currentIndex = 0;
    }

    //when the game is won
    $scope.success = function(){
        //TODO
        console.log("you win");
        //present overlay that the person won, and play again (other speed? other level?)
    };    
    //when the game is lost
    $scope.fail = function(){
        //TODO
        console.log("you loose");
        $scope.stopRecording();
        $scope.reset();
        
    };
    //evaluate the performance up to the current moment
    //midi_id is the current note, 
    //the evaluation evaluates the whole performance if midi_id is null or undefined
    $scope.evaluate = function(midi_id){
        //TODO 
        // add support for time evaluation, for the moment is a really simple and basic game
        console.log("evaluating note: ", midi_id);
        response = $scope.recording.join('');
        console.log("response = ", response);
        
		var pattern = $scope.levelDataNotes.slice(0, $scope.recording.length).join('');
		console.log("pattern = ", pattern);
		if( response === pattern && $scope.recording.length === $scope.levelDataNotes.length) {
		    console.log("you are a winner!");
			$scope.stopRecording();
			$scope.success();
		} else if ( response === pattern && $scope.recording.length === $scope.currentLength) {
		    //console.log("adding a new note");
		    //add one more note
		    $scope.currentLength +=1;
		    $scope.stopRecording();
		    //clean slate for the recording
		    $scope.reset();
		    //start from the begginng, but leaving enough time to actually get the person to react
		    $timeout(function(){$scope.play($scope.currentLength)}, 800);
		}else if ( response !== pattern ) {
		    console.log('you are a looser!');
		    //TODO count remaining lives
		    //if no more
			$scope.fail();
			//else:
			//TODO try again!
		}
		//else, we are going OK
    }
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
    
}]);

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
  
pianoApp.controller('pianoDemoController', ['$scope', '$timeout', 'pubSubMIDI', 'simplePlayer', function($scope, $timeout, pubSubMIDI, simplePlayer) {

    console.log("starting piano demo controller");
    
    $scope.currentIndex = 0;
    
    $scope.currentImage = PianoDemoLevel[0]["src"];
    $scope.currentText =  PianoDemoLevel[0]["text"];
    
    //$scope.state = "greeting";
    
    //makes the actions that needs to be done for this screen
    
    $scope.act = function(){
        //this is 
        if($scope.currentImage === 0 ){
            
        }else if($scope.currentImage === 1 ){
        
        }
    };
    
    $scope.nextScreen = function(){
        
        
        $scope.currentIndex += 1;
        $scope.currentImage = PianoDemoLevel[$scope.currentIndex]["src"];
        
    };

    $scope.next = function(){
        //TODO finish
        $scope.nextScreen();
    };
    
    $scope.previous = function(){
    
    };
    
}]);

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
  
////////////////////////////////////////////////////////////////////////////
  
pianoApp.directive('keyboard', ['$compile', function($compile) {
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
pianoApp.directive('key', ['$compile', function($compile) {
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




