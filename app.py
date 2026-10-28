"""
EduSchedule Pro Backend — Version 8.1.0
Bulletproof generator: strict max-2 reduction, always full timetable, quality metrics.
"""

from __future__ import annotations

import json, sys, time, uuid, signal, logging, hashlib, threading, copy
from collections import defaultdict
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Generator, List, Optional, Set, Tuple

from flask import Flask, Response, request, jsonify, stream_with_context
from flask_cors import CORS
from ortools.sat.python import cp_model

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler(sys.stderr)],
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

_metrics: Dict[str, int | float] = defaultdict(int)
_metrics_lock = threading.Lock()

def inc(key: str, n: int | float = 1) -> None:
    with _metrics_lock:
        _metrics[key] += n

class _Entry:
    __slots__ = ("value", "ts")
    def __init__(self, value, ts):
        self.value = value; self.ts = ts

class SolutionCache:
    def __init__(self, max_size=500, ttl=3600.0):
        self._store: Dict[str, _Entry] = {}
        self._order: list[str] = []
        self._max = max_size; self._ttl = ttl
        self._lock = threading.Lock()

    def _key(self, config: Dict) -> str:
        return hashlib.sha256(
            json.dumps(config, sort_keys=True, default=str).encode()
        ).hexdigest()

    def get(self, config: Dict):
        k = self._key(config)
        with self._lock:
            e = self._store.get(k)
            if not e or (time.time() - e.ts > self._ttl):
                return None
            if k in self._order:
                self._order.remove(k); self._order.append(k)
            return e.value

    def put(self, config: Dict, result: Dict):
        k = self._key(config)
        with self._lock:
            if k in self._store:
                self._order.remove(k)
            elif len(self._store) >= self._max:
                oldest = self._order.pop(0); del self._store[oldest]
            self._store[k] = _Entry(result, time.time())
            self._order.append(k)

    def stats(self):
        with self._lock:
            return {"size": len(self._store), "max": self._max, "ttl": self._ttl}

_cache = SolutionCache()

class Severity(str, Enum):
    CRITICAL = "Critical"; HIGH = "High"; MEDIUM = "Medium"; LOW = "Low"

@dataclass
class Violation:
    description: str; severity: Severity; value: int; penalty: int; coverage_pct: float = 0.0
    def to_dict(self):
        return {"description": self.description, "severity": self.severity.value,
                "value": self.value, "penalty": self.penalty,
                "coveragePct": round(self.coverage_pct,1)}

@dataclass
class SolverStats:
    total_variables: int = 0; total_constraints: int = 0; solve_time: float = 0.0
    status: str = "UNKNOWN"; optimal: bool = False; wall_time: float = 0.0
    branches: int = 0; objective: int = 0; fillers: int = 0; missing: int = 0
    def to_dict(self):
        return {"totalVariables": self.total_variables,
                "totalConstraints": self.total_constraints,
                "solveTime": round(self.solve_time,3), "status": self.status,
                "optimal": self.optimal, "wallTime": round(self.wall_time,3),
                "branches": self.branches, "objective": self.objective,
                "fillers": self.fillers, "missing": self.missing}

_REQUIRED_TOP = ("grades","subjects","teachers","timeSlots","workingDays")

def validate_config(c):
    errors = []
    if not isinstance(c, dict): return False, "JSON object required", []
    for f in _REQUIRED_TOP:
        if f not in c: errors.append({"field":f,"error":f"Missing '{f}'"})
    if errors: return False, "Validation failed", errors
    if not c["grades"]: errors.append({"field":"grades","error":"Empty"})
    if not c["subjects"]: errors.append({"field":"subjects","error":"Empty"})
    if not c["teachers"]: errors.append({"field":"teachers","error":"Empty"})
    lesson_slots = [s for s in c.get("timeSlots",[]) if s.get("type")=="lesson"]
    if not lesson_slots: errors.append({"field":"timeSlots","error":"No lesson slots"})
    if not c.get("workingDays"): errors.append({"field":"workingDays","error":"Empty"})
    if errors: return False, "Validation failed", errors
    return True, None, []

