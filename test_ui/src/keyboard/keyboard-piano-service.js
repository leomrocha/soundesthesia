var keyboardPiano = angular.module("keyboard.mapper.piano", ["midi.pubsub.service"]);
////////////////////////////////////////////////////////////////////////////////
//Keyboard mapper sevices
////////////////////////////////////////////////////////////////////////////////
keyboardPiano.service('keyboardService', ['pubSubMIDI', function(pubSubMIDI) {
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


