// TODO : BOard Refreshes to new state after loading
const whiteColor = document.getElementById('white');
const blackColor = document.getElementById('black');
// TODO If URL params have type=fromProfile then load game from session directly

const myAudioEl = document.getElementById('myAudio');
// const startEditor = document.getElementById('startEditor');
var editorTurnt = 0;
let play = true;
var configEditor = {};
var editorBoard = null;
var boardJqry = $('#boardEditor')
let org = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
let tc1 = 'rnbq1k1r/pppB1ppp/5n2/8/4Q3/8/PPPPPPPP/RNB1K1NR w - - 0 1'
let tc2 = 'rnbqkbnr/ppp1pppp/8/3p3Q/8/3K4/PPPPPPPP/RNB2BNR w - - 0 1'
let tc3 = 'r3k2r/p1pp1ppp/bpnbpq1n/8/3Q4/N3BNPB/PPP1PP1P/R3K2R w KQkq - 0 1'
var editorGame;
var fen, piece_theme, promote_to, promoting, promotion_dialog;
promotion_dialog = $("#promotion-dialog");
promoting = false;
piece_theme = "img/chesspieces/wikipedia/{piece}.png";
var squareToHighlight = null
var squareClass = 'square-55d63'
let currentSource = null

let currentSAN = null

const isBoomAllowed = true
const playWithComp = true
let loadGame = true

let loadGameFen = null
let isChangeFen = false
let changeFen = {} // Used to load Previous Configuration of same game
let states = []
let currentStateIndex = 0
let isLoadTypePGN = false

let waitForBoom = false
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
				makeRandomMoveEditor()
			},
			No: function () {
				$(this).dialog("close");
				waitForBoom = false
				alertCheckMate()
				makeRandomMoveEditor()

			},
		},
	});
	// css("font-size", "30px");
	$("#opener-4").click(function () {
		$("#dialog-4").dialog("open");
	});
});
document.getElementById('backButton').addEventListener("click", (e) => {
	e.preventDefault();
	sessionStorage.clear();
	if (urlParams.get('type') && urlParams.get('type') === 'fromProfile') window.location.href = "/profile.html"
	else
		window.location.reload()
});
document.getElementById('startState').addEventListener("click", (e) => { e.preventDefault(); startState() });
document.getElementById('prevState').addEventListener("click", (e) => { e.preventDefault(); prevState() });
document.getElementById('nextState').addEventListener("click", (e) => { e.preventDefault(); nextState() });
document.getElementById('endState').addEventListener("click", (e) => { e.preventDefault(); endState() });


const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('type') && urlParams.get('type') === 'fromProfile')
	setupGameBoard(sessionStorage.getItem("loadColor"))
function setupGameBoard(orientation = 'white') {
	if (setLoadGame()) {
		document.getElementById('gameMode').style.display = "none";
		document.getElementById('backButton').style.display = null;
		if (isLoadTypePGN) document.getElementById('navigation').style.display = null;
		document.getElementById('moveTable').style.display = null;
		document.querySelector('#boardEditorGame').style.display = null;

		configEditor = {
			draggable: false,
			position: 'start',
			onSnapEnd: () => { return },
			onDragStart: () => { return },
			onDrop: () => { return },
			onMoveEnd: () => { return },
			orientation: orientation
		}
		editorGame = new Chess()
		if (loadGame && loadGameFen) {
			configEditor = { ...configEditor, position: loadGameFen };
			editorGame.load(loadGameFen)
		}
		editorBoard = Chessboard('boardEditor', configEditor);
		addEventListeners()
		if (orientation === 'black' && editorGame.turn() == 'w') makeRandomMoveEditor()
		if (orientation === 'white' && editorGame.turn() == 'b') makeRandomMoveEditor()
		sessionStorage.clear()
		if (isLoadTypePGN)
			updateCurrentStateIndex(states.length - 1)
	}
	else {
		alert("Enter Valid game state")
		let targetToClear = document.getElementById("pgnFile");
		targetToClear.value = "";
		targetToClear = document.getElementById("fenFile");
		targetToClear.value = "";
		sessionStorage.clear()
	}
}

whiteColor.addEventListener('click', (e) => {
	e.preventDefault();
	setupGameBoard('white')
})

blackColor.addEventListener('click', (e) => {
	e.preventDefault();
	setupGameBoard('black')

})



var validMoves = []
// Board Change Functions
function onSnapEndEditor(params) {
	if (promoting) return; //if promoting we need to select the piece first
	editorBoard.position(editorGame.fen())
}

