const Karplus = require('../src/patches/Karplus')
const unDusp = require('../src/unDusp')
const dusp = require('../src/dusp')
const renderChannelData = require("../src/renderChannelData")
const play = require('../src/nodePlay')

let energySignal = unDusp('Noise * D0.01')
let f = unDusp('30')
let damp = unDusp('0.5')

let karplus1 = new Karplus(f, damp)
karplus1.ENERGY = energySignal

play(karplus1)
