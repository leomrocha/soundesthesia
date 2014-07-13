var micCaptureDirectives = angular.module("capture.mic.directives", ["midi.pubsub.service"]);

micCaptureDirectives.directive('micCaptureControlsDirective', ['$scope', function($scope){
    return{
        templateUrl: 'templates/mic_controls.html'  //TODO make the template
        }
    }]);

micCaptureDirectives.directive('micCaptureDisplayDirective', ['$scope', function($scope){
    return{
        templateUrl: 'templates/mic_simple_display.html'  //TODO make the template
        }
    }]);