function onDragStartEditor(source, piece, position, orientation) {
	return false
	if (!isBoomAllowed) {
		if (handleNormalCheckMate()) return false
	}
}


function alertCheckMate() {
	if (editorGame.in_checkmate() && isBoomCheckMate(editorGame.fen())) {
		if (editorGame.turn() === 'w')
			alert('Black Wins')
		if (editorGame.turn() === 'b')
			alert('White Wins')
		return
	}
}

function getSAN(source, target) {
	if (editorGame.get(target)) editorGame.get(source).type.toUpperCase() + "x" + target
	return editorGame.get(source).type.toUpperCase() + target
}

function onMoveEnd() {
	boardJqry.find('.square-' + squareToHighlight)
		.addClass('highlight-black')
}

// Action/Moving Functions
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

	changeSquareColorAfterMove(source, target)
}

function changeSquareColorAfterMove(source, target) {
	boardJqry.find('.' + squareClass)
		.removeClass('highlight-from')
	boardJqry.find('.' + squareClass)
		.removeClass('highlight-to')
	boardJqry.find('.square-' + source).addClass('highlight-from')
	boardJqry.find('.square-' + target).addClass('highlight-to')
}

//Move Table Functions
function previewFen(moveFen, rowNum, turn, moveIndex) {
	setBoard(moveFen)
	changeFen = { moveFen, rowNum, turn }
	isChangeFen = true
	updateCurrentStateIndex(moveIndex)
}
// SET FEN HERE AND REPLACE IN ABOVE FUNC
function setBoard(tempFen) {
	editorGame.load(tempFen)
	editorBoard.position(tempFen)
}

function updateCurrentStateIndex(moveIndex) {
	document.getElementById(`m${currentStateIndex}`).style.outline = null
	currentStateIndex = moveIndex

	if (currentStateIndex === null) return
	let currentRow = document.getElementById(`m${currentStateIndex}`)
	setBoard(states[currentStateIndex])
	currentRow.style.outline = "2px solid black"
}
//Checking Functions
function isCheckAfterRemovePiece(fen, square) {
	// we see isCheck for turn
	let c = new Chess()
	c.load(fen)
	c.remove(square)
	return c.in_check() // If in Check dont allow to cut, remove from valid moves
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
			// console.log(mv) // ! DO NOT DLT. Keep This Console Log for moves
			f++;
		}
	}
	return (!f > 0)
}

function isCheckForAlterTurnAftermove(fen, source, target) {
	let isCheckGame = new Chess()
	let myArray = fen.split(" ");
	if (myArray[1] == "b")
		myArray[1] = "w";
	else
		myArray[1] = "b";
	fen = myArray.join(" ");
	isCheckGame.load(fen)
	let sourcePiece = isCheckGame.get(source)
	isCheckGame.load(fen)
	isCheckGame.remove(source)
	isCheckGame.put({
		type: sourcePiece.type,
		color: sourcePiece.color
	}, target)
	return isCheckGame.in_check()
}

function isCheckForTurnAftermove(fen, source, target) {
	let isCheckGame = new Chess()
	isCheckGame.load(fen)
	let sourcePiece = isCheckGame.get(source)
	isCheckGame.remove(source)
	isCheckGame.put({
		type: sourcePiece.type,
		color: sourcePiece.color
	}, target)
	return isCheckGame.in_check()
}

function makeRandomMoveEditor() {

}

// Misc Functions
function saveGameListener(e) {
	e.preventDefault();
	var copyText = editorGame.fen();
	// navigator.clipboard.writeText(copyText);
	// alert("Copied the FEN : " + copyText + " to clipboard");
	downloadFile("fen.txt", copyText)
}

function savePGNListener(e) {
	e.preventDefault();
	let wt = document.getElementById("whiteMoves")
	let bt = document.getElementById("blackMoves")

	let wr = wt.rows
	let br = bt.rows

	let wc = wr.length
	let bc = br.length

	let pgnString = ""
	for (let wp = 0, bp = 0; wp < wc, bp < bc; wp++, bp++) {
		let w = wr[wp].children[0].innerText
		let b = br[bp].children[0].innerText
		pgnString += (wp + 1 + ". " + w + " " + b + " ")
	}
	pgnString = pgnString.trim()
	// navigator.clipboard.writeText(pgnString);
	// alert("Copied the PGN : " + pgnString + " to clipboard")
	downloadFile("pgn.txt", pgnString)
}

