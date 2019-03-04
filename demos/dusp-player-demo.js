const DuspPlayer = require('../src/webaudioapi/DuspPlayer')

function addPlayer(destination=document.getElementById('players')) {
  let player = new DuspPlayer
  let div = player.htmlInterface()
  destination.appendChild(div)
}

window.onload = function() {
  addPlayer()
}


window.addPlayer = addPlayer
