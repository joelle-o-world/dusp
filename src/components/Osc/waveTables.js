const config = require("../../config.js");

const PHI = 2 * Math.PI;

const sineTable = new Float32Array(config.sampleRate + 1);
for (let t = 0; t < sineTable.length; t++) {
  sineTable[t] = Math.sin((PHI * t) / sineTable.length);
}

const sawTable = new Float32Array(config.sampleRate + 1);
for (let t = 0; t < config.sampleRate; t++)
  sawTable[t] = -1 + (t * 2) / sawTable.length;

const triangleTable = new Float32Array(config.sampleRate + 1);
const quarterSampleRate = config.sampleRate / 4;
for (let t = 0; t < quarterSampleRate; t++) {
  triangleTable[t] = (t / config.sampleRate) * 4;
  triangleTable[t + quarterSampleRate] = 1 - triangleTable[t];
  triangleTable[t + quarterSampleRate * 2] = -triangleTable[t];
  triangleTable[t + quarterSampleRate * 3] = -1 + triangleTable[t];
}
triangleTable[config.sampleRate] = 0;

const squareTable = new Float32Array(config.sampleRate + 1);
squareTable.fill(1, 0, config.sampleRate / 2);
squareTable.fill(-1, config.sampleRate / 2, config.sampleRate + 1);

const twoToTheSeven = Math.pow(2, 7);
const eightBitTable = sineTable.map(
  (sample) => Math.round(sample * twoToTheSeven) / twoToTheSeven
);

module.exports = {
  sin: sineTable,
  sine: sineTable,
  saw: sawTable,
  square: squareTable,
  triangle: triangleTable,
  "8bit": eightBitTable,
};
