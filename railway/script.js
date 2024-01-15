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
	mouse.deltaX = event.clientX - mouse.x;
	mouse.deltaY = event.clientY - mouse.y;

	mouse.x = event.clientX;
	mouse.y = event.clientY;

	if (mouse.leftDown) {
		view.x += mouse.deltaX / view.scale;
		view.y += mouse.deltaY / view.scale;
	}

	render()
});

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

canvas.addEventListener('mousedown', (event) => {
	mouse.leftDown = true;
	clickStart.x = mouse.x;
	clickStart.y = mouse.y;
})
canvas.addEventListener('mouseup', (event) => {
	mouse.leftDown = false;

	clicked = false;

	if (clickStart.x == mouse.x && clickStart.y == mouse.y) canvasClickables.forEach(c => {
		if (c.contains(mouse.x,mouse.y)) {
			if (!clicked) c.clickEvent();
			clicked = true;
		}
	});
})

const scrollSensitivity = .001;

canvas.addEventListener("wheel", (event) => {
	view.scale -= event.deltaY * scrollSensitivity * view.scale;
	render()
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
	optionsPanel.style = "";

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

	const stationClicked = () => console.log(`Clicked station "${stat.name}".`);

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

	const clickLine = () => console.log(`Clicked on line "${lineName}"; ${from.label} -> ${to.label}.`);

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

const debugInfoSpan = document.getElementById("debugInfo");
const showNoConnectonsCheck = document.getElementById("showNoConnectionsCheck");
const showClickBoxesCheck = document.getElementById("showClickBoxesCheck");

showClickBoxesCheck.addEventListener("click", (event) => {
	render();
})

showNoConnectonsCheck.addEventListener("click",(event) => {
	render();
});

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
	Data info:
	- No. of stations: ${stations.length}/${allStations};
	- No. of connections: ${connections.length};
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


