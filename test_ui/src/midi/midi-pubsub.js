var midiServices = angular.module("midi.pubsub.service", []);

////////////////////////////////////////////////////////////////////////////////
//MIDI PubSub router
////////////////////////////////////////////////////////////////////////////////
//TODO add the unsubscribe methods!!!! (not needed for the moment, but should be done later
midiServices.service('pubSubMIDI', [function() {
    
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

