import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Rnd } from "react-rnd";
import { Search, X, Minus, Square, PanelsTopLeft, Bell, Clock3 } from "lucide-react";
import wallpaper from "@/assets/wallpaper-night-city.jpg";
import { APPS, APP_ORDER, PINNED_APPS, searchApps, type AppId } from "@/core/applications/registry";
import { PixelIcon } from "@/shared/components/PixelIcon";
import { TASKBAR_HEIGHT, desktopBounds, useWindows } from "@/core/windows/windowStore";
import { dbGet, dbGetAll } from "@/services/persistence/db";
import type { Geometry } from "@/core/windows/windowReducer";
import { useSettings, type Settings } from "@/features/settings/settingsStore";
import "./pixel-os-shell.css";
import { TicketsApp } from "@/features/tickets/TicketsApp";
import { useProgress, type ProgressPersisted } from "@/features/progress/progressStore";
import { useChapter1 } from "@/features/chapter1/chapter1Store";
import { EditorApp } from "@/features/editor/EditorApp";
import { ChatApp } from "@/features/chat/ChatApp";
import { ProgressApp } from "@/features/progress/ProgressApp";
import { BrowserApp } from "@/features/browser/BrowserApp";
import { useGigboardApplication } from "@/features/browser/gigboardApplicationStore";
import { useCafeMilestones } from "@/features/chapter1/cafeCoding/cafeMilestoneStore";
import { SettingsApp } from "@/features/settings/SettingsApp";
import { useChat, type ChatPersisted } from "@/features/chat/chatStore";
import { useDrafts } from "@/features/tickets/draftStore";
import { useNotifications } from "@/features/notifications/notificationStore";
import { ExplorerApp } from "@/features/explorer/ExplorerApp";
import { TerminalApp } from "@/features/terminal/TerminalApp";
import type { TicketId } from "@/features/tickets/data/tickets";


function AppPreview({ id }: { id: AppId }) {
  if (id === "tickets") return <TicketsApp />;
  if (id === "editor") return <EditorApp />;
  if (id === "chat") return <ChatApp />;
  if (id === "browser") return <BrowserApp />;
  if (id === "progress") return <ProgressApp />;
  if (id === "settings") return <SettingsApp />;
  if (id === "explorer") return <ExplorerApp />;
  if (id === "terminal") return <TerminalApp />;
  return <div className="cq-app-empty"><PixelIcon name={APPS[id].icon} size={64}/><h2>{APPS[id].title}</h2><p>Coming soon — this application is not part of the current MVP.</p></div>;
}

function WindowFrame({ id, z }: { id: AppId; z: number }) {
  const win = useWindows(s=>s.windows[id]);
  const focused = useWindows(s=>s.focused===id);
  const { focus, close, minimize, toggleMaximize, setGeometry } = useWindows.getState();
  if (!win.open || win.minimized) return null;
  const bounds=desktopBounds();
  const position=win.maximized?{x:0,y:0}:{x:win.x,y:win.y};
  const size=win.maximized?{width:bounds.width,height:bounds.height}:{width:win.width,height:win.height};
  return <Rnd key={id} className={`cq-window ${focused?"cq-window-active":""}`} style={{zIndex:z}} bounds="parent" position={position} size={size} minWidth={Math.min(APPS[id].minSize.width,bounds.width)} minHeight={Math.min(APPS[id].minSize.height,bounds.height)} disableDragging={win.maximized} enableResizing={!win.maximized} dragHandleClassName="cq-window-titlebar" onDragStart={()=>focus(id)} onDragStop={(_e,d)=>setGeometry(id,{x:d.x,y:d.y})} onResizeStart={()=>focus(id)} onResizeStop={(_e,_direction,ref,_delta,pos)=>setGeometry(id,{x:pos.x,y:pos.y,width:ref.offsetWidth,height:ref.offsetHeight})} onMouseDown={()=>focus(id)}>
    <div className="cq-window-inner"><div className="cq-window-titlebar" onDoubleClick={()=>toggleMaximize(id)}><PixelIcon name={APPS[id].icon} size={22}/><strong>{APPS[id].title}</strong><div className="cq-window-controls"><button aria-label={`Minimize ${APPS[id].title}`} onClick={e=>{e.stopPropagation();minimize(id);}}><Minus size={15}/></button><button aria-label={`${win.maximized?"Restore":"Maximize"} ${APPS[id].title}`} onClick={e=>{e.stopPropagation();toggleMaximize(id);}}><Square size={12}/></button><button className="cq-close" aria-label={`Close ${APPS[id].title}`} onClick={e=>{e.stopPropagation();close(id);}}><X size={16}/></button></div></div><div className="cq-window-content"><AppPreview id={id}/></div></div>
  </Rnd>;
}

