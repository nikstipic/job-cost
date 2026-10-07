const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const vm=require('node:vm');
const {chromium}=require('playwright');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
let browser,server,url;
before(async()=>{
 server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end(html)});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url=`http://127.0.0.1:${server.address().port}`;
 const executablePath=process.env.CHROMIUM_PATH||(['/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>fs.existsSync(p)));
 browser=await chromium.launch({executablePath,headless:true,args:['--no-sandbox']});
});
after(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve))});
async function withPage(run,{mobile=false,legacy=null,viewport=null}={}){
 const context=await browser.newContext({viewport:viewport||(mobile?{width:390,height:844}:{width:1500,height:1000}),isMobile:mobile,hasTouch:mobile,timezoneId:'Australia/Sydney'});
 const page=await context.newPage(),errors=[];page.setDefaultTimeout(5000);
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().startsWith('Failed to load resource'))errors.push(m.text())});
 await page.route('https://cdn.jsdelivr.net/**',route=>route.abort());
 page.on('dialog',dialog=>dialog.accept());
 if(legacy)await page.addInitScript(data=>{if(!localStorage.getItem('__seeded')){localStorage.setItem('mmdb',JSON.stringify(data));localStorage.setItem('__seeded','1')}},legacy);
 try{assert.equal((await page.goto(url)).status(),200);await page.waitForFunction(()=>appReady);await run(page);assert.deepEqual(errors,[],'No runtime or render errors')}finally{await context.close()}
}
async function seed(page){return page.evaluate(()=>{
 db=blankWorkspace();db.jobs=[{name:'Regression job'}];
 db.labour=[{worker:'Zed',trade:'Carpentry',rate:50,planned:[],entries:[{date:'2026-01-01',hours:4,rate:50}]}];
 db.trades=[{company:'Alpha Trade',trade:'Plumbing',price:1000,payments:[{date:'2026-01-01',amount:100}]}];db.hire=[{company:'Plant Co',item:'Crane',category:'Crane'}];
 persist();return siteIsoDate(new Date());
})}
async function fill(page,selector,fields){for(const [name,value]of Object.entries(fields)){const input=page.locator(`${selector} [name="${name}"]`);await input.evaluate(node=>{for(let ancestor=node.parentElement;ancestor;ancestor=ancestor.parentElement)if(ancestor.tagName==='DETAILS')ancestor.open=true});await input.fill(String(value))}}
async function saveGeneral(page){await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('dlg').open)}
async function activity(page,date){
 await page.evaluate(()=>openProgrammeActivity());
 await fill(page,'#programmeActivityDlg',{name:'Frame construction',plannedStart:date,plannedFinish:await page.evaluate(d=>programmeAddDays(d,4),date)});
 for(const checkbox of await page.locator('#programmeActivityDlg [name="workDays"]').all())await checkbox.check();
 await page.locator('#programmeWorkerPicker input[value="labour:0"]').check();
 await page.locator('#programmeActivityDlg button[type="submit"]').click();
 return page.evaluate(()=>db.programmeActivities[0].id);
}
async function booking(page,date,group='Labour',supplier='Zed',days=4){
 await page.evaluate(d=>openBookingForm(d),date);await page.locator('#bookingType').selectOption(group);
 await fill(page,'#dlg',{supplier,details:'Scheduled site work',date,endDate:await page.evaluate(({date,days})=>programmeAddDays(date,days),{date,days})});
 await saveGeneral(page);
}
test('one valid document and one application script, with unique functions and IDs',()=>{
 assert.equal((html.match(/<body>/g)||[]).length,1);assert.equal((html.match(/<\/html>/g)||[]).length,1);
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(scripts.length,1);new vm.Script(scripts[0][1]);
 const names=[...scripts[0][1].matchAll(/^(?:async )?function (\w+)\(/gm)].map(m=>m[1]);assert.equal(new Set(names).size,names.length);
 const ids=[...html.slice(0,html.indexOf('<script>')).matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
});
test('legacy data and unknown fields survive startup and reload',()=>withPage(async page=>{
 assert.equal(await page.evaluate(()=>db.jobs[0].name),'Legacy job');
 assert.equal(await page.evaluate(()=>db.bookings.length),1);
 await page.reload();await page.waitForFunction(()=>appReady);assert.equal(await page.evaluate(()=>db.jobs[0].custom),'keep');
},{legacy:{jobs:[{name:'Legacy job',custom:'keep'}],bookings:[{group:'Site Issue',date:'2026-01-01',details:'Keep historical booking'}]}}));
test('navigation, missing optional cloud client, and workspace switching',()=>withPage(async page=>{
 for(const name of ['Pricing','Build','Money','Directory','My Day']){await page.locator('#nav').getByRole('button',{name,exact:true}).click();assert.equal(await page.locator('.page.active').count(),1)}
 await page.getByRole('button',{name:'Share / Sync',exact:true}).click();await page.getByRole('button',{name:'Create Code From This Device'}).click();assert.match(await page.locator('#syncMsg').innerText(),/could not load/);await page.locator('#syncDlg').getByRole('button',{name:'Close',exact:true}).click();
 const old=await page.locator('#jobWorkspaceSelect').inputValue();page.removeAllListeners('dialog');page.once('dialog',d=>d.accept('New workspace'));await page.getByRole('button',{name:'+ New Job',exact:true}).click();assert.match(await page.locator('#jobWorkspaceSelect').innerText(),/New workspace/);await page.locator('#jobWorkspaceSelect').selectOption(old);assert.equal(await page.locator('#jobWorkspaceSelect').inputValue(),old);
}));
test('activity create/edit/save, worker expectations, duration, and persistence',()=>withPage(async page=>{
 const date=await seed(page),id=await activity(page,date);
 assert.deepEqual(await page.evaluate(d=>bookedSnapshotRows(d).map(r=>r.name),date),['Zed']);
 await page.evaluate(()=>openProgrammeActivity(0));await fill(page,'#programmeActivityDlg',{name:'Updated frame'});await page.locator('#programmeActivityDlg button[type="submit"]').click();
 await page.evaluate(({id,date})=>programmeMoveActivity(id,programmeAddDays(date,2),date),{id,date});
 assert.deepEqual(await page.evaluate(()=>db.programmeActivities.map(a=>programmeDayDiff(a.plannedStart,a.plannedFinish))),[4]);
 assert.deepEqual(await page.evaluate(d=>bookedSnapshotRows(d),date),[]);
 await page.reload();assert.equal(await page.evaluate(()=>db.programmeActivities[0].name),'Updated frame');assert.equal(await page.evaluate(()=>db.programmeActivities[0].plannedStart),await page.evaluate(d=>programmeAddDays(d,2),date));
}));
test('multi-day resource create/edit, invalid date rejection, and saved cost',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date);
 assert.equal(await page.evaluate(d=>bookingCoversDate(db.bookings[0],programmeAddDays(d,4)),date),true);
 await page.evaluate(()=>editBooking(0));await fill(page,'#dlg',{endDate:await page.evaluate(d=>programmeAddDays(d,-1),date)});await page.locator('#dlg').getByRole('button',{name:'Save',exact:true}).click();assert.equal(await page.locator('#dlg').evaluate(d=>d.open),true);
 await fill(page,'#dlg',{date:await page.evaluate(d=>programmeAddDays(d,2),date),endDate:await page.evaluate(d=>programmeAddDays(d,6),date),cost:'850'});await saveGeneral(page);
 await page.reload();assert.equal(await page.evaluate(()=>db.bookings[0].cost),850);assert.equal(await page.evaluate(()=>programmeDayDiff(db.bookings[0].date,db.bookings[0].endDate)),4);
}));
test('labour scheduling drag updates plans and expectations, preserves actual hours',()=>withPage(async page=>{
 const date=await seed(page);
 await page.evaluate(d=>{activeWorkerIndex=0;labourSelectedDates=new Set(dateRange(d,programmeAddDays(d,4)));bookLabourDates({preventDefault(){},target:document.getElementById('labourBookingForm')});setSiteDay(d)},date);
 await page.evaluate(()=>{const rows=currentSiteSnapshotRows();rows[0].in=true;rows[0].actual=4;renderSiteSnapshotRows(rows);saveSiteSnapshot(true)});
 await page.evaluate(d=>{programmeDragSourceDate=d;programmeMoveBookingGroup(programmeBookingKey(db.bookings[0]),programmeAddDays(d,2))},date);
 const expected=await page.evaluate(d=>dateRange(programmeAddDays(d,2),programmeAddDays(d,6)),date);
 assert.deepEqual(await page.evaluate(()=>db.labour[0].planned.map(p=>p.date)),expected);
 assert.deepEqual(await page.evaluate(()=>db.bookings.map(p=>p.date)),expected);
 assert.equal(await page.evaluate(d=>siteSnapshotForDate(d).rows[0].actual,date),4);
 assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].actual),4);
 assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].booked),false);
 await page.evaluate(()=>editBooking(0));await fill(page,'#dlg',{date:await page.evaluate(d=>programmeAddDays(d,7),date),endDate:await page.evaluate(d=>programmeAddDays(d,7),date)});await saveGeneral(page);
 assert.equal(await page.evaluate(()=>db.labour[0].planned.find(p=>p.autoKey===db.bookings[0].autoKey).date),await page.evaluate(d=>programmeAddDays(d,7),date));
 await page.reload();assert.deepEqual(await page.evaluate(()=>db.labour[0].entries.map(e=>e.hours)),[4]);assert.equal(await page.evaluate(d=>siteSnapshotForDate(d).rows[0].actual,date),4);
}));
test('popup Remove Future removes all related future schedules but keeps history',()=>withPage(async page=>{
 const date=await seed(page);await page.evaluate(d=>{activeWorkerIndex=0;labourSelectedDates=new Set(dateRange(d,programmeAddDays(d,4)));bookLabourDates({preventDefault(){},target:document.getElementById('labourBookingForm')});db.bookings.push({group:'Labour',supplier:'Other Worker',date:programmeAddDays(d,3)});openProgrammeDay(programmeAddDays(d,2))},date);
 await page.locator('#programmeDayBody .programme-day-item').filter({hasText:'Zed'}).locator('.row-menu summary').click();await page.locator('#programmeDayBody .programme-day-item').filter({hasText:'Zed'}).getByRole('button',{name:'Remove Future'}).click();
 assert.deepEqual(await page.evaluate(()=>db.labour[0].planned.map(p=>p.date)),await page.evaluate(d=>dateRange(d,programmeAddDays(d,1)),date));
 assert.equal(await page.evaluate(()=>db.labour[0].entries[0].hours),4);assert.equal(await page.evaluate(()=>db.bookings.some(b=>b.supplier==='Other Worker')),true);
 assert.equal(await page.locator('#programmeDayBody').getByText('Zed',{exact:true}).count(),0);
}));
test('popup sorted Edit and Delete target the correct booking and update attendance live',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date,'Labour','Zed',0);await booking(page,date,'Trade','Alpha Trade',0);
 await page.evaluate(d=>{setSiteDay(d);openProgrammeDay(d)},date);
 assert.deepEqual(await page.evaluate(()=>currentSiteSnapshotRows().map(r=>r.name)),['Alpha Trade','Zed']);
 await page.locator('#programmeDayBody .programme-day-item').filter({hasText:'Alpha Trade'}).getByRole('button',{name:'Edit',exact:true}).click();await fill(page,'#dlg',{details:'Updated plumbing'});await saveGeneral(page);
 assert.equal(await page.evaluate(()=>db.bookings.find(b=>b.group==='Trade').details),'Updated plumbing');assert.equal(await page.evaluate(()=>db.bookings.find(b=>b.group==='Labour').details),'Scheduled site work');
 await page.evaluate(d=>openProgrammeDay(d),date);await page.locator('#programmeDayBody .programme-day-item').filter({hasText:'Alpha Trade'}).locator('.row-menu summary').click();await page.locator('#programmeDayBody .programme-day-item').filter({hasText:'Alpha Trade'}).getByRole('button',{name:'Delete',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>currentSiteSnapshotRows().map(r=>r.name)),['Zed']);assert.equal(await page.evaluate(()=>db.trades[0].payments[0].amount),100);
}));
test('desktop pointer drag moves complete activity and resource ranges and dates remain clickable',()=>withPage(async page=>{
 const date=await seed(page);await activity(page,date);await booking(page,date,'Trade','Alpha Trade',4);await page.locator('#nav').getByRole('button',{name:'Build',exact:true}).click();
 await page.locator(`.programme-date-button[onclick*="${date}"]`).click();assert.equal(await page.locator('#programmeDayDlg').evaluate(d=>d.open),true);await page.locator('#programmeDayDlg').getByRole('button',{name:'Close',exact:true}).click();
 for(const selector of ['.programme-activity-row','.programme-row:has(.programme-resource-bar)']){
   const row=page.locator(selector).first(),bar=row.locator(`[data-programme-date="${date}"] .programme-bar`),targetDate=await page.evaluate(d=>programmeAddDays(d,2),date),target=row.locator(`[data-programme-date="${targetDate}"]`);
   const a=await bar.boundingBox(),b=await target.boundingBox();assert.ok(a&&b);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
 }
 assert.equal(await page.evaluate(()=>db.programmeActivities[0].plannedStart),await page.evaluate(d=>programmeAddDays(d,2),date));assert.equal(await page.evaluate(()=>db.bookings[0].date),await page.evaluate(d=>programmeAddDays(d,2),date));assert.equal(await page.evaluate(()=>programmeDayDiff(db.bookings[0].date,db.bookings[0].endDate)),4);
 await page.reload();assert.equal(await page.evaluate(()=>db.bookings[0].date),await page.evaluate(d=>programmeAddDays(d,2),date));
}));
test('labour/trade detail edits retain plans, payments, history and unknown fields',()=>withPage(async page=>{
 await seed(page);await page.evaluate(()=>{db.labour[0].custom='keep';db.labour[0].planned=[{date:'2026-12-01',autoKey:'plan'}];openForm('labour',0)});await fill(page,'#dlg',{rate:'60'});await saveGeneral(page);
 assert.equal(await page.evaluate(()=>db.labour[0].entries[0].hours),4);assert.equal(await page.evaluate(()=>db.labour[0].planned.length),1);assert.equal(await page.evaluate(()=>db.labour[0].custom),'keep');
 await page.evaluate(()=>openForm('trades',0));await fill(page,'#dlg',{contact:'New contact'});await saveGeneral(page);assert.equal(await page.evaluate(()=>db.trades[0].payments[0].amount),100);
}));
test('tasks, issues, site diary: create/edit/complete/delete and reload',()=>withPage(async page=>{
 const date=await seed(page);await page.locator('#myday .toolbar').getByRole('button',{name:'+ Task',exact:true}).click();await fill(page,'#taskDlg',{title:'Call plumber'});await page.locator('#taskDlg button[type="submit"]').click();
 await page.evaluate(()=>openMyDayTask(db.tasks[0].id));await fill(page,'#taskDlg',{title:'Call electrician'});await page.locator('#taskDlg button[type="submit"]').click();await page.evaluate(()=>toggleMyDayTask(db.tasks[0].id));assert.equal(await page.evaluate(()=>db.tasks[0].done),true);
 await page.evaluate(()=>openForm('issues'));await fill(page,'#dlg',{issue:'Broken window',area:'Level 1',due:date});await saveGeneral(page);await page.evaluate(()=>openForm('issues',0));await fill(page,'#dlg',{notes:'Repair booked'});await saveGeneral(page);
 await page.evaluate(d=>{setSiteDay(d);openDailyFormForSiteDay()},date);await fill(page,'#dlg',{completed:'Frame erected',notCompleted:'Glazing',notCompletedReason:'Awaiting glass'});await saveGeneral(page);
 await page.evaluate(()=>openForm('daily',0));await fill(page,'#dlg',{completed:'Frame inspected'});await saveGeneral(page);
 await page.reload();assert.equal(await page.evaluate(()=>db.tasks[0].title),'Call electrician');assert.equal(await page.evaluate(()=>db.issues[0].notes),'Repair booked');assert.equal(await page.evaluate(()=>db.daily[0].completed),'Frame inspected');
 await page.evaluate(()=>{deleteMyDayTask(db.tasks[0].id);removeRow('issues',0);removeRow('daily',0)});assert.deepEqual(await page.evaluate(()=>[db.tasks.length,db.issues.length,db.daily.length]),[0,0,0]);
}));
test('mobile Programme, popup edit, and sign-in actual hours survive reload',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date,'Labour','Zed',0);await booking(page,date,'Trade','Alpha Trade',0);
 await page.locator('#nav').getByRole('button',{name:/Build/}).tap();assert.equal(await page.locator('#mobileBuildShell').isVisible(),true);assert.equal(await page.locator('#mobileProgrammeAgenda').isVisible(),true);
 await page.locator('#mobileProgrammeAgenda .mp-todaybar button').tap();assert.equal(await page.locator('#programmeDayDlg').evaluate(d=>d.open),true);await page.locator('#programmeDayDlg').getByRole('button',{name:'Close',exact:true}).tap();
 await page.locator('#mobileBuildShell [data-build-page="signin"]').tap();await page.evaluate(d=>setSiteDay(d),date);
 const card=page.locator('.mobile-attendance-card').filter({hasText:'Zed'});await card.locator('.mobile-in-toggle').tap();await card.getByLabel('Actual hours').fill('4');await page.waitForTimeout(450);
 assert.equal(await page.evaluate(d=>siteSnapshotForDate(d).rows.find(r=>r.name==='Zed').actual,date),4);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'Mobile page does not overflow');
 await page.reload();await page.evaluate(d=>{showSub('build','signin');setSiteDay(d)},date);assert.equal(await page.locator('.mobile-attendance-card').filter({hasText:'Zed'}).getByLabel('Actual hours').inputValue(),'4');
},{mobile:true}));
test('workspace attendance edits are flushed and never copied into another job',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date,'Labour','Zed',0);await page.evaluate(d=>setSiteDay(d),date);
 const old=await page.locator('#jobWorkspaceSelect').inputValue();await page.evaluate(()=>{const row=document.querySelector('#siteSnapshotRows tr');row.querySelector('[name="in"]').checked=true;row.querySelector('[name="actual"]').value='4';queueSiteSnapshotSave()});
 page.removeAllListeners('dialog');page.once('dialog',d=>d.accept('Second isolated job'));await page.getByRole('button',{name:'+ New Job',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>currentSiteSnapshotRows()),[]);assert.equal(await page.evaluate(()=>db.labour.length),0);
 await page.locator('#jobWorkspaceSelect').selectOption(old);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].actual),4);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].name),'Zed');
}));
test('working-day activity duration and legacy worker labels survive moves',()=>withPage(async page=>{
 await seed(page);await page.evaluate(()=>{db.programmeActivities=[{id:'weekdays',name:'Weekday work',plannedStart:'2026-10-12',plannedFinish:'2026-10-16',workDays:[1,2,3,4,5],workers:['Legacy crew'],workerNames:['Older crew']}];programmeMoveActivity('weekdays','2026-10-14')});
 assert.deepEqual(await page.evaluate(()=>programmeActivityDates(db.programmeActivities[0])),['2026-10-14','2026-10-15','2026-10-16','2026-10-19','2026-10-20']);
 assert.deepEqual(await page.evaluate(()=>programmeWorkerNames(db.programmeActivities[0])),['Legacy crew','Older crew']);
}));
test('trade and hire calendar scheduling, editing, completion and costs update live',()=>withPage(async page=>{
 const date=await seed(page);
 await page.evaluate(d=>{activeTradeIndex=0;tradeSelectedDates=new Set(dateRange(d,programmeAddDays(d,2)));bookTradeDates({preventDefault(){},target:document.querySelector('#tradeDlg form[onsubmit="bookTradeDates(event)"]')});activeHireIndex=0;hireSelectedDates=new Set(dateRange(d,programmeAddDays(d,1)));bookHireDates({preventDefault(){},target:document.getElementById('hireBookingForm')})},date);
 assert.equal(await page.evaluate(()=>db.bookings.filter(b=>b.group==='Trade').length),3);assert.equal(await page.evaluate(()=>db.bookings.filter(b=>b.group==='Hire / Plant').length),2);
 await page.evaluate(d=>{editTradeDates(0);tradeSelectedDates=new Set([programmeAddDays(d,4)]);bookTradeDates({preventDefault(){},target:document.querySelector('#tradeDlg form[onsubmit="bookTradeDates(event)"]')})},date);
 assert.equal(await page.evaluate(()=>db.bookings.filter(b=>b.group==='Trade').length),1);
 await page.evaluate(()=>completeBooking(db.bookings.findIndex(b=>b.group==='Hire / Plant')));assert.match(await page.locator('#completedBookingsTable').innerText(),/Plant Co|Crane/);
 await page.evaluate(()=>{db.bookings.find(b=>b.group==='Trade').cost=850;persist()});assert.equal(await page.evaluate(()=>costRows().find(r=>r.type==='bookings').committed),850);
 await page.reload();assert.equal(await page.evaluate(()=>db.bookings.filter(b=>b.group==='Trade').length),1);
}));
test('Remove Future retains historical activity assignments and actual attendance',()=>withPage(async page=>{
 const date=await seed(page);await activity(page,date);await page.evaluate(d=>{setSiteDay(d);const rows=currentSiteSnapshotRows();rows[0].in=true;rows[0].actual=4;renderSiteSnapshotRows(rows);saveSiteSnapshot(true);removePersonFutureWork('labour',0,programmeAddDays(d,2));persist()},date);
 assert.deepEqual(await page.evaluate(d=>bookedSnapshotRows(d).map(r=>r.name),date),['Zed']);
 assert.deepEqual(await page.evaluate(d=>bookedSnapshotRows(programmeAddDays(d,2)),date),[]);assert.equal(await page.evaluate(d=>siteSnapshotForDate(d).rows[0].actual,date),4);
}));
test('apostrophes in resource names do not break generated pointer handlers',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date,'Trade',"O'Brien & Sons",0);await page.evaluate(()=>showMain('build'));
 const handlers=await page.locator('.programme-resource-bar').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('onpointerdown')));for(const handler of handlers)assert.doesNotThrow(()=>new Function(handler));
 assert.equal(await page.locator('.programme-resource-bar').evaluate(node=>typeof node.onpointerdown),'function');
}));
test('a secondary render failure is visible and does not stop Programme rendering',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date);
 const result=await page.evaluate(()=>{const original=renderStock,log=console.error;renderStock=()=>{throw new Error('Injected optional failure')};console.error=()=>{};try{document.getElementById('constructionProgramme').replaceChildren();render();return{notice:document.getElementById('renderErrors').textContent,programme:!!document.querySelector('.programme-date-button')}}finally{renderStock=original;console.error=log;render()}});
 assert.match(result.notice,/renderStock/);assert.equal(result.programme,true);assert.equal(await page.locator('#renderErrors').count(),0);
}));
test('attendance hours immediately update labour costs and diary while planned hours stay separate',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date,'Labour','Zed',0);await page.evaluate(d=>{setSiteDay(d);db.daily.push({date:d,completed:'Work recorded'});const rows=currentSiteSnapshotRows();rows[0].in=true;rows[0].planned=10;rows[0].actual=4;renderSiteSnapshotRows(rows);saveSiteSnapshot(true);persist()},date);
 assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].planned),10);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].actual),4);
 assert.equal(await page.evaluate(()=>db.daily[0].snapshotHours),4);assert.equal(await page.evaluate(()=>db.daily[0].snapshotPlannedHours),10);
 assert.equal(await page.evaluate(d=>costRows().find(r=>r.type==='labour'&&r.date===d).committed,date),200);
 assert.match(await page.locator('#labourTable').innerText(),/4/);
 await page.reload();assert.equal(await page.evaluate(()=>db.daily[0].snapshotHours),4);
}));
test('materials delivery scheduling, costs, date edit, and collection stay connected',()=>withPage(async page=>{
 const date=await seed(page);await page.evaluate(()=>openForm('materials'));await fill(page,'#dlg',{item:'Concrete',needed:date,cost:'1200',supplier:'Concrete Co'});await saveGeneral(page);
 assert.equal(await page.evaluate(()=>db.bookings.find(b=>b.group==='Materials').date),date);
 await page.evaluate(()=>openForm('materials',0));await fill(page,'#dlg',{needed:await page.evaluate(d=>programmeAddDays(d,2),date)});await saveGeneral(page);assert.equal(await page.evaluate(()=>db.bookings.filter(b=>b.group==='Materials').length),1);
 await page.evaluate(()=>openForm('materials',0));await page.locator('#dlg [name="fulfilment"]').selectOption('Collected');await fill(page,'#dlg',{collectedDate:date});await saveGeneral(page);
 assert.equal(await page.evaluate(()=>db.bookings.filter(b=>b.group==='Materials').length),0);assert.equal(await page.evaluate(()=>costRows().find(r=>r.type==='materials').committed),1200);await page.reload();assert.equal(await page.evaluate(()=>db.materials[0].fulfilment),'Collected');
}));
test('estimating quote award updates Trades, budget and costs without reload',()=>withPage(async page=>{
 await seed(page);await page.evaluate(()=>openEstimatePackage());await fill(page,'#estimatePackageDlg',{name:'Electrical',budget:'2500',scope:'Install wiring'});await page.locator('#estimatePackageDlg button[type="submit"]').click();
 await page.evaluate(()=>openEstimateQuote(0));await fill(page,'#estimateQuoteDlg',{company:'Electric Co',amount:'2400'});await page.locator('#estimateQuoteDlg button[type="submit"]').click();await page.waitForFunction(()=>!document.getElementById('estimateQuoteDlg').open);
 await page.evaluate(()=>awardEstimateQuote(0,0));assert.equal(await page.evaluate(()=>db.trades.find(t=>t.company==='Electric Co').price),2400);assert.match(await page.locator('#tradesTable').innerText(),/Electric Co/);assert.equal(await page.evaluate(()=>costRows().find(r=>r.company==='Electric Co').committed),2400);
 await page.reload();assert.equal(await page.evaluate(()=>db.estimates[0].quotes[0].awarded),true);
}));
test('deleting a person reindexes the remaining activity and attendance references',()=>withPage(async page=>{
 const date=await seed(page);await page.evaluate(d=>{db.labour.push({worker:'Remaining worker',rate:60});db.programmeActivities=[{id:'remaining',name:'Work',plannedStart:d,plannedFinish:d,workerIds:['labour:1'],workerEndDates:{'labour:1':programmeAddDays(d,2)}}];db.siteSnapshots=[{date:d,rows:[{sourceId:'labour:1',name:'Remaining worker',in:true,planned:8,actual:4}]}];purgePersonData('labour',0);persist()},date);
 assert.deepEqual(await page.evaluate(()=>db.programmeActivities[0].workerIds),['labour:0']);assert.equal(await page.evaluate(()=>db.siteSnapshots[0].rows[0].sourceId),'labour:0');assert.equal(await page.evaluate(()=>db.siteSnapshots[0].rows[0].actual),4);assert.ok(await page.evaluate(()=>db.programmeActivities[0].workerEndDates['labour:0']));
}));
test('date shifting handles Sydney daylight-saving transitions',()=>withPage(async page=>{
 assert.deepEqual(await page.evaluate(()=>[programmeAddDays('2026-10-03',2),programmeDayDiff('2026-10-03','2026-10-05')]),['2026-10-05',2]);
}));
test('person deletion preserves a different resource with the same displayed name',()=>withPage(async page=>{
 const date=await seed(page);await page.evaluate(d=>{db.trades[0].company='Zed';db.siteSnapshots=[{date:d,rows:[{sourceId:'labour:0',name:'Zed',in:true,actual:4},{sourceId:'trade:0',name:'Zed',in:true,actual:6}]}];db.daily=[{date:d,attendanceIds:'["labour:0","trade:0"]',attendanceHours:'{"labour:0":4,"trade:0":6}'}];purgePersonData('labour',0);persist()},date);
 assert.equal(await page.evaluate(()=>db.siteSnapshots[0].rows.length),1);assert.equal(await page.evaluate(()=>db.siteSnapshots[0].rows[0].actual),6);assert.equal(await page.evaluate(()=>db.daily[0].attendanceIds),'["trade:0"]');
}));
test('cloud client recovery and incoming updates preserve local edits (mock RPC)',()=>withPage(async page=>{
 await seed(page);
 const result=await page.evaluate(async()=>{
   cloudCode='TEST';lastCloudJson=JSON.stringify(db);siteSnapshotDirty=false;
   const remote=JSON.parse(lastCloudJson);remote.jobs[0].name='Remote updated job';sb={rpc:async()=>({data:remote,error:null})};await pullCloud();
   const incoming=db.jobs[0].name;clearTimeout(cloudPushTimer);db.jobs[0].name='Local pending edit';saveWorkspaceStore();await pullCloud();const pending=db.jobs[0].name;clearTimeout(cloudPushTimer);
   sb={rpc:async()=>{throw new Error('Simulated network failure')}};await pushCloud();const recovered=!cloudBusy;
   sb={rpc:async()=>({error:null})};await pushCloud();const saved=lastCloudJson===JSON.stringify(db);sb=null;cloudCode='';return{incoming,pending,recovered,saved};
 });
 assert.deepEqual(result,{incoming:'Remote updated job',pending:'Local pending edit',recovered:true,saved:true});await page.reload();assert.equal(await page.evaluate(()=>db.jobs[0].name),'Local pending edit');
}));

