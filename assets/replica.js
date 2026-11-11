import {createWorld,resizeWorld,stepWorld,startGame,resetWorld,grab,drag,release,kick,ringPoint,setScale,reassembleWorld} from './ring-physics.mjs';

// An independent canvas implementation. Biography and links come from this portfolio.
const biography='Elliott Barnes is a Senior Software Developer at Nasdaq Verafin. Compilers, interactive systems, and small worlds.'.toLowerCase();
const palettes=[['#000000','#ffffff'],['#163cff','#ffffff'],['#ff3b30','#111111'],['#d7ff00','#111111'],['#7c3aed','#ffffff'],['#00d9ff','#001018'],['#ff6a00','#111111'],['#ff4fa3','#19000c']];
const $=selector=>document.querySelector(selector);
const canvas=$('#ring-canvas');
const context=canvas.getContext('2d');
if(context) initialize();

function initialize(){
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const world=createWorld(innerWidth,innerHeight,{reducedMotion:motion.matches});
  const target=$('#ring-control'),information=$('#information'),results=$('#results');
  const words=biography.split(' ');
  world.wordCount=words.length;
  const pointers=new Map();
  let frame=0,lastTime=0,lastPalette=-1,userPaused=motion.matches,lastTap=null,gesture=null,pinch=null,soundEnabled=false,audio=null,roundSaved=false;
  const storageKey='elliott-ring-scores-v1';
  let records=readRecords();
  const glyphs=[...biography];
  context.font='400 26px "Helvetica Neue", Helvetica, Arial, sans-serif';
  const widths=glyphs.map(letter=>context.measureText(letter).width);
  const textWidth=widths.reduce((a,b)=>a+b,0);
  let wordIndex=0,wordOffset=0;
  const wordWidths=words.map(word=>context.measureText(word).width);
  const wordGlyphs=glyphs.map((letter,index)=>{
    const entry={word:wordIndex,x:wordOffset+widths[index]/2-wordWidths[wordIndex]/2};
    if(letter===' '){wordIndex++;wordOffset=0;}else wordOffset+=widths[index];
    return entry;
  });
  information.open=false;
  $('.stage').hidden=false;
  $('.scene-tools').hidden=false;
  document.body.classList.add('enhanced');
  target.dataset.mode='home';

  function readRecords(){
    try{return JSON.parse(localStorage.getItem(storageKey)||'[]').filter(row=>/^[A-Z]{3}$/.test(row.initials)&&Number.isInteger(row.score)&&row.score>=0&&row.score<=1000).slice(0,10);}catch{return [];}
  }
  function announce(message){$('#announcements').textContent=message;}
  function syncPause(){
    world.paused=userPaused||information.open||document.hidden||results.open;
    $('#pause').textContent=userPaused?'resume':'pause';
    $('#pause').setAttribute('aria-pressed',String(userPaused));
    lastTime=0;schedule();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(tick);}
  function resize(){
    const ratio=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);
    context.setTransform(ratio,0,0,ratio,0,0);
    resizeWorld(world,innerWidth,innerHeight);schedule();
  }
  function paintRing(body,filled=false){
    if(!body)return;
    const font=world.mode==='game'||world.mode==='results'?13:26;
    const circumference=2*Math.PI*body.radius;
    const gap=font*.75;
    const raw=textWidth*font/26;
    const stretch=Math.min(1,(circumference-gap)/raw);
    const tracking=Math.max(0,(circumference-gap-raw)/(glyphs.length-1));
    const colors=palettes[world.palette%palettes.length];
    if(filled){
      context.beginPath();
      for(let i=0;i<=96;i++){
        const angle=i/96*Math.PI*2,point=ringPoint(world,angle,body);
        point.x+=Math.cos(angle)*font*.6;point.y+=Math.sin(angle)*font*.6;
        if(i===0)context.moveTo(point.x,point.y);else context.lineTo(point.x,point.y);
      }
      context.closePath();context.fillStyle=colors[1];context.fill();
    }
    context.font=`400 ${font}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
    context.textBaseline='middle';context.textAlign='center';context.fillStyle=colors[filled?0:1];
    let offset=gap/2;
    const wordAngles=[];
    for(let i=0;i<glyphs.length;i++){
      const width=widths[i]*font/26*stretch;
      const theta=(body.angle||0)+(offset+width/2)/body.radius;
      const point=ringPoint(world,theta,body);
      let x=point.x,y=point.y,angle=point.angle,scale=stretch;
      const word=wordGlyphs[i];
      if(i===0||glyphs[i-1]===' ')wordAngles.push((offset+wordWidths[word.word]*font/26*stretch/2)/body.radius);
      if(world.reassembly>0){
        const particle=world.particles[word.word];
        if(particle){
          const progress=1-Math.pow(world.reassembly/.72,4);
          const fromAngle=particle.fromAngle||0;
          const fromX=particle.fromX+Math.cos(fromAngle)*word.x;
          const fromY=particle.fromY+Math.sin(fromAngle)*word.x;
          x=fromX+(x-fromX)*progress;y=fromY+(y-fromY)*progress;
          angle=fromAngle+Math.atan2(Math.sin(angle-fromAngle),Math.cos(angle-fromAngle))*progress;scale=1+(stretch-1)*progress;
        }
      }
      context.save();context.translate(x,y);context.rotate(angle);context.scale(scale,1);
      context.fillText(glyphs[i],0,0);context.restore();offset+=width+tracking;
    }
    if(body===world.ball)world.wordAngles=wordAngles;
  }
  function draw(){
    const colors=palettes[world.palette%palettes.length];
    if(lastPalette!==world.palette){
      document.documentElement.style.setProperty('--background',colors[0]);
      document.documentElement.style.setProperty('--foreground',colors[1]);
      $('meta[name="theme-color"]').content=colors[0];lastPalette=world.palette;
    }
    context.clearRect(0,0,world.width,world.height);
    if(world.mode==='burst'&&!world.reassembly){
      context.font='400 26px "Helvetica Neue", Helvetica, Arial, sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillStyle=colors[1];
      for(const particle of world.particles){context.save();context.translate(particle.x,particle.y);context.rotate(particle.angle||0);context.fillText(words[particle.index%words.length],0,0);context.restore();}
    }else{paintRing(world.ball);paintRing(world.puck,true);}
    const ball=world.ball,r=ball.extent||ball.radius+13;
    target.style.width=`${r*2}px`;target.style.height=`${r*2}px`;
    target.style.transform=`translate3d(${ball.x-r}px,${ball.y-r}px,0)`;
    target.hidden=world.mode==='burst';target.dataset.mode=world.mode;
    const playing=world.mode==='game'||world.mode==='results';
    $('.goal').hidden=!playing;
    if(playing){$('.goal').style.left=`${world.goal.left}px`;$('.goal').style.width=`${world.goal.width}px`;}
    $('#timer').textContent=`:${String(Math.ceil(world.remaining)).padStart(2,'0')}`;
    $('#score').textContent=String(world.score);
    $('#play').textContent=playing?'done':'play';
    $('#interaction-hint').textContent=world.mode==='burst'?'tap to put it back together':playing?'drag the ring · hit the puck into the goal':userPaused?'motion paused · arrows move the ring':'drag · double-tap to play';
  }
  function tick(time){
    frame=0;const delta=lastTime?Math.max(0,(time-lastTime)/1000):0;lastTime=time;
    const events=stepWorld(world,delta)||[];
    for(const event of events){
      if(event.type==='goal'){announce(`${world.score} ${world.score===1?'goal':'goals'}`);tone(660);$('#goal-burst').classList.remove('scored');void $('#goal-burst').offsetWidth;$('#goal-burst').classList.add('scored');}
      if(event.type==='wall')tone(140);
      if(event.type==='burst'){tone(75);announce('The ring burst. Tap anywhere to put it back together.');}
      if(event.type==='end')showResults();
    }
    draw();
    if(!world.paused&&!(world.reducedMotion&&world.mode==='home'&&!world.reassembly))schedule();
  }
  function releaseAll(){pointers.clear();pinch=null;gesture=null;release(world);}
  function goHome(){
    releaseAll();if(results.open)results.close();world.reducedMotion=motion.matches;resetWorld(world);userPaused=motion.matches;syncPause();target.focus({preventScroll:true});
  }
  function togglePause(){userPaused=!userPaused;if(!userPaused)world.reducedMotion=false;syncPause();}
  function play(){
    if(results.open)results.close();information.open=false;releaseAll();startGame(world);roundSaved=false;userPaused=false;syncPause();target.focus({preventScroll:true});announce('15 seconds. Move the outline ring to hit the filled puck through the goal.');
  }
  function toggleGame(){world.mode==='game'||world.mode==='results'?goHome():play();}
  function showResults(){
    releaseAll();$('#result-score').textContent=String(world.score);$('#score-form').reset();$('#score-form').hidden=false;$('#record-status').textContent='';renderRecords();results.showModal();syncPause();$('#play-again').focus();announce(`Time. ${world.score} goals in 15 seconds.`);
  }
  function renderRecords(){
    const list=$('#scores-list');list.replaceChildren();
    for(let i=0;i<10;i++){
      const row=document.createElement('li');if(!records[i])row.className='empty';
      const rank=document.createElement('span');rank.className='rank';rank.textContent=String(i+1).padStart(2,'0');
      const initials=document.createElement('span');initials.className='initials';initials.textContent=records[i]?.initials||'—';
      const score=document.createElement('span');score.textContent=records[i]?String(records[i].score):'—';row.append(rank,initials,score);list.append(row);
    }
  }
  function tone(frequency){
    if(!soundEnabled)return;
    try{
      audio??=new (window.AudioContext||window.webkitAudioContext)();
      const oscillator=audio.createOscillator(),gain=audio.createGain();oscillator.type='sine';oscillator.frequency.setValueAtTime(frequency,audio.currentTime);oscillator.frequency.exponentialRampToValueAtTime(Math.max(30,frequency*.55),audio.currentTime+.1);
      gain.gain.setValueAtTime(.035,audio.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.14);oscillator.connect(gain);gain.connect(audio.destination);oscillator.start();oscillator.stop(audio.currentTime+.15);
    }catch{soundEnabled=false;$('#sound').textContent='sound unavailable';$('#sound').setAttribute('aria-pressed','false');}
  }
  target.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    target.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1){gesture={x:event.clientX,y:event.clientY,time:event.timeStamp,last:event.timeStamp,moved:false};grab(world,event.clientX,event.clientY);}
    else if(pointers.size===2){const pair=[...pointers.values()];pinch={distance:Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y),scale:world.scale||1};gesture.moved=true;lastTap=null;}
    schedule();
  });
  target.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pinch&&pointers.size===2){const pair=[...pointers.values()];setScale(world,pinch.scale*Math.hypot(pair[0].x-pair[1].x,pair[0].y-pair[1].y)/Math.max(1,pinch.distance));}
    else if(gesture){gesture.moved||=Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>7;drag(world,event.clientX,event.clientY,Math.max(.008,(event.timeStamp-gesture.last)/1000));gesture.last=event.timeStamp;}
    schedule();
  });
  function pointerEnd(event){
    if(!pointers.has(event.pointerId))return;
    const tap=event.type==='pointerup'&&gesture&&!gesture.moved&&!pinch&&event.timeStamp-gesture.time<=260;
    if(tap){
      if(lastTap&&event.timeStamp-lastTap.time<=320&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<=32){lastTap=null;toggleGame();}
      else lastTap={x:event.clientX,y:event.clientY,time:event.timeStamp};
    }else lastTap=null;
    pointers.delete(event.pointerId);
    if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId);
    if(!pointers.size){pinch=null;gesture=null;release(world);}else if(pinch){pinch=null;gesture=null;release(world);}
    schedule();
  }
  target.addEventListener('pointerup',pointerEnd);target.addEventListener('pointercancel',pointerEnd);target.addEventListener('lostpointercapture',()=>{if(pointers.size)releaseAll();});
  target.addEventListener('click',event=>{if(event.detail===0)toggleGame();});
  target.addEventListener('keydown',event=>{
    const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
    if(directions[event.key]){event.preventDefault();const [x,y]=directions[event.key];kick(world,x*180,y*180);schedule();}
    else if(event.key==='Enter'){event.preventDefault();toggleGame();}
    else if(event.key===' '){event.preventDefault();togglePause();}
    else if(event.key.toLowerCase()==='r'){event.preventDefault();goHome();}
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){if(information.open){information.open=false;information.querySelector('summary').focus();}else if(world.mode!=='home'){event.preventDefault();goHome();}}});
  document.addEventListener('pointerdown',event=>{if(world.mode==='burst'&&!event.target.closest('button,a,summary,input,dialog')){reassembleWorld(world);announce('Ring reassembled.');schedule();}});
  $('#play').addEventListener('click',toggleGame);$('#play-again').addEventListener('click',play);$('#done').addEventListener('click',goHome);
  results.addEventListener('cancel',event=>{event.preventDefault();goHome();});
  $('#pause').addEventListener('click',togglePause);$('#reset').addEventListener('click',goHome);
  $('#sound').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('#sound').textContent=soundEnabled?'sound on':'sound off';$('#sound').setAttribute('aria-pressed',String(soundEnabled));if(soundEnabled){tone(440);audio?.resume().catch(()=>{});}});
  information.addEventListener('toggle',()=>{
    releaseAll();$('.stage').inert=information.open;$('.scene-tools').inert=information.open;syncPause();
    if(information.open)$('#close-information').focus({preventScroll:true});
  });
  $('#close-information').addEventListener('click',()=>{information.open=false;information.querySelector('summary').focus();});
  $('.skip-link').addEventListener('click',()=>{information.open=true;});
  function followHash(){
    let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}
    const aliases={pixel:'pixel-language',automata:'automata-lab'};
    const project=document.getElementById(id)||document.getElementById(`project-${aliases[id]||id}`);
    if(project||['about','projects','connect'].includes(id)){
      information.open=true;
      requestAnimationFrame(()=>{if(project&&project!==information)project.scrollIntoView({block:'start'});});
    }
  }
  addEventListener('hashchange',followHash);
  const initials=[...document.querySelectorAll('.initial-fields input')];
  initials.forEach((input,index)=>input.addEventListener('input',()=>{input.value=input.value.replace(/[^a-z]/gi,'').toUpperCase().slice(-1);if(input.value)initials[index+1]?.focus();}));
  $('#score-form').addEventListener('submit',event=>{
    event.preventDefault();if(roundSaved)return;const name=initials.map(input=>input.value).join('').toUpperCase();if(!/^[A-Z]{3}$/.test(name))return;
    records=[...records,{initials:name,score:world.score}].sort((a,b)=>b.score-a.score).slice(0,10);roundSaved=true;let saved=true;
    try{localStorage.setItem(storageKey,JSON.stringify(records));}catch{saved=false;}
    renderRecords();$('#score-form').hidden=true;$('#record-status').textContent=saved?'Saved on this device.':'Kept for this visit; browser storage is unavailable.';$('#play-again').focus();
  });
  addEventListener('resize',resize);document.addEventListener('visibilitychange',()=>{releaseAll();syncPause();});addEventListener('blur',releaseAll);
  motion.addEventListener('change',event=>{world.reducedMotion=event.matches;if(world.mode==='home')userPaused=event.matches;syncPause();});
  resize();syncPause();followHash();
}
