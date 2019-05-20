const {unDusp, dusp} = require('../src/')

let outlet = unDusp('2 + 3 * 4 + 5 -> O')
console.log(dusp(outlet))
