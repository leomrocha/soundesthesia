console.log("loading demo level");
var PianoDemoLevel = [
                //image
                
                {order:0,
                src: "../images/demolevels/octave_piano.png", 
                title: "Intro",
                text: "I'll play a melody and then you copy. Ready?",
                play: [
                        [48,0,8],
                        [50,8,8],
                        [52,16,8],
                        [53,24,8],
                        [55,32,8],
                        [57,40,8],
                        [59,48,8],
                        [60,56,8]
                        ],
                turn: "pc"
                //next:[0,"next", -1]
                },
                {order:1,
                src: "../images/demolevels/do_piano.png", 
                title: "",
                text: "One step at a time, let's start playing a Do",
                play: [
                        [48,0,16]
                        ],
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:1,
                src: "../images/demolevels/do_piano.png", 
                title: "",
                text: "It's your turn now, play a Do, don't worry, I'll wait for you",
                play: [
                        [48,0,16]
                        ],
                turn: "user"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:1,
                src: "../images/demolevels/do_piano.png",  //TODO paint it in red
                title: "",
                text: "Great job",
                timeout: 2,
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:2,
                src: "../images/demolevels/dore_piano.png", 
                title: "",
                text: "Good job",
                play: [
                        [48,0,8],
                        [50,8,8]
                        ],
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:3,
                src: "../images/demolevels/doremi_piano.png", 
                title: "",
                text: "",
                play: [
                        [48,0,8],
                        [50,8,8],
                        [52,16,8]
                        ],
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:4,
                src: "../images/demolevels/doremifa_piano.png", 
                title: "",
                text: "",
                play: [
                        [48,0,8],
                        [50,8,8],
                        [52,16,8],
                        [53,24,8]
                        ],
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:5,
                src: "../images/demolevels/doremifasol_piano.png", 
                title: "",
                text: "",
                play: [
                        [48,0,8],
                        [50,8,8],
                        [52,16,8],
                        [53,24,8],
                        [55,32,8]
                        ],
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:6,
                src: "../images/demolevels/doremifasolla_piano.png", 
                title: "",
                text: "",
                play: [
                        [48,0,8],
                        [50,8,8],
                        [52,16,8],
                        [53,24,8],
                        [55,32,8],
                        [57,40,8]
                        ],
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:7,
                src: "../images/demolevels/doremifasollasi_piano.png", 
                title: "",
                text: "",
                play: [
                        [48,0,8],
                        [50,8,8],
                        [52,16,8],
                        [53,24,8],
                        [55,32,8],
                        [57,40,8],
                        [59,48,8]
                        ],
                turn: "pc"
                //next: things that will activate a next: 
                //next:[0,"next", -1]
                },
                {order:8,
                src: "../images/demolevels/octave_piano.png", 
                title: "End",
                text: "And now the whole melody!",
                play: [
                        [48,0,8],
                        [50,8,8],
                        [52,16,8],
                        [53,24,8],
                        [55,32,8],
                        [57,40,8],
                        [59,48,8],
                        [60,56,8]
                        ],
                turn: "pc"
                //next:[0,"next", -1]
                }
];
