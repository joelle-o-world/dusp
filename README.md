# Dusp

## Introduction
The Dusp language is a formal language for representing the structure of a DSP (digital signal processing) program using a minimal number of characters. It is a programming language in the sense that it can be compiled into instructions which a machine can perform. But it is unlike most programming language because it is limited to a specific domain (audio signal processing) and because it is primarily declarative rather than imperative.

The name Dusp is is a phonetic interpretation of the acronym D.S.P. - an abbreviation for digital signal procession.

It is designed to be readable and writable by both humans and computers. For the purposes of developing the language a javascript signal processing library has also been written. This can render audio from Dusp source code either using a command-line tool or a web user interface. However, future applications of the language are not necessarily limited to its use with this library.

## Tutorial One: Audio Processing Units.
DSP programs are typically structured as a collection of modular objects (small programs), each of which performs a specialised process on the signals which are routed in and out of it. This paradigm is familiar to anyone who has worked with Max MSP or Pure Data. Within the Dusp language, an object is notated using square brackets containing the objects name.

```
[Osc]
```

This represents a sine-wave oscillator which, by default, plays at 440Hz (concert-A). We can specify an alternative frequency with an argument. The following are all valid ways to specify the frequency of an oscillator.

```
[Osc 440]
```

or,				

```
[Osc f=440]
```

or,				

```
[Osc f:440]
```


We can also use nested objects (instead of numbers) as arguments.

```
[Osc f: [Ramp from:200 to:100 duration:2]]
```

This describes an oscillator with a decay envelope controlling the frequency - sliding from 200Hz to 100Hz over 2 seconds. Note that the Ramp object is declared inside the square brackets of the Osc object.

A complete list of audio processing objects can be found in the appendix of this document.

Sometimes we need to use the same object in multiple places in the same circuit. We can give a unit a unique name by including a hashtag immediately after the type declaration. For example:

```
[Osc #myOsc f:330]
```

This creates a new 330Hz sine wave oscillator and names it “myOsc”. Note that names may only contain letters and numbers. If we want to reuse this oscillator we can refer to it with #myOsc. The following example creates an oscillator and multiplies that oscillator by itself:
[Multiply A:[Osc #yourOsc f:100] B:#yourOsc]Tutorial Two: Shorthand Notations
Taken together, the square bracket and hashtag notations are sufficient to describe the architecture of almost every circuit that the Dusp language can represent. However, a complicated circuit will involve many layers of nested brackets and cross-referencing identity tags. This soon becomes unreadable, an example of this kind of circuit can be found in the appendix.

The real power of the language is in the shorthand notations for common DSP objects and operators. These make the code easier to read and write.

Shorthands for Objects:
Objects (both audio units and patches) can be created more concisely by a shorthand type indicator (eg/ Osc, Noise, etc.) followed by a single numeric argument. 
