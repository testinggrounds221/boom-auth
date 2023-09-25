// import './../boardEditor.js'
const formEl = document.querySelectorAll('#joinForm > div > input')
const joinButtonEl = document.querySelector('#joinButton')
const messageEl = document.querySelector('#message')
const statusEl = document.querySelector('#status')
const roomsListEl = document.getElementById('roomsList');
const myAudioEl = document.getElementById('myAudio');
const totalRoomsEl = document.getElementById('rooms')
const totalPlayersEl = document.getElementById('players')
const ChatEl = document.querySelector('#chat')
const sendButtonEl = document.querySelector('#send')
const chatContentEl = document.getElementById('chatContent')
const saveFen = document.getElementById('saveFen');
const savePGN = document.getElementById('savePGN');
const saveCheckpoint = document.getElementById('saveCheckpoint');
let currentSource = null
var game = new Chess()
var turnt = 0;
let globalRooms = null
var editorTurnt = 0;
let play = true;
var editorBoard = null;
var boardJqry = $('#boardEditor')
var editorGame = new Chess()
var fen, editorGame, piece_theme, promote_to, promoting, promotion_dialog;
promotion_dialog = $("#promotion-dialog");
promoting = false;
piece_theme = "img/chesspieces/wikipedia/{piece}.png";
var squareToHighlight = null
var squareClass = 'square-55d63'

let isChangeFen = false
let changeFen = {}
let currentSAN = null

let waitForBoom = false

let configEditor = {
	draggable: true,
	position: 'start',
	orientation: 'white',
	onSnapEnd: onSnapEndEditor,
	onDrop: onDropEditor,
	onMoveEnd: onMoveEnd,
	onDragStart: () => { return false }
}
editorBoard = Chessboard('boardEditor', configEditor);
$("#promote-to").selectable({
	stop: function () {
		$(".ui-selected", this).each(function () {
			var selectable = $("#promote-to li");
			var index = selectable.index(this);
			if (index > -1) {
				var promote_to_html = selectable[index].innerHTML;
				var span = $("<div>" + promote_to_html + "</div>").find("span");
				promote_to = span[0].innerHTML;
			}
			promotion_dialog.dialog("close");
			$(".ui-selectee").removeClass("ui-selected");
			editorBoard.position(editorGame.fen(), false);
			// showSideToMove();
			promoting = false;
		});
	},
});

$(function () {
	$("#dialog-4").dialog({
		dialogClass: 'no-close',
		autoOpen: false,
		modal: true,
		buttons: {
			Yes: function () {
				moveBack($(this).data('move'))
				$(this).dialog("close");
				waitForBoom = false
				currentSAN += "<"
				handleBoomMove($(this).data('move').from, $(this).data('move').to)
			},
			No: function () {
				$(this).dialog("close");
				waitForBoom = false
				handleValidMove($(this).data('move').from, $(this).data('move').to)
				alertCheckMate()
			},
		},
	});
	// css("font-size", "30px");
	$("#opener-4").click(function () {
		$("#dialog-4").dialog("open");
	});
});
// old
var time_in_minutes = 30;
var current_time = null;
var deadline = null;
var paused = false;
var time_left;
var timeinterval;

// initializing semantic UI dropdown
$('.ui.dropdown')
	.dropdown();
$("#dialog").dialog({
	autoOpen: false
});

// function for defining onchange on dropdown menus
$("#roomDropdown").dropdown({
	onChange: function (val) {
		// console.log(val)
		// console.log('running the function')
		formEl[1].value = val
	}
});

//Connection will be established after webpage is refreshed
const socket = io()

//Triggers after a piece is dropped on the editorBoard
function onDrop(source, target) {
	//emits event after piece is dropped
	pause_clock();
	var room = formEl[1].value;
	myAudioEl.play();
	// isMyTurn(false)
	// socket.emit('Dropped', { source, target, room })
}

