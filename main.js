// --- Maze settings ---
const rows = 10;
const cols = 10;
const CELL_SIZE = 50; // adjust for canvas size

// --- Canvas ---
const canvas = document.getElementById("gameCanvas");
canvas.width = cols * CELL_SIZE;
canvas.height = rows * CELL_SIZE;
const ctx = canvas.getContext("2d");

// --- Streak UI ---
const streakDisplay = document.getElementById("streakCount");
let streak = parseInt(localStorage.getItem("streak")||"0");
streakDisplay.textContent = streak;

// --- RNG for reproducible maze per day ---
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^(a>>>15),1|a);t=t+Math.imul(t^(t>>>7),61|t)^t;return ((t^(t>>>14))>>>0)/4294967296;}}
function hashToUint32(s){let h=0;for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i);h|=0;}return h>>>0;}
function currentDateKey(){const d=new Date();const local=new Date(d.toLocaleString('en-US',{timeZone:'America/Chicago'}));return local.toISOString().split('T')[0];}
const rng = mulberry32(hashToUint32(currentDateKey()));

// --- Maze cell & generation ---
function initMaze(cols,rows){
  return Array.from({length:cols},(_,x)=>Array.from({length:rows},(_,y)=>({x,y,walls:{N:true,E:true,S:true,W:true},visited:false})));
}

function generateMaze(cols,rows,rng){
  const grid = initMaze(cols,rows);
  const stack=[];
  const start=grid[0][0]; start.visited=true; stack.push(start);

  const neighborsOf=c=>{
    const out=[];
    const {x,y}=c;
    if(y>0&&!grid[x][y-1].visited) out.push(grid[x][y-1]);
    if(x<cols-1&&!grid[x+1][y].visited) out.push(grid[x+1][y]);
    if(y<rows-1&&!grid[x][y+1].visited) out.push(grid[x][y+1]);
    if(x>0&&!grid[x-1][y].visited) out.push(grid[x-1][y]);
    return out;
  };

  const removeWalls=(a,b)=>{
    const dx=b.x-a.x, dy=b.y-a.y;
    if(dx===1){a.walls.E=false;b.walls.W=false;}
    else if(dx===-1){a.walls.W=false;b.walls.E=false;}
    else if(dy===1){a.walls.S=false;b.walls.N=false;}
    else if(dy===-1){a.walls.N=false;b.walls.S=false;}
  };

  while(stack.length){
    const cell=stack[stack.length-1];
    const choices=neighborsOf(cell);
    if(choices.length){
      const next=choices[Math.floor(rng()*choices.length)];
      removeWalls(cell,next);
      next.visited=true;
      stack.push(next);
    } else stack.pop();
  }
  return grid;
}

const maze = generateMaze(cols, rows, rng);

// --- Player & exit ---
let player = {x:0,y:0};
const exit = {x:cols-1,y:rows-1};

// --- Streak glow tiers ---
function visualParamsForStreak(streak){
  if(!streak) return {glow:0};
  if(streak>=30) return {glow:1.2};
  if(streak>=7) return {glow:0.8};
  if(streak>=3) return {glow:0.4};
  return {glow:0};
}

// --- Draw maze (nodes + edges) ---
function drawMazeNodes(){
  ctx.clearRect(0,0,canvas.width,canvas.height);

  // Draw edges
  ctx.strokeStyle="#bbb"; ctx.lineWidth=4;
  for(let x=0;x<cols;x++){
    for(let y=0;y<rows;y++){
      const cell=maze[x][y];
      const cx=x*CELL_SIZE+CELL_SIZE/2;
      const cy=y*CELL_SIZE+CELL_SIZE/2;
      if(!cell.walls.E && x+1<cols){
        const nx=(x+1)*CELL_SIZE+CELL_SIZE/2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(nx,cy); ctx.stroke();
      }
      if(!cell.walls.S && y+1<rows){
        const ny=(y+1)*CELL_SIZE+CELL_SIZE/2;
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,ny); ctx.stroke();
      }
    }
  }

  // Draw nodes
  for(let x=0;x<cols;x++){
    for(let y=0;y<rows;y++){
      const cx=x*CELL_SIZE+CELL_SIZE/2;
      const cy=y*CELL_SIZE+CELL_SIZE/2;
      ctx.fillStyle="#1976d2";
      ctx.beginPath(); ctx.arc(cx,cy,CELL_SIZE*0.2,0,Math.PI*2); ctx.fill();
    }
  }

  // Exit node
  const ex=exit.x*CELL_SIZE+CELL_SIZE/2;
  const ey=exit.y*CELL_SIZE+CELL_SIZE/2;
  ctx.fillStyle="red"; ctx.beginPath(); ctx.arc(ex,ey,CELL_SIZE*0.25,0,Math.PI*2); ctx.fill();
}

