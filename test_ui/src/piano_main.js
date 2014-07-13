var pianoApp = angular.module("PianoProject", ["ngRoute"]);

////////////////////////////////////////////////////////////////////////////////
// DIRECTIVES
////////////////////////////////////////////////////////////////////////////////
/**
 * AngularJS has a problem with src element in object tags
 * here is a fix found at:
 * https://github.com/angular/angular.js/issues/339#issuecomment-19384664
 */
pianoApp.directive('embedSrc', function () {
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
// VIEWS
////////////////////////////////////////////////////////////////////////////////
pianoApp.config(function($routeProvider, $locationProvider){
    $routeProvider
        .when('/', {
            templateUrl: 'pages/home.html',
        })
        .when('/about', {
            templateUrl: 'pages/about.html',
        })
        .when('/contact', {
            templateUrl: 'pages/contact.html',
        })
        .when('/demo', {
            templateUrl: 'pages/demo.html',
        })
        .when('/subscribe', {
            templateUrl: 'pages/subscribe.html',
        })
        .when('/demo/piano', {
            templateUrl: 'pages/demos/piano.html',
            controller: 'demoPianoController'
        })
        .when('/demo/guitar', {
            templateUrl: 'pages/demos/guitar.html',
            controller: 'demoGuitarController'
        })
        .when('/demo/voice', {
            templateUrl: 'pages/demos/voice.html',
            controller: 'demoVoiceController'
        })
        /*.when('/blog/:post', {
            templateUrl: 'pages/blog_post.html',
            controller: 'postController'
        })*/
        .when('/blog', {
            templateUrl: 'pages/blog.html',
            controller: 'blogController'
        });
    
    // use HTML5 history API
    //I don't want to have pretty URLs if it avoids direct linking
    //so I take this out
    //$locationProvider.html5Mode(true);
    
});

