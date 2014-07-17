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
        var cbacks = this.registerNoteOff[midi_id];
        try{
            //call all the generic ones
            for(var j=0; j< this.registerAnyNoteOff.length; j++){
                var sc = this.registerAnyNoteOff[j];
                try{
                    sc[0][sc[1]](midi_id);
                }catch(e){}
            }
            //now the specifics
            for(var i=0; i< cbacks.length; i++){
                try{
                    var cback = cbacks[i];
                    cback[0][cback[1]](); //scope.function() call
                //console.log("callback called: ", cback[0][cback[1]]);
                }catch(e){}
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
        console.log("playing: ",sequence);
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
    //var layout = LeosPiano.KeyboardMappings.fr['A'];
    //var keys_ids = _.range(45, 72);
    layout_FR = LeosPiano.SimpleUniversal['FR'];
    layout_EN = LeosPiano.SimpleUniversal['EN'];
    var keys_ids = _.range(48, 66);
    
    this.mappings = {};
    for(var i=0; i < keys_ids.length; i++){
        this.mappings[layout_FR[i]] = keys_ids[i];
        this.mappings[layout_EN[i]] = keys_ids[i];
        
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
        console.log("Key down: ", e.keyCode);
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
    //var keys_ids = _.range(45, 72); //2 octaves and 3 keys //leave it this way until made generic if not the keyboard layout will break
    var keys_ids = _.range(48, 66);
    $scope.keys = _.map(keys_ids, function(value, key, list){ return LeosPiano.Notes.notes[value];});
    //END todo
    ///////////////////////////////
    
    //get language  // warning, it does not detect the keyboard, but the 
    //computer setup laguage, this should work for most cases but not for all 
    //give user the option to change keyboard layout
    //$scope.lang = window.navigator.userLanguage || window.navigator.language;
    //TODO make this more generic instead of hardcoded
    //default layout is french, and starting in LA, assuming the range (45,72)
    //$scope.layout = LeosPiano.KeyboardMappings.fr['A'];
    $scope.layout_FR = LeosPiano.SimpleUniversal['FR'];
    $scope.layout_EN = LeosPiano.SimpleUniversal['EN'];

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
        key.label = $scope.layout_FR[i];
        key.label2 = $scope.layout_EN[i];
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

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
  
pianoApp.controller('pianoDemoController', ['$scope', '$timeout', 'pubSubMIDI', 'simplePlayer', function($scope, $timeout, pubSubMIDI, simplePlayer) {

    console.log("starting piano demo controller");
    
    $scope.currentIndex = 0;
    $scope.parrotImages = [ "/images/parrot_piano_150.png",
                            "/images/V5_150.png",
                            "/images/V1_150.png",
                            "/images/V3_150.png"
                            ];
    $scope.parrotImageIndex = 0;
    $scope.currentImage = "";
    $scope.parrotImage = $scope.parrotImages[$scope.parrotImageIndex];
    $scope.currentText =  PianoDemoLevel[0]["text"];
    $scope.vextabText = PianoDemoLevel[0]["vextab"];
    $scope.playing = false;
    $scope.success = false;
    $scope.showSubscribe = false;
    $scope.turn = "pc";
    $scope.recording = [];
    $scope.notesLevel = []; //only the midi ids for the notes
    //$scope.state = "greeting";
    
    //makes the actions that needs to be done for this screen
    
    $scope.beginWaitFinished = function(){
        ///////////////////////////////////////
        //intro
        var pattern = PianoDemoLevel[0]["play"];
        $scope.playing = true;
        simplePlayer.play(pattern, $scope, "playFinished");        
        ///////////////////////////////////////
    };
    
    $scope.showScreen = function(){
    
    };
    
    //this is UGLY
    $scope.goNextAfterPlay = false;
    $scope.playFinished = function(){
        //TODO change state to recording and start the game
        //console.log("callback ok");
        //$scope.next();
        $scope.playing = false;
        if($scope.goNextAfterPlay){
            $scope.next();
        }
        $scope.goNextAfterPlay = false;
    };
    
    $scope.act = function(){
        //this is 
        console.log("acting");
        if($scope.currentIndex === 0 ){
            console.log("play");
            $timeout(function(){$scope.beginWaitFinished()}, 1500);
            
        }else if($scope.currentIndex === 1 ){
        
        }
    };
    
    $scope.nextScreen = function(){
        //if level finished: CONGRATS! and subscribe

        $scope.currentIndex += 1;
        console.log("PianoDemoLevel.length = ", PianoDemoLevel.length);
        if($scope.currentIndex >= PianoDemoLevel.length){
            $scope.currentImage = "/images/happy_parrot_400.png";
            $scope.showSubscribe = true;
            $scope.success = true;
            $scope.playing = false;
            $scope.vextabText = "";
            $scope.turn = "pc";
            $scope.currentText = "You made it, Congratulations!";
        }else{
            $scope.playing = true;
            level = PianoDemoLevel[$scope.currentIndex];
            //console.log("level: ", level)
            //$scope.currentImage = level["src"];
            $scope.currentText =  level["text"];
            $scope.vextabText =   level["vextab"];
            $scope.recording = []; //empty previous recordings
            
            try{
                $scope.levelNotes = _.map(level["play"], function(el){ return el[0]});
                console.log('level = ', $scope.levelNotes);
                $scope.turn = level["turn"];
            }catch(e){
                $scope.turn = "pc";
            }
            try{
                if(level["timeout"] !== null && level["timeout"] !== undefined && level["timeout"] !== 'undefined'){
                    $timeout(function(){$scope.next();}, level["timeout"]);
                }
            }catch(e){
                //nothing to do here, move along
            }
        }
        
    };

    $scope.next = function(){
        //TODO finish
        $scope.nextScreen();
    };
    
    $scope.previous = function(){
    
    };
    
    $scope.play = function(nextAfterPlay){
        try{
            var pattern = PianoDemoLevel[$scope.currentIndex]["play"];
            $scope.playing = true;
            $scope.goNextAfterPlay = nextAfterPlay;
            simplePlayer.play(pattern, $scope, "playFinished");
        }catch(e){
            //it can not be played
        }
    };
    
    $scope.fail = function(){
        //Reset this level
        //Say SORRY, try again
        $scope.currentText =  "Awww! You missed the last one. Try again!";
        $scope.recording = [];
    };
    
    $scope.success = function(){
        //console.log("success");
        $scope.next();
    };
    
    $scope.evaluate = function(){
        //console.log("recording");
        //setup text beacause might be coming from a mistake
        $scope.currentText =  PianoDemoLevel[$scope.currentIndex]["text"];
        $scope.parrotImageIndex = ($scope.parrotImageIndex + 1 ) % $scope.parrotImages.length;
        $scope.parrotImage = $scope.parrotImages[$scope.parrotImageIndex];
        var fail = false;
        for(var i=0; i< $scope.recording.length; i++){
            if($scope.levelNotes[i] !== $scope.recording[i]){
                fail = true;
                break;
            }
        }
        if(!fail && $scope.recording.length === $scope.levelNotes.length){
            $scope.success();
        }else if(fail){
            $scope.parrotImage = "/images/V2_150.png";
            $scope.fail();
        }
        
        
    };
    ///
    /*$scope.play = function(){
        //console.log($scope);
        //console.log("player = ");
        //console.log($scope.player);
        if( $scope.player !== null && $scope.player !== undefined && $scope.player !== 'undefined'){
            //console.log("play");
            //update player:
            $scope.player.render();
            $scope.playing = true;
            //$scope.player.render();
            //console.log($scope.player);
            $scope.player.play();
        }
        
    };
    
    $scope.stop = function(){
        //console.log($scope);
        if( $scope.player !== null && $scope.player !== undefined && $scope.player !== 'undefined'){
            //console.log("stop");
            $scope.playing = false;
            $scope.player.stop();
        }
        
    };*/
    ///
    
    //received a note OFF event
    $scope.noteOff = function(midi_id){
        //console.log("calling note off");
        $scope.recording.push(midi_id);
        //console.log("recorded");
        $scope.evaluate();
        //console.log("evaluated");
    };
    //register services
    //console.log(pubSubMIDI);
    //pubSubMIDI.subscribeAnyNoteOn($scope, "noteOn");
    pubSubMIDI.subscribeAnyNoteOff($scope, "noteOff");
    //$scope.act();
}]);

////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////
  
////////////////////////////////////////////////////////////////////////////
  
pianoApp.directive('keyboard', ['$compile', function($compile) {
    //console.log("starting keyboard");
    //console.log("scope keys = ", $scope.keys);
    //var language = window.navigator.userLanguage || window.navigator.language;
    //alert(language); //works IE/SAFARI/CHROME/FF

    /*function link(scope, element, attrs) {
        //get the computer keyboard layout
        //console.log("starting keyboard link");
        //var language = window.navigator.userLanguage || window.navigator.language;
        //alert(language); //works IE/SAFARI/CHROME/FF
        //get the beginning and end of the keyboard
        //generate the keyboard
    }*/

    return {
      //link: link,
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


pianoApp.directive('vextabPaper', ['$compile', function($compile) {
    //console.log("paper starting")
    var canvas = document.createElement('canvas');
    canvas.className = "vex-canvas";
    var renderer = new Vex.Flow.Renderer( canvas,
                  //Vex.Flow.Renderer.Backends.RAPHAEL); //TODO support raphael
                  Vex.Flow.Renderer.Backends.CANVAS);
    var artist = new Vex.Flow.Artist(10, 10, 600, {scale: 1});
    var player = null;
    
    if (Vex.Flow.Player) {
        opts = {};
        //if (options) opts.soundfont_url = options.soundfont_url;
        player = new Vex.Flow.Player(artist, opts);
        //do not show default controls - changed to default on the vextab code
        //player.removeControls();
    }
    vextab = new Vex.Flow.VexTab(artist);

    function link(scope, element, attrs) {
        //update parent things:
        scope.canvas = canvas;
        scope.artist = artist;
        scope.vextab = vextab;
        scope.player = player;
        
        var vextabText;
        function updateTab() {
            //console.log("updating tab");
            //console.log(vextabText);
            try {
                vextab.reset();
                artist.reset();

                vextab.parse(vextabText);
                artist.render(renderer);
                //console.log("artist = ", artist);
            }
            catch (e) {
                console.log("Error");
                console.log(e);
            }      
            $compile(canvas)(scope);
            element.append(canvas);
            //reposition player because something breaks on the default
            if(player !== null && player !== undefined){
                //console.log("player created: ", player);
                player.fullReset(); //this is what makes the repaint correct
                playerCanvas = element.find(".vextab-player");
                scoreCanvas =  element.find(".vex-canvas");
                playerCanvas.height = scoreCanvas.get(0).height;
                //console.log(playerCanvas);
                $compile(playerCanvas)(scope);
            }
        }

        scope.$watch(attrs.vextabPaper, function(value) {
            //console.log("changing vextab text to: ", value);
            if (!(value !== null && value !== undefined)){
                value = element.text();
                element.text("");
            }
            vextabText = value;
            updateTab();
        });

    }

    return {
        transclude:true,
        link: link
    };
  }]);