export default function PixelOS() {
  const windows=useWindows(s=>s.windows);
  const order=useWindows(s=>s.order);
  const focused=useWindows(s=>s.focused);
  const {open,taskbarClick,dispatch,hydrateGeometry}=useWindows.getState();
  const settings=useSettings();
  const progress=useProgress();
  const notifications=useNotifications();
  const [notificationCenter,setNotificationCenter]=useState(false);
  const [restoring,setRestoring]=useState(true);
  const [restoreError,setRestoreError]=useState<string|null>(null);
  const [startOpen,setStartOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [clock,setClock]=useState(()=>new Date());
  const [selected,setSelected]=useState<AppId|null>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  const startButtonRef=useRef<HTMLButtonElement>(null);
  const results=useMemo(()=>searchApps(search),[search]);
  useEffect(()=>{let alive=true;Promise.all([dbGet<Record<AppId,Geometry>>("prefs","windows"),dbGet<Partial<Settings>>("prefs","settings"),dbGet<ProgressPersisted>("progress","state"),dbGet<ChatPersisted>("chat","state"),dbGetAll<string>("drafts"),useChapter1.getState().hydrate(),useGigboardApplication.getState().hydrate(),useCafeMilestones.getState().hydrate()]).then(([geometry,prefs,savedProgress,savedChat,savedDrafts])=>{if(alive){hydrateGeometry(geometry);settings.hydrate(prefs);progress.hydrate(savedProgress);useChat.getState().hydrate(savedChat);useDrafts.getState().hydrate(savedDrafts as Partial<Record<TicketId,string>>);}}).catch(err=>{if(alive){setRestoreError(err instanceof Error?err.message:String(err));console.warn("Could not restore Pixel OS preferences",err);}}).finally(()=>{if(alive)setRestoring(false);});return()=>{alive=false;};},[]);
  useEffect(()=>{const t=window.setInterval(()=>setClock(new Date()),30000);return()=>clearInterval(t);},[]);
  useEffect(()=>{const resize=()=>dispatch({type:"CLAMP_ALL",bounds:desktopBounds()});window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[dispatch]);
  useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==="Escape"&&startOpen){setStartOpen(false);setSearch("");}};const pointer=(e:PointerEvent)=>{if(startOpen&&!menuRef.current?.contains(e.target as Node)&&!startButtonRef.current?.contains(e.target as Node))setStartOpen(false);};window.addEventListener("keydown",key);window.addEventListener("pointerdown",pointer);return()=>{window.removeEventListener("keydown",key);window.removeEventListener("pointerdown",pointer);};},[startOpen]);
  const launch=(id:AppId)=>{open(id);setStartOpen(false);setSearch("");};
  return <div className={`cq-os ${settings.theme==="light"?"theme-light":""} ${settings.reducedMotion?"cq-reduced-motion":""}`} style={{"--cq-scale":settings.uiScale} as CSSProperties}>
    <img className="cq-wallpaper" src={wallpaper} alt="" />
    {restoring && <div className="cq-boot-overlay" role="status">Loading saved CodeQuest workspace…</div>}
    {!restoring && restoreError && <div className="cq-restore-error" role="alert">Saved data could not be loaded: {restoreError}. Changes may overwrite older data. <button onClick={()=>setRestoreError(null)}>Dismiss</button></div>}
    {!restoring && <div className="cq-desktop-icons" aria-label="Desktop shortcuts">{PINNED_APPS.map(id=><button key={id} className={`cq-shortcut ${selected===id?"cq-selected":""}`} onClick={()=>setSelected(id)} onDoubleClick={()=>launch(id)} onKeyDown={e=>{if(e.key==="Enter")launch(id);}} title={`Double click to open ${APPS[id].title}`}><PixelIcon name={APPS[id].icon} size={43}/><span>{APPS[id].title}</span></button>)}</div>}
    {!restoring && <div className="cq-window-layer" style={{bottom:TASKBAR_HEIGHT}}>{order.map((id,i)=><WindowFrame key={id} id={id} z={10+i}/>)}</div>}
    {startOpen&&<div className="cq-start-menu" ref={menuRef}><header><div><span className="cq-brand-symbol">▦</span><strong>CodeQuest</strong><small>PIXEL OS</small></div><button aria-label="Close Start menu" onClick={()=>setStartOpen(false)}><X size={17}/></button></header><label className="cq-search"><Search size={17}/><input autoFocus placeholder="Search applications..." value={search} onChange={e=>setSearch(e.target.value)}/></label><div className="cq-menu-caption">{search?"Search results":"Pinned applications"}</div><div className="cq-menu-apps">{results.map(app=><button key={app.id} onClick={()=>launch(app.id)}><PixelIcon name={app.icon} size={31}/><span>{app.shortTitle}</span>{app.comingSoon&&<small>Soon</small>}</button>)}{results.length===0&&<p>No applications found.</p>}</div><div className="cq-menu-caption">Recommended</div><button className="cq-recommended" onClick={()=>launch("tickets")}>📋 Continue your first Python ticket <span>›</span></button><footer><span>👾 Developer</span><span>CodeQuest v0.1</span></footer></div>}
    <div className="cq-toast-stack" aria-live="polite">{notifications.toasts.map(n=><div key={n.id} className={`cq-toast cq-toast-${n.kind}`}><div><strong>{n.title}</strong><p>{n.message}</p></div><button aria-label="Dismiss notification" onClick={()=>notifications.dismiss(n.id)}><X size={15}/></button></div>)}</div>
    {notificationCenter&&<div className="cq-notification-center"><header><strong>Notifications</strong><button onClick={()=>notifications.clearHistory()}>Clear all</button></header>{notifications.history.length?notifications.history.map(n=><div key={n.id}><strong>{n.title}</strong><p>{n.message}</p></div>):<p>No notifications yet.</p>}</div>}
    <div className="cq-taskbar"><div className="cq-taskbar-brand" title="CodeQuest Pixel OS"><PanelsTopLeft size={19}/><span>CodeQuest</span></div><div className="cq-taskbar-center"><button ref={startButtonRef} className={`cq-taskbar-button cq-start-button ${startOpen?"cq-taskbar-focused":""}`} onClick={()=>setStartOpen(v=>!v)} aria-label="Open Start menu" aria-expanded={startOpen}><span>▦</span></button>{PINNED_APPS.map(id=><button key={id} className={`cq-taskbar-button ${windows[id].open?"cq-taskbar-running":""} ${focused===id?"cq-taskbar-focused":""}`} title={APPS[id].title} aria-label={`Open ${APPS[id].title}`} onClick={()=>{setStartOpen(false);taskbarClick(id);}}><PixelIcon name={APPS[id].icon} size={29}/></button>)}</div><div className="cq-taskbar-tray"><button className="cq-tray-bell" aria-label="Notification center" onClick={()=>{setNotificationCenter(v=>!v);notifications.markSeen();}}><Bell size={16}/>{notifications.unseen>0&&<span>{notifications.unseen}</span>}</button><div className="cq-clock"><span>{clock.toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"})}</span><span>{clock.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}</span></div><Clock3 size={15}/></div></div>
  </div>;
}