test('attendance picker, search and absence preserve people and actual hours',()=>withPage(async page=>{
 const date=await seed(page);await booking(page,date);await page.evaluate(d=>{setSiteDay(d);showSub('build','signin')},date);
 await page.evaluate(()=>setSiteAttendance(0,'absent'));assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].absent),true);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows()[0].actual),0);
 await page.locator('#siteAttendanceSearch').fill('no match');assert.equal(await page.locator('#siteSnapshotRows tr:visible').count(),0);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().length),1);
 await page.locator('#siteAttendanceSearch').fill('');await page.evaluate(()=>addSiteSnapshotRow());await page.locator('#sitePeopleSearch').fill('Alpha');await page.locator('#sitePeopleResults button').click();
 assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().length),2);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().find(r=>r.name==='Alpha Trade').actual),0);
 await page.evaluate(()=>addManualSiteSnapshotRow());await fill(page,'#siteManualDlg',{name:'Visitor Jane',position:'Inspector'});await page.locator('#siteManualDlg button[type="submit"]').click();
 assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().find(r=>r.name==='Visitor Jane').actual),0);await page.reload();assert.equal(await page.evaluate(d=>db.siteSnapshots.find(s=>s.date===d).rows.length,date),3);
}));
test('material search and status filters retain original edit indexes',()=>withPage(async page=>{
 await seed(page);await page.evaluate(()=>{db.materials=[{item:'Delivered timber',status:'Delivered',cost:20},{item:'Pending concrete',supplier:'Concrete Co',status:'Ordered',cost:30}];persist();showSub('build','materials')});
 assert.match(await page.locator('#materialsTable').innerText(),/Pending concrete/);assert.doesNotMatch(await page.locator('#materialsTable').innerText(),/Delivered timber/);
 await page.locator('#materialSearch').fill('Concrete Co');await page.locator('#materialsTable').getByRole('button',{name:'Edit Details',exact:true}).click();assert.equal(await page.locator('#dlg [name="item"]').inputValue(),'Pending concrete');await page.locator('#dlg').getByRole('button',{name:'Cancel',exact:true}).click();
 await page.locator('#materialSearch').fill('');await page.locator('[data-material-filter="complete"]').click();assert.match(await page.locator('#materialsTable').innerText(),/Delivered timber/);assert.equal(await page.evaluate(()=>db.materials.length),2);
}));
test('task responsibility and priority survive editing and reload',()=>withPage(async page=>{
 await seed(page);await page.evaluate(()=>openMyDayTask());await fill(page,'#taskDlg',{title:'Safety check',responsible:'Jane'});await page.locator('#taskDlg [name="priority"]').selectOption('Urgent');await page.locator('#taskDlg button[type="submit"]').click();
 assert.match(await page.locator('#myDayContent').innerText(),/Jane/);assert.match(await page.locator('#myDayContent').innerText(),/Urgent/);await page.reload();await page.evaluate(()=>openMyDayTask(db.tasks[0].id));assert.equal(await page.locator('#taskDlg [name="responsible"]').inputValue(),'Jane');assert.equal(await page.locator('#taskDlg [name="priority"]').inputValue(),'Urgent');
}));
for(const width of [360,390,430])test(`diary Save stays visible at ${width}px and in a short viewport`,()=>withPage(async page=>{
 await seed(page);await page.evaluate(()=>openDailyFormForSiteDay());assert.equal(await page.locator('#dlg .diary-additional').evaluate(el=>el.open),false);
 for(const height of [844,500]){await page.setViewportSize({width,height});const box=await page.locator('#dlg button[value="default"]').boundingBox();assert.ok(box.y>=0&&box.y+box.height<=height,JSON.stringify(box));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await fill(page,'#dlg',{completed:'Work recorded',delays:'Hidden field retained'});await saveGeneral(page);assert.equal(await page.evaluate(()=>db.daily[0].delays),'Hidden field retained');
},{mobile:true,viewport:{width,height:844}}));
test('Programme day shortcuts retain selected day and diary suggestions are explicit',()=>withPage(async page=>{
 const date=await seed(page);await activity(page,date);await page.evaluate(d=>openProgrammeDay(d),date);await page.locator('#programmeDayDlg').getByRole('button',{name:'Site Diary',exact:true}).click();assert.equal(await page.locator('#diaryDayPicker').inputValue(),date);
 await page.evaluate(()=>openDailyFormForSiteDay());assert.equal(await page.locator('#dlg [name="completed"]').inputValue(),'');await fill(page,'#dlg',{completed:'Existing draft'});await page.evaluate(()=>appendDiaryActivity(0));assert.equal(await page.locator('#dlg [name="completed"]').inputValue(),'Existing draft\nFrame construction');assert.equal(await page.evaluate(()=>db.daily.length),0);
}));
test('failed browser storage reports failure without a success message',()=>withPage(async page=>{
 await seed(page);const result=await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('Quota exceeded')};try{return persist('Completed successfully')}finally{Storage.prototype.setItem=original}});assert.equal(result,false);assert.match(await page.locator('#appFeedback').innerText(),/Could not save/);assert.doesNotMatch(await page.locator('#appFeedback').innerText(),/Completed successfully/);
}));

