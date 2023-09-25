function setProfile(params) {
	const profile = document.getElementById("userName");

	axios
		.get("/profile")
		.then(function (response) {
			// handle success
			console.log(response.data);
			profile.innerHTML = response.data.userData.email;
			setGameHistory(response)
		})
		.catch(function (error) {
			// handle error
			console.log(error);
		})
		.finally(function () {
			// always executed
		});
}

// setProfile()

function redirectReview(pgn, clr) {
	sessionStorage.clear();
	sessionStorage.setItem("loadType", "pgn");
	sessionStorage.setItem("loadString", pgn);
	sessionStorage.setItem("loadColor", clr);
	window.location.href = "/reviewGame.html?type=fromProfile";
}

function setGameHistory(response) {
	let historyTable = document.getElementById("gameHistory");
	let gameHistory = response.data.data.findAllResult;
	console.log(gameHistory)
	gameHistory.forEach((element) => {
		let row = document.createElement("tr");

		let name = document.createElement("td");
		name.innerHTML = element.checkPointName;
		row.appendChild(name);

		let room = document.createElement("td");
		room.innerHTML = element.room;
		row.appendChild(room);

		let time = document.createElement("td");
		let date = new Date(element.time.substring(1, element.time.length - 1))
		time.innerHTML = date.toTimeString().substring(0, 5) + " " + date.toDateString().substring(4);
		row.appendChild(time);

		let history = document.createElement("td");
		history.innerHTML = "Review Game";
		history.style.cursor = "pointer";
		history.addEventListener("click", () => {
			redirectReview(element.history, element.color)
		})
		row.appendChild(history);

		let opponent = document.createElement("td");
		opponent.innerHTML = element.opponent_mail;
		row.appendChild(opponent);


		historyTable.appendChild(row);
	});
}

setProfile()