// --- Draw player with glow ---
function drawPlayerTrail(){
  const cx=player.x*CELL_SIZE+CELL_SIZE/2;
  const cy=player.y*CELL_SIZE+CELL_SIZE/2;
  const {glow}=visualParamsForStreak(streak);

  if(glow>0){
    const gradient=ctx.createRadialGradient(cx,cy,CELL_SIZE*0.2,cx,cy,CELL_SIZE*(0.8+glow));
    gradient.addColorStop(0,"rgba(0,255,0,0.4)");
    gradient.addColorStop(1,"rgba(0,255,0,0)");
    ctx.fillStyle=gradient;
    ctx.beginPath(); ctx.arc(cx,cy,CELL_SIZE*(0.8+glow),0,Math.PI*2); ctx.fill();
  }

  ctx.fillStyle="#333"; ctx.beginPath(); ctx.arc(cx,cy,CELL_SIZE*0.25,0,Math.PI*2); ctx.fill();
}

// --- Full draw ---
function drawAll(){ drawMazeNodes(); drawPlayerTrail(); }

// --- Movement helpers ---
function canMove(dir){
  const cell = maze[player.x][player.y];
  if(dir==="N") return !cell.walls.N;
  if(dir==="S") return !cell.walls.S;
  if(dir==="E") return !cell.walls.E;
  if(dir==="W") return !cell.walls.W;
}
function move(dir){
  if(!canMove(dir)) return;
  if(dir==="N") player.y--; if(dir==="S") player.y++;
  if(dir==="E") player.x++; if(dir==="W") player.x--;
  checkWin();
  drawAll();
}

// --- Check win & streak ---
function checkWin(){
  if(player.x===exit.x && player.y===exit.y){
    streak++; streakDisplay.textContent=streak;
    localStorage.setItem("streak",streak);
    alert("Maze complete! Streak increased 🎉");
    player={x:0,y:0}; drawAll();
  }
}

// --- Keyboard controls ---
document.addEventListener("keydown",e=>{
  if(e.key==="ArrowUp") move("N");
  if(e.key==="ArrowDown") move("S");
  if(e.key==="ArrowLeft") move("W");
  if(e.key==="ArrowRight") move("E");
});
function bfsShortestPath(){
  const dirs=[[0,1],[1,0],[0,-1],[-1,0]];
  let visited=Array.from({length:cols},()=>Array(rows).fill(false));
  let queue=[{x:0,y:0,path:[{x:0,y:0}]}];
  visited[0][0]=true;

  while(queue.length){
    const {x,y,path}=queue.shift();
    if(x===exit.x && y===exit.y) return path;
    for(const [dx,dy] of dirs){
      const nx=x+dx, ny=y+dy;
      if(nx<0||nx>=cols||ny<0||ny>=rows) continue;
      if(visited[nx][ny]) continue;
      const cell=maze[x][y];
      if(dx===1 && cell.walls.E) continue;
      if(dx===-1 && cell.walls.W) continue;
      if(dy===1 && cell.walls.S) continue;
      if(dy===-1 && cell.walls.N) continue;
      visited[nx][ny]=true;
      queue.push({x:nx,y:ny,path:[...path,{x:nx,y:ny}]});
    }
  }
  return null;
}

document.getElementById("hintBtn").addEventListener("click",()=>{
  const path=bfsShortestPath();
  if(!path) return;
  ctx.strokeStyle="rgba(46,125,50,0.5)";
  ctx.lineWidth=6;
  ctx.beginPath();
  for(let i=0;i<Math.min(3,path.length);i++){
    const p=path[i];
    const cx=p.x*CELL_SIZE+CELL_SIZE/2;
    const cy=p.y*CELL_SIZE+CELL_SIZE/2;
    if(i===0) ctx.moveTo(cx,cy); else ctx.lineTo(cx,cy);
  }
  ctx.stroke();
});

let touchStart=null, mouseStart=null;

canvas.addEventListener("touchstart",e=>{ touchStart=e.touches[0]; });
canvas.addEventListener("touchend",e=>{
  if(!touchStart) return;
  const dx=e.changedTouches[0].clientX-touchStart.clientX;
  const dy=e.changedTouches[0].clientY-touchStart.clientY;
  if(Math.abs(dx)>Math.abs(dy)){ if(dx>20) move
