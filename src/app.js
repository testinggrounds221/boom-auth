const path = require('path')
const http = require('http')
const express = require('express')
const socketio = require('socket.io')
const axios = require('axios');
var Chess = require('chess.js').Chess;

const app = express()
const server = http.createServer(app)
const io = socketio(server)
require('dotenv').config()
const port = process.env.PORT || 3000
const publicDirectoryPath = path.join(__dirname, '../public')
const { auth } = require('express-openid-connect');
const { requiresAuth } = require('express-openid-connect');
const config = {
  authRequired: true,
  auth0Logout: true,
  secret: process.env.AUTH0_SECRET,
  baseURL: 'https://boom-auth.testinggrounds.repl.co',
  clientID: process.env.AUTH0_CLIENT_ID,
  issuerBaseURL: 'https://dev-hdklbyherefykad5.us.auth0.com'
};
app.use(auth(config));
app.use(express.static(publicDirectoryPath))
app.get('/', requiresAuth(), (req, res) => {
  res.sendFile(path.join(__dirname, '../public/home.html'))
  // res.send(JSON.stringify(req.oidc.user));
});
app.get('/profile', requiresAuth(), (req, res) => {

  let userData = req.oidc.user
  console.log("userdata", userData);
  let data = {
    "player_email": userData.email
  }
  console.log("Retreving from DB : ", data)
  // TODO: throw errror if oponent is null
  axios.post(`${process.env.MONGODB_API}/getcheckpoints`, data)
    .then(function(response) {
      res.send(JSON.stringify({ userData, data: response.data, success: true }));
      // callback({ userData, data: response.data, success: true })
      // console.log(response.data);
    })
    .catch(function(error) {
      console.log(error);
      res.send({ data: error, success: false })
    });

  // res.send(JSON.stringify(req.oidc.user.data));

})
// const Data = new Map()
const gameData = new Map()
const userData = new Map()
const roomsList = new Set()
let roomFen = {}

let totalUsers = 0;