function onDropEditor(source, target) {
	if (source === target)
		return onClickSquare(source)
	currentSource = null
	if (isChangeFen) handleChangeHistory(changeFen)
	// see if the move is legal
	var move = editorGame.move({
		from: source,
		to: target,
		promotion: 'q' // NOTE: always promote to a queen for example simplicity
	})
	if (move) currentSAN = move["san"]
	let currentFen = editorGame.fen()
	let fun = 0;
	let validMovesOfPieces = editorGame.moves({ verbose: true, legal: false })
	for (let i = 0; i < validMovesOfPieces.length; i++) {
		if (validMovesOfPieces[i].from === source && validMovesOfPieces[i].to === target) {
			fun = 1;
			break;
		}
	}
	myAudioEl.play();
	// illegal move
	if (move === null) {
		console.log("Move is null")
		if (editorGame.get(target) && !isCheckAfterRemovePiece(currentFen, target)
			&& fun === 1) {
			currentSAN = getSAN(source, target)
			moveIllegal(source, target);
			handleBoomMove(source, target)
		}
		// TODO: EMit Check mate

		else if (editorGame.in_checkmate() || editorGame.in_check()) {
			console.log('Check Mate')
			if (editorGame.get(target) && !isCheckAfterRemovePiece(currentFen, target) && fun === 1) {
				currentSAN = getSAN(source, target)
				moveIllegal(source, target);
				handleBoomMove(source, target)
			} else {
				return
			}
		} else {
			console.log('Snap 2');
			return
		}
		return;
	} else {
		// changeSquareColorAfterMove(source, target)
		if (move.san === "O-O" || move.san === "O-O-O") {
			alertCheckMate()
			handleCastleMove(source, target)
			return
		}
	}
	if (move != null && 'captured' in move && move.piece != 'p') {
		waitForBoom = true
		editorGame.undo();
		if (!isCheckAfterRemovePiece(editorGame.fen(), move.to)) {
			var move = editorGame.move({
				from: source,
				to: target,
				promotion: 'q'
			})
			$("#dialog-4").data('move', move).dialog("open");
		} else {
			currentSAN = getSAN(source, target)
			var move = editorGame.move({
				from: source,
				to: target,
				promotion: 'q'
			})
			handleValidMove(source, target)
		}
	}
	editorGame.undo(); //move is ok, now we can go ahead and check for promotion
	// is it a promotion?
	var source_rank = source.substring(2, 1);
	var target_rank = target.substring(2, 1);
	if (source != null) {
		var piece = editorGame.get(source).type;
		if (
			piece === "p" &&
			((source_rank === "7" && target_rank === "8") ||
				(source_rank === "2" && target_rank === "1"))
		) {
			promoting = true;
			// get piece images
			$(".promotion-piece-q").attr("src", getImgSrc("q"));
			$(".promotion-piece-r").attr("src", getImgSrc("r"));
			$(".promotion-piece-n").attr("src", getImgSrc("n"));
			$(".promotion-piece-b").attr("src", getImgSrc("b"));
			//show the select piece to promote to dialog
			promotion_dialog
				.dialog({
					modal: true,
					height: 52,
					width: 184,
					resizable: true,
					draggable: false,
					close: () => {
						move.promotion = promote_to
						let promoMove = editorGame.move(move)
						if (promoMove) currentSAN = move["san"]
						let pt = { type: move.promotion, color: move.color }
						handlePawnPromo(source, target, pt)
						alertCheckMate()
					},
					closeOnEscape: false,
					dialogClass: "noTitleStuff",
				})
				.dialog("widget")
				.position({
					of: $("#boardEditorGame"),
					my: "middle middle",
					at: "middle middle",
				});
			//the actual move is made after the piece to promote to
			//has been selected, in the stop event of the promotion piece selectable
			return;
		} else {
			var move = editorGame.move({
				from: source,
				to: target,
				promotion: 'q' // NOTE: always promote to a queen for example simplicity
			})
		}

		// squareToHighlight = move.to
		editorTurnt = 1 - editorTurnt;
		// make random legal move for black
		// window.setTimeout(makeRandomMoveEditor, 250)

	}
	if (!waitForBoom) {
		alertCheckMate()
		handleValidMove(source, target)
	}
}

function onMoveEnd() {
	boardJqry.find('.square-' + squareToHighlight)
		.addClass('highlight-black')
}

function handleValidMove(source, target) {
	pause_clock();
	var room = formEl[1].value;
	myAudioEl.play();
	socket.emit('Dropped', { source, target, room, currentSAN })
}

function handleBoomMove(source, target) {
	pause_clock();
	var room = formEl[1].value;
	myAudioEl.play();
	socket.emit('boomDropped', { source, target, room, currentSAN })
}