async function crewDay(page){return page.evaluate(()=>{
 const date=siteIsoDate(new Date()),previous=programmeAddDays(date,-1);db=blankWorkspace();db.jobs=[{name:'Large crew'}];
 db.labour=Array.from({length:40},(_,i)=>({worker:'Worker '+String(i+1).padStart(2,'0'),trade:i<10?'Formworkers':'Electricians',rate:50,planned:[],entries:[]}));db.trades=[{company:'Scheduled Plumbers',trade:'Plumbers'}];db.hire=[{item:'Crane',company:'Plant Co'}];
 db.programmeActivities=[{id:'crew',name:'Site work',plannedStart:date,plannedFinish:programmeAddDays(date,1),workDays:[0,1,2,3,4,5,6],workerIds:[...db.labour.map((_,i)=>'labour:'+i),'trade:0','hire:0']}];
 db.siteSnapshots=[{date:previous,rows:[{sourceId:'labour:0',name:'Worker 01',in:true,planned:8,actual:4,activity:'Yesterday'}]}];persist();setSiteDay(date);showSub('build','signin');return{date,previous};
})}
test('40-worker day plus a trade uses one bulk action, editable exceptions and Save Day',()=>withPage(async page=>{
 const {date,previous}=await crewDay(page);await page.locator('#siteMarkExpected').click();
 assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.in).length),41);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().find(r=>r.sourceId==='hire:0').actual),0);
 await page.evaluate(()=>{const rows=currentSiteSnapshotRows();const a=rows.findIndex(r=>r.sourceId==='labour:0'),b=rows.findIndex(r=>r.sourceId==='labour:1'),c=rows.findIndex(r=>r.sourceId==='labour:2');mobileSiteField(a,'actual',4);setSiteAttendance(b,'absent');mobileSiteField(c,'actual',10)});
 await page.locator('#siteSaveDay').click();const result=await page.evaluate(({date,previous})=>({today:db.siteSnapshots.find(s=>s.date===date),yesterday:db.siteSnapshots.find(s=>s.date===previous),hours:labourSiteEntries(db.labour[0]).find(e=>e.date===date).hours}),{date,previous});
 assert.equal(result.today.rows.filter(r=>r.in).length,40);assert.equal(result.today.rows.filter(r=>r.absent).length,1);assert.equal(result.today.rows.reduce((s,r)=>s+r.actual,0),318);assert.equal(result.yesterday.rows[0].actual,4);assert.equal(result.hours,4);assert.equal(result.today.rows.some(r=>'_selected'in r),false);assert.match(await page.locator('#appFeedback').innerText(),/40 present • 1 absent • 318 total hours/);
 await page.reload();assert.equal(await page.evaluate(d=>db.siteSnapshots.find(s=>s.date===d).rows.find(r=>r.sourceId==='labour:2').actual,date),10);
}));
test('bulk groups, hidden selections and overwrite protection work for large crews',()=>withPage(async page=>{
 await crewDay(page);await page.locator('#siteBulkGroup').selectOption('group:Formworkers');assert.match(await page.locator('#siteApplySelected').innerText(),/10 selected/);await page.locator('#siteBulkHours').fill('10');await page.locator('#siteAttendanceSearch').fill('Worker 01');await page.locator('#siteApplySelected').click();assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual===10).length),10);
 await page.getByRole('button',{name:'Select All',exact:true}).click();await page.locator('#siteBulkHours').fill('8');await page.locator('#siteApplySelected').click();assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual===10).length),10,'Existing exceptions are preserved');assert.match(await page.locator('#appFeedback').innerText(),/10 existing records kept/);
 await page.locator('#siteBulkPreserve').uncheck();page.removeAllListeners('dialog');page.once('dialog',dialog=>dialog.dismiss());await page.locator('#siteApplySelected').click();assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual===10).length),10,'Cancelled replacement makes no changes');
 page.once('dialog',dialog=>{assert.match(dialog.message(),/existing records/);dialog.accept()});await page.locator('#siteApplySelected').click();assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual===8).length),42);
 await page.getByRole('button',{name:'Clear Selection',exact:true}).click();assert.equal(await page.locator('#siteApplySelected').isDisabled(),true);
}));
test('standard hours are job-scoped and future expectations remain unrecorded',()=>withPage(async page=>{
 const {date}=await crewDay(page);await page.locator('#siteBulkHours').fill('10');await page.locator('#siteMarkExpected').click();await page.locator('#siteSaveDay').click();await page.evaluate(d=>setSiteDay(programmeAddDays(d,1)),date);assert.equal(await page.locator('#siteBulkHours').inputValue(),'10');assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.in||r.actual>0).length),0);
 const original=await page.locator('#jobWorkspaceSelect').inputValue();page.removeAllListeners('dialog');page.once('dialog',dialog=>dialog.accept('Different job'));await page.getByRole('button',{name:'+ New Job',exact:true}).click();await page.evaluate(()=>{showSub('build','signin');loadSiteSnapshot(siteIsoDate(new Date()))});assert.equal(await page.locator('#siteBulkHours').inputValue(),'8');await page.locator('#jobWorkspaceSelect').selectOption(original);assert.equal(await page.evaluate(()=>db.attendanceSettings.standardHours),10);
}));
for(const width of [360,390,430])test(`bulk attendance is touch usable for 40 workers at ${width}px`,()=>withPage(async page=>{
 await crewDay(page);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.locator('#siteMarkExpected').tap();const card=page.locator('[data-mobile-site-row]').filter({hasText:'Worker 01'});await card.getByLabel('Actual hours').fill('4');await page.locator('#siteSaveDay').tap();assert.equal(await page.evaluate(()=>db.siteSnapshots.find(s=>s.date===activeSiteSnapshotDate).rows.find(r=>r.sourceId==='labour:0').actual),4);
 const save=await page.locator('#siteSaveDay').boundingBox();assert.ok(save.y>=0&&save.y+save.height<=844);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
},{mobile:true,viewport:{width,height:844}}));
test('expected quick action excludes unexpected people; individual hours can correct absence',()=>withPage(async page=>{
 await crewDay(page);await page.evaluate(()=>{db.labour.push({worker:'Unexpected visitor',trade:'Surveyors'});const rows=currentSiteSnapshotRows();rows.push({...siteSnapshotBlank(siteSnapshotPeople().find(p=>p.name==='Unexpected visitor')),in:false,actual:0});renderSiteSnapshotRows(rows)});await page.locator('#siteMarkExpected').click();assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().find(r=>r.name==='Unexpected visitor').actual),0);
 await page.evaluate(()=>{const index=currentSiteSnapshotRows().findIndex(r=>r.sourceId==='labour:0');setSiteAttendance(index,'absent');mobileSiteField(index,'actual',4);saveSiteSnapshot(true)});const record=await page.evaluate(()=>db.siteSnapshots.find(s=>s.date===activeSiteSnapshotDate).rows.find(r=>r.sourceId==='labour:0'));assert.equal(record.in,true);assert.equal(record.absent,false);assert.equal(record.actual,4);
}));
for(const mobile of [false,true])test(`name selector isolates and selects the right attendance record on ${mobile?'phone':'desktop'}`,()=>withPage(async page=>{
 const {date}=await crewDay(page);const select=page.locator('#siteAttendanceName');const names=await select.locator('option').allTextContents();assert.deepEqual(names.slice(1),[...names.slice(1)].sort((a,b)=>a.localeCompare(b)));
 const value=await select.locator('option').filter({hasText:'Worker 07'}).getAttribute('value');await select.selectOption(value);assert.match(await page.locator('#siteAttendanceResults').innerText(),/1 of 42/);assert.match(await page.locator('#siteApplySelected').innerText(),/1 selected/);
 const visible=mobile?page.locator('[data-mobile-site-row]:visible'):page.locator('#siteSnapshotRows tr:visible');assert.equal(await visible.count(),1);await page.locator('#siteBulkHours').fill('6');await page.locator('#siteApplySelected').click();assert.equal(await visible.count(),1);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().find(r=>r.name==='Worker 07').actual),6);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual>0).length),1);
 await select.selectOption('');assert.equal(await visible.count(),42);await page.locator('#siteAttendanceSearch').fill('Worker 08');assert.equal(await visible.count(),1);await select.selectOption(value);assert.equal(await page.locator('#siteAttendanceSearch').inputValue(),'');
 await page.evaluate(d=>setSiteDay(programmeAddDays(d,1)),date);assert.equal(await select.inputValue(),'');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
},{mobile}));
for(const mobile of [false,true])test(`green hours action follows worker/group selection and blocks whole-day changes on ${mobile?'phone':'desktop'}`,()=>withPage(async page=>{
 await crewDay(page);assert.equal(await page.locator('#siteApplySelected').isDisabled(),true);assert.equal(await page.locator('#siteMarkExpected').isDisabled(),false);assert.equal(await page.locator('#siteMarkExpected').evaluate(el=>el.classList.contains('green')),false);
 const nameValue=await page.locator('#siteAttendanceName option').filter({hasText:'Worker 07'}).getAttribute('value');await page.locator('#siteAttendanceName').selectOption(nameValue);assert.match(await page.locator('#siteApplySelected').innerText(),/Apply 8h to 1 selected/);assert.equal(await page.locator('#siteMarkExpected').isDisabled(),true);assert.equal(await page.evaluate(()=>applyAttendanceBulk('expected')),false);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual>0).length),0);
 await page.locator('#siteApplySelected').click();assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().find(r=>r.name==='Worker 07').actual),8);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual>0).length),1);
 await page.locator('#siteAttendanceName').selectOption('');await page.locator('#siteBulkGroup').selectOption('group:Electricians');await page.locator('#siteBulkHours').fill('10');assert.match(await page.locator('#siteApplySelected').innerText(),/Apply 10h to 30 selected/);await page.locator('#siteApplySelected').click();assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().filter(r=>r.actual===10).length),30);assert.equal(await page.evaluate(()=>currentSiteSnapshotRows().find(r=>r.name==='Worker 07').actual),8);
 await page.getByRole('button',{name:'Clear Selection',exact:true}).click();assert.equal(await page.locator('#siteApplySelected').isDisabled(),true);assert.equal(await page.locator('#siteMarkExpected').isDisabled(),false);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
},{mobile}));
