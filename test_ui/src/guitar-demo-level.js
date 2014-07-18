//console.log("loading demo level");
var GuitarDemoLevel = [
                //image
                /*{order:0,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5-7/5 | 5-7/4 5-7/3 | 5-8/2 5-8/1",
                fretboard: "fretboard\nshow frets=5,8 strings=1,2,6\n show frets=5,7 strings=3,4,5\n show fret=5 string=6 text=A\n show fret=7 string=4 text=A\n show fret=5 string=1 text=A",
                title: "Intro",
                text: "Lets play a pentatonic scale!",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8],
                        [52,24,8],
                        [55,32,8],
                        [57,40,8],
                        [60,48,8],
                        [62,56,8],
                        [64,62,8],
                        [67,68,8],
                        [69,74,8],
                        [72,82,8]
                        ],
                turn: "pc"
                //next:[0,"next", -1]
                },*/
                {order:0,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5-7/5 | 5-7/4 ",
                fretboard: "fretboard\nshow frets=5,8 string=6\n show frets=5,7 strings=4,5\n show fret=5 string=6 text=A\n show fret=7 string=4 text=A",
                title: "Intro",
                text: "Lets play a pentatonic scale!",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8],
                        [52,24,8],
                        [55,32,8],
                        [57,40,8]
                        ],
                turn: "pc"
                //next:[0,"next", -1]
                },
                {order:1,
                vextab: "tabstave notation=true time=4/4\n notes 5/6",
                fretboard: "fretboard\nshow fret=5 string=6 color=green",
                title: "Intro",
                text: "Only the first note:",
                play: [
                        [45,0,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                },
                {order:2,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6",
                fretboard: "fretboard\nshow fret=5 string=6 color=green\nshow fret=8 string=6 color=red",
                title: "Intro",
                text: "Two notes now:",
                play: [
                        [45,0,8],
                        [48,8,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                },
                {order:3,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5/5",
                fretboard: "fretboard\nshow fret=5 string=6 color=green\nshow fret=8 string=6 color=red\nshow fret=5 string=5 color=red",
                title: "Intro",
                text: "Great! you got 2 right, now to the 3rd one:",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                },{order:4,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5-7/5 ",
                fretboard: "fretboard\n show frets=5,7 string=5\nshow fret=5 string=6 color=green\nshow fret=8 string=6 color=red\nshow frets=5,7 string=5 color=red",
                title: "Intro",
                text: "We are almost there!",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8],
                        [52,24,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                },{order:5,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5-7/5 | 5-7/4 ",
                fretboard: "fretboard\n show frets=5,7 string=5\nshow fret=5 string=6 color=green\nshow fret=7 string=4 color=green\nshow fret=8 string=6 color=red\nshow frets=5,7 string=5 color=red\nshow fret=5 string=4 color=red",
                title: "Intro",
                text: "And the whole pentatonic scale!",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8],
                        [52,24,8],
                        [55,32,8],
                        [57,40,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                }/*,{order:6,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5-7/5 | 5-7/4 5-7/3",
                fretboard: "fretboard\n show frets=5,7 string=5\nshow fret=5 string=6 color=green\nshow fret=7 string=4 color=green\nshow fret=8 string=6 color=red\nshow frets=5,7 string=5 color=red\nshow fret=5 string=4 color=red\nshow frets=5,7 string=3 color=red",
                title: "Intro",
                text: "Even better!",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8],
                        [52,24,8],
                        [55,32,8],
                        [57,40,8],
                        [60,48,8],
                        [62,56,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                },{order:7,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5-7/5 | 5-7/4 5-7/3 |  5-8/2 ",
                fretboard:"fretboard\n show frets=5,7 string=5\nshow fret=5 string=6 color=green\nshow fret=7 string=4 color=green\nshow fret=8 string=6 color=red\nshow frets=5,7 string=5 color=red\nshow fret=5 string=4 color=red\nshow frets=5,7 string=3 color=red\nshow frets=5,8 string=2 color=red",
                title: "Intro",
                text: "Wonderful, you are almost finished!!",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8],
                        [52,24,8],
                        [55,32,8],
                        [57,40,8],
                        [60,48,8],
                        [62,56,8],
                        [64,62,8],
                        [67,68,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                },{order:8,
                vextab: "tabstave notation=true time=4/4\n notes 5-8/6 5-7/5 | 5-7/4 5-7/3 | 5-8/2 ",
                fretboard: "fretboard\n show frets=5,7 string=5\nshow fret=5 string=6 color=green\nshow fret=7 string=4 color=green\nshow fret=5 string=1 color=green\nshow fret=8 string=6 color=red\nshow frets=5,7 string=5 color=red\nshow fret=5 string=4 color=red\nshow frets=5,7 string=3 color=red\nshow frets=5,8 string=2 color=red",
                title: "Intro",
                text: "And the last one!!",
                play: [
                        [45,0,8],
                        [48,8,8],
                        [50,16,8],
                        [52,24,8],
                        [55,32,8],
                        [57,40,8],
                        [60,48,8],
                        [62,56,8],
                        [64,62,8],
                        [67,68,8],
                        [69,74,8],
                        [69,74,8]
                        ],
                turn: "user"
                //next:[0,"next", -1]
                }*/
                
];
