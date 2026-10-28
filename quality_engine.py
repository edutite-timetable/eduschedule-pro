"""Independent timetable validation and quality scoring for EduSchedule Pro."""
from collections import Counter, defaultdict


def _as_int(v, default=0):
    try: return int(v)
    except (TypeError, ValueError): return default


def _pairs(values):
    out=set()
    for x in values or []:
        if isinstance(x,(list,tuple)) and len(x)>=2: out.add((str(x[0]),str(x[1])))
        elif isinstance(x,str):
            p=x.split('|',1)
            if len(p)==2: out.add((p[0],p[1]))
    return out


def analyze(config, timetable):
    working_days=list(config.get('workingDays',[]) or [])
    teachers=config.get('teachers',{}) or {}
    rules=config.get('rules',{}) or {}
    required=defaultdict(int); eligible=defaultdict(set); assignment_meta=[]
    for teacher,td in teachers.items():
        for a in td.get('assignments',[]) or []:
            g=str(a.get('grade')); s=str(a.get('streamIndex',0)); sub=str(a.get('subject',''))
            if g and sub and _as_int(a.get('lessons'))>0:
                n=max(0,_as_int(a.get('lessons'))); required[(g,s,sub)]+=n; eligible[(g,s,sub)].add(str(teacher)); assignment_meta.append((str(teacher),g,s,sub,n))
    teacher_slots=defaultdict(list); class_slots=defaultdict(list); subject_slots=defaultdict(list)
    errors=[]; warnings=[]; fillers=0; taught=0; invalid_teacher=[]; unavailable=[]; blacklisted=[]
    daily_subjects=defaultdict(list); daily_teacher=defaultdict(list)
    for ck,data in (timetable or {}).items():
        grade=str(data.get('grade')); stream=str(data.get('streamIndex',0))
        for day,slots in (data.get('days',{}) or {}).items():
            for idx,cell in enumerate(slots or []):
                if not cell or cell.get('isCommon'): continue
                if cell.get('isFiller'): fillers+=1; continue
                subject=str(cell.get('subject','')); teacher=str(cell.get('teacher',''))
                if not subject or not teacher:
                    errors.append({'type':'invalid_slot','class':ck,'day':day,'slot':idx+1}); continue
                taught+=1; teacher_slots[(teacher,day,idx)].append((ck,subject)); class_slots[(ck,day,idx)].append((subject,teacher)); subject_slots[(ck,subject)].append((day,idx,teacher)); daily_subjects[(ck,day)].append(subject); daily_teacher[(teacher,day)].append(ck)
                if teacher not in eligible.get((grade,stream,subject),set()): invalid_teacher.append({'class':ck,'grade':grade,'streamIndex':stream,'subject':subject,'teacher':teacher,'day':day,'slot':idx+1})
                td=teachers.get(teacher,{})
                if day in set(td.get('unavailDays',[]) or []): unavailable.append({'teacher':teacher,'day':day,'class':ck,'slot':idx+1})
                if (ck,subject) in _pairs(config.get('subjectBlacklist')) or (grade,subject) in _pairs(config.get('subjectBlacklist')): blacklisted.append({'class':ck,'grade':grade,'subject':subject,'day':day,'slot':idx+1})
                if (ck,teacher) in _pairs(config.get('blacklist')) or (grade,teacher) in _pairs(config.get('blacklist')): blacklisted.append({'class':ck,'grade':grade,'teacher':teacher,'day':day,'slot':idx+1})
    teacher_clashes=[{'teacher':t,'day':d,'slot':s+1,'classes':[x[0] for x in e]} for (t,d,s),e in teacher_slots.items() if len(e)>1]
    class_clashes=[{'class':c,'day':d,'slot':s+1} for (c,d,s),e in class_slots.items() if len(e)>1]
    teacher_load=Counter(); teacher_daily=defaultdict(Counter)
    for (t,d,_),e in teacher_slots.items():
        if e: teacher_load[t]+=1; teacher_daily[t][d]+=1
    overloaded=[]
    for t,td in teachers.items():
        mx=td.get('maxLessons'); dailymax=_as_int(td.get('maxPerDay',rules.get('maxTeacherPerDay',8)),8)
        if mx is not None and teacher_load[t]>_as_int(mx): overloaded.append({'teacher':t,'assigned':teacher_load[t],'maximum':_as_int(mx)})
        for d,n in teacher_daily[t].items():
            if n>dailymax: overloaded.append({'teacher':t,'day':d,'assigned':n,'maximumPerDay':dailymax})
    same=[]; consecutive=[]
    for ck,data in (timetable or {}).items():
        for day,slots in (data.get('days',{}) or {}).items():
            for i in range(1,len(slots or [])):
                a,b=slots[i-1],slots[i]
                if a and b and not a.get('isCommon') and not b.get('isCommon') and not a.get('isFiller') and not b.get('isFiller'):
                    if a.get('subject')==b.get('subject'): same.append({'class':ck,'day':day,'slot':i+1,'subject':a.get('subject')})
    for (t,d,s),e in teacher_slots.items():
        if (t,d,s-1) in teacher_slots: consecutive.append({'teacher':t,'day':d,'slot':s+1})
    missing=[]
    for key,req in required.items():
        g,stream,sub=key; actual=sum(len(subject_slots.get((ck,sub),[])) for ck,x in (timetable or {}).items() if str(x.get('grade'))==g and str(x.get('streamIndex',0))==stream)
        if actual<req: missing.append({'grade':g,'streamIndex':stream,'subject':sub,'required':req,'assigned':actual,'missing':req-actual})
    free_days=[]
    for ck,data in (timetable or {}).items():
        taught_days={d for d,slots in (data.get('days',{}) or {}).items() if any(c and not c.get('isCommon') and not c.get('isFiller') for c in slots or [])}
        total=sum(1 for slots in (data.get('days',{}) or {}).values() for c in slots or [] if c and not c.get('isCommon') and not c.get('isFiller'))
        if total>=len(working_days) and any(d not in taught_days for d in working_days): free_days.append({'class':ck,'daysWithoutLessons':[d for d in working_days if d not in taught_days]})
    distribution=[]
    for (ck,day),subs in daily_subjects.items():
        counts=Counter(subs)
        if any(n>2 for n in counts.values()): distribution.append({'class':ck,'day':day,'repeatedSubjects':{s:n for s,n in counts.items() if n>2}})
    fairness=[]
    loads=[n for t,n in teacher_load.items() if t in teachers and not teachers[t].get('isSpecial')]
    if loads:
        avg=sum(loads)/len(loads); fairness=[{'teacher':t,'assigned':n,'delta':round(n-avg,1)} for t,n in sorted(teacher_load.items(),key=lambda x:x[1],reverse=True) if abs(n-avg)>max(3,avg*.25)]
    total_required=sum(required.values()); total_missing=sum(x['missing'] for x in missing); completeness=max(0,min(1,1-total_missing/max(1,total_required))) if required else 1.0
    total_cells=sum(len(slots or []) for d in (timetable or {}).values() for slots in d.get('days',{}).values()); packing=max(0,1-fillers/max(1,total_cells))
    hard_errors=len(errors)+len(teacher_clashes)+len(class_clashes)+len(invalid_teacher)+len(unavailable)+len(blacklisted)
    errors.extend([{'type':'teacher_clash','count':len(teacher_clashes)}] if teacher_clashes else [])
    errors.extend([{'type':'class_clash','count':len(class_clashes)}] if class_clashes else [])
    errors.extend([{'type':'ineligible_teacher','count':len(invalid_teacher)}] if invalid_teacher else [])
    errors.extend([{'type':'teacher_unavailable','count':len(unavailable)}] if unavailable else [])
    errors.extend([{'type':'blacklist_violation','count':len(blacklisted)}] if blacklisted else [])
    if missing: warnings.append({'type':'missing_lessons','count':total_missing})
    if overloaded: warnings.append({'type':'teacher_overload','count':len(overloaded)})
    if free_days: warnings.append({'type':'free_working_day','count':len(free_days)})
    if distribution: warnings.append({'type':'subject_distribution','count':len(distribution)})
    if fairness: warnings.append({'type':'load_fairness','count':len(fairness)})
    score=max(0,min(100,completeness*70+packing*20+max(0,10-len(same)*.5-len(consecutive)*.25-len(fairness)*.2)))
    label='Critical' if hard_errors else ('Needs Review' if completeness<.9 else ('Good' if score<90 else ('Very Good' if score<97 else 'Excellent')))
    return {'valid':hard_errors==0 and total_missing==0,'label':label,'score':round(score,1),'completeness':round(completeness,3),'packing':round(packing,3),'taughtLessons':taught,'fillers':fillers,'errors':errors[:200],'warnings':warnings[:200],'teacherClashes':teacher_clashes[:100],'classClashes':class_clashes[:100],'missingLessons':missing[:100],'overloadedTeachers':overloaded[:100],'teacherConsecutive':consecutive[:100],'sameSubjectConsecutive':same[:100],'freeWorkingDays':free_days[:100],'ineligibleTeachers':invalid_teacher[:100],'teacherUnavailable':unavailable[:100],'blacklistViolations':blacklisted[:100],'distributionIssues':distribution[:100],'fairnessIssues':fairness[:100],'teacherLoad':dict(teacher_load),'teacherDailyLoad':{t:dict(v) for t,v in teacher_daily.items()}}