function handleCastleMove(source, target) {
	pause_clock();
	var room = formEl[1].value;
	myAudioEl.play();
	socket.emit('castleDropped', { source, target, room, currentSAN })
}

function handlePawnPromo(source, target, pieceType) {
	pause_clock();
	var room = formEl[1].value;
	myAudioEl.play();
	socket.emit('pawnPromoDropped', { source, target, pieceType, room, currentSAN })
}

function handleChangeHistory(changeFen) {
	var room = formEl[1].value;
	// myAudioEl.play(); Can use Shuffle Sound ?
	socket.emit('changeHistory', { changeFen, room })
}

function onSnapEndEditor(params) {
	if (promoting) return; //if promoting we need to select the piece first
	editorBoard.position(editorGame.fen())
}

function saveFenListener(e) {
	e.preventDefault();
	var saveFenText = editorGame.fen();
	// navigator.clipboard.writeText(saveFenText);
	// alert("Copied the text: " + saveFenText + " to clipboard");
	downloadFile("fen.txt", saveFenText)
}

function savePGNListener(e) {
	e.preventDefault();
	let savePgnText = getPGN()

	downloadFile("pgn.txt", savePgnText)
}

function getPGN() {
	let wt = document.getElementById("whiteMoves")
	let bt = document.getElementById("blackMoves")

	let wr = wt.rows
	let br = bt.rows

	let wc = wr.length
	let bc = br.length

	let savePgnText = ""
	let wp = 0, bp = 0
	for (; wp < wc, bp < bc; wp++, bp++) {
		let w = wr[wp].children[0].innerText
		let b = br[bp].children[0].innerText
		savePgnText += (wp + 1 + ". " + w + " " + b + " ")
	}
	if (wp < wc)
		savePgnText += (wp + 1 + ". " + wr[wp].children[0].innerText)

	savePgnText = savePgnText.trim()
	return savePgnText
}

//Update Status Event
socket.on('updateEvent', ({ status, fen, pgn }) => {
	statusEl.textContent = status

})

socket.on('printing', (fen) => {
	console.log(fen)
})

//Catch Display event
socket.on('DisplayBoard', (fenString, mvSq, userId, currentSAN) => {
	// console.log(fenString)
	//This is to be done initially only
	if (userId != undefined) {
		current_time = Date.parse(new Date());
		deadline = new Date(current_time + time_in_minutes * 60 * 1000);
		messageEl.textContent = 'Match Started!! Best of Luck...'
		if (socket.id == userId) {
			configEditor.orientation = 'black'
			run_clock('clck', deadline);
			pause_clock()
		} else {
			run_clock('clck', deadline);
		}
		document.getElementById('joinFormDiv').style.display = "none";
		document.querySelector('#chessGame').style.display = null
		document.querySelector('#moveTable').style.display = null
		ChatEl.style.display = null
		document.getElementById('statusPGN').style.display = null
	}

	configEditor.position = fenString
	console.log(fenString)
	console.log(`Is received Fen String Valid ? ${editorGame.load(fenString)}`)
	editorBoard = ChessBoard('boardEditor', configEditor)
	console.log(editorGame.turn())
	editorBoard.position(fenString)
	addEventListeners()
	if (!userId)
		addMoveToHistory(fenString, currentSAN)
	if (mvSq.source && mvSq.target)
		changeSquareColorAfterMove(mvSq.source, mvSq.target)


	console.log(currentSAN)
	// document.getElementById('pgn').textContent = pgn
})

socket.on('DisplayBoardSAN', (pgn, mvSq, userId, currentSAN) => {
	// console.log(fenString)
	//This is to be done initially only
	if (userId != undefined) {
		current_time = Date.parse(new Date());
		deadline = new Date(current_time + time_in_minutes * 60 * 1000);
		messageEl.textContent = 'Match Started!! Best of Luck...'
		if (socket.id == userId) {
			configEditor.orientation = 'black'
			run_clock('clck', deadline);
			pause_clock()
		} else {
			run_clock('clck', deadline);
		}
		document.getElementById('joinFormDiv').style.display = "none";
		document.querySelector('#chessGame').style.display = null
		document.querySelector('#moveTable').style.display = null
		ChatEl.style.display = null
		document.getElementById('statusPGN').style.display = null
	}
	let fenString = null
	let result = setSANGame(pgn)
	if (result) fenString = result
	configEditor.position = fenString
	console.log(fenString)
	console.log(`Is received Fen String Valid ? ${editorGame.load(fenString)}`)
	editorBoard = ChessBoard('boardEditor', configEditor)
	console.log(editorGame.turn())
	editorBoard.position(fenString)
	addEventListeners()
	if (!userId)
		addMoveToHistory(fenString, currentSAN)
	if (mvSq.source && mvSq.target)
		changeSquareColorAfterMove(mvSq.source, mvSq.target)


	// console.log(currentSAN)
	// document.getElementById('pgn').textContent = pgn
})