//Getting a connection
io.on('connection', (socket) => {
  totalUsers++;
  // console.log(totalUsers)
  //To render rooms list initially
  io.emit('roomsList', Array.from(roomsList));
  io.emit('updateTotalUsers', totalUsers)
  const updateStatus = (game, room) => {
    // checkmate?
    if (game.in_checkmate()) {
      io.to(room).emit('gameOver', game.turn(), true)
    }
    // draw? 
    else if (game.in_draw()) {
      io.to(room).emit('gameOver', game.turn(), false)
    }
    // game still on
    else {
      if (game.in_check()) {
        io.to(room).emit('inCheck', game.turn())
      }
      else {
        io.to(room).emit('updateStatus', game.turn())
      }
    }
  }

  //Creating and joining the room
  socket.on('joinRoom', ({ user, room, loadType, loadString }, callback) => {
    //We have to limit the number of users in a room to be just 2
    if (loadType == "fen")
      handleJoinFEN(user, room, loadString, callback)
    else if (loadType == "pgn")
      handleJoinSAN(user, room, loadString, callback)
    else if (loadType == "none")
      handleJoinNone(user, room, callback)
    else
      callback("Invalid load type")
    console.log(roomFen[room])
  })

  socket.on('saveHistory', (incomingData, callback) => {
    let opponent_mail = null
    var user = incomingData.player_mail
    var room = incomingData.room
    for (var x in userData) {
      if (userData[x].room === room) {
        if (userData[x].user !== user) {
          opponent_mail = userData[x].user
        }
      }
    }
    if (opponent_mail == null) {
      callback({ message: "Error Saving Checkpoint. Oponent not found", success: false })
      return
    }
    console.log("opp", opponent_mail)
    let data = {
      ...incomingData,
      time: JSON.stringify(new Date()),
      opponent_mail
    }
    console.log("Saving to DB : ", data)

    axios.post(`${process.env.MONGODB_API}/checkpoint`, data)
      .then(function(response) {
        callback({ message: "Successfully Saved Checkpoint", success: true })
        console.log(response.data);
      })
      .catch(function(error) {
        callback({ message: "Error occured in DB", success: false })
        callback(error)
      });
  })

  function handleJoinFEN(user, room, loadFen, callback) {
    if (io.nsps['/'].adapter.rooms[room] && io.nsps['/'].adapter.rooms[room].length === 2) {
      return callback('Already 2 users are there in the room!')
    }
    if (loadFen && loadFen.length > 1)
      roomFen[room] = { "fen": loadFen, "san": null }
    else return callback('No fen string')

    var alreadyPresent = false
    for (var x in userData) {
      if (userData[x].user == user && userData[x].room == room) {
        alreadyPresent = true
      }
    }
    // console.log(userData);
    //If same name user already present
    if (alreadyPresent) {
      return callback('Choose different name!')
    }

    socket.join(room)
    //Rooms List Update
    roomsList.add(room);
    io.emit('roomsList', Array.from(roomsList));
    totalRooms = roomsList.length
    io.emit('totalRooms', totalRooms)
    userData[user + "" + socket.id] = {
      room, user,
      id: socket.id,
    }

    //If two users are in the same room, we can start
    if (io.nsps['/'].adapter.rooms[room].length === 2) {
      //Rooms List Delete
      roomsList.delete(room);
      io.emit('roomsList', Array.from(roomsList));
      totalRooms = roomsList.length
      io.emit('totalRooms', totalRooms)
      var game = new Chess()
      if (room in roomFen) {
        game.load(roomFen[room]['fen'])
      }

      // TODO Error Handle game load
      //For getting ids of the clients
      for (var x in io.nsps['/'].adapter.rooms[room].sockets) {
        gameData[x] = game
      }
      //For giving turns one by one
      io.to(room).emit('Dragging', socket.id)
      // DUpliacte this here and in multiplayer
      io.to(room).emit('DisplayBoard', game.fen(), { source: null, target: null }, socket.id)
      delete roomFen[room]
      updateStatus(game, room)
    }
  }

  function handleJoinSAN(user, room, san, callback) {
    if (io.nsps['/'].adapter.rooms[room] && io.nsps['/'].adapter.rooms[room].length === 2) {
      return callback('Already 2 users are there in the room!')
    }
    // RESTRUCTURE ROOMFEN TO HOLD FEN AND PGN
    if (san && san.length > 1)
      roomFen[room] = { "fen": getFen(san), "san": san }

    var alreadyPresent = false
    for (var x in userData) {
      if (userData[x].user == user && userData[x].room == room) {
        alreadyPresent = true
      }
    }
    // console.log(userData);
    //If same name user already present
    if (alreadyPresent) {
      return callback('Choose different name!')
    }

    socket.join(room)
    //Rooms List Update
    roomsList.add(room);
    io.emit('roomsList', Array.from(roomsList));
    totalRooms = roomsList.length
    io.emit('totalRooms', totalRooms)
    userData[user + "" + socket.id] = {
      room, user,
      id: socket.id,
    }

    //If two users are in the same room, we can start
    if (io.nsps['/'].adapter.rooms[room].length === 2) {
      //Rooms List Delete
      roomsList.delete(room);
      io.emit('roomsList', Array.from(roomsList));
      totalRooms = roomsList.length
      io.emit('totalRooms', totalRooms)
      var game = new Chess()
      // if (loadFen && loadFen.length > 1)
      // 	game.load(loadFen)
      //For getting ids of the clients
      if (room in roomFen) {
        game.load(roomFen[room]['fen'])
      }
      // TODO Error Handle game load
      for (var x in io.nsps['/'].adapter.rooms[room].sockets) {
        gameData[x] = game
      }
      //For giving turns one by one
      io.to(room).emit('Dragging', socket.id)
      // Dupliacte this here and in multiplayer

      io.to(room).emit('DisplayBoardSAN', roomFen[room]['san'], { source: null, target: null }, socket.id)
      delete roomFen[room]
      updateStatus(game, room)
    }
  }

  function handleJoinNone(user, room, callback) {
    if (io.nsps['/'].adapter.rooms[room] && io.nsps['/'].adapter.rooms[room].length === 2) {
      return callback('Already 2 users are there in the room!')
    }

    var alreadyPresent = false
    for (var x in userData) {
      if (userData[x].user == user && userData[x].room == room) {
        alreadyPresent = true
      }
    }
    // console.log(userData);
    //If same name user already present
    if (alreadyPresent) {
      return callback('Choose different name!')
    }

    socket.join(room)
    //Rooms List Update
    roomsList.add(room);
    io.emit('roomsList', Array.from(roomsList));
    totalRooms = roomsList.length
    io.emit('totalRooms', totalRooms)
    userData[user + "" + socket.id] = {
      room, user,
      id: socket.id, "loadFen": ""
    }

    //If two users are in the same room, we can start
    if (io.nsps['/'].adapter.rooms[room].length === 2) {
      //Rooms List Delete
      roomsList.delete(room);
      io.emit('roomsList', Array.from(roomsList));
      totalRooms = roomsList.length
      io.emit('totalRooms', totalRooms)
      var game = new Chess()
      if (room in roomFen)
        game.load(roomFen[room]['fen'])


      //For getting ids of the clients
      for (var x in io.nsps['/'].adapter.rooms[room].sockets) {
        gameData[x] = game
      }
      //For giving turns one by one
      io.to(room).emit('Dragging', socket.id)
      // DUpliacte this here and in multiplayer
      if (room in roomFen && roomFen[room]['san'] != null)
        io.to(room).emit('DisplayBoardSAN', roomFen[room]['san'], { source: null, target: null }, socket.id)
      else
        io.to(room).emit('DisplayBoard', game.fen(), { source: null, target: null }, socket.id)
      delete roomFen[room]
      updateStatus(game, room)
    }
  }

  socket.on('changeHistory', ({ changeFen, room }) => {
    var game = gameData[socket.id]
    game.load(changeFen.moveFen)
    io.to(room).emit('changeHistoryFromSever', changeFen)
    updateStatus(game, room)
  })
  //For catching dropped event

  socket.on('Dropped', ({ source, target, room, currentSAN }) => {
    var game = gameData[socket.id]
    let sourcePiece = game.get(source)
    game.remove(source)
    game.put({ type: sourcePiece.type, color: sourcePiece.color }, target)
    let eg = game.fen()
    let isCheck = null
    if (game.turn() === 'w') {
      let myArray = eg.split(" ");
      myArray[1] = "b";
      isCheck = myArray.join(" ");
    }
    if (game.turn() === 'b') {
      let myArray = eg.split(" ");
      myArray[1] = "w";
      isCheck = myArray.join(" ");
    }
    game.load(isCheck)
    io.to(room).emit('Dragging', socket.id)
    io.to(room).emit('DisplayBoard', game.fen(), { source, target }, undefined, currentSAN)
    updateStatus(game, room)
  })

  socket.on('boomDropped', ({ source, target, room, currentSAN }) => {
    var game = gameData[socket.id]
    // console.log(move)		
    game.remove(target)
    let eg = game.fen()
    let isCheck = null
    if (game.turn() === 'w') {
      let myArray = eg.split(" ");
      myArray[1] = "b";
      isCheck = myArray.join(" ");
    }
    if (game.turn() === 'b') {
      let myArray = eg.split(" ");
      myArray[1] = "w";
      isCheck = myArray.join(" ");
    }
    game.load(isCheck)
    io.to(room).emit('Dragging', socket.id)
    io.to(room).emit('DisplayBoard', game.fen(), { source, target }, undefined, currentSAN)
    updateStatus(game, room)
  })

  socket.on('castleDropped', ({ source, target, room, currentSAN }) => {
    var game = gameData[socket.id]

    game.move({
      from: source,
      to: target,
      promotion: 'q' // NOTE: always promote to a queen for example simplicity
    })
    // let sourcePiece = game.get(source)
    // game.remove(source)
    // game.put({ type: sourcePiece.type, color: sourcePiece.color }, target)
    let eg = game.fen()
    console.log("ddedd", eg)
    let isCheck = null
    // if (game.turn() === 'w') {
    // 	let myArray = eg.split(" ");
    // 	myArray[1] = "b";
    // 	isCheck = myArray.join(" ");
    // }
    // if (game.turn() === 'b') {
    // 	let myArray = eg.split(" ");
    // 	myArray[1] = "w";
    // 	isCheck = myArray.join(" ");
    // }
    // game.load(isCheck)
    io.to(room).emit('Dragging', socket.id)
    io.to(room).emit('DisplayBoard', game.fen(), { source, target }, undefined, currentSAN)
    updateStatus(game, room)
  })

  socket.on('pawnPromoDropped', ({ source, target, pieceType, room, currentSAN }) => {
    var game = gameData[socket.id]
    // console.log(move)
    let isCheck = null
    game.remove(source)
    game.put(pieceType, target)
    let eg = game.fen()
    if (game.turn() === 'w') {
      let myArray = eg.split(" ");
      myArray[1] = "b";
      isCheck = myArray.join(" ");
    }
    if (game.turn() === 'b') {
      let myArray = eg.split(" ");
      myArray[1] = "w";
      isCheck = myArray.join(" ");
    }
    game.load(isCheck)
    io.to(room).emit('Dragging', socket.id)
    io.to(room).emit('DisplayBoard', game.fen(), { source, target }, undefined, currentSAN)
    updateStatus(game, room)
  })

  //Catching message event
  socket.on('sendMessage', ({ user, room, message }) => {
    io.to(room).emit('receiveMessage', user, message)
  })

  socket.on('emitSaveOnGameOver', ({ user, room }) => {
    io.to(room).emit('emitSave', user)
  })

  //Disconnected
  socket.on('disconnect', () => {
    totalUsers--;
    io.emit('updateTotalUsers', totalUsers)
    var room = '', user = '';
    for (var x in userData) {
      if (userData[x].id == socket.id) {
        room = userData[x].room
        user = userData[x].user
        delete userData[x]
      }
    }
    //Rooms Removed
    if (userData[room] == null) {
      //Rooms List Delete
      roomsList.delete(room);
      io.emit('roomsList', Array.from(roomsList));
      totalRooms = roomsList.length
      io.emit('totalRooms', totalRooms)
    }
    gameData.delete(socket.id)
    if (user != '' && room != '') {
      io.to(room).emit('disconnectedStatus');
    }
  })
})

function getFen(pgn) {

  // let pgn = sessionStorage.getItem("pgn");
  // sessionStorage.clear();
  let loadPGNGame = new Chess()
  let sp = pgn.split(" ")
  try {
    for (let i = 0; i < sp.length; i++) {
      if (i % 3 == 0) continue
      else {
        if (sp[i].includes("<")) {
          sp[i] = sp[i].replace("<", "")
          let c = new Chess(loadPGNGame.fen())
          let m = c.move(sp[i], { "verbose": true })
          c.put({ type: m.piece, color: m.color }, m.from)
          c.remove(m.to)
          loadPGNGame.load(c.fen())
        } else {
          loadPGNGame.move(sp[i])
        }
      }
    }
    return loadPGNGame.fen()
  } catch (error) {
    console.error(error)
    console.error("Enter Valid SAN")
    return null
  }
}

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`)
})