def preprocess_config(c):
    c = json.loads(json.dumps(c))
    bl = set(c.get("blacklist",[])); sb = set(c.get("subjectBlacklist",[]))
    for t,td in c["teachers"].items():
        td["assignments"] = [a for a in td.get("assignments",[])
                             if f"{t}|{a.get('grade')}" not in bl
                             and f"{a.get('subject')}|{a.get('grade')}" not in sb]
    return c

@dataclass
class ScheduleIndex:
    teacher_assignments: Dict[str, List[Dict]] = field(default_factory=dict)
    required_lessons: Dict[Tuple[int,str], int] = field(default_factory=dict)
    teacher_avail_days: Dict[str, Set[int]] = field(default_factory=dict)
    var_index: Dict = field(default_factory=lambda: defaultdict(lambda: defaultdict(list)))
    teacher_var_index: Dict = field(default_factory=lambda: defaultdict(list))
    class_required: Dict[Tuple[int,int], Dict[str,int]] = field(default_factory=dict)

    def build(self, config, working_days):
        teachers = config["teachers"]
        subjects = [s[0] if isinstance(s,(list,tuple)) else s for s in config["subjects"]]
        bl = set(config.get("blacklist",[])); sb = set(config.get("subjectBlacklist",[]))
        for t,td in teachers.items():
            ua = set(td.get("unavailDays",[]))
            self.teacher_avail_days[t] = {i for i,d in enumerate(working_days) if d not in ua}
            self.teacher_assignments[t] = [a for a in td.get("assignments",[])
                                          if f"{t}|{a.get('grade')}" not in bl
                                          and f"{a.get('subject')}|{a.get('grade')}" not in sb]
        for g in sorted(int(g) for g in config["grades"]):
            for s in subjects:
                total = 0
                for t,assigns in self.teacher_assignments.items():
                    for a in assigns:
                        if int(a.get("grade",0))==g and a.get("subject")==s:
                            total += int(a.get("lessons",0))
                self.required_lessons[(g,s)] = total

        self.class_required = defaultdict(lambda: defaultdict(int))
        for t,assigns in self.teacher_assignments.items():
            for a in assigns:
                g = int(a.get("grade", 0))
                si = int(a.get("streamIndex", 0))
                sub = a.get("subject")
                self.class_required[(g, si)][sub] += int(a.get("lessons", 0))

class SolveProgressCallback(cp_model.CpSolverSolutionCallback):
    def __init__(self, queue):
        super().__init__(); self._queue = queue; self._start = time.time()
    def on_solution_callback(self):
        self._queue.append({
            "type": "solution",
            "objective": int(self.ObjectiveValue()),
            "bound": int(self.BestObjectiveBound()),
            "elapsed": round(time.time()-self._start,2)
        })