socket.on('changeHistoryFromSever', (changeFen) => {
	addEventListeners()
	isChangeFen = false
	setBoardAndGame(changeFen)
})

//To turn off dragging
socket.on('Dragging', id => {
	if (socket.id != id) {
		configEditor.draggable = true;//"white dont drag"		
	} else {
		configEditor.draggable = false;//black dont drag		
	}
})



//To Update Status Element
socket.on('updateStatus', (turn) => {
	if (editorBoard.orientation().includes(turn)) {
		statusEl.textContent = "Your turn"
		resume_clock()
	}
	else {
		statusEl.textContent = "Opponent's turn"
		pause_clock()
	}
})

//If in check
socket.on('inCheck', turn => {
	if (editorBoard.orientation().includes(turn)) {
		statusEl.textContent = "You are in Check!!"
	}
	else {
		statusEl.textContent = "Opponent is in Check!!"
	}
})

//If win or draw
socket.on('gameOver', (turn, win) => {
	configEditor.draggable = false;
	if (win) {
		if (editorBoard.orientation().includes(turn)) {
			statusEl.textContent = "You lost, better luck next time :)"
			alert("You lost")
		}
		else {
			statusEl.textContent = "Congratulations, you won!!"
			alert("You Won")
		}
	}
	else {
		statusEl.value = 'Game Draw'
	}
})

//Client disconnected in between
socket.on('disconnectedStatus', () => {
	alert('Opponent left the game!!')
	messageEl.textContent = 'Opponent left the game!!'
})

//Receiving a message
socket.on('receiveMessage', (user, message) => {
	var chatContentEl = document.getElementById('chatContent')
	//Create a div element for using bootstrap
	chatContentEl.scrollTop = chatContentEl.scrollHeight;
	var divEl = document.createElement('div')
	if (formEl[0].value == user) {
		divEl.classList.add('myMessage');
		divEl.textContent = message;
	}
	else {
		divEl.classList.add('youMessage');
		divEl.textContent = message;
		document.getElementById('messageTone').play();
	}
	var style = window.getComputedStyle(document.getElementById('chatBox'));
	if (style.display === 'none') {
		document.getElementById('chatBox').style.display = 'block';
	}
	chatContentEl.appendChild(divEl);
	divEl.focus();
	divEl.scrollIntoView();
})
//Rooms List update
socket.on('roomsList', (rooms) => {
	// roomsListEl.innerHTML = null;
	// console.log('Rooms List event triggered!! ',  rooms);
	totalRoomsEl.innerHTML = rooms.length
	globalRooms = rooms
	var dropRooms = document.getElementById('dropRooms')
	while (dropRooms.firstChild) {
		dropRooms.removeChild(dropRooms.firstChild)
	}
	// added event listener to each room
	rooms.forEach(x => {
		var roomEl = document.createElement('div')
		roomEl.setAttribute('class', 'item')

		roomEl.setAttribute('data-value', x)
		roomEl.textContent = x;
		dropRooms.appendChild(roomEl)
	})
})

socket.on('updateTotalUsers', totalUsers => {
	// console.log('event listened')
	totalPlayersEl.innerHTML = totalUsers;
})

//Message will be sent only after you click the button
sendButtonEl.addEventListener('click', (e) => {
	e.preventDefault()
	var message = document.querySelector('#inputMessage').value
	var user = formEl[0].value
	var room = formEl[1].value
	document.querySelector('#inputMessage').value = ''
	document.querySelector('#inputMessage').focus()
	socket.emit('sendMessage', { user, room, message })
})

