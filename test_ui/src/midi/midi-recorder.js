var midiRecorder = angular.module("midi.recorder", ["midi.pubsub.service"]);
////////////////////////////////////////////////////////////////////////////////
// midi recording service
//TODO
////////////////////////////////////////////////////////////////////////////////
midiRecorder.service('midiRecorderService', ['pubSubMIDI', function(pubSubMIDI) {
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