class ModelBuilder:
    W_MISSING_LESSON  = 1_000_000
    W_FILLER          = 400_000
    W_WEEKLY_OVERLOAD = 50_000
    W_BACK_TO_BACK    = 15_000
    W_DAILY_OVERLOAD  = 10_000
    W_DAILY_PRIORITY  = 300

    def __init__(self, config, cid="?"):
        self.config = config; self.cid = cid
        self.model = cp_model.CpModel(); self.stats = SolverStats()
        r = config.get("rules",{})
        self.grades = sorted(int(g) for g in config["grades"])
        self.subjects = [s[0] if isinstance(s,(list,tuple)) else s for s in config["subjects"]]
        self.high_priority = set(config.get("highPrioritySubjects",[]))
        self.teachers = config["teachers"]
        self.time_slots = config.get("timeSlots",[])
        self.working_days = config.get("workingDays",["MON","TUE","WED","THU","FRI"])
        self.target_grades = config.get("targetGrades", self.grades)
        self.grade_streams = config.get("gradeStreams",{})
        self.grade_stream_names = config.get("gradeStreamNames",{})
        self.common_session = config.get("commonSession",{"enabled":False})
        self.filler_label = config.get("fillerLabel", "Study Period")
        self.global_max_per_day = int(r.get("maxTeacherPerDay",8))
        self.blacklist = set(config.get("blacklist", []))
        self.subject_blacklist = set(config.get("subjectBlacklist", []))
        self.lesson_slots = [s for s in self.time_slots if s.get("type")=="lesson"]
        self.num_slots = len(self.lesson_slots)
        self.num_days = len(self.working_days)
        if self.num_slots==0: raise ValueError("No lesson slots")
        if self.num_days==0: raise ValueError("No working days")
        self.class_groups = self._build_groups()
        self.idx = ScheduleIndex(); self.idx.build(config, self.working_days)
        self.x: Dict = {}; self.fillers: Dict = {}
        self.penalties: List = []; self.teacher_total: Dict = {}
        self._create_vars()

    def _build_groups(self):
        gs = []
        for g in self.target_grades:
            streams = int(self.grade_streams.get(str(g),1))
            names = self.grade_stream_names.get(str(g),[])
            for si in range(streams):
                gs.append({"grade":g,"stream_index":si,
                           "stream_name":names[si] if si<len(names) else f"Stream {chr(65+si)}",
                           "key":f"{g}_{si}"})
        return gs

    def _is_common_slot(self, day_idx, slot_idx):
        cs = self.common_session
        if not cs.get("enabled"): return False
        return (self.working_days[day_idx] == cs.get("day")
                and slot_idx == int(cs.get("slotIndex", 0)))

    def _create_vars(self):
        vc = 0; fc = 0
        for cg in self.class_groups:
            ck, grade, si = cg["key"], cg["grade"], cg["stream_index"]
            self.x[ck] = {}
            self.fillers[ck] = {}
            for d in range(self.num_days):
                self.x[ck][d] = {}
                self.fillers[ck][d] = {}
                for s in range(self.num_slots):
                    if self._is_common_slot(d, s):
                        continue
                    self.x[ck][d][s] = {}
                    self.fillers[ck][d][s] = self.model.NewBoolVar(f"fill_{ck}_{d}_{s}")
                    fc += 1
                    for t, td in self.teachers.items():
                        if d not in self.idx.teacher_avail_days[t]: continue
                        for a in self.idx.teacher_assignments[t]:
                            if int(a.get("grade",0)) != grade: continue
                            if a.get("streamIndex") is not None and int(a["streamIndex"]) != si: continue
                            sub = a.get("subject")
                            if not sub: continue
                            sv = self.x[ck][d][s].setdefault(t,{})
                            sv[sub] = self.model.NewBoolVar(f"x_{ck}_{d}_{s}_{t}_{sub}")
                            vc += 1
                            self.idx.var_index[ck][sub].append((d,s,t,sv[sub]))
                            self.idx.teacher_var_index[t].append((ck,d,s,sub,sv[sub]))
        self.stats.total_variables = vc + fc
        self.stats.fillers = fc
        logger.info("[%s] Variables: %d lessons, %d fillers", self.cid, vc, fc)

    def add_hard(self):
        ct = 0
        for cg in self.class_groups:
            ck = cg["key"]
            for d in range(self.num_days):
                for s in range(self.num_slots):
                    if self._is_common_slot(d, s): continue
                    sv = [v for tv in self.x[ck][d][s].values() for v in tv.values()]
                    self.model.Add(sum(sv) + self.fillers[ck][d][s] == 1); ct += 1
        for t in self.teachers:
            for d in range(self.num_days):
                for s in range(self.num_slots):
                    tv = [v for cg in self.class_groups
                          for v in self.x[cg["key"]][d][s].get(t,{}).values()]
                    if tv:
                        self.model.Add(sum(tv) <= 1); ct += 1
        self.stats.total_constraints = ct

    def add_soft(self):
        for cg in self.class_groups:
            ck, grade, sn = cg["key"], cg["grade"], cg["stream_name"]
            stream_req = self.idx.class_required.get((grade, cg["stream_index"]), {})
            for sub in self.subjects:
                req = stream_req.get(sub, 0)
                if req == 0: continue
                sv = [v for _,_,_,v in self.idx.var_index[ck][sub]]
                if not sv:
                    sh = self.model.NewIntVar(0, req, f"sh_{ck}_{sub}")
                    self.model.Add(sh == req)
                    self.penalties.append((sh, self.W_MISSING_LESSON,
                                           f"G{grade} {sn}: no teacher for {sub}"))
                    continue
                sh = self.model.NewIntVar(0, req, f"sh_{ck}_{sub}")
                self.model.Add(sum(sv) + sh == req)
                self.penalties.append((sh, self.W_MISSING_LESSON,
                                       f"G{grade} {sn}: missing {sub}"))

        for cg in self.class_groups:
            ck, grade, sn = cg["key"], cg["grade"], cg["stream_name"]
            for d in range(self.num_days):
                for s in range(self.num_slots):
                    if self._is_common_slot(d, s): continue
                    self.penalties.append((
                        self.fillers[ck][d][s],
                        self.W_FILLER,
                        f"G{grade} {sn}: filler {self.working_days[d]} s{s+1}"
                    ))

        for cg in self.class_groups:
            ck, grade, sn = cg["key"], cg["grade"], cg["stream_name"]
            for sub in self.subjects:
                if sub not in self.high_priority: continue
                stream_req = self.idx.class_required.get((grade, cg["stream_index"]), {})
                if stream_req.get(sub, 0) == 0: continue
                for d in range(self.num_days):
                    daily_vars = [v for (day,s,t,v) in self.idx.var_index[ck][sub] if day==d]
                    if not daily_vars: continue
                    taught_today = self.model.NewBoolVar(f"pri_{ck}_{sub}_{d}")
                    self.model.Add(sum(daily_vars) >= 1).OnlyEnforceIf(taught_today)
                    self.model.Add(sum(daily_vars) == 0).OnlyEnforceIf(taught_today.Not())
                    slack = self.model.NewIntVar(0, 1, f"pslack_{ck}_{sub}_{d}")
                    self.model.Add(1 - taught_today == slack)
                    self.penalties.append((slack, self.W_DAILY_PRIORITY,
                                           f"G{grade} {sn}: {sub} not daily d{d}"))

        for t,td in self.teachers.items():
            if td.get("isSpecial"): continue
            mpd = int(td.get("maxPerDay", self.global_max_per_day))
            daily = defaultdict(list)
            for _,d,_,_,v in self.idx.teacher_var_index[t]: daily[d].append(v)
            for d,dv in daily.items():
                if not dv: continue
                ol = self.model.NewIntVar(0, len(dv), f"dol_{t}_{d}")
                self.model.Add(sum(dv) <= mpd + ol)
                self.penalties.append((ol, self.W_DAILY_OVERLOAD,
                                       f"{t}: daily overload d{d}"))

        for t,td in self.teachers.items():
            if td.get("isSpecial"): continue
            mw = td.get("maxLessons")
            av = [v for _,_,_,_,v in self.idx.teacher_var_index[t]]
            if not av: continue
            tv = self.model.NewIntVar(0, len(av), f"tot_{t}")
            self.model.Add(tv == sum(av)); self.teacher_total[t] = tv
            if mw:
                ol = self.model.NewIntVar(0, len(av), f"wol_{t}")
                self.model.Add(sum(av) <= int(mw) + ol)
                self.penalties.append((ol, self.W_WEEKLY_OVERLOAD,
                                       f"{t}: weekly overload"))

        logger.info("[%s] Soft constraints: %d penalty vars", self.cid, len(self.penalties))

    def set_obj(self):
        if not self.penalties: return
        pv,pw,_ = zip(*self.penalties)
        self.model.Minimize(cp_model.LinearExpr.WeightedSum(list(pv),list(pw)))

    def add_strategy(self):
        av = [v for cg in self.class_groups for d in range(self.num_days)
              for s in range(self.num_slots)
              for tv in self.x[cg["key"]][d][s].values() for v in tv.values()]
        if av: self.model.AddDecisionStrategy(
            av, cp_model.CHOOSE_MIN_DOMAIN_SIZE, cp_model.SELECT_MIN_VALUE)