//Connect clients only after they click Join
joinButtonEl.addEventListener('click', (e) => {
	// VALIDATE WHETHER FEN OR PGN IS IN SESSION STORAGE
	e.preventDefault()

	var user = formEl[0].value, room = formEl[1].value

	if (!user || !room) {
		messageEl.textContent = "Input fields can't be empty!"
	}
	else {
		joinButtonEl.setAttribute("disabled", "disabled");
		formEl[0].setAttribute("disabled", "disabled")
		document.querySelector('#roomDropdownP').style.display = 'none';
		formEl[1].setAttribute("disabled", "disabled")
		//Now Let's try to join it in room // If users more than 2 we will 

		const urlParams = new URLSearchParams(window.location.search);
		if (!urlParams.get('loadGame')) console.error("NO LOADGAME Instructions")
		let loadFen = null
		let isRoomPresent = false
		for (let r of globalRooms) if (room === r) isRoomPresent = true
		if (isRoomPresent && urlParams.get('loadGame') === 'true') {
			// switch (urlParams.get('loadGameType')) {
			// 	case "fen":
			// 		loadFen = promptFen()
			// 		break;
			// 	case "san":
			// 		let result = setSANGame()					
			// 		if (result) loadFen = result
			// 		break;
			// 	case "none":
			// 		console.error("Load Game true but no config (none)")
			// 		break;
			// 	default:
			// 		console.error("Load Game true but no config")
			// 		break;
			// }
		}
		function emitJoinRoom(loadType, loadString) {

			// loadType = "pgn" | "fen" | "none"
			// loadString = "" | "loadtype string"
			socket.emit('joinRoom', { user, room, loadType, loadString }, (error) => {
				messageEl.textContent = error
				if (alert(error)) {
					window.location.reload()
				}
				else    //to reload even if negative confirmation
					window.location.reload();
			})
			sessionStorage.clear()
		}

		// emitJoinRoom("fen", "r1bqkbn1/pp1pp1pr/n1p2p2/4P2p/3P2P1/N2Q1N2/PPP1KP1P/R1B2B1R w q - 0 8")
		// emitJoinRoom("fen", "rnbqkbnr/8/1p1p1p1p/p1p1p1pP/1P1P1P2/P1P1P1P1/8/RNBQKBNR b KQkq - 0 9")

		// emitJoinRoom("pgn", "1. f3 h6 2. g3 g6 3. h3")
		// emitJoinRoom("pgn", "1. h3 a6 2. g3 b6 3. f3 c6 4. e3 d6 5. d3 e6 6. c3 f6 7. b3 g6 8. a3 h6 9. h4")



		if (sessionStorage.length === 0)
			emitJoinRoom("none", "")
		else if (sessionStorage.length === 2)
			emitJoinRoom(sessionStorage.getItem("loadType"), sessionStorage.getItem("loadString"))
		else
			alert("Restart Browser")


		messageEl.textContent = "Waiting for other player to join"
	}
})

saveFen.addEventListener('click', saveFenListener)
savePGN.addEventListener('click', savePGNListener)
saveCheckpoint.addEventListener('click', saveCheckpointListener)


function time_remaining(endtime) {
	var t = Date.parse(endtime) - Date.parse(new Date());
	var seconds = Math.floor((t / 1000) % 60);
	var minutes = Math.floor((t / 1000 / 60) % 60);
	var hours = Math.floor((t / (1000 * 60 * 60)) % 24);
	var days = Math.floor(t / (1000 * 60 * 60 * 24));
	return { 'total': t, 'days': days, 'hours': hours, 'minutes': minutes, 'seconds': seconds };
}

function run_clock(id, endtime) {
	var clock = document.getElementById(id);
	function update_clock() {
		var t = time_remaining(endtime);
		clock.innerHTML = t.minutes + ' : ' + t.seconds;
		if (t.total <= 0) { clearInterval(timeinterval); }
	}
	update_clock(); // run function once at first to avoid delay
	timeinterval = setInterval(update_clock, 1000);
}

function pause_clock() {
	if (!paused) {
		paused = true;
		clearInterval(timeinterval); // stop the clock
		time_left = time_remaining(deadline).total; // preserve remaining time
	}
}

function resume_clock() {
	if (paused) {
		paused = false;
		deadline = new Date(Date.parse(new Date()) + time_left);
		run_clock('clck', deadline);
	}
}

//For removing class from all buttons


