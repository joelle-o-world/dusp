const unDusp = require('../src/unDusp')
const renderChannelData = require('../src/renderChannelData')

let outlet = unDusp('(O200 + O250) @ 0')
//console.log("outlet:", outlet)

let channelData = renderChannelData(outlet, 1).then(cd => {
  console.log(cd, cd.length)
})