class SolutionExtractor:
    def __init__(self, b, s): self.b=b; self.s=s
    def extract(self):
        tt = {}
        for cg in self.b.class_groups:
            ck = cg["key"]
            tt[ck] = {"grade":cg["grade"],"streamIndex":cg["stream_index"],
                      "streamName":cg["stream_name"],"days":{}}
            for di,day in enumerate(self.b.working_days):
                slots = []
                for si in range(self.b.num_slots):
                    cs = self.b.common_session
                    if cs.get("enabled") and day==cs.get("day","FRI") and si==int(cs.get("slotIndex",0)):
                        slots.append({"subject":cs.get("name","Assembly"),
                                      "teacher":"", "grade":cg["grade"],
                                      "isCommon":True})
                        continue
                    cell = None
                    for t,sv in self.b.x[ck][di][si].items():
                        for sub,var in sv.items():
                            if self.s.Value(var):
                                cell = {"subject":sub,"teacher":t,"grade":cg["grade"]}
                                break
                        if cell: break
                    if cell is None:
                        cell = {"subject": self.b.filler_label,
                                "teacher": "", "grade": cg["grade"],
                                "isFiller": True}
                    slots.append(cell)
                tt[ck]["days"][day] = slots
        return tt

    def count_fillers(self):
        n = 0
        for cg in self.b.class_groups:
            ck = cg["key"]
            for d in range(self.b.num_days):
                for s in range(self.b.num_slots):
                    if (ck in self.b.fillers and d in self.b.fillers[ck]
                        and s in self.b.fillers[ck][d]):
                        if self.s.Value(self.b.fillers[ck][d][s]):
                            n += 1
        return n

    def count_missing(self):
        n = 0
        for var,w,desc in self.b.penalties:
            if "missing" in desc or "no teacher" in desc:
                n += int(self.s.Value(var))
        return n

    def violations(self):
        total_req = max(1, sum(self.b.idx.required_lessons.values()))
        vs = []
        for var,w,desc in self.b.penalties:
            v = self.s.Value(var)
            if v>0:
                sev = (Severity.CRITICAL if w>=500_000 else Severity.HIGH if w>=50_000
                       else Severity.MEDIUM if w>=10_000 else Severity.LOW)
                cov = round(v/total_req*100,1) if "missing" in desc else 0.0
                vs.append(Violation(desc,sev,v,v*w,cov).to_dict())
        return vs