// Color Buttons
document.getElementById('messageBox').addEventListener('click', e => {
	e.preventDefault();
	var style = window.getComputedStyle(document.getElementById('chatBox'));
	if (style.display === 'none') {
		document.getElementById('chatBox').style.display = 'block';
	} else {
		document.getElementById('chatBox').style.display = 'none';
	}
})

function isCheckAfterRemovePiece(fen, square) {
	// we see isCheck for turn
	let c = new Chess()
	c.load(fen)
	c.remove(square)
	return c.in_check() // If in Check dont allow to cut, remove from valid moves
}

function moveIllegal(source, target) {
	if (!editorGame.get(target)) return
	let currentFen = editorGame.fen()
	var custommove = editorGame.get(source);
	editorGame.load(currentFen)
	editorGame.put({ type: custommove.type, color: custommove.color }, target)
	editorGame.remove(target)
	let isCheck = null
	let eg = editorGame.fen()

	if (editorGame.turn() === 'w') {
		let myArray = eg.split(" ");
		myArray[1] = "b";
		isCheck = myArray.join(" ");
	}
	if (editorGame.turn() === 'b') {
		let myArray = eg.split(" ");
		myArray[1] = "w";
		isCheck = myArray.join(" ");
	}

	editorGame.load(isCheck)
	editorBoard.position(isCheck, false);

	// changeSquareColorAfterMove(source, target)
}

function changeSquareColorAfterMove(source, target) {
	boardJqry.find('.' + squareClass)
		.removeClass('highlight-from')
	boardJqry.find('.' + squareClass)
		.removeClass('highlight-to')
	boardJqry.find('.square-' + source).addClass('highlight-from')
	boardJqry.find('.square-' + target).addClass('highlight-to')
}
//TODO: Emit Check mate
function alertCheckMate() {
	if (editorGame.in_checkmate() && isBoomCheckMate(editorGame.fen())) {
		if (editorBoard.orientation().includes(editorGame.turn())) {
			statusEl.textContent = "You lost, better luck next time :)"
			alert("You lost")
		}
		else {
			statusEl.textContent = "Congratulations, you won!!"
			// alert("You Won")
		}

		// if (editorGame.turn() === 'w')
		// 	alert('Black Wins')
		// if (editorGame.turn() === 'b')
		// 	alert('White Wins')
		return
	}
}

function isBoomCheckMate(fen) {
	let c = new Chess()
	c.load(fen)

	// console.log(c.moves({ verbose: true, legal: false }))
	let f = 0
	let mvs = c.moves({ verbose: true, legal: false })
	for (let i = 0; i < mvs.length; i++) {
		const mv = mvs[i];

		if (mv.flags === 'c' && !isCheckAfterRemovePiece(fen, mv.to)) {
			console.log(mv) // ! DO NOT DLT. Keep This Console Log for moves
			f++;
		}
	}
	return (!f > 0)
}

function moveBack(move) {
	let currentFen = editorGame.fen()
	editorGame.load(currentFen)
	editorGame.put({
		type: move.piece,
		color: move.color
	}, move.from)
	editorGame.remove(move.to)
	if (!editorGame.fen().includes("k")) {
		editorGame.put({
			type: 'k',
			color: 'b'
		}, move.from)
	}
	if (!editorGame.fen().includes("K")) {
		editorGame.put({
			type: 'k',
			color: 'w'
		}, move.from)
	}
	editorBoard.position(editorGame.fen())
	let isCheck = null
	let eg = editorGame.fen()
	if (editorGame.turn() === 'w') {
		let myArray = eg.split(" ");
		myArray[1] = "b";
		isCheck = myArray.join(" ");
	}
	if (editorGame.turn() === 'b') {
		let myArray = eg.split(" ");
		myArray[1] = "w";
		isCheck = myArray.join(" ");
	}
	let tempG = new Chess()
	console.log("Is valid fen", tempG.load(isCheck))
	if (tempG.in_check()) {
		editorGame.load(currentFen)
		editorBoard.position(editorGame.fen())
		return {
			s: -1,
			m: "Cant Move back as it leads to Check"
		}
	}
	editorTurnt = 1 - editorTurnt;
	alertCheckMate()
	waitForBoom = false
	return {
		s: 1,
		m: "Moved Back"
	}

}