function makeRandomMove() {
	return
	var possibleMoves = editorGame.moves()
	// editorGame over
	if (possibleMoves.length === 0) {
		return;
	}
	var randomIdx = Math.floor(Math.random() * possibleMoves.length)
	let move = editorGame.move(possibleMoves[randomIdx]);
	currentSAN = move['san']
	// myAudioEl.play();
	editorTurnt = 1 - editorTurnt;
	editorBoard.position(editorGame.fen());
	setTimeout(changeSquareColorAfterMove(move.from, move.to), 500)

}

function getImgSrc(piece) {
	return piece_theme.replace(
		"{piece}",
		editorGame.turn() + piece.toLocaleUpperCase()
	);
}



function setLoadGame() {
	// const urlParams = new URLSearchParams(window.location.search);
	// if (!urlParams.get('loadGame')) { console.error("NO Load Game Instructions"); loadGame = false; return }
	// if (urlParams.get('loadGame') === 'false') loadGame = false
	// else {
	// 	loadGame = true
	// 	switch (urlParams.get('loadGameType')) {
	// 		case "fen":
	// 			setFENGame()
	// 			break;
	// 		case "san":
	// 			setSANGame()
	// 			break;
	// 		case "none":
	// 			console.error("Load Game true but no config (none)")
	// 			break;
	// 		default:
	// 			console.error("Load Game true but no config")
	// 			break;
	// 	}
	// }
	// loadType = "pgn" | "fen" | "none"
	// loadString = "" | "loadtype string"

	if (sessionStorage.length === 0)
		loadGame = false
	else if (sessionStorage.length === 2 || sessionStorage.length === 3)
		loadGame = true
	else { alert("Refresh Browser"); return }
	if (loadGame)
		switch (sessionStorage.getItem("loadType")) {
			case "fen":
				return setFENGame()
			case "pgn":
				return setSANGame()

			case "none":
				console.error("Load Game true but no config (none)")
				return false
			default:
				console.error("Load Game true but no config")
				return false
		}

}

function setSANGame() {
	let pgn = sessionStorage.getItem("loadString")
	if (!pgn.startsWith("1. ")) return false
	sessionStorage.clear();
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

		console.log(loadPGNGame.fen())
		loadGameFen = loadPGNGame.fen()
		isLoadTypePGN = true
		return true;
	} catch (error) {
		console.log(error)
		return false;
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
	states.push(moveFen)
	const currStateLen = states.length
	td.addEventListener('click', () => { previewFen(moveFen, rowNum, currCustomTurn, currStateLen - 1) })
	td.style = "cursor:pointer"
	tr.appendChild(td)
	tr.id = `m${currStateLen - 1}`
	// set id as move number
	moveTable.appendChild(tr)
}

function setFENGame() {
	let cusFen = sessionStorage.getItem("loadString");
	sessionStorage.clear();
	var temp = new Chess()
	if (cusFen && !temp.load(cusFen)) { return false }
	loadGameFen = cusFen
	isLoadTypePGN = false
	return true
	// alert("Loaded Game! Choose Color");
}

function handleNormalCheckMate() {
	if (editorGame.game_over()) {
		if (editorGame.in_draw()) {
			alert('Game Draw!!');
		} else if (editorGame.in_checkmate()) {
			if (editorGame.turn() === 'w')
				alert('Black Wins')
			if (editorGame.turn() === 'b')
				alert('White Wins')
		}
		return true
	}
}

function addEventListeners() {
	// boardJqry.find('.square-' + sq).bind('click',)
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
	return
	if (currentSource === null) {
		if (editorGame.get(sq) === null) return
		if (editorBoard.orientation().startsWith(editorGame.get(sq).color)) {
			currentSource = sq
			currHighlight(sq)
			return
		}
	}
	else {
		if (editorGame.get(sq) === null) { // handle for not allowed Square
			onDropEditor(currentSource, sq)
			removeCurrHighlight()
			currentSource = null // redundant but for logic purp
			return
		}
		// if (editorGame.get(sq) !== null) { // handle for not allowed Square
		// 	ondrop(currentSource, sq)
		// 	currentSource = null
		// 	return
		// }
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

function nextState() {
	if (isLoadTypePGN && currentStateIndex + 1 < states.length)
		updateCurrentStateIndex(currentStateIndex + 1)
}

function prevState() {
	if (isLoadTypePGN && currentStateIndex - 1 >= 0)
		updateCurrentStateIndex(currentStateIndex - 1)
}

function startState() {
	updateCurrentStateIndex(0)
}

function endState() {
	updateCurrentStateIndex(states.length - 1)
}

document.addEventListener('keydown', (event) => {
	var code = event.code;
	if (code === "ArrowRight") nextState()
	if (code === "ArrowLeft") prevState()
}, false);