def count_fillers_simple(builder, solver):
    n = 0
    for cg in builder.class_groups:
        ck = cg["key"]
        for d in range(builder.num_days):
            for s in range(builder.num_slots):
                if (ck in builder.fillers and d in builder.fillers[ck]
                    and s in builder.fillers[ck][d]):
                    if solver.Value(builder.fillers[ck][d][s]):
                        n += 1
    return n

def auto_reduce_config(original_config, max_reduction=2,
                       per_iter_timeout=10.0, workers=4):
    cfg = copy.deepcopy(original_config)
    high_priority = set(cfg.get("highPrioritySubjects", []))

    original_lessons = {}
    for t, td in cfg["teachers"].items():
        for a in td.get("assignments", []):
            key = (t, int(a["grade"]), int(a.get("streamIndex",0)), a["subject"])
            original_lessons[key] = int(a["lessons"])

    reductions_log: List[str] = []
    best = None

    for iteration in range(200):
        try:
            builder = ModelBuilder(cfg)
            builder.add_hard(); builder.add_soft(); builder.set_obj(); builder.add_strategy()
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = per_iter_timeout
            solver.parameters.num_search_workers = workers
            status = solver.Solve(builder.model)
        except Exception as e:
            logger.warning("Reducer iteration %d error: %s", iteration, e)
            break

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            logger.warning("Reducer iteration %d infeasible", iteration)
            break

        fillers = count_fillers_simple(builder, solver)
        logger.info("[Reducer] iter=%d fillers=%d reductions=%d",
                    iteration, fillers, len(reductions_log))

        if best is None or fillers < best[1]:
            best = (copy.deepcopy(cfg), fillers, list(reductions_log))

        if fillers <= 0:
            break

        candidates = []
        for t, td in cfg["teachers"].items():
            for a in td.get("assignments", []):
                key = (t, int(a["grade"]), int(a.get("streamIndex",0)), a["subject"])
                orig = original_lessons[key]
                current = int(a["lessons"])
                remaining = max_reduction - (orig - current)
                if current > 1 and remaining > 0:
                    is_high = a["subject"] in high_priority
                    candidates.append((t, a, is_high, current, orig, key))

        if not candidates:
            logger.info("[Reducer] No more reducible subjects")
            break

        candidates.sort(key=lambda x: (x[2], -x[3]))
        t, a, _, _, orig, key = candidates[0]
        a["lessons"] = int(a["lessons"]) - 1
        reductions_log.append(
            f"{a['subject']} (Gr {a['grade']} Str {a.get('streamIndex',0)}, {t}): "
            f"{orig}→{a['lessons']}"
        )

    if best is None:
        return (copy.deepcopy(original_config), 10**9, [])
    return best

