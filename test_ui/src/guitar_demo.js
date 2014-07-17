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
    //console.log("seting up micCaptureService");
   
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
        //console.log("registering callback");
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
        //console.log("starting  from the service");
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
        //console.log("calling midi service note on: ", midi_id);
        if(! this.notesStatus[midi_id] === true){
            this.notesStatus[midi_id] = true;
            MIDI.noteOn(0, midi_id, 127, 0);
        }
    };
    
    this.stopNote= function(midi_id){
        //console.log("calling midi service note off: ", midi_id);
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
    //console.log("guitar game controller starting");
  
    $scope.currentIndex = 0;
    $scope.parrotImages = [ "/images/parrot_piano_150.png",
                            "/images/V5_150.png",
                            "/images/V1_150.png",
                            "/images/V3_150.png"
                            ];
    $scope.parrotImageIndex = 0;
    $scope.currentImage = "";
    $scope.parrotImage = $scope.parrotImages[$scope.parrotImageIndex];
    $scope.currentText =  GuitarDemoLevel[0]["text"];
    $scope.vextabText = GuitarDemoLevel[0]["vextab"];
    $scope.fretboardLevel = GuitarDemoLevel[0]["fretboard"];
    $scope.playing = false;
    $scope.success = false;
    $scope.showSubscribe = false;
    $scope.turn = "pc";
    $scope.recording = [];
    $scope.levelNotes = []; //only the midi ids for the notes
    //$scope.state = "greeting";
    
    //makes the actions that needs to be done for this screen
    
    $scope.beginWaitFinished = function(){
        ///////////////////////////////////////
        //intro
        var pattern = GuitarDemoLevel[0]["play"];
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
        //console.log("acting");
        if($scope.currentIndex === 0 ){
            //console.log("play");
            $timeout(function(){$scope.beginWaitFinished()}, 1500);
            
        }else if($scope.currentIndex === 1 ){
        
        }
    };
    
    $scope.nextScreen = function(){
        //if level finished: CONGRATS! and subscribe

        $scope.currentIndex += 1;
        //console.log("GuitarDemoLevel.length = ", GuitarDemoLevel.length);
        if($scope.currentIndex >= GuitarDemoLevel.length){
            $scope.currentImage = "/images/happy_parrot_400.png";
            $scope.showSubscribe = true;
            $scope.success = true;
            $scope.playing = false;
            $scope.vextabText = "";
            $scope.fretboardLevel = "";
            $scope.turn = "pc";
            $scope.currentText = "You made it, Congratulations!";
        }else{
            $scope.playing = true;
            level = GuitarDemoLevel[$scope.currentIndex];
            //console.log("level: ", level)
            //$scope.currentImage = level["src"];
            $scope.currentText =  level["text"];
            $scope.vextabText =   level["vextab"];
            $scope.fretboardLevel = level["fretboard"];
            $scope.recording = []; //empty previous recordings
            
            try{
                $scope.levelNotes = _.map(level["play"], function(el){ return el[0]});
                //console.log('level = ', $scope.levelNotes);
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
            var pattern = GuitarDemoLevel[$scope.currentIndex]["play"];
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
        console.log("success");
        $scope.next();
    };
    
    $scope.evaluate = function(midi_id){
        console.log("evaluating ", midi_id);
        console.log("$scope.levelNotes = ", $scope.levelNotes);
        //setup text beacause might be coming from a mistake
        $scope.currentText =  GuitarDemoLevel[$scope.currentIndex]["text"];
        $scope.parrotImageIndex = ($scope.parrotImageIndex + 1 ) % $scope.parrotImages.length;
        $scope.parrotImage = $scope.parrotImages[$scope.parrotImageIndex];
        //evaluate if the note played is the one that should be played
        var cindex = $scope.recording.length;
        console.log(cindex);
        console.log("$scope.levelNotes[cindex] = ", $scope.levelNotes[cindex]);
        if(cindex >=0 && $scope.levelNotes[cindex] === midi_id){
            console.log("notes matches, appending: ", midi_id);
            $scope.recording.push(midi_id);
        }
        if($scope.recording.length === $scope.levelNotes.length){
            $scope.success();
        }
        
        
    };
    
    //function to setup as callback to the micService
    $scope.micReceiverCallback = function(note){
        if(!$scope.micAllowed){
            console.log("mic allowed now!");
            $scope.micAllowed = true;
        }else{
            $scope.evaluate(note.note);
        }
        console.log("received note = ", note)
    };
    //console.log("starting mic service");
    console.log(micService);
    micService.registerCallback($scope, 'micReceiverCallback');
    micService.start();
    
    //received a note ON event
    $scope.noteOn = function(midi_id){
        console.log("receiving note by note_on: ", midi_id);
        //$scope.recording.push(midi_id);
        //console.log("recorded");
        $scope.evaluate(midi_id);
        //console.log("evaluated");
    };
    //register services
    //console.log(pubSubMIDI);
    pubSubMIDI.subscribeAnyNoteOn($scope, "noteOn");
    //pubSubMIDI.subscribeAnyNoteOff($scope, "noteOff");
    //micService.init();
    
}]);


