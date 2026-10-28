"""EduSchedule Pro runtime improvements, exhaustive validation, feasibility and auto-repair."""
import logging, os, copy
log=logging.getLogger(__name__)
try:
 import app as _app
 from quality_engine import analyze as _analyze
 ModelBuilder=_app.ModelBuilder
 original_add_soft=ModelBuilder.add_soft; original_add_hard=ModelBuilder.add_hard
 def improved_add_hard(self):
  original_add_hard(self)
  for cg in self.class_groups:
   ck=cg['key']; required=sum(self.idx.class_required.get((cg['grade'],cg['stream_index']),{}).values())
   if required<self.num_days: continue
   for d in range(self.num_days):
    vals=[]
    for s in range(self.num_slots):
     if self._is_common_slot(d,s): continue
     for tv in self.x[ck][d][s].values(): vals.extend(tv.values())
    if vals:
     v=self.model.NewBoolVar(f'has_day_{ck}_{d}'); self.model.Add(sum(vals)>=1).OnlyEnforceIf(v); self.model.Add(sum(vals)==0).OnlyEnforceIf(v.Not()); self.penalties.append((v.Not(),25000,f'G{cg["grade"]} {cg["stream_name"]}: free working day d{d}'))
 def improved_add_soft(self):
  original_add_soft(self)
  for t in self.teachers:
   for d in range(self.num_days):
    for s in range(self.num_slots-1):
     a=[];b=[]
     for cg in self.class_groups:
      x=self.x[cg['key']][d]; a.extend(x[s].get(t,{}).values()); b.extend(x[s+1].get(t,{}).values())
     if a and b:
      v=self.model.NewBoolVar(f'teach_consec_{t}_{d}_{s}'); self.model.Add(v<=sum(a)); self.model.Add(v<=sum(b)); self.model.Add(v>=sum(a)+sum(b)-1); self.penalties.append((v,2200,f'{t}: consecutive lessons d{d} s{s+1}'))
  for cg in self.class_groups:
   ck=cg['key']
   for si,sub in enumerate(self.subjects):
    for d in range(self.num_days):
     for s in range(self.num_slots-1):
      a=[tv[sub] for tv in self.x[ck][d][s].values() if sub in tv]; b=[tv[sub] for tv in self.x[ck][d][s+1].values() if sub in tv]
      if a and b:
       v=self.model.NewBoolVar(f'same_sub_{ck}_{d}_{s}_{si}'); self.model.Add(v<=sum(a)); self.model.Add(v<=sum(b)); self.model.Add(v>=sum(a)+sum(b)-1); self.penalties.append((v,900,f'G{cg["grade"]} {cg["stream_name"]}: {sub} consecutive'))
     daily=[v for day,_s,_t,v in self.idx.var_index[ck][sub] if day==d]
     if len(daily)>1:
      v=self.model.NewIntVar(0,len(daily),f'same_day_{ck}_{si}_{d}'); self.model.Add(v>=sum(daily)-1); self.penalties.append((v,700,f'G{cg["grade"]} {cg["stream_name"]}: repeated {sub}'))
 ModelBuilder.add_hard=improved_add_hard; ModelBuilder.add_soft=improved_add_soft
 _original_run_solver=_app.run_solver; _max_workers=max(1,int(os.getenv('EDUSCHEDULE_SOLVER_WORKERS','4')))
 def improved_run_solver(config,timeout=300.0,workers=8,cid='?',progress=None):
  result=_original_run_solver(config,timeout=timeout,workers=min(max(1,int(workers)),_max_workers),cid=cid,progress=progress)
  if result.get('success') and result.get('timetable'):
   try:
    d=_analyze(config,result['timetable']); result['diagnostics']=d; result['quality']={'completeness':d['completeness'],'packing':d['packing'],'label':d['label'],'verified':d['valid'],'score':d['score']}
   except Exception: log.exception('Post-solve diagnostics failed')
  return result
 _app.run_solver=improved_run_solver
 def _lesson_count(config): return len([s for s in config.get('timeSlots',[]) if s.get('type')=='lesson'])
 def _teacher_unavailable(config,t,d): return d in set((config.get('teachers',{}).get(t,{}) or {}).get('unavailDays',[]) or [])
 def _pairs(values):
  out=set()
  for x in values or []:
   if isinstance(x,(list,tuple)) and len(x)>=2: out.add((str(x[0]),str(x[1])))
   elif isinstance(x,str) and '|' in x: out.add(tuple(x.split('|',1)))
  return out
 def _occupied(tt,day,slot,ignore=None):
  out=[]
  for ck,data in tt.items():
   if ck==ignore: continue
   arr=(data.get('days',{}) or {}).get(day) or []; c=arr[slot] if 0<=slot<len(arr) else None
   if c and not c.get('isFiller') and not c.get('isCommon'): out.append((ck,c))
  return out
 def _lesson(config,tt,ck,day,slot):
  arr=(tt.get(ck,{}).get('days',{}) or {}).get(day) or []
  return arr[slot] if 0<=slot<len(arr) else None
 def _legal(config,tt,ck,day,slot,lesson):
  if lesson is None: return False,[]
  teacher=lesson.get('teacher'); reasons=[]
  if _teacher_unavailable(config,teacher,day): return False,['Teacher unavailable']
  if _occupied(tt,day,slot,ignore=ck):
   if any(c.get('teacher')==teacher for _,c in _occupied(tt,day,slot,ignore=ck)): return False,['Teacher clash']
   return False,['Class period occupied']
  grade=str(tt.get(ck,{}).get('grade')); subject=str(lesson.get('subject',''))
  stream=str(tt.get(ck,{}).get('streamIndex',0))
  assignments=(config.get('teachers',{}).get(teacher,{}) or {}).get('assignments',[]) or []
  eligible=any(str(a.get('grade'))==grade and str(a.get('streamIndex',0))==stream and str(a.get('subject'))==subject for a in assignments)
  if not eligible: return False,['Teacher is not assigned to this subject/class']
  if (ck,teacher) in _pairs(config.get('blacklist')) or (grade,teacher) in _pairs(config.get('blacklist')): return False,['Teacher blacklist violation']
  if (ck,subject) in _pairs(config.get('subjectBlacklist')) or (grade,subject) in _pairs(config.get('subjectBlacklist')): return False,['Subject blacklist violation']
  arr=(tt.get(ck,{}).get('days',{}) or {}).get(day) or []
  penalty=0
  if any(c and c.get('subject')==subject and not c.get('isFiller') for c in arr): reasons.append('Subject already taught that day'); penalty+=35
  if slot>0 and arr[slot-1] and arr[slot-1].get('subject')==subject: reasons.append('Same subject adjacent'); penalty+=25
  if slot+1<len(arr) and arr[slot+1] and arr[slot+1].get('subject')==subject: reasons.append('Same subject adjacent'); penalty+=25
  if any(c and c.get('teacher')==teacher for c in arr): reasons.append('Teacher already teaches this day'); penalty+=15
  return True,(reasons,penalty)
 def _repair_candidates(config,tt,ck,sd,ss,limit=10):
  lesson=_lesson(config,tt,ck,sd,ss); candidates=[]; days=config.get('workingDays',[]) or []; n=_lesson_count(config)
  for d in days:
   for s in range(n):
    if d==sd and s==ss: continue
    if _lesson(config,tt,ck,d,s) is not None: continue
    ok,info=_legal(config,tt,ck,d,s,lesson)
    if not ok: continue
    reasons,penalty=info; penalty+=abs(s-(n-1)/2)*2; candidates.append({'day':d,'slot':s,'score':round(100-penalty,1),'reasons':reasons})
  candidates.sort(key=lambda x:(-x['score'],x['day'],x['slot'])); return candidates[:limit]
 def _safe_move(config,tt,ck,sd,ss,td,ts):
  cp=copy.deepcopy(tt); src=((cp.get(ck,{}).get('days',{}) or {}).get(sd) or []); dst=((cp.get(ck,{}).get('days',{}) or {}).get(td) or [])
  lesson=src[ss] if 0<=ss<len(src) else None
  if not lesson: return False,'Source lesson not found',cp
  if ts<0 or ts>=len(dst) or dst[ts] is not None: return False,'Target period is occupied or invalid',cp
  ok,info=_legal(config,cp,ck,td,ts,lesson)
  if not ok: return False,info[0],cp
  src[ss]=None; dst[ts]=lesson
  d=_analyze(config,cp)
  if not d.get('valid'): return False,'Move failed full timetable validation',tt
  return True,'Move validated successfully',cp
 @_app.app.get('/api/healthz')
 def _healthz(): return {'status':'ok','service':'EduSchedule Pro','solver':'Google OR-Tools CP-SAT','solverWorkersMax':_max_workers},200
 @_app.app.post('/api/analyze')
 def _analyze_route():
  from flask import request,jsonify
  b=request.get_json(force=True,silent=True) or {}; c=b.get('config');t=b.get('timetable')
  if not c or not t:return jsonify({'success':False,'message':'config and timetable are required'}),400
  return jsonify({'success':True,'diagnostics':_analyze(c,t)})
 @_app.app.post('/api/preflight')
 def _preflight():
  from flask import request,jsonify
  c=request.get_json(force=True,silent=True) or {}; teachers=c.get('teachers',{}) or {}; days=len(c.get('workingDays',[]) or []); slots=_lesson_count(c); capacity=days*slots; issues=[]; warnings=[]
  for t,td in teachers.items():
   assigned=sum(max(0,int(a.get('lessons',0) or 0)) for a in td.get('assignments',[]) or []); mx=td.get('maxLessons')
   if mx is not None and assigned>int(mx): issues.append({'type':'teacher_capacity','teacher':t,'required':assigned,'maximum':int(mx)})
   unavailable=len(set(td.get('unavailDays',[]) or [])); available=max(0,days-unavailable)*min(slots,int(td.get('maxPerDay',slots) or slots))
   if assigned>available: issues.append({'type':'teacher_availability','teacher':t,'required':assigned,'available':available})
  for ck,req in (c.get('classRequirements',{}) or {}).items():
   total=sum(max(0,int(v or 0)) for v in (req.values() if isinstance(req,dict) else []))
   if total>capacity: issues.append({'type':'class_capacity','class':ck,'required':total,'capacity':capacity})
  return jsonify({'success':True,'feasible':not issues,'issues':issues,'warnings':warnings,'capacityPerClass':capacity})
 @_app.app.post('/api/repair/suggestions')
 def _repair_suggestions():
  from flask import request,jsonify
  b=request.get_json(force=True,silent=True) or {}; c=b.get('config');t=b.get('timetable');m=b.get('move') or {}
  if not c or not t or any(m.get(x) is None for x in ('classKey','day','slot')): return jsonify({'success':False,'message':'Incomplete repair request'}),400
  return jsonify({'success':True,'suggestions':_repair_candidates(c,t,str(m['classKey']),str(m['day']),int(m['slot']))})
 @_app.app.post('/api/repair/move')
 def _repair_move():
  from flask import request,jsonify
  b=request.get_json(force=True,silent=True) or {}; c=b.get('config');t=b.get('timetable');m=b.get('move') or {}
  if not c or not t or any(m.get(x) is None for x in ('classKey','fromDay','fromSlot','toDay','toSlot')): return jsonify({'success':False,'message':'Incomplete move request'}),400
  ck=str(m['classKey']); sd=str(m['fromDay']); ss=int(m['fromSlot']); td=str(m['toDay']); ts=int(m['toSlot']); ok,msg,tt=_safe_move(c,t,ck,sd,ss,td,ts)
  if not ok:return jsonify({'success':False,'message':msg,'suggestions':_repair_candidates(c,t,ck,sd,ss)}),409
  return jsonify({'success':True,'message':msg,'timetable':tt,'diagnostics':_analyze(c,tt)})
 @_app.app.post('/api/repair/auto')
 def _auto_repair():
  from flask import request,jsonify
  b=request.get_json(force=True,silent=True) or {}; c=b.get('config'); original=b.get('timetable'); max_steps=min(10,max(1,int(b.get('maxSteps',5))))
  if not c or not original:return jsonify({'success':False,'message':'config and timetable are required'}),400
  tt=copy.deepcopy(original); history=[]
  for _ in range(max_steps):
   d=_analyze(c,tt)
   if d.get('valid'): break
   candidates=[]
   for ck,data in tt.items():
    for day,arr in (data.get('days',{}) or {}).items():
     for slot,cell in enumerate(arr or []):
      if cell and not cell.get('isFiller') and not cell.get('isCommon'):
       for target in _repair_candidates(c,tt,ck,day,slot,limit=3): candidates.append((target['score'],ck,day,slot,target['day'],target['slot']))
   candidates.sort(reverse=True)
   moved=False
   for score,ck,sd,ss,td,ts in candidates[:30]:
    ok,msg,newtt=_safe_move(c,tt,ck,sd,ss,td,ts)
    if ok:
     before=d.get('score',0); after=_analyze(c,newtt).get('score',0)
     if after>=before:
      tt=newtt; history.append({'classKey':ck,'fromDay':sd,'fromSlot':ss,'toDay':td,'toSlot':ts,'scoreBefore':before,'scoreAfter':after}); moved=True; break
   if not moved: break
  final=_analyze(c,tt)
  return jsonify({'success':True,'timetable':tt,'diagnostics':final,'history':history,'improved':final.get('score',0)>=_analyze(c,original).get('score',0)})
except Exception: log.exception('EduSchedule Pro runtime improvements could not be loaded')
