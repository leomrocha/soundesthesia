var micCaptureController = angular.module("capture.mic.controller", ["midi.pubsub.service"]);

////////////////////////////////////////////////////////////////////////////////
// Microphone capture
////////////////////////////////////////////////////////////////////////////////
micCaptureController.controller('micCaptureController', ['$scope', 'micCaptureService', function($scope,  micService) {
    
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