def run_solver(config, timeout=300.0, workers=8, cid="?", progress=None):
    ok, err, errors = validate_config(config)
    if not ok: raise ValueError(f"{err}: {errors}")
    original = preprocess_config(config)

    t_start = time.time()

    builder = ModelBuilder(original, cid=cid)
    builder.add_hard(); builder.add_soft(); builder.set_obj(); builder.add_strategy()
    cp = cp_model.CpSolver()
    cp.parameters.max_time_in_seconds = min(timeout, 60.0)
    cp.parameters.num_search_workers = workers
    if progress:
        status = cp.Solve(builder.model, SolveProgressCallback(progress))
    else:
        status = cp.Solve(builder.model)
    elapsed = time.time()-t_start

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        logger.warning("[%s] First solve infeasible. Falling back to reducer.", cid)
        return _finalize_from_reducer(original, timeout, workers, cid)

    ex = SolutionExtractor(builder, cp)
    fillers_initial = ex.count_fillers()
    missing_initial = ex.count_missing()
    logger.info("[%s] First solve: fillers=%d missing=%d time=%.2fs",
                cid, fillers_initial, missing_initial, elapsed)

    reductions: List[str] = []
    if fillers_initial > 0:
        max_red = int(original.get("maxReductionPerSubject", 2))
        best_cfg, best_fillers, reductions = auto_reduce_config(
            original, max_reduction=max_red,
            per_iter_timeout=max(5.0, min(15.0, (timeout - elapsed) / 10)),
            workers=workers,
        )

        if best_fillers < fillers_initial:
            logger.info("[%s] Reducer improved fillers %d → %d",
                        cid, fillers_initial, best_fillers)
            builder = ModelBuilder(best_cfg, cid=cid)
            builder.add_hard(); builder.add_soft(); builder.set_obj(); builder.add_strategy()
            cp = cp_model.CpSolver()
            cp.parameters.max_time_in_seconds = max(20.0, timeout - (time.time() - t_start))
            cp.parameters.num_search_workers = workers
            status = cp.Solve(builder.model)
            if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
                ex = SolutionExtractor(builder, cp)
                elapsed = time.time()-t_start
            else:
                reductions = []
                builder = ModelBuilder(original, cid=cid)
                builder.add_hard(); builder.add_soft(); builder.set_obj(); builder.add_strategy()
                cp = cp_model.CpSolver()
                cp.parameters.max_time_in_seconds = timeout - (time.time() - t_start)
                cp.parameters.num_search_workers = workers
                cp.Solve(builder.model)
                ex = SolutionExtractor(builder, cp)
        else:
            reductions = []

    fillers = ex.count_fillers()
    missing = ex.count_missing()

    total_req = max(1, sum(ex.b.idx.required_lessons.values()))
    total_slots = sum(
        1 for cg in ex.b.class_groups
        for d in range(ex.b.num_days)
        for s in range(ex.b.num_slots)
        if not ex.b._is_common_slot(d, s)
    )
    completeness = round(1 - (missing / total_req), 3) if total_req > 0 else 1.0
    packing = round(1 - (fillers / max(1, total_slots)), 3)
    if fillers == 0 and missing == 0:
        quality_label = "Excellent"
    elif completeness >= 0.98 and packing >= 0.95:
        quality_label = "Very Good"
    elif completeness >= 0.95 and packing >= 0.85:
        quality_label = "Good"
    elif completeness >= 0.90:
        quality_label = "Acceptable"
    else:
        quality_label = "Needs Review"

    stats = ex.b.stats
    stats.solve_time = elapsed
    stats.status = cp.StatusName(status)
    stats.optimal = (status == cp_model.OPTIMAL)
    stats.wall_time = cp.WallTime()
    stats.branches = cp.NumBranches()
    stats.objective = int(cp.ObjectiveValue())
    stats.fillers = fillers
    stats.missing = missing

    tt = ex.extract()
    violations = ex.violations()

    verify_ok, verify_msg = _verify_timetable(tt, ex.b)
    if not verify_ok:
        logger.error("[%s] Verification failed: %s", cid, verify_msg)

    return {
        "success": True,
        "timetable": tt,
        "violations": violations,
        "stats": stats.to_dict(),
        "reductions": reductions,
        "fillers": fillers,
        "missing": missing,
        "quality": {
            "completeness": completeness,
            "packing": packing,
            "label": quality_label,
            "verified": verify_ok,
        },
    }

