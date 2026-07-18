const TYPES=[4,6,8,10,12,20];
const diceGrid=document.getElementById("diceGrid");
const template=document.getElementById("dieTemplate");
const totalEl=document.getElementById("total"),maxEl=document.getElementById("maximum"),
minEl=document.getElementById("minimum"),countEl=document.getElementById("count");
const historyList=document.getElementById("historyList"),emptyHistory=document.getElementById("emptyHistory");
let dice=[],history=[],nextId=1,busy=false;

function rand(min,max){
  const range=max-min+1;
  if(crypto?.getRandomValues){
    const a=new Uint32Array(1),limit=0xffffffff-(0xffffffff%range);
    do crypto.getRandomValues(a); while(a[0]>=limit);
    return min+(a[0]%range);
  }
  return Math.floor(Math.random()*range)+min;
}

function makeD10Geometry(radius=1.55){
  const vertices=[];
  const h=1.35,r=1.15;
  vertices.push(0,h,0, 0,-h,0);
  for(let i=0;i<5;i++){
    const a=i*Math.PI*2/5;
    vertices.push(Math.cos(a)*r,0,Math.sin(a)*r);
  }
  const indices=[];
  for(let i=0;i<5;i++){
    const a=2+i,b=2+((i+1)%5);
    indices.push(0,a,b);
    indices.push(1,b,a);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function geometryFor(sides){
  if(sides===4)return new THREE.TetrahedronGeometry(1.55,0);
  if(sides===6)return new THREE.BoxGeometry(2.25,2.25,2.25);
  if(sides===8)return new THREE.OctahedronGeometry(1.65,0);
  if(sides===10)return makeD10Geometry();
  if(sides===12)return new THREE.DodecahedronGeometry(1.55,0);
  return new THREE.IcosahedronGeometry(1.65,0);
}

function extractFaces(geometry){
  const g=geometry.toNonIndexed();
  const p=g.getAttribute("position");
  const groups=[];
  const tolerance=.985;
  for(let i=0;i<p.count;i+=3){
    const a=new THREE.Vector3().fromBufferAttribute(p,i);
    const b=new THREE.Vector3().fromBufferAttribute(p,i+1);
    const c=new THREE.Vector3().fromBufferAttribute(p,i+2);
    const normal=new THREE.Vector3().crossVectors(
      new THREE.Vector3().subVectors(b,a),
      new THREE.Vector3().subVectors(c,a)
    ).normalize();
    const centroid=new THREE.Vector3().addVectors(a,b).add(c).multiplyScalar(1/3);
    let group=groups.find(x=>x.normal.dot(normal)>tolerance);
    if(!group){group={normal:normal.clone(),points:[]};groups.push(group)}
    group.points.push(a,b,c);
  }
  return groups.map(group=>{
    const centroid=new THREE.Vector3();
    group.points.forEach(v=>centroid.add(v));
    centroid.multiplyScalar(1/group.points.length);
    return {normal:group.normal.normalize(),centroid};
  });
}

function labelTexture(number,dark){
  const c=document.createElement("canvas");c.width=c.height=256;
  const ctx=c.getContext("2d");
  ctx.clearRect(0,0,256,256);
  ctx.fillStyle=dark?"#f9fafb":"#111827";
  ctx.font="900 132px system-ui";
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(String(number),128,132);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function createRenderer(canvas,sides){
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(35,1,.1,100);
  camera.position.set(4.6,3.8,5.7);camera.lookAt(0,0,0);
  scene.add(new THREE.HemisphereLight(0xffffff,0x334155,2.2));
  const light=new THREE.DirectionalLight(0xffffff,2.4);light.position.set(4,6,5);scene.add(light);
  const root=new THREE.Group();scene.add(root);

  function rebuild(newSides){
    while(root.children.length){
      const o=root.children.pop();
      o.geometry?.dispose();
      if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());
      else o.material?.dispose();
    }
    const geometry=geometryFor(newSides);
    const material=new THREE.MeshStandardMaterial({
      color:document.body.classList.contains("dark")?0x6366f1:0x818cf8,
      roughness:.34,metalness:.08,flatShading:true
    });
    const mesh=new THREE.Mesh(geometry,material);root.add(mesh);
    const edges=new THREE.LineSegments(new THREE.EdgesGeometry(geometry),
      new THREE.LineBasicMaterial({color:document.body.classList.contains("dark")?0xe0e7ff:0x312e81}));
    root.add(edges);

    const faces=extractFaces(geometry).slice(0,newSides);
    faces.forEach((face,index)=>{
      const tex=labelTexture(index+1,document.body.classList.contains("dark"));
      const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide});
      const size=newSides>=12?.58:newSides===10?.62:.7;
      const plane=new THREE.Mesh(new THREE.PlaneGeometry(size,size),mat);
      plane.position.copy(face.centroid).add(face.normal.clone().multiplyScalar(.035));
      plane.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),face.normal);
      root.add(plane);
    });
    root.userData.faces=faces;
    root.rotation.set(-.35,.45,.08);
  }

  function resize(){
    const rect=canvas.getBoundingClientRect();
    const w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
    if(canvas.width!==w||canvas.height!==h){
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    }
  }
  function render(){resize();renderer.render(scene,camera)}
  rebuild(sides);render();
  return {renderer,scene,camera,root,rebuild,render};
}

function finalQuaternion(view,faceIndex){
  const face=view.root.userData.faces[faceIndex];
  const up=new THREE.Vector3(0,1,0);
  const q=new THREE.Quaternion().setFromUnitVectors(face.normal.clone(),up);
  const spin=new THREE.Quaternion().setFromAxisAngle(up,rand(0,359)*Math.PI/180);
  return spin.multiply(q);
}

