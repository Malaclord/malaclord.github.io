const canvas = document.getElementById("railwayMap");
const ctx = canvas.getContext("2d");

let mouse = { x: undefined, y: undefined, deltaX: undefined, deltaY: undefined, leftDown: false };

let view = {
	x: 0,
	y: 0,
	scale: 1
}

window.addEventListener("resize", (event) => {
	render()
})

let canvasClickables = []

canvas.addEventListener('mousemove', (event) => {
	moveMouse(event.clientX,event.clientY)
});

let scaling = false;
let touchDist = undefined;

canvas.addEventListener('touchmove', (event) => {

		event.preventDefault();
	
		if (scaling) {
			const dist = Math.hypot(
				event.touches[0].clientX - event.touches[1].clientX,
				event.touches[0].clientY - event.touches[1].clientY);

			if (touchDist) {
				const deltaDist = touchDist-dist
				zoom(deltaDist)
			}; 


			touchDist = dist;
		} else moveMouse(event.touches[0].clientX,event.touches[0].clientY);


	})

let clickedStation = undefined;
let clickedLine = undefined;

function moveMouse(x,y) {
	mouse.deltaX = x - mouse.x;
	mouse.deltaY = y - mouse.y;

	mouse.x = x;
	mouse.y = y;

	if (mouse.leftDown) {
		view.x += mouse.deltaX / view.scale;
		view.y += mouse.deltaY / view.scale;
	}

	render()
}

function Clickable (x, y, x2, y2, clickEvent) {

    this.x = x;
    this.y = y;
    this.x2 = x2;
    this.y2 = y2;
	this.clickEvent = clickEvent;

    this.contains = function (x, y) {
        return this.x <= x && x <= this.x2 &&
               this.y <= y && y <= this.y2;
    }
}

let clickStart = {x:0,y:0}

function zoom(by) {
	view.scale -= by * scrollSensitivity * view.scale;
	render()
}

function startClick(x,y) {
	mouse.leftDown = true;

	mouse.x = x;
	mouse.y = y;

	clickStart.x = mouse.x;
	clickStart.y = mouse.y;
}

function endClick(click) {
	mouse.leftDown = false;

	clicked = false;

	if (clickStart.x == mouse.x && clickStart.y == mouse.y && click) canvasClickables.forEach(c => {
		if (c.contains(mouse.x,mouse.y)) {
			if (!clicked) c.clickEvent();
			clicked = true;
			render();
		}
	});
}

canvas.addEventListener('mousedown', (event) => {
	startClick(event.clientX,event.clientY);
})
canvas.addEventListener('mouseup', (event) => {
	endClick(true);
})

canvas.addEventListener("touchstart", (event) => {
	if (event.touches.length === 2) {
		scaling = true;
	} else {
		startClick(event.touches[0].clientX,event.touches[0].clientY);
	}
})

canvas.addEventListener("touchend",(event) => {
	endClick(true);

	scaling = false;
	touchDist = undefined;
})

canvas.addEventListener("touchcancel", (event) => {
	endClick(false);

	scaling = false;
	touchDist = undefined;
})


canvas.addEventListener("wheel", (event) => {
	zoom(event.deltaY);
})

document.addEventListener('contextmenu', (event) => {
  event.preventDefault();
}, false);


let allStations = 0;
let allConnections = 0;

let stations = [];
let connections = [];

const loadingScreen = document.getElementById("loadingScreen");
const debugButton = document.getElementById("debugButton");

let printDebugInfo = false;

debugButton.addEventListener("click", (event)=> {
	reload()
});

function reload() {
	loadingScreen.style = "";
	axios.get("https://shirecraft.us/api/railway/stations")
	.then(stat => {
		axios.get("https://shirecraft.us/api/railway/connections").then(conn => {
			init(stat,conn)
		}
		)
	}
)
}

const linesList = document.getElementById("linesList");
const optionsPanel = document.getElementById("optionsPanel");

let lines = [];

let journey = [];
let journeyLines = [];

function planJourney(from,to,weighting) {
	journey = [];
	journeyLines = [];

	axios.get(`https://shirecraft.us/api/railway/route?start=${from}&end=${to}&weighting=${weighting}`)
	.then(resp => {
	//what 
	//TODO: fix :) 

		resp.data.data.components.forEach(comp => {
			const curStationLabel = comp.current_station.label;
			const nextStationLabel = comp.next_station.label;
			const isStart = comp.is_start;
			const isEnd = comp.is_end;
			const lineChange = comp.line_change;
			
			let connection;

			if (!(isStart || isEnd || lineChange)) {
				const connId = comp.current_line.id;

				connection = connections.filter(c => { 
					return c.id == connId;
				})[0]


				if (connection) {
					journey.push(connection);
					journeyLines.push(connection.lineId);
				};
			}

		});
	})
}