function getImgSrc(piece) {
	return piece_theme.replace(
		"{piece}",
		editorGame.turn() + piece.toLocaleUpperCase()
	);
}

function addEventListeners() {
	editorGame.SQUARES.forEach(
		(sq) => boardJqry.find('.square-' + sq).bind('click',
			() => {
				onClickSquare(sq)
			}
		))
}

function currHighlight(sq) {
	boardJqry.find('.square-' + sq).addClass('highlight-curr')
}

function removeCurrHighlight() {
	boardJqry.find('.' + squareClass).removeClass('highlight-curr')
}

function onClickSquare(sq) {

	if (currentSource === null) {
		if (editorGame.get(sq) === null) return
		if (editorBoard.orientation().startsWith(editorGame.get(sq).color) && editorGame.turn().startsWith(editorGame.get(sq).color)) {
			currentSource = sq
			currHighlight(sq)
			return
		}
	}
	else {
		if (editorGame.get(sq) === null) {
			onDropEditor(currentSource, sq)
			removeCurrHighlight()
			currentSource = null
			return
		}

		if (editorGame.get(sq).color === editorGame.get(currentSource).color) {
			currentSource = null
			removeCurrHighlight()
			return
		}

		if (editorGame.get(sq).color !== editorGame.get(currentSource).color) {
			onDropEditor(currentSource, sq)
			currentSource = null
			removeCurrHighlight()
			return
		}
	}
}

// Change History Functions
function addMoveToHistory(moveFen, currentSAN) {
	let moveTable = null
	const currTurn = editorGame.turn()
	if (currTurn === 'b')
		moveTable = document.getElementById("whiteMoves")
	else moveTable = document.getElementById("blackMoves")

	let tr = document.createElement("tr")
	let td = document.createElement("td")
	const rowNum = moveTable.rows.length
	// td.innerText = `Move ${rowNum + 1}`
	td.innerText = currentSAN
	currentSAN = null
	// td.addEventListener('click', () => { previewFen(moveFen, rowNum, currTurn) })
	td.style = "cursor:pointer"
	tr.appendChild(td)
	tr.id = `m${currTurn}-${rowNum}`
	moveTable.appendChild(tr)
}

function previewFen(moveFen, rowNum, turn) {
	currentSource = null
	boardJqry.find('.' + squareClass)
		.removeClass('highlight-from')
	boardJqry.find('.' + squareClass)
		.removeClass('highlight-to')
	if (!(editorGame.turn() == editorBoard.orientation()[0])) return

	console.log(editorGame.turn(), editorBoard.orientation()[0])
	console.log(typeof (editorGame.turn()), typeof (editorBoard.orientation()[0]))
	editorGame.load(moveFen)
	editorBoard.position(moveFen)
	changeFen = { moveFen, rowNum, turn }
	isChangeFen = true
}

function getSAN(source, target) {
	if (editorGame.get(target)) editorGame.get(source).type.toUpperCase() + "x" + target
	return editorGame.get(source).type.toUpperCase() + target
}

function setBoardAndGame({ moveFen, rowNum, turn }) {
	isChangeFen = false
	editorGame.load(moveFen)
	editorBoard.position(moveFen)
	// TODO emit Change History like in handle valid move
	const whiteTable = document.getElementById("whiteMoves")
	const blackTable = document.getElementById("blackMoves")

	const maxLenW = whiteTable.rows.length
	const maxLenB = blackTable.rows.length

	// for (let i = rowNum; i < maxLenW; i++) {
	// 	document.getElementById(`mb-${i}`).remove()
	// }

	// for (let i = rowNum; i < maxLenB; i++) {
	// 	document.getElementById(`mw-${i}`).remove()
	// }
	const removeID = (id) => {
		let ele = document.getElementById(id)
		if (ele) ele.remove()
		else console.error(id + "Not found")
	}


	if (editorBoard.orientation()[0] === 'w') {
		for (let i = rowNum; i < maxLenW; i++) { // DO NOT ADD 1. IT COMES FROM DISPLAY BOARD.
			removeID(`mb-${i}`)
		}
		for (let i = rowNum; i < maxLenB; i++) {
			removeID(`mw-${i}`)
		}
	}
	else {
		for (let i = rowNum + 1; i < maxLenW; i++) { // DO NOT ADD 1. IT COMES FROM DISPLAY BOARD.
			removeID(`mb-${i}`)
		}
		for (let i = rowNum; i < maxLenB; i++) {
			removeID(`mw-${i}`)
		}
	}
}

