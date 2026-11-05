import { useMemo, useState } from "react";
import { Check, ChevronRight, CircleDot, ClipboardList, Code2, Filter, Lightbulb, LockKeyhole, Search, Trophy } from "lucide-react";
import { TICKETS, TICKETS_BY_ID, type TicketDefinition, type TicketId } from "./data/tickets";
import { useProgress } from "@/features/progress/progressStore";
import { isUnlocked } from "@/features/progress/progressLogic";
import { useWindows } from "@/core/windows/windowStore";
import "./tickets-app.css";

type FilterValue = "all" | "available" | "in-progress" | "completed" | "locked";
type TicketStatus = Exclude<FilterValue, "all">;

export function TicketsApp() {
  const progress = useProgress();
  const [selected, setSelected] = useState<TicketId>(progress.currentTicketId);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterValue>("all");
  const [hintCount, setHintCount] = useState<Partial<Record<TicketId, number>>>({});
  const unlocked = useMemo(() => new Set(TICKETS.filter(t => isUnlocked(t.id, progress.completions)).map(t => t.id)), [progress.completions]);
  const statusOf = (id: TicketId): TicketStatus => {
    if (progress.completions[id]) return "completed";
    if (!unlocked.has(id)) return "locked";
    if (progress.started.includes(id)) return "in-progress";
    return "available";
  };
  const filtered = TICKETS.filter(t => {
    const matches = `${t.id} ${t.title} ${t.topic} ${t.summary}`.toLowerCase().includes(query.toLowerCase().trim());
    return matches && (filter === "all" || statusOf(t.id) === filter);
  });
  const ticket: TicketDefinition = TICKETS_BY_ID[selected];
  const status = statusOf(selected);
  const count = (s: TicketStatus) => TICKETS.filter(t => statusOf(t.id) === s).length;
  const openEditor = () => {
    if (status === "locked") return;
    progress.setCurrentTicket(ticket.id);
    progress.markStarted(ticket.id);
    useWindows.getState().open("editor");
  };
  return <div className="cq-jira">
    <header className="cq-jira-top"><div className="cq-jira-brand"><ClipboardList size={21}/><span>CODEQUEST <b>/</b> PROJECT BOARD</span></div><span className="cq-jira-topright">PYTHON TRACK <span className="cq-jira-led"/> ONLINE</span></header>
    <div className="cq-jira-overview"><div><div className="cq-jira-eyebrow">PROJECT / DEVELOPMENT</div><h1>My Tickets <span className="cq-jira-title-count">{TICKETS.length}</span></h1><p>Assigned programming issues · Sprint 01</p></div><div className="cq-jira-summary"><span><Trophy size={16}/> {TICKETS.filter(t=>!!progress.completions[t.id]).reduce((n,t)=>n+t.xp,0)} XP</span><span><Check size={16}/> {count("completed")}/{TICKETS.length} DONE</span></div></div>
    <div className="cq-jira-workspace">
      <aside className="cq-jira-list"><div className="cq-jira-search"><Search size={16}/><input aria-label="Search tickets" placeholder="Search issues..." value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="cq-jira-filter-title"><Filter size={14}/> FILTER ISSUES</div><div className="cq-jira-filters" aria-label="Ticket status filters">{(["all","available","in-progress","completed","locked"] as FilterValue[]).map(f=><button key={f} className={filter===f?"active":""} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==="in-progress"?"In Progress":f.charAt(0).toUpperCase()+f.slice(1)}<span>{f==="all"?TICKETS.length:count(f)}</span></button>)}</div><div className="cq-jira-list-label">ISSUES <span>{filtered.length}</span></div><div className="cq-jira-issues">{filtered.map(t=>{const s=statusOf(t.id);return <button key={t.id} className={`cq-jira-issue ${selected===t.id?"selected":""}`} onClick={()=>setSelected(t.id)} aria-current={selected===t.id?"true":undefined}><div className="cq-jira-issue-line"><span className="cq-jira-id">{t.id}</span><span className={`cq-jira-status cq-status-${s}`}>{s==="locked"?<LockKeyhole size={11}/>:s==="completed"?<Check size={11}/>:<CircleDot size={11}/>} {s.replace("-"," ")}</span></div><strong>{t.title}</strong><small>{t.topic} <span>·</span> {t.xp} XP</small></button>;})}{filtered.length===0&&<div className="cq-jira-empty">No matching issues.</div>}</div></aside>
      <main className="cq-jira-detail"><div className="cq-jira-breadcrumb">CodeQuest <ChevronRight size={13}/> Python Basics <ChevronRight size={13}/> <b>{ticket.id}</b></div><div className="cq-jira-ticket-header"><div><div className="cq-jira-eyebrow">{ticket.id} <span>·</span> {ticket.topic.toUpperCase()}</div><h2>{ticket.title}</h2></div><span className={`cq-jira-status cq-status-${status}`}>{status==="locked"?<LockKeyhole size={12}/>:status==="completed"?<Check size={12}/>:<CircleDot size={12}/>} {status.replace("-"," ")}</span></div>
      <div className="cq-jira-meta"><div><small>DIFFICULTY</small><strong>{ticket.difficulty}</strong></div><div><small>REWARD</small><strong className="cq-jira-xp">✦ {ticket.xp} XP</strong></div><div><small>LANGUAGE</small><strong>Python</strong></div><div><small>FILE</small><strong>{ticket.fileName}</strong></div></div>
      <section className="cq-jira-section"><h3>DESCRIPTION</h3><p>{ticket.description}</p></section>
      <section className="cq-jira-section"><h3>REQUIREMENTS</h3><ul className="cq-jira-checklist">{ticket.requirements.map((req,i)=><li key={i}><span className="cq-jira-check-box"/>{req}</li>)}</ul></section>
      <section className="cq-jira-section"><h3>EXAMPLES</h3>{ticket.examples.map((ex,i)=><div className="cq-jira-example" key={i}>{ex.input!==undefined&&<><small>INPUT</small><pre>{ex.input}</pre></>}<small>EXPECTED OUTPUT</small><pre>{ex.output}</pre></div>)}</section>
      <section className="cq-jira-section"><h3>ACCEPTANCE CRITERIA</h3><ul className="cq-jira-acceptance">{ticket.acceptance.map((item,i)=><li key={i}><Check size={15}/>{item}</li>)}</ul></section>
      <section className="cq-jira-section cq-jira-hints"><h3><Lightbulb size={17}/> DEVELOPER HINTS <span>FREE</span></h3>{ticket.hints.slice(0,hintCount[ticket.id]??0).map((hint,i)=><p key={i}><b>Hint {i+1}:</b> {hint}</p>)}{(hintCount[ticket.id]??0)<ticket.hints.length?<button onClick={()=>setHintCount(s=>({...s,[ticket.id]:(s[ticket.id]??0)+1}))}><Lightbulb size={15}/> Reveal hint {(hintCount[ticket.id]??0)+1} of {ticket.hints.length}</button>:<p className="cq-jira-all-hints">All hints revealed. No XP penalty.</p>}</section>
      <div className="cq-jira-actions">{status==="locked"?<div className="cq-jira-locked"><LockKeyhole size={17}/> Complete the previous ticket to unlock this issue.</div>:<button className="cq-jira-open" onClick={openEditor}><Code2 size={17}/>{status==="completed"?"Practice in Editor":"Open in Code Editor"}<ChevronRight size={17}/></button>}<span>{status==="completed"?"Completed · XP already awarded":status==="locked"?"Locked issue":"Your code will be saved automatically in the editor"}</span></div>
      </main>
    </div>
  </div>;
}