////////////////////////////////////////////////////////////////////////////
  

guitarDemo.directive('vextabPaper', ['$compile', function($compile) {
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
        
        var vextabLevel;
        function updateTab() {
            //console.log(vextabLevel);
            try {
                vextab.reset();
                artist.reset();

                vextab.parse(vextabLevel);
                artist.render(renderer);
            }
            catch (e) {
                console.log("Error", e);
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
            vextabLevel = value;
            updateTab();
        });

    }

    return {
        transclude:true,
        link: link
    };
  }]);
  
////////////////////////////////////////////////////////////////////////////
  

guitarDemo.directive('fretboardPaper', ['$compile', function($compile) {
    //console.log("starting fretboard paper");
    //var canvas = document.createElement('canvas');
    //canvas.className = "fretboard-canvas";
    var fretboard = null;
    //var ps  = null;
    var sel = "#fretboardDiv";
    var containerSel = "#fretboardContainer";
    //var el = $(sel);
    //console.log("selected element 1 = ", el);
    /*if (Vex.Flow.Fretboard) {
        opts = {};
        fretboard = new Vex.Flow.FretboardDiv(sel);
    }else{
        console.log("ERROR, Fretboard not ready");
    }*/
    

    function link(scope, element, attrs) {
        //update parent things:
        scope.fretboard = fretboard;
        var fretboardLevel;
        
        function updateFretboard() {
            //console.log("updating fretboard");
            //console.log(fretboardLevel);
            try {
                //console.log("parsing!");
                //OK, this is the cannon to a fly way:
                //erase element
                $(containerSel).empty();
                //recreate the element
                var ne = angular.element('<div id="fretboardDiv"></div>');
                ne.text(fretboardLevel);
                //binding and appending
                $compile(ne)(scope);
                $(containerSel).append(ne);
                //add element
                //now use the FretboardDiv as it is
                fretboard = new Vex.Flow.FretboardDiv(sel);
                fretboard.build(fretboardLevel);
                //recompile for showing it
                $compile($(sel))(scope);
            }
            catch (e) {
                console.log("Error");
                console.log(e);
            }      
            //$compile(canvas)(scope);
            //element.append(canvas);
            //reposition player because something breaks on the default
            /*if(fretboard !== null && fretboard !== undefined){
                //TODO
                var el = $(sel);
                //console.log("everything is new here: ", el);
                $compile(el)(scope);
            }*/
        }

        scope.$watch(attrs.fretboardPaper, function(value) {
            //console.log("changing fretboard text to: ", value);
            fretboardLevel = value;
            updateFretboard();
        });

    }

    return {
        transclude:true,
        link: link
    };
  }]);
  


