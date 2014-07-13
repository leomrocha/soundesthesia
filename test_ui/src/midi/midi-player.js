var midiPlayer = angular.module("midi.player", ["midi.pubsub.service"]);
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

midiPlayer.service('simplePlayer', ['$timeout', 'pubSubMIDI', function($timeout, pubSubMIDI) {

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