const planJourneyButton = document.getElementById("planJourneyButton");
const journeyFromStationInput = document.getElementById("journeyFromStationInput");
const journeyToStationInput = document.getElementById("journeyToStationInput");
planJourneyButton.addEventListener("click", (event) => {
	const from = journeyFromStationInput.value;
	const to = journeyToStationInput.value;

	planJourney(from,to,"time");
});

const allLinesToggleCheck = document.getElementById("allLinesToggleCheck");

let lineChecks = [];

allLinesToggleCheck.addEventListener("click", (event) => {
	lineChecks.forEach(lineCheck => {
		if (!lineCheck.checked == event.target.checked) lineCheck.click()
	});
})

function init(stat, conn) {
	stations = [];
	connections = [];
	lines = [];
	allStations = 0;
	allConnections = 0;

	const statData = stat.data.data;

	console.log(statData);

	allStations = statData.length;
	
	statData.forEach(s => {
		const x = s.x_position;
		const y = s.z_position;
		const name = s.name;
		const label = s.label;

		if (x && y) 
		stations.push({
			x: x,
			y: y,
			name: name,
			label: label,
			connected: false,
			lines: []
		})
	});

	const connData = conn.data.data;

	console.log(connData);

	allConnections = connData.length;

	stations.forEach(s => {
		s.x = Math.round(s.x / 12) * 12;
		s.y = Math.round(s.y / 12) * 12;
	})

	connData.forEach(c => {
		const from = c.from_station_label;
		const to   = c.to_station_label;
		const line = c.group_name;
		const lineId = c.group_id;
		const color = c.colour;
		const id = c.line_id;

		if (!lines.some(l => {
			return l.id == lineId;
		})) {
			lines.push({
				id: lineId,
				name: line,
				color: color,
				show: true
			})
		}

		if (stations.some(stat => {
			return stat.label == from;
		}) && stations.some(stat => {
			return stat.label == to;
		})) 
		connections.push({
			id: id,
			from: from,
			to: to,
			line: line,
			lineId: lineId,
			color: color
		})
	});


	let connections2 = [];

	connections.forEach(c => {
		const from = stations.filter(s=>{return s.label == c.from})[0]
		const to = stations.filter(s=>{return s.label == c.to})[0]
		const lineId = c.lineId

		from.connected = true;
		to.connected = true;

		if (!from.lines.includes(lineId)) from.lines.push(lineId);
		if (!to.lines.includes(lineId)) to.lines.push(lineId);

		if (!connections2.some(c2=>{
			return c2.from == c.to && c2.to == c.from && c2.lineId == c.lineId;
		})) connections2.push(c);
	})


	linesList.innerHTML = "";

	lines.forEach(l=>{
		const lineDiv = document.createElement("div");
		const lineCheck = document.createElement("input");
		const lineLabel = document.createElement("label");
		lineCheck.type = "checkbox";
		lineCheck.checked = true;
		lineCheck.name = l.id;
		lineLabel.for = l.id;
		lineLabel.innerText = l.name;
		lineCheck.addEventListener("click",(event) => {
			const checkedLines = lineChecks.filter(lc => lc.checked);

			if (checkedLines.length == 0) allLinesToggleCheck.checked = false;
			else if (checkedLines.length == lineChecks.length) allLinesToggleCheck.checked = true;

			event.target.checked = toggleLine(l);
		})

		lineDiv.style = `border-left: 10px solid #${l.color}`

		lineDiv.className = "lineListElement";

		lineDiv.appendChild(lineCheck);
		lineDiv.appendChild(lineLabel);
		linesList.appendChild(lineDiv);
		
		lineChecks.push(lineCheck);
	});

	connections = connections2;

	connections.sort((a,b)=>a.lineId-b.lineId)


	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;

	loadingScreen.style = "display: none";
	if (mobile) toggleOptionsPanel(false)
	else toggleOptionsPanel(true);

	allLinesToggleCheck.checked = true;
	render();
}

function toggleLine(line) {
	line.show = !line.show;

	if (journeyLines.includes(line)) line.show = true;

	render();

	return line.show;
}

const stationLinesOffset = 12;