def _finalize_from_reducer(original_config, timeout, workers, cid):
    max_red = int(original_config.get("maxReductionPerSubject", 2))
    best_cfg, best_fillers, reductions = auto_reduce_config(
        original_config, max_reduction=max_red, workers=workers)
    builder = ModelBuilder(best_cfg, cid=cid)
    builder.add_hard(); builder.add_soft(); builder.set_obj(); builder.add_strategy()
    cp = cp_model.CpSolver()
    cp.parameters.max_time_in_seconds = timeout
    cp.parameters.num_search_workers = workers
    cp.Solve(builder.model)
    ex = SolutionExtractor(builder, cp)
    fillers = ex.count_fillers()
    missing = ex.count_missing()
    stats = builder.stats
    stats.fillers = fillers; stats.missing = missing
    return {
        "success": True,
        "timetable": ex.extract(),
        "violations": ex.violations(),
        "stats": stats.to_dict(),
        "reductions": reductions,
        "fillers": fillers,
        "missing": missing,
        "quality": {"completeness": 0.0, "packing": 0.0,
                    "label": "Fallback", "verified": False},
    }

def _verify_timetable(timetable, builder):
    try:
        for ck, data in timetable.items():
            for day, slots in data["days"].items():
                for slot_data in slots:
                    if slot_data is None: continue
                    if slot_data.get("isCommon") or slot_data.get("isFiller"):
                        continue
                    if not slot_data.get("subject") or not slot_data.get("teacher"):
                        return False, f"Missing subject/teacher in {ck}/{day}"
        return True, "OK"
    except Exception as e:
        return False, str(e)

@app.route("/generate", methods=["POST"])
def generate():
    cid = uuid.uuid4().hex[:7]
    try:
        config = request.get_json(force=True, silent=True)
        if config is None:
            return jsonify({"success":False,"message":"Invalid JSON"}), 400
        cached = _cache.get(config)
        if cached:
            inc("cache_hits"); return jsonify(cached)
        inc("cache_misses")
        timeout = float(request.args.get("timeout",300))
        workers = int(request.args.get("workers",8))
        result = run_solver(config, timeout=timeout, workers=workers, cid=cid)
        if result.get("success"):
            _cache.put(config, result)
        inc("solves_total")
        inc(f"status_{result.get('stats',{}).get('status','UNKNOWN')}")
        inc("solve_seconds", result.get("stats",{}).get("solveTime",0))
        return jsonify(result)
    except ValueError as e:
        return jsonify({"success":False,"message":str(e)}), 400
    except Exception as e:
        logger.error("Error: %s",e,exc_info=True); inc("errors")
        return jsonify({"success":False,"message":f"Server error: {e}"}), 500

@app.route("/verify", methods=["POST"])
def verify():
    try:
        body = request.get_json(force=True, silent=True) or {}
        config = body.get("config")
        timetable = body.get("timetable")
        if not config or not timetable:
            return jsonify({"error": "config and timetable required"}), 400
        errors = []
        for ck, data in timetable.items():
            for day, slots in data.get("days", {}).items():
                for idx, slot in enumerate(slots):
                    if slot is None: continue
                    if not (slot.get("isCommon") or slot.get("isFiller") or
                            (slot.get("subject") and slot.get("teacher"))):
                        errors.append(f"{ck}/{day}/{idx}: invalid slot")
        return jsonify({"valid": len(errors)==0, "errors": errors[:20]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "version": "8.1.0",
        "capability": "bulletproof-with-fillers",
        "timestamp": time.time(),
        "cache": _cache.stats(),
    })

@app.route("/metrics", methods=["GET"])
def metrics():
    lines = ["# EduSchedule Pro metrics"]
    with _metrics_lock:
        for k,v in _metrics.items(): lines.append(f"eduscheduler_{k} {v}")
    return Response("\n".join(lines)+"\n", mimetype="text/plain")

def _on_sigterm(signum, frame):
    logger.info("SIGTERM received – shutting down"); sys.exit(0)
signal.signal(signal.SIGTERM, _on_sigterm)

if __name__ == "__main__":
    logger.info("="*60)
    logger.info("EduSchedule Pro v8.1.0 — Strict max-2, always full timetable")
    logger.info("="*60)
    app.run(debug=False, host="0.0.0.0", port=5000)