function setBoardAndGameNew({ moveFen, rowNum, turn }) {
	isChangeFen = false
	editorGame.load(moveFen)
	editorBoard.position(moveFen)
	// TODO emit Change History like in handle valid move
	const whiteTable = document.getElementById("whiteMoves")
	const blackTable = document.getElementById("blackMoves")

	const maxLenW = whiteTable.rows.length
	const maxLenB = blackTable.rows.length

	// for (let i = rowNum; i < maxLenW; i++) {
	// 	document.getElementById(`mb-${i}`).remove()
	// }

	// for (let i = rowNum; i < maxLenB; i++) {
	// 	document.getElementById(`mw-${i}`).remove()
	// }
	const removeID = (id) => {
		let ele = document.getElementById(id)
		if (ele) ele.remove()
		else console.error(id + "Not found")
	}

	for (let i = rowNum + 1; i < maxLenW; i++) { // DO NOT ADD 1. IT COMES FROM DISPLAY BOARD.
		removeID(`mb-${i}`)
	}
	for (let i = rowNum; i < maxLenB; i++) {
		removeID(`mw-${i}`)
	}

}

function setPGNGameFromServer(pgn) {
	let loadPGNGame = new Chess()
	let sp = pgn.split(" ")
	try {
		for (let i = 0; i < sp.length; i++) {
			if (i % 3 == 0) continue
			else {
				let currentPgn = sp[i]
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
				addMoveFromSAN(loadPGNGame.fen(), loadPGNGame.turn(), currentPgn)
			}
		}
		return loadPGNGame.fen()
	} catch (error) {
		console.error(error)
		alert("Enter Valid SAN")
		return null
	}
}

function setSANGame(pgn) {
	let loadPGNGame = new Chess()
	let sp = pgn.split(" ")
	try {
		for (let i = 0; i < sp.length; i++) {
			if (i % 3 == 0) continue
			else {
				let currentPgn = sp[i]
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
				addMoveFromSAN(loadPGNGame.fen(), loadPGNGame.turn(), currentPgn)
			}
		}
		// console.log(loadPGNGame.fen())		
		// alert("Loaded Game! Choose Color");
		return loadPGNGame.fen()
	} catch (error) {
		console.error(error)
		alert("Enter Valid SAN")
		return null
	}
}

function addMoveFromSAN(moveFen, currCustomTurn, currentCustomPgn) {
	let moveTable = null
	if (currCustomTurn === 'b')
		moveTable = document.getElementById("whiteMoves")
	else moveTable = document.getElementById("blackMoves")

	let tr = document.createElement("tr")
	let td = document.createElement("td")
	const rowNum = moveTable.rows.length
	// td.innerText = `Move ${rowNum + 1}`

	td.innerText = currentCustomPgn
	if (editorBoard.orientation()[0] === currCustomTurn)
		td.addEventListener('click', () => { previewFen(moveFen, rowNum, currCustomTurn) })
	td.style = "cursor:pointer"
	tr.appendChild(td)
	tr.id = `m${currCustomTurn}-${rowNum}`
	moveTable.appendChild(tr)
}

// File Handling Operarions
function downloadFile(filename, text) {
	var element = document.createElement('a');
	element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
	element.setAttribute('download', filename);

	element.style.display = 'none';
	document.body.appendChild(element);

	element.click();

	document.body.removeChild(element);
}

function saveCheckpointListener() {
	var user = formEl[0].value, room = formEl[1].value
	let savePgnText = getPGN()

	socket.emit('saveHistory', {
		"player_mail": user,
		room,
		"color": editorBoard.orientation(),
		"history": savePgnText,
		"checkPointName": "chckName"
	}, (data) => {
		alert(data.message)
	})
}

function setUserName(params) {
	const userName = document.getElementById("userName");

	axios
		.get("/profile")
		.then(function (response) {
			// handle success
			console.log(response.data);
			userName.value = response.data.userData.email;
			userName.disabled = true;
			userName.style.border = "gray"
		})
		.catch(function (error) {
			// handle error
			console.log(error);
		})
		.finally(function () {
			// always executed
		});
}
setUserName()