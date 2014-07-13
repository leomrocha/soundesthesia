
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
// CONTROLLERS
////////////////////////////////////////////////////////////////////////////////


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
  
pianoApp.directive('simonsGame', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/simons_game.html"
    };
  }]);

pianoApp.directive('simonsStartScreen', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/start_screen.html"
    };
  }]);

pianoApp.directive('simonsEndScreen', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/end_screen.html"
    };
  }]);


pianoApp.directive('simonsSelectLevel', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/level_select.html"
    };
  }]);
  
pianoApp.directive('simonsGameStatus', ['$compile', function($compile) {
    return {
      templateUrl: "templates/simon/game_status.html"
    };
  }]);
////////////////////////////////////////////////////////////////////////////
  

