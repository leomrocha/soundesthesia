var keyboardEventController = angular.module("keyboard.event.controller", ["midi.pubsub.service"]);

keyboardEventController.controller('keyboardEventController', ['$scope', '$window', 'keyboard.piano.service', function($scope, $window, kbService) {
    
    //midiService.init();
    angular.element($window).on('keydown', function(e) {
        //console.log("Key down: ", e);
        kbService.keyPressed(e);
    });
    angular.element($window).on('keyup', function(e) {
        //console.log("Key up: ", e);
        kbService.keyReleased(e);
    });
    
  }]);