function renderStation(stat) {
	let x = stat.x;
	let y = stat.y;

	const name = stat.name;
	let stationLines = lines.filter(l=>{return l.show && stat.lines.includes(l.id)})

	const stationClicked = () => {clickedStation = (`"${stat.name}".`)};

	if (stationLines.length > 0) {
		text(x,y+(20/view.scale),10,name,"#ffffff","center",true)

		if (stationLines.length > 1) line(x,y,x+stationLinesOffset/view.scale*(stationLines.length-1),y-stationLinesOffset/view.scale*(stationLines.length-1),"#fff",15,true);

		stationLines.forEach(l=>{
			const line = lines.filter(l2=>l2.id==l.id)[0]

			circle(x,y,8,`#${line.color}`,"#ffffff",2,true,true,stationClicked);

			x += stationLinesOffset / view.scale;
			y -= stationLinesOffset / view.scale;
		})
	} else if (showNoConnectonsCheck.checked) {
		text(x,y+(20/view.scale),10,name,"#ffffff","center",true)

		circle(x,y,8,`#fff`,"#ffffff",2,true,true,stationClicked);
	}
}

window.mobileCheck = function() {
	let check = false;
	(function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
	return check;
};

function renderConnection(conn) {
	const from = stations.filter(s=>{
		return s.label == conn.from;
	})[0];
	const to = stations.filter(s=>{
		return s.label == conn.to;
	})[0];
	const lineId = conn.lineId;
	const lineName = conn.line;
	let [x,y]   = [from.x,from.y];
	let [x2,y2] = [to.x,to.y];
	const color = conn.color.toLowerCase();

	const visibleLines = lines.filter(l => l.show);

	if (visibleLines.filter(l=> l.id == lineId).length == 0) return;

	const fromLines = visibleLines.filter(l => from.lines.includes(l.id))
	const toLines   = visibleLines.filter(l => to.lines.includes(l.id))

	const offsetFrom = fromLines.findIndex(l => l.id == lineId) * stationLinesOffset / view.scale;
	const offsetTo   = toLines.findIndex(l => l.id == lineId)   * stationLinesOffset / view.scale;

	x += offsetFrom ;
	y -= offsetFrom ;
	x2 += offsetTo  ;
	y2 -= offsetTo  ;

	ctx.strokeStyle = `#fff`;

	ctx.strokeStyle = `#${color}`;

	const clickLine = () => {clickedLine = (`"${lineName}"; ${from.label} -> ${to.label}.`)};

	line(x,y,x,
		y2 + (y < y2 ? 4/view.scale : -4/view.scale)
		,`${color}`,8,false,clickLine)
	line(
		x + (x > x2 ? 4/view.scale : -4/view.scale)
		,y2,x2,y2,`${color}`,8,false,clickLine)

	if(journey.includes(conn)) {
		line(x,y,x,
			y2 + (y < y2 ? 2/view.scale : -2/view.scale)
			,``,8,false)
		line(
			x + (x > x2 ? 2/view.scale : -2/view.scale)
			,y2,x2,y2,`${color}`,8,false)
	}


}

const hideOptionsPanel = document.getElementById("hideOptionsPanel");
const showOptionsPanel = document.getElementById("showOptionsPanel");

hideOptionsPanel.addEventListener("click", (event)=>{
	toggleOptionsPanel(false)
})

showOptionsPanel.addEventListener("click", (event)=>{
	toggleOptionsPanel(true)
})

function toggleOptionsPanel(toggle) {
	if (toggle) {
		showOptionsPanel.style = "display: none"
		optionsPanel.style = ""
	} else {
		showOptionsPanel.style = ""
		optionsPanel.style = "display: none"
	}
}

const debugInfoSpan = document.getElementById("debugInfo");
const showNoConnectonsCheck = document.getElementById("showNoConnectionsCheck");
const showClickBoxesCheck = document.getElementById("showClickBoxesCheck");

showClickBoxesCheck.addEventListener("click", (event) => {
	render();
})

showNoConnectonsCheck.addEventListener("click",(event) => {
	render();
});

const mobile = window.mobileCheck();
const renderScale = mobile ? .5 : 1;

const scrollSensitivity = mobile ? .0025 : .001;

function render() {
	canvas.height = window.innerHeight;
	canvas.width = window.innerWidth;

	canvasClickables = []

	clear()

	ctx.fillStyle = "#ff0000";
	//circle(mouse.x/view.scale,mouse.y/view.scale,10,"#ff0000","#ffffff",2,true)


	ctx.beginPath();
	let curLine = connections[0].lineId;

	let foo = 0;
	
	connections.forEach(
		c => {

			if (c.lineId != curLine) {
				curLine = c.lineId;
				ctx.stroke();
				ctx.beginPath();
				foo++;
			}

			renderConnection(c)
		}
		);
	ctx.stroke(); foo++;
		


	stations.forEach(s => renderStation(s));


	debugInfoSpan.innerText = (
	`Render info:
	- Strokes: ${foo};
	- Lines drawn: ${linesDrawn};
	- Circles drawn: ${circlesDrawn};
	- Text drawn: ${textDrawn};
	- View: ${view.x.toFixed(2)}, ${view.y.toFixed(2)}, ${view.scale.toFixed(2)};  
	Data info:
	- No. of stations: ${stations.length}/${allStations};
	- No. of connections: ${connections.length};
	- Station data: ${clickedStation};
	- Line data: ${clickedLine};
	`);


	linesDrawn = 0;
	circlesDrawn = 0;
	textDrawn = 0;
	printDebugInfo = false;

	canvasClickables.reverse();


	if (showClickBoxesCheck.checked) {
		ctx.strokeStyle="#fff";
		ctx.lineWidth=1;
		
		canvasClickables.forEach(cl => {
		ctx.strokeRect(cl.x,cl.y,cl.x2-cl.x,cl.y2-cl.y);
	})
}
}

function clear() {
	ctx.fillStyle = "#222222";
	ctx.fillRect(0,0,canvas.width,canvas.height)
}

let textDrawn = 0;

function text(x,y,s,text,fill,align,constantS) {
	const X = (x+view.x)*view.scale+(canvas.width/2);
	const Y = (y+view.y)*view.scale+(canvas.height/2);
	const S = constantS ? s : s*view.scale;

	const R = 50;

	if (X+R < 0 || X-R > canvas.width) return;
	if (Y+R < 0 || Y-R > canvas.height) return;

	textDrawn++;

	ctx.fillStyle = fill;
	ctx.textAlign = align;
	ctx.font = `${s}px Arial`;
	ctx.fillText(text,X,Y);
}

let linesDrawn = 0;

function line(x,y,x2,y2,stroke,weight,doStroke,clickEvent) {
	const X = (x+view.x)*view.scale+(canvas.width/2);
	const Y = (y+view.y)*view.scale+(canvas.height/2);
	const X2 = (x2+view.x)*view.scale+(canvas.width/2);
	const Y2 = (y2+view.y)*view.scale+(canvas.height/2);

	ctx.strokeStyle = stroke;
	ctx.lineWidth = weight;


	if ((X < 0 && X2 < 0) || (X > canvas.width && X2 > canvas.width)) return;
	if ((Y < 0 && Y2 < 0) || (Y > canvas.height && Y2 > canvas.height)) return;

	const minX = Math.min(X-weight/2,X2+weight/2)
	const maxX = Math.max(X-weight/2,X2+weight/2)
	const minY = Math.min(Y-weight/2,Y2+weight/2)
	const maxY = Math.max(Y-weight/2,Y2+weight/2)

	if (clickEvent) canvasClickables.push(new Clickable(minX,minY,maxX,maxY,clickEvent))


	linesDrawn++;

	if (doStroke) ctx.beginPath();
	ctx.moveTo(X,Y);
	ctx.lineTo(X2,Y2);
	if (doStroke) ctx.stroke();
}

function fillRect(x,y,w,h) {
	ctx.fillRect(x*view.scale,y*view.scale,w*view.scale,h*view.scale)
}

let circlesDrawn = 0;

function circle(x,y,r,fill,stroke,weight,constantR,doStroke, clickEvent) {
	const X = (x+view.x)*view.scale+(canvas.width/2);
	const Y = (y+view.y)*view.scale+(canvas.height/2);
	const R = constantR ? r : r*view.scale;

	if (X+R < 0 || X-R > canvas.width) return;
	if (Y+R < 0 || Y-R > canvas.height) return;

	const minX = Math.min(X-(R+weight),X+(R+weight))
	const maxX = Math.max(X-(R+weight),X+(R+weight))
	const minY = Math.min(Y-(R+weight),Y+(R+weight))
	const maxY = Math.max(Y-(R+weight),Y+(R+weight))

	if (clickEvent) canvasClickables.push(new Clickable(minX,minY,maxX,maxY,clickEvent))

	circlesDrawn++;

	ctx.fillStyle = fill;
	ctx.strokeStyle = stroke;
	ctx.lineWidth = weight;
	if (doStroke) ctx.beginPath();
	ctx.arc(X, Y, R, 0, 2 * Math.PI, false);
	ctx.fill();
	if (doStroke) ctx.stroke();
}

axios.get("https://shirecraft.us/api/railway/stations")
	.then(stat => {
		axios.get("https://shirecraft.us/api/railway/connections").then(conn => {
			init(stat,conn)
			//setInterval(render,1)
		}
		)
	}
)


