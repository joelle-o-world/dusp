const DuspPlayer = require('../src/webaudioapi/DuspPlayer')

const allPlayers = []

function addPlayer(saveStr) {
  let destination=document.getElementById('players')
  let player = new DuspPlayer(saveStr)
  let div = player.interface.main
  destination.appendChild(div)
  allPlayers.push(player)
}

window.onload = function() {
  for(let i=0; i<window.localStorage.length; i++) {
    let key = window.localStorage.key(i)
    if(key.slice(0, 5) == 'dusp-')
      addPlayer(window.localStorage.getItem(key))
  }

  if(players.length == 0) {
    addPlayer()
  }

  allPlayers[0].interface.dusp.focus()
}


window.addPlayer = addPlayer
