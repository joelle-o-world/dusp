const DuspPlayer = require('../src/webaudioapi/DuspPlayer')

const allPlayers = []
let currentEditor = null

function addPlayer(saveStr) {
  let destination=document.getElementById('players')
  let player = new DuspPlayer(saveStr)
  let div = player.interface.main
  let wrapper = document.createElement('div')
  wrapper.className = 'DuspPlayer_wrapper'
  wrapper.appendChild(div)
  destination.appendChild(wrapper)
  allPlayers.push(player)

  player.interface.dusp.onfocus = () => {
    blurEditor()
    player.interface.main.setAttribute('currentEditor', true)
    currentEditor = player
    window.onkeydown = function(e) {
      if(e.key == 'Escape') {
        blurEditor()
        window.onkeydown = null
      }
    }
    document.getElementById('escapebtn').className = 'visible'
  }

}

function blurEditor() {
  if(currentEditor)
    currentEditor.interface.main.setAttribute('currentEditor', false)
  currentEditor = null
  document.getElementById('escapebtn').className = 'hidden'
}
window.blurEditor = blurEditor

window.onload = function() {
  for(let i=0; i<window.localStorage.length; i++) {
    let key = window.localStorage.key(i)
    if(key.slice(0, 5) == 'dusp-')
      addPlayer(window.localStorage.getItem(key))
  }

  if(players.length == 0)
    addPlayer()

//  allPlayers[0].interface.dusp.focus()
}


window.addPlayer = addPlayer
