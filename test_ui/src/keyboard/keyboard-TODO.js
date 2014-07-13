  
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

pianoApp.controller('demoGuitarController', ['$scope', function($scope) {
    console.log('initializing controller: guitar');
  }]);

pianoApp.controller('demoVoiceController', ['$scope', function($scope) {
    console.log('initializing controller: voice');
  }]);

/*
pianoApp.controller('blogController', ['$scope', function($scope) {
    console.log('initializing controller: ');
  }]);


pianoApp.controller('postController', ['$scope', function($scope) {
    console.log('initializing controller: ');
  }]);*/
  
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