function addDie(sides=6,saved=null){
  const die={id:saved?.id??nextId++,sides,value:saved?.value??1,locked:saved?.locked??false};
  nextId=Math.max(nextId,die.id+1);dice.push(die);
  const card=template.content.firstElementChild.cloneNode(true);
  card.dataset.id=die.id;
  const canvas=card.querySelector("canvas"),name=card.querySelector(".die-name"),
  status=card.querySelector(".die-status"),result=card.querySelector(".result-number"),
  select=card.querySelector(".type-select"),lock=card.querySelector(".lock");
  const view=createRenderer(canvas,sides);die.view=view;die.card=card;

  function sync(){
    name.textContent=`D${die.sides}`;status.textContent=die.locked?"Bloqueado":"Activo";
    result.textContent=die.value;select.value=die.sides;
    lock.textContent=die.locked?"🔒 Desbloquear":"🔓 Bloquear";
    card.classList.toggle("locked",die.locked);
    const q=finalQuaternion(view,Math.max(0,die.value-1));
    view.root.quaternion.copy(q);view.render();
  }
  die.sync=sync;
  select.addEventListener("change",()=>{
    die.sides=Number(select.value);die.value=Math.min(die.value,die.sides);
    view.rebuild(die.sides);sync();summarize();save();
  });
  card.querySelector(".roll-one").addEventListener("click",()=>roll([die]));
  lock.addEventListener("click",()=>{die.locked=!die.locked;sync();save()});
  card.querySelector(".remove").addEventListener("click",()=>{
    if(dice.length===1){alert("Debe quedar al menos un dado.");return}
    dice=dice.filter(x=>x!==die);view.renderer.dispose();card.remove();summarize();save();
  });
  diceGrid.appendChild(card);sync();summarize();
}

async function roll(target){
  const active=target.filter(d=>!d.locked);if(busy||!active.length)return;
  busy=true;disable(true);
  active.forEach(d=>d.card.classList.add("is-rolling"));
  const start=performance.now(),duration=1050;
  await new Promise(resolve=>{
    function frame(now){
      const t=(now-start)/duration;
      active.forEach((d,i)=>{
        d.view.root.rotation.x+=.16+i*.007;
        d.view.root.rotation.y+=.21+i*.009;
        d.view.root.rotation.z+=.12;
        d.view.render();
      });
      if(t<1)requestAnimationFrame(frame);else resolve();
    }
    requestAnimationFrame(frame);
  });
  active.forEach(d=>{
    d.value=rand(1,d.sides);
    d.view.root.rotation.set(0,0,0);
    d.view.root.quaternion.copy(finalQuaternion(d.view,d.value-1));
    d.view.render();d.sync();d.card.classList.remove("is-rolling");
  });
  summarize();record();save();disable(false);busy=false;
}

function disable(v){
  document.querySelectorAll("button,select").forEach(x=>x.disabled=v);
}
function summarize(){
  const vals=dice.map(d=>d.value);
  totalEl.textContent=vals.reduce((a,b)=>a+b,0);
  maxEl.textContent=vals.length?Math.max(...vals):"—";
  minEl.textContent=vals.length?Math.min(...vals):"—";
  countEl.textContent=dice.length;
}
function record(){
  const e={time:new Date().toLocaleTimeString("es-CL"),values:dice.map(d=>`D${d.sides}: ${d.value}${d.locked?" 🔒":""}`),total:dice.reduce((a,d)=>a+d.value,0)};
  history.unshift(e);history=history.slice(0,30);renderHistory();
}
function renderHistory(){
  historyList.innerHTML="";emptyHistory.classList.toggle("hidden",history.length>0);
  history.forEach(e=>{
    const li=document.createElement("li");
    li.innerHTML=`<div><strong>${e.values.join(" · ")}</strong><div>Total: ${e.total}</div></div><small>${e.time}</small>`;
    historyList.appendChild(li);
  });
}
function save(){
  localStorage.setItem("dados3d-v2",JSON.stringify({
    dice:dice.map(({id,sides,value,locked})=>({id,sides,value,locked})),history,nextId,
    dark:document.body.classList.contains("dark")
  }));
}
function reset(){
  dice.forEach(d=>d.view.renderer.dispose());dice=[];history=[];nextId=1;diceGrid.innerHTML="";
  addDie(6);renderHistory();save();
}
document.getElementById("addDie").onclick=()=>{addDie(Number(document.getElementById("newDieType").value));save()};
document.getElementById("rollAll").onclick=()=>roll(dice);
document.getElementById("resetAll").onclick=()=>{if(confirm("¿Reiniciar todos los dados y borrar el historial?"))reset()};
document.getElementById("clearHistory").onclick=()=>{history=[];renderHistory();save()};
document.getElementById("themeToggle").onclick=()=>{
  document.body.classList.toggle("dark");
  document.getElementById("themeToggle").textContent=document.body.classList.contains("dark")?"☀️":"🌙";
  dice.forEach(d=>{d.view.rebuild(d.sides);d.sync()});save();
};

(function load(){
  try{
    const s=JSON.parse(localStorage.getItem("dados3d-v2"));
    if(s?.dark){document.body.classList.add("dark");document.getElementById("themeToggle").textContent="☀️"}
    history=Array.isArray(s?.history)?s.history:[];
    if(Array.isArray(s?.dice)&&s.dice.length)s.dice.forEach(x=>addDie(x.sides,x));
    else addDie(6);
    nextId=Math.max(nextId,Number(s?.nextId)||1);renderHistory();
  }catch(e){addDie(6)}
})();
window.addEventListener("resize",()=>dice.forEach(d=>d.view.render